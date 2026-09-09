import { ZhihuApiError, ZhihuClient, type ZhihuSearchItem } from "@/lib/zhihu";

export interface WorldScenario {
  id: string;
  title: string;
  author: string;
  authorAvatar: string;
  content: string;
  url: string;
  votes: number;
  comments: number;
  editTime: number;
}

const scenarioTitlePattern = /(假如|假设|如果|若是|要是|会怎样)/;

export function requireZhihuAccessSecret() {
  const accessSecret = process.env.ZHIHU_ACCESS_SECRET;

  if (!accessSecret) {
    throw new Error("缺少必需的环境变量 ZHIHU_ACCESS_SECRET");
  }

  return accessSecret;
}

function cleanText(value: string) {
  return value
    .replaceAll("<em>", "")
    .replaceAll("</em>", "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapScenario(item: ZhihuSearchItem): WorldScenario | null {
  const id = item.ContentID.trim();
  const title = cleanText(item.Title);

  if (!id || !title) return null;

  return {
    id,
    title,
    author: item.AuthorName.trim(),
    authorAvatar: item.AuthorAvatar.trim(),
    content: cleanText(item.ContentText),
    url: item.Url.trim(),
    votes: item.VoteUpCount,
    comments: item.CommentCount,
    editTime: item.EditTime,
  };
}

export async function getWorldScenarios(accessSecret: string): Promise<WorldScenario[]> {
  const data = await new ZhihuClient(accessSecret).search({
    Query: "假如 如果 脑洞",
    Count: 20,
  });
  const { Items } = data;

  const scenarios = Items.map(mapScenario)
    .filter((scenario): scenario is WorldScenario => scenario !== null)
    .filter((scenario) => scenarioTitlePattern.test(scenario.title));

  console.info("[岔路] 知乎副本搜索结果", {
    rawCount: Items.length,
    matchedCount: scenarios.length,
    hasMore: data.HasMore,
    items: scenarios.map(({ id, title, author, votes, comments }) => ({
      id,
      title,
      author,
      votes,
      comments,
    })),
  });

  if (!scenarios.length) {
    throw new ZhihuApiError(404, "知乎搜索没有返回符合条件的假设题");
  }

  return scenarios.slice(0, 12);
}

export async function getWorldScenario(
  accessSecret: string,
  id: string,
  title?: string,
): Promise<WorldScenario> {
  const client = new ZhihuClient(accessSecret);
  const query = title?.trim() || id;
  const { Items } = await client.search({ Query: query, Count: 20 });
  const item = Items.find((searchItem) => searchItem.ContentID === id);

  if (item) {
    const scenario = mapScenario(item);
    if (scenario) return scenario;
  }

  if (query !== id) {
    const byId = await client.search({ Query: id, Count: 20 });
    const itemById = byId.Items.find((searchItem) => searchItem.ContentID === id);
    const scenario = itemById ? mapScenario(itemById) : null;

    if (scenario) return scenario;
  }

  throw new ZhihuApiError(404, `知乎内容不存在: ${id}`);
}

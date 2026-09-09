// ==================== 数据模型 ====================

export interface ZhihuSearchItem {
  Title: string;
  ContentType: string;
  ContentID: string;
  ContentText: string;
  Url: string;
  CommentCount: number;
  VoteUpCount: number;
  AuthorName: string;
  AuthorAvatar: string;
  EditTime: number;
}

export interface ZhihuSearchData {
  HasMore: boolean;
  Items: ZhihuSearchItem[];
}

export interface ZhihuResponse<T> {
  Code: number;
  Message: string;
  Data: T;
}

export type ZhihuSearchResponse = ZhihuResponse<ZhihuSearchData>;

export interface ZhihuSearchParams {
  Query: string;
  Count?: number;
}

// ==================== 错误处理 ====================

export class ZhihuApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "ZhihuApiError";
  }
}

const CACHE_TTL_MS = 30 * 60 * 1000;
// ponytail: 有界 Map,超 100 条淘汰最早项,避免 Workers 常驻内存无界增长
const CACHE_MAX_ENTRIES = 100;
const searchCache = new Map<string, { expiresAt: number; data: ZhihuSearchData }>();
const pendingSearches = new Map<string, Promise<ZhihuSearchData>>();

export class ZhihuClient {
  private readonly baseUrl = "https://developer.zhihu.com/api/v1/content/zhihu_search";
  private readonly accessSecret: string;

  constructor(accessSecret: string) {
    this.accessSecret = accessSecret;
  }

  async search(params: ZhihuSearchParams): Promise<ZhihuSearchData> {
    const cacheKey = `${params.Query}:${params.Count ?? 20}`;
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    const pending = pendingSearches.get(cacheKey);
    if (pending) return pending;

    const task = this.fetchSearch(params, cacheKey).finally(() => {
      pendingSearches.delete(cacheKey);
    });
    pendingSearches.set(cacheKey, task);
    return task;
  }

  private async fetchSearch(params: ZhihuSearchParams, cacheKey: string): Promise<ZhihuSearchData> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("Query", params.Query);

    if (params.Count !== undefined) {
      url.searchParams.set("Count", String(params.Count));
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.accessSecret}`,
        "X-Request-Timestamp": String(Math.floor(Date.now() / 1000)),
        "Content-Type": "application/json",
      },
    });
    let body: ZhihuResponse<ZhihuSearchData>;
    try {
      body = (await res.json()) as ZhihuResponse<ZhihuSearchData>;
    } catch (err) {
      console.error(`响应解析 JSON 失败 (HTTP 状态码: ${res.status}):`, err);
      throw new ZhihuApiError(90001, `响应解析失败,HTTP 状态码: ${res.status}`);
    }
    if (body.Code !== 0) {
      throw new ZhihuApiError(body.Code, body.Message);
    }

    if (searchCache.size >= CACHE_MAX_ENTRIES) {
      const oldestKey = searchCache.keys().next().value;
      if (oldestKey !== undefined) searchCache.delete(oldestKey);
    }
    searchCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: body.Data });

    return body.Data;
  }
}

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

// ==================== 客户端实现 ====================

export class ZhihuClient {
  private readonly baseUrl = "https://developer.zhihu.com/api/v1/content/zhihu_search";
  private readonly accessSecret: string;

  constructor(accessSecret: string) {
    this.accessSecret = accessSecret;
  }

  async search(params: ZhihuSearchParams): Promise<ZhihuSearchData> {
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
      console.error(`[ZhihuClient] 响应解析 JSON 失败 (HTTP 状态码: ${res.status}):`, err);
      throw new ZhihuApiError(90001, `响应解析失败,HTTP 状态码: ${res.status}`);
    }
    if (body.Code !== 0) {
      throw new ZhihuApiError(body.Code, body.Message);
    }

    return body.Data;
  }
}

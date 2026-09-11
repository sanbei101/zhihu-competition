import { createDeepSeek } from "@ai-sdk/deepseek";
import { type FlexibleSchema, NoObjectGeneratedError, Output, generateText } from "ai";
import { jsonrepair } from "jsonrepair";

/**
 * 模型接入点。默认走 DeepSeek 官方端点;
 * 只要在 .env 里配上 LLM_BASE_URL,就整体切到 OpenAI 兼容的中转站,调用方一行都不用改。
 *
 *   LLM_BASE_URL=https://d1api.xin/v1
 *   LLM_API_KEY=sk-xxxx
 *   LLM_MODEL=deepseek-v4.1-flash
 *
 * provider 的拼法是 `baseURL + "/chat/completions"`,所以 LLM_BASE_URL 要带 /v1 后缀。
 * 环境变量在函数内部读取,改完 .env 重启 dev 即生效,不会残留模块级快照。
 */

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export interface LlmConfig {
  /** 中转站地址;未配置时返回 undefined,由 provider 落到官方端点 */
  baseURL?: string;
  apiKey?: string;
  model: string;
  isRelay: boolean;
}

export function llmConfig(): LlmConfig {
  const baseURL = env("LLM_BASE_URL");
  const explicitKey = env("LLM_API_KEY");
  return {
    baseURL,
    // 走中转站时必须显式给 LLM_API_KEY:否则会把官方那把 key 误发到第三方,
    // 拿到的只是一句没头没脑的 401。切回官方时才会回落到 DEEPSEEK_API_KEY。
    apiKey: baseURL ? explicitKey : (explicitKey ?? env("DEEPSEEK_API_KEY")),
    model: env("LLM_MODEL") ?? "deepseek-v4.1-flash",
    isRelay: Boolean(baseURL),
  };
}

export function hasLlmKey(): boolean {
  return Boolean(llmConfig().apiKey);
}

/** 缺 key 时的统一提示,顺便把当前端点说清楚,方便排查。 */
export function missingLlmKeyMessage(): string {
  const { baseURL } = llmConfig();
  return baseURL ? `服务端缺少 LLM_API_KEY(当前端点 ${baseURL})` : "服务端缺少 DEEPSEEK_API_KEY";
}

export function llmModel() {
  const { baseURL, apiKey, model } = llmConfig();
  return createDeepSeek({
    ...(apiKey ? { apiKey } : {}),
    ...(baseURL ? { baseURL } : {}),
    ...(baseURL ? { fetch: relayTolerantFetch } : {}),
  })(model);
}

// ==================== 中转站兼容层 ====================

/**
 * 中转站(实测 d1api.xin,OneAPI 面板)返回的响应里 `role` 是空串 `""`,
 * 而 AI SDK 的非流式响应 schema 是 `role: z.literal("assistant").nullish()`、
 * 流式 chunk schema 是 `role: z.enum(["assistant"]).nullish()` -- 空串两个都过不了校验,
 * 于是整个响应被判定为 `AI_APICallError: Invalid JSON response`。
 *
 * 这里在 fetch 层把空 role 修回 assistant。只改这一个模式,别的字节一律不动。
 */
const EMPTY_ROLE_PATTERN = /"role"\s*:\s*""/g;

function repairRole(text: string): string {
  return text.replace(EMPTY_ROLE_PATTERN, '"role":"assistant"');
}

/**
 * 响应体已经被解压/改写过了,这几个头必须摘掉,
 * 否则消费端会拿着'gzip'的声明去解一段明文,或者按旧的长度截断。
 */
function repairedHeaders(source: Headers): Headers {
  const headers = new Headers(source);
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  return headers;
}

let roleRepairLogged = false;
function noteRoleRepair() {
  if (roleRepairLogged) return;
  roleRepairLogged = true;
  console.warn("中转站兼容层:已把响应里的空 role 修正为 assistant");
}

export const relayTolerantFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if ((response.headers.get("content-type") ?? "").includes("text/event-stream")) {
    if (!response.body) return response;

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";

    const transform = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const repaired = repairRole(line);
          if (repaired !== line) noteRoleRepair();
          controller.enqueue(encoder.encode(`${repaired}\n`));
        }
      },
      flush(controller) {
        buffer += decoder.decode();
        if (!buffer) return;
        controller.enqueue(encoder.encode(repairRole(buffer)));
      },
    });

    return new Response(response.body.pipeThrough(transform), {
      status: response.status,
      statusText: response.statusText,
      headers: repairedHeaders(response.headers),
    });
  }

  const text = await response.text();
  const repaired = repairRole(text);
  if (repaired !== text) noteRoleRepair();
  return new Response(repaired, {
    status: response.status,
    statusText: response.statusText,
    headers: repairedHeaders(response.headers),
  });
};

/** 中转站不一定实现 DeepSeek 的 thinking 字段,给个开关兜底。 */
export function llmProviderOptions() {
  if (env("LLM_SEND_THINKING") === "0") return undefined;
  return { deepseek: { thinking: { type: "disabled" as const } } };
}

// ==================== 结构化输出兜底 ====================

/**
 * `@ai-sdk/deepseek` 的 `createLanguageModel()` 从不设置 `supportsStructuredOutputs`,
 * 于是 `this.config.supportsStructuredOutputs === true` 恒为 false -- 这个 provider 永远
 * 走不到原生 `response_format: json_schema`,只能落到'兼容模式':把 schema 塞进 system message,
 * 靠模型自己吐 JSON。
 *
 * 官方端点上的模型会老老实实吐裸 JSON;换成中转站 / 新模型之后,它很爱用 ```json 围栏包起来,
 * 而 AI SDK 的解析器不剥围栏,于是直接抛 AI_JSONParseError。先用一句硬要求把概率压下去。
 */
export const JSON_ONLY_INSTRUCTION = `

输出格式:你的整条回复必须是一个裸 JSON 对象。不要用 markdown 代码块包裹,不要写 \`\`\`json,不要在 JSON 前后添加任何解释、前言或后记。`;

/** 删除根对象提前闭合后留下的逗号,例如 `{"a":1},"b":2}`。 */
function removePrematureRootClosure(text: string): string | undefined {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (
        depth === 0 &&
        text
          .slice(index + 1)
          .trimStart()
          .startsWith(",")
      ) {
        return text.slice(0, index) + text.slice(index + 1);
      }
    }
  }

  return undefined;
}

/** 从模型原始回复里硬挖出 JSON 对象(剥围栏、去前后废话、修复常见 JSON 错误)。 */
export function extractJsonObject(text: string | undefined): unknown {
  if (!text) return undefined;

  const candidates: string[] = [];
  for (const match of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    if (match[1]) candidates.push(match[1]);
  }
  candidates.push(text);

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    for (const attempt of [trimmed, trimmed.replace(/,\s*([}\]])/g, "$1")]) {
      try {
        const parsed: unknown = JSON.parse(attempt);
        if (parsed !== null && typeof parsed === "object") return parsed;
      } catch {
        // 换下一种候选文本继续试
      }

      const withoutPrematureClosure = removePrematureRootClosure(attempt);
      if (withoutPrematureClosure !== undefined) {
        try {
          const parsed: unknown = JSON.parse(withoutPrematureClosure);
          if (parsed !== null && typeof parsed === "object") return parsed;
        } catch {
          // 换下一种候选文本继续试
        }
      }

      try {
        const parsed: unknown = JSON.parse(jsonrepair(attempt));
        if (parsed !== null && typeof parsed === "object") return parsed;
      } catch {
        // 换下一种候选文本继续试
      }
    }
  }

  return undefined;
}

interface SchemaLike<T> {
  safeParse?: (input: unknown) => { success: boolean; data?: T };
}

/** 用传入的 schema 校验挖出来的对象。项目里传的都是 zod schema,只需要 safeParse。 */
function parseWithSchema<T>(schema: FlexibleSchema<T>, value: unknown): T | undefined {
  const candidate = schema as SchemaLike<T>;
  if (typeof candidate.safeParse !== "function") return undefined;
  const result = candidate.safeParse(value);
  return result.success ? result.data : undefined;
}

/**
 * 兜底:内容其实输出对了,只是被围栏或前后废话包住导致原生解析失败。
 * 从中转站回来时这类失败很常见,不值得为它整条链路重跑,更不该直接把错误抛给用户。
 */
export function salvageStructuredOutput<T>(
  error: unknown,
  schema: FlexibleSchema<T>,
): T | undefined {
  if (!NoObjectGeneratedError.isInstance(error)) return undefined;
  const extracted = extractJsonObject(error.text);
  return extracted === undefined ? undefined : parseWithSchema(schema, extracted);
}

interface StructuredCallOptions<T> {
  instructions: string;
  prompt: string;
  schema: FlexibleSchema<T>;
  temperature?: number;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
}

function logStructuredFailure(error: unknown, attempt: number) {
  if (!NoObjectGeneratedError.isInstance(error)) return;

  console.log(`[AI structured output failed, attempt ${attempt}] raw text:`);
  console.log(error.text ?? "<undefined>");
  console.log(
    `[AI structured output failed, attempt ${attempt}] escaped text:`,
    JSON.stringify(error.text),
  );
  console.log(`[AI structured output failed, attempt ${attempt}] cause:`, error.cause);
}

/** 结构化对象生成(generateText + Output.object),返回按 schema 解析后的对象。 */
export async function generateStructured<T>(options: StructuredCallOptions<T>): Promise<T> {
  const call = () =>
    generateText({
      model: llmModel(),
      instructions: `${options.instructions}${JSON_ONLY_INSTRUCTION}`,
      prompt: options.prompt,
      output: Output.object({ schema: options.schema }),
      providerOptions: llmProviderOptions(),
      temperature: options.temperature,
      maxOutputTokens: options.maxOutputTokens,
      abortSignal: options.abortSignal,
    });

  try {
    return (await call()).output;
  } catch (error) {
    logStructuredFailure(error, 1);

    // 1. 先从原始文本里抢救
    const salvaged = salvageStructuredOutput(error, options.schema);
    if (salvaged !== undefined) return salvaged;

    if (options.abortSignal?.aborted || !NoObjectGeneratedError.isInstance(error)) throw error;

    // 2. 再给模型一次机会
    try {
      return (await call()).output;
    } catch (retryError) {
      logStructuredFailure(retryError, 2);

      const retrySalvaged = salvageStructuredOutput(retryError, options.schema);
      if (retrySalvaged !== undefined) return retrySalvaged;
      throw retryError;
    }
  }
}

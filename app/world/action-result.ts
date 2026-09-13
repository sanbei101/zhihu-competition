import type { ZodError, ZodType } from "zod";

import { publicError, type PublicError } from "@/lib/app-error";
import { hasLlmKey, missingLlmKeyMessage } from "@/lib/deepseek";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: PublicError };

export function fail(error: PublicError): { ok: false; error: PublicError } {
  return { ok: false, error };
}

export function failParse(what: string, error: ZodError) {
  return fail(
    publicError(
      "INVALID_REQUEST",
      `${what}输入不完整`,
      false,
      error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    ),
  );
}

export function requireDeepSeekKey(): string | { ok: false; error: PublicError } {
  if (!hasLlmKey()) return fail(publicError("CONFIG_MISSING", missingLlmKeyMessage(), false));
  return "ok";
}

/**
 * 统一的高阶 Server Action 包装器:
 * 1. 自动 safeParse 入参并在失败时返回格式化校验错误
 * 2. 统一校验模型密钥
 * 3. 统一拦截上游异常,记录服务端日志并转为公共 PublicError
 */
export async function runCouncilAction<TInput, TOutput>(options: {
  name: string;
  schema: ZodType<TInput>;
  input: unknown;
  handler: (data: TInput) => Promise<TOutput>;
}): Promise<ActionResult<TOutput>> {
  const parsed = options.schema.safeParse(options.input);
  if (!parsed.success) return failParse(options.name, parsed.error);

  const keyCheck = requireDeepSeekKey();
  if (typeof keyCheck !== "string") return keyCheck;

  try {
    const data = await options.handler(parsed.data);
    return { ok: true, data };
  } catch (error) {
    console.error(`${options.name}失败`, error);
    const msg = error instanceof Error ? error.message : `${options.name}失败,请重试`;
    return fail(publicError("UPSTREAM_FAILURE", msg, true));
  }
}

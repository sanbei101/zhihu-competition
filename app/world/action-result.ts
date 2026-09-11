import type { ZodError } from "zod";

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

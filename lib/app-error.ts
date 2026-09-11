import { z } from "zod";

export const errorCodeSchema = z.enum([
  "INVALID_REQUEST",
  "CONFIG_MISSING",
  "NOT_FOUND",
  "UPSTREAM_FAILURE",
  "STREAM_FAILURE",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const publicErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string().min(1).max(200),
  retryable: z.boolean(),
  fields: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .max(20)
    .optional(),
});
export type PublicError = z.infer<typeof publicErrorSchema>;

export const errorEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: publicErrorSchema,
});

export function publicError(
  code: ErrorCode,
  message: string,
  retryable: boolean,
  fields?: PublicError["fields"],
): PublicError {
  return { code, message, retryable, ...(fields ? { fields } : {}) };
}

export function fallbackError(code: ErrorCode, message: string, retryable = true): PublicError {
  return publicError(code, message, retryable);
}

export function errorEnvelope(error: PublicError) {
  return { ok: false as const, error };
}

export function errorResponse(error: PublicError, status: number): Response {
  return Response.json(errorEnvelope(error), { status });
}

export function userErrorMessage(error: PublicError): string {
  return error.retryable ? `${error.message}(可重试)` : error.message;
}

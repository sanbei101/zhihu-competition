import { createTextStreamResponse, streamText } from "ai";

import { errorResponse, publicError } from "@/lib/app-error";
import { hasLlmKey, llmModel, llmProviderOptions, missingLlmKeyMessage } from "@/lib/deepseek";
import { SETTLE_INSTRUCTIONS, buildSettlePrompt } from "@/lib/prompts";
import { worldlineSettleRequestSchema } from "@/lib/worldline-events";

/**
 * 知乎体长文结算 API:
 * 接收完整的 WorldlineSession,以流式文本返回一篇格式规范、硬核深刻的知乎深度回答。
 */
export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return errorResponse(publicError("INVALID_REQUEST", "请求不是有效的 JSON", false), 400);
  }

  const parsedInput = worldlineSettleRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return errorResponse(publicError("INVALID_REQUEST", "世界线状态不完整", false), 400);
  }
  if (!hasLlmKey()) {
    return errorResponse(publicError("CONFIG_MISSING", missingLlmKeyMessage(), false), 503);
  }

  const { session } = parsedInput.data;

  try {
    const result = streamText({
      model: llmModel(),
      instructions: SETTLE_INSTRUCTIONS,
      prompt: buildSettlePrompt(session),
      providerOptions: llmProviderOptions(),
      temperature: 0.7,
      abortSignal: request.signal,
    });

    return createTextStreamResponse({
      stream: result.textStream,
      headers: {
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("生成知乎长文结算失败:", error);
    return errorResponse(publicError("STREAM_FAILURE", "生成知乎长文结算失败,请重试", true), 500);
  }
}

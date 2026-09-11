import { errorResponse, publicError } from "@/lib/app-error";
import { hasLlmKey, missingLlmKeyMessage } from "@/lib/deepseek";
import { generateObservations } from "@/lib/world-sim-engine";
import { worldObservationsRequestSchema } from "@/lib/world-sim-events";

/**
 * 观测选项。
 *
 * 这一条不需要流式:选项要在几百毫秒内给出来,而且内部有确定性兜底,
 * 即使模型挂了也能返回一组可用的选项(未决分叉一定是第一项)。
 */
export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return errorResponse(publicError("INVALID_REQUEST", "请求不是有效的 JSON", false), 400);
  }

  const parsedInput = worldObservationsRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return errorResponse(publicError("INVALID_REQUEST", "世界状态信息不完整", false), 400);
  }
  if (!hasLlmKey()) {
    return errorResponse(publicError("CONFIG_MISSING", missingLlmKeyMessage(), false), 503);
  }

  const { session, followedEntityId } = parsedInput.data;

  try {
    const options = await generateObservations({
      session,
      ...(followedEntityId ? { followedEntityId } : {}),
      signal: request.signal,
    });
    return Response.json(options);
  } catch (error) {
    console.error("观测选项生成异常", error);
    return errorResponse(publicError("UPSTREAM_FAILURE", "观测选项生成失败,请重试", true), 502);
  }
}

import { errorResponse, publicError } from "@/lib/app-error";
import { hasLlmKey, missingLlmKeyMessage } from "@/lib/deepseek";
import { simulateEraStream } from "@/lib/world-sim-engine";
import { worldSimulateEventSchema, worldSimulateRequestSchema } from "@/lib/world-sim-events";
import { applyForkChoice } from "@/lib/world-sim-reducer";

const encoder = new TextEncoder();

/**
 * 推进一个时代。
 *
 * NDJSON 流:一条事件一行 JSON。事件名与 plan §7.3 对齐。
 *
 * 顺序:simulation-start → entity-start ×N → entity-report ×N → adjudicating
 *       → world-event ×N → causal-chain ×N → fork-detected? → snapshot → state → complete
 *
 * 主体推演是真正并行的 Promise.all:每个主体只看得到世界状态,看不到彼此这一阶段的打算。
 * 这就是"多个智能体各自盘算,再由历史裁决"的实现方式。
 *
 * 部分主体失败不该整局作废:失败的会被 emit 成 entity-error,
 * 裁决器按"它这一阶段没有行动"处理 —— 真实历史里也确实有力量什么都没做。
 * 只有当所有主体都失败时才 emit error 终止。
 */
export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return errorResponse(publicError("INVALID_REQUEST", "请求不是有效的 JSON", false), 400);
  }

  const parsedInput = worldSimulateRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return errorResponse(publicError("INVALID_REQUEST", "世界状态信息不完整", false), 400);
  }
  if (!hasLlmKey()) {
    return errorResponse(publicError("CONFIG_MISSING", missingLlmKeyMessage(), false), 503);
  }

  const { session: rawSession, followedEntityId, forkChoice } = parsedInput.data;

  // 分叉选择先写进会话,再交给引擎 —— 这样主体 Agent 与裁决器看到的是同一个前提
  const session = forkChoice ? applyForkChoice(rawSession, forkChoice) : rawSession;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: unknown) => {
        const parsed = worldSimulateEventSchema.safeParse(payload);
        if (!parsed.success) {
          console.error("推演事件结构不合法", parsed.error);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(parsed.data)}\n`));
        } catch (error) {
          console.error("推演事件写入失败", error);
        }
      };

      const close = () => {
        try {
          controller.close();
        } catch {
          // 客户端可能已经断开
        }
      };

      const run = async () => {
        for await (const event of simulateEraStream({
          session,
          ...(followedEntityId ? { followedEntityId } : {}),
          signal: request.signal,
        })) {
          send(event);
        }
      };

      void run().then(close, (error) => {
        console.error("时代推演流异常", error);
        if (!request.signal.aborted) {
          send({
            type: "error",
            error: publicError("STREAM_FAILURE", "时代推演失败,请重试", true),
          });
        }
        close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

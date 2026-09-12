import { errorResponse, publicError } from "@/lib/app-error";
import { hasLlmKey, missingLlmKeyMessage } from "@/lib/deepseek";
import { generateWaveStream } from "@/lib/worldline-engine";
import { worldlineWaveEventSchema, worldlineWaveRequestSchema } from "@/lib/worldline-events";

const encoder = new TextEncoder();

/**
 * 发一波事件。
 *
 * NDJSON 流。顺序:wave-start → wave-event ×5 → wave-reactions ×5 → wave-complete
 *
 * 五件事出自同一次调用(它们必须彼此不重复、时间要往前走),
 * 之后世界对每一件事的反应**各开一次调用、并行开跑** ——
 * 谁先想完谁先回来,五条支线彼此看不见对方的打算。
 * 这就是这一版里"多智能体"的实际含义:没有总导演,冲突自己长出来。
 *
 * 某件事的反应失败不该毁掉整波:那件事就当作"世界还没为它动",
 * 真实世界里也常有大事落下之后很久没有回音。
 */
export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return errorResponse(publicError("INVALID_REQUEST", "请求不是有效的 JSON", false), 400);
  }

  const parsedInput = worldlineWaveRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return errorResponse(publicError("INVALID_REQUEST", "世界线状态不完整", false), 400);
  }
  if (!hasLlmKey()) {
    return errorResponse(publicError("CONFIG_MISSING", missingLlmKeyMessage(), false), 503);
  }

  const { session, replaceIndex } = parsedInput.data;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: unknown) => {
        const parsed = worldlineWaveEventSchema.safeParse(payload);
        if (!parsed.success) {
          console.error("波次事件结构不合法", parsed.error);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(parsed.data)}\n`));
        } catch (error) {
          console.error("波次事件写入失败", error);
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
        for await (const event of generateWaveStream({
          session,
          ...(replaceIndex !== undefined ? { replaceIndex } : {}),
          signal: request.signal,
        })) {
          send(event);
        }
      };

      void run().then(close, (error) => {
        console.error("波次推演流异常", error);
        if (!request.signal.aborted) {
          send({
            type: "error",
            error: publicError("STREAM_FAILURE", "这一波推演失败,请重试", true),
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

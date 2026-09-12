import { errorResponse, publicError } from "@/lib/app-error";
import { hasLlmKey, missingLlmKeyMessage } from "@/lib/deepseek";
import { findScenario } from "@/lib/scenario-library";
import { generateSeedStream } from "@/lib/worldline-engine";
import { worldlineSeedEventSchema, worldlineSeedRequestSchema } from "@/lib/worldline-events";
import { createSession } from "@/lib/worldline-reducer";

const encoder = new TextEncoder();

/**
 * 世界线种子生成。
 *
 * NDJSON 流:一条事件一行 JSON。
 * 顺序:seed-start → seed-premise → seed-witness → seed-being ×N → seed-segment ×N → seed-complete
 *
 * 分解是"真"的:前提先立起来,四股力量一枚一枚站上台,开局编年一段一段写进观测窗。
 * 但底层只有一次模型调用 —— 主体必须状态互补、编年必须前后连贯,
 * 只有一次调用才保证得了内部一致性,拆成多次必然互相不知道对方存在。
 * 客户端拿到的是逐块长出来的世界,体验与真流式一致。
 */
export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return errorResponse(publicError("INVALID_REQUEST", "请求不是有效的 JSON", false), 400);
  }

  const parsedInput = worldlineSeedRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return errorResponse(publicError("INVALID_REQUEST", "世界线信息不完整", false), 400);
  }
  if (!hasLlmKey()) {
    return errorResponse(publicError("CONFIG_MISSING", missingLlmKeyMessage(), false), 503);
  }

  const { scenarioId, title, themeId } = parsedInput.data;
  const scenarioUrl = findScenario(scenarioId)?.topic.url ?? "";

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false;

      const send = (payload: unknown) => {
        if (isClosed || request.signal.aborted) return;
        const parsed = worldlineSeedEventSchema.safeParse(payload);
        if (!parsed.success) {
          console.error("世界线种子事件结构不合法", parsed.error);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(parsed.data)}\n`));
        } catch (error) {
          isClosed = true;
          if (!request.signal.aborted) {
            console.error("世界线种子事件写入失败", error);
          }
        }
      };

      const close = () => {
        if (isClosed) return;
        isClosed = true;
        try {
          controller.close();
        } catch {
          // 客户端可能已经断开
        }
      };

      const run = async () => {
        for await (const event of generateSeedStream(
          { scenarioId, scenarioTitle: title, scenarioUrl, themeId },
          request.signal,
        )) {
          if (isClosed || request.signal.aborted) break;
          send(event);
          // 种子出口再自检一次:能组装成合法会话才算数。
          // 真正的存档由客户端写进 localStorage。
          if (event.type === "seed-complete") createSession(event.seed);
        }
      };

      void run().then(close, (error) => {
        if (request.signal.aborted || isClosed) return;
        console.error("世界线种子流异常", error);
        send({
          type: "error",
          error: publicError("STREAM_FAILURE", "世界构建失败,请重试", true),
        });
        close();
      });
    },
    cancel() {
      // 客户端主动断开连接
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

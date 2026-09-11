import { errorResponse, publicError } from "@/lib/app-error";
import { hasLlmKey, missingLlmKeyMessage } from "@/lib/deepseek";
import { findScenario } from "@/lib/scenario-library";
import { generateSeed } from "@/lib/world-sim-engine";
import { worldSeedEventSchema, worldSeedRequestSchema } from "@/lib/world-sim-events";
import { createSession } from "@/lib/world-sim-reducer";

const encoder = new TextEncoder();

/**
 * 世界种子生成。
 *
 * NDJSON 流:一条事件一行 JSON。事件名与 plan §7.1 对齐。
 *
 * 注意这里的事件分解是**真的**,但不是"每个主体一次模型调用":
 * 种子生成一次调用产出完整结果,服务端再按结构拆成若干事件推出去。
 * 主体之间必须目标不重叠、关系互为指向,只有一次调用才能保证这种内部一致性;
 * 拆成多次调用会让每个主体都不知道其他主体存在,是最典型的伪多智能体。
 * 客户端拿到的是逐块长出来的舞台,体验与真流式一致。
 */
export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return errorResponse(publicError("INVALID_REQUEST", "请求不是有效的 JSON", false), 400);
  }

  const parsedInput = worldSeedRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return errorResponse(publicError("INVALID_REQUEST", "世界线信息不完整", false), 400);
  }
  if (!hasLlmKey()) {
    return errorResponse(publicError("CONFIG_MISSING", missingLlmKeyMessage(), false), 503);
  }

  const { scenarioId, title, themeId } = parsedInput.data;
  const found = findScenario(scenarioId);
  const scenarioUrl = found?.topic.url ?? "";

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: unknown) => {
        const parsed = worldSeedEventSchema.safeParse(payload);
        if (!parsed.success) {
          console.error("世界种子事件结构不合法", parsed.error);
          return;
        }
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(parsed.data)}\n`));
        } catch (error) {
          console.error("世界种子事件写入失败", error);
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
        send({ type: "seed-start", themeId });

        const seed = await generateSeed(
          { scenarioId, scenarioTitle: title, scenarioUrl, themeId },
          request.signal,
        );

        send({
          type: "seed-setting",
          premise: seed.premise,
          startTime: seed.startTime,
          timeScale: seed.timeScale,
        });
        send({ type: "seed-rules", hardRules: seed.hardRules });

        for (const entity of seed.entities) {
          send({ type: "entity-start", entityId: entity.id, name: entity.name });
          send({ type: "entity", entity });
        }

        send({ type: "seed-metrics", globalMetrics: seed.globalMetrics });
        send({ type: "seed-events", initialEvents: seed.initialEvents });

        // createSession 只是用来确认这份种子能组装成合法会话(引用完整性检查),
        // 真正的存档由客户端写入 localStorage。
        const session = createSession(seed);
        if (session.state.entities.length === 0) throw new Error("世界种子没有产出任何主体");

        send({ type: "seed-complete", seed });
      };

      void run().then(
        () => {
          if (!request.signal.aborted) close();
          else close();
        },
        (error) => {
          console.error("世界种子生成失败", error);
          if (!request.signal.aborted) {
            send({
              type: "error",
              error: publicError("UPSTREAM_FAILURE", "世界构建失败,请重试", true),
            });
          }
          close();
        },
      );
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

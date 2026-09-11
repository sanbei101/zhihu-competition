import { simulateWorld } from "@/app/world/actions/simulate";
import { errorResponse, publicError } from "@/lib/app-error";
import { hasLlmKey, missingLlmKeyMessage } from "@/lib/deepseek";
import {
  simulationRequestSchema,
  simulationStreamEventSchema,
  type SimulationStreamEvent,
} from "@/lib/world-sim";

const encoder = new TextEncoder();

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return errorResponse(publicError("INVALID_REQUEST", "请求不是有效的 JSON", false), 400);
  }
  const parsed = simulationRequestSchema.safeParse(input);
  if (!parsed.success)
    return errorResponse(publicError("INVALID_REQUEST", "模拟状态不完整", false), 400);
  if (!hasLlmKey())
    return errorResponse(publicError("CONFIG_MISSING", missingLlmKeyMessage(), false), 503);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: SimulationStreamEvent) =>
        controller.enqueue(
          encoder.encode(`${JSON.stringify(simulationStreamEventSchema.parse(event))}\n`),
        );
      void (async () => {
        try {
          send({ type: "simulation-start" });
          send({
            type: "time-advance",
            time: {
              ...parsed.data.state.time,
              value: parsed.data.state.time.value + parsed.data.state.time.amount,
            },
          });
          const snapshot = await simulateWorld(
            parsed.data.seed,
            parsed.data.state,
            parsed.data.observation,
            parsed.data.history,
            {
              onEvent(event) {
                send(
                  event.type === "entity-start"
                    ? event
                    : { type: "entity-report", report: event.report },
                );
              },
            },
          );
          for (const event of snapshot.events) send({ type: "world-event", event });
          for (const chain of snapshot.causalChains) send({ type: "causal-chain", chain });
          for (const fork of snapshot.forks) send({ type: "fork-detected", fork });
          send({ type: "snapshot", snapshot });
          send({ type: "complete", snapshot });
          controller.close();
        } catch (error) {
          if (request.signal.aborted) return controller.close();
          console.error("世界模拟失败", error);
          send({
            type: "error",
            message: error instanceof Error ? error.message : "世界模拟失败,请重试",
          });
          controller.close();
        }
      })();
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

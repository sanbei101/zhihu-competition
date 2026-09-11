import { generateWorldSeed } from "@/app/world/actions/seed";
import { errorResponse, publicError } from "@/lib/app-error";
import { hasLlmKey, missingLlmKeyMessage } from "@/lib/deepseek";
import {
  seedStreamEventSchema,
  type SeedStreamEvent,
  createInitialWorldState,
  worldSeedRequestSchema,
} from "@/lib/world-sim";

const encoder = new TextEncoder();

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return errorResponse(publicError("INVALID_REQUEST", "请求不是有效的 JSON", false), 400);
  }
  const parsed = worldSeedRequestSchema.safeParse(input);
  if (!parsed.success)
    return errorResponse(publicError("INVALID_REQUEST", "世界种子信息不完整", false), 400);
  if (!hasLlmKey())
    return errorResponse(publicError("CONFIG_MISSING", missingLlmKeyMessage(), false), 503);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: SeedStreamEvent) =>
        controller.enqueue(
          encoder.encode(`${JSON.stringify(seedStreamEventSchema.parse(event))}\n`),
        );
      void (async () => {
        try {
          send({ type: "seed-start" });
          const seed = await generateWorldSeed(parsed.data);
          send({ type: "setting", premise: seed.premise });
          for (const entity of seed.entities) {
            send({ type: "entity-start", entityId: entity.id });
            send({ type: "entity", entity });
          }
          send({ type: "complete", seed, state: createInitialWorldState(seed) });
          controller.close();
        } catch (error) {
          if (request.signal.aborted) return controller.close();
          console.error("世界种子生成失败", error);
          send({
            type: "error",
            message: error instanceof Error ? error.message : "世界种子生成失败,请重试",
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

/* eslint-disable no-await-in-loop */
import { errorResponse, publicError } from "@/lib/app-error";
import { getCastPreset } from "@/lib/presets";
import { worldCastRequestSchema, type WorldCastStreamEvent } from "@/lib/world-cast";

const encoder = new TextEncoder();

export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return errorResponse(publicError("INVALID_REQUEST", "请求不是有效的 JSON", false), 400);
  }

  const parsedInput = worldCastRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return errorResponse(publicError("INVALID_REQUEST", "世界线信息不完整", false), 400);
  }

  const { scenarioId, excludePresetId } = parsedInput.data;
  const lookup = getCastPreset({ scenarioId, excludePresetId });
  const { cast } = lookup.preset;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: WorldCastStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      void (async () => {
        try {
          // 流式即时输出完整数据结构,由前端精确调度串行打字机与卡牌登场演播
          send({ type: "stage", stage: "setting" });
          send({ type: "setting", setting: cast.setting });

          send({ type: "stage", stage: "players" });
          for (const character of cast.playerCharacters) {
            send({ type: "player-character", character });
          }

          send({ type: "stage", stage: "agents" });
          for (const character of cast.agentCharacters) {
            send({ type: "agent-character", character });
          }

          send({ type: "complete", cast });
          controller.close();
        } catch (error) {
          if (request.signal.aborted) {
            controller.close();
            return;
          }

          console.error("角色阵容装配失败", error);
          send({
            type: "error",
            error: publicError("STREAM_FAILURE", "角色阵容装配失败,请重试", true),
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

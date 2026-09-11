import { z } from "zod";

import { errorResponse, publicError } from "@/lib/app-error";
import { hasLlmKey, generateStructured, missingLlmKeyMessage } from "@/lib/deepseek";
import {
  buildAgentStagePrompt,
  buildPlayerPrompt,
  buildStage1Prompt,
  CAST_INSTRUCTIONS,
} from "@/lib/prompts";
import {
  agentCharacterSchema,
  characterArchetypeSchema,
  playerCharacterSchema,
  worldCastRequestSchema,
  worldCastSchema,
  worldSettingSchema,
  type WorldCast,
  type WorldCastStreamEvent,
} from "@/lib/world-cast";

const encoder = new TextEncoder();

const characterRosterSchema = z.object({
  id: z.string(),
  name: z.string(),
  identity: z.string(),
  faction: z.string(),
  archetype: characterArchetypeSchema,
});

const stage1Schema = z.object({
  setting: worldSettingSchema,
  playerRoster: z.array(characterRosterSchema).length(3),
  agentRoster: z.array(characterRosterSchema).length(4),
});

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
  if (!hasLlmKey()) {
    return errorResponse(publicError("CONFIG_MISSING", missingLlmKeyMessage(), false), 503);
  }

  const { scenarioId, title, content } = parsedInput.data;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: WorldCastStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      void (async () => {
        try {
          send({ type: "stage", stage: "setting" });
          const stage1 = await generateStructured({
            instructions: CAST_INSTRUCTIONS,
            prompt: buildStage1Prompt({ scenarioId, title, content }),
            schema: stage1Schema,
            temperature: 0.6,
            maxOutputTokens: 3000,
            abortSignal: request.signal,
          });

          send({ type: "setting", setting: stage1.setting });

          send({ type: "stage", stage: "players" });
          const playerCharacters: WorldCast["playerCharacters"] = [];
          for (const roster of stage1.playerRoster) {
            // 角色必须按生成完成顺序逐个推送,不能并发等待。
            // eslint-disable-next-line no-await-in-loop
            const character = await generateStructured({
              instructions: CAST_INSTRUCTIONS,
              prompt: buildPlayerPrompt({
                setting: stage1.setting,
                roster,
                existing: playerCharacters,
              }),
              schema: playerCharacterSchema,
              temperature: 0.7,
              maxOutputTokens: 1800,
              abortSignal: request.signal,
            });
            playerCharacters.push(character);
            send({ type: "player-character", character });
          }

          send({ type: "stage", stage: "agents" });
          const agentCharacters: WorldCast["agentCharacters"] = [];
          for (const roster of stage1.agentRoster) {
            // 角色必须按生成完成顺序逐个推送,不能并发等待。
            // eslint-disable-next-line no-await-in-loop
            const character = await generateStructured({
              instructions: CAST_INSTRUCTIONS,
              prompt: buildAgentStagePrompt({
                setting: stage1.setting,
                players: playerCharacters,
                roster,
              }),
              schema: agentCharacterSchema,
              temperature: 0.7,
              maxOutputTokens: 1800,
              abortSignal: request.signal,
            });
            agentCharacters.push(character);
            send({ type: "agent-character", character });
          }

          const cast = worldCastSchema.parse({
            setting: stage1.setting,
            playerCharacters,
            agentCharacters,
          });
          send({ type: "complete", cast });
          controller.close();
        } catch (error) {
          if (request.signal.aborted) {
            controller.close();
            return;
          }

          console.error("分阶段角色阵容生成失败", error);
          send({
            type: "error",
            error: publicError("STREAM_FAILURE", "角色阵容生成失败,请重试", true),
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

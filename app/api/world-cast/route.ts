import { z } from "zod";

import { errorResponse, publicError } from "@/lib/app-error";
import { hasLlmKey, generateStructured, missingLlmKeyMessage } from "@/lib/deepseek";
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
import { CAST_INSTRUCTIONS } from "@/lib/world-prompts";

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
            prompt: `为剧本《${title}》(ID:${scenarioId})生成第一幕的世界观背景,以及3名玩家候选和4名Agent角色的基本档案骨架。

剧本背景概要:
${content || "无"}

只输出必要信息。setting 要完整,角色骨架只填写身份、阵营和立绘原型。角色 id 必须唯一且保持简短英文小写。`,
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
              prompt: `根据以下世界背景,完善这1名玩家角色的深层设定。

世界背景:
${JSON.stringify(stage1.setting)}

角色骨架:
${JSON.stringify(roster)}

必须保留骨架中的 id、name、identity、faction、archetype。补齐 schema 的全部字段;每个字段控制在一到两句话,重点写出秘密、底线、可调动资源和可判定的私密目标。`,
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
              prompt: `根据以下世界背景和玩家角色,完善这1名Agent角色的深层设定与交互逻辑。

世界背景:
${JSON.stringify(stage1.setting)}

玩家角色:
${JSON.stringify(playerCharacters)}

Agent角色骨架:
${JSON.stringify(roster)}

必须保留骨架中的 id、name、identity、faction、archetype。补齐 schema 的全部字段;每个字段控制在一到两句话,重点写出施压手段、开场白、秘密和与玩家的关系。`,
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

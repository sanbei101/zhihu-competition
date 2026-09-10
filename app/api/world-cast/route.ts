import { createDeepSeek } from "@ai-sdk/deepseek";
import { Output, streamText } from "ai";

import {
  agentCharacterSchema,
  playerCharacterSchema,
  worldCastRequestSchema,
  worldCastSchema,
  worldSettingSchema,
  type WorldCastStreamEvent,
} from "@/lib/world-cast";

const encoder = new TextEncoder();

const CAST_INSTRUCTIONS = `你是一名严谨的架空历史推演导演和剧本杀作者。根据知乎假设题建立第一幕角色阵容。

角色必须扎根于题目给出的时代、制度和技术条件,不能使用穿越者或全知视角来偷懒。三个玩家候选角色要拥有不同的权力来源、道德困境和玩法;四个 AI 角色要代表不同利益集团,彼此目标不能完全一致。人物关系中必须包含合作、冲突或债务,使他们在第一回合就有采取行动的理由。

必须完整填写 schema 中的每个字段:setting.rules 输出三到六条硬约束;全部七个角色都要填写 voice 和 redLine;三个玩家角色填写 decisionPower;四个 Agent 角色填写 pressureMethod 和 openingLine。不要遗漏字段,不要增加角色数量。

不要续写完整历史,不要提前给出结局,只建立危机爆发时的舞台和可博弈角色。使用简体中文,内容具体、克制。角色 id 使用唯一的简短英文小写标识。`;

const buildCastPrompt = (input: { scenarioId: string; title: string; content?: string }) =>
  `为下面这条世界线生成开场角色阵容。\n\n知乎问题编号:${input.scenarioId}\n问题:${input.title}\n补充描述:${input.content || "无"}`;

export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "请求不是有效的 JSON" }, { status: 400 });
  }

  const parsedInput = worldCastRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return Response.json({ error: "世界线信息不完整" }, { status: 400 });
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    return Response.json({ error: "服务端缺少 DEEPSEEK_API_KEY" }, { status: 500 });
  }

  const { scenarioId, title, content } = parsedInput.data;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: WorldCastStreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      void (async () => {
        try {
          const result = streamText({
            model: createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY })("deepseek-v4-flash"),
            instructions: CAST_INSTRUCTIONS,
            prompt: buildCastPrompt({ scenarioId, title, content }),
            output: Output.object({ schema: worldCastSchema }),
            providerOptions: { deepseek: { thinking: { type: "disabled" as const } } },
            temperature: 0.6,
            maxOutputTokens: 14000,
            abortSignal: request.signal,
          });

          let settingSent = false;
          const sentCharacters = new Set<string>();

          for await (const partial of result.partialOutputStream) {
            if (!settingSent) {
              const setting = worldSettingSchema.safeParse(partial.setting);
              if (setting.success) {
                settingSent = true;
                send({ type: "setting", setting: setting.data });
              }
            }

            if (Array.isArray(partial.playerCharacters)) {
              for (const candidate of partial.playerCharacters) {
                const character = playerCharacterSchema.safeParse(candidate);
                if (character.success && !sentCharacters.has(`player:${character.data.id}`)) {
                  sentCharacters.add(`player:${character.data.id}`);
                  send({ type: "player-character", character: character.data });
                }
              }
            }

            if (Array.isArray(partial.agentCharacters)) {
              for (const candidate of partial.agentCharacters) {
                const character = agentCharacterSchema.safeParse(candidate);
                if (character.success && !sentCharacters.has(`agent:${character.data.id}`)) {
                  sentCharacters.add(`agent:${character.data.id}`);
                  send({ type: "agent-character", character: character.data });
                }
              }
            }
          }

          const cast = worldCastSchema.parse(await result.output);
          send({ type: "complete", cast });
          controller.close();
        } catch (error) {
          if (request.signal.aborted) {
            controller.close();
            return;
          }
          console.error("流式角色阵容生成失败", error);
          send({
            type: "error",
            error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
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

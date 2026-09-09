import { generateStructured } from "@/lib/deepseek";
import { agentReactionSchema, type WorldTurnEvent, worldTurnRequestSchema } from "@/lib/world-turn";

const encoder = new TextEncoder();

export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "请求不是有效的 JSON" }, { status: 400 });
  }

  const parsedInput = worldTurnRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return Response.json({ error: "回合决策信息不完整" }, { status: 400 });
  }
  if (!process.env.DEEPSEEK_API_KEY) {
    return Response.json({ error: "服务端缺少 DEEPSEEK_API_KEY" }, { status: 500 });
  }

  const { cast, playerId, decisionMode, decision } = parsedInput.data;
  const player = cast.playerCharacters.find((character) => character.id === playerId);
  if (!player) {
    return Response.json({ error: "玩家角色不存在" }, { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: WorldTurnEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      const agents = cast.agentCharacters.map(async (character) => {
        send({ type: "agent-start", agentId: character.id });

        try {
          const object = await generateStructured({
            instructions: `你只能扮演下面这名角色，基于角色自己的认知和利益回应玩家，不能替其他人物发言，也不能宣告最终世界结果。

姓名：${character.name}
身份：${character.identity}
阵营：${character.faction}
性格：${character.personality}
公开目标：${character.publicGoal}
秘密动机：${character.secret}
关键关系：${character.relationship}
惯用手段：${character.pressureMethod}

秘密动机用于决定行动，但绝不能直接泄露。回应必须包含一句符合身份的现场发言和一个立刻执行的具体行动。使用简体中文。`,
            prompt: `当前时间：${cast.setting.time}
当前地点：${cast.setting.location}
核心危机：${cast.setting.crisis}

玩家是${player.name}（${player.identity}），刚刚以“${decisionMode}”方式作出决策：${decision}

其他在场角色：
${cast.agentCharacters
  .filter((other) => other.id !== character.id)
  .map((other) => `- ${other.name}：${other.identity}，公开目标是${other.publicGoal}`)
  .join("\n")}

立即作出你的独立回应。`,
            schema: agentReactionSchema,
            temperature: 0.8,
            maxOutputTokens: 1000,
            abortSignal: request.signal,
          });

          const reaction = agentReactionSchema.parse(object);
          send({ type: "agent-reaction", agentId: character.id, reaction });
        } catch (error) {
          console.error(`[岔路] ${character.name} Agent 回应失败`, error);
          send({
            type: "agent-error",
            agentId: character.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      void Promise.all(agents).then(() => {
        send({ type: "complete" });
        controller.close();
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

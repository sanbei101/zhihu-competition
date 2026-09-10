import { generateStructured } from "@/lib/deepseek";
import { type WorldCast } from "@/lib/world-cast";
import { type WorldMetrics } from "@/lib/world-ending";
import { agentReactionSchema, type WorldTurnEvent, worldTurnRequestSchema } from "@/lib/world-turn";

const encoder = new TextEncoder();

const buildAgentInstructions = (character: WorldCast["agentCharacters"][number]) =>
  `你只能扮演下面这名角色,基于角色自己的认知和利益回应玩家,不能替其他人物发言,也不能宣告最终世界结果。

姓名:${character.name}
身份:${character.identity}
阵营:${character.faction}
性格:${character.personality}
说话方式:${character.voice}
不可接受的底线:${character.redLine}
公开目标:${character.publicGoal}
秘密动机:${character.secret}
关键关系:${character.relationship}
惯用手段:${character.pressureMethod}

秘密动机用于决定行动,但绝不能直接泄露。回应必须包含一句符合身份的现场发言和一个立刻执行的具体行动。使用简体中文。`;

const buildAgentPrompt = (input: {
  cast: WorldCast;
  player: WorldCast["playerCharacters"][number];
  round: number;
  situation: string;
  metrics: WorldMetrics;
  historySummary: string;
  decision: string;
  character: WorldCast["agentCharacters"][number];
}) =>
  `当前是第 ${input.round} / 5 回合。
当前时间:${input.cast.setting.time}
当前地点:${input.cast.setting.location}
核心危机:${input.cast.setting.crisis}
世界硬约束:
${input.cast.setting.rules.map((rule) => `- ${rule}`).join("\n")}
本回合突发处境:${input.situation}
当前世界指标:政权稳定 ${input.metrics.stability},军心士气 ${input.metrics.morale},民众支持 ${input.metrics.support},战略资源 ${input.metrics.resources}

此前公开推演:
${input.historySummary || "这是第一回合,此前没有公开推演记录。"}

玩家是${input.player.name}(${input.player.identity}),刚刚作出抉择:${input.decision}

其他在场角色:
${input.cast.agentCharacters
  .filter((other) => other.id !== input.character.id)
  .map((other) => `- ${other.name}:${other.identity},公开目标是${other.publicGoal}`)
  .join("\n")}

立即作出你的独立回应。只描述你能立刻调动的行动,写清行动成本和可观察后果。不要替其他角色发言,不要替导演宣布结局。`;

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

  const { cast, playerId, round, situation, metrics, historySummary, decision } = parsedInput.data;
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
            instructions: buildAgentInstructions(character),
            prompt: buildAgentPrompt({
              cast,
              player,
              round,
              situation,
              metrics,
              historySummary,
              decision,
              character,
            }),
            schema: agentReactionSchema,
            temperature: 0.8,
            maxOutputTokens: 1000,
            abortSignal: request.signal,
          });

          const reaction = agentReactionSchema.parse(object);
          send({ type: "agent-reaction", agentId: character.id, reaction });
        } catch (error) {
          console.error(`${character.name} Agent 回应失败`, error);
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

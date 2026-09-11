import { generateStructured, hasLlmKey, missingLlmKeyMessage } from "@/lib/deepseek";
import { type WorldCast } from "@/lib/world-cast";
import { type WorldMetrics } from "@/lib/world-ending";
import {
  agentReactionSchema,
  type AgentReaction,
  type WorldTurnEvent,
  worldTurnRequestSchema,
} from "@/lib/world-turn";

const encoder = new TextEncoder();

type AgentCharacter = WorldCast["agentCharacters"][number];
type PlayerCharacter = WorldCast["playerCharacters"][number];

interface RoundEntry {
  agentId: string;
  reaction: AgentReaction;
}

const buildAgentInstructions = (character: AgentCharacter) =>
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

秘密动机用于决定行动,但绝不能直接泄露。信任度高于 70 时你会主动替玩家分担代价;信任度低于 20 时你只做对自己有利的事,并且可以不再听令。
回应必须包含一句符合身份的现场发言和一个立刻执行的具体行动。使用简体中文。`;

const environmentBlock = (input: {
  cast: WorldCast;
  round: number;
  situation: string;
  metrics: WorldMetrics;
  relationsSummary: string;
  crisisSummary: string;
  ultimatumSummary: string;
  entropyNote: string;
  historySummary: string;
}) => `当前是第 ${input.round} 回合(回合数没有上限,拖得越久局势越坏)。
当前时间:${input.cast.setting.time}
当前地点:${input.cast.setting.location}
核心危机:${input.cast.setting.crisis}
世界硬约束:
${input.cast.setting.rules.map((rule) => `- ${rule}`).join("\n")}
本回合突发处境:${input.situation}
当前世界指标:政权稳定 ${input.metrics.stability},军心士气 ${input.metrics.morale},民众支持 ${input.metrics.support},战略资源 ${input.metrics.resources}

大势损耗:${input.entropyNote || "无"}

各方对你的信任度:
${input.relationsSummary || "(尚无记录)"}

压在头上的突发事件:
${input.crisisSummary || "(无)"}

未决的最后通牒:
${input.ultimatumSummary || "(无)"}

此前公开推演:
${input.historySummary || "这是第一回合,此前没有公开推演记录。"}`;

const buildAgentPrompt = (input: {
  environment: string;
  cast: WorldCast;
  player: PlayerCharacter;
  decision: string;
  character: AgentCharacter;
}) =>
  `${input.environment}

玩家是${input.player.name}(${input.player.identity}),刚刚作出抉择:'${input.decision}'

其他在场角色:
${input.cast.agentCharacters
  .filter((other) => other.id !== input.character.id)
  .map((other) => `- ${other.name}:${other.identity},公开目标是${other.publicGoal}`)
  .join("\n")}

立即作出你的独立回应。只描述你能立刻调动的行动,写清行动成本和可观察后果。不要替其他角色发言,不要替导演宣布结局。`;

const buildRetortInstructions = (character: AgentCharacter) =>
  `你正在一场当面对峙里,只能扮演下面这名角色,用一句话当场顶回去,并立刻做一个小动作来固化立场。

姓名:${character.name}
身份:${character.identity}
阵营:${character.faction}
性格:${character.personality}
说话方式:${character.voice}
不可接受的底线:${character.redLine}

要求:直接回击对方原话里最站不住的那一点;可以改口或让步,但必须给出一条可信的理由;trustDelta 一律填 0;ultimatum 一律填 null。不要替别人说话,不要总结全局。使用简体中文。`;

const buildRetortPrompt = (input: {
  environment: string;
  character: AgentCharacter;
  opponent: AgentCharacter;
  ownLine: string;
  opponentLine: string;
}) =>
  `${input.environment}

上一刻你${input.character.name}当众说:'${input.ownLine}'

现在,${input.opponent.name}(${input.opponent.identity})当着所有人的面回敬你:'${input.opponentLine}'

轮到你当场回应。不要复述对方的整段话,直接掐住你不同意的那一句。`;

const stanceWeight: Record<AgentReaction["stance"], number> = {
  oppose: 3,
  exploit: 2,
  negotiate: 1,
  support: 0,
};

/**
 * 从第一轮表态里挑出一对最该吵起来的人:
 * 优先选互相点名的,其次选立场冲突最大的。
 */
function pickConflictPair(
  entries: RoundEntry[],
  nameById: Map<string, string>,
): { challenger: RoundEntry; defender: RoundEntry } | null {
  if (entries.length < 2) return null;

  for (const challenger of entries) {
    for (const defender of entries) {
      if (challenger.agentId === defender.agentId) continue;
      const name = nameById.get(defender.agentId);
      if (name && challenger.reaction.target.includes(name)) return { challenger, defender };
    }
  }

  const sorted = [...entries].sort(
    (a, b) => stanceWeight[b.reaction.stance] - stanceWeight[a.reaction.stance],
  );
  const challenger = sorted[0];
  const defender =
    sorted.find(
      (entry) =>
        entry.agentId !== challenger.agentId &&
        entry.reaction.stance !== challenger.reaction.stance,
    ) ?? sorted.find((entry) => entry.agentId !== challenger.agentId);

  return defender ? { challenger, defender } : null;
}

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
  if (!hasLlmKey()) {
    return Response.json({ error: missingLlmKeyMessage() }, { status: 500 });
  }

  const {
    cast,
    playerId,
    round,
    situation,
    metrics,
    historySummary,
    relationsSummary,
    crisisSummary,
    ultimatumSummary,
    entropyNote,
    decision,
  } = parsedInput.data;

  const player = cast.playerCharacters.find((character) => character.id === playerId);
  if (!player) {
    return Response.json({ error: "玩家角色不存在" }, { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: WorldTurnEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch (error) {
          console.error("回合事件写入失败", error);
        }
      };

      const environment = environmentBlock({
        cast,
        round,
        situation,
        metrics,
        relationsSummary,
        crisisSummary,
        ultimatumSummary,
        entropyNote,
        historySummary,
      });

      const run = async () => {
        // ===== 第一轮:四人各自表态,并行 =====
        const settled = await Promise.all(
          cast.agentCharacters.map(async (character): Promise<RoundEntry | null> => {
            send({ type: "agent-start", agentId: character.id });
            try {
              const reaction = await generateStructured({
                instructions: buildAgentInstructions(character),
                prompt: buildAgentPrompt({ environment, cast, player, decision, character }),
                schema: agentReactionSchema,
                temperature: 0.85,
                maxOutputTokens: 1100,
                abortSignal: request.signal,
              });
              const parsed = agentReactionSchema.parse(reaction);
              send({ type: "agent-reaction", agentId: character.id, reaction: parsed });
              return { agentId: character.id, reaction: parsed };
            } catch (error) {
              console.error(`${character.name} Agent 回应失败`, error);
              send({
                type: "agent-error",
                agentId: character.id,
                error: error instanceof Error ? error.message : String(error),
              });
              return null;
            }
          }),
        );

        const firstRound = settled.filter((entry): entry is RoundEntry => entry !== null);

        // ===== 第二轮:挑一对立场最冲突的,当场对峙 =====
        const nameById = new Map(cast.agentCharacters.map((c) => [c.id, c.name]));
        const pair = pickConflictPair(firstRound, nameById);
        if (!pair) return;

        const challenger = cast.agentCharacters.find((c) => c.id === pair.challenger.agentId);
        const defender = cast.agentCharacters.find((c) => c.id === pair.defender.agentId);
        if (!challenger || !defender) return;

        await Promise.all([
          (async () => {
            send({ type: "retort-start", agentId: challenger.id, againstId: defender.id });
            try {
              const reaction = await generateStructured({
                instructions: buildRetortInstructions(challenger),
                prompt: buildRetortPrompt({
                  environment,
                  character: challenger,
                  opponent: defender,
                  ownLine: pair.challenger.reaction.speech,
                  opponentLine: pair.defender.reaction.speech,
                }),
                schema: agentReactionSchema,
                temperature: 0.9,
                maxOutputTokens: 700,
                abortSignal: request.signal,
              });
              const parsed = agentReactionSchema.parse(reaction);
              send({
                type: "agent-retort",
                agentId: challenger.id,
                againstId: defender.id,
                reaction: parsed,
              });
            } catch (error) {
              console.error(`${challenger.name} 对峙失败`, error);
            }
          })(),
          (async () => {
            send({ type: "retort-start", agentId: defender.id, againstId: challenger.id });
            try {
              const reaction = await generateStructured({
                instructions: buildRetortInstructions(defender),
                prompt: buildRetortPrompt({
                  environment,
                  character: defender,
                  opponent: challenger,
                  ownLine: pair.defender.reaction.speech,
                  opponentLine: pair.challenger.reaction.speech,
                }),
                schema: agentReactionSchema,
                temperature: 0.9,
                maxOutputTokens: 700,
                abortSignal: request.signal,
              });
              const parsed = agentReactionSchema.parse(reaction);
              send({
                type: "agent-retort",
                agentId: defender.id,
                againstId: challenger.id,
                reaction: parsed,
              });
            } catch (error) {
              console.error(`${defender.name} 对峙失败`, error);
            }
          })(),
        ]);
      };

      void run()
        .catch((error) => {
          console.error("回合推演流异常", error);
        })
        .finally(() => {
          send({ type: "complete" });
          try {
            controller.close();
          } catch {
            // 客户端可能已断开,忽略
          }
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

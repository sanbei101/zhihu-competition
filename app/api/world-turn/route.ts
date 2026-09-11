import { errorResponse, publicError } from "@/lib/app-error";
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

秘密动机用于决定行动,但绝不能直接泄露。信任度高于 45 时,除非玩家直接触碰你的底线,你应优先选择 support 或 negotiate,并主动寻找替玩家分担代价的办法;信任度低于 20 时你才只做对自己有利的事,并且可以不再听令。
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
  cooperationHint: string;
}) =>
  `${input.environment}

玩家是${input.player.name}(${input.player.identity}),刚刚作出抉择:'${input.decision}'

其他在场角色:
${input.cast.agentCharacters
  .filter((other) => other.id !== input.character.id)
  .map((other) => `- ${other.name}:${other.identity},公开目标是${other.publicGoal}`)
  .join("\n")}

本回合立场要求:
${input.cooperationHint}
不要为了制造冲突自动反对玩家。若玩家决策没有触碰你的底线,优先给出支持或协商,并说明你愿意提供的具体帮助;只有利益直接冲突时才 oppose 或 exploit。

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
    return errorResponse(publicError("INVALID_REQUEST", "请求不是有效的 JSON", false), 400);
  }

  const parsedInput = worldTurnRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return errorResponse(publicError("INVALID_REQUEST", "回合决策信息不完整", false), 400);
  }
  if (!hasLlmKey()) {
    return errorResponse(publicError("CONFIG_MISSING", missingLlmKeyMessage(), false), 503);
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
    return errorResponse(publicError("NOT_FOUND", "玩家角色不存在", false), 404);
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
      let hasAgentFailure = false;

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
        const nameById = new Map(cast.agentCharacters.map((c) => [c.id, c.name]));
        const firstRound: RoundEntry[] = [];
        let retortRun: Promise<void> | null = null;

        const runRetort = async ({
          character,
          opponent,
          ownLine,
          opponentLine,
        }: {
          character: AgentCharacter;
          opponent: AgentCharacter;
          ownLine: string;
          opponentLine: string;
        }) => {
          send({ type: "retort-start", agentId: character.id, againstId: opponent.id });
          try {
            const reaction = await generateStructured({
              instructions: buildRetortInstructions(character),
              prompt: buildRetortPrompt({
                environment,
                character,
                opponent,
                ownLine,
                opponentLine,
              }),
              schema: agentReactionSchema,
              temperature: 0.9,
              maxOutputTokens: 700,
              abortSignal: request.signal,
            });
            const parsed = agentReactionSchema.parse(reaction);
            send({
              type: "agent-retort",
              agentId: character.id,
              againstId: opponent.id,
              reaction: parsed,
            });
          } catch (error) {
            console.error(`${character.name} 对峙失败`, error);
            hasAgentFailure = true;
            send({
              type: "agent-error",
              agentId: character.id,
              againstId: opponent.id,
              phase: "retort",
              error: publicError("UPSTREAM_FAILURE", "对峙回应生成失败,本回合无法继续", true),
            });
          }
        };

        const runRetorts = async (pair: { challenger: RoundEntry; defender: RoundEntry }) => {
          const challenger = cast.agentCharacters.find((c) => c.id === pair.challenger.agentId);
          const defender = cast.agentCharacters.find((c) => c.id === pair.defender.agentId);
          if (!challenger || !defender) return;

          await Promise.all([
            runRetort({
              character: challenger,
              opponent: defender,
              ownLine: pair.challenger.reaction.speech,
              opponentLine: pair.defender.reaction.speech,
            }),
            runRetort({
              character: defender,
              opponent: challenger,
              ownLine: pair.defender.reaction.speech,
              opponentLine: pair.challenger.reaction.speech,
            }),
          ]);
        };

        const maybeStartRetort = () => {
          if (retortRun || firstRound.length < 2) return;
          const pair = pickConflictPair(firstRound, nameById);
          if (pair) retortRun = runRetorts(pair);
        };

        // 第一轮仍然并行,但第二轮在任意两个回应完成后立即开始。
        await Promise.all(
          cast.agentCharacters.map(async (character, index): Promise<void> => {
            send({ type: "agent-start", agentId: character.id });
            try {
              const reaction = await generateStructured({
                instructions: buildAgentInstructions(character),
                prompt: buildAgentPrompt({
                  environment,
                  cast,
                  player,
                  decision,
                  character,
                  cooperationHint:
                    index === 0
                      ? "你是本回合最可能与玩家合作的一方。只要没有触碰底线,请用 support 表态,并提出一项具体援助。"
                      : "你可以支持、协商或反对,但必须先承认玩家决策中合理的部分,不要无条件唱反调。",
                }),
                schema: agentReactionSchema,
                temperature: 0.85,
                maxOutputTokens: 1100,
                abortSignal: request.signal,
              });
              const parsed = agentReactionSchema.parse(reaction);
              firstRound.push({ agentId: character.id, reaction: parsed });
              send({ type: "agent-reaction", agentId: character.id, reaction: parsed });
              maybeStartRetort();
            } catch (error) {
              console.error(`${character.name} Agent 回应失败`, error);
              hasAgentFailure = true;
              send({
                type: "agent-error",
                agentId: character.id,
                phase: "reaction",
                error: publicError("UPSTREAM_FAILURE", "角色回应生成失败,本回合无法继续", true),
              });
            }
          }),
        );
        if (retortRun) await Promise.resolve(retortRun);
      };

      const close = () => {
        try {
          controller.close();
        } catch {
          // 客户端可能已断开,忽略
        }
      };

      void run().then(
        () => {
          if (request.signal.aborted) {
            close();
            return;
          }
          if (hasAgentFailure) {
            send({
              type: "error",
              error: publicError("STREAM_FAILURE", "部分角色回应失败,本回合无法继续", true),
            });
          } else {
            send({ type: "complete" });
          }
          close();
        },
        (error) => {
          console.error("回合推演流异常", error);
          if (!request.signal.aborted) {
            send({
              type: "error",
              error: publicError("STREAM_FAILURE", "回合推演失败,请重试", true),
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

import { errorResponse, publicError } from "@/lib/app-error";
import { generateStructured, hasLlmKey, missingLlmKeyMessage } from "@/lib/deepseek";
import {
  buildAgentInstructions,
  buildAgentPrompt,
  buildEnvironmentBlock,
  buildRetortInstructions,
  buildRetortPrompt,
} from "@/lib/prompts";
import { type WorldCast } from "@/lib/world-cast";
import {
  agentReactionSchema,
  type AgentReaction,
  type WorldTurnEvent,
  worldTurnRequestSchema,
} from "@/lib/world-turn";

const encoder = new TextEncoder();

type AgentCharacter = WorldCast["agentCharacters"][number];

interface RoundEntry {
  agentId: string;
  reaction: AgentReaction;
}

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
    relations,
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

      const environment = buildEnvironmentBlock({
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
        const allyId =
          relations.length > 0
            ? relations.reduce((best, relation) => (relation.trust > best.trust ? relation : best))
                .agentId
            : cast.agentCharacters[0]?.id;

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
          cast.agentCharacters.map(async (character): Promise<void> => {
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
                    character.id === allyId
                      ? "你是当前最信任玩家的一方。只要没有触碰底线,请用 support 表态,并提出一项具体的援助办法。"
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

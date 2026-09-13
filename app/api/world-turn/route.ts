import { z } from "zod";

import { errorResponse, publicError } from "@/lib/app-error";
import { generateStructured, hasLlmKey, missingLlmKeyMessage } from "@/lib/deepseek";
import {
  buildAgentInstructions,
  buildAgentPrompt,
  buildEnvironmentBlock,
  CLASH_INSTRUCTIONS,
  buildClashPrompt,
} from "@/lib/prompts";
import {
  agentReactionSchema,
  type AgentReaction,
  type WorldTurnEvent,
  worldTurnRequestSchema,
} from "@/lib/world-turn";

const encoder = new TextEncoder();

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
 * 若全场均为 support 或 negotiate(无实质反抗或剥削)，返回 null，避免无意义争吵。
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
  // 全场无明显反对者或投机者时跳过对峙
  if (challenger.reaction.stance === "support" || challenger.reaction.stance === "negotiate") {
    return null;
  }

  const defender =
    sorted.find(
      (entry) =>
        entry.agentId !== challenger.agentId &&
        entry.reaction.stance !== challenger.reaction.stance,
    ) ?? sorted.find((entry) => entry.agentId !== challenger.agentId);

  return defender ? { challenger, defender } : null;
}

const agentClashSchema = z.object({
  challengerSpeech: z.string().min(1).max(140).describe("挑起交锋方当场驳斥的话,不超过一百四十字"),
  challengerAction: z.string().min(1).max(80).describe("挑起交锋方随之采取的小动作"),
  defenderSpeech: z
    .string()
    .min(1)
    .max(140)
    .describe("被动反驳方针锋相对回击的话,不超过一百四十字"),
  defenderAction: z.string().min(1).max(80).describe("被动反驳方随之采取的小动作"),
});

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
        const allyId =
          relations.length > 0
            ? relations.reduce((best, relation) => (relation.trust > best.trust ? relation : best))
                .agentId
            : cast.agentCharacters[0]?.id;

        const runRetorts = async (pair: { challenger: RoundEntry; defender: RoundEntry }) => {
          const challenger = cast.agentCharacters.find((c) => c.id === pair.challenger.agentId);
          const defender = cast.agentCharacters.find((c) => c.id === pair.defender.agentId);
          if (!challenger || !defender) return;

          send({ type: "retort-start", agentId: challenger.id, againstId: defender.id });
          send({ type: "retort-start", agentId: defender.id, againstId: challenger.id });

          try {
            const clash = await generateStructured({
              instructions: CLASH_INSTRUCTIONS,
              prompt: buildClashPrompt({
                scenarioCrisis: cast.setting.crisis,
                playerDecision: decision,
                challenger,
                defender,
                challengerLine: pair.challenger.reaction.speech,
                defenderLine: pair.defender.reaction.speech,
              }),
              schema: agentClashSchema,
              temperature: 0.85,
              maxOutputTokens: 600,
              abortSignal: request.signal,
            });

            const parsed = agentClashSchema.parse(clash);

            send({
              type: "agent-retort",
              agentId: challenger.id,
              againstId: defender.id,
              reaction: {
                speech: parsed.challengerSpeech,
                action: parsed.challengerAction,
                target: defender.name,
                stance: "oppose",
                impact: `${challenger.name}与${defender.name}发生朝堂对峙`,
                trustDelta: 0,
                ultimatum: null,
              },
            });

            send({
              type: "agent-retort",
              agentId: defender.id,
              againstId: challenger.id,
              reaction: {
                speech: parsed.defenderSpeech,
                action: parsed.defenderAction,
                target: challenger.name,
                stance: "oppose",
                impact: `${defender.name}针锋相对驳回指责`,
                trustDelta: 0,
                ultimatum: null,
              },
            });
          } catch (error) {
            console.error(`交锋生成失败: ${challenger.name} vs ${defender.name}`, error);
            hasAgentFailure = true;
            send({
              type: "agent-error",
              agentId: challenger.id,
              againstId: defender.id,
              phase: "retort",
              error: publicError("UPSTREAM_FAILURE", "对峙回应生成失败,本回合无法继续", true),
            });
          }
        };

        // 第一轮 4 位 Agent 并行表态
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

        // 表态全部完成后，如有实质冲突，生成二人交锋
        if (!hasAgentFailure) {
          const pair = pickConflictPair(firstRound, nameById);
          if (pair) {
            await runRetorts(pair);
          }
        }
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

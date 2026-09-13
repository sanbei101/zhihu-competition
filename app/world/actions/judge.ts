"use server";

import { z } from "zod";

import { runCouncilAction, type ActionResult } from "@/app/world/action-result";
import { generateStructured } from "@/lib/deepseek";
import { JUDGE_INSTRUCTIONS, buildJudgePrompt } from "@/lib/prompts";
import { worldCastSchema } from "@/lib/world-cast";
import {
  addDeltas,
  advanceCrisis,
  agentRelationSchema,
  applyMetricDeltas,
  applyTrustDeltas,
  checkEnding,
  clampAppliedDeltas,
  crisisBodySchema,
  crisisSchema,
  entropyDeltasForRound,
  metricDeltasSchema,
  metricReasonsSchema,
  metricsSchema,
  penaltyAsDeltas,
  retortRecordSchema,
  settleUltimatum,
  turnReactionRecordSchema,
  turnRecordSchema,
  ultimatumOutcomeSchema,
  ultimatumSchema,
  judgeResultSchema,
  type JudgeResult,
  type UltimatumDraft,
} from "@/lib/world-ending";
import { worldEventSchema } from "@/lib/world-turn";

const judgeTurnInputSchema = z.object({
  cast: worldCastSchema,
  playerId: z.string().min(1),
  metrics: metricsSchema,
  round: z.number().int().min(1),
  situation: z.string().trim().min(1).max(600),
  decision: z.string().trim().min(1).max(600),
  reactions: z.array(turnReactionRecordSchema).max(8),
  retorts: z.array(retortRecordSchema).max(4),
  history: z.array(turnRecordSchema),
  relations: z.array(agentRelationSchema),
  crisis: crisisSchema.nullable(),
  ultimatum: ultimatumSchema.nullable(),
});

const judgeDraftSchema = z.object({
  deltas: metricDeltasSchema.describe("四维指标的单回合增量,每项 -20 到 20 之间"),
  metricReasons: metricReasonsSchema.describe(
    "逐项说明本回合指标为什么变化,必须引用具体行动或事件",
  ),
  events: z
    .array(worldEventSchema)
    .min(1)
    .max(3)
    .describe("一到三个本回合真正发生的公开世界事件,不能只是情绪描述"),
  narration: z.string().min(1).max(320).describe("不超过三百字的世界旁白,承上启下"),
  nextSituation: z.string().min(1).max(300).describe("下一回合最先逼近玩家的具体危机或待处理后果"),
  crisisOutcome: z.enum(["resolved", "unresolved"]),
  newCrisis: crisisBodySchema.nullish(),
  ultimatumOutcome: ultimatumOutcomeSchema,
});

export async function judgeTurnAction(input: unknown): Promise<ActionResult<JudgeResult>> {
  return runCouncilAction({
    name: "回合冲突裁决",
    schema: judgeTurnInputSchema,
    input,
    handler: async (data) => {
      const {
        cast,
        playerId,
        metrics,
        round,
        situation,
        decision,
        reactions,
        retorts,
        history,
        relations,
        crisis,
        ultimatum,
      } = data;

      const player = cast.playerCharacters.find((character) => character.id === playerId);
      if (!player) throw new Error("玩家角色不存在");

      const draft = await generateStructured({
        instructions: JUDGE_INSTRUCTIONS,
        prompt: buildJudgePrompt({
          cast,
          player,
          round,
          metrics,
          situation,
          decision,
          reactions,
          retorts,
          history,
          relations,
          crisis,
          ultimatum,
        }),
        schema: judgeDraftSchema,
        temperature: 0.45,
        maxOutputTokens: 3200,
      });

      const allEntries = [...reactions, ...retorts];
      const withTrust = applyTrustDeltas(
        relations,
        allEntries.map((entry) => ({
          agentId: entry.agentId,
          trustDelta: entry.reaction.trustDelta,
        })),
      );

      const incomingUltimatum =
        allEntries
          .map((entry): { agentId: string; draft: UltimatumDraft } | null =>
            entry.reaction.ultimatum
              ? { agentId: entry.agentId, draft: entry.reaction.ultimatum }
              : null,
          )
          .find((entry): entry is { agentId: string; draft: UltimatumDraft } => entry !== null) ??
        null;

      const ultimatumStep = settleUltimatum({
        pending: ultimatum,
        outcome: draft.ultimatumOutcome,
        round,
        relations: withTrust,
        incoming: incomingUltimatum,
      });

      const crisisResolved =
        crisis !== null && decision.startsWith("[处理当前危机]")
          ? true
          : draft.crisisOutcome === "resolved";

      const crisisStep = advanceCrisis({
        pending: crisis,
        resolved: crisisResolved,
        incoming: draft.newCrisis ?? null,
        round,
      });

      const entropy = entropyDeltasForRound(metrics, round);
      const deltas = clampAppliedDeltas(
        addDeltas(draft.deltas, entropy, penaltyAsDeltas(crisisStep.penalty)),
      );
      const nextMetrics = applyMetricDeltas(metrics, deltas);
      const systemEnding = checkEnding(nextMetrics);
      const ending = systemEnding
        ? {
            type: systemEnding.type,
            title: systemEnding.title,
            reason: systemEnding.reason,
          }
        : null;

      return judgeResultSchema.parse({
        round,
        metrics: nextMetrics,
        deltas,
        entropy,
        crisisPenalty: penaltyAsDeltas(crisisStep.penalty),
        metricReasons: draft.metricReasons,
        events: draft.events,
        narration: draft.narration,
        nextSituation: draft.nextSituation,
        relations: ultimatumStep.relations,
        crisis: crisisStep.crisis,
        crisisResolved: crisisStep.expired === false && crisisResolved,
        ultimatum: ultimatumStep.ultimatum,
        ultimatumOutcome: ultimatumStep.defectedAgentId ? "defied" : draft.ultimatumOutcome,
        isEnded: systemEnding !== null,
        ending,
      });
    },
  });
}

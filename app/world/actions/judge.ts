"use server";

import { z } from "zod";

import { fail, failParse, requireDeepSeekKey, type ActionResult } from "@/app/world/action-result";
import { publicError } from "@/lib/app-error";
import { generateStructured } from "@/lib/deepseek";
import { worldCastSchema, type WorldCast } from "@/lib/world-cast";
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
  describeCrisis,
  describeRelations,
  describeUltimatum,
  entropyDeltasForRound,
  entropyNoteForRound,
  metricDeltasSchema,
  metricReasonsSchema,
  metricsSchema,
  penaltyAsDeltas,
  retortRecordSchema,
  settleUltimatum,
  summarizeReactionsForPrompt,
  summarizeRetortsForPrompt,
  summarizeTurnsForPrompt,
  turnReactionRecordSchema,
  turnRecordSchema,
  ultimatumOutcomeSchema,
  ultimatumSchema,
  judgeResultSchema,
  type JudgeResult,
  type RetortRecord,
  type TurnReactionRecord,
  type TurnRecord,
  type UltimatumDraft,
  type WorldMetrics,
} from "@/lib/world-ending";
import { worldEventSchema } from "@/lib/world-turn";

const JUDGE_INSTRUCTIONS = `你是公正但鼓励玩家试错的世界线裁决者。你只根据玩家决策与各方行动推演世界四维指标(政权稳定/军心士气/民众支持/战略资源)的单回合增量,写一段承上启下的旁白,记录真实发生的公开事件,并结算突发事件与最后通牒。

规则:
- 模型增量每项 -20 到 20,奖惩对称;这是玩家行动带来的变化,不要把大势熵增或危机逾期惩罚重复算进来。
- 具体、可执行且没有违反世界硬约束的决策,通常必须得到回报:至少一项相关指标增加 8 以上,模型增量的四项合计不低于 4,并且不要让四项指标全部下降。即使存在代价,也要让玩家看见行动带来的真实改善。
- 只有明显违背硬约束、严重误判局势或主动冒险失败时,才允许模型增量整体为负;不要为了制造戏剧性把每个回合都判成恶化。
- 若玩家选择了标记为'[处理当前危机]'的具体方案,危机相关指标应出现明显改善,并按规则判定危机已解决;解决危机可以伴随其他维度代价,但不能无理由全盘扣分。
- 每回合至少要有一项指标的变化达到 8 以上--如果局势真的毫无波澜,那是你的推演失职,不是世界太平。
- 每个指标都必须给出具体原因;事件必须有来源、参与者和可观察后果;nextSituation 必须从本回合行动自然推导。
- crisisOutcome:若上方存在未决突发事件,判断玩家这次抉择是否实质解决了它,填 resolved 或 unresolved;选项带有'[处理当前危机]'标记时,只要行动没有违反世界硬约束,必须填 resolved,即使付出了其他代价;若本来就没有未决事件,一律填 unresolved。
- newCrisis:仅当上方没有未决突发事件,且本回合确实造成或暴露了新的重大麻烦时才抛出;它不是每回合必填。若局势刚刚解决危机、没有自然产生的新威胁,返回 null。生成时必须是会自己倒计时、有明确量化代价的新麻烦,deadline 由系统设定,你只填 title/summary/source/severity/penalty。
- ultimatumOutcome:若上方存在未决通牒,判断玩家这次抉择是否满足了它的要求,填 honored 或 defied;若本来没有未决通牒,一律填 none。
- 回合数没有上限,拖延本身就是代价。推演时要体现出各方耐心、资源与信任的持续消耗。
- 旁白不超过三百字,简体中文,具体而不煽情。你只负责本回合的增量、事件、结算与旁白,最终是否结束由系统按规则计算。`;

const buildJudgePrompt = (input: {
  cast: WorldCast;
  player: WorldCast["playerCharacters"][number];
  round: number;
  metrics: WorldMetrics;
  situation: string;
  decision: string;
  reactions: TurnReactionRecord[];
  retorts: RetortRecord[];
  history: TurnRecord[];
  relations: z.infer<typeof agentRelationSchema>[];
  crisis: z.infer<typeof crisisSchema> | null;
  ultimatum: z.infer<typeof ultimatumSchema> | null;
}) => `当前是第 ${input.round} 回合(回合数没有上限)。
时间:${input.cast.setting.time};地点:${input.cast.setting.location};危机:${input.cast.setting.crisis}
世界硬约束:
${input.cast.setting.rules.map((rule) => `- ${rule}`).join("\n")}
本回合突发处境:${input.situation}
当前四维指标:政权稳定 ${input.metrics.stability},军心士气 ${input.metrics.morale},民众支持 ${input.metrics.support},战略资源 ${input.metrics.resources}

大势损耗:${entropyNoteForRound(input.round)}

压在头上的突发事件:
${describeCrisis(input.crisis)}

未决的最后通牒:
${describeUltimatum(input.ultimatum)}

各方对玩家的信任度:
${describeRelations(input.relations)}

此前已结算回合:
${summarizeTurnsForPrompt(input.history)}

本回合玩家(${input.player.name},${input.player.identity})作出抉择:'${input.decision}'

本回合各方第一轮表态:
${summarizeReactionsForPrompt(input.reactions)}

本回合面对面的交锋:
${summarizeRetortsForPrompt(input.retorts)}

请给出事件、四维增量、逐项变化原因、世界旁白、下一回合危机,并结算突发事件与最后通牒。若你认为局势已崩盘或大局已定,在 endingTitle/endingReason 中给出结局标题与理由(一句话),否则返回空字符串。`;

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
  endingTitle: z
    .string()
    .max(40)
    .nullish()
    .transform((value) => value ?? ""),
  endingReason: z
    .string()
    .max(200)
    .nullish()
    .transform((value) => value ?? ""),
});

export async function judgeTurnAction(input: unknown): Promise<ActionResult<JudgeResult>> {
  const parsed = judgeTurnInputSchema.safeParse(input);
  if (!parsed.success) return failParse("裁决", parsed.error);

  const keyCheck = requireDeepSeekKey();
  if (typeof keyCheck !== "string") return keyCheck;

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
  } = parsed.data;
  const player = cast.playerCharacters.find((character) => character.id === playerId);
  if (!player) return fail(publicError("NOT_FOUND", "玩家角色不存在", false));

  try {
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
          title: draft.endingTitle.trim() || systemEnding.title,
          reason: draft.endingReason.trim() || systemEnding.reason,
        }
      : null;

    return {
      ok: true,
      data: judgeResultSchema.parse({
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
      }),
    };
  } catch (error) {
    console.error("回合裁决失败", error);
    return fail(publicError("UPSTREAM_FAILURE", "冲突裁决失败,请重试", true));
  }
}

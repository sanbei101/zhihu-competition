import { z } from "zod";

import { worldCastSchema } from "@/lib/world-cast";
import { decisionOptionSchema } from "@/lib/world-options";
import {
  agentReactionSchema,
  ultimatumDraftSchema,
  worldEventSchema,
  type UltimatumDraft,
} from "@/lib/world-turn";

export { ultimatumDraftSchema, type UltimatumDraft } from "@/lib/world-turn";

// ==================== 局制常量 ====================

/** 至少演满这么多回合,才解锁'主动收束'。 */
export const MIN_ROUND_TO_CLOSE = 3;

/**
 * 回合数没有上限,取而代之的是'大势熵增':
 * 推演得越久,世界自我消耗得越快,逼着玩家在彻底崩盘前主动收束。
 */
export const ENTROPY_PER_ROUND = 2;
export const MAX_ENTROPY = 20;

/** 信任度的初始值与上下限。 */
export const INITIAL_TRUST = 52;
export const TRUST_MIN = 0;
export const TRUST_MAX = 100;

// ==================== 世界指标 ====================

export const metricKeys = ["stability", "morale", "support", "resources"] as const;
export type MetricKey = (typeof metricKeys)[number];

export const metricLabels: Record<MetricKey, string> = {
  stability: "政权稳定",
  morale: "军心士气",
  support: "民众支持",
  resources: "战略资源",
};

export const metricsSchema = z.object({
  stability: z.number().min(0).max(100),
  morale: z.number().min(0).max(100),
  support: z.number().min(0).max(100),
  resources: z.number().min(0).max(100),
});
export type WorldMetrics = z.infer<typeof metricsSchema>;

export const initialWorldMetrics: WorldMetrics = {
  stability: 62,
  morale: 74,
  support: 48,
  resources: 57,
};

export const metricDeltasSchema = z.object({
  stability: z.number().int().min(-20).max(20),
  morale: z.number().int().min(-20).max(20),
  support: z.number().int().min(-20).max(20),
  resources: z.number().int().min(-20).max(20),
});
export type MetricDeltas = z.infer<typeof metricDeltasSchema>;

export function zeroMetricDeltas(): MetricDeltas {
  return { stability: 0, morale: 0, support: 0, resources: 0 };
}

/**
 * 回合实际生效的增量(模型增量 + 大势熵增 + 逾期惩罚叠加后的结果),
 * 下界比模型自报的 -20 更宽,避免叠加后被 schema 卡掉。
 */
export const appliedDeltasSchema = z.object({
  stability: z.number().int().min(-60).max(20),
  morale: z.number().int().min(-60).max(20),
  support: z.number().int().min(-60).max(20),
  resources: z.number().int().min(-60).max(20),
});
export type AppliedDeltas = z.infer<typeof appliedDeltasSchema>;

export function zeroAppliedDeltas(): AppliedDeltas {
  return { stability: 0, morale: 0, support: 0, resources: 0 };
}

export function clampAppliedDeltas(value: AppliedDeltas): AppliedDeltas {
  const clamp = (input: number) => Math.min(20, Math.max(-60, Math.round(input)));
  return {
    stability: clamp(value.stability),
    morale: clamp(value.morale),
    support: clamp(value.support),
    resources: clamp(value.resources),
  };
}

export const metricReasonsSchema = z.object({
  stability: z.string().min(1).max(140),
  morale: z.string().min(1).max(140),
  support: z.string().min(1).max(140),
  resources: z.string().min(1).max(140),
});
export type MetricReasons = z.infer<typeof metricReasonsSchema>;

// ==================== 关系层:信任度 ====================

export const relationAttitudeSchema = z.enum(["loyal", "wary", "pressuring", "defected"]);
export type RelationAttitude = z.infer<typeof relationAttitudeSchema>;

export const attitudeLabels: Record<RelationAttitude, string> = {
  loyal: "拥戴",
  wary: "观望",
  pressuring: "施压",
  defected: "离心",
};

export const attitudeHints: Record<RelationAttitude, string> = {
  loyal: "愿意替你承担代价",
  wary: "还在观望你的手腕",
  pressuring: "开始公开向你索要说法",
  defected: "已不再把命令当回事",
};

export function attitudeForTrust(trust: number): RelationAttitude {
  if (trust >= 70) return "loyal";
  if (trust >= 45) return "wary";
  if (trust >= 20) return "pressuring";
  return "defected";
}

export const agentRelationSchema = z.object({
  agentId: z.string(),
  trust: z.number().min(TRUST_MIN).max(TRUST_MAX),
  attitude: relationAttitudeSchema,
});
export type AgentRelation = z.infer<typeof agentRelationSchema>;

export function clampTrust(value: number): number {
  return Math.min(TRUST_MAX, Math.max(TRUST_MIN, Math.round(value)));
}

export function createInitialRelations(agentIds: string[]): AgentRelation[] {
  return agentIds.map((agentId) => ({
    agentId,
    trust: INITIAL_TRUST,
    attitude: attitudeForTrust(INITIAL_TRUST),
  }));
}

/** 把各 Agent 自报的信任度增减结算进关系层,缺失的 Agent 保持原值。 */
export function applyTrustDeltas(
  relations: AgentRelation[],
  deltas: { agentId: string; trustDelta: number }[],
): AgentRelation[] {
  return relations.map((relation) => {
    const delta = deltas.find((entry) => entry.agentId === relation.agentId)?.trustDelta ?? 0;
    if (delta === 0) return relation;
    const trust = clampTrust(relation.trust + delta);
    return { agentId: relation.agentId, trust, attitude: attitudeForTrust(trust) };
  });
}

/** 阵营离心:把某个 Agent 的信任度一次性打到最低(用于通牒被无视)。 */
export function defectRelation(relations: AgentRelation[], agentId: string): AgentRelation[] {
  return relations.map((relation) =>
    relation.agentId === agentId
      ? { agentId, trust: TRUST_MIN, attitude: attitudeForTrust(TRUST_MIN) }
      : relation,
  );
}

export function relationOf(relations: AgentRelation[], agentId: string): AgentRelation | undefined {
  return relations.find((relation) => relation.agentId === agentId);
}

// ==================== 突发事件(带倒计时) ====================

export const crisisPenaltySchema = z.object({
  stability: z.number().int().min(0).max(12),
  morale: z.number().int().min(0).max(12),
  support: z.number().int().min(0).max(12),
  resources: z.number().int().min(0).max(12),
});
export type CrisisPenalty = z.infer<typeof crisisPenaltySchema>;

export const crisisSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().min(1).max(40),
  summary: z.string().min(1).max(160),
  source: z.string().min(1).max(60),
  severity: z.enum(["low", "medium", "high"]),
  /** 还剩几回合到期;归零仍未解决则开始逐回合扣指标 */
  roundsLeft: z.number().int().min(0).max(6),
  penalty: crisisPenaltySchema,
});
export type WorldCrisis = z.infer<typeof crisisSchema>;

/** 交给模型填写的突发事件本体,倒计时由服务端决定。 */
export const crisisBodySchema = crisisSchema.omit({ roundsLeft: true });
export type CrisisBody = z.infer<typeof crisisBodySchema>;

export const crisisSeverityLabels: Record<WorldCrisis["severity"], string> = {
  low: "低烈度",
  medium: "中烈度",
  high: "高烈度",
};

// ==================== 通牒 ====================

export const ultimatumSchema = ultimatumDraftSchema.extend({
  agentId: z.string().min(1),
  /** 到这个回合仍未被满足,该 Agent 自行其是 */
  deadlineRound: z.number().int().min(1),
});
export type WorldUltimatum = z.infer<typeof ultimatumSchema>;

export const ultimatumOutcomeSchema = z.enum(["none", "honored", "defied"]);
export type UltimatumOutcome = z.infer<typeof ultimatumOutcomeSchema>;

export const ultimatumOutcomeLabels: Record<UltimatumOutcome, string> = {
  none: "尚无进展",
  honored: "已兑现",
  defied: "已被无视",
};

// ==================== 回合记录 ====================

export const turnReactionRecordSchema = z.object({
  agentId: z.string(),
  reaction: agentReactionSchema,
});
export type TurnReactionRecord = z.infer<typeof turnReactionRecordSchema>;

/** 第二轮交锋的记录:额外记住是在回击谁。 */
export const retortRecordSchema = turnReactionRecordSchema.extend({
  againstId: z.string(),
});
export type RetortRecord = z.infer<typeof retortRecordSchema>;

export const turnRecordSchema = z.object({
  round: z.number().int().min(1),
  /** 玩家从本回合候选未来中选入的分支编号,旧存档可以没有。 */
  branchId: z.string().min(1).max(20).optional(),
  /** 分支标题,用于在世界线时间线中回放,旧存档可以没有。 */
  branchTitle: z.string().min(1).max(100).optional(),
  /** 当时出现过的全部候选未来,用于回放未选择的分支。 */
  branchOptions: z.array(decisionOptionSchema).min(1).max(4).optional(),
  decision: z.string(),
  /** 第一轮:四个 Agent 各自表态 */
  reactions: z.array(turnReactionRecordSchema),
  /** 第二轮:被点名者之间的当场回击 */
  retorts: z.array(retortRecordSchema),
  events: z.array(worldEventSchema).min(1).max(3),
  narration: z.string(),
  /** 本回合实际生效的四维增量(含大势熵增与逾期惩罚) */
  deltas: appliedDeltasSchema,
  /** 其中由大势熵增造成的部分 */
  entropy: appliedDeltasSchema,
  /** 其中由突发事件逾期造成的部分 */
  crisisPenalty: appliedDeltasSchema,
  metricReasons: metricReasonsSchema,
  /** 本回合结算后的信任度快照 */
  relations: z.array(agentRelationSchema),
  /** 本回合结束时的未决突发事件 */
  crisis: crisisSchema.nullable(),
  crisisResolved: z.boolean(),
  /** 本回合结束时的未决通牒 */
  ultimatum: ultimatumSchema.nullable(),
  ultimatumOutcome: ultimatumOutcomeSchema,
  nextSituation: z.string().min(1).max(300),
});
export type TurnRecord = z.infer<typeof turnRecordSchema>;

// ==================== 结局 ====================

export const endingTypeSchema = z.enum(["glorious", "collapse", "balanced", "pyrrhic", "open"]);
export type EndingType = z.infer<typeof endingTypeSchema>;

export const endingLabels: Record<EndingType, string> = {
  glorious: "辉煌定鼎",
  collapse: "世界线崩断",
  balanced: "均势收束",
  pyrrhic: "惨胜收场",
  open: "开放式结局",
};

export const endingSchema = z.object({
  type: endingTypeSchema,
  title: z.string(),
  reason: z.string(),
});
export type WorldEnding = z.infer<typeof endingSchema>;

export const judgeResultSchema = z.object({
  round: z.number().int().min(1),
  metrics: metricsSchema,
  deltas: appliedDeltasSchema,
  entropy: appliedDeltasSchema,
  crisisPenalty: appliedDeltasSchema,
  metricReasons: metricReasonsSchema,
  events: z.array(worldEventSchema).min(1).max(3),
  narration: z.string(),
  nextSituation: z.string().min(1).max(300),
  relations: z.array(agentRelationSchema),
  crisis: crisisSchema.nullable(),
  crisisResolved: z.boolean(),
  ultimatum: ultimatumSchema.nullable(),
  ultimatumOutcome: ultimatumOutcomeSchema,
  isEnded: z.boolean(),
  ending: endingSchema.nullable(),
});
export type JudgeResult = z.infer<typeof judgeResultSchema>;

// ==================== 终章 ====================

export const finaleRatingSchema = z.enum(["S", "A", "B", "C"]);
export type FinaleRating = z.infer<typeof finaleRatingSchema>;

/**
 * 终章故事的篇幅预算
 * 单章目标不写死,而是由总预算与章数反算,保证不同章数下总长都落在三千字上下。
 */
export const FINALE_TARGET_CHARS = 3000;
/** 楔子(旁白 + '我是谁'自我介绍)算在这一份预算里。 */
export const FINALE_PROLOGUE_CHARS = 450;
export const FINALE_CHAPTER_MIN_CHARS = 400;
export const FINALE_CHAPTER_MAX_CHARS = 3000;
export const FINALE_CHAPTER_MIN = 3;
export const FINALE_CHAPTER_MAX = 5;

/** 按章数反算单章目标字数:总预算扣掉楔子,再平分。 */
export function finaleChapterTargetFor(chapterCount: number): number {
  const body = Math.max(FINALE_TARGET_CHARS - FINALE_PROLOGUE_CHARS, 0);
  return Math.round(body / Math.max(chapterCount, 1));
}

/** 第一章:先定卷目与判词,再由客户端逐章续写。 */
export const finalePlanSchema = z.object({
  verdictTitle: z.string().min(1).max(60),
  verdictLine: z.string().min(1).max(200),
  rating: finaleRatingSchema,
  /** 玩家私密目标的达成情况 */
  privateGoalVerdict: z.enum(["达成", "部分达成", "未达成"]),
  privateGoalNote: z.string().min(1).max(400),
  /** 楔子·旁白:像故事开场那样交代时间、地点与正在发生的危机,旁白腔,不出现'我' */
  prologue: z.string().min(60).max(600),
  /** 楔子·自述:紧接旁白转第一人称,以'我是'开头做自我介绍 */
  selfIntro: z.string().min(100).max(900),
  chapters: z
    .array(
      z.object({
        index: z.number().int().min(1),
        title: z.string().min(1).max(40),
        brief: z.string().min(10).max(300),
      }),
    )
    .min(FINALE_CHAPTER_MIN)
    .max(FINALE_CHAPTER_MAX)
    .describe(
      `全部卷目,按时间顺序,共 ${FINALE_CHAPTER_MIN} 到 ${FINALE_CHAPTER_MAX} 章,总数由题目给定`,
    ),
  timeline: z
    .array(
      z.object({
        round: z.number().int().min(1),
        title: z.string(),
        summary: z.string(),
      }),
    )
    .min(1),
  shareText: z.string().min(20).max(2000),
});
export type FinalePlan = z.infer<typeof finalePlanSchema>;

/** 后续每一次调用只续写一章。 */
export const finaleChapterSchema = z.object({
  title: z.string().min(1).max(40),
  markdown: z
    .string()
    .min(FINALE_CHAPTER_MIN_CHARS)
    .max(FINALE_CHAPTER_MAX_CHARS)
    .describe(
      `本卷正文,第一人称,${FINALE_CHAPTER_MIN_CHARS} 到 ${FINALE_CHAPTER_MAX_CHARS} 字之间`,
    ),
});
export type FinaleChapter = z.infer<typeof finaleChapterSchema>;

export const finaleProgressSchema = z.object({
  plan: finalePlanSchema,
  chapters: z.array(finaleChapterSchema),
});

/** 组装完成、可缓存可复制的终章。 */
export const finaleSchema = z.object({
  verdictTitle: z.string(),
  verdictLine: z.string(),
  rating: finaleRatingSchema,
  privateGoalVerdict: z.enum(["达成", "部分达成", "未达成"]),
  privateGoalNote: z.string().min(1).max(400),
  timeline: z
    .array(
      z.object({
        round: z.number().int().min(1),
        title: z.string(),
        summary: z.string(),
      }),
    )
    .min(1),
  articleMarkdown: z.string().min(200),
  charCount: z.number().int().min(0),
  shareText: z.string().min(20).max(2000),
});
export type WorldFinale = z.infer<typeof finaleSchema>;

/** 章节数按回合数推算:3 到 5 章,推演越长分卷越细。 */
export function finaleChapterCountFor(turns: number): number {
  return Math.min(FINALE_CHAPTER_MAX, Math.max(FINALE_CHAPTER_MIN, 3 + Math.floor(turns / 3)));
}

export function countArticleChars(markdown: string): number {
  return markdown.replace(/\s/g, "").length;
}

/** 把楔子(旁白 + 自述)和逐章正文拼成最终的知乎故事长文。 */
export function assembleFinaleArticle(input: {
  verdictTitle: string;
  prologue: string;
  selfIntro: string;
  chapters: { title: string; markdown: string }[];
}): string {
  const body = input.chapters
    .map((chapter) => `## ${chapter.title}\n\n${chapter.markdown.trim()}`)
    .join("\n\n");
  const opening = [input.prologue.trim(), input.selfIntro.trim()].filter(Boolean).join("\n\n");
  return `# ${input.verdictTitle}\n\n## 楔子\n\n${opening}\n\n---\n\n${body}\n\n---\n\n*以上为亲历者自述,由世界线史官整理归档。*`;
}

// ==================== 对局存档 ====================

export const worldGameSessionSchema = z.object({
  scenarioId: z.string(),
  scenarioTitle: z.string(),
  scenarioUrl: z.string(),
  playerId: z.string(),
  cast: worldCastSchema,
  metrics: metricsSchema,
  round: z.number().int().min(1),
  turns: z.array(turnRecordSchema),
  relations: z.array(agentRelationSchema),
  crisis: crisisSchema.nullable(),
  ultimatum: ultimatumSchema.nullable(),
  status: z.enum(["ongoing", "ended"]),
  ending: endingSchema.nullable(),
});
export type WorldGameSession = z.infer<typeof worldGameSessionSchema>;

export function createInitialGameSession(input: {
  scenarioId: string;
  scenarioTitle: string;
  scenarioUrl?: string;
  playerId: string;
  cast: z.infer<typeof worldCastSchema>;
}): WorldGameSession {
  return {
    scenarioId: input.scenarioId,
    scenarioTitle: input.scenarioTitle,
    scenarioUrl: input.scenarioUrl ?? "",
    playerId: input.playerId,
    cast: input.cast,
    metrics: { ...initialWorldMetrics },
    round: 1,
    turns: [],
    relations: createInitialRelations(input.cast.agentCharacters.map((character) => character.id)),
    crisis: null,
    ultimatum: null,
    status: "ongoing",
    ending: null,
  };
}

// ==================== 纯函数:幕次 / 熵增 / 数值 / 判定 ====================

/** 幕次随回合无限延伸:没有终局上限,只有越来越深的阶段。 */
export function actForRound(round: number): string {
  if (round <= 2) return "第一幕·立势";
  if (round <= 4) return "第二幕·激化";
  if (round <= 7) return "第三幕·倾覆";
  return "第四幕·倾颓";
}

/** 本回合世界自我消耗的总量。 */
export function entropyForRound(round: number): number {
  return Math.min(MAX_ENTROPY, Math.max(0, (round - 1) * ENTROPY_PER_ROUND));
}

/**
 * 熵增按'缺口越大、流失越快'的比例分摊到四维:
 * 已经很低的那一维会更快见底,于是崩盘有征兆、收束有压力。
 */
export function entropyDeltasForRound(metrics: WorldMetrics, round: number): MetricDeltas {
  const total = entropyForRound(round);
  if (total <= 0) return zeroMetricDeltas();

  const weights = metricKeys.map((key) => Math.max(6, 100 - metrics[key]));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  const deltas = zeroMetricDeltas();
  for (const [index, key] of metricKeys.entries()) {
    const share = Math.max(1, Math.round((total * weights[index]) / weightSum));
    deltas[key] = -share;
  }
  return deltas;
}

interface DeltaShape {
  stability: number;
  morale: number;
  support: number;
  resources: number;
}

export function addDeltas(base: DeltaShape, ...extras: DeltaShape[]): AppliedDeltas {
  const sum = (key: keyof DeltaShape) =>
    base[key] + extras.reduce((total, extra) => total + extra[key], 0);
  return {
    stability: sum("stability"),
    morale: sum("morale"),
    support: sum("support"),
    resources: sum("resources"),
  };
}

/** 把'代价'转成负增量。 */
export function penaltyAsDeltas(penalty: CrisisPenalty): AppliedDeltas {
  return {
    stability: -penalty.stability,
    morale: -penalty.morale,
    support: -penalty.support,
    resources: -penalty.resources,
  };
}

/** 给模型描述当前大势的自噬速度。 */
export function entropyNoteForRound(round: number): string {
  const total = entropyForRound(round);
  if (total <= 0) return "世界尚未开始自我消耗。";
  return `这是第 ${round} 回合,局势拖延过久,世界每回合自然流失约 ${total} 点指标(分摊到缺口最大的维度)。拖延本身就是代价。`;
}

export type PressureLevel = "stable" | "tense" | "critical" | "brink";

export const pressureLabels: Record<PressureLevel, string> = {
  stable: "大势尚稳",
  tense: "局势紧绷",
  critical: "危在旦夕",
  brink: "崩坏临界",
};

/** 用最弱的一维来判断当前压力档位。 */
export function pressureLevel(metrics: WorldMetrics): PressureLevel {
  const value = minMetric(metrics).value;
  if (value <= 8) return "brink";
  if (value <= 22) return "critical";
  if (value <= 40) return "tense";
  return "stable";
}

export function clampMetric(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function applyMetricDeltas(metrics: WorldMetrics, deltas: MetricDeltas): WorldMetrics {
  return {
    stability: clampMetric(metrics.stability + deltas.stability),
    morale: clampMetric(metrics.morale + deltas.morale),
    support: clampMetric(metrics.support + deltas.support),
    resources: clampMetric(metrics.resources + deltas.resources),
  };
}

export function averageMetrics(metrics: WorldMetrics): number {
  return (metrics.stability + metrics.morale + metrics.support + metrics.resources) / 4;
}

export function minMetric(metrics: WorldMetrics): { key: MetricKey; value: number } {
  let key: MetricKey = "stability";
  for (const candidate of metricKeys) {
    if (metrics[candidate] < metrics[key]) key = candidate;
  }
  return { key, value: metrics[key] };
}

export function ratingForMetrics(metrics: WorldMetrics): FinaleRating {
  const avg = averageMetrics(metrics);
  const min = minMetric(metrics).value;
  if (avg >= 75 && min >= 40) return "S";
  if (avg >= 60 && min >= 25) return "A";
  if (avg >= 40) return "B";
  return "C";
}

function collapseEnding(metrics: WorldMetrics): WorldEnding {
  const { key, value } = minMetric(metrics);
  return {
    type: "collapse",
    title: `${metricLabels[key]}归零,世界线崩断`,
    reason: `四项指标中的'${metricLabels[key]}'已跌至 ${value},局势无法维持,进入崩盘结局。`,
  };
}

/** 按当前四维给出结算结局(主动收束与崩盘共用)。 */
export function endingForMetrics(metrics: WorldMetrics): WorldEnding {
  const avg = Math.round(averageMetrics(metrics));
  const min = minMetric(metrics);

  if (min.value <= 0) return collapseEnding(metrics);

  if (avg >= 75 && min.value >= 40) {
    return {
      type: "glorious",
      title: "大势底定,辉煌收束",
      reason: `世界均值 ${avg},各条战线均稳固,堪称最优世界线。`,
    };
  }
  if (avg >= 45 && min.value >= 20) {
    return {
      type: "balanced",
      title: "均势收束,各方止血",
      reason: `世界均值 ${avg},没有赢家,但也没有输家。`,
    };
  }
  if (avg >= 35) {
    return {
      type: "pyrrhic",
      title: "惨胜收场,代价沉重",
      reason: `世界均值 ${avg},'${metricLabels[min.key]}'仅剩 ${min.value},胜利名存实亡。`,
    };
  }
  return collapseEnding(metrics);
}

/**
 * 世界是否自己走到了终点(不依赖回合上限):
 * 1. 任一指标 ≤0 → 崩盘
 * 2. 任一指标 ≥95 且均值 ≥70 → 辉煌提前定鼎
 * 否则返回 null,由玩家决定何时主动收束。
 */
export function checkEnding(metrics: WorldMetrics): WorldEnding | null {
  const min = minMetric(metrics);
  if (min.value <= 0) return collapseEnding(metrics);

  const avg = averageMetrics(metrics);
  const hasPeak = metricKeys.some((key) => metrics[key] >= 95);
  if (hasPeak && avg >= 70) {
    return {
      type: "glorious",
      title: "天命所归,提前定鼎",
      reason: `世界均值 ${Math.round(avg)} 且有维度突破 95,大势已成,无需再演。`,
    };
  }

  return null;
}

/** 玩家主动收束:结局档位由当时的四维决定,不再是固定的'开放式'。 */
export function buildVoluntaryEnding(round: number, metrics: WorldMetrics): WorldEnding {
  const base = endingForMetrics(metrics);
  return {
    type: base.type,
    title: base.title,
    reason: `演至第 ${round} 回合,你选择在此收束这条世界线。${base.reason}`,
  };
}

// ==================== 突发事件 / 通牒的确定性推进 ====================

/**
 * 突发事件倒计时推进:
 * - 若本回合判为已解决 → 清空
 * - 否则倒计时减一;减到 0 则开始逐回合扣指标(penalty),并保留在案
 * - 若原本没有未决事件,则接受本回合新生成的事件
 */
export function advanceCrisis(input: {
  pending: WorldCrisis | null;
  resolved: boolean;
  incoming: CrisisBody | null;
  round: number;
}): { crisis: WorldCrisis | null; penalty: CrisisPenalty; expired: boolean } {
  const { pending, resolved, incoming } = input;
  const noPenalty: CrisisPenalty = { stability: 0, morale: 0, support: 0, resources: 0 };

  if (pending) {
    if (resolved) return { crisis: null, penalty: noPenalty, expired: false };
    const roundsLeft = Math.max(0, pending.roundsLeft - 1);
    if (roundsLeft > 0) {
      return { crisis: { ...pending, roundsLeft }, penalty: noPenalty, expired: false };
    }
    // 逾期:事件继续压在头上,并且每回合开始扣血
    return { crisis: { ...pending, roundsLeft: 0 }, penalty: pending.penalty, expired: true };
  }

  if (!incoming) return { crisis: null, penalty: noPenalty, expired: false };

  return {
    crisis: { ...incoming, roundsLeft: incoming.severity === "high" ? 2 : 3 },
    penalty: noPenalty,
    expired: false,
  };
}

/** 通牒结算:被满足则澄清并补回信任;被无视则该 Agent 离心。 */
export function settleUltimatum(input: {
  pending: WorldUltimatum | null;
  outcome: UltimatumOutcome;
  round: number;
  relations: AgentRelation[];
  incoming: { agentId: string; draft: UltimatumDraft } | null;
}): {
  ultimatum: WorldUltimatum | null;
  relations: AgentRelation[];
  defectedAgentId: string | null;
} {
  const { pending, outcome, round, relations, incoming } = input;

  if (pending) {
    if (outcome === "honored") {
      return {
        ultimatum: null,
        relations: applyTrustDeltas(relations, [{ agentId: pending.agentId, trustDelta: 8 }]),
        defectedAgentId: null,
      };
    }
    if (outcome === "defied" || round > pending.deadlineRound) {
      return {
        ultimatum: null,
        relations: defectRelation(relations, pending.agentId),
        defectedAgentId: pending.agentId,
      };
    }
    return { ultimatum: pending, relations, defectedAgentId: null };
  }

  if (outcome === "defied" && incoming) {
    return {
      ultimatum: null,
      relations: defectRelation(relations, incoming.agentId),
      defectedAgentId: incoming.agentId,
    };
  }

  if (incoming) {
    return {
      ultimatum: {
        agentId: incoming.agentId,
        demand: incoming.draft.demand,
        penalty: incoming.draft.penalty,
        deadlineRound: round + 1,
      },
      relations,
      defectedAgentId: null,
    };
  }

  return { ultimatum: null, relations, defectedAgentId: null };
}

// ==================== 给 LLM 的压缩上下文 ====================

export function summarizeTurnsForPrompt(turns: TurnRecord[], maxChars = 2200): string {
  if (!turns.length) return "(此前尚无已结算回合,这是第一回合)";

  const text = turns
    .map((turn) => {
      const stances = turn.reactions
        .map((entry) => `${entry.agentId}:${entry.reaction.stance}`)
        .join(",");
      const retorts = turn.retorts.length
        ? `;交锋:${turn.retorts
            .map((entry) => `${entry.agentId}:${entry.reaction.speech.slice(0, 60)}`)
            .join(" / ")}`
        : "";
      const events = turn.events.map((event) => `${event.kind}:${event.title}`).join(",");
      const trust = turn.relations.length
        ? `;信任:${turn.relations.map((r) => `${r.agentId}=${r.trust}`).join(",")}`
        : "";
      const crisis = turn.crisis
        ? `;未决突发事件:${turn.crisis.title}(剩${turn.crisis.roundsLeft}回合)`
        : "";
      const ultimatum = turn.ultimatum
        ? `;未决通牒:${turn.ultimatum.agentId} 要求'${turn.ultimatum.demand}'`
        : "";
      return `第${turn.round}回合:玩家'${turn.decision}';各方(${stances || "无回应"})${retorts};事件:${events};旁白:${turn.narration.slice(0, 140)};下引:${turn.nextSituation.slice(0, 100)}${trust}${crisis}${ultimatum}`;
    })
    .join("\n");

  return text.length > maxChars ? `…${text.slice(-maxChars)}` : text;
}

export function summarizeReactionsForPrompt(reactions: TurnReactionRecord[]): string {
  if (!reactions.length) return "(本回合没有任何 Agent 成功回应)";
  return reactions
    .map(
      (entry) =>
        `- ${entry.agentId}(${entry.reaction.stance},信任${entry.reaction.trustDelta >= 0 ? "+" : ""}${entry.reaction.trustDelta}):${entry.reaction.speech.slice(0, 100)}|行动:${entry.reaction.action.slice(0, 100)}|影响:${entry.reaction.impact.slice(0, 80)}`,
    )
    .join("\n");
}

export function summarizeRetortsForPrompt(retorts: RetortRecord[]): string {
  if (!retorts.length) return "(本回合没有发生面对面交锋)";
  return retorts
    .map(
      (entry) =>
        `- ${entry.agentId} 回击 ${entry.againstId}:${entry.reaction.speech.slice(0, 100)}`,
    )
    .join("\n");
}

// ==================== 过线给 Agent 的文本摘要 ====================

/** 信任度摘要:让每个 Agent 知道自己和同僚各自离玩家有多近。 */
export function describeRelations(relations: AgentRelation[]): string {
  if (!relations.length) return "(尚无信任度记录,默认所有人对你保持观望)";
  return relations
    .map(
      (relation) =>
        `- ${relation.agentId}:信任 ${relation.trust}/100,态度'${attitudeLabels[relation.attitude]}'(${attitudeHints[relation.attitude]})`,
    )
    .join("\n");
}

export function describeCrisis(crisis: WorldCrisis | null): string {
  if (!crisis) return "(当前没有压顶的突发事件)";
  const deadline =
    crisis.roundsLeft > 0
      ? `还剩 ${crisis.roundsLeft} 回合到期`
      : "已经逾期,正在每回合持续扣减指标";
  const penalty = metricKeys
    .filter((key) => crisis.penalty[key] > 0)
    .map((key) => `${metricLabels[key]} -${crisis.penalty[key]}`)
    .join("、");
  return `${crisis.title}(${crisisSeverityLabels[crisis.severity]},${deadline})
起因:${crisis.source}
详情:${crisis.summary}
逾期代价:${penalty || "暂无量化代价"}`;
}

export function describeUltimatum(ultimatum: WorldUltimatum | null): string {
  if (!ultimatum) return "(当前没有人向你下最后通牒)";
  return `${ultimatum.agentId} 要求:${ultimatum.demand}
不照做的后果:${ultimatum.penalty}
最后期限:第 ${ultimatum.deadlineRound} 回合`;
}

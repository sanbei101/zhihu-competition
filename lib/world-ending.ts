import { z } from "zod";

import { worldCastSchema } from "@/lib/world-cast";
import { agentReactionSchema } from "@/lib/world-turn";

// ==================== 局制常量 ====================

export const MAX_ROUNDS = 5;
export const MIN_ROUND_TO_CLOSE = 3;

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

// ==================== 回合记录 ====================

export const turnReactionRecordSchema = z.object({
  agentId: z.string(),
  reaction: agentReactionSchema,
});
export type TurnReactionRecord = z.infer<typeof turnReactionRecordSchema>;

export const turnRecordSchema = z.object({
  round: z.number().int().min(1).max(MAX_ROUNDS),
  decision: z.string(),
  reactions: z.array(turnReactionRecordSchema),
  narration: z.string(),
  deltas: metricDeltasSchema,
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
  round: z.number().int().min(1).max(MAX_ROUNDS),
  metrics: metricsSchema,
  deltas: metricDeltasSchema,
  narration: z.string(),
  isEnded: z.boolean(),
  ending: endingSchema.nullable(),
});
export type JudgeResult = z.infer<typeof judgeResultSchema>;

// ==================== 终章 ====================

export const finaleRatingSchema = z.enum(["S", "A", "B", "C"]);
export type FinaleRating = z.infer<typeof finaleRatingSchema>;

export const finaleSchema = z.object({
  verdictTitle: z.string(),
  verdictLine: z.string(),
  rating: finaleRatingSchema,
  timeline: z
    .array(
      z.object({
        round: z.number().int().min(1).max(MAX_ROUNDS),
        title: z.string(),
        summary: z.string(),
      }),
    )
    .min(1)
    .max(MAX_ROUNDS),
  articleMarkdown: z.string().min(200).max(20000),
  shareText: z.string().min(20).max(2000),
});
export type WorldFinale = z.infer<typeof finaleSchema>;

// ==================== 对局存档 ====================

export const worldGameSessionSchema = z.object({
  scenarioId: z.string(),
  scenarioTitle: z.string(),
  scenarioUrl: z.string().optional().default(""),
  playerId: z.string(),
  cast: worldCastSchema,
  metrics: metricsSchema,
  round: z.number().int().min(1).max(MAX_ROUNDS),
  turns: z.array(turnRecordSchema).max(MAX_ROUNDS),
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
    status: "ongoing",
    ending: null,
  };
}

// ==================== 纯函数:幕次 / 数值 / 判定 ====================

export function actForRound(round: number): string {
  if (round <= 2) return "第一幕·立势";
  if (round <= 4) return "第二幕·激化";
  return "终幕·收束";
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
    reason: `第${metricKeys.length}维指标中的'${metricLabels[key]}'已跌至 ${value},局势无法维持,进入崩盘结局。`,
  };
}

/** 跑满 5 回合时的强制结算。 */
export function finalEndingForMetrics(metrics: WorldMetrics): WorldEnding {
  const avg = Math.round(averageMetrics(metrics));
  const min = minMetric(metrics);
  if (avg >= 75 && min.value >= 40) {
    return {
      type: "glorious",
      title: "大势底定,辉煌收束",
      reason: `五回合推演结束,世界均值 ${avg},各条战线均稳固,堪称最优世界线。`,
    };
  }
  if (avg >= 55) {
    return {
      type: "balanced",
      title: "均势收束,各方止血",
      reason: `五回合推演结束,世界均值 ${avg},没有赢家,但也没有输家。`,
    };
  }
  if (avg >= 35) {
    return {
      type: "pyrrhic",
      title: "惨胜收场,代价沉重",
      reason: `五回合推演结束,世界均值 ${avg},'${metricLabels[min.key]}'仅剩 ${min.value},胜利名存实亡。`,
    };
  }
  return collapseEnding(metrics);
}

/**
 * 核心结束判定(服务端与客户端共用同一份):
 * 1. 任一指标 ≤0 → 崩盘提前结束
 * 2. 任一指标 ≥95 且均值 ≥70 → 辉煌提前结束
 * 3. 跑满 MAX_ROUNDS → 强制结算
 * 否则返回 null(继续)。
 */
export function checkEnding(metrics: WorldMetrics, round: number): WorldEnding | null {
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

  if (round >= MAX_ROUNDS) return finalEndingForMetrics(metrics);
  return null;
}

/** 第 MIN_ROUND_TO_CLOSE 回合起允许的玩家主动收束(本地构造,无需 LLM)。 */
export function buildVoluntaryEnding(round: number): WorldEnding {
  return {
    type: "open",
    title: `演至第 ${round} 回合,主动收束`,
    reason: `玩家在第 ${round} 回合选择收束世界线,故事在此分叉处定格,留给知乎评论区继续推演。`,
  };
}

// ==================== 给 LLM 的压缩上下文 ====================

export function summarizeTurnsForPrompt(turns: TurnRecord[], maxChars = 1800): string {
  if (!turns.length) return "(此前尚无已结算回合,这是第一回合)";
  const text = turns
    .map((turn) => {
      const stances = turn.reactions
        .map((entry) => `${entry.agentId}:${entry.reaction.stance}`)
        .join(",");
      return `第${turn.round}回合:玩家${turn.decision.slice(0, 80)};各方(${stances || "无回应"});旁白:${turn.narration.slice(0, 120)}`;
    })
    .join("\n");
  return text.length > maxChars ? `…${text.slice(-maxChars)}` : text;
}

export function summarizeReactionsForPrompt(reactions: TurnReactionRecord[]): string {
  if (!reactions.length) return "(本回合没有任何 Agent 成功回应)";
  return reactions
    .map(
      (entry) =>
        `- ${entry.agentId}(${entry.reaction.stance}):${entry.reaction.speech.slice(0, 80)}|行动:${entry.reaction.action.slice(0, 80)}`,
    )
    .join("\n");
}

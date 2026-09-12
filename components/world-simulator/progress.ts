import type { GlobalMetric, HardRule, WorldEntity } from "@/lib/world-sim";
import type { CounterfactualPremise } from "@/lib/world-sim";

/**
 * 进度估算。
 *
 * 流式事件没有百分比,只能按"已经收到几类关键信息"折算。
 * 刻意做成一个纯函数并让权重显式可读:进度条突然往回跳比慢一点更让人不安,
 * 所以这里的每一项都只会单调增加。
 */

const WEIGHTS = {
  premise: 12,
  rules: 14,
  entities: 56,
  metrics: 18,
} as const;

const TOTAL_WEIGHT = WEIGHTS.premise + WEIGHTS.rules + WEIGHTS.entities + WEIGHTS.metrics;

export function seedProgressPercent(input: {
  premise: CounterfactualPremise | null;
  hardRules: HardRule[];
  entities: WorldEntity[];
  globalMetrics: GlobalMetric[];
}): number {
  let earned = 0;
  if (input.premise) earned += WEIGHTS.premise;
  if (input.hardRules.length) earned += WEIGHTS.rules;
  if (input.entities.length) {
    // 主体是最大一块,按已收到数量占预期数量的比例给分
    const expected = Math.max(3, Math.min(4, input.entities.length));
    earned += Math.round(WEIGHTS.entities * Math.min(1, input.entities.length / expected) || 0);
  }
  if (input.globalMetrics.length) earned += WEIGHTS.metrics;

  return Math.max(0, Math.min(99, Math.round((earned / TOTAL_WEIGHT) * 100)));
}

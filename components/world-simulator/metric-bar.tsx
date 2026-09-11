import { TrendingDown, TrendingUp } from "lucide-react";

import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import type { GlobalMetric } from "@/lib/world-sim";

/**
 * 指标条的配色:涨跌本身没有好坏,要结合 goodDirection 才判断得出。
 * 好方向向上的指标涨了是好事,好方向向下的指标涨了反而是坏事。
 */
export function metricToneClass(metric: Pick<GlobalMetric, "goodDirection" | "delta">) {
  const delta = metric.delta ?? 0;
  if (delta === 0) return "text-muted-foreground";
  if (metric.goodDirection === "mixed") return "text-muted-foreground";
  const good = delta > 0 === (metric.goodDirection === "up");
  return good ? "text-primary" : "text-destructive";
}

export function MetricDeltaBadge({
  metric,
  delta,
}: {
  metric: Pick<GlobalMetric, "goodDirection">;
  delta: number;
}) {
  if (delta === 0) return null;
  return (
    <span className={`flex items-center gap-0.5 text-xs ${metricToneClass({ ...metric, delta })}`}>
      {delta > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {delta > 0 ? `+${delta}` : delta}
    </span>
  );
}

/** 带标签与涨跌的指标进度条 */
export function MetricBar({ metric }: { metric: GlobalMetric }) {
  const delta = metric.delta ?? 0;
  return (
    <Progress value={metric.value}>
      <ProgressLabel className="text-sm">{metric.label}</ProgressLabel>
      <ProgressValue>
        {() => (
          <span className="flex items-center gap-1.5 tabular-nums">
            {metric.value}
            <MetricDeltaBadge metric={metric} delta={delta} />
          </span>
        )}
      </ProgressValue>
    </Progress>
  );
}

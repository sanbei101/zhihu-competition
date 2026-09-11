"use client";

import { Loader2, MoveRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { GlobalMetric } from "@/lib/world-sim";

/**
 * 底部指标条。
 *
 * 只有四个数字和四道细线,外加唯一的那个"推进时间"按钮。
 * 刻意没有任何说明文字 —— 指标的含义交给卡牌与见证者去讲,
 * 这里只需要让玩家一眼扫到"世界的哪根弦紧了"。
 *
 * 推进按钮是全屏唯一的"空桌动作":手上没牌的时候,它是唯一能点的东西。
 */
export function MetricStrip({
  metrics,
  onAdvance,
  advanceLabel,
  advanceDisabled,
  busy,
  progress,
}: {
  metrics: GlobalMetric[];
  onAdvance: () => void;
  advanceLabel: string;
  advanceDisabled: boolean;
  busy: boolean;
  /** 推演过程中的实时进度。为空表示空闲 */
  progress: { label: string; done: number; total: number } | null;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
      <div className="grid flex-1 grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.id} className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-muted-foreground truncate text-xs">{metric.label}</span>
              <span className="ml-auto font-mono text-sm tabular-nums">{metric.value}</span>
              {metric.delta ? (
                <span
                  className={`font-mono text-[11px] ${
                    metric.delta > 0 ? "text-chart-2" : "text-destructive"
                  }`}
                >
                  {metric.delta > 0 ? "+" : ""}
                  {metric.delta}
                </span>
              ) : null}
            </div>
            <div className="bg-muted mt-1.5 h-1 overflow-hidden rounded-full">
              <div
                className="bg-chart-1 h-full rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(0, Math.min(100, metric.value))}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:w-56">
        {progress ? (
          <div className="space-y-1.5">
            <p className="text-muted-foreground truncate font-mono text-[10px] tracking-wider">
              {progress.label}
            </p>
            <Progress value={progress.total ? (progress.done / progress.total) * 100 : 5} />
          </div>
        ) : null}

        <Button className="w-full" onClick={onAdvance} disabled={advanceDisabled || busy}>
          {busy ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {advanceLabel}
          {!busy ? <MoveRight data-icon="inline-end" /> : null}
        </Button>
      </div>
    </div>
  );
}

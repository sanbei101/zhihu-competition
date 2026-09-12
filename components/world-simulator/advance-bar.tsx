"use client";

import { Loader2, MoveRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

/**
 * 底部的唯一动作条。
 *
 * 只有一个按钮和推演进度 —— 世界怎么样,交给卡牌与编年史去讲,
 * 这里只负责让玩家随时能把时间往前推。
 */
export function AdvanceBar({
  onAdvance,
  advanceLabel,
  advanceDisabled,
  busy,
  progress,
}: {
  onAdvance: () => void;
  advanceLabel: string;
  advanceDisabled: boolean;
  busy: boolean;
  /** 推演过程中的实时进度。为空表示空闲 */
  progress: { label: string; done: number; total: number } | null;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-5">
      <div className="flex shrink-0 flex-col gap-2 sm:w-64">
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

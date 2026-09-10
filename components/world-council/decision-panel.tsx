"use client";

import { Check, Flag, LoaderCircle, ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MAX_ROUNDS, type TurnReactionRecord } from "@/lib/world-ending";
import { type DecisionOption, type RoundOptions } from "@/lib/world-options";

interface DecisionPanelProps {
  ended: boolean;
  currentTurnSettled: boolean;
  submittedDecision: string;
  isGeneratingOptions: boolean;
  options: RoundOptions | null;
  optionsError: string;
  onRetryOptions: () => void;
  choiceDisabled: boolean;
  onChooseOption: (option: DecisionOption) => void;
  isResolving: boolean;
  reactions: TurnReactionRecord[];
  agentCount: number;
  isJudging: boolean;
  judgeError: string;
  onRetryJudge: () => void;
  isTurnComplete: boolean;
  round: number;
  turnsCount: number;
  onStartNextRound: () => void;
  canCloseVoluntarily: boolean;
  onCloseVoluntarily: () => void;
  onGoFinale: () => void;
  turnError: string;
}

export function DecisionPanel({
  ended,
  currentTurnSettled,
  submittedDecision,
  isGeneratingOptions,
  options,
  optionsError,
  onRetryOptions,
  choiceDisabled,
  onChooseOption,
  isResolving,
  reactions,
  agentCount,
  isJudging,
  judgeError,
  onRetryJudge,
  isTurnComplete,
  round,
  turnsCount,
  onStartNextRound,
  canCloseVoluntarily,
  onCloseVoluntarily,
  onGoFinale,
  turnError,
}: DecisionPanelProps) {
  return (
    <div className="border-t p-4 sm:p-5">
      {!ended && !currentTurnSettled && !submittedDecision ? (
        <div aria-live="polite">
          {isGeneratingOptions ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-24" />
              ))}
            </div>
          ) : null}
          {optionsError ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-destructive text-xs" role="alert">
                {optionsError}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={onRetryOptions}>
                重试生成选项
              </Button>
            </div>
          ) : null}
          {options && !isGeneratingOptions ? (
            <div className="space-y-3">
              <p className="text-sm leading-7">{options.situation}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {options.options.map((option, index) => (
                  <Button
                    key={option.id}
                    type="button"
                    variant="outline"
                    disabled={choiceDisabled}
                    onClick={() => onChooseOption(option)}
                    className="h-auto flex-col items-start gap-1 p-4 text-left"
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="bg-primary text-primary-foreground grid size-5 shrink-0 place-items-center rounded font-mono text-[11px]">
                        {["A", "B", "C", "D"][index] ?? index + 1}
                      </span>
                      <span className="font-medium">{option.title}</span>
                      <Badge variant="secondary" className="ml-auto shrink-0">
                        {option.risk}
                      </Badge>
                    </span>
                    <span className="text-muted-foreground text-xs leading-5 font-normal whitespace-normal">
                      {option.desc}
                    </span>
                  </Button>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">点选其一即提交,不可更改</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {isResolving ? (
        <div
          className="text-muted-foreground mt-3 flex items-center gap-2 text-xs"
          aria-live="polite"
        >
          <LoaderCircle className="size-3.5 animate-spin" />
          已收到 {reactions.length} / {agentCount} 条回应
        </div>
      ) : null}
      {isJudging ? (
        <div
          className="text-muted-foreground mt-3 flex items-center gap-2 text-xs"
          aria-live="polite"
        >
          <LoaderCircle className="size-3.5 animate-spin" />
          各方表态收齐,正在裁决世界走向……
        </div>
      ) : null}
      {judgeError ? (
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
          <p className="text-destructive text-xs" role="alert">
            {judgeError}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={onRetryJudge}>
            重试裁决
          </Button>
        </div>
      ) : null}
      {isTurnComplete && !ended && !isJudging && !judgeError ? (
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
          <div className="flex items-center gap-2 text-xs text-emerald-700">
            <Check className="size-3.5" />
            本回合已裁决
            {round >= MAX_ROUNDS ? "" : `(已演 ${turnsCount} / ${MAX_ROUNDS} 回合)`}
          </div>
          {round < MAX_ROUNDS ? (
            <Button type="button" variant="outline" size="sm" onClick={onStartNextRound}>
              开始下一回合
            </Button>
          ) : null}
          {canCloseVoluntarily ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCloseVoluntarily}>
              <Flag data-icon="inline-start" />
              收束世界线
            </Button>
          ) : null}
        </div>
      ) : null}
      {ended ? (
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
          <Button type="button" size="sm" onClick={onGoFinale}>
            <ScrollText data-icon="inline-start" />
            查看终章结算
          </Button>
        </div>
      ) : null}
      {turnError ? (
        <p className="text-destructive mt-3 text-xs" role="alert">
          {turnError}(可直接重选其一重试)
        </p>
      ) : null}
    </div>
  );
}

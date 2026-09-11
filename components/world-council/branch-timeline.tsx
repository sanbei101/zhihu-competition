"use client";

import { Check, Flag, GitFork } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { endingLabels, type TurnRecord, type WorldEnding } from "@/lib/world-ending";
import type { DecisionOption, RoundOptions } from "@/lib/world-options";

interface BranchTimelineProps {
  round: number;
  turns: TurnRecord[];
  options: RoundOptions | null;
  submittedBranch: DecisionOption | null;
  ended: boolean;
  ending: WorldEnding | null;
  choiceDisabled: boolean;
  onChooseOption: (option: DecisionOption) => void;
}

const branchLetters = ["A", "B", "C", "D"];

function branchLabel(branchId: string | undefined): string {
  if (!branchId) return "历史回合";
  return branchId === "idle" ? "停驻" : `分支 ${branchId.toUpperCase()}`;
}

export function BranchTimeline({
  round,
  turns,
  options,
  submittedBranch,
  ended,
  ending,
  choiceDisabled,
  onChooseOption,
}: BranchTimelineProps) {
  const showCurrentFork = Boolean(options && !submittedBranch && !ended);

  return (
    <Card className="shadow-none">
      <CardHeader className="border-b">
        <div className="flex items-start gap-3">
          <GitFork className="text-primary mt-0.5 size-5 shrink-0" />
          <div>
            <CardTitle>世界线时间线</CardTitle>
            <p className="text-muted-foreground mt-1 text-xs leading-5">
              每次抉择都会留下一个分叉。这里记录你已经走过的主线,以及眼前可以进入的未来。
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 sm:p-8">
        {!turns.length && !showCurrentFork && !submittedBranch ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            第一处分叉正在生成,稍后会出现在这里。
          </p>
        ) : (
          <div className="before:bg-border relative space-y-8 before:absolute before:inset-y-3 before:left-3 before:w-px sm:before:left-4">
            {turns.map((turn) => (
              <div key={`branch-turn-${turn.round}`} className="relative pl-9 sm:pl-11">
                <span className="bg-primary text-primary-foreground absolute top-0 left-0 grid size-6 place-items-center rounded-full font-mono text-[11px] sm:size-8 sm:text-xs">
                  {turn.round}
                </span>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">第 {turn.round} 回合</span>
                    <Badge variant="secondary">{branchLabel(turn.branchId)}</Badge>
                    <Badge variant="outline" className="text-emerald-700">
                      <Check data-icon="inline-start" />
                      已写入主线
                    </Badge>
                  </div>
                  <div className="border-border bg-muted/40 rounded-md border px-4 py-3">
                    <p className="leading-6 font-medium">
                      {turn.branchTitle ?? turn.decision.split(":")[0]}
                    </p>
                    <p className="text-muted-foreground mt-1 line-clamp-3 text-xs leading-5">
                      {turn.decision}
                    </p>
                  </div>
                  {turn.branchOptions && turn.branchOptions.length > 1 ? (
                    <div className="border-border ml-3 border-l pl-4">
                      <p className="text-muted-foreground mb-2 text-xs">当时未选择的未来</p>
                      <div className="grid gap-2 md:grid-cols-3">
                        {turn.branchOptions
                          .filter((option) => option.id !== turn.branchId)
                          .map((option) => (
                            <div
                              key={option.id}
                              className="border-border/80 bg-background/70 min-w-0 rounded-md border border-dashed p-3"
                            >
                              <div className="flex items-start gap-2">
                                <span className="text-muted-foreground shrink-0 font-mono text-xs">
                                  {option.id.toUpperCase()}
                                </span>
                                <p className="min-w-0 flex-1 text-xs leading-5 font-medium">
                                  {option.title}
                                </p>
                                <Badge variant="outline" className="shrink-0">
                                  {option.risk}
                                </Badge>
                              </div>
                              <p className="text-muted-foreground mt-2 line-clamp-3 text-xs leading-5">
                                {option.desc}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {submittedBranch && !ended ? (
              <div className="relative pl-9 sm:pl-11">
                <span className="border-primary text-primary bg-background absolute top-0 left-0 grid size-6 place-items-center rounded-full border-2 font-mono text-[11px] sm:size-8 sm:text-xs">
                  {submittedBranch.id === "idle" ? "·" : submittedBranch.id.toUpperCase()}
                </span>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">第 {round} 回合</span>
                    <Badge variant="outline">正在推演</Badge>
                    <Badge variant="secondary">{branchLabel(submittedBranch.id)}</Badge>
                  </div>
                  <div className="border-primary/30 bg-primary/5 rounded-md border px-4 py-3">
                    <p className="leading-6 font-medium">{submittedBranch.title}</p>
                    <p className="text-muted-foreground mt-1 text-xs leading-5">
                      Agent 正在根据这条分支推演后果。
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {showCurrentFork && options ? (
              <div className="relative pl-9 sm:pl-11">
                <span className="bg-primary text-primary-foreground absolute top-0 left-0 grid size-6 place-items-center rounded-full sm:size-8">
                  <GitFork className="size-3.5 sm:size-4" />
                </span>
                <div className="space-y-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">第 {round} 回合分叉点</span>
                      <Badge variant="outline">选择一条未来</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs leading-5">
                      {options.situation}
                    </p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {options.options.map((option, index) => (
                      <Button
                        key={option.id}
                        type="button"
                        variant="outline"
                        disabled={choiceDisabled}
                        onClick={() => onChooseOption(option)}
                        className="h-auto min-w-0 flex-col items-start gap-2 p-4 text-left whitespace-normal"
                      >
                        <span className="flex w-full min-w-0 items-start gap-2">
                          <span className="bg-primary text-primary-foreground grid size-6 shrink-0 place-items-center rounded font-mono text-xs">
                            {branchLetters[index] ?? index + 1}
                          </span>
                          <span className="min-w-0 flex-1 font-medium break-words">
                            {option.title}
                          </span>
                          <Badge variant="secondary" className="shrink-0">
                            {option.risk}
                          </Badge>
                        </span>
                        <span className="text-muted-foreground pl-8 text-xs leading-5">
                          {option.desc}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {ended && ending ? (
              <div className="relative pl-9 sm:pl-11">
                <span className="absolute top-0 left-0 grid size-6 place-items-center rounded-full bg-emerald-600 text-white sm:size-8">
                  <Flag className="size-3.5 sm:size-4" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">世界线终局</span>
                    <Badge variant="secondary">{endingLabels[ending.type]}</Badge>
                  </div>
                  <div className="border-border bg-muted/40 mt-2 rounded-md border px-4 py-3">
                    <p className="leading-6 font-medium">{ending.title}</p>
                    <p className="text-muted-foreground mt-1 text-xs leading-5">{ending.reason}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

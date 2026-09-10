"use client";

import { Activity, Check, GitBranch } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type WorldCast } from "@/lib/world-cast";
import {
  MAX_ROUNDS,
  metricKeys,
  metricLabels,
  type MetricDeltas,
  type TurnReactionRecord,
  type WorldGameSession,
  type WorldMetrics,
} from "@/lib/world-ending";

interface WorldTabsProps {
  cast: WorldCast;
  activePlayer: WorldCast["playerCharacters"][number];
  metrics: WorldMetrics;
  lastDeltas: MetricDeltas | null;
  turns: WorldGameSession["turns"];
  reactions: TurnReactionRecord[];
  submittedDecision: string;
  currentTurnSettled: boolean;
  isTurnComplete: boolean;
}

export function WorldTabs({
  cast,
  activePlayer,
  metrics,
  lastDeltas,
  turns,
  reactions,
  submittedDecision,
  currentTurnSettled,
  isTurnComplete,
}: WorldTabsProps) {
  return (
    <Card className="order-3 shadow-none">
      <Tabs defaultValue="world">
        <CardHeader className="border-b">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="world">
              <Activity data-icon="inline-start" />
              世界状态
            </TabsTrigger>
            <TabsTrigger value="round">
              <GitBranch data-icon="inline-start" />
              回合进程
            </TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent>
          <TabsContent value="world" className="space-y-6">
            {metricKeys.map((key) => {
              const delta = lastDeltas?.[key] ?? 0;
              const showDelta = turns.length > 0 && delta !== 0;
              return (
                <Progress key={key} value={metrics[key]}>
                  <ProgressLabel>{metricLabels[key]}</ProgressLabel>
                  <ProgressValue>
                    {() => (
                      <>
                        {metrics[key]}
                        {showDelta ? (
                          <span
                            className={
                              delta > 0 ? "ml-1 text-emerald-600" : "text-destructive ml-1"
                            }
                          >
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        ) : null}
                      </>
                    )}
                  </ProgressValue>
                </Progress>
              );
            })}
            <Separator />
            <div>
              <p className="text-muted-foreground text-xs">当前身份</p>
              <p className="mt-1 font-medium">{activePlayer.identity}</p>
              <p className="text-muted-foreground mt-2 text-xs leading-5">
                {activePlayer.decisionPower}
              </p>
            </div>
            <Separator />
            <div>
              <p className="text-muted-foreground text-xs">世界硬约束</p>
              <ul className="mt-2 space-y-2 text-xs leading-5">
                {cast.setting.rules.map((rule) => (
                  <li key={rule} className="flex gap-2">
                    <span className="text-primary">·</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>
          </TabsContent>
          <TabsContent value="round">
            <ol className="space-y-5 text-sm">
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="size-3.5" />
                </span>
                <div>
                  <p className="font-medium">事件公布</p>
                  <p className="text-muted-foreground mt-1 text-xs">危机进入所有角色视野</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span
                  className={
                    submittedDecision || currentTurnSettled
                      ? "grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"
                      : "bg-primary text-primary-foreground grid size-6 shrink-0 place-items-center rounded-full font-mono text-xs"
                  }
                >
                  {submittedDecision || currentTurnSettled ? <Check className="size-3.5" /> : 2}
                </span>
                <div>
                  <p className="font-medium">玩家决策</p>
                  <p className="text-muted-foreground mt-1 text-xs">从四个选项中做出抉择</p>
                </div>
              </li>
              {[
                { label: "Agent 行动", done: reactions.length > 0 || currentTurnSettled },
                { label: "公开事件", done: isTurnComplete },
                { label: "冲突裁决", done: isTurnComplete },
                { label: "世界更新", done: isTurnComplete },
              ].map((step, index) => (
                <li
                  key={step.label}
                  className={step.done ? "flex gap-3" : "text-muted-foreground flex gap-3"}
                >
                  <span
                    className={
                      step.done
                        ? "grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"
                        : "bg-muted grid size-6 shrink-0 place-items-center rounded-full font-mono text-xs"
                    }
                  >
                    {step.done ? <Check className="size-3.5" /> : index + 3}
                  </span>
                  <p className="pt-0.5">{step.label}</p>
                </li>
              ))}
              <li className="text-muted-foreground flex gap-3">
                <span className="bg-muted grid size-6 shrink-0 place-items-center rounded-full font-mono text-xs">
                  终
                </span>
                <div className="pt-0.5">
                  <p>终章结算({MAX_ROUNDS} 回合或提前终局)</p>
                  <p className="mt-1 text-xs">
                    已演 {turns.length} / {MAX_ROUNDS} 回合
                  </p>
                </div>
              </li>
            </ol>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}

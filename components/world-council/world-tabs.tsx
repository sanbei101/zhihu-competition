"use client";

import { Activity, Check, GitBranch, TrendingDown, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type WorldCast } from "@/lib/world-cast";
import {
  attitudeHints,
  attitudeLabels,
  entropyForRound,
  entropyNoteForRound,
  metricKeys,
  metricLabels,
  pressureLabels,
  pressureLevel,
  relationOf,
  type AgentRelation,
  type AppliedDeltas,
  type MetricDeltas,
  type RetortRecord,
  type TurnReactionRecord,
  type WorldCrisis,
  type WorldGameSession,
  type WorldMetrics,
  type WorldUltimatum,
} from "@/lib/world-ending";

interface WorldTabsProps {
  cast: WorldCast;
  activePlayer: WorldCast["playerCharacters"][number];
  metrics: WorldMetrics;
  lastDeltas: AppliedDeltas | null;
  lastEntropy: AppliedDeltas | null;
  lastCrisisPenalty: AppliedDeltas | null;
  round: number;
  turns: WorldGameSession["turns"];
  relations: AgentRelation[];
  reactions: TurnReactionRecord[];
  retorts: RetortRecord[];
  submittedDecision: string;
  currentTurnSettled: boolean;
  isTurnComplete: boolean;
  crisis: WorldCrisis | null;
  ultimatum: WorldUltimatum | null;
}

const attitudeTone = {
  loyal: "border-emerald-500/60 bg-emerald-100 text-emerald-700",
  wary: "border-border bg-muted text-muted-foreground",
  pressuring: "border-amber-500/60 bg-amber-100 text-amber-800",
  defected: "border-red-500/60 bg-red-100 text-red-700",
} as const;

function deltaText(deltas: MetricDeltas | AppliedDeltas | null): string {
  if (!deltas) return "";
  return metricKeys
    .filter((key) => deltas[key] !== 0)
    .map((key) => `${metricLabels[key]}${deltas[key] > 0 ? `+${deltas[key]}` : deltas[key]}`)
    .join(" · ");
}

export function WorldTabs({
  cast,
  activePlayer,
  metrics,
  lastDeltas,
  lastEntropy,
  lastCrisisPenalty,
  round,
  turns,
  relations,
  reactions,
  retorts,
  submittedDecision,
  currentTurnSettled,
  isTurnComplete,
  crisis,
  ultimatum,
}: WorldTabsProps) {
  const pressure = pressureLevel(metrics);
  const entropy = entropyForRound(round);
  const entropyText = deltaText(lastEntropy);
  const penaltyText = deltaText(lastCrisisPenalty);

  return (
    <Card className="order-3 shadow-none">
      <Tabs defaultValue="world">
        <CardHeader className="border-b">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="world">
              <Activity data-icon="inline-start" />
              世界
            </TabsTrigger>
            <TabsTrigger value="relations">
              <Users data-icon="inline-start" />
              关系
            </TabsTrigger>
            <TabsTrigger value="round">
              <GitBranch data-icon="inline-start" />
              进程
            </TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent>
          <TabsContent value="world" className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={pressure === "stable" ? "secondary" : "destructive"}>
                {pressureLabels[pressure]}
              </Badge>
              {entropy > 0 ? (
                <Badge variant="outline" className="gap-1">
                  <TrendingDown className="size-3" />
                  每回合大势流失约 {entropy}
                </Badge>
              ) : null}
            </div>

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

            {entropyText || penaltyText ? (
              <p className="text-muted-foreground text-xs leading-5">
                上一回合的账：
                {entropyText ? `大势流失 ${entropyText}` : null}
                {entropyText && penaltyText ? " · " : null}
                {penaltyText ? `突发事件逾期 ${penaltyText}` : null}
              </p>
            ) : null}

            {crisis ? (
              <div className="border-destructive/40 bg-destructive/5 rounded-md border p-3">
                <p className="text-xs font-medium">{crisis.title}</p>
                <p className="text-muted-foreground mt-1 text-xs leading-5">
                  {crisis.roundsLeft > 0
                    ? `还剩 ${crisis.roundsLeft} 回合到期`
                    : "已逾期,每回合持续扣减指标"}
                </p>
              </div>
            ) : null}

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
              <p className="text-muted-foreground text-xs">你的私密目标</p>
              <p className="mt-1 text-xs leading-5">{activePlayer.privateGoal}</p>
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

          <TabsContent value="relations" className="space-y-5">
            <p className="text-muted-foreground text-xs leading-5">
              每次抉择都会被在场的人记在账上。信任跌破 20 他会开始离心,跌破 10 他会自己动手。
            </p>
            {cast.agentCharacters.map((character) => {
              const relation = relationOf(relations, character.id);
              const trust = relation?.trust ?? 52;
              const attitude = relation?.attitude ?? "wary";
              return (
                <div key={character.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{character.name}</span>
                    <Badge
                      variant="outline"
                      className={`ml-auto px-1.5 ${attitudeTone[attitude]}`}
                    >
                      {attitudeLabels[attitude]}
                    </Badge>
                  </div>
                  <Progress value={trust}>
                    <ProgressLabel className="text-muted-foreground text-xs font-normal">
                      信任
                    </ProgressLabel>
                    <ProgressValue className="text-xs">{() => trust}</ProgressValue>
                  </Progress>
                  <p className="text-muted-foreground text-xs leading-5">
                    {attitudeHints[attitude]}
                    {ultimatum?.agentId === character.id ? " · 已向你下最后通牒" : ""}
                  </p>
                  <Separator />
                </div>
              );
            })}
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
                  <p className="text-muted-foreground mt-1 text-xs">
                    从选项里做出抉择,或按兵不动
                  </p>
                </div>
              </li>
              {[
                { label: "各方表态", done: reactions.length > 0 || currentTurnSettled },
                { label: "当面对峙", done: retorts.length > 0 || currentTurnSettled },
                { label: "事件与裁决", done: isTurnComplete },
                { label: "信任与突发事件结算", done: isTurnComplete },
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
              <li className="flex gap-3">
                <span className="bg-primary text-primary-foreground grid size-6 shrink-0 place-items-center rounded-full font-mono text-xs">
                  ↻
                </span>
                <div className="pt-0.5">
                  <p className="font-medium">回合没有上限</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">
                    已演 {turns.length} 回合。演满 3 回合后你可以随时收束;拖得越久,大势损耗越快。
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">
                    {entropyNoteForRound(round + 1)}
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

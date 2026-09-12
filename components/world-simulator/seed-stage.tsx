"use client";

import { AlertCircle, Loader2, RotateCcw } from "lucide-react";

import { EntityEmblem } from "@/components/pixel/entity-emblem-view";
import { StageBackdrop } from "@/components/pixel/theme-stage";
import { witnessArchetypeFor } from "@/components/pixel/witness";
import { WitnessFigure } from "@/components/pixel/witness-figure";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { seedProgressPercent } from "@/components/world-simulator/progress";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import {
  timeScaleLabels,
  type CounterfactualPremise,
  type HardRule,
  type TimeScale,
  type TimeState,
  type WitnessLine,
  type WorldEntity,
} from "@/lib/world-sim";

/**
 * 世界成形中。
 *
 * 顺序是刻意的:见证者先出场,世界再从他身后长出来。
 * 反过来(先看一堆数据,最后冒出来一个人)就完全没有"有人陪着你"的感觉了。
 *
 * 这一屏只活几秒,但它决定了玩家对整局的第一印象,所以它值得有一个自己的像素舞台。
 */
export function SeedStage({
  skin,
  themeName,
  themeId,
  phase,
  witness,
  premise,
  startTime,
  timeScale,
  hardRules,
  entities,
  error,
  onRetry,
}: {
  skin: ScenarioSkin;
  themeName: string;
  themeId: string;
  phase: "connecting" | "building" | "error";
  witness: WitnessLine | null;
  premise: CounterfactualPremise | null;
  startTime: TimeState | null;
  timeScale: TimeScale | null;
  hardRules: HardRule[];
  entities: WorldEntity[];
  error: string;
  onRetry: () => void;
}) {
  const percent = seedProgressPercent({ premise, hardRules, entities });
  const archetype = witnessArchetypeFor(themeId);

  return (
    <section className="relative min-h-[32rem] overflow-hidden rounded-lg border">
      <StageBackdrop skin={skin} />

      <div className="relative flex min-h-[32rem] flex-col items-center justify-center gap-8 px-6 py-12">
        {/* 见证者先出场 */}
        <div className="flex flex-col items-center gap-4">
          <WitnessFigure
            archetype={archetype}
            skin={skin}
            label={witness?.speaker ?? "见证者"}
            speaking={Boolean(witness)}
            scale={6}
          />

          {witness ? (
            <div className="max-w-md text-center">
              <p className="text-muted-foreground font-mono text-[10px] tracking-widest">
                {witness.speaker}
              </p>
              <p className="mt-2 text-sm leading-7">{witness.line}</p>
            </div>
          ) : (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-3.5 animate-spin" />
              正在找一个能替你看住这条世界线的人
            </p>
          )}
        </div>

        {/* 世界正在从他身后成形 */}
        <Card className="w-full max-w-xl shadow-none">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="secondary">{themeName}</Badge>
              {timeScale ? (
                <span className="text-muted-foreground font-mono text-[11px]">
                  时间尺度 · {timeScaleLabels[timeScale]}
                </span>
              ) : null}
            </div>

            {phase === "error" ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>世界没能搭起来</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              <>
                <Progress value={percent} />

                {premise ? (
                  <div className="space-y-1.5">
                    <p className="text-muted-foreground font-mono text-[10px] tracking-widest">
                      反事实原点
                    </p>
                    <p className="text-sm leading-6 font-medium">{premise.statement}</p>
                    <p className="text-muted-foreground text-xs leading-6">
                      改动发生在{premise.divergencePoint}
                    </p>
                  </div>
                ) : null}

                {hardRules.length ? (
                  <div className="space-y-1">
                    <p className="text-muted-foreground font-mono text-[10px] tracking-widest">
                      这个世界无法违背的事
                    </p>
                    {hardRules.slice(0, 4).map((rule) => (
                      <p key={rule.id} className="text-muted-foreground text-xs leading-6">
                        · {rule.statement}
                      </p>
                    ))}
                  </div>
                ) : null}

                {entities.length ? (
                  <div className="space-y-2">
                    <p className="text-muted-foreground font-mono text-[10px] tracking-widest">
                      台上会有 {entities.length} 股力量
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {entities.map((entity) => (
                        <span
                          key={entity.id}
                          className="bg-muted/40 animate-in fade-in zoom-in-95 flex items-center gap-1.5 rounded-sm border px-2 py-1"
                        >
                          <EntityEmblem entity={entity} skin={skin} scale={2} />
                          <span className="text-xs">{entity.name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {startTime ? (
                  <p className="text-muted-foreground font-mono text-[11px]">
                    起点 · {startTime.label}({startTime.elapsed})
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {phase === "error" ? (
          <Button onClick={onRetry}>
            <RotateCcw data-icon="inline-start" />
            再试一次
          </Button>
        ) : null}
      </div>
    </section>
  );
}

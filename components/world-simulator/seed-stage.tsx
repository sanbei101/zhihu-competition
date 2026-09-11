"use client";

import { LoaderCircle, Sparkles } from "lucide-react";

import { EntityEmblem } from "@/components/pixel/entity-emblem-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { seedProgressPercent } from "@/components/world-simulator/progress";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import {
  hardRuleScopeLabels,
  timeScaleLabels,
  type CounterfactualPremise,
  type GlobalMetric,
  type HardRule,
  type TimeScale,
  type TimeState,
  type WorldEntity,
} from "@/lib/world-sim";

/**
 * 世界构建中。
 *
 * 这是 /api/world-seed 流式事件的可视化:前提先落地,再是硬约束,
 * 然后主体一个接一个站到舞台上,最后指标与初始事件补齐。
 *
 * 之所以专门做这个界面:直接甩一个转圈,玩家会以为程序卡死;
 * 而把"世界怎么被推出来"的过程本身演出来,正好是这个作品要卖的东西。
 */
export function SeedStage({
  skin,
  themeName,
  phase,
  premise,
  startTime,
  timeScale,
  hardRules,
  entities,
  announcedIds,
  globalMetrics,
  error,
  onRetry,
}: {
  skin: ScenarioSkin;
  themeName: string;
  phase: "connecting" | "building" | "error";
  premise: CounterfactualPremise | null;
  startTime: TimeState | null;
  timeScale: TimeScale | null;
  hardRules: HardRule[];
  entities: WorldEntity[];
  announcedIds: string[];
  globalMetrics: GlobalMetric[];
  error: string;
  onRetry: () => void;
}) {
  const percent = seedProgressPercent({ premise, hardRules, entities, globalMetrics });

  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{skin.name}</Badge>
          <Badge variant="outline">{themeName}</Badge>
          {phase === "error" ? (
            <Badge variant="destructive">构建中断</Badge>
          ) : (
            <Badge>
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
              {phase === "connecting" ? "正在接入推演引擎" : "正在构建世界"}
            </Badge>
          )}
        </div>
        <CardTitle className="pt-3 text-xl">世界线正在成形</CardTitle>
        <CardDescription>
          反事实前提先被钉死,随后硬约束落地,各主体依次登场。任何一条都不可违背。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 反事实前提 */}
        <section className="space-y-2">
          <p className="text-muted-foreground text-xs">反事实前提</p>
          {premise ? (
            <>
              <p className="text-sm leading-6">{premise.statement}</p>
              <p className="text-muted-foreground text-xs">分岔点 · {premise.divergencePoint}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {premise.affectedDomains.map((domain) => (
                  <Badge key={domain} variant="outline">
                    {domain}
                  </Badge>
                ))}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">正在推导唯一被改动的那个条件……</p>
          )}
        </section>

        {startTime && timeScale ? (
          <>
            <Separator />
            <section className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground text-xs">起算</span>
              <Badge variant="outline">{startTime.label}</Badge>
              <span className="text-muted-foreground text-xs">{startTime.elapsed}</span>
              <Badge variant="secondary">默认尺度 · {timeScaleLabels[timeScale]}</Badge>
            </section>
          </>
        ) : null}

        {hardRules.length ? (
          <>
            <Separator />
            <section className="space-y-2">
              <p className="text-muted-foreground text-xs">
                世界硬约束({hardRules.length})· 违背者一律判定失败
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {hardRules.map((rule) => (
                  <div key={rule.id} className="rounded-md border p-2.5">
                    <Badge variant="outline">{hardRuleScopeLabels[rule.scope]}</Badge>
                    <p className="mt-1.5 text-xs leading-5">{rule.statement}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {entities.length ? (
          <>
            <Separator />
            <section className="space-y-2">
              <p className="text-muted-foreground text-xs">登场主体({entities.length})</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {entities.map((entity) => (
                  <div
                    key={entity.id}
                    className={`flex items-start gap-2.5 rounded-md border p-2.5 ${
                      announcedIds.includes(entity.id) ? "" : "opacity-60"
                    }`}
                  >
                    <EntityEmblem entity={entity} skin={skin} scale={2} className="mt-0.5" />
                    <div className="min-w-0">
                      <span className="truncate text-sm font-medium">{entity.name}</span>
                      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs leading-5">
                        {entity.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {globalMetrics.length ? (
          <>
            <Separator />
            <section className="space-y-2">
              <p className="text-muted-foreground text-xs">全局指标口径</p>
              <div className="flex flex-wrap gap-1.5">
                {globalMetrics.map((metric) => (
                  <span
                    key={metric.id}
                    className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[0.7rem]"
                  >
                    {metric.label} · {metric.value}
                  </span>
                ))}
              </div>
            </section>
          </>
        ) : null}

        <div className="border-border space-y-2 border-t pt-4">
          <Progress value={percent} />
          <p className="text-muted-foreground text-xs">
            {phase === "error" ? error : `构建进度 ${percent}%`}
          </p>
        </div>

        {phase === "error" ? (
          <Button onClick={onRetry}>
            <Sparkles data-icon="inline-start" />
            重新构建这个世界
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

"use client";

import { Check, Loader2, Radio, ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WorldEntity } from "@/lib/world-sim";

export interface SimulationViewState {
  phase: "idle" | "entities" | "adjudicating";
  startedIds: string[];
  intents: { entityId: string; intent: string }[];
  worldEvents: string[];
  errors: string[];
}

export function SimulationView({
  entities,
  phase,
  startedIds,
  intents,
  worldEvents,
  errors,
}: {
  entities: WorldEntity[];
  phase: "idle" | "entities" | "adjudicating";
  startedIds: string[];
  intents: { entityId: string; intent: string }[];
  worldEvents: string[];
  errors: string[];
}) {
  const adjudicating = phase === "adjudicating";
  const intentMap = new Map(intents.map((item) => [item.entityId, item.intent]));

  return (
    <div className="space-y-4">
      {/* 阶段横幅 */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary" className="font-mono text-[10px] tracking-widest">
          <Loader2
            className={cn("size-3", !adjudicating && "animate-spin")}
            data-icon="inline-start"
          />
          {adjudicating ? "裁决中" : "主体各自盘算"}
        </Badge>
        <p className="text-muted-foreground text-xs leading-6">
          {adjudicating
            ? "历史正在合并这些彼此的算计 —— 谁赢、谁输、代价落在哪儿。"
            : "每个主体都在按自己的目标盘算这一阶段要做什么,它们互相看不见。"}
        </p>
      </div>

      {/* 主体面板网格 */}
      <Card className="shadow-none">
        <CardHeader className="p-4 sm:p-5">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Radio className="text-primary size-4" data-icon="inline-start" />
            世界上的力量
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 px-4 pb-4 sm:grid-cols-2 sm:px-5 sm:pb-5 lg:grid-cols-3">
          {entities.map((entity) => {
            const started = startedIds.includes(entity.id);
            const intent = intentMap.get(entity.id);

            return (
              <div
                key={entity.id}
                className={cn(
                  "border-border rounded-md border px-3 py-2.5 transition-colors",
                  intent && "bg-chart-2/10 border-chart-2/30",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-block size-2 shrink-0 rounded-full",
                      !started && "bg-muted-foreground/30",
                      started && !intent && "bg-amber-500 animate-pulse",
                      intent && "bg-chart-2",
                    )}
                  />
                  <span className="truncate text-sm font-medium">{entity.name}</span>
                  {intent ? <Check className="text-chart-2 ml-auto size-3 shrink-0" /> : null}
                </div>
                <p
                  className={cn(
                    "text-muted-foreground mt-1 line-clamp-2 min-h-8 text-xs leading-4",
                    !intent && "opacity-40",
                  )}
                >
                  {intent ?? (started ? "盘算中…" : "待命")}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 事件流:裁决开始后,这一阶段的历史一条条长出来 */}
      {adjudicating ? (
        <Card className="shadow-none">
          <CardHeader className="p-4 sm:p-5">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ScrollText className="text-primary size-4" data-icon="inline-start" />
              历史在成形
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
            {worldEvents.length ? (
              <ol className="space-y-2">
                {worldEvents.map((summary, index) => (
                  <li
                    key={index}
                    className="animate-in fade-in slide-in-from-bottom-1 flex gap-3 text-xs leading-6 duration-300"
                  >
                    <span className="text-primary mt-2 size-1.5 shrink-0 rounded-full" />
                    <span className="text-muted-foreground">{summary}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground animate-pulse text-xs leading-6">
                裁决者正在把五条事件定稿……
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {errors.length ? (
        <p className="text-destructive text-xs leading-6">
          有 {errors.length} 个主体失联,世界按还没想好的部分继续走。
        </p>
      ) : null}
    </div>
  );
}

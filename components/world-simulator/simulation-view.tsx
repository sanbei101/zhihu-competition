"use client";

import { Check, Loader2, Radio, ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WitnessLine, WorldEntity, WorldEvent } from "@/lib/world-sim";

/**
 * 「世界演算室」—— 玩家翻完牌、世界开始连续推演时,替换牌桌的 Gen UI。
 *
 * 一次裁决是一整段级联历史(3-5 段 beats),这里把它渲染成一条时间线:
 * 主体各自盘算(意图逐条亮出)→ 历史逐段成形(事件卡长出来 + 见证者冒泡)。
 */

export interface SimulationViewBeat {
  era: number;
  spanLabel: string;
  timeLabel: string;
  events: {
    title: string;
    severity: WorldEvent["severity"];
    scope: WorldEvent["scope"];
    summary: string;
    narrator: WitnessLine | null;
  }[];
}

export interface SimulationViewState {
  phase: "idle" | "entities" | "adjudicating";
  startedIds: string[];
  intents: { entityId: string; intent: string }[];
  beats: SimulationViewBeat[];
  errors: string[];
}

const SEVERITY_BAR: Record<WorldEvent["severity"], string> = {
  critical: "bg-red-500",
  severe: "bg-blue-500",
  notable: "bg-emerald-500",
  info: "bg-muted-foreground/40",
};

const SCOPE_LABELS: Record<WorldEvent["scope"], string> = {
  global: "全球",
  regional: "区域",
  entity: "主体内部",
  natural: "自然",
};

export function SimulationView({
  entities,
  phase,
  startedIds,
  intents,
  beats,
  errors,
}: {
  entities: WorldEntity[];
  phase: "idle" | "entities" | "adjudicating";
  startedIds: string[];
  intents: { entityId: string; intent: string }[];
  beats: SimulationViewBeat[];
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
          {adjudicating ? "历史在成形" : "主体各自盘算"}
        </Badge>
        <p className="text-muted-foreground text-xs leading-6">
          {adjudicating
            ? "裁决者正把这个世界一口气往前推 —— 每一段,都是接下来某张牌的前因。"
            : "每个主体都在按自己的目标盘算这一大阶段要做什么,它们互相看不见。"}
        </p>
      </div>

      {/* 主体面板:每个主体一枚徽记 + 一句盘算中的话 */}
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

      {/* 历史长卷:裁决开始后,一整段历史逐段长出来 */}
      {adjudicating ? (
        <Card className="shadow-none">
          <CardHeader className="p-4 sm:p-5">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ScrollText className="text-primary size-4" data-icon="inline-start" />
              历史长卷
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
            {beats.length ? (
              <ol className="space-y-6">
                {beats.map((beat, index) => (
                  <li key={index} className="relative pl-5">
                    {index < beats.length - 1 ? (
                      <span className="bg-border absolute top-6 bottom-0 left-[5px] w-px" />
                    ) : null}
                    <span
                      className={cn(
                        "bg-primary absolute top-1.5 left-0 size-2.5 rounded-full",
                        index === beats.length - 1 && "animate-pulse",
                      )}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="font-mono text-[10px]">纪元 {beat.era}</Badge>
                      <span className="text-sm font-semibold">{beat.spanLabel}</span>
                      <span className="text-muted-foreground text-xs">{beat.timeLabel}</span>
                    </div>

                    <div className="mt-2 space-y-2">
                      {beat.events.map((event, eventIndex) => (
                        <div
                          key={eventIndex}
                          className="animate-in fade-in slide-in-from-bottom-1 duration-300"
                        >
                          <div className="border-border overflow-hidden rounded-md border shadow-none">
                            <div className={cn("h-1 w-full", SEVERITY_BAR[event.severity])} />
                            <div className="p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  {SCOPE_LABELS[event.scope]}
                                </Badge>
                                <span className="text-sm font-medium">{event.title}</span>
                              </div>
                              <p className="text-muted-foreground mt-1 text-xs leading-6">
                                {event.summary}
                              </p>
                              {event.narrator ? (
                                <p className="text-foreground/80 border-chart-2 mt-2 border-l-2 pl-2 text-xs leading-6">
                                  <span className="font-semibold">{event.narrator.speaker}</span>:
                                  {event.narrator.line}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-muted-foreground animate-pulse text-xs leading-6">
                裁决者正在把这一段历史推出来……
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

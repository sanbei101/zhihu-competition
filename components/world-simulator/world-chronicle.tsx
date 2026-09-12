"use client";

import { ScrollText } from "lucide-react";
import { useEffect, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SimulationViewBeat } from "@/components/world-simulator/simulation-view";
import { cn } from "@/lib/utils";
import type { EraSnapshot, WorldEvent } from "@/lib/world-sim";

/**
 * 世界编年史。
 *
 * 一列世界旁白:每段历史一条 headline(最重量级那件事),其下再挂这一段的重量级事件。
 * 这些句子不参与发牌、不做任何交互 —— 它们的作用只有一个:
 * 让玩家能**攒下**这条世界线,回头一眼看见"世界被我盯着的时候,到底变成了什么样"。
 *
 * 数据有两个来源,合成同一列:
 *   - 已经落库的快照(session.snapshots)是历史,永久留在这一列
 *   - 推演中流出的 beats 是"正在发生",暂时接在历史后面,随裁决逐段滚进来
 * 所以推演结束、快照落库后,同样的句子会从"正在发生"平滑变成历史,不会闪断。
 */

/** 只有够格进编年史的事件才挂在旁白下面。日常与波澜留给牌桌 */
function weighty(events: { title: string; severity: WorldEvent["severity"] }[]) {
  return events.filter((event) => event.severity === "severe" || event.severity === "critical");
}

interface ChronicleEntry {
  era: number;
  timeLabel: string;
  headline: string;
  lines: string[];
  live: boolean;
}

export function WorldChronicle({
  snapshots,
  streaming,
  busy,
}: {
  snapshots: EraSnapshot[];
  /** 推演中流出的段。为空表示不在推演 */
  streaming: SimulationViewBeat[];
  busy: boolean;
}) {
  const committed: ChronicleEntry[] = snapshots.map((snapshot) => ({
    era: snapshot.era,
    timeLabel: snapshot.timeAfter.label,
    headline: snapshot.headline,
    lines: weighty(snapshot.events).map((event) => event.title),
    live: false,
  }));

  const inFlight: ChronicleEntry[] = streaming.map((beat) => ({
    era: beat.era,
    timeLabel: beat.timeLabel,
    headline: beat.headline,
    lines: weighty(beat.events).map((event) => event.title),
    live: true,
  }));

  const entries = [...committed, ...inFlight];

  // 编年史按时间正序增长,新的一句总是在最下面 ——
  // 推演时要把它自动滚进视野,否则玩家会以为世界停住了。
  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (busy) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [busy, entries.length]);

  if (!entries.length && !busy) return null;

  return (
    <Card className="shadow-none">
      <CardHeader className="p-4 sm:p-5">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ScrollText className="text-primary size-4" data-icon="inline-start" />
          世界编年史
          <span className="text-muted-foreground ml-auto font-mono text-[10px] font-normal tracking-widest">
            {entries.length} 段 · 旁白
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
        {entries.length ? (
          <ol className="max-h-72 space-y-4 overflow-y-auto pr-1">
            {entries.map((entry, index) => (
              <li key={`${entry.era}-${index}`} ref={index === entries.length - 1 ? endRef : null}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    纪元 {entry.era}
                  </Badge>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {entry.timeLabel}
                  </span>
                  {entry.live ? (
                    <span className="text-primary animate-pulse font-mono text-[10px] tracking-widest">
                      正在发生
                    </span>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "mt-1 border-l-2 pl-3 text-sm leading-7",
                    entry.live ? "border-primary text-foreground" : "border-border",
                  )}
                >
                  {entry.headline}
                </p>
                {entry.lines.length ? (
                  <ul className="mt-1 space-y-0.5 pl-3">
                    {entry.lines.map((line) => (
                      <li key={line} className="text-muted-foreground text-xs leading-6">
                        · {line}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground animate-pulse text-xs leading-6">
            世界正在走出它的第一段旁白……
          </p>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EventCard } from "@/components/world-simulator/event-card";
import { WitnessDialogue } from "@/components/world-simulator/witness-dialogue";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import type { CardDelta, WorldCard } from "@/lib/world-cards";
import type { EventChoice, GlobalMetric, WitnessArchetype, WitnessLine } from "@/lib/world-sim";

/**
 * 牌桌。
 *
 * 一屏之内只有三样东西:左边那个说话的见证者、中间这一张牌、下面一行已经打过的牌。
 * 这是整套界面里唯一的交互区 —— 其余部分(舞台、指标条)都只负责让玩家知道自己站在哪。
 */

/** 打完一阶段之后的空桌:阶段结论 + 净变化,不再单独发一张"小结卡" */
function EmptyTable({ summary }: { summary: DeckSummary }) {
  return (
    <Card className="animate-in fade-in w-full shadow-none duration-500">
      <CardContent className="space-y-5 px-6 py-8 text-center">
        <div className="relative mx-auto h-16 w-12">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={`bg-muted border-border absolute inset-0 rounded-sm border ${
                index === 0
                  ? "-translate-x-2 -rotate-6"
                  : index === 1
                    ? "translate-x-1.5 rotate-3"
                    : "rotate-0"
              }`}
            />
          ))}
        </div>

        <div className="space-y-1">
          <p className="font-mono text-[11px] tracking-widest">纪元 {summary.era} · 本阶段结算</p>
          <p className="text-muted-foreground text-sm leading-7">{summary.conclusion}</p>
        </div>

        {summary.deltas.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {summary.deltas.map((delta) => (
              <div key={delta.metricId} className="bg-muted/40 rounded-sm border px-3 py-2">
                <p className="text-muted-foreground text-[11px]">{delta.label}</p>
                <p
                  className={`mt-1 font-mono text-base ${
                    delta.delta > 0 ? "text-chart-2" : "text-destructive"
                  }`}
                >
                  {delta.delta > 0 ? "+" : ""}
                  {delta.delta}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <Separator />
        <p className="text-muted-foreground text-xs leading-6">
          世界停在这里。下一步由它自己走 —— 你只需要推进时间,再看它发出什么牌。
        </p>
      </CardContent>
    </Card>
  );
}

export interface DeckSummary {
  era: number;
  conclusion: string;
  deltas: CardDelta[];
}

export function WorldDeck({
  skin,
  archetype,
  witnessLine,
  card,
  metrics,
  resolvedChoiceId,
  onChoose,
  onAction,
  actionLabel,
  onNext,
  nextLabel,
  busy,
  deckLeft,
  played,
  summary,
}: {
  skin: ScenarioSkin;
  archetype: WitnessArchetype;
  witnessLine: WitnessLine | null;
  card: WorldCard | null;
  metrics: GlobalMetric[];
  resolvedChoiceId: string | null;
  onChoose: (choice: EventChoice) => void;
  onAction: () => void;
  actionLabel: string;
  /** 结果态的出口。事件卡与分叉卡做完取舍后靠它翻页 */
  onNext: () => void;
  nextLabel: string;
  busy: boolean;
  /** 本阶段还没打的牌数。为 0 时不显示牌堆 */
  deckLeft: number;
  played: { label: string; severity: WorldCard["severity"] }[];
  summary: DeckSummary | null;
}) {
  return (
    <section className="relative space-y-4">
      {/* 牌堆指示 */}
      <div className="text-muted-foreground absolute -top-1 right-0 flex items-center gap-2 font-mono text-[10px] tracking-wider">
        {deckLeft > 0 ? (
          <>
            <span>本阶段 · 剩 {deckLeft} 张</span>
            <span className="relative inline-block h-8 w-6">
              {Array.from({ length: Math.min(3, deckLeft) }).map((_, index) => (
                <span
                  key={index}
                  className="bg-muted border-border absolute inset-0 block rounded-sm border"
                  style={{ transform: `translate(${index * 2}px, ${-index * 1.5}px)` }}
                />
              ))}
            </span>
          </>
        ) : null}
      </div>

      {/* 见证者 + 牌 */}
      <div className="flex flex-col items-stretch gap-5 lg:flex-row lg:items-start lg:justify-center">
        <WitnessDialogue skin={skin} archetype={archetype} line={witnessLine} />

        <div className="w-full max-w-xl">
          {card ? (
            <EventCard
              card={card}
              metrics={metrics}
              resolvedChoiceId={resolvedChoiceId}
              onChoose={onChoose}
              onAction={onAction}
              actionLabel={actionLabel}
              onNext={onNext}
              nextLabel={nextLabel}
              busy={busy}
            />
          ) : summary ? (
            <EmptyTable summary={summary} />
          ) : null}
        </div>
      </div>

      {/* 已经打过的牌 */}
      {played.length ? (
        <div className="flex flex-wrap justify-center gap-2">
          {played.slice(-8).map((item, index) => (
            <Badge key={`${item.label}-${index}`} variant="outline" className="font-normal">
              {item.label}
            </Badge>
          ))}
        </div>
      ) : null}
    </section>
  );
}

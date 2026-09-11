"use client";

import { ArrowLeft, GitFork, RotateCcw } from "lucide-react";

import { witnessArchetypeFor } from "@/components/pixel/witness";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MetricStrip } from "@/components/world-simulator/metric-strip";
import { WorldDeck, type DeckSummary } from "@/components/world-simulator/world-deck";
import { WorldStage } from "@/components/world-simulator/world-stage";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import type { WorldCard } from "@/lib/world-cards";
import {
  timeScaleLabels,
  type EventChoice,
  type WitnessLine,
  type WorldSimSession,
} from "@/lib/world-sim";

/**
 * 世界线牌局的壳。
 *
 * 一屏四层,从上到下:
 *   舞台(我在哪) → 标题行(这是什么) → 牌桌(发生了什么、我可以怎么取舍) → 指标条(世界怎么样)
 *
 * 这个组件是纯展示:会话、手牌、光标、进度、见证者的话全部由 WorldRunner 注入。
 * 好处是它完全不关心数据从哪来 —— 换数据源不需要动它一行。
 */
export function WorldSimulator({
  session,
  skin,
  cards,
  cursor,
  resolvedChoiceId,
  played,
  summary,
  witnessLine,
  onChoose,
  onCardAction,
  onAdvance,
  advanceLabel,
  advanceDisabled,
  progress,
  busy,
  followedEntityId,
  onFocus,
  notice,
  onBack,
  onReset,
}: {
  session: WorldSimSession;
  skin: ScenarioSkin;
  cards: WorldCard[];
  cursor: number;
  resolvedChoiceId: string | null;
  played: { label: string; severity: WorldCard["severity"] }[];
  /** 空桌时展示的阶段结算。手上有牌时为 null */
  summary: DeckSummary | null;
  witnessLine: WitnessLine | null;
  onChoose: (card: WorldCard, choice: EventChoice) => void;
  /** 原点卡 / 结算卡的单一动作。事件卡的推进不走这里 */
  onCardAction: (card: WorldCard) => void;
  onAdvance: () => void;
  advanceLabel: string;
  advanceDisabled: boolean;
  progress: { label: string; done: number; total: number } | null;
  busy: boolean;
  followedEntityId: string | null;
  onFocus: (entityId: string | null) => void;
  notice: string;
  onBack: () => void;
  onReset: () => void;
}) {
  const card = cards[cursor] ?? null;
  const isLastCard = cursor >= cards.length - 1;
  const archetype = witnessArchetypeFor(session.seed.themeId);

  const actionLabel = (() => {
    if (!card) return "继续";
    if (card.kind === "origin") return "拉开这条世界线";
    if (card.kind === "settle") return "重新洗一次牌";
    return isLastCard ? "回到牌桌" : "下一张";
  })();

  return (
    <div className="space-y-5">
      <WorldStage
        skin={skin}
        session={session}
        focusedEntityId={followedEntityId}
        onFocus={onFocus}
      />

      {/* 标题行 */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="返回">
            <ArrowLeft />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">世界线牌局</h1>
            <p className="text-muted-foreground line-clamp-1 text-xs">{session.scenarioTitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <GitFork data-icon="inline-start" />
            {session.directives.length} 次取舍
          </Badge>
          <Badge variant="secondary">{timeScaleLabels[session.seed.timeScale]}尺度</Badge>
          <Badge variant="secondary">{skin.name}</Badge>
          <Button variant="ghost" size="sm" onClick={onReset} disabled={busy}>
            <RotateCcw data-icon="inline-start" />
            重建世界
          </Button>
        </div>
      </div>

      {notice ? <p className="text-muted-foreground text-xs leading-6">{notice}</p> : null}

      <WorldDeck
        skin={skin}
        archetype={archetype}
        witnessLine={witnessLine}
        card={card}
        metrics={session.state.globalMetrics}
        resolvedChoiceId={resolvedChoiceId}
        onChoose={(choice) => {
          if (card) onChoose(card, choice);
        }}
        onAction={() => {
          if (card) onCardAction(card);
        }}
        onNext={() => {
          if (card) onCardAction(card);
        }}
        nextLabel={actionLabel}
        actionLabel={actionLabel}
        busy={busy}
        deckLeft={cards.length - cursor}
        played={played}
        summary={summary}
      />

      <Separator />

      <MetricStrip
        metrics={session.state.globalMetrics}
        onAdvance={onAdvance}
        advanceLabel={advanceLabel}
        advanceDisabled={advanceDisabled}
        busy={busy}
        progress={progress}
      />
    </div>
  );
}

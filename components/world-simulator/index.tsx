"use client";

import { ArrowLeft, GitFork, RotateCcw } from "lucide-react";

import { witnessArchetypeFor } from "@/components/pixel/witness";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MetricStrip } from "@/components/world-simulator/metric-strip";
import {
  SimulationView,
  type SimulationViewState,
} from "@/components/world-simulator/simulation-view";
import {
  WorldDeck,
  type DeckStage,
  type DeckSummary,
} from "@/components/world-simulator/world-deck";
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
 *   舞台(我在哪) → 标题行(这是什么) → 牌桌(盲抽 + 翻牌 + 取舍) → 指标条(世界怎么样)
 *
 * 这个组件是纯展示:会话、手牌、翻牌状态、进度、见证者的话全部由 WorldRunner 注入。
 */
export function WorldSimulator({
  session,
  skin,
  hand,
  stage,
  pickedIds,
  activeCardId,
  simView,
  flippingId,
  resolvedChoiceId,
  played,
  summary,
  witnessLine,
  onPick,
  onChoose,
  onCardClose,
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
  hand: WorldCard[];
  stage: DeckStage;
  /** 本阶段已翻开的全部牌(可能是 1 张或 2 张) */
  pickedIds: string[];
  /** 当前正面朝上、正在做取舍的那张牌 */
  activeCardId: string | null;
  /** 非空时牌桌替换成「世界演算室」Gen UI */
  simView: SimulationViewState | null;
  flippingId: string | null;
  resolvedChoiceId: string | null;
  played: { label: string; tier: WorldCard["tier"] }[];
  summary: DeckSummary | null;
  witnessLine: WitnessLine | null;
  onPick: (card: WorldCard) => void;
  onChoose: (choice: EventChoice) => void;
  /** 收下这张牌 —— 翻开的是一张没有取舍的白卡时的唯一出口 */
  onCardClose: () => void;
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
  const archetype = witnessArchetypeFor(session.seed.themeId);
  const picked = hand.find((card) => card.id === activeCardId) ?? null;

  /**
   * 卡面底部唯一的那个主按钮。一个状态至多一个出口:
   *   origin                拉开这条世界线
   *   open + 白卡(无选项)   收下这张牌
   *   open + 有选项          不给按钮 —— 选项本身就是出口
   *   closed / pick / empty  不给按钮 —— 出口是下面的"推进时间"
   */
  const cardAction = (() => {
    if (stage === "origin") return { label: "拉开这条世界线", onClick: onAdvance };
    if (stage === "open" && picked && picked.choices.length === 0) {
      return { label: "收下这张牌", onClick: onCardClose };
    }
    return undefined;
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

      {simView ? (
        <SimulationView
          entities={session.state.entities}
          phase={simView.phase}
          startedIds={simView.startedIds}
          intents={simView.intents}
          worldEvents={simView.worldEvents}
          errors={simView.errors}
        />
      ) : (
        <WorldDeck
          skin={skin}
          archetype={archetype}
          witnessLine={witnessLine}
          hand={hand}
          stage={stage}
          pickedIds={pickedIds}
          activeCardId={activeCardId}
          flippingId={flippingId}
          resolvedChoiceId={resolvedChoiceId}
          metrics={session.state.globalMetrics}
          onPick={onPick}
          onChoose={onChoose}
          cardAction={cardAction}
          busy={busy}
          played={played}
          summary={summary}
        />
      )}

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

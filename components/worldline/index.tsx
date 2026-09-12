"use client";

import { Eye, GitFork, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StageBackdrop } from "@/components/worldline/backdrop";
import { EventBoard } from "@/components/worldline/board";
import { EpicProclamationBanner, type ProclamationData } from "@/components/worldline/proclamation";
import { WorldlineMarkSvg } from "@/components/worldline/sprites";
import { WorldArea, type ActiveVoice } from "@/components/worldline/stage";
import { WorldlineEvolutionTree } from "@/components/worldline/tree";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import type {
  WitnessArchetype,
  WorldlineBeing,
  WorldlineEvent,
  WorldlineSegment,
} from "@/lib/worldline";

/**
 * 世界线观测台的整屏。
 *
 * 一屏双模式:
 *   Tab 1: 实时沙盘 —— 全宽天幕舞台 + 见证者牌桌 + 底部推进条
 *   Tab 2: 演化世界树 · 编年 —— 发散式思维导图演化树图谱
 *
 * 纯展示,不碰网络 —— 会话、进度、台词全部由 WorldlineRunner 注入。
 */

/** 世界正在走哪一步。决定底部那一行说什么、按钮能不能按 */
export type ObservatoryPhase = "boot" | "deal" | "idle" | "react" | "done";

export interface ObservatoryView {
  scenarioTitle: string;
  themeId?: string;
  premiseStatement: string;
  domains: string[];
  scaleLabel: string;
  witnessName: string;
  witnessArchetype: WitnessArchetype;
  beings: WorldlineBeing[];
  timeline: WorldlineSegment[];
  /** 已经落到桌上的那几件,永远是整波的前缀 */
  events: WorldlineEvent[];
  /** 还扣着的张数 */
  pending: number;
  playing: number | null;
  played: number[];
  voices: ActiveVoice[];
  phase: ObservatoryPhase;
  reactionDone: number;
  reactionTotal: number;
  witnessLine: string;
  notice: string;
  busy: boolean;
  /** 种子还在生成:编年史为空、四股力量还没站上台 */
  loading: boolean;
  /**
   * 这一波的反应是否已经全部拿到。
   *
   * 事件是流式回来的,反应在它们之后才并行生成 —— 所以"五件事都摆好了"
   * 不等于"世界已经想好怎么接"。差这一步的时候按钮不能点,
   * 否则玩家会按下一个没有内容的"看世界的反应"。
   */
  reactionsReady: boolean;
}

function advanceLabel(view: ObservatoryView): string {
  if (view.phase === "idle" && !view.reactionsReady) return "世界正在准备它的反应";
  return {
    boot: "世界正在铺开",
    deal: "事件正在落下来",
    idle: "看世界的反应 →",
    react: "世界正在做出反应",
    done: "下一波事件 →",
  }[view.phase];
}

/** boot / deal / react 三个相位按钮是禁用的 —— 世界正忙,催不动它 */
function advanceDisabled(view: ObservatoryView): boolean {
  if (view.phase === "idle") return !view.reactionsReady;
  return view.phase !== "done";
}

function phaseNote(view: ObservatoryView): string {
  if (view.notice) return view.notice;
  switch (view.phase) {
    case "boot":
      return "正在为这道假设题铺开一条世界线";
    case "deal":
      return "事件正在一张一张落到桌上";
    case "idle":
      return view.reactionsReady
        ? "五件事都摆出来了 · 全世界的反应还没开始"
        : "五件事都摆出来了 · 世界还在盘算怎么接";
    case "react":
      return "世界正在逐条作出反应,有的要等很多年";
    case "done":
      return "这一波走完了 · 世界在等你发下一波";
  }
}

export function Observatory({
  view,
  skin,
  litIds,
  onLit,
  scrollerRef,
  onAdvance,
  onReset,
  proclamation,
  onDismissProclamation,
}: {
  view: ObservatoryView;
  skin: ScenarioSkin;
  /** 当前亮着的那几股力量。悬停编年史时换一批,世界做出反应时亮起回应的一方 */
  litIds: readonly string[];
  onLit: (involves: string[] | null) => void;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  onAdvance: () => void;
  onReset: () => void;
  proclamation?: ProclamationData | null;
  onDismissProclamation?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<string>("observatory");
  const eraNo = Math.max(1, view.timeline.length);
  const eraAt = view.timeline.at(-1)?.at ?? "起点";

  return (
    <div className="observatory">
      <EpicProclamationBanner
        proclamation={proclamation ?? null}
        skin={skin}
        onDismiss={onDismissProclamation ?? (() => {})}
      />
      <div className="shell">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="obs-tabs-container">
          <header className="bar">
            <div className="bar-brand">
              <span className="worldline-mark">
                <WorldlineMarkSvg skin={skin} scale={2} />
              </span>
              <div className="bar-titles">
                <h1>世界线观测台</h1>
                <p className="sub">{view.scenarioTitle}</p>
              </div>
              <button
                type="button"
                className="btn ghost reset-btn-mobile sm:hidden"
                onClick={onReset}
                disabled={view.busy}
                title="重建世界"
              >
                <RotateCcw className="size-3.5" />
              </button>
            </div>

            <div className="obs-tab-nav">
              <TabsList className="obs-tabs-list">
                <TabsTrigger value="observatory" className="obs-tab-trigger">
                  <Eye className="size-3.5" />
                  <span>实时沙盘</span>
                </TabsTrigger>
                <TabsTrigger value="tree" className="obs-tab-trigger">
                  <GitFork className="size-3.5" />
                  <span>世界线 · 编年</span>
                  <span className="obs-tab-badge">{view.timeline.length} 纪元</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="hidden grow md:block" />
            <div className="chips">
              <span className="chip chip-stance hidden md:inline-flex">
                立场 <b>观察者</b>
              </span>
              <span className="chip chip-scale">
                尺度 <b>{view.scaleLabel}</b>
              </span>
              <span className="chip accent chip-era">纪元 {eraNo}</span>
              <button
                type="button"
                className="btn ghost reset-btn-desktop hidden sm:inline-flex"
                style={{ padding: "5px 11px", fontSize: "11px" }}
                onClick={onReset}
                disabled={view.busy}
              >
                重建世界
              </button>
            </div>
          </header>

          <TabsContent value="observatory" className="obs-tab-panel">
            <div className="main full-stage">
              <section className="sky">
                <StageBackdrop skin={skin} />
                <WorldArea
                  statement={view.premiseStatement}
                  domains={view.domains}
                  beings={view.beings}
                  litIds={litIds}
                  eraNo={eraNo}
                  eraAt={eraAt}
                  voices={view.voices}
                  skin={skin}
                  loading={view.loading}
                />
              </section>
            </div>

            <EventBoard
              beings={view.beings}
              witnessName={view.witnessName}
              witnessArchetype={view.witnessArchetype}
              witnessLine={view.witnessLine}
              skin={skin}
              events={view.events}
              pending={view.pending}
              playing={view.playing}
              played={view.played}
            />

            <footer className="foot mobile-sticky">
              <div className="foot-progress grow">
                <div className="track">
                  <i style={{ width: "18%" }} />
                </div>
                <p className="note">{phaseNote(view)}</p>
              </div>
              <div className="stats foot-stats">
                <span className="chip">
                  编年 <b>{view.timeline.length}</b> 段
                </span>
                <span className="chip">
                  反应 <b>{view.reactionDone}</b>/<b>{view.reactionTotal}</b>
                </span>
              </div>
              <button
                type="button"
                className="btn advance-btn"
                onClick={onAdvance}
                disabled={advanceDisabled(view)}
              >
                {advanceLabel(view)}
              </button>
            </footer>
          </TabsContent>

          <TabsContent value="tree" className="obs-tab-panel">
            <WorldlineEvolutionTree
              view={view}
              skin={skin}
              litIds={litIds}
              onLit={onLit}
              scrollerRef={scrollerRef}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

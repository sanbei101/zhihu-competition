"use client";

import { Eye, GitFork, RotateCcw, Sparkles } from "lucide-react";
import { useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StageBackdrop } from "@/components/worldline/backdrop";
import { EventBoard } from "@/components/worldline/board";
import { EpicProclamationBanner, type ProclamationData } from "@/components/worldline/proclamation";
import { WorldlineSettlementModal } from "@/components/worldline/settlement";
import { WorldlineMarkSvg } from "@/components/worldline/sprites";
import { WorldArea, type ActiveVoice } from "@/components/worldline/stage";
import { WorldlineEvolutionTree } from "@/components/worldline/tree";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import type {
  WitnessArchetype,
  WorldlineBeing,
  WorldlineEvent,
  WorldlineSegment,
  WorldlineSession,
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
  /** 世界线是否已达成终局或已收束 */
  isConcluded: boolean;
  /** 是否满足手动收束条件 (如完成 >= 2 波且当前波次已结束) */
  canManualSettle: boolean;
  /** 当前推进到第几波 */
  waveCount: number;
  /** 最大波次限制 */
  maxWaves: number;
}

function advanceLabel(view: ObservatoryView): string {
  if (view.isConcluded) return "查看历史终局报告 · 载入史册";
  if (view.phase === "idle" && !view.reactionsReady) return "世界正在准备它的反应";
  return {
    boot: "世界正在铺开",
    deal: "事件正在落下来",
    idle: "看世界的反应 →",
    react: "世界正在做出反应",
    done:
      view.waveCount >= view.maxWaves
        ? "收束世界线 · 终局结算 →"
        : `下一波事件 (${view.waveCount}/${view.maxWaves}) →`,
  }[view.phase];
}

/** boot / deal / react 三个相位按钮是禁用的 —— 世界正忙,催不动它 */
function advanceDisabled(view: ObservatoryView): boolean {
  if (view.isConcluded) return false;
  if (view.phase === "idle") return !view.reactionsReady;
  return view.phase !== "done";
}

function phaseNote(view: ObservatoryView): string {
  if (view.isConcluded) return "世界线已收敛至终局新常态 · 历史已载入史册";
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
      return view.waveCount >= view.maxWaves
        ? "推演已达终局临界点 · 可收束世界线"
        : "这一波走完了 · 世界在等你发下一波";
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
  onSettle,
  isSettleModalOpen,
  onCloseSettleModal,
  session,
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
  onSettle?: () => void;
  isSettleModalOpen?: boolean;
  onCloseSettleModal?: () => void;
  session?: WorldlineSession | null;
}) {
  const [activeTab, setActiveTab] = useState<string>("observatory");
  const eraNo = Math.max(1, view.timeline.length);
  const eraAt = view.timeline.at(-1)?.at ?? "起点";

  return (
    <div className="observatory bg-background text-foreground min-h-dvh font-sans text-sm leading-[1.6] antialiased">
      <EpicProclamationBanner
        proclamation={proclamation ?? null}
        skin={skin}
        onDismiss={onDismissProclamation ?? (() => {})}
      />
      <div className="mx-auto flex min-h-dvh max-w-[1560px] flex-col gap-3.5 px-4 pt-3 pb-4 max-md:gap-3 max-md:px-3 max-md:pt-2.5 max-md:pb-[calc(14px+env(safe-area-inset-bottom,0px))]">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex w-full flex-col gap-3.5! data-horizontal:flex-col"
        >
          <header className="flex flex-wrap items-center gap-3.5 max-md:flex-col max-md:items-stretch max-md:gap-2.5">
            <div className="flex items-center gap-3 max-md:w-full max-md:justify-between max-md:gap-2.5">
              <span>
                <WorldlineMarkSvg skin={skin} scale={2} />
              </span>
              <div className="min-w-0 max-md:min-w-0 max-md:flex-1">
                <h1 className="text-[17px] font-semibold tracking-[0.02em] max-md:text-[15px]">
                  世界线观测台
                </h1>
                <p className="text-muted-foreground max-w-[46ch] truncate text-xs max-md:max-w-full max-md:text-[11px]">
                  {view.scenarioTitle}
                </p>
              </div>
              <button
                type="button"
                className="btn ghost border-border text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center justify-center rounded-[4px] border bg-white/5 px-2.5 py-1.5 hover:bg-white/10 sm:hidden"
                onClick={onReset}
                disabled={view.busy}
                title="重建世界"
              >
                <RotateCcw className="size-3.5" />
              </button>
            </div>

            <div className="ml-2 inline-flex max-md:ml-0 max-md:w-full">
              <TabsList
                variant="line"
                className="border-border inline-flex items-center gap-0.5 rounded-md! border bg-[rgba(18,14,11,0.85)]! p-0.5! max-md:grid max-md:w-full max-md:grid-cols-2 max-md:gap-1"
              >
                <TabsTrigger
                  value="observatory"
                  className="text-muted-foreground! data-active:bg-card! data-active:text-primary! gap-1.5 px-3! py-[5px]! text-xs! hover:bg-[rgba(255,255,255,0.04)] data-active:border-[rgba(232,163,61,0.35)] data-active:font-semibold data-active:shadow-[0_1px_4px_rgba(0,0,0,0.35)] max-md:justify-center max-md:px-2.5 max-md:py-[7px]"
                >
                  <Eye className="size-3.5" />
                  <span>实时沙盘</span>
                </TabsTrigger>
                <TabsTrigger
                  value="tree"
                  className="text-muted-foreground! data-active:bg-card! data-active:text-primary! gap-1.5 px-3! py-[5px]! text-xs! hover:bg-[rgba(255,255,255,0.04)] data-active:border-[rgba(232,163,61,0.35)] data-active:font-semibold data-active:shadow-[0_1px_4px_rgba(0,0,0,0.35)] max-md:justify-center max-md:px-2.5 max-md:py-[7px]"
                >
                  <GitFork className="size-3.5" />
                  <span>世界线 · 编年</span>
                  <span className="text-primary rounded-full border border-[rgba(232,163,61,0.3)] bg-[rgba(232,163,61,0.15)] px-1.5 py-px font-mono text-[10px]">
                    {view.timeline.length} 纪元
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="hidden grow md:block" />
            <div className="flex flex-wrap items-center gap-2 max-md:w-full max-md:justify-start max-md:gap-1.5 [&_.chip]:max-md:px-2 [&_.chip]:max-md:py-[3px] [&_.chip]:max-md:text-[10px]">
              <span className="chip hidden md:inline-flex">
                立场 <b className="text-foreground font-semibold">观察者</b>
              </span>
              <span className="chip">
                尺度 <b className="text-foreground font-semibold">{view.scaleLabel}</b>
              </span>
              <span className="chip border-primary text-primary">纪元 {eraNo}</span>
              {view.isConcluded && (
                <button
                  type="button"
                  className="chip inline-flex cursor-pointer items-center gap-1.25 rounded-[4px] border border-amber-500/50 bg-amber-500/15 px-2.5 py-1 font-mono text-[11px] text-[#fbbf24] transition-all duration-200 hover:-translate-y-px hover:border-[#f59e0b] hover:bg-amber-500/25"
                  onClick={onSettle}
                  title="查看知乎体深度推演回答与终局报告"
                >
                  <Sparkles className="size-3 text-amber-400" />
                  <b className="font-semibold">终局报告</b>
                </button>
              )}
              <button
                type="button"
                className="btn ghost hidden sm:inline-flex"
                style={{ padding: "5px 11px", fontSize: "11px" }}
                onClick={onReset}
                disabled={view.busy}
              >
                重建世界
              </button>
            </div>
          </header>

          <TabsContent value="observatory" className="flex w-full flex-col gap-3.5 outline-none">
            <div className="border-border grid h-[clamp(330px,45vh,500px)] grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden rounded-[4px] border max-md:h-[clamp(260px,36vh,310px)] min-[769px]:max-[1000px]:h-[360px]">
              <section className="relative min-h-0 min-w-0 overflow-hidden">
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

            <footer className="border-border max-md:border-border flex flex-wrap items-center gap-4 border-t pt-3 max-md:sticky max-md:bottom-0 max-md:z-[35] max-md:-mx-3 max-md:-mb-3.5 max-md:flex-col max-md:items-stretch max-md:gap-2 max-md:rounded-t-xl max-md:border-t max-md:bg-[rgba(14,11,9,0.96)] max-md:px-3 max-md:py-2.5 max-md:pb-[calc(10px+env(safe-area-inset-bottom,0px))] max-md:shadow-[0_-4px_18px_rgba(0,0,0,0.65)] max-md:backdrop-blur-[14px]">
              <div className="min-w-0 flex-1 max-md:w-full">
                <div className="bg-secondary h-[5px] overflow-hidden rounded-[3px]">
                  <i
                    className="bg-primary block h-full w-0 transition-[width] duration-[600ms] ease-out"
                    style={{
                      width: `${Math.min(100, Math.round((view.waveCount / view.maxWaves) * 100))}%`,
                    }}
                  />
                </div>
                <p className="text-muted-foreground mt-1.5 font-mono text-[10.5px] tracking-[0.08em]">
                  {phaseNote(view)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 max-md:flex max-md:w-full max-md:justify-between">
                <span className="chip">
                  编年 <b className="text-foreground font-semibold">{view.timeline.length}</b> 段
                </span>
                <span className="chip">
                  反应 <b className="text-foreground font-semibold">{view.reactionDone}</b>/
                  <b className="text-foreground font-semibold">{view.reactionTotal}</b>
                </span>
              </div>
              <div className="flex items-center gap-2">
                {view.canManualSettle && !view.isConcluded && onSettle && (
                  <button
                    type="button"
                    className="btn inline-flex cursor-pointer items-center gap-1.5 rounded-[4px] border border-[rgba(245,158,11,0.45)] bg-amber-500/10 px-3.5 py-[7px] text-[12.5px] font-semibold text-[#fbbf24] transition-all duration-200 hover:border-[#f59e0b] hover:bg-amber-500/20 hover:shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                    onClick={onSettle}
                    disabled={view.busy}
                    title="世界线已走向成熟，可随时提前收束并生成知乎体深度回答"
                  >
                    <Sparkles className="size-3.5 text-amber-400" />
                    收束世界线 · 载入史册
                  </button>
                )}
                <button
                  type="button"
                  className={`btn max-md:h-11 max-md:w-full max-md:rounded-md max-md:text-sm max-md:font-semibold ${
                    view.isConcluded
                      ? "[animation:pulseGold_2.5s_infinite] border-[#fbbf24]! bg-[linear-gradient(135deg,#f59e0b,#d97706)]! font-bold! text-[#111827]! shadow-[0_0_16px_rgba(245,158,11,0.4)]!"
                      : ""
                  }`}
                  onClick={view.isConcluded ? onSettle : onAdvance}
                  disabled={advanceDisabled(view)}
                >
                  {advanceLabel(view)}
                </button>
              </div>
            </footer>
          </TabsContent>

          <TabsContent value="tree" className="flex w-full flex-col gap-3.5 outline-none">
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

      <WorldlineSettlementModal
        isOpen={Boolean(isSettleModalOpen)}
        onClose={onCloseSettleModal ?? (() => {})}
        session={session ?? null}
        skin={skin}
        onReset={onReset}
      />
    </div>
  );
}

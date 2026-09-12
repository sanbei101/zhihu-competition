"use client";

import { StageBackdrop } from "@/components/worldline/backdrop";
import { EventBoard } from "@/components/worldline/board";
import { Chronicle } from "@/components/worldline/chronicle";
import { WorldlineMarkSvg } from "@/components/worldline/sprites";
import { WorldArea, type ActiveVoice } from "@/components/worldline/stage";
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
 * 一屏四层,从上到下:
 *   顶栏(这是什么) → 观测屏(左:世界 / 右:编年) → 牌桌(这一波落了什么) → 底部(《让世界走》)
 *
 * 纯展示,不碰网络 —— 会话、进度、台词全部由 WorldlineRunner 注入。
 */

/** 世界正在走哪一步。决定底部那一行说什么、按钮能不能按 */
export type ObservatoryPhase = "boot" | "deal" | "idle" | "react" | "done";

export interface ObservatoryView {
  scenarioTitle: string;
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
}: {
  view: ObservatoryView;
  skin: ScenarioSkin;
  /** 当前亮着的那几股力量。悬停编年史时换一批,世界做出反应时亮起回应的一方 */
  litIds: readonly string[];
  onLit: (involves: string[] | null) => void;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  onAdvance: () => void;
  onReset: () => void;
}) {
  const lit = onLit;
  const eraNo = Math.max(1, view.timeline.length);
  const eraAt = view.timeline.at(-1)?.at ?? "起点";

  return (
    <div className="observatory">
      <div className="shell">
        <header className="bar">
          <span className="worldline-mark">
            <WorldlineMarkSvg skin={skin} scale={2} />
          </span>
          <div>
            <h1>世界线观测台</h1>
            <p className="sub">{view.scenarioTitle}</p>
          </div>
          <div className="grow" />
          <div className="chips">
            <span className="chip">
              立场 <b>观察者</b>
            </span>
            <span className="chip">
              尺度 <b>{view.scaleLabel}</b>
            </span>
            <span className="chip accent">纪元 {eraNo}</span>
            <button
              type="button"
              className="btn ghost"
              style={{ padding: "5px 11px", fontSize: "11px" }}
              onClick={onReset}
              disabled={view.busy}
            >
              重建世界
            </button>
          </div>
        </header>

        <div className="main">
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

          <Chronicle timeline={view.timeline} scrollerRef={scrollerRef} onLit={lit} />
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

        <footer className="foot">
          <div className="grow">
            {/*
             * 进度条停在 18% 是照搬原型的 —— 那一版没有把推进进度接上去。
             * 保留原样是为了迁移前后逐像素一致;要接真实进度的话改这两行就够。
             */}
            <div className="track">
              <i style={{ width: "18%" }} />
            </div>
            <p className="note">{phaseNote(view)}</p>
          </div>
          <div className="stats">
            <span className="chip">
              编年 <b>{view.timeline.length}</b> 段
            </span>
            <span className="chip">
              反应 <b>{view.reactionDone}</b>/<b>{view.reactionTotal}</b>
            </span>
          </div>
          <button
            type="button"
            className="btn"
            onClick={onAdvance}
            disabled={advanceDisabled(view)}
          >
            {advanceLabel(view)}
          </button>
        </footer>
      </div>
    </div>
  );
}

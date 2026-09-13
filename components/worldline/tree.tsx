"use client";

import {
  Compass,
  FileText,
  Filter,
  ListTree,
  MessageSquare,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Chronicle } from "@/components/worldline/chronicle";
import { EmblemSvg } from "@/components/worldline/sprites";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import {
  type EntityKind,
  type EventTone,
  type WitnessArchetype,
  type WorldlineBeing,
  eventToneLabels,
} from "@/lib/worldline";
import { getEpicQuote, inferMilestoneFromWave } from "@/lib/worldline-epics";

import type { ObservatoryView } from "./index";

/** 演化树中的台词简报 */
export interface TreeVoiceItem {
  key: WitnessArchetype;
  shift: number;
  name: string;
  line: string;
}

/** 势力分叉子节点(某个具体力量在某时点的演变反应) */
export interface TreeReactionBranch {
  id: string;
  byEntityId: string;
  beingName: string;
  beingKind: EntityKind;
  delay: string;
  text: string;
  voices: TreeVoiceItem[];
  tone: EventTone;
}

/** 演化树主干上的重大事件节点 */
export interface TreeEventBranch {
  id: string;
  eraNo: number;
  at: string;
  title: string;
  tone: EventTone | "neutral";
  involves: string[];
  mark?: "crisis" | "echo";
  aftermath?: string;
  isLive: boolean;
  branches: TreeReactionBranch[];
  epicMilestone?: {
    quote: string;
    subtext: string;
    tag: string;
    icon: string;
    color: string;
  };
}

export interface TreeData {
  root: {
    statement: string;
    domains: string[];
    scaleLabel: string;
    scenarioTitle: string;
  };
  events: TreeEventBranch[];
}

/** 将当前会话数据转为思维导图演化树模型 */
function buildTreeData(view: ObservatoryView): TreeData {
  const beingMap = new Map<string, WorldlineBeing>();
  for (const b of view.beings) {
    beingMap.set(b.id, b);
  }

  const events: TreeEventBranch[] = [];

  // 1. 开局编年史
  const openingSegments = view.timeline.filter(
    (seg) => seg.kind === "event" && !seg.aftermath.startsWith("回应「"),
  );

  openingSegments.forEach((seg, idx) => {
    const childBranches: TreeReactionBranch[] = [];
    if (seg.aftermath) {
      const primaryBeingId = seg.involves[0] ?? "unknown";
      const being = beingMap.get(primaryBeingId);
      childBranches.push({
        id: `opening-${idx}-aftermath`,
        byEntityId: primaryBeingId,
        beingName: being?.name ?? "既定历史",
        beingKind: being?.kind ?? "state",
        delay: "后续演化",
        text: seg.aftermath,
        voices: seg.voices.map((v) => ({
          key: v.key,
          shift: v.shift,
          name: v.name,
          line: v.line,
        })),
        tone: "good",
      });
    }

    const milestone = inferMilestoneFromWave({
      eraNo: idx + 1,
      tone: seg.mark === "crisis" ? "bad" : "good",
      hasCrisis: seg.mark === "crisis",
    });
    const epicMilestone = getEpicQuote({
      themeId: view.themeId ?? "cosmic",
      milestone,
      index: idx,
    });

    events.push({
      id: `opening-${idx}-${seg.at}`,
      eraNo: idx + 1,
      at: seg.at,
      title: seg.headline,
      tone: seg.mark === "crisis" ? "bad" : "neutral",
      involves: seg.involves,
      mark: seg.mark,
      aftermath: seg.aftermath,
      isLive: idx === openingSegments.length - 1 && view.events.length === 0,
      branches: childBranches,
      epicMilestone,
    });
  });

  // 2. 真实推演生成的事件波次
  view.events.forEach((ev, evIdx) => {
    const isPlaying = view.playing === evIdx;
    const branches: TreeReactionBranch[] = ev.reactions.map((r, rIdx) => {
      const being = beingMap.get(r.by);
      return {
        id: `${ev.id}-reaction-${rIdx}-${r.by}`,
        byEntityId: r.by,
        beingName: being?.name ?? r.by,
        beingKind: being?.kind ?? "state",
        delay: r.delay,
        text: r.text,
        voices: r.voices.map((v) => ({
          key: v.key,
          shift: v.shift,
          name: v.name,
          line: v.line,
        })),
        tone: ev.tone,
      };
    });

    const eraCount = openingSegments.length + evIdx + 1;
    const milestone = inferMilestoneFromWave({
      eraNo: eraCount,
      tone: ev.tone,
      hasCrisis: ev.tone === "bad",
    });
    const epicMilestone = getEpicQuote({
      themeId: view.themeId ?? "cosmic",
      milestone,
      index: evIdx,
    });

    events.push({
      id: ev.id,
      eraNo: eraCount,
      at: ev.at,
      title: ev.title,
      tone: ev.tone,
      involves: ev.involves,
      isLive: isPlaying,
      branches,
      epicMilestone,
    });
  });

  return {
    root: {
      statement: view.premiseStatement,
      domains: view.domains,
      scaleLabel: view.scaleLabel,
      scenarioTitle: view.scenarioTitle,
    },
    events,
  };
}

interface ConnectionLine {
  id: string;
  d: string;
  tone: string;
  active: boolean;
  highlighted: boolean;
}

export function WorldlineEvolutionTree({
  view,
  skin,
  onLit,
  scrollerRef,
}: {
  view: ObservatoryView;
  skin: ScenarioSkin;
  litIds: readonly string[];
  onLit: (involves: string[] | null) => void;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const treeData = useMemo(() => buildTreeData(view), [view]);
  const [activeBeingFilter, setActiveBeingFilter] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<{
    title: string;
    sub: string;
    desc: string;
    voices?: TreeVoiceItem[];
    involves?: string[];
    epicMilestone?: {
      quote: string;
      subtext: string;
      tag: string;
      icon: string;
      color: string;
    };
  } | null>(null);
  const [viewMode, setViewMode] = useState<"tree" | "linear">("tree");
  const [zoom, setZoom] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const rootNodeRef = useRef<HTMLDivElement>(null);
  const eventNodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const branchRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [lines, setLines] = useState<ConnectionLine[]>([]);

  // 计算树枝贝塞尔连接线
  const updateLines = useCallback(() => {
    const container = containerRef.current;
    const rootEl = rootNodeRef.current;
    if (!container || !rootEl) return;

    const containerRect = container.getBoundingClientRect();
    const rootRect = rootEl.getBoundingClientRect();

    const rootX = rootRect.right - containerRect.left;
    const rootY = rootRect.top + rootRect.height / 2 - containerRect.top;

    const newLines: ConnectionLine[] = [];

    treeData.events.forEach((ev) => {
      const evEl = eventNodeRefs.current.get(ev.id);
      if (!evEl) return;
      const evRect = evEl.getBoundingClientRect();

      const evLeftX = evRect.left - containerRect.left;
      const evRightX = evRect.right - containerRect.left;
      const evCenterY = evRect.top + evRect.height / 2 - containerRect.top;

      // 根节点 -> 事件主干节点连线
      const dx1 = Math.max(30, (evLeftX - rootX) * 0.5);
      const d1 = `M ${rootX} ${rootY} C ${rootX + dx1} ${rootY}, ${evLeftX - dx1} ${evCenterY}, ${evLeftX} ${evCenterY}`;

      const isToneBad = ev.tone === "bad";
      const isToneOdd = ev.tone === "odd";
      const isToneGood = ev.tone === "good";
      const evColor = isToneBad
        ? "#ef4444"
        : isToneOdd
          ? "#d946ef"
          : isToneGood
            ? "#10b981"
            : skin.accent;

      const evInvolvesFilter = !activeBeingFilter || ev.involves.includes(activeBeingFilter);

      newLines.push({
        id: `root-to-${ev.id}`,
        d: d1,
        tone: evColor,
        active: ev.isLive,
        highlighted: evInvolvesFilter,
      });

      // 事件节点 -> 各势力分叉分支连线
      ev.branches.forEach((br) => {
        const brEl = branchRefs.current.get(br.id);
        if (!brEl) return;
        const brRect = brEl.getBoundingClientRect();

        const brLeftX = brRect.left - containerRect.left;
        const brCenterY = brRect.top + brRect.height / 2 - containerRect.top;

        const dx2 = Math.max(25, (brLeftX - evRightX) * 0.45);
        const d2 = `M ${evRightX} ${evCenterY} C ${evRightX + dx2} ${evCenterY}, ${brLeftX - dx2} ${brCenterY}, ${brLeftX} ${brCenterY}`;

        const brMatchesFilter = !activeBeingFilter || br.byEntityId === activeBeingFilter;

        newLines.push({
          id: `${ev.id}-to-${br.id}`,
          d: d2,
          tone: evColor,
          active: ev.isLive,
          highlighted: brMatchesFilter,
        });
      });
    });

    setLines(newLines);
  }, [treeData, activeBeingFilter, skin.accent]);

  useLayoutEffect(() => {
    updateLines();
    window.addEventListener("resize", updateLines);
    return () => window.removeEventListener("resize", updateLines);
  }, [updateLines, zoom, viewMode]);

  useEffect(() => {
    const timer = setTimeout(updateLines, 80);
    return () => clearTimeout(timer);
  }, [updateLines, view.events.length, view.timeline.length, view.playing]);

  const totalBranches = useMemo(() => {
    return treeData.events.reduce((acc, ev) => acc + Math.max(1, ev.branches.length), 0);
  }, [treeData]);

  return (
    <div className="border-border relative flex h-[calc(100vh-120px)] max-h-[820px] min-h-[580px] flex-col overflow-hidden rounded-md border bg-[rgba(14,11,9,0.92)] max-md:h-[calc(100dvh-145px)] max-md:min-h-[460px]">
      {/* 演化树顶部操作工具栏 */}
      <div className="border-border z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-[rgba(24,18,14,0.94)] px-4 py-2.5 max-md:flex-col max-md:items-stretch max-md:gap-2 max-md:p-2.5">
        <div className="flex w-full items-center justify-between gap-2">
          <div className="border-border inline-flex gap-0.5 rounded-[5px] border bg-black/35 p-0.5">
            <Button
              size="xs"
              variant={viewMode === "tree" ? "default" : "ghost"}
              onClick={() => setViewMode("tree")}
              className="gap-1.5 font-mono text-[11px]"
            >
              <ListTree className="size-3.5" />
              演化树图谱
            </Button>
            <Button
              size="xs"
              variant={viewMode === "linear" ? "default" : "ghost"}
              onClick={() => setViewMode("linear")}
              className="gap-1.5 font-mono text-[11px]"
            >
              <FileText className="size-3.5" />
              线性史纲
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="border-border inline-flex items-center gap-1 rounded-[5px] border bg-black/35 p-[2px_6px]">
              <Button
                size="icon-xs"
                variant="outline"
                onClick={() => setZoom((z) => Math.max(0.65, Number((z - 0.1).toFixed(2))))}
                title="缩小"
              >
                <Minus className="size-3" />
              </Button>
              <span className="text-muted-foreground min-w-9 text-center font-mono text-[11px] select-none">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                size="icon-xs"
                variant="outline"
                onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
                title="放大"
              >
                <Plus className="size-3" />
              </Button>
              <Button size="icon-xs" variant="outline" onClick={() => setZoom(1)} title="重置缩放">
                <RotateCcw className="size-3" />
              </Button>
            </div>

            <div className="text-muted-foreground hidden font-mono text-[11px] sm:inline-flex">
              <span className="border-border inline-flex items-center gap-1.25 rounded-[4px] border bg-black/30 px-2 py-1">
                <span>{treeData.events.length} 纪元</span>
                <span className="opacity-40">·</span>
                <span>{totalBranches} 分支</span>
                {view.isConcluded && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
                      <Sparkles className="size-2.5" /> 已定型
                    </span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* 势力高亮过滤滑轨 */}
        <div className="flex flex-wrap items-center gap-1.5 max-md:flex max-md:w-full max-md:scrollbar-none max-md:gap-1.25 max-md:overflow-x-auto max-md:pb-0.5">
          <span className="text-muted-foreground mr-0.5 inline-flex items-center gap-1 font-mono text-[11px]">
            <Filter className="size-3" />
            视角:
          </span>
          <button
            type="button"
            className={`border-border text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1.25 rounded-[4px] border bg-black/30 px-2 py-[3px] font-mono text-[11px] transition-all duration-150 hover:border-white/20 max-md:shrink-0 max-md:px-[7px] max-md:py-0.5 max-md:text-[10.5px] max-md:whitespace-nowrap ${
              activeBeingFilter === null
                ? "border-primary text-primary bg-[rgba(232,163,61,0.18)] font-semibold"
                : ""
            }`}
            onClick={() => {
              setActiveBeingFilter(null);
              onLit(null);
            }}
          >
            全部脉络
          </button>
          {view.beings.map((b) => {
            const active = activeBeingFilter === b.id;
            return (
              <button
                key={b.id}
                type="button"
                className={`border-border text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1.25 rounded-[4px] border bg-black/30 px-2 py-[3px] font-mono text-[11px] transition-all duration-150 hover:border-white/20 max-md:shrink-0 max-md:px-[7px] max-md:py-0.5 max-md:text-[10.5px] max-md:whitespace-nowrap ${
                  active
                    ? "border-primary text-primary bg-[rgba(232,163,61,0.18)] font-semibold"
                    : ""
                }`}
                onClick={() => {
                  const next = active ? null : b.id;
                  setActiveBeingFilter(next);
                  onLit(next ? [next] : null);
                }}
                title={`聚焦高亮 ${b.name} 的全部演化分枝`}
              >
                <span className="inline-flex size-[14px] items-center justify-center">
                  <EmblemSvg id={b.id} name={b.name} kind={b.kind} skin={skin} scale={1} />
                </span>
                <span>{b.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {viewMode === "linear" ? (
        <div className="max-h-[calc(100vh-190px)] flex-1 overflow-y-auto p-4">
          <Chronicle timeline={view.timeline} scrollerRef={scrollerRef} onLit={onLit} />
        </div>
      ) : (
        /* 演化树主画布 */
        <div className="bg-background relative flex-1 overflow-auto [background-image:radial-gradient(rgba(232,163,61,0.08)_1px,transparent_1px)] [background-size:24px_24px] p-10 max-md:p-2.5">
          <div
            className="relative min-h-full min-w-max transition-transform duration-150"
            ref={containerRef}
            style={
              {
                "--tree-zoom": String(zoom),
                transform: `scale(${zoom})`,
                transformOrigin: "0 0",
              } as CSSProperties
            }
          >
            {/* SVG 贝塞尔曲线连接网 */}
            <svg
              className="pointer-events-none absolute inset-0 z-[1] size-full"
              aria-hidden="true"
            >
              {lines.map((l) => (
                <path
                  key={l.id}
                  d={l.d}
                  fill="none"
                  stroke={l.tone}
                  strokeWidth={l.highlighted ? 2.5 : 1}
                  strokeDasharray={l.active ? "4 4" : "none"}
                  opacity={l.highlighted ? (l.active ? 0.95 : 0.65) : 0.15}
                  className={`transition-[stroke-width,opacity,stroke] duration-200 ${
                    l.active ? "animate-[treeLinePulse_2.4s_ease-in-out_infinite]" : ""
                  }`}
                />
              ))}
            </svg>

            {/* 树状内容区：水平发散结构 */}
            <div className="relative z-[2] flex items-start gap-[90px] px-5 pt-5 pb-[60px] pl-2.5 max-md:gap-9 max-md:p-[10px_10px_40px_0]">
              {/* 第 0 列：反事实原点奇点 (Root Node) */}
              <div className="sticky left-0 w-[270px] shrink-0 self-start max-md:static max-md:w-[200px]">
                <div
                  className="hover:border-primary border-l-primary! relative cursor-pointer rounded-md border border-l-4! border-[rgba(232,163,61,0.5)] bg-[linear-gradient(135deg,rgba(38,28,20,0.95),rgba(24,18,13,0.95))] px-4 py-3.5 shadow-[0_4px_12px_rgba(0,0,0,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
                  ref={rootNodeRef}
                  onClick={() =>
                    setSelectedNode({
                      title: "反事实世界奇点",
                      sub: treeData.root.scaleLabel,
                      desc: treeData.root.statement,
                      involves: view.beings.map((b) => b.name),
                      epicMilestone: getEpicQuote({
                        themeId: view.themeId ?? "cosmic",
                        milestone: "genesis",
                        index: 0,
                      }),
                    })
                  }
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-primary inline-flex items-center gap-1 font-mono text-[11px] font-semibold tracking-[0.04em]">
                      <Compass className="size-3" />
                      偏离原点
                    </span>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {treeData.root.scaleLabel}
                    </span>
                  </div>
                  <h3 className="text-foreground mb-2.5 text-sm leading-[1.55] font-semibold">
                    {treeData.root.statement}
                  </h3>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {treeData.root.domains.map((d) => (
                      <span
                        key={d}
                        className="text-primary rounded-[3px] bg-[rgba(232,163,61,0.12)] px-1.5 py-px font-mono text-[10px]"
                      >
                        #{d}
                      </span>
                    ))}
                  </div>
                  <div className="text-muted-foreground font-mono text-[10.5px]">
                    {view.isConcluded ? "世界线已完成演变 · 历史定型碑石" : "世界线自然演化根节点"}
                  </div>
                </div>
              </div>

              {/* 第 1 列与第 2 列：主干事件与其发散分支 */}
              <div className="flex min-w-[620px] flex-col gap-12 max-md:min-w-[280px] max-md:gap-7">
                {treeData.events.map((ev) => {
                  const matchesFilter =
                    !activeBeingFilter || ev.involves.includes(activeBeingFilter);
                  const isBad = ev.tone === "bad";
                  const isGood = ev.tone === "good";

                  return (
                    <div
                      key={ev.id}
                      className={`grid grid-cols-[300px_minmax(360px,1fr)] items-center gap-[75px] transition-opacity duration-200 max-md:grid-cols-[210px_minmax(210px,1fr)] max-md:gap-[30px] ${
                        matchesFilter ? "opacity-100" : "opacity-35"
                      }`}
                    >
                      {/* 事件主干节点 */}
                      <div
                        className={`border-border bg-card hover:border-primary relative w-[300px] cursor-pointer rounded-md border px-4 py-3.5 shadow-[0_4px_12px_rgba(0,0,0,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)] max-md:w-[210px] max-md:p-2.5 ${
                          ev.isLive ? "border-primary shadow-[0_0_16px_rgba(232,163,61,0.25)]" : ""
                        }`}
                        ref={(el) => {
                          if (el) eventNodeRefs.current.set(ev.id, el);
                          else eventNodeRefs.current.delete(ev.id);
                        }}
                        onMouseEnter={() => onLit(ev.involves)}
                        onMouseLeave={() => onLit(activeBeingFilter ? [activeBeingFilter] : null)}
                        onClick={() =>
                          setSelectedNode({
                            title: `纪元 ${ev.eraNo} · ${ev.at}`,
                            sub:
                              ev.tone !== "neutral"
                                ? `倾向: ${eventToneLabels[ev.tone]}`
                                : "开局纪元",
                            desc: ev.title + (ev.aftermath ? `\n\n${ev.aftermath}` : ""),
                            involves: ev.involves.map(
                              (id) => view.beings.find((b) => b.id === id)?.name ?? id,
                            ),
                            epicMilestone: ev.epicMilestone,
                          })
                        }
                      >
                        <div className="mb-2 flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="text-primary font-semibold">纪元 {ev.eraNo}</span>
                          <span className="text-muted-foreground">{ev.at}</span>
                          {ev.tone !== "neutral" && (
                            <span
                              className="ml-auto rounded-[3px] border px-1.5 py-px text-[10px]"
                              style={{
                                backgroundColor: isGood
                                  ? "rgba(16,185,129,0.18)"
                                  : isBad
                                    ? "rgba(239,68,68,0.18)"
                                    : "rgba(217,70,239,0.18)",
                                color: isGood ? "#34d399" : isBad ? "#f87171" : "#e879f9",
                                borderColor: isGood
                                  ? "rgba(16,185,129,0.5)"
                                  : isBad
                                    ? "rgba(239,68,68,0.5)"
                                    : "rgba(217,70,239,0.5)",
                              }}
                            >
                              {eventToneLabels[ev.tone]}
                            </span>
                          )}
                          {ev.isLive && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/35 bg-sky-400/15 px-1.5 py-px text-[10px] text-sky-400">
                              <i className="block size-[5px] animate-[pulseDot_1.4s_infinite] rounded-full bg-sky-400" />
                              演化中
                            </span>
                          )}
                        </div>

                        <p className="text-foreground mb-2.5 text-[13.5px] leading-[1.55] font-medium max-md:text-xs">
                          {ev.title}
                        </p>

                        {ev.epicMilestone && (
                          <div className="mt-1.5 mb-0.5 inline-flex items-center gap-1.25 rounded-[4px] border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 font-mono text-[10.5px] font-semibold tracking-[0.02em] text-[#fbbf24]">
                            <span>{ev.epicMilestone.icon}</span>
                            <span>{ev.epicMilestone.tag}</span>
                            <Sparkles className="size-2.5 text-amber-400" />
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1">
                          {ev.involves.map((id) => {
                            const b = view.beings.find((item) => item.id === id);
                            return (
                              <span
                                key={id}
                                className="border-border text-muted-foreground rounded-[3px] border bg-white/[0.05] px-1.25 py-px font-mono text-[10px]"
                              >
                                {b?.name ?? id}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* 发散分支容器：各势力做出的反应 */}
                      <div className="flex flex-col gap-3.5">
                        {ev.branches.length > 0 ? (
                          ev.branches.map((branch) => {
                            const branchMatches =
                              !activeBeingFilter || branch.byEntityId === activeBeingFilter;
                            return (
                              <div
                                key={branch.id}
                                className={`border-border hover:border-primary relative max-w-[460px] min-w-[320px] cursor-pointer rounded-md border border-l-[3px]! border-l-[rgba(232,163,61,0.4)]! bg-[rgba(24,18,14,0.88)] px-4 py-3.5 shadow-[0_4px_12px_rgba(0,0,0,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)] max-md:max-w-[280px] max-md:min-w-[210px] max-md:p-2.5 ${
                                  branchMatches
                                    ? "border-l-primary! bg-[rgba(30,22,16,0.95)]"
                                    : "opacity-35"
                                }`}
                                ref={(el) => {
                                  if (el) branchRefs.current.set(branch.id, el);
                                  else branchRefs.current.delete(branch.id);
                                }}
                                onMouseEnter={() => onLit([branch.byEntityId])}
                                onMouseLeave={() =>
                                  onLit(activeBeingFilter ? [activeBeingFilter] : null)
                                }
                                onClick={() =>
                                  setSelectedNode({
                                    title: `${branch.beingName} · ${branch.delay}`,
                                    sub: `针对「${ev.title}」的演变反应`,
                                    desc: branch.text,
                                    voices: branch.voices,
                                    involves: [branch.beingName],
                                  })
                                }
                              >
                                <div className="mb-1.5 flex items-center justify-between">
                                  <span className="inline-flex items-center gap-1.5 text-xs">
                                    <span className="inline-flex size-[18px] items-center justify-center">
                                      <EmblemSvg
                                        id={branch.byEntityId}
                                        name={branch.beingName}
                                        kind={branch.beingKind}
                                        skin={skin}
                                        scale={1.5}
                                      />
                                    </span>
                                    <b>{branch.beingName}</b>
                                  </span>
                                  <span className="text-muted-foreground font-mono text-[10.5px]">
                                    {branch.delay}
                                  </span>
                                </div>

                                <p className="text-foreground text-[12.5px] leading-[1.55] opacity-[0.92] max-md:text-[11px] max-md:leading-[1.45]">
                                  {branch.text}
                                </p>

                                {branch.voices.length > 0 && (
                                  <div className="border-border mt-2 flex flex-col gap-1 border-t border-dashed pt-2">
                                    {branch.voices.map((v, vIdx) => (
                                      <div
                                        key={vIdx}
                                        className="text-muted-foreground flex items-center gap-1.25 overflow-hidden font-mono text-[11px] whitespace-nowrap"
                                      >
                                        <MessageSquare className="size-2.5 shrink-0 opacity-70" />
                                        <span className="text-primary shrink-0 font-medium">
                                          {v.name}:
                                        </span>
                                        <span className="truncate italic">“{v.line}”</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="border-border text-muted-foreground rounded-md border border-dashed px-[18px] py-3 font-mono text-xs">
                            <span>待各势力反馈…</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 选中节点详情抽屉 / 溯源卡片 */}
      {selectedNode && (
        <>
          <div
            className="max-md:fixed max-md:inset-0 max-md:z-[49] max-md:[animation:fadeIn_0.18s_ease-out] max-md:bg-black/70 max-md:backdrop-blur-[4px]"
            onClick={() => setSelectedNode(null)}
            aria-hidden="true"
          />
          <aside className="border-border absolute top-[60px] right-4 bottom-4 z-20 flex w-[360px] max-w-[90vw] [animation:drawerSlideIn_0.2s_ease-out] flex-col rounded-lg border bg-[rgba(20,15,12,0.96)] shadow-[-8px_0_28px_rgba(0,0,0,0.65)] backdrop-blur-[12px] max-md:fixed max-md:inset-x-0 max-md:top-auto max-md:right-0 max-md:bottom-0 max-md:left-0 max-md:z-50 max-md:max-h-[76dvh] max-md:w-full max-md:max-w-full max-md:[animation:sheetUp_0.22s_cubic-bezier(0.16,1,0.3,1)] max-md:rounded-t-[16px] max-md:border-b-0 max-md:shadow-[0_-8px_32px_rgba(0,0,0,0.75)]">
            <div className="max-md:mx-auto max-md:mt-2 max-md:mb-0.5 max-md:block max-md:h-1 max-md:w-[38px] max-md:shrink-0 max-md:rounded-full max-md:bg-white/25 sm:hidden" />
            <div className="border-border flex items-start justify-between border-b px-4 py-3.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-primary font-mono text-[11px]">{selectedNode.sub}</span>
                <h4 className="text-foreground text-[15px] font-semibold">{selectedNode.title}</h4>
              </div>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-[4px] border-0 bg-transparent p-1 text-sm hover:bg-white/10"
                onClick={() => setSelectedNode(null)}
              >
                ✕
              </button>
            </div>
            {selectedNode.epicMilestone && (
              <div className="my-1 mb-3 rounded-md border border-l-[3px] border-t-[rgba(245,158,11,0.2)] border-r-white/5 border-b-white/5 border-l-[#f59e0b] bg-[linear-gradient(145deg,rgba(245,158,11,0.08),rgba(15,12,20,0.4))] px-3.5 py-3">
                <div className="mb-1.5 inline-flex items-center gap-1.25 font-mono text-[11px] font-semibold text-[#fbbf24]">
                  <span>{selectedNode.epicMilestone.icon}</span>
                  <span>{selectedNode.epicMilestone.tag}</span>
                  <Sparkles className="size-3 text-amber-400 opacity-80" />
                </div>
                <p className="mb-1 text-[13.5px] leading-[1.55] font-semibold text-[#f3f4f6] italic">
                  “{selectedNode.epicMilestone.quote}”
                </p>
                <p className="text-muted-foreground m-0 text-right text-[11px]">
                  —— {selectedNode.epicMilestone.subtext}
                </p>
              </div>
            )}
            <p className="text-foreground px-4 py-3 text-[13.5px] leading-[1.65] whitespace-pre-line">
              {selectedNode.desc}
            </p>
            {selectedNode.involves && selectedNode.involves.length > 0 && (
              <div className="px-4">
                <div className="text-muted-foreground flex items-center gap-1.5 font-mono text-[11px] tracking-[0.05em] uppercase">
                  牵涉力量
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedNode.involves.map((n) => (
                    <span
                      key={n}
                      className="text-primary rounded-[3px] border border-[rgba(232,163,61,0.25)] bg-[rgba(232,163,61,0.12)] px-2 py-[3px] font-mono text-[11px]"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedNode.voices && selectedNode.voices.length > 0 && (
              <div className="px-4">
                <div className="text-muted-foreground flex items-center gap-1.5 font-mono text-[11px] tracking-[0.05em] uppercase">
                  亲历者证言
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  {selectedNode.voices.map((v, i) => (
                    <div
                      key={i}
                      className="border-l-primary rounded-r-[4px] border-l-2 bg-black/35 p-2.5 text-xs"
                    >
                      <span className="text-foreground font-semibold">{v.name}</span>
                      <p className="text-muted-foreground mt-0.5 leading-[1.5] italic">
                        “{v.line}”
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </>
      )}
    </div>
  );
}

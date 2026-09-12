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
    <div className="evolution-tree-view">
      {/* 演化树顶部操作工具栏 */}
      <div className="tree-toolbar">
        <div className="tree-toolbar-row">
          <div className="tree-mode-toggle">
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

          <div className="tree-toolbar-actions">
            <div className="zoom-controls">
              <Button
                size="icon-xs"
                variant="outline"
                onClick={() => setZoom((z) => Math.max(0.65, Number((z - 0.1).toFixed(2))))}
                title="缩小"
              >
                <Minus className="size-3" />
              </Button>
              <span className="zoom-text font-mono text-[11px]">{Math.round(zoom * 100)}%</span>
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

            <div className="tree-stats-chip hidden sm:inline-flex">
              <span>{treeData.events.length} 纪元</span>
              <span className="divider">·</span>
              <span>{totalBranches} 分支</span>
              {view.isConcluded && (
                <>
                  <span className="divider">·</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
                    <Sparkles className="size-2.5" /> 已定型
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 势力高亮过滤滑轨 */}
        <div className="tree-filter-group">
          <span className="filter-label">
            <Filter className="size-3" />
            视角:
          </span>
          <button
            type="button"
            className={`filter-chip ${activeBeingFilter === null ? "active" : ""}`}
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
                className={`filter-chip being-chip ${active ? "active" : ""}`}
                onClick={() => {
                  const next = active ? null : b.id;
                  setActiveBeingFilter(next);
                  onLit(next ? [next] : null);
                }}
                title={`聚焦高亮 ${b.name} 的全部演化分枝`}
              >
                <span className="emblem-mini">
                  <EmblemSvg id={b.id} name={b.name} kind={b.kind} skin={skin} scale={1} />
                </span>
                <span>{b.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {viewMode === "linear" ? (
        <div className="tree-linear-wrap">
          <Chronicle timeline={view.timeline} scrollerRef={scrollerRef} onLit={onLit} />
        </div>
      ) : (
        /* 演化树主画布 */
        <div className="tree-scroll-container">
          <div
            className="tree-canvas"
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
            <svg className="tree-svg-layer" aria-hidden="true">
              {lines.map((l) => (
                <path
                  key={l.id}
                  d={l.d}
                  fill="none"
                  stroke={l.tone}
                  strokeWidth={l.highlighted ? 2.5 : 1}
                  strokeDasharray={l.active ? "4 4" : "none"}
                  opacity={l.highlighted ? (l.active ? 0.95 : 0.65) : 0.15}
                  className={`tree-line ${l.active ? "pulsing" : ""}`}
                />
              ))}
            </svg>

            {/* 树状内容区：水平发散结构 */}
            <div className="tree-columns">
              {/* 第 0 列：反事实原点奇点 (Root Node) */}
              <div className="tree-col col-root">
                <div
                  className="node-card root-node"
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
                  <div className="root-head">
                    <span className="root-badge">
                      <Compass className="size-3" />
                      偏离原点
                    </span>
                    <span className="root-scale">{treeData.root.scaleLabel}</span>
                  </div>
                  <h3 className="root-statement">{treeData.root.statement}</h3>
                  <div className="root-domains">
                    {treeData.root.domains.map((d) => (
                      <span key={d} className="domain-tag">
                        #{d}
                      </span>
                    ))}
                  </div>
                  <div className="root-meta">
                    {view.isConcluded ? "世界线已完成演变 · 历史定型碑石" : "世界线自然演化根节点"}
                  </div>
                </div>
              </div>

              {/* 第 1 列与第 2 列：主干事件与其发散分支 */}
              <div className="tree-col col-events">
                {treeData.events.map((ev) => {
                  const matchesFilter =
                    !activeBeingFilter || ev.involves.includes(activeBeingFilter);
                  const isBad = ev.tone === "bad";
                  const isGood = ev.tone === "good";

                  return (
                    <div
                      key={ev.id}
                      className={`tree-cluster ${matchesFilter ? "cluster-active" : "cluster-dimmed"}`}
                    >
                      {/* 事件主干节点 */}
                      <div
                        className={`node-card event-node ${ev.isLive ? "node-live" : ""}`}
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
                        <div className="event-node-top">
                          <span className="event-era">纪元 {ev.eraNo}</span>
                          <span className="event-at">{ev.at}</span>
                          {ev.tone !== "neutral" && (
                            <span
                              className="event-tone-badge"
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
                            <span className="live-pill">
                              <i />
                              演化中
                            </span>
                          )}
                        </div>

                        <p className="event-title">{ev.title}</p>

                        {ev.epicMilestone && (
                          <div className="event-epic-badge">
                            <span>{ev.epicMilestone.icon}</span>
                            <span>{ev.epicMilestone.tag}</span>
                            <Sparkles className="size-2.5 text-amber-400" />
                          </div>
                        )}

                        <div className="event-involves">
                          {ev.involves.map((id) => {
                            const b = view.beings.find((item) => item.id === id);
                            return (
                              <span key={id} className="involve-pill">
                                {b?.name ?? id}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* 发散分支容器：各势力做出的反应 */}
                      <div className="tree-reaction-group">
                        {ev.branches.length > 0 ? (
                          ev.branches.map((branch) => {
                            const branchMatches =
                              !activeBeingFilter || branch.byEntityId === activeBeingFilter;
                            return (
                              <div
                                key={branch.id}
                                className={`node-card branch-node ${branchMatches ? "branch-active" : "branch-dimmed"}`}
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
                                <div className="branch-header">
                                  <span className="branch-being-info">
                                    <span className="emblem-container">
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
                                  <span className="branch-delay">{branch.delay}</span>
                                </div>

                                <p className="branch-text">{branch.text}</p>

                                {branch.voices.length > 0 && (
                                  <div className="branch-voices">
                                    {branch.voices.map((v, vIdx) => (
                                      <div key={vIdx} className="voice-preview-pill">
                                        <MessageSquare className="size-2.5 shrink-0 opacity-70" />
                                        <span className="v-name">{v.name}:</span>
                                        <span className="v-line">“{v.line}”</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="branch-empty-placeholder">
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
            className="tree-drawer-backdrop"
            onClick={() => setSelectedNode(null)}
            aria-hidden="true"
          />
          <aside className="tree-detail-drawer">
            <div className="drawer-drag-handle sm:hidden" />
            <div className="drawer-header">
              <div className="drawer-title-area">
                <span className="drawer-sub">{selectedNode.sub}</span>
                <h4 className="drawer-title">{selectedNode.title}</h4>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setSelectedNode(null)}
              >
                ✕
              </button>
            </div>
            {selectedNode.epicMilestone && (
              <div className="drawer-epic-quote-block">
                <div className="deq-badge">
                  <span>{selectedNode.epicMilestone.icon}</span>
                  <span>{selectedNode.epicMilestone.tag}</span>
                  <Sparkles className="size-3 text-amber-400 opacity-80" />
                </div>
                <p className="deq-quote">“{selectedNode.epicMilestone.quote}”</p>
                <p className="deq-sub">—— {selectedNode.epicMilestone.subtext}</p>
              </div>
            )}
            <p className="drawer-desc">{selectedNode.desc}</p>
            {selectedNode.involves && selectedNode.involves.length > 0 && (
              <div className="drawer-section">
                <div className="drawer-section-title">牵涉力量</div>
                <div className="drawer-tags">
                  {selectedNode.involves.map((n) => (
                    <span key={n} className="drawer-tag">
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {selectedNode.voices && selectedNode.voices.length > 0 && (
              <div className="drawer-section">
                <div className="drawer-section-title">亲历者证言</div>
                <div className="drawer-voices-list">
                  {selectedNode.voices.map((v, i) => (
                    <div key={i} className="drawer-voice-card">
                      <span className="dv-speaker">{v.name}</span>
                      <p className="dv-quote">“{v.line}”</p>
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

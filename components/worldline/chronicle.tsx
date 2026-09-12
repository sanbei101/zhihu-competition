"use client";

import type { CSSProperties } from "react";

import { segmentMarkLabels, type WorldlineSegment } from "@/lib/worldline";

/**
 * 观测窗:世界线编年。
 *
 * 这是整屏的主角。玩家回看一条世界线时读的就是这一串 headline ——
 * 它们连起来必须像一部史纲,所以每一段只记一件大事。
 *
 * 深度是靠**越老越沉**做出来的:越靠上的段落透明度越低、浮动周期越慢,
 * 最新的那一段被点亮、挂上"正在发生"。视线因此天然落在下面。
 */

/** 第 index 段的深度。0 是最新 */
function depthOf(total: number, index: number) {
  return total - 1 - index;
}

function marksOf(segment: WorldlineSegment) {
  const marks: string[] = [];
  if (segment.mark) marks.push(segmentMarkLabels[segment.mark]);
  if (segment.kind === "react") marks.push("世界做出的反应");
  return marks;
}

function EraCard({
  segment,
  index,
  total,
  onLit,
}: {
  segment: WorldlineSegment;
  index: number;
  total: number;
  /** 悬停这段时点亮当年在场的力量 */
  onLit: (involves: string[] | null) => void;
}) {
  const depth = depthOf(total, index);
  const isNewest = depth === 0;

  // 每张卡按自己的周期与相位轻轻呼吸 —— 相位用负延迟错开,一开始就不会同步
  const style = {
    "--d": String(depth),
    "--dur": `${6.2 + (index % 3) * 1.15}s`,
    "--delay": `${-index * 1.45}s`,
  } as CSSProperties;

  return (
    <li
      className="era"
      data-newest={isNewest ? "1" : "0"}
      style={style}
      onMouseEnter={() => onLit(segment.involves)}
      onMouseLeave={() => onLit(null)}
    >
      <span className="node" />
      <div className="float">
        <article className="card">
          <div className="top">
            <span className="no">纪元 {index + 1}</span>
            <span className="at">{segment.at}</span>
            {marksOf(segment).map((text) => (
              <span
                key={text}
                className={`mark ${segment.kind === "react" ? "react" : (segment.mark ?? "echo")}`}
              >
                {text}
              </span>
            ))}
            {isNewest ? (
              <span className="live">
                <i />
                正在发生
              </span>
            ) : null}
          </div>
          <p className="headline">{segment.headline}</p>
          {segment.aftermath ? <p className="body">{segment.aftermath}</p> : null}
        </article>
      </div>
    </li>
  );
}

export function Chronicle({
  timeline,
  scrollerRef,
  onLit,
}: {
  timeline: readonly WorldlineSegment[];
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  onLit: (involves: string[] | null) => void;
}) {
  return (
    <aside className="rail-wrap">
      <div className="rail-head">
        <span className="dot" />
        <span>世界线 · 编年</span>
        <span className="count">{timeline.length} 段</span>
      </div>
      <div className="scroller" ref={scrollerRef}>
        <div className="axis" />
        <ol className="eras">
          {timeline.map((segment, index) => (
            <EraCard
              key={`${index}-${segment.at}`}
              segment={segment}
              index={index}
              total={timeline.length}
              onLit={onLit}
            />
          ))}
        </ol>
      </div>
    </aside>
  );
}

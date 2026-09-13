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
      className="group relative"
      data-newest={isNewest ? "1" : "0"}
      style={style}
      onMouseEnter={() => onLit(segment.involves)}
      onMouseLeave={() => onLit(null)}
    >
      <span className="group-data-[newest=1]:bg-primary absolute top-5 -left-[26px] size-[9px] rotate-45 bg-(--obs-px-x) shadow-[0_0_0_3px_rgba(32,22,15,0.9)] transition-[background,box-shadow] duration-300 group-data-[newest=1]:shadow-[0_0_0_3px_rgba(32,22,15,0.9),0_0_16px_rgba(232,163,61,0.9)]" />
      <div className="float">
        <article className="border-border group-hover:border-primary group-data-[newest=1]:border-primary rounded-[3px] border bg-[rgba(49,35,26,0.8)] px-[13px] pt-[11px] pb-3 [opacity:calc(1_-_var(--d,0)*0.15)] shadow-[0_12px_26px_-18px_rgba(0,0,0,0.95)] transition-[border-color,box-shadow,transform,opacity] duration-300 group-hover:-translate-x-1 group-hover:opacity-100 group-hover:shadow-[0_0_0_1px_rgba(232,163,61,0.25),0_14px_30px_-18px_#000] group-data-[newest=1]:shadow-[0_0_0_1px_rgba(232,163,61,0.3),0_0_30px_-8px_rgba(232,163,61,0.42),0_16px_32px_-20px_#000]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-primary font-mono text-[11px] tracking-[0.08em]">
              纪元 {index + 1}
            </span>
            <span className="text-muted-foreground font-mono text-[10px] opacity-80">
              {segment.at}
            </span>
            {marksOf(segment).map((text) => (
              <span
                key={text}
                className={`rounded-[2px] px-1.25 py-px font-mono text-[9.5px] leading-[1.6] tracking-[0.06em] ${
                  segment.kind === "react"
                    ? "text-primary border border-dashed border-[rgba(232,163,61,0.5)] bg-[rgba(232,163,61,0.12)]"
                    : segment.mark === "crisis"
                      ? "border border-[rgba(239,68,68,0.5)] bg-[rgba(239,68,68,0.16)] text-[#f87171]"
                      : "border border-[rgba(251,191,36,0.5)] bg-[rgba(251,191,36,0.16)] text-[#fbbf24]"
                }`}
              >
                {text}
              </span>
            ))}
            {isNewest ? (
              <span className="text-primary ml-auto inline-flex items-center gap-1.25 font-mono text-[9.5px] tracking-[0.14em]">
                <i className="bg-primary size-[5px] animate-[blink_1.3s_ease-in-out_infinite] rounded-full" />
                正在发生
              </span>
            ) : null}
          </div>
          <p className="border-border group-data-[newest=1]:border-l-primary mt-2 border-l-2 pl-2.5 text-[14.5px] leading-[1.62] font-semibold">
            {segment.headline}
          </p>
          {segment.aftermath ? (
            <p className="text-muted-foreground mt-2 pl-2.5 text-[12.5px] leading-[1.85]">
              {segment.aftermath}
            </p>
          ) : null}
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
    <aside className="border-border relative z-[4] flex min-w-0 flex-col border-l bg-[linear-gradient(200deg,rgba(32,22,15,0.3),rgba(32,22,15,0.72))] backdrop-blur-[8px]">
      <div className="border-border text-muted-foreground flex items-center gap-2 border-b px-[14px] pt-[11px] pb-[9px] font-mono text-[10px] tracking-[0.18em] uppercase">
        <span className="size-1.5 rotate-45 bg-(--obs-px)" />
        <span>世界线 · 编年</span>
        <span className="ml-auto tracking-[0.06em]">{timeline.length} 段</span>
      </div>
      <div
        className="scroller relative min-h-0 flex-1 overflow-y-auto px-4 pt-[14px] pb-[22px] pl-10"
        ref={scrollerRef}
      >
        <div className="absolute top-0 bottom-0 left-5 w-0.5 bg-[linear-gradient(180deg,transparent,var(--obs-accent-soft)_8%,var(--obs-accent-soft)_92%,transparent)]" />
        <ol className="flex list-none flex-col gap-4 p-0">
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

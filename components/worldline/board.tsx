"use client";

import type { CSSProperties } from "react";

import { StandSvg } from "@/components/worldline/sprites";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import {
  TONE_RIBBON,
  eventToneLabels,
  type WorldlineBeing,
  type WorldlineEvent,
  type WitnessArchetype,
} from "@/lib/worldline";

/**
 * 牌桌:见证者 + 事件带。
 *
 * 这里没有手牌、没有选项。五件事按节拍一张张落到桌上,落定之后各自轻轻呼吸 ——
 * 玩家不需要做任何决定,他要做的是看世界怎么接。
 */

/** 已成形的第 index 件事。悬停不加效果:它不是可点的东西 */
function EventCard({
  event,
  index,
  playing,
  played,
  beingNames,
}: {
  event: WorldlineEvent;
  index: number;
  playing: boolean;
  played: boolean;
  beingNames: (id: string) => string;
}) {
  // 落牌的方向左右交替,五张因此读起来是"撒下来"而不是"排上去"
  const style = {
    "--delay": `${index * 0.26}s`,
    "--fx": `${index % 2 === 0 ? -22 : 22}px`,
    "--dur": `${5.6 + (index % 3) * 0.8}s`,
  } as CSSProperties;

  return (
    <article
      className={`ecard border-border relative flex min-h-[162px] w-[182px] flex-col gap-[7px] overflow-hidden rounded-[3px] border bg-[rgba(49,35,26,0.72)] px-3 pt-3 pb-2.5 transition-[border-color,box-shadow,opacity] duration-300 max-md:min-h-[138px] max-md:w-[clamp(210px,66vw,260px)] max-md:shrink-0 max-md:snap-start max-md:p-2.5 ${
        playing
          ? "border-primary shadow-[0_0_0_1px_rgba(232,163,61,0.3),0_0_26px_-8px_rgba(232,163,61,0.5)]"
          : ""
      } ${played ? "opacity-60" : ""}`}
      data-tone={event.tone}
      style={style}
    >
      <span
        className={`absolute top-0 left-0 h-[3px] w-full ${playing ? "animate-[blink_1.2s_ease-in-out_infinite]" : ""}`}
        style={{ background: TONE_RIBBON[event.tone] }}
      />
      <div className="flex items-center gap-1.5">
        <span
          className={`rounded-[2px] px-1.5 py-px font-mono text-[9.5px] leading-[1.6] tracking-[0.06em] data-[tone=bad]:border data-[tone=bad]:border-[rgba(239,68,68,0.5)] data-[tone=bad]:bg-[rgba(239,68,68,0.16)] data-[tone=bad]:text-[#f87171] data-[tone=good]:border data-[tone=good]:border-[rgba(16,185,129,0.55)] data-[tone=good]:bg-[rgba(16,185,129,0.18)] data-[tone=good]:text-[#34d399] data-[tone=odd]:border data-[tone=odd]:border-[rgba(217,70,239,0.5)] data-[tone=odd]:bg-[rgba(217,70,239,0.16)] data-[tone=odd]:text-[#e879f9]`}
          data-tone={event.tone}
        >
          {eventToneLabels[event.tone]}
        </span>
        <span className="text-muted-foreground ml-auto font-mono text-[9.5px]">{event.at}</span>
      </div>
      <p className="text-[11.5px] leading-[1.72] max-md:line-clamp-2 max-md:max-h-[2.9em] max-md:text-xs max-md:leading-[1.45]">
        {event.title}
      </p>
      <div className="border-border mt-auto flex items-center gap-1.5 border-t pt-1.5 max-md:text-[10.5px]">
        <span className="text-muted-foreground min-w-0 truncate text-[10px]">
          {event.involves.map(beingNames).join(" · ")}
        </span>
        <span className="text-primary ml-auto flex-none font-mono text-[9.5px]">
          {event.reactions.length} 条反应
        </span>
      </div>
    </article>
  );
}

export function EventBoard({
  beings,
  witnessName,
  witnessArchetype,
  witnessLine,
  skin,
  events,
  pending,
  playing,
  played,
}: {
  beings: readonly WorldlineBeing[];
  witnessName: string;
  witnessArchetype: WitnessArchetype;
  witnessLine: string;
  skin: ScenarioSkin;
  /** 已经落到桌上的那几件。它是一个前缀,还没露面的在后面排队 */
  events: readonly WorldlineEvent[];
  /** 还扣着的张数 */
  pending: number;
  /** 正在播反应的那件事的下标 */
  playing: number | null;
  /** 反应已经播完的那几件事 */
  played: readonly number[];
}) {
  const nameOf = (id: string) => beings.find((being) => being.id === id)?.name ?? id;

  return (
    <section className="flex flex-wrap items-start justify-center gap-5 max-md:w-full max-md:flex-col max-md:items-stretch max-md:gap-2.5">
      <div className="max-md:border-border flex max-w-[318px] flex-none items-start gap-3 max-md:w-full max-md:max-w-full max-md:items-center max-md:gap-2.5 max-md:rounded-md max-md:border max-md:bg-[rgba(32,22,15,0.72)] max-md:p-2.5">
        <span className="flex-none [filter:drop-shadow(0_6px_0_rgba(0,0,0,0.4))] max-md:[filter:drop-shadow(0_3px_0_rgba(0,0,0,0.4))] [&_svg]:max-md:size-9">
          <StandSvg archetype={witnessArchetype} skin={skin} scale={4} label={witnessName} />
        </span>
        <div className="border-border before:border-border relative mt-3.5 rounded-[3px] border bg-[rgba(49,35,26,0.78)] px-3 py-2.5 text-[12.5px] leading-[1.75] before:absolute before:top-[14px] before:-left-[5px] before:size-2 before:rotate-45 before:border-b before:border-l before:bg-inherit max-md:mt-0 max-md:flex-1 max-md:border-0 max-md:bg-transparent max-md:p-0 max-md:text-[11.5px] max-md:leading-[1.5] max-md:before:hidden">
          <span className="text-primary mb-1 block font-mono text-[9.5px] tracking-[0.14em] max-md:mb-0.5 max-md:text-[9px]">
            {witnessName}
          </span>
          <span>{witnessLine}</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-stretch justify-center gap-3 max-md:w-full max-md:snap-x max-md:snap-mandatory max-md:scrollbar-none max-md:flex-nowrap max-md:justify-start max-md:gap-2.5 max-md:overflow-x-auto max-md:p-[2px_2px_8px]">
        {events.map((event, index) => (
          <EventCard
            key={event.id}
            event={event}
            index={index}
            playing={playing === index}
            played={played.includes(index)}
            beingNames={nameOf}
          />
        ))}
        {Array.from({ length: pending }, (_, index) => (
          <article
            key={`pending-${index}`}
            className="ecard border-border relative flex min-h-[162px] w-[182px] flex-col gap-[7px] overflow-hidden rounded-[3px] border bg-[rgba(49,35,26,0.72)] px-3 pt-3 pb-2.5 opacity-50 max-md:min-h-[138px] max-md:w-[clamp(130px,40vw,170px)] max-md:shrink-0 max-md:snap-start max-md:p-2.5"
          />
        ))}
      </div>
    </section>
  );
}

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

  const classes = ["ecard"];
  if (playing) classes.push("playing");
  if (played) classes.push("played");

  return (
    <article className={classes.join(" ")} data-tone={event.tone} style={style}>
      <span className="ribbon" style={{ background: TONE_RIBBON[event.tone] }} />
      <div className="ec-head">
        <span className="tone">{eventToneLabels[event.tone]}</span>
        <span className="at">{event.at}</span>
      </div>
      <p className="ec-title">{event.title}</p>
      <div className="ec-foot">
        <span className="who">{event.involves.map(beingNames).join(" · ")}</span>
        <span className="rn">{event.reactions.length} 条反应</span>
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
    <section className="board">
      <div className="witness">
        <span className="stand">
          <StandSvg archetype={witnessArchetype} skin={skin} scale={4} label={witnessName} />
        </span>
        <div className="bubble">
          <span className="who">{witnessName}</span>
          <span>{witnessLine}</span>
        </div>
      </div>

      <div className="events">
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
          <article key={`pending-${index}`} className="ecard pending" />
        ))}
      </div>
    </section>
  );
}

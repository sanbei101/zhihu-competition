import type {
  EraSnapshot,
  EventChoice,
  GlobalMetric,
  SpecialEventKind,
  WitnessLine,
  WorldEntity,
  WorldFork,
  WorldSeed,
  WorldSimSession,
} from "@/lib/world-sim";
import { entityKindLabels, eventSeverityLabels, specialEventLabels } from "@/lib/world-sim";

/**
 * 牌面投影层。
 *
 * 世界模型(lib/world-sim.ts)描述的是"世界发生了什么";
 * 这里负责把它翻译成"玩家面前会出现哪几张牌"。
 *
 * 这一层是纯函数、零副作用,而且是**唯一的**翻译入口 ——
 * 界面上不会出现任何"从 snapshot 直接抓字段"的散装逻辑,
 * 所以"一张牌长什么样"这件事永远只有一个地方需要改。
 *
 * 牌有五种:
 *   origin     原点卡。整个世界的起因,开局第一张
 *   event      事件卡。一次裁决里带得动取舍的事件,一阶段最多 4 张
 *   fork       分叉卡。历史自己裂成两条时的那张牌
 *   attention  见证者之问。兜底牌 —— 一次裁决什么取舍都没给出来时,
 *              让玩家至少还能决定"这一阶段盯住什么"
 *   settle     结算卡。世界收敛时发出,把整条世界线交给"结算即内容"
 */

export type CardKind = "origin" | "event" | "fork" | "attention" | "settle";

/** 卡面上展示的指标变化。label 是给人看的,metricId 是给结算用的 */
export interface CardDelta {
  metricId: string;
  label: string;
  delta: number;
}

export interface WorldCard {
  id: string;
  kind: CardKind;
  era: number;
  /** 卡面左上角的小标签,如「军略」「异象」「世界线分岔」 */
  tag: string;
  /** 决定卡面顶部色带与是否打上"危急"标记 */
  severity: "info" | "notable" | "severe" | "critical";
  title: string;
  body: string;
  /** 参与这件事的主体名,渲染成卡面右上角的小标签 */
  actors: string[];
  /** 见证者对这件事的一句评述,渲染在角色旁边的气泡里 */
  narrator: WitnessLine | null;
  /** 特殊事件类型。event 卡的额外身份 */
  special: SpecialEventKind | null;
  /** 事件卡/见证者之问的选项。分叉卡与原点卡不用这个字段 */
  choices: EventChoice[];
  /** 分叉卡的数据 */
  fork: WorldFork | null;
  /** 结算卡用:这一阶段的净变化 */
  deltas: CardDelta[];
}

/** 一次裁决最多发几张带取舍的牌。与 reducer 的 MAX_CHOICE_CARDS 同源 */
const MAX_CARDS_PER_ERA = 4;

function nameOf(entities: WorldEntity[], id: string): string | undefined {
  return entities.find((entity) => entity.id === id)?.name;
}

function namesOf(entities: WorldEntity[], ids: readonly string[]): string[] {
  return ids.map((id) => nameOf(entities, id)).filter((name): name is string => Boolean(name));
}

/** 严重度排序,让最要紧的那张牌先发 */
const SEVERITY_RANK: Record<WorldCard["severity"], number> = {
  critical: 0,
  severe: 1,
  notable: 2,
  info: 3,
};

/** 指标变化的人话标签,供结算与空桌状态共用 */
export function metricDeltas(
  metrics: readonly GlobalMetric[],
  deltas: readonly { metricId: string; delta: number }[],
): CardDelta[] {
  return deltas
    .map((item) => {
      const metric = metrics.find((candidate) => candidate.id === item.metricId);
      if (!metric) return null;
      return { metricId: metric.id, label: metric.label, delta: item.delta };
    })
    .filter((item): item is CardDelta => item !== null && item.delta !== 0);
}

/**
 * 原点卡。整个世界的起因,开局第一张。
 *
 * 它不承担"选择"的功能 —— 它是让玩家看一眼自己刚刚改动了什么,
 * 顺便听见证者说第一句话。
 */
export function originCard(seed: WorldSeed): WorldCard {
  return {
    id: "card-origin",
    kind: "origin",
    era: 0,
    tag: "反事实原点",
    severity: "severe",
    title: seed.premise.statement,
    body: `改动发生在${seed.premise.divergencePoint}。受影响的是${seed.premise.affectedDomains.join("、")}。从这里往下,世界会自己走。`,
    actors: seed.entities.slice(0, 4).map((entity) => entity.name),
    narrator: { speaker: seed.witness.name, line: seed.witness.openingLine },
    special: null,
    choices: [],
    fork: null,
    deltas: [],
  };
}

/**
 * 把一次裁决投影成一阶段的手牌。
 *
 * 顺序刻意是"事件在前、分叉在最后":分叉是这一阶段的收束,
 * 它必须最后出现,否则玩家会在读到一半的时候就被告知"历史裂开了"。
 */
export function eraCards(input: {
  session: WorldSimSession;
  snapshot: EraSnapshot;
  fork: WorldFork | null;
}): WorldCard[] {
  const { session, snapshot, fork } = input;
  const entities = session.state.entities;

  const eventCards: WorldCard[] = snapshot.events
    .filter((event) => event.choices && event.choices.length >= 2)
    .slice(0, MAX_CARDS_PER_ERA)
    .map((event) => ({
      id: `card-${event.id}`,
      kind: "event" as const,
      era: event.era,
      tag: event.special ? specialEventLabels[event.special] : eventSeverityLabels[event.severity],
      severity: event.special ? "critical" : event.severity,
      title: event.title,
      body: event.summary,
      actors: namesOf(entities, event.actorEntityIds),
      narrator: event.narrator ?? null,
      special: event.special ?? null,
      choices: event.choices ?? [],
      fork: null,
      deltas: [],
    }));

  // 顺序:特殊事件 > 严重度。危机/回响/异象是这个阶段最该被看见的东西,
  // 它们必须排在常规事件前面,否则玩家会在第四张牌上就失去注意力。
  eventCards.sort((a, b) => {
    if (a.special && !b.special) return -1;
    if (!a.special && b.special) return 1;
    return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  });

  const cards = [...eventCards];

  // 兜底:一次裁决给出的取舍太少时,补一张"见证者之问"。
  //
  // 真实事故:有一轮模型六条事件一条选项都没配,于是整个阶段玩家只有"推进时间"可点 ——
  // 那是牌局退化成按钮。这张兜底牌把"这一阶段你想盯住哪一件"变成三个真选项,
  // 至少保证玩家手上有一张能动的东西。
  //
  // 注意它只补一张:0 条取舍 + 1 张兜底牌是这套机制的下限,
  // 真正的解法是提示词要求每阶段必须有 2-4 条带取舍的事件,而不是靠这里堆牌。
  if (cards.length < 2) {
    const fallback = attentionCard(session, snapshot);
    if (fallback) cards.push(fallback);
  }

  // 分叉永远排在最后:它是这一阶段的收束,不能提前剧透"历史裂开了"
  if (fork) {
    cards.push({
      id: `card-${fork.id}`,
      kind: "fork",
      era: fork.era,
      tag: "世界线分岔",
      severity: "critical",
      title: fork.title,
      body: fork.cause,
      actors: [],
      narrator: null,
      special: null,
      choices: [],
      fork,
      deltas: [],
    });
  }

  return cards;
}

/**
 * 见证者之问 —— 兜底牌。
 *
 * 它问的不是"世界该怎么办",而是"你想盯住哪一件"。
 * 这恰好是观察者真正拥有的权力:他改不了世界,但他决定自己把注意力放在哪里,
 * 而被注视的那件事会在下一阶段长出更多细节。
 */
function attentionCard(session: WorldSimSession, snapshot: EraSnapshot): WorldCard | null {
  const notable = snapshot.events.slice(0, 3);
  const witness = session.seed.witness;

  if (notable.length === 0) return null;

  const choices: EventChoice[] = notable.map((event, index) => ({
    id: `attention-${index + 1}`,
    label: `盯住「${event.title}」`,
    hint: event.summary,
    tone: index === 0 ? "bold" : "cautious",
    effects: [],
  }));

  return {
    id: `card-attention-${snapshot.id}`,
    kind: "attention",
    era: snapshot.era,
    tag: "见证者之问",
    severity: "notable",
    title: `${witness.name}问：这一阶段,你想盯住哪一件?`,
    body: `${snapshot.conclusion}\n\n没人顾得上所有事。你盯住哪一件,它下一阶段就会长出更多东西来。`,
    actors: [],
    narrator: {
      speaker: witness.name,
      line: "我不能替你决定看哪儿 —— 但我可以告诉你,这几件事我一件也没看明白。",
    },
    special: null,
    choices,
    fork: null,
    deltas: [],
  };
}

/**
 * 结算卡。世界收敛(或者玩家自己喊停)时发出来。
 *
 * 它本身不做任何计算,只负责把玩家的视线引到"这条世界线可以被写成一篇文章"上。
 */
export function settleCard(session: WorldSimSession): WorldCard {
  const eras = session.snapshots.length;
  const directives = session.directives.length;
  const forks = session.forks.filter((fork) => fork.selectedAlternativeId).length;

  return {
    id: "card-settle",
    kind: "settle",
    era: session.state.currentEra,
    tag: "结算",
    severity: "notable",
    title: "这条世界线,可以发出去了",
    body: `你陪着这个世界走了 ${eras} 个阶段,在 ${directives} 个节点上替它做过取舍,看着它裂开过 ${forks} 次。这些都会被整理成一篇能直接发到知乎的推演长文。`,
    actors: [],
    narrator: {
      speaker: session.seed.witness.name,
      line: "到这儿吧。再往下的事,已经不需要有人看着了。",
    },
    special: null,
    choices: [],
    fork: null,
    deltas: [],
  };
}

/** 世界是否已经收敛(最近一次裁决给了 stabilized) */
export function hasSettled(session: WorldSimSession): boolean {
  return session.snapshots.at(-1)?.stabilized === true;
}

/** 主体类型标签,卡面以外的地方(如势力详情)复用 */
export function entityKindLabel(entity: WorldEntity): string {
  return entityKindLabels[entity.kind];
}

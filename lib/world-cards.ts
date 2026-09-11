import type {
  CardTier,
  EraSnapshot,
  EventChoice,
  GlobalMetric,
  SpecialEventKind,
  WitnessLine,
  WorldEntity,
  WorldEvent,
  WorldFork,
  WorldSeed,
  WorldSimSession,
} from "@/lib/world-sim";
import { CARD_TIER_ORDER, cardTierGrades, cardTierLabels, entityKindLabels } from "@/lib/world-sim";

/**
 * 牌面投影层。
 *
 * 世界模型(lib/world-sim.ts)描述的是"世界发生了什么";
 * 这里负责把它翻译成"玩家面前会出现哪几张牌"。
 *
 * v4 起的规则:一批发 5 张、**全部背面朝上**,玩家只能翻一张。
 * 没翻到的牌不是不存在 —— 世界照样往前走了,只是你没能盯住它们。
 * 这是"观察者"设定的游戏化:你的注意力是稀缺资源,而稀有度是抽卡的赌注。
 *
 * 这一层是纯函数、零副作用,而且是**唯一的**翻译入口 ——
 * 界面上不会出现任何"从 snapshot 直接抓字段"的散装逻辑。
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
  /** 稀有度。翻牌前它藏在背面,翻开后决定色带与角标 */
  tier: CardTier;
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

/** 一批的规模。5 张是读得完的上限,也是抽卡手感的下限 */
export const HAND_SIZE = 5;

/**
 * 事件的属性 -> 稀有度。**确定性映射**,模型不给稀有度,它只给事实:
 *   金 只给 echo  —— 它是玩家自己的选择在远处结出的果
 *   彩 只给 anomaly 与世界线分岔 —— 规则之外的东西
 *   其余按 severity 走 白/绿/蓝/红 的常规谱系
 */
function tierFor(event: {
  severity: WorldEvent["severity"];
  special?: SpecialEventKind | null;
}): CardTier {
  if (event.special === "echo") return "gold";
  if (event.special === "anomaly") return "prism";
  switch (event.severity) {
    case "critical":
      return "red";
    case "severe":
      return "blue";
    case "notable":
      return "green";
    default:
      return "white";
  }
}

function nameOf(entities: WorldEntity[], id: string): string | undefined {
  return entities.find((entity) => entity.id === id)?.name;
}

function namesOf(entities: WorldEntity[], ids: readonly string[]): string[] {
  return ids.map((id) => nameOf(entities, id)).filter((name): name is string => Boolean(name));
}

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
 * 原点卡。整个世界的起因,开局第一张,也是唯一一张**开局就正面朝上**的牌 ——
 * 它是前提,不是赌注。
 */
export function originCard(seed: WorldSeed): WorldCard {
  return {
    id: "card-origin",
    kind: "origin",
    era: 0,
    tag: "反事实原点",
    tier: "red",
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

function specialTag(kind: SpecialEventKind): string {
  if (kind === "crisis") return "危机";
  if (kind === "echo") return "回响";
  return "异象";
}

function severityTag(severity: WorldEvent["severity"]): string {
  if (severity === "critical") return "危急";
  if (severity === "severe") return "严峻";
  if (severity === "notable") return "波澜";
  return "日常";
}

/**
 * 发一手牌:把一次裁决投影成本阶段的盲抽手牌。
 *
 * **全部事件都进手牌**,不只是带取舍的那些 —— 没有可干预点的事件
 * 翻开来就是一段纯叙事(一张白卡),这也是抽卡的一部分:
 * 不是每张牌都值得你停下,但你只有翻开来才知道。
 */
export function dealHand(input: {
  session: WorldSimSession;
  snapshot: EraSnapshot;
  fork: WorldFork | null;
}): WorldCard[] {
  const { session, snapshot, fork } = input;
  const entities = session.state.entities;

  const cards: WorldCard[] = snapshot.events.slice(0, HAND_SIZE).map((event) => ({
    id: `card-${event.id}`,
    kind: "event",
    era: event.era,
    tag: event.special ? specialTag(event.special) : severityTag(event.severity),
    tier: tierFor(event),
    title: event.title,
    body: event.summary,
    actors: namesOf(entities, event.actorEntityIds),
    narrator: event.narrator ?? null,
    special: event.special ?? null,
    choices: event.choices ?? [],
    fork: null,
    deltas: [],
  }));

  // 世界线分岔也是手牌里的一张 —— 而且是最彩的那张。
  // 它藏在背面,和其余几张一起被赌;翻到它,这一阶段就走上了另一条世界线。
  if (fork) {
    cards.push({
      id: `card-${fork.id}`,
      kind: "fork",
      era: fork.era,
      tag: "世界线分岔",
      tier: "prism",
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

  // 兜底:一次裁决一条事件都没给出来时,把结论包成一张牌。
  // 没有它,这个阶段玩家连可翻的东西都没有。
  if (cards.length === 0) {
    const witness = session.seed.witness;
    cards.push({
      id: `card-attention-${snapshot.id}`,
      kind: "attention",
      era: snapshot.era,
      tag: "见证者之问",
      tier: "green",
      title: `${witness.name}问：这一阶段发生了什么?`,
      body: snapshot.conclusion,
      actors: [],
      narrator: {
        speaker: witness.name,
        line: "这一阶段安静得反常。连一件值得记下的事都没有,这本身就是一件事。",
      },
      special: null,
      choices: [],
      fork: null,
      deltas: [],
    });
  }

  return cards;
}

/** 本批的稀有度构成。发给玩家看的预告 —— 知道里面有红卡,但不知道在哪 */
export function tierHistogram(cards: readonly WorldCard[]): { tier: CardTier; count: number }[] {
  const counts = new Map<CardTier, number>();
  for (const card of cards) counts.set(card.tier, (counts.get(card.tier) ?? 0) + 1);

  return CARD_TIER_ORDER.filter((tier) => counts.has(tier)).map((tier) => ({
    tier,
    count: counts.get(tier) ?? 0,
  }));
}

export { cardTierGrades, cardTierLabels };

/**
 * 结算卡。世界收敛(或者玩家自己喊停)时发出来。
 * 它本身不做任何计算,只负责把玩家的视线引到"这条世界线可以被写成一篇文章"上。
 */
export function settleCard(session: WorldSimSession): WorldCard {
  const eras = session.snapshots.length;
  const directives = session.directives.length;

  return {
    id: "card-settle",
    kind: "settle",
    era: session.state.currentEra,
    tag: "结算",
    tier: "gold",
    title: "这条世界线,可以发出去了",
    body: `你陪着这个世界走了 ${eras} 个阶段,在 ${directives} 个节点上替它做过取舍。这些都会被整理成一篇能直接发到知乎的推演长文。`,
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

/** 主体类型标签,卡面以外的地方(如舞台的势力条)复用 */
export function entityKindLabel(entity: WorldEntity): string {
  return entityKindLabels[entity.kind];
}

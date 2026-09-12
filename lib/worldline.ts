/**
 * 世界线观测台的世界模型。
 *
 * 与旧的"牌局"模型最大的区别:这里没有手牌、没有选项、没有玩家取舍。
 *
 *   世界不被谁改写。它自己一波一波地出事,自己一波一波地反应 ——
 *   反应可以滞后几十年、几百年,甚至几百万年。
 *   玩家的位置是一台观测台上的观察者:他能做的只有看,以及决定世界什么时候继续走。
 *
 * 于是整个世界线只剩两种东西:
 *   1. 事件波次(WorldlineWave) —— 一次五件大事,好坏混杂,不由玩家挑选
 *   2. 编年史(WorldlineSegment[]) —— 事件与世界的反应,按时间先后串成一条线
 *
 * 舞台上那几个开口说话的小人(WorldlineVoice)是这条线上唯一的人味:
 * 他们不是主体,是活在那些年份里的具体的人。
 */

// ==================== 尺度与类型 ====================

/** 模拟模式:决定世界如何演化,以及会出现哪些主体 */
export type SimulationMode =
  | "historical-civilization"
  | "ecological-evolution"
  | "survival-collapse"
  | "planetary-disaster"
  | "post-human"
  | "socio-technical"
  | "first-contact";

export const simulationModeLabels: Record<SimulationMode, string> = {
  "historical-civilization": "历史文明",
  "ecological-evolution": "生态演化",
  "survival-collapse": "生存崩溃",
  "planetary-disaster": "行星灾变",
  "post-human": "后人类",
  "socio-technical": "社会技术",
  "first-contact": "首次接触",
};

/** 世界主体类型。11 种,覆盖从政权到行星系统的全部尺度 */
export type EntityKind =
  | "state"
  | "faction"
  | "population"
  | "ecosystem"
  | "species"
  | "company"
  | "institution"
  | "technology"
  | "ai"
  | "alien"
  | "planetary-system";

export const entityKindLabels: Record<EntityKind, string> = {
  state: "政权",
  faction: "势力",
  population: "人群",
  ecosystem: "生态系统",
  species: "物种",
  company: "企业",
  institution: "机构",
  technology: "技术系统",
  ai: "智能系统",
  alien: "异星文明",
  "planetary-system": "行星系统",
};

/** 时间尺度。反事实一旦成立,时间可以按小时走,也可以按百万年走 */
export type TimeScale =
  | "hour"
  | "day"
  | "week"
  | "month"
  | "year"
  | "decade"
  | "century"
  | "millennium"
  | "mega-annum";

export const timeScaleLabels: Record<TimeScale, string> = {
  hour: "小时",
  day: "天",
  week: "周",
  month: "月",
  year: "年",
  decade: "十年",
  century: "世纪",
  millennium: "千年",
  "mega-annum": "百万年",
};

/**
 * 舞台小人的像素原型。
 *
 * 与 themeId 无关:这里的小人是在这条世界线里活过的具体的人,
 * 一个恐龙世界里的旁白可能长着人的样子 —— 因为他本来就是那个世界的人。
 */
export type WitnessArchetype =
  | "human"
  | "dinosaur"
  | "alien"
  | "machine"
  | "astronaut"
  | "microbe"
  | "survivor";

export const witnessArchetypeLabels: Record<WitnessArchetype, string> = {
  human: "人",
  dinosaur: "恐龙",
  alien: "外星来客",
  machine: "机器",
  astronaut: "宇航员",
  microbe: "菌落",
  survivor: "幸存者",
};

/**
 * 主题 -> 牌桌旁边那位见证者的造型。
 *
 * 刻意做成确定性映射,不让模型自己挑 —— 三国世界里站出一只恐龙会让整套视觉当场垮掉。
 * 注意这只管"牌桌旁边那位";舞台上的小人由模型按世界本身挑,那才是他们该有的样子。
 */
const WITNESS_ARCHETYPE_BY_THEME: Record<string, WitnessArchetype> = {
  "three-kingdoms": "human",
  "qin-han": "human",
  "tang-song-ming": "human",
  dino: "dinosaur",
  alien: "alien",
  "future-tech": "machine",
  "after-human": "machine",
  cosmic: "astronaut",
  evolution: "microbe",
  apocalypse: "survivor",
};

export function witnessArchetypeFor(themeId: string | undefined): WitnessArchetype {
  if (!themeId) return "human";
  return WITNESS_ARCHETYPE_BY_THEME[themeId] ?? "human";
}

// ==================== 舞台台词 ====================

/**
 * 舞台上开口的那一个小人。
 *
 * at / scale / lift 是站位,由 reducer 按这一组的人数**确定性**分配 ——
 * 不让模型管排版,一是它算不准,二是原型期真的踩过"气泡压住徽记"的坑。
 * 模型只负责两件事:这人是谁(name),他此刻说了什么(line)。
 */
export interface WorldlineVoice {
  key: WitnessArchetype;
  /** 色板微调 0/1/2,同一个 shift 永远长成同一个人 */
  shift: number;
  /** 舞台横向锚点百分比(0-100),渲染时配合 translateX(-50%) */
  at: number;
  scale: number;
  /** 抬升像素,避免相邻两个小人的气泡打架 */
  lift: number;
  name: string;
  line: string;
}

// ==================== 事件与反应 ====================

/** 一件事的倾向。世界不为玩家挑好事,好坏一起落 */
export type EventTone = "good" | "bad" | "odd";

export const eventToneLabels: Record<EventTone, string> = {
  good: "利",
  bad: "险",
  odd: "异",
};

/** 卡片顶部那道色带 */
export const TONE_RIBBON: Record<EventTone, string> = {
  good: "#10b981",
  bad: "#ef4444",
  odd: "#d946ef",
};

/**
 * 世界对某件事做出的一个反应。
 *
 * delay 是这件事与反应之间的时间距离,可以很长 ——
 * "三十年后""两百年后""次日"。世界不是被事件直接推动的,
 * 很多反应要等很久才浮出来,这正是"文明尺度"的观感来源。
 */
export interface WorldlineReaction {
  /** 做出反应的主体 id */
  by: string;
  delay: string;
  text: string;
  voices: WorldlineVoice[];
}

/** 世界线上的一件大事。够不上"大事"的,不进这一波 */
export interface WorldlineEvent {
  id: string;
  tone: EventTone;
  /** 发生时间,如"一百七十年前" */
  at: string;
  /** 被卷进来的主体 id,悬停事件卡时点亮它们 */
  involves: string[];
  title: string;
  reactions: WorldlineReaction[];
}

// ==================== 编年史 ====================

/**
 * 编年史上的一段。
 *
 *   event 世界出了这件事(第一句是标题,第二句是它带来了什么)
 *   react 某个主体对某件事的回应(可以滞后很多年)
 *
 * 一段只记一件大事 —— 这是整条世界线"宏伟"的来源:
 * 玩家回头读这串 headline,读到的是一部史纲,不是流水账。
 */
export type SegmentKind = "event" | "react";

export interface WorldlineSegment {
  kind: SegmentKind;
  /** 时间刻度,如"六百六十万年前 · 撞击之后" */
  at: string;
  headline: string;
  /** 第二句:这件事带来了什么。可以为空 */
  aftermath: string;
  involves: string[];
  voices: WorldlineVoice[];
  /** 危机 / 回响。普通段不填 */
  mark?: "crisis" | "echo";
}

export const segmentMarkLabels: Record<"crisis" | "echo", string> = {
  crisis: "危机",
  echo: "回响",
};

// ==================== 世界主体 ====================

/** 站在地台上的那股力量。舞台只显示一枚徽记 + 一个状态词 */
export interface WorldlineBeing {
  id: string;
  name: string;
  kind: EntityKind;
  /** 状态词,如"环带在熄灯"。它会随推演变化 */
  status: string;
  /** 本阶段是否被卷入过,决定铭牌上那颗闪动的点 */
  touched: boolean;
}

// ==================== 种子与会话 ====================

/** 反事实前提。整个世界唯一被改动过的地方 */
export interface WorldlinePremise {
  /** 一句话的事实断言 */
  statement: string;
  /** 具体到时间与场景的岔口 */
  divergencePoint: string;
  /** 这个改动直接冲击的领域,2 个显示在前提卡上 */
  domains: string[];
}

/** 世界种子:一次模拟的全部初始条件 */
export interface WorldlineSeed {
  scenarioId: string;
  scenarioTitle: string;
  scenarioUrl: string;
  themeId: string;
  premise: WorldlinePremise;
  /** 时间尺度的展示词,如"百万年" */
  scaleLabel: string;
  /** 站在牌桌旁边的见证者。它整局不换 */
  witnessName: string;
  witnessRole: string;
  /** 世界线徽记与舞台台词要用的小人原型 */
  witnessArchetype: WitnessArchetype;
  beings: WorldlineBeing[];
  /** 开局就已经写下的几段历史。世界不是从零开始的 */
  opening: WorldlineSegment[];
}

/** 一波事件。原型里一手正好五件 */
export interface WorldlineWave {
  index: number;
  events: WorldlineEvent[];
}

/** 一次完整的观测会话 */
export interface WorldlineSession {
  version: 1;
  scenarioId: string;
  scenarioTitle: string;
  scenarioUrl: string;
  themeId: string;
  seed: WorldlineSeed;
  /** 编年史。事件段与反应段按时间先后串在一起 */
  timeline: WorldlineSegment[];
  /**
   * 已经发出的每一波。
   *
   * **不额外存 waveIndex** —— 当前在第几波永远等于 waves.length - 1,
   * 发下一波就是往末尾追加。少一个可以不同步的字段,就少一类 bug。
   */
  waves: WorldlineEvent[][];
  /** 已经播完反应的事件,用 "${wave}:${event}" 记录,避免重复播放 */
  played: string[];
}

/** 存档 key */
export function worldlineStorageKey(scenarioId: string) {
  return `worldline:${scenarioId}`;
}

/** 编年史的段号 = 它在时间线上的位置。不落库,永远由位置推导 */
export function segmentNo(session: WorldlineSession, index: number) {
  return index + 1;
}

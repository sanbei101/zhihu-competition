/**
 * World Simulation v3 的世界模型。
 *
 * 与旧的 world-cast 不同:这里不再有"角色"这个概念。
 * 世界主体(WorldEntity)可以是政权、生态、物种、技术、AI、行星系统 --
 * 它们都有目标、能力、约束和指标,由独立 Agent 推演。
 *
 * 玩家是观察者,不是上帝:世界自主演化,玩家能做的只有两件事 --
 *   1. 推进时间,看世界自己发出什么牌
 *   2. 在世界本来就站得住的几条路之间替它坍缩一次(EventChoice)
 * 玩家的取舍不改写已发生的事,而是成为下一阶段的既有条件(PlayerDirective)。
 *
 * 见证者(WorldWitness)是唯一有温度的东西:它站在卡牌旁边替玩家解说,
 * 可以有情绪、有立场,但说不错事实。
 */

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

/** 一个时间点:纪元编号 + 人类可读的刻度标签 */
export interface TimeState {
  /** 从反事实发生点起算的阶段序号,从 0 开始 */
  era: number;
  /** 展示用的日历式刻度,如 "建安十三年 · 冬" */
  label: string;
  /** 相对反事实点已经走过的时长描述,如 "反事实发生后 4 个月" */
  elapsed: string;
}

/** 反事实前提:整个模拟的唯一初始改动,必须忠实于知乎原题 */
export interface CounterfactualPremise {
  statement: string;
  divergencePoint: string;
  affectedDomains: string[];
  certainty: "given";
}

/** 世界硬约束:不能被任何主体违背的时代、制度、物理规则 */
export interface HardRule {
  id: string;
  /** 约束归属的尺度,决定它约束的是人还是自然 */
  scope: "physics" | "biology" | "institution" | "geography" | "technology";
  statement: string;
}

export const hardRuleScopeLabels: Record<HardRule["scope"], string> = {
  physics: "物理",
  biology: "生物",
  institution: "制度",
  geography: "地理",
  technology: "技术",
};

/** 主体的单项指标。规模、资源、凝聚力这类内部状态 */
export interface EntityMetric {
  id: string;
  label: string;
  value: number;
  /** 0-100 量纲之外的原始口径说明,如 "万户" */
  unit?: string;
}

/** 主体之间的定向关系。-100 敌对,0 中立,100 同盟 */
export interface EntityRelation {
  targetEntityId: string;
  /** 关系类型:博弈、依附、贸易、竞争 */
  posture: "rival" | "ally" | "vassal" | "trade" | "isolated";
  /** 亲疏度 -100..100 */
  affinity: number;
  note: string;
}

export const relationPostureLabels: Record<EntityRelation["posture"], string> = {
  rival: "对抗",
  ally: "同盟",
  vassal: "依附",
  trade: "通商",
  isolated: "隔绝",
};

/** 世界主体:旧 agentCharacter 的替代物。没有 voice / openingLine 这类舞台字段 */
export interface WorldEntity {
  id: string;
  name: string;
  kind: EntityKind;
  /** 一句话说明它在这个世界里代表什么力量 */
  description: string;
  /** 它自己追求什么。多主体博弈的起点就是目标不重叠 */
  goals: string[];
  capabilities: string[];
  constraints: string[];
  metrics: EntityMetric[];
  relations: EntityRelation[];
  /** 像素徽记的造型键,对应 components/pixel/entity-emblem.ts 的生成器 */
  pixelArchetype: string;
  /** 本阶段该主体是否发生了变化,用于控制台高亮 */
  changedThisEra?: boolean;
  /** 结算后的状态词,如 "扩张中" / "濒临崩溃" */
  status?: string;
}

/** 全局指标。不同主题用不同标签,但结构统一 */
export interface GlobalMetric {
  id: string;
  label: string;
  value: number;
  description: string;
  goodDirection: "up" | "down" | "mixed";
  /** 本阶段的变化量,控制台据此显示涨跌 */
  delta?: number;
}

/**
 * 可干预点:事件卡上的一个选项。
 *
 * 世界是自主的,玩家的取舍不是"改写世界",而是在世界本来就站得住的几条路
 * 之间替它坍缩一次。所以每个选项都必须等价成立,不能有"明显更优"的那一个。
 */
export interface EventChoice {
  id: string;
  /** 选项名,四到六字,直接写动作 */
  label: string;
  /** 一句话说清这个选择的代价与收益 */
  hint: string;
  /** 倾向。决定卡面上的图标与语气,不参与数值结算 */
  tone: "bold" | "cautious" | "cunning" | "mercy";
  /**
   * 预估影响。**这只是给玩家看的量级提示**,不是承诺 ——
   * 真正的后果由下一阶段的裁决在合并全部主体行动之后给出。
   */
  effects: { metricId: string; delta: number }[];
}

export const eventChoiceToneLabels: Record<EventChoice["tone"], string> = {
  bold: "进取",
  cautious: "持重",
  cunning: "权变",
  mercy: "怀柔",
};

/** 见证者的一句评述。它是"人味"的来源,不是事实来源 */
export interface WitnessLine {
  /** 说话者自称,与种子里的见证者一致 */
  speaker: string;
  line: string;
}

/**
 * 特殊事件。普通事件是世界按部就班走出来的结果,
 * 特殊事件是三类"不按部就班"的东西:
 *
 *   crisis  危机 —— 硬约束被逼到边缘,世界级的威胁,选项代价都很高
 *   echo    回响 —— 玩家早先某次取舍在远处结出的果,必须回指那一次选择
 *   anomaly 异象 —— 规则之外的东西闯进来,用来打破世界的自我重复
 */
export type SpecialEventKind = "crisis" | "echo" | "anomaly";

export const specialEventLabels: Record<SpecialEventKind, string> = {
  crisis: "危机",
  echo: "回响",
  anomaly: "异象",
};

/**
 * 卡牌稀有度,六档。
 *
 * 命名刻意用颜色而不是 N/R/SR —— 颜色是玩家一眼就能读的语言,
 * 字母等级只作为辅助标注(SSR 这类)挂在 UI 上。
 *
 * 与事件属性的映射是**确定性**的(见 world-cards.ts 的 tierFor):
 *   白/绿/蓝/红 走 severity 的常规谱系
 *   金 只给 echo  —— 它是玩家自己的选择在远处结出的果,天然稀有
 *   彩 只给 anomaly —— 规则之外的东西,配得上彩虹色
 */
export type CardTier = "white" | "green" | "blue" | "red" | "gold" | "prism";

export const cardTierLabels: Record<CardTier, string> = {
  white: "白",
  green: "绿",
  blue: "蓝",
  red: "红",
  gold: "金",
  prism: "彩",
};

/** 字母等级,挂在稀有度角标上,配合颜色一起读 */
export const cardTierGrades: Record<CardTier, string> = {
  white: "N",
  green: "R",
  blue: "SR",
  red: "SSR",
  gold: "UR",
  prism: "UR+",
};

/** 一批牌里稀有度的排序权重,白最常见、彩最稀有 */
export const CARD_TIER_ORDER: readonly CardTier[] = [
  "white",
  "green",
  "blue",
  "red",
  "gold",
  "prism",
];

/** 世界事件:由主体行动合并冲突后产生的全球级变化 */
export interface WorldEvent {
  id: string;
  /** 事件发生的纪元 */
  era: number;
  title: string;
  /** 事件归属的尺度 */
  scope: "global" | "regional" | "entity" | "natural";
  /** 严重度,决定像素警报图标的等级 */
  severity: "info" | "notable" | "severe" | "critical";
  /** 触发它的主体 */
  actorEntityIds: string[];
  summary: string;
  /** 这件事上玩家可以取舍的节点。为空则是纯叙事事件,不单独发一张牌 */
  choices?: EventChoice[];
  /** 见证者对这件事的一句评述 */
  narrator?: WitnessLine;
  /** 特殊事件标记。普通事件不填 */
  special?: SpecialEventKind;
}

export const eventSeverityLabels: Record<WorldEvent["severity"], string> = {
  info: "日常",
  notable: "值得注意",
  severe: "严峻",
  critical: "危急",
};

export const eventScopeLabels: Record<WorldEvent["scope"], string> = {
  global: "全球",
  regional: "区域",
  entity: "主体内部",
  natural: "自然过程",
};

/**
 * 见证者的像素原型。
 *
 * 刻意与 themeId 一一映射、而不是让模型自己挑 ——
 * 三国世界里站出一只恐龙会让整套视觉立刻垮掉。
 * 模型只负责给这位见证者起名字、写身份和台词。
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
 * 世界见证者:站在卡牌旁边说话的那个像素角色。
 *
 * 它不是主体(WorldEntity),也不是玩家。它是"陪着你看完这条世界线的人" ——
 * 所以它可以有情绪、有立场、有私心,而主体不能。
 */
export interface WorldWitness {
  name: string;
  /** 它是谁、为什么能看见这一切,一句话 */
  role: string;
  /** 世界刚开始时它说的第一句话 */
  openingLine: string;
}

/**
 * 主体提交的模拟报告。
 *
 * v4 起刻意砍到只剩两件事:它想做什么、具体做了什么。
 * 原先的 proposedChanges 与 reasoningSummary 纯粹是给裁决器的中间推理材料,
 * 界面从不显示,却让六个并行调用各多吐几百 token —— 等待时间大部分耗在这。
 * 裁决器拿到"意图 + 行动"已经足够判断成败,它自己会推导后果。
 */
export interface EntitySimulationReport {
  entityId: string;
  /** 本阶段它想做什么,一句话 */
  intent: string;
  /** 它具体采取的行动,最多三条 */
  actions: string[];
}

/** 一个时间阶段的快照。不可变记录,世界状态只是主线指针 */
export interface EraSnapshot {
  id: string;
  era: number;
  /** 属于哪条分支 */
  branchId: string;
  timeBefore: TimeState;
  timeAfter: TimeState;
  /** 本阶段推进的时长描述,如 "推进 18 年" */
  spanLabel: string;
  reports: EntitySimulationReport[];
  events: WorldEvent[];
  /** 阶段结论:一句能解释这段历史的话 */
  conclusion: string;
  /** 本阶段各全局指标的变化 */
  metricDeltas: { metricId: string; delta: number }[];
  /** 裁决器判定这个世界已经收敛(矛盾解决或彻底崩坏),UI 据此发出结算卡 */
  stabilized?: boolean;
}

/** 自然分叉的一个候选未来 */
export interface WorldForkAlternative {
  id: string;
  title: string;
  premise: string;
  expectedEffects: string[];
  plausibility: "low" | "medium" | "high";
}

export const plausibilityLabels: Record<WorldForkAlternative["plausibility"], string> = {
  low: "可能性低",
  medium: "可能性中",
  high: "可能性高",
};

/** 自然分叉:重大冲突下,历史自己长出来的岔路 */
export interface WorldFork {
  id: string;
  snapshotId: string;
  era: number;
  title: string;
  /** 为什么会走到这个岔口 */
  cause: string;
  alternatives: WorldForkAlternative[];
  selectedAlternativeId: string | null;
}

/** 分支:一条被追踪的世界线 */
export interface WorldBranch {
  id: string;
  label: string;
  /** 从哪条分支的哪个分叉点长出来的 */
  parentBranchId: string | null;
  forkId: string | null;
  /** 是否玩家当前正在观察的主线 */
  active: boolean;
  summary: string;
}

/** 世界种子:一次模拟的全部初始条件 */
export interface WorldSeed {
  scenarioId: string;
  scenarioTitle: string;
  scenarioUrl: string;
  themeId: string;
  simulationMode: SimulationMode;
  premise: CounterfactualPremise;
  startTime: TimeState;
  timeScale: TimeScale;
  /** 站在卡牌旁边解说的那个人 */
  witness: WorldWitness;
  hardRules: HardRule[];
  entities: WorldEntity[];
  globalMetrics: GlobalMetric[];
  initialEvents: WorldEvent[];
}

/**
 * 玩家在事件卡上做出的取舍。
 *
 * 它不改写已经发生的事 —— 它是"下一阶段的前提":主体 Agent 与裁决器都会看到它,
 * 于是玩家的一次取舍会在后面几个阶段里以因果的形式回来。
 * 这就是"观察者"与"上帝"的区别。
 */
export interface PlayerDirective {
  /** 做出取舍的那张牌 */
  cardId: string;
  cardTitle: string;
  choiceId: string;
  choiceLabel: string;
  /** 取舍的语义,喂给下一阶段的裁决 */
  note: string;
}

/** 当前世界状态指针。只是"主线到哪儿了",不是历史本身 */
export interface WorldState {
  currentEra: number;
  currentBranchId: string;
  globalMetrics: GlobalMetric[];
  entities: WorldEntity[];
  /** 最近一次快照 id */
  latestSnapshotId: string;
}

/** 一次完整会话:种子 + 历史快照 + 分叉 + 分支 + 玩家取舍 */
export interface WorldSimSession {
  version: 4;
  scenarioId: string;
  scenarioTitle: string;
  scenarioUrl: string;
  seed: WorldSeed;
  snapshots: EraSnapshot[];
  forks: WorldFork[];
  branches: WorldBranch[];
  state: WorldState;
  /** 玩家在事件卡上做过的全部取舍,按时间顺序。下一阶段会把它送给裁决器 */
  directives: PlayerDirective[];
}

/** 存档 key。v3 牌局式会话的本地存档位置 */
export function worldSimStorageKey(scenarioId: string) {
  return `world-sim:${scenarioId}`;
}

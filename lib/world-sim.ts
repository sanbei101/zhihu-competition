/**
 * World Simulation v2 的世界模型。
 *
 * 与旧的 world-cast 不同:这里不再有"角色"这个概念。
 * 世界主体(WorldEntity)可以是政权、生态、物种、技术、AI、行星系统 --
 * 它们都有目标、能力、约束和指标,由独立 Agent 推演,玩家只负责观测和推进时间。
 *
 * 本文件同时承载 UI demo 的静态数据结构:第一版界面不依赖后端,
 * 但字段命名严格对齐 plan.md §5,后续接入 /api/world-seed 时可直接替换数据源。
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
 * 跨主体因果链。这是"不是几个人在聊天"的关键证据:
 * 一条链把若干主体和事件串成 -> 的序列。plan.md §8.2 的例子:
 * 贸易改道 -> 城市扩张 -> 粮价上涨 -> 地方自治运动
 */
export interface CausalChain {
  id: string;
  /** 首尾概述,展示在链条标题上 */
  title: string;
  links: CausalLink[];
}

export interface CausalLink {
  id: string;
  /** 起因:某个主体的行动或自然变化 */
  cause: string;
  /** 归属主体,可为空 —— 自然过程没有行动者 */
  entityId?: string;
  effect: string;
  /** 下一跳由哪个事件承接,链条据此串起来 */
  eventId?: string;
}

/** 主体提交的模拟报告。Agent 只能提议变化,不能直接改世界状态 */
export interface EntitySimulationReport {
  entityId: string;
  /** 本阶段它想做什么 */
  intent: string;
  /** 它具体采取的行动 */
  actions: string[];
  /** 提议的状态变化,由服务端裁决是否采纳 */
  proposedChanges: string[];
  /** 它的自我陈述。不是对话,是推演摘要 */
  reasoningSummary: string;
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
  causalChains: CausalChain[];
  /** 阶段结论:一句能解释这段历史的话 */
  conclusion: string;
  /** 本阶段各全局指标的变化 */
  metricDeltas: { metricId: string; delta: number; reason: string }[];
}

/** 自然分叉的一个候选未来 */
export interface WorldForkAlternative {
  id: string;
  title: string;
  premise: string;
  drivers: string[];
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

/** 玩家的观测操作。第一版只有四种,不提供自由改写 */
export type ObservationAction = "advance-era" | "follow-entity" | "inspect-event" | "choose-fork";

export const observationActionLabels: Record<ObservationAction, string> = {
  "advance-era": "推进时代",
  "follow-entity": "追踪主体",
  "inspect-event": "查看因果",
  "choose-fork": "选择分支",
};

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
  hardRules: HardRule[];
  entities: WorldEntity[];
  globalMetrics: GlobalMetric[];
  initialEvents: WorldEvent[];
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

/** 一次完整会话:种子 + 历史快照 + 分叉 + 分支 */
export interface WorldSimSession {
  version: 2;
  scenarioId: string;
  scenarioTitle: string;
  scenarioUrl: string;
  seed: WorldSeed;
  snapshots: EraSnapshot[];
  forks: WorldFork[];
  branches: WorldBranch[];
  state: WorldState;
}

/** 存档 key。v2 世界制会话的本地存档位置 */
export function worldSimStorageKey(scenarioId: string) {
  return `world-sim:${scenarioId}`;
}

import { z } from "zod";

import { errorCodeSchema } from "@/lib/app-error";
import {
  type EntitySimulationReport,
  type EraSnapshot,
  type HardRule,
  type TimeScale,
  type WorldEntity,
  type WorldEvent,
  type WorldForkAlternative,
  type WorldSeed,
  type WorldSimSession,
} from "@/lib/world-sim";

/**
 * World Simulation v2 的线上协议层。
 *
 * 这一层只负责"服务端往客户端吐什么、客户单往服务端发什么",不承载世界语义。
 * 世界语义全在 lib/world-sim.ts,推演规则全在 lib/world-sim-prompts.ts。
 *
 * 两个流:
 *   1. /api/world-seed       一次模拟的开场,把世界种子逐块吐出来
 *   2. /api/world-simulate   推进一个时代,主体报告 -> 世界裁决 -> 快照
 *
 * 全部事件都是 discriminated union,客户端用 readNdjsonStream 逐行校验,
 * 任何一条对不上就整条流报错 -- 静默吞掉畸形事件比报错更难排查。
 */

/**
 * schema 里的数组长度上限刻意给得比展示预算宽。
 *
 * 原因是一次真实事故:主体 Agent 输出了一份完全可用的报告,只因 actions 写了 6 条
 * (上限 5 条)而 Zod 校验失败,整份报告被丢弃,那个主体这一阶段就等于没行动。
 * 让"多写了一条"这种小事毁掉整份优质推演,是典型的过度严格。
 *
 * 所以这里的策略是:校验层只防住"完全失控"(比如吐 50 条),真正的展示预算
 * 由 lib/world-sim-reducer.ts 在合并时裁剪 —— 那里是确定性的,想裁多少就裁多少。
 */
const LOOSE = {
  goals: 6,
  capabilities: 8,
  constraints: 6,
  relations: 10,
  actions: 5,
  events: 6,
  entityUpdates: 10,
  alternatives: 4,
  choices: 4,
} as const;

const entityKindSchema = z.enum([
  "state",
  "faction",
  "population",
  "ecosystem",
  "species",
  "company",
  "institution",
  "technology",
  "ai",
  "alien",
  "planetary-system",
]);

const simulationModeSchema = z.enum([
  "historical-civilization",
  "ecological-evolution",
  "survival-collapse",
  "planetary-disaster",
  "post-human",
  "socio-technical",
  "first-contact",
]);

const timeScaleSchema = z.enum([
  "hour",
  "day",
  "week",
  "month",
  "year",
  "decade",
  "century",
  "millennium",
  "mega-annum",
]);

// ==================== 世界模型片段 ====================

export const counterfactualPremiseSchema = z.object({
  statement: z.string().min(1),
  divergencePoint: z.string().min(1),
  affectedDomains: z.array(z.string().min(1)).max(6),
  certainty: z.literal("given"),
});

/**
 * 数值字段刻意不写 min/max。
 *
 * 一次真实事故:种子生成里某个主体把亲疏度写成 120(超出 -100..100),
 * 于是 Zod 直接拒绝,整份已经写好的世界被丢掉 —— 白烧一次调用,玩家白等一轮。
 * 这类"量纲写歪了"不该是致命错误,它只是一个需要被修正的排版问题。
 *
 * 所以约定是:**校验层只保证"这是个数字",范围由服务端在合并时钳制**。
 * 钳制发生在 lib/world-sim-reducer.ts,是纯函数、确定性,所以同一份模型输出
 * 永远得到同一个世界。任何新增数值字段都请遵守这条约定。
 */
const freeNumber = z.number();

export const timeStateSchema = z.object({
  /** 展示用的纪元编号;服务端会用自己的递增序列覆盖模型给的值 */
  era: freeNumber,
  label: z.string().min(1),
  elapsed: z.string().min(1),
});

export const hardRuleSchema = z.object({
  id: z.string().min(1),
  scope: z.enum(["physics", "biology", "institution", "geography", "technology"]),
  statement: z.string().min(1),
});

export const entityRelationSchema = z.object({
  targetEntityId: z.string().min(1),
  posture: z.enum(["rival", "ally", "vassal", "trade", "isolated"]),
  affinity: freeNumber,
  note: z.string().min(1),
});

export const worldEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: entityKindSchema,
  description: z.string().min(1),
  goals: z.array(z.string().min(1)).max(LOOSE.goals),
  capabilities: z.array(z.string().min(1)).max(LOOSE.capabilities),
  constraints: z.array(z.string().min(1)).max(LOOSE.constraints),
  relations: z.array(entityRelationSchema).max(LOOSE.relations),
  pixelArchetype: z.string().min(1),
  changedThisEra: z.boolean().optional(),
  status: z.string().optional(),
});

export const eventChoiceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  hint: z.string().min(1),
  tone: z.enum(["bold", "cautious", "cunning", "mercy"]),
});

export const witnessLineSchema = z.object({
  speaker: z.string().min(1),
  line: z.string().min(1),
});

export const specialEventKindSchema = z.enum(["crisis", "echo", "anomaly"]);

export const worldWitnessSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  openingLine: z.string().min(1),
});

export const worldEventSchema = z.object({
  id: z.string().min(1),
  era: freeNumber,
  title: z.string().min(1),
  scope: z.enum(["global", "regional", "entity", "natural"]),
  severity: z.enum(["info", "notable", "severe", "critical"]),
  actorEntityIds: z.array(z.string().min(1)).max(8),
  summary: z.string().min(1),
  /**
   * 这三个字段是"事件 -> 卡牌"的全部桥梁。
   * 全部可选:一个事件没有 choices,就只是一条叙事,不单独发牌。
   */
  choices: z.array(eventChoiceSchema).max(LOOSE.choices).optional(),
  narrator: witnessLineSchema.optional(),
  special: specialEventKindSchema.optional(),
});

/**
 * 主体提交的报告。v4 起只有意图与行动 —— proposedChanges 与 reasoningSummary
 * 是给裁决器的中间推理材料,界面从不显示,却让六个并行调用各多吐几百 token。
 */
export const entitySimulationReportSchema = z.object({
  entityId: z.string().min(1),
  intent: z.string().min(1),
  actions: z.array(z.string().min(1)).max(LOOSE.actions),
});

/**
 * 主体 Agent 提交的报告草稿:不含 entityId。
 * entityId 由服务端注入,模型无权决定自己是谁 —— 否则串号是迟早的事。
 */
export const entityReportDraftSchema = entitySimulationReportSchema.omit({ entityId: true });

export const eraSnapshotSchema = z.object({
  id: z.string().min(1),
  era: z.number().int().min(1),
  branchId: z.string().min(1),
  timeBefore: timeStateSchema,
  timeAfter: timeStateSchema,
  spanLabel: z.string().min(1),
  headline: z.string().min(1),
  reports: z.array(entitySimulationReportSchema).max(8),
  events: z.array(worldEventSchema).max(LOOSE.events),
  conclusion: z.string().min(1),
  stabilized: z.boolean().optional(),
});

export const worldForkAlternativeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  premise: z.string().min(1),
  expectedEffects: z.array(z.string().min(1)).max(5),
  plausibility: z.enum(["low", "medium", "high"]),
});

export const worldForkSchema = z.object({
  id: z.string().min(1),
  snapshotId: z.string().min(1),
  era: z.number().int().min(1),
  title: z.string().min(1),
  cause: z.string().min(1),
  alternatives: z.array(worldForkAlternativeSchema).max(LOOSE.alternatives),
  selectedAlternativeId: z.string().nullable(),
});

export const worldBranchSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  parentBranchId: z.string().nullable(),
  forkId: z.string().nullable(),
  active: z.boolean(),
  summary: z.string().min(1),
});

export const worldSeedSchema = z.object({
  scenarioId: z.string().min(1),
  scenarioTitle: z.string().min(1),
  scenarioUrl: z.string(),
  themeId: z.string().min(1),
  simulationMode: simulationModeSchema,
  premise: counterfactualPremiseSchema,
  startTime: timeStateSchema,
  timeScale: timeScaleSchema,
  witness: worldWitnessSchema,
  // 这些 max 必须与 lib/world-sim-reducer.ts 的 DISPLAY 预算一致:
  // reducer 只负责裁到预算内,这里的下限必须足够松,才接得住裁完之后的结果。
  hardRules: z.array(hardRuleSchema).max(6),
  entities: z.array(worldEntitySchema).min(1).max(7),
  initialEvents: z.array(worldEventSchema).max(5),
});

export const playerDirectiveSchema = z.object({
  cardId: z.string().min(1),
  cardTitle: z.string().min(1),
  choiceId: z.string().min(1),
  choiceLabel: z.string().min(1),
  note: z.string().min(1),
});

export const worldSimSessionSchema = z.object({
  version: z.literal(7),
  scenarioId: z.string().min(1),
  scenarioTitle: z.string().min(1),
  scenarioUrl: z.string(),
  seed: worldSeedSchema,
  snapshots: z.array(eraSnapshotSchema),
  forks: z.array(worldForkSchema),
  branches: z.array(worldBranchSchema),
  state: z.object({
    currentEra: z.number().int().min(0),
    currentBranchId: z.string().min(1),
    entities: z.array(worldEntitySchema),
    latestSnapshotId: z.string(),
  }),
  directives: z.array(playerDirectiveSchema),
});

// ==================== 结构化生成的中间 schema ====================

/**
 * 世界种子生成。模型自己给主体起 id(简短英文小写),关系与事件行动者都引用这些 id;
 * 服务端在 reducer 里做一次引用完整性修复,断掉的引用就地删掉而不是让整份种子失败。
 */
export const seedGenerationSchema = z.object({
  premise: counterfactualPremiseSchema,
  startTime: timeStateSchema,
  timeScale: timeScaleSchema,
  witness: worldWitnessSchema,
  // 硬规则与初始事件允许为空:少了它们世界只是约束更松,不该整份作废
  hardRules: z.array(hardRuleSchema.omit({ id: true })).max(8),
  // 主体是 UI 的骨架,至少要有一个,否则没有东西可画
  entities: z.array(worldEntitySchema).min(1).max(9),
  initialEvents: z.array(worldEventSchema.omit({ id: true, era: true })).max(7),
});

/**
 * 裁决器的一段连续历史。一次裁决就是一条由 3-5 段 beats 拼成的完整时间线,
 * 玩家在这整段里只做一次取舍,不再每轮停下。
 *
 * 这一段就是旧版"一个时代"的产物,只是被裁成几段、让 UI 能像看长剧一样逐段播放:
 * 事件与结论都归到它们各自发生的段落里。
 */
export const adjudicationBeatSchema = z.object({
  /** 本段推进了多久,如"世界推进了 30 年" */
  spanLabel: z.string().min(1),
  timeAfter: timeStateSchema.omit({ era: true }),
  /** 世界旁白:这一段最重量级那件事的一句话。常驻编年史的条目 */
  headline: z.string().min(1),
  events: z.array(worldEventSchema.omit({ id: true, era: true })).max(4),
  conclusion: z.string().min(1),
});

/**
 * 裁决器的输出:一整段级联历史。
 *
 * v5 起的结构性变化:
 *   - 一次裁决产出 3-5 段 beats,不再是一次一个时代 —— 玩家选完卡后,
 *     AI 把这条世界线连续往前推 5 段,期间不再打断他
 *   - entityUpdates 只做最终结算:主体只在每大阶段的开头博弈一次,
 *     中间段落的状态由裁决器沿着时间轴自然演变
 *   - 因果链与关系的逐段重算都砍掉了(见 v4 注释),token 省给"演得长"
 */
export const adjudicationSchema = z.object({
  /** 3-5 段,每段一段可以单独展示的历史 */
  beats: z.array(adjudicationBeatSchema).min(1).max(6),
  entityUpdates: z
    .array(
      z.object({
        entityId: z.string().min(1),
        status: z.string().min(1),
        changed: z.boolean(),
      }),
    )
    .max(LOOSE.entityUpdates),
  /** 只有在真正的重大冲突下才给分叉,平时可以为 null */
  fork: z
    .object({
      title: z.string().min(1),
      cause: z.string().min(1),
      alternatives: z.array(worldForkAlternativeSchema.omit({ id: true })).max(LOOSE.alternatives),
    })
    .nullable()
    .optional(),
  /** 本大阶段是否已经收敛到稳态,提示 UI 可以收尾 */
  stabilized: z.boolean().optional(),
});

// ==================== 请求 schema ====================

export const worldSeedRequestSchema = z.object({
  scenarioId: z.string().min(1),
  title: z.string().min(1),
  themeId: z.string().min(1),
});

export const worldSimulateRequestSchema = z.object({
  session: worldSimSessionSchema,
  /** 玩家正在追踪的主体;不追踪则不给 */
  followedEntityId: z.string().optional(),
  /** 玩家在分叉点上选的那条路;不选则走默认 */
  forkChoice: z
    .object({
      forkId: z.string().min(1),
      alternativeId: z.string().min(1),
    })
    .optional(),
  /**
   * 玩家上一阶段在事件卡上做的取舍。
   * 它不改写已经发生的事,而是成为下一阶段裁决的前提 —— 一次取舍会在
   * 后面几个阶段里以因果的形式回来,这是"观察者"与"上帝"的分界。
   */
  directives: z.array(playerDirectiveSchema).max(12).optional(),
});

// ==================== 流事件 ====================
const streamErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string().min(1).max(200),
  retryable: z.boolean(),
  fields: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .max(20)
    .optional(),
});

/** /api/world-seed 的事件序列 */
export const worldSeedEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("seed-start"), themeId: z.string().min(1) }),
  z.object({ type: z.literal("seed-witness"), witness: worldWitnessSchema }),
  z.object({
    type: z.literal("seed-setting"),
    premise: counterfactualPremiseSchema,
    startTime: timeStateSchema,
    timeScale: timeScaleSchema,
  }),
  z.object({ type: z.literal("seed-rules"), hardRules: z.array(hardRuleSchema) }),
  z.object({
    type: z.literal("entity-start"),
    entityId: z.string().min(1),
    name: z.string().min(1),
  }),
  z.object({ type: z.literal("entity"), entity: worldEntitySchema }),
  z.object({ type: z.literal("seed-events"), initialEvents: z.array(worldEventSchema) }),
  z.object({ type: z.literal("seed-complete"), seed: worldSeedSchema }),
  z.object({ type: z.literal("error"), error: streamErrorSchema }),
]);

/** /api/world-simulate 的事件序列 */
export const worldSimulateEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("simulation-start"),
    era: z.number().int().min(0),
    timeLabel: z.string().min(1),
  }),
  z.object({
    type: z.literal("entity-start"),
    entityId: z.string().min(1),
    name: z.string().min(1),
  }),
  z.object({ type: z.literal("entity-report"), report: entitySimulationReportSchema }),
  z.object({
    type: z.literal("entity-error"),
    entityId: z.string().min(1),
    error: streamErrorSchema,
  }),
  z.object({ type: z.literal("adjudicating") }),
  z.object({
    type: z.literal("beat-start"),
    era: z.number().int().min(0),
    spanLabel: z.string().min(1),
    timeLabel: z.string().min(1),
    /** 世界旁白。裁决器逐段吐出来,客户端据此实时滚入编年史 */
    headline: z.string().min(1),
  }),
  z.object({ type: z.literal("world-event"), event: worldEventSchema }),
  z.object({ type: z.literal("fork-detected"), fork: worldForkSchema }),
  z.object({ type: z.literal("snapshot"), snapshot: eraSnapshotSchema }),
  z.object({
    type: z.literal("state"),
    state: z.object({
      currentEra: z.number().int().min(0),
      currentBranchId: z.string().min(1),
      entities: z.array(worldEntitySchema),
      latestSnapshotId: z.string(),
    }),
  }),
  z.object({ type: z.literal("complete"), session: worldSimSessionSchema }),
  z.object({ type: z.literal("error"), error: streamErrorSchema }),
]);

export type WorldSeedEvent = z.infer<typeof worldSeedEventSchema>;
export type WorldSimulateEvent = z.infer<typeof worldSimulateEventSchema>;
export type SeedGeneration = z.infer<typeof seedGenerationSchema>;
export type Adjudication = z.infer<typeof adjudicationSchema>;

// 类型层面的对照,防止 zod schema 与世界模型悄悄漂移
type _SeedMatches = WorldSeed extends z.infer<typeof worldSeedSchema> ? true : never;
type _EventMatches = WorldEvent extends z.infer<typeof worldEventSchema> ? true : never;
type _ReportMatches =
  EntitySimulationReport extends z.infer<typeof entitySimulationReportSchema> ? true : never;
type _SnapshotMatches = EraSnapshot extends z.infer<typeof eraSnapshotSchema> ? true : never;
type _EntityMatches = WorldEntity extends z.infer<typeof worldEntitySchema> ? true : never;
type _ForkAltMatches =
  WorldForkAlternative extends z.infer<typeof worldForkAlternativeSchema> ? true : never;
type _RuleMatches = HardRule extends z.infer<typeof hardRuleSchema> ? true : never;
type _ScaleMatches = TimeScale extends z.infer<typeof timeScaleSchema> ? true : never;
type _SessionMatches = z.infer<typeof worldSimSessionSchema> extends WorldSimSession ? true : never;

export type WorldSimProtocolCheck = [
  _SeedMatches,
  _EventMatches,
  _ReportMatches,
  _SnapshotMatches,
  _EntityMatches,
  _ForkAltMatches,
  _RuleMatches,
  _ScaleMatches,
  _SessionMatches,
];

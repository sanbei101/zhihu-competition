import type { ScenarioProfile } from "@/lib/scenario-profiles";
import type {
  EntityRelation,
  EntitySimulationReport,
  EraSnapshot,
  EventChoice,
  GlobalMetric,
  PlayerDirective,
  WorldBranch,
  WorldEntity,
  WorldEvent,
  WorldFork,
  WorldSeed,
  WorldSimSession,
  WorldState,
  TimeState,
} from "@/lib/world-sim";
import type { Adjudication, SeedGeneration } from "@/lib/world-sim-events";

/**
 * World Simulation v4 的状态合并器。
 *
 * 这是全部"确定性限制"的落点。模型负责叙事与判断,这里负责**不让它越界**:
 *   - 指标永远钳制在 0-100,单阶段变化有上限
 *   - 事件必须有真实存在的行动者,没有就补一个或丢弃
 *   - 引用了不存在主体的关系、事件,就地剪掉而不是整份失败
 *   - 每批牌的额度、特殊事件的优先级都在这里裁
 *
 * 全部是纯函数:同输入必得同输出,不读时间、不用随机。
 * 这样 SSR 与 CSR 才会一致,存档也才能可靠复现。
 *
 * 对应 plan.md §6.5 与 §13。
 */

/** 单阶段单个全局指标的涨跌上限。超过这个量级就不是演化而是重置了 */
const GLOBAL_DELTA_LIMIT = 12;
/** 重大事件发生时放宽到的上限(severity 为 critical) */
const GLOBAL_DELTA_LIMIT_CRITICAL = 20;
/** 一批最多几张"有取舍"的牌。超过这个数玩家会开始闭眼点 */
const MAX_CHOICE_CARDS = 4;

const METRIC_FLOOR = 0;
const METRIC_CEILING = 100;

/**
 * 展示预算。
 *
 * schema 那边的上限给得很宽(只防"完全失控"),真正的裁剪在这里做。
 * 理由是确定性:裁剪发生在服务端、是纯函数,所以同一份模型输出永远得到同一个世界,
 * 而"多写了一条就整份作废"会让一次完全可用的推演因为排版问题丢掉。
 *
 * v4 把 events 从 8 砍到 5:一批 5 张、玩家翻其中 2 张,8 张是纯浪费。
 */
const DISPLAY = {
  affectedDomains: 6,
  hardRules: 6,
  entities: 7,
  globalMetrics: 6,
  initialEvents: 5,
  goals: 4,
  capabilities: 5,
  constraints: 4,
  entityMetrics: 5,
  relations: 8,
  actions: 3,
  events: 5,
  forkAlternatives: 3,
  choices: 3,
  effects: 4,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampMetric(value: number): number {
  return clamp(Math.round(value), METRIC_FLOOR, METRIC_CEILING);
}

function take<T>(items: readonly T[], limit: number): T[] {
  return items.length > limit ? items.slice(0, limit) : [...items];
}

// ==================== 种子规范化 ====================

/**
 * 清洗一条事件的可选字段(choices / narrator / special)。
 *
 * 卡牌的全部内容都从这里过一遍:
 *   - 选项裁到 3 个 —— 再多玩家就不读了,只会闭眼点第一个
 *   - effects 里引用不存在的指标就地丢掉,而不是让整张卡作废
 *   - 少于 2 个选项的事件不算"有取舍",直接退回成纯叙事事件
 *
 * allowCard 是这个阶段还剩不剩牌额。为 false 时 choices 与 special **必须一起**摘掉 ——
 * 留下一个"自称危机却没有选项"的孤儿事件,比直接把它降级成叙事糟糕得多。
 */
function normalizeEventExtras(
  event: {
    choices?: EventChoice[];
    narrator?: WorldEvent["narrator"];
    special?: WorldEvent["special"];
  },
  metricIds: Set<string>,
  allowCard: boolean,
): Pick<WorldEvent, "choices" | "narrator" | "special"> {
  const extras: Pick<WorldEvent, "choices" | "narrator" | "special"> = {};

  if (event.narrator) extras.narrator = event.narrator;

  if (!allowCard) return extras;

  const choices = take(event.choices ?? [], DISPLAY.choices)
    .map((choice) => {
      const effects = take(
        choice.effects.filter((effect) => metricIds.has(effect.metricId)),
        DISPLAY.effects,
      );
      return Object.assign({}, choice, { effects });
    })
    .filter((choice) => choice.label.trim().length > 0);

  // 一道选择题至少要两个选项,一个选项的"选择"是假的
  if (choices.length >= 2) {
    extras.choices = choices;
    if (event.special) extras.special = event.special;
  }

  return extras;
}

/**
 * 把模型产出的种子整理成一份引用完整的 WorldSeed。
 * id 冲突会加后缀,断掉的关系与行动者会被剔除 —— 模型偶尔会指向一个不存在的主体。
 */
export function normalizeSeed(input: {
  generation: SeedGeneration;
  scenarioId: string;
  scenarioTitle: string;
  scenarioUrl: string;
  themeId: string;
  profile: ScenarioProfile;
}): WorldSeed {
  const { generation, scenarioId, scenarioTitle, scenarioUrl, themeId, profile } = input;

  // 1. 主体 id 去重与归一,同时按展示预算裁剪各列表
  const takenIds = new Set<string>();
  const idRemap = new Map<string, string>();
  const entities: WorldEntity[] = take(generation.entities, DISPLAY.entities).map(
    (entity, index) => {
      const base = entity.id.trim() || `entity-${index + 1}`;
      let id = base;
      let suffix = 2;
      while (takenIds.has(id)) {
        id = `${base}-${suffix}`;
        suffix += 1;
      }
      takenIds.add(id);
      if (id !== base) idRemap.set(base, id);
      const next: WorldEntity = {
        id,
        name: entity.name,
        kind: entity.kind,
        description: entity.description,
        goals: take(entity.goals, DISPLAY.goals),
        capabilities: take(entity.capabilities, DISPLAY.capabilities),
        constraints: take(entity.constraints, DISPLAY.constraints),
        metrics: take(entity.metrics, DISPLAY.entityMetrics).map((metric) =>
          Object.assign({}, metric, { value: clampMetric(metric.value) }),
        ),
        relations: take(entity.relations, DISPLAY.relations),
        pixelArchetype: entity.pixelArchetype || entity.kind,
      };
      if (entity.status) next.status = entity.status;
      if (entity.changedThisEra !== undefined) next.changedThisEra = entity.changedThisEra;
      return next;
    },
  );

  const resolveId = (raw: string): string | undefined => {
    const direct = entities.find((entity) => entity.id === raw);
    if (direct) return direct.id;
    const remapped = idRemap.get(raw);
    if (remapped) return remapped;
    // 退化情形:模型用名字当 id
    const byName = entities.find((entity) => entity.name === raw);
    return byName?.id;
  };

  // 2. 剪掉指向不存在主体的关系,以及自指关系与重复关系;亲疏度钳到 -100..100
  const linkedEntities: WorldEntity[] = entities.map((entity) => {
    const relations: EntityRelation[] = [];
    for (const relation of entity.relations) {
      const targetId = resolveId(relation.targetEntityId);
      if (!targetId || targetId === entity.id) continue;
      if (relations.some((item) => item.targetEntityId === targetId)) continue;
      relations.push(
        Object.assign({}, relation, {
          targetEntityId: targetId,
          affinity: clamp(Math.round(relation.affinity), -100, 100),
        }),
      );
    }
    return Object.assign({}, entity, { relations: take(relations, DISPLAY.relations) });
  });

  // 一个主体都没有的世界没法推演,这里给一句能直接看懂原因的错误
  if (linkedEntities.length === 0) {
    throw new Error("世界种子没有产出任何主体");
  }

  // 3. 硬规则补 id 并裁剪
  const hardRules = take(generation.hardRules, DISPLAY.hardRules).map((rule, index) =>
    Object.assign({}, rule, { id: `rule-${index + 1}-${rule.scope}` }),
  );

  // 4. 全局指标:优先保留与本主题 profile 对应的那些,超出预算的裁掉
  const profileIds = new Set(profile.metricDefinitions.map((metric) => metric.id));
  const picked = generation.globalMetrics.filter((metric) => profileIds.has(metric.id));
  const chosen = take(
    picked.length >= 3 ? picked : generation.globalMetrics,
    DISPLAY.globalMetrics,
  );
  const seenMetricIds = new Set<string>();
  const globalMetrics: GlobalMetric[] = [];
  for (const metric of chosen) {
    if (seenMetricIds.has(metric.id)) continue;
    seenMetricIds.add(metric.id);
    globalMetrics.push({
      id: metric.id,
      label: metric.label,
      value: clampMetric(metric.value),
      description: metric.description,
      goodDirection: metric.goodDirection,
    });
  }
  const metricIds = new Set(globalMetrics.map((metric) => metric.id));

  // 5. 初始事件:行动者必须存在,否则归给第一个主体(自然事件才允许无主,这里统一兜底)
  const fallbackActor = linkedEntities[0]?.id;
  const initialEvents: WorldEvent[] = take(generation.initialEvents, DISPLAY.initialEvents).map(
    (event, index) => {
      const actors = event.actorEntityIds
        .map((actor) => resolveId(actor))
        .filter((actor): actor is string => Boolean(actor));
      const built: WorldEvent = {
        id: `evt-0-${index + 1}`,
        era: 0,
        title: event.title,
        scope: event.scope,
        severity: event.severity,
        actorEntityIds: actors.length ? [...new Set(actors)] : fallbackActor ? [fallbackActor] : [],
        summary: event.summary,
      };
      // 起跑线上的事件只是叙事:牌要等世界真的走起来之后再发
      return Object.assign(built, normalizeEventExtras(event, metricIds, false));
    },
  );

  return {
    scenarioId,
    scenarioTitle,
    scenarioUrl,
    themeId,
    simulationMode: profile.mode,
    premise: {
      ...generation.premise,
      certainty: "given",
      affectedDomains: take(generation.premise.affectedDomains, DISPLAY.affectedDomains),
    },
    startTime: { ...generation.startTime, era: 0 },
    timeScale: generation.timeScale,
    witness: {
      name: generation.witness.name,
      role: generation.witness.role,
      openingLine: generation.witness.openingLine,
    },
    hardRules,
    entities: linkedEntities,
    globalMetrics,
    initialEvents,
  };
}

/**
 * 把主体 Agent 的草稿整理成正式报告。
 * entityId 由服务端注入,行动列表按展示预算裁剪。
 */
export function normalizeEntityReport(
  draft: { intent: string; actions: string[] },
  entityId: string,
): EntitySimulationReport {
  return {
    entityId,
    intent: draft.intent,
    actions: take(draft.actions, DISPLAY.actions),
  };
}

/** 从种子组装一份全新的会话。分支固定从"主线"开始 */
export function createSession(seed: WorldSeed): WorldSimSession {
  const branches: WorldBranch[] = [
    {
      id: "branch-main",
      label: "主线",
      parentBranchId: null,
      forkId: null,
      active: true,
      summary: `反事实原点:${seed.premise.statement}`,
    },
  ];

  const state: WorldState = {
    currentEra: 0,
    currentBranchId: "branch-main",
    globalMetrics: seed.globalMetrics,
    entities: seed.entities,
    latestSnapshotId: "",
  };

  return {
    version: 4,
    scenarioId: seed.scenarioId,
    scenarioTitle: seed.scenarioTitle,
    scenarioUrl: seed.scenarioUrl,
    seed,
    snapshots: [],
    forks: [],
    branches,
    state,
    directives: [],
  };
}

// ==================== 裁决应用 ====================

/** 重新计算指标:加上裁决给的变化,钳制在量纲内,标记 delta 供 UI 显示涨跌 */
function applyMetricDeltas(
  current: GlobalMetric[],
  deltas: Adjudication["metricDeltas"],
  limit: number,
): { metrics: GlobalMetric[]; applied: Adjudication["metricDeltas"] } {
  const byId = new Map(deltas.map((delta) => [delta.metricId, delta]));
  const applied: Adjudication["metricDeltas"] = [];

  const metrics = current.map((metric) => {
    const delta = byId.get(metric.id);
    if (!delta) return { ...metric, delta: 0 };

    const bounded = clamp(Math.round(delta.delta), -limit, limit);
    const next = clampMetric(metric.value + bounded);
    const actual = next - metric.value;
    if (actual !== 0) applied.push({ metricId: metric.id, delta: actual });

    return { ...metric, value: next, delta: actual };
  });

  return { metrics, applied };
}

/**
 * 把裁决的主体结算写回主体清单。
 *
 * v4 起只结算状态词。主体的内部指标与关系不再逐阶段重算 ——
 * 牌局里主体只以"一枚徽记 + 一个状态词"出现,重算它们是纯 token 开销。
 * 如果日后要做主体详情页,再把 metricShifts 加回来,那是一个独立的增量改动。
 */
function applyEntityUpdates(
  entities: WorldEntity[],
  updates: Adjudication["entityUpdates"],
): WorldEntity[] {
  const byId = new Map(updates.map((update) => [update.entityId, update]));

  return entities.map((entity) => {
    const update = byId.get(entity.id);
    if (!update) return { ...entity, changedThisEra: false };
    return { ...entity, status: update.status, changedThisEra: update.changed };
  });
}

/**
 * 把一次裁决合并进会话,产出新的会话与本次快照。
 *
 * 确定性限制集中在这里:
 *   - 事件行动者必须存在,断引用就地补全或丢弃
 *   - 指标变化按是否有 critical 事件选择上限
 *   - 每批牌的额度:特殊事件优先,常规事件补位
 *   - 分叉只有在真的有 2 条以上候选时才落库
 */
export function applyAdjudication(input: {
  session: WorldSimSession;
  reports: EntitySimulationReport[];
  adjudication: Adjudication;
  /** 玩家上一阶段在事件卡上做的取舍,原样记进会话 */
  directives?: PlayerDirective[];
}): { session: WorldSimSession; snapshot: EraSnapshot; fork: WorldFork | null } {
  const { session, reports, adjudication } = input;
  const era = session.state.currentEra + 1;
  const branchId = session.state.currentBranchId;
  const entityIds = new Set(session.state.entities.map((entity) => entity.id));

  const hasCritical = adjudication.events.some((event) => event.severity === "critical");
  const globalLimit = hasCritical ? GLOBAL_DELTA_LIMIT_CRITICAL : GLOBAL_DELTA_LIMIT;

  // 1. 指标
  const { metrics: globalMetrics, applied: metricDeltas } = applyMetricDeltas(
    session.state.globalMetrics,
    adjudication.metricDeltas,
    globalLimit,
  );

  // 2. 主体结算
  const entities = applyEntityUpdates(session.state.entities, adjudication.entityUpdates);
  const fallbackActor = entities[0]?.id;

  // 3. 事件:清洗行动者,并按展示预算裁掉多余的
  //
  //    带 choices 的事件就是"牌"。分配牌额时**特殊事件优先**:
  //    危机 / 回响 / 异象被一条常规事件挤掉,是这个阶段最不能接受的事。
  //    真实事故:一次裁决里模型给了 crisis,却因为排在四张常规牌之后被降级,
  //    最后留下一个"自称危机却没有选项"的孤儿事件。
  const metricIds = new Set(session.state.globalMetrics.map((metric) => metric.id));
  const ordered = take(adjudication.events, DISPLAY.events);

  const candidates = ordered
    .map((event, index) => ({ event, index }))
    .filter((item) => (item.event.choices ?? []).length >= 2);
  const withBudget = new Set(
    [
      ...candidates.filter((item) => item.event.special),
      ...candidates.filter((item) => !item.event.special),
    ]
      .slice(0, MAX_CHOICE_CARDS)
      .map((item) => item.index),
  );

  const events: WorldEvent[] = ordered.map((event, index) => {
    const actors = [...new Set(event.actorEntityIds.filter((actor) => entityIds.has(actor)))];
    const built: WorldEvent = {
      id: `evt-${era}-${index + 1}`,
      era,
      title: event.title,
      scope: event.scope,
      severity: event.severity,
      actorEntityIds: actors.length ? actors : fallbackActor ? [fallbackActor] : [],
      summary: event.summary,
    };
    return Object.assign(built, normalizeEventExtras(event, metricIds, withBudget.has(index)));
  });

  // 4. 分叉:只有真的有两条以上候选才成立
  let fork: WorldFork | null = null;
  if (adjudication.fork && adjudication.fork.alternatives.length >= 2) {
    const forkId = `fork-${era}`;
    fork = {
      id: forkId,
      snapshotId: `snap-${era}`,
      era,
      title: adjudication.fork.title,
      cause: adjudication.fork.cause,
      alternatives: take(adjudication.fork.alternatives, DISPLAY.forkAlternatives).map(
        (alternative, index) =>
          Object.assign({}, alternative, { id: `${forkId}-${String.fromCharCode(97 + index)}` }),
      ),
      selectedAlternativeId: null,
    };
  }

  const timeBefore = latestTimeLabel(session);

  const snapshot: EraSnapshot = {
    id: `snap-${era}`,
    era,
    branchId,
    timeBefore,
    timeAfter: {
      era,
      label: movingTimeLabel(timeBefore, adjudication.timeAfter),
      elapsed: adjudication.timeAfter.elapsed,
    },
    spanLabel: adjudication.spanLabel,
    reports,
    events,
    conclusion: adjudication.conclusion,
    metricDeltas,
    ...(adjudication.stabilized !== undefined ? { stabilized: adjudication.stabilized } : {}),
  };

  const forks = fork ? [...session.forks, fork] : session.forks;
  const branches = fork
    ? session.branches.map((branch) =>
        branch.id === branchId
          ? { ...branch, summary: `${branch.summary} → 纪元 ${era} 出现自然分叉` }
          : branch,
      )
    : session.branches;

  const nextState: WorldState = {
    currentEra: era,
    currentBranchId: branchId,
    globalMetrics,
    entities,
    latestSnapshotId: snapshot.id,
  };

  return {
    session: {
      ...session,
      snapshots: [...session.snapshots, snapshot],
      forks,
      branches,
      state: nextState,
      directives: input.directives?.length
        ? [...session.directives, ...input.directives]
        : session.directives,
    },
    snapshot,
    fork,
  };
}

/** 当前时间点:有快照就用最后一张的 timeAfter,否则用种子的 startTime */
export function latestTimeLabel(session: WorldSimSession) {
  return session.snapshots.at(-1)?.timeAfter ?? session.seed.startTime;
}

/** 只比较"有没有真的发生变化":空白与标点差异不算移动 */
function timeLabelFingerprint(text: string): string {
  return text.replace(/[\s·・.,,。、()（）+]/g, "");
}

/**
 * 保证时间标签真的在动。
 *
 * 千年、百万年这类粗尺度下,模型很容易两阶段都写"全新世 · 人类世前夜",
 * 于是界面上明明推进了 1200 年,顶部那行时间却一动不动,看起来像卡住了。
 * 这里做一个确定性兜底:标签没动就把它和累计偏移拼起来,至少让玩家看得出来时间走过。
 */
function movingTimeLabel(before: TimeState, after: { label: string; elapsed: string }): string {
  if (timeLabelFingerprint(after.label) !== timeLabelFingerprint(before.label)) return after.label;
  return `${before.label}(+${after.elapsed})`;
}

/** 选择分叉候选:写入 fork,并把新分支标为活跃 */
export function applyForkChoice(
  session: WorldSimSession,
  input: { forkId: string; alternativeId: string },
): WorldSimSession {
  const fork = session.forks.find((item) => item.id === input.forkId);
  if (!fork) return session;
  const alternative = fork.alternatives.find((item) => item.id === input.alternativeId);
  if (!alternative) return session;

  const branchId = `branch-${fork.id}-${alternative.id}`;
  const existing = session.branches.find((branch) => branch.id === branchId);

  const branches: WorldBranch[] = existing
    ? session.branches.map((branch) => ({ ...branch, active: branch.id === branchId }))
    : [
        ...session.branches.map((branch) => ({ ...branch, active: false })),
        {
          id: branchId,
          label: alternative.title,
          parentBranchId: session.state.currentBranchId,
          forkId: fork.id,
          active: true,
          summary: alternative.premise,
        },
      ];

  return {
    ...session,
    forks: session.forks.map((item) =>
      item.id === fork.id ? { ...item, selectedAlternativeId: alternative.id } : item,
    ),
    branches,
    state: { ...session.state, currentBranchId: branchId },
  };
}

/** 分叉选择的说明文本,供下一阶段的主体 Agent 与裁决器参照 */
export function forkChoiceNote(session: WorldSimSession, forkId: string): string | undefined {
  const fork = session.forks.find((item) => item.id === forkId);
  if (!fork?.selectedAlternativeId) return undefined;
  const alternative = fork.alternatives.find((item) => item.id === fork.selectedAlternativeId);
  if (!alternative) return undefined;
  return `「${alternative.title}」—— ${alternative.premise}`;
}

export { GLOBAL_DELTA_LIMIT, GLOBAL_DELTA_LIMIT_CRITICAL, MAX_CHOICE_CARDS };

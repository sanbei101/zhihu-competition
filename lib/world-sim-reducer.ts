import type { ScenarioProfile } from "@/lib/scenario-profiles";
import type {
  EntityRelation,
  EntitySimulationReport,
  EraSnapshot,
  EventChoice,
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
 *   - 事件必须有真实存在的行动者,没有就补一个或丢弃
 *   - 引用了不存在主体的关系、事件,就地剪掉而不是整份失败
 *   - 每批牌的额度、特殊事件的优先级都在这里裁
 *
 * 全部是纯函数:同输入必得同输出,不读时间、不用随机。
 * 这样 SSR 与 CSR 才会一致,存档也才能可靠复现。
 *
 * 对应 plan.md §6.5 与 §13。
 */

/** 一批最多几张"有取舍"的牌。超过这个数玩家会开始闭眼点 */
const MAX_CHOICE_CARDS = 4;
/**
 * 世界至少走满多少个纪元才认可"收敛"。一次级联推演约 3-5 个纪元,
 * 这个值保证玩家能玩 2 个大阶段以上才可能看到结算卡 ——
 * 模型很容易在第一大段就把世界判成"彻底崩坏",直接终结,那是最差的体验。
 */
const MIN_STABILIZED_ERAS = 8;

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
  initialEvents: 5,
  goals: 4,
  capabilities: 5,
  constraints: 4,
  relations: 8,
  actions: 3,
  events: 5,
  forkAlternatives: 3,
  choices: 3,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
  allowCard: boolean,
): Pick<WorldEvent, "choices" | "narrator" | "special"> {
  const extras: Pick<WorldEvent, "choices" | "narrator" | "special"> = {};

  if (event.narrator) extras.narrator = event.narrator;

  if (!allowCard) return extras;

  const choices = take(event.choices ?? [], DISPLAY.choices).filter(
    (choice) => choice.label.trim().length > 0,
  );

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

  // 4. 初始事件:行动者必须存在,否则归给第一个主体(自然事件才允许无主,这里统一兜底)
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
      return Object.assign(built, normalizeEventExtras(event, false));
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
    entities: seed.entities,
    latestSnapshotId: "",
  };

  return {
    version: 7,
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

/**
 * 把裁决的主体结算写回主体清单。
 *
 * 只结算状态词。牌局里主体只以"一枚徽记 + 一个状态词"出现,
 * 指标与关系的逐阶段重算都是纯 token 开销 —— 已经全部砍掉。
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
 * 把一次裁决合并进会话,产出新的会话与本次大阶段的全部快照。
 *
 * 级联裁决:一次裁决自带 3-5 段 beats,每段被拆成一个独立快照(era 递增)。
 * 主体只在大阶段开头博弈一次(报告只挂进第一段),中间段落由裁决器沿时间轴演变。
 * 事件各自归到它们发生的段落,发牌时从整段的快照池里挑。
 *
 * 确定性限制集中在这里:
 *   - 事件行动者必须存在,断引用就地补全或丢弃
 *   - 分叉只有在真的有 2 条以上候选时才落库
 */
export function applyAdjudication(input: {
  session: WorldSimSession;
  reports: EntitySimulationReport[];
  adjudication: Adjudication;
  /** 玩家上一阶段在事件卡上做的取舍,原样记进会话 */
  directives?: PlayerDirective[];
}): { session: WorldSimSession; snapshots: EraSnapshot[]; fork: WorldFork | null } {
  const { session, reports, adjudication } = input;
  const branchId = session.state.currentBranchId;
  const entityIds = new Set(session.state.entities.map((entity) => entity.id));

  let era = session.state.currentEra;
  let timeBefore = latestTimeLabel(session);
  const snapshots: EraSnapshot[] = [];

  for (const [index, beat] of adjudication.beats.entries()) {
    era += 1;

    const fallbackActor = session.state.entities[0]?.id;
    const events: WorldEvent[] = beat.events.map((event, eventIndex) => {
      const actors = [...new Set(event.actorEntityIds.filter((actor) => entityIds.has(actor)))];
      const built: WorldEvent = {
        id: `evt-${era}-${eventIndex + 1}`,
        era,
        title: event.title,
        scope: event.scope,
        severity: event.severity,
        actorEntityIds: actors.length ? actors : fallbackActor ? [fallbackActor] : [],
        summary: event.summary,
      };
      // 段内所有事件都允许带取舍,真正的牌额由发牌时从整段池子里挑
      return Object.assign(built, normalizeEventExtras(event, true));
    });

    snapshots.push({
      id: `snap-${era}`,
      era,
      branchId,
      timeBefore,
      timeAfter: {
        era,
        label: movingTimeLabel(timeBefore, beat.timeAfter),
        elapsed: beat.timeAfter.elapsed,
      },
      spanLabel: beat.spanLabel,
      headline: beat.headline,
      reports: index === 0 ? reports : [],
      events,
      conclusion: beat.conclusion,
    });

    timeBefore = snapshots.at(-1)!.timeAfter;
  }

  // 收敛标记挂在最后一段上,hasSettled 据此发结算卡。
  // 模型倾向于过早宣告世界崩坏:太阳熄灭第一回合就说"长夜定局"。
  // 世界还没走满 MIN_STABILIZED_ERAS 个纪元时,即使模型报了 stabilized 也不认 ——
  // 结算卡是整条世界线的终场,不该在开场就出现。
  const last = snapshots.at(-1)!;
  const totalEras = session.state.currentEra + snapshots.length;
  if (adjudication.stabilized === true && totalEras >= MIN_STABILIZED_ERAS) {
    last.stabilized = true;
  }

  // 4. 分叉:只有真的有两条以上候选才成立
  let fork: WorldFork | null = null;
  if (adjudication.fork && adjudication.fork.alternatives.length >= 2) {
    const forkId = `fork-${era}`;
    fork = {
      id: forkId,
      snapshotId: last.id,
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

  // 主体只结算一次:最终状态词
  const entities = applyEntityUpdates(session.state.entities, adjudication.entityUpdates);

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
    entities,
    latestSnapshotId: last.id,
  };

  return {
    session: {
      ...session,
      snapshots: [...session.snapshots, ...snapshots],
      forks,
      branches,
      state: nextState,
      directives: input.directives?.length
        ? [...session.directives, ...input.directives]
        : session.directives,
    },
    snapshots,
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

export { MAX_CHOICE_CARDS };

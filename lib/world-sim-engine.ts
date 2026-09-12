import { generateStructured } from "@/lib/deepseek";
import {
  ADJUDICATION_INSTRUCTIONS,
  ENTITY_INSTRUCTIONS,
  SEED_INSTRUCTIONS,
  buildAdjudicationPrompt,
  buildEntityPrompt,
  buildSeedPrompt,
} from "@/lib/prompts";
import { getScenarioProfile } from "@/lib/scenario-profiles";
import type {
  EntitySimulationReport,
  PlayerDirective,
  WorldSeed,
  WorldSimSession,
} from "@/lib/world-sim";
import {
  adjudicationSchema,
  entityReportDraftSchema,
  seedGenerationSchema,
  type Adjudication,
  type WorldSimulateEvent,
} from "@/lib/world-sim-events";
import {
  applyAdjudication,
  forkChoiceNote,
  latestTimeLabel,
  normalizeEntityReport,
  normalizeSeed,
} from "@/lib/world-sim-reducer";

/**
 * World Simulation v2 的推演引擎。
 *
 * 这一层不关心传输方式:API 路由与 Server Action 都调用这里,
 * 区别只在于路由会把事件逐个流出去,而 Action 只取最终结果。
 *
 * 三个阶段:
 *   1. generateSeed    一次结构化调用产出完整种子。
 *                      刻意不做成"每个主体一次调用" —— 主体之间必须目标不重叠、
 *                      关系互为指向,一次调用才能保证内部一致;拆开必然互相不知道对方存在。
 *   2. simulateEraStream  每个主体一次并行调用,互不可见;全部回收后才交裁决器合并。
 *                      这是真正需要并行的部分,也是"多智能体"的实际含义。
 *   3. adjudicate      一次调用完成 plan §6.4 的合并裁定:产出快照、自然分叉,
 *                      以及每个事件上"玩家可以取舍的节点"。
 */

// ==================== 1. 世界种子 ====================

export interface SeedContext {
  scenarioId: string;
  scenarioTitle: string;
  scenarioUrl: string;
  themeId: string;
}

export async function generateSeed(context: SeedContext, signal?: AbortSignal): Promise<WorldSeed> {
  const profile = getScenarioProfile(context.themeId);

  const generation = await generateStructured({
    instructions: SEED_INSTRUCTIONS,
    prompt: buildSeedPrompt({
      scenarioId: context.scenarioId,
      title: context.scenarioTitle,
      profile,
    }),
    schema: seedGenerationSchema,
    // 种子要稳:这里不要创意,要的是合乎时代条件的推演
    temperature: 0.55,
    // 预算给足。种子要一次性吐出 3-4 个大主体 × 各自的目标/能力/约束/指标/关系,
    // 预算卡太紧会截断成不合法 JSON,而截断的代价是整次调用白烧。
    maxOutputTokens: 6000,
    abortSignal: signal,
  });

  const parsed = seedGenerationSchema.parse(generation);

  return normalizeSeed({
    generation: parsed,
    scenarioId: context.scenarioId,
    scenarioTitle: context.scenarioTitle,
    scenarioUrl: context.scenarioUrl,
    themeId: context.themeId,
    profile,
  });
}

// ==================== 2. 主体并行推演 ====================

/** 一个主体的推演结果:要么有报告,要么有失败原因 */
interface EntitySimulationOutcome {
  entityId: string;
  entityName: string;
  report?: EntitySimulationReport;
  error?: string;
}

async function simulateEntity(input: {
  session: WorldSimSession;
  entityId: string;
  followedEntityId?: string;
  forkChoiceNote?: string;
  /** 玩家上一阶段的取舍,转成一行行短句喂进来 */
  directiveNotes?: string[];
  signal?: AbortSignal;
}): Promise<EntitySimulationOutcome> {
  const { session, entityId } = input;
  const entity = session.state.entities.find((item) => item.id === entityId);

  if (!entity) return { entityId, entityName: entityId, error: "主体不存在" };

  // 这个主体上一阶段做过什么 —— 提示词靠它来避免"每轮重复同一套动作"
  const previousReports = session.snapshots
    .at(-1)
    ?.reports.filter((report) => report.entityId === entityId);
  const recentEvents = (session.snapshots.at(-1)?.events ?? [])
    .slice(0, 3)
    .map((event) => ({ title: event.title, summary: event.summary }));
  const timeBefore = latestTimeLabel(session);

  try {
    const draft = await generateStructured({
      instructions: ENTITY_INSTRUCTIONS,
      prompt: buildEntityPrompt({
        seed: session.seed,
        entity,
        currentEra: session.state.currentEra,
        timeBeforeLabel: timeBefore.label,
        elapsedSinceStart: timeBefore.elapsed,
        previousReports: previousReports ?? [],
        recentEvents,
        followed: input.followedEntityId === entityId,
        ...(input.forkChoiceNote ? { forkChoiceNote: input.forkChoiceNote } : {}),
        ...(input.directiveNotes?.length ? { directives: input.directiveNotes } : {}),
      }),
      schema: entityReportDraftSchema,
      temperature: 0.85,
      // 报告只有 intent + 3 条行动,700 绰绰有余 —— 预算卡在这里,
      // 主体写得啰嗦时会被截断重试,而不是让整个时代多等十几秒
      maxOutputTokens: 700,
      abortSignal: input.signal,
    });

    // entityId 由服务端钉死,列表按展示预算裁剪 —— 模型多写一条不该让整份报告作废
    return {
      entityId,
      entityName: entity.name,
      report: normalizeEntityReport(entityReportDraftSchema.parse(draft), entityId),
    };
  } catch (error) {
    console.error(`主体 ${entity.name} 推演失败`, error);
    return {
      entityId,
      entityName: entity.name,
      error: error instanceof Error ? error.message : "推演失败",
    };
  }
}

// ==================== 3. 世界裁决 ====================

export async function adjudicate(input: {
  session: WorldSimSession;
  reports: EntitySimulationReport[];
  followedEntityId?: string;
  forkChoiceNote?: string;
  /** 玩家上一阶段在事件卡上的取舍。它已是条件,不是提议 */
  directives?: { title: string; label: string; note: string }[];
  signal?: AbortSignal;
}): Promise<Adjudication> {
  const result = await generateStructured({
    instructions: ADJUDICATION_INSTRUCTIONS,
    prompt: buildAdjudicationPrompt({
      session: input.session,
      reports: input.reports,
      ...(input.followedEntityId ? { followedEntityId: input.followedEntityId } : {}),
      ...(input.forkChoiceNote ? { forkChoiceNote: input.forkChoiceNote } : {}),
      ...(input.directives?.length ? { directives: input.directives } : {}),
    }),
    schema: adjudicationSchema,
    temperature: 0.75,
    // 一整段级联历史(3-5 段 beats × 事件与结论),4500 封顶。
    // 超过就说明模型写超长了,与其多等,不如让它被截断后走结构化抢救
    maxOutputTokens: 4500,
    abortSignal: input.signal,
  });

  return adjudicationSchema.parse(result);
}

/** 会话当前所处的位置,用于给主体 Agent 与裁决器对齐时间感 */
export function currentPosition(session: WorldSimSession) {
  return latestTimeLabel(session);
}

/** 分叉选择写进会话后,下一阶段要带给主体 Agent 的前提说明 */
export function activeForkNote(session: WorldSimSession): string | undefined {
  const last = session.forks.at(-1);
  if (!last?.selectedAlternativeId) return undefined;
  return forkChoiceNote(session, last.id);
}

// ==================== 4. 推进一个时代的完整事件流 ====================

/**
 * 生成器而不是一次性返回:路由可以直接 for await 推给客户端,
 * Server Action 也可以只取最后那个 complete 事件。
 *
 * 事件顺序刻意固定成:
 *   simulation-start → entity-start ×N → entity-report ×N → adjudicating
 *   → world-event ×N → causal-chain ×N → fork-detected? → snapshot → state → complete
 *
 * entity-start 在所有并行调用之前统一发出(主体清单此刻已知),
 * 这样客户端可以先摆好舞台,报告回来一个填一个,而不是等全部跑完才一次刷出来。
 */
export async function* simulateEraStream(input: {
  session: WorldSimSession;
  followedEntityId?: string;
  directives?: PlayerDirective[];
  signal?: AbortSignal;
}): AsyncGenerator<WorldSimulateEvent> {
  const { session } = input;
  const note = activeForkNote(session);

  yield {
    type: "simulation-start",
    era: session.state.currentEra,
    timeLabel: latestTimeLabel(session).label,
  };

  const entities = session.state.entities;
  for (const entity of entities) {
    yield { type: "entity-start", entityId: entity.id, name: entity.name };
  }

  // 真正的并行:每个主体只看得见世界状态,看不见彼此这一阶段的打算
  const outcomes = await Promise.all(
    entities.map((entity) =>
      simulateEntity({
        session,
        entityId: entity.id,
        ...(input.followedEntityId ? { followedEntityId: input.followedEntityId } : {}),
        ...(note ? { forkChoiceNote: note } : {}),
        ...(input.directives?.length
          ? {
              directiveNotes: input.directives.map(
                (item) => `在「${item.cardTitle}」上选了「${item.choiceLabel}」:${item.note}`,
              ),
            }
          : {}),
        ...(input.signal ? { signal: input.signal } : {}),
      }),
    ),
  );

  for (const outcome of outcomes) {
    if (outcome.report) {
      yield { type: "entity-report", report: outcome.report };
    } else {
      yield {
        type: "entity-error",
        entityId: outcome.entityId,
        error: {
          code: "UPSTREAM_FAILURE",
          message: `${outcome.entityName} 本阶段推演失败,裁决时按它没有行动处理`,
          retryable: true,
        },
      };
    }
  }

  const reports = outcomes
    .map((outcome) => outcome.report)
    .filter((report): report is EntitySimulationReport => Boolean(report));

  if (reports.length === 0) {
    yield {
      type: "error",
      error: {
        code: "UPSTREAM_FAILURE",
        message: "所有主体都未能提交推演,本阶段无法继续",
        retryable: true,
      },
    };
    return;
  }

  yield { type: "adjudicating" };

  let adjudication: Adjudication;
  try {
    adjudication = await adjudicate({
      session,
      reports,
      ...(input.followedEntityId ? { followedEntityId: input.followedEntityId } : {}),
      ...(note ? { forkChoiceNote: note } : {}),
      ...(input.directives?.length
        ? {
            directives: input.directives.map((item) => ({
              title: item.cardTitle,
              label: item.choiceLabel,
              note: item.note,
            })),
          }
        : {}),
      ...(input.signal ? { signal: input.signal } : {}),
    });
  } catch (error) {
    console.error("世界裁决失败", error);
    yield {
      type: "error",
      error: { code: "UPSTREAM_FAILURE", message: "世界裁决失败,请重试", retryable: true },
    };
    return;
  }

  const {
    session: next,
    snapshots,
    fork,
  } = applyAdjudication({
    session,
    reports,
    adjudication,
    ...(input.directives?.length ? { directives: input.directives } : {}),
  });

  // 逐段吐出来:beat-start 标记一段历史的开始,随后是这一段的全部事件。
  // 客户端据此把"世界演算室"切成一条时间线,而不是一锅粥。
  for (const snapshot of snapshots) {
    yield {
      type: "beat-start",
      era: snapshot.era,
      spanLabel: snapshot.spanLabel,
      timeLabel: snapshot.timeAfter.label,
      headline: snapshot.headline,
    };
    for (const event of snapshot.events) yield { type: "world-event", event };
  }
  if (fork) yield { type: "fork-detected", fork };

  yield { type: "snapshot", snapshot: snapshots.at(-1)! };
  yield { type: "state", state: next.state };
  yield { type: "complete", session: next };
}

/** 不流式的一次性推进:跑到流结束,取最终的会话 */
export async function simulateEraOnce(
  input: {
    session: WorldSimSession;
    followedEntityId?: string;
    directives?: PlayerDirective[];
    signal?: AbortSignal;
  },
  onEvent?: (event: WorldSimulateEvent) => void,
): Promise<WorldSimSession> {
  let finalSession: WorldSimSession | null = null;
  let lastError: string | null = null;

  for await (const event of simulateEraStream(input)) {
    onEvent?.(event);
    if (event.type === "complete") finalSession = event.session;
    if (event.type === "error") lastError = event.error.message;
  }

  if (!finalSession) throw new Error(lastError ?? "推演未能完成");
  return finalSession;
}

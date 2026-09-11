import { generateStructured } from "@/lib/deepseek";
import {
  ADJUDICATION_INSTRUCTIONS,
  ENTITY_INSTRUCTIONS,
  OBSERVATION_INSTRUCTIONS,
  SEED_INSTRUCTIONS,
  buildAdjudicationPrompt,
  buildEntityPrompt,
  buildObservationPrompt,
  buildSeedPrompt,
} from "@/lib/prompts";
import { getScenarioProfile } from "@/lib/scenario-profiles";
import type { EntitySimulationReport, WorldSeed, WorldSimSession } from "@/lib/world-sim";
import {
  adjudicationSchema,
  entityReportDraftSchema,
  observationOptionsSchema,
  seedGenerationSchema,
  type Adjudication,
  type ObservationOptions,
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
 *   3. adjudicate      一次调用完成 plan §6.4 的合并裁定,产出快照与自然分叉。
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
    // 预算给足。种子要一次性吐出 4-7 个主体 × 各自的目标/能力/约束/指标/关系,
    // 预算卡太紧会截断成不合法 JSON,而截断的代价是整次调用白烧。
    maxOutputTokens: 8000,
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
  signal?: AbortSignal;
}): Promise<EntitySimulationOutcome> {
  const { session, entityId } = input;
  const entity = session.state.entities.find((item) => item.id === entityId);

  if (!entity) return { entityId, entityName: entityId, error: "主体不存在" };

  // 这个主体上一阶段做过什么 —— 提示词靠它来避免"每轮重复同一套动作"
  const previousReports = session.snapshots
    .flatMap((snapshot) => snapshot.reports)
    .filter((report) => report.entityId === entityId);
  const recentEvents = (session.snapshots.at(-1)?.events ?? []).map((event) => ({
    title: event.title,
    summary: event.summary,
  }));
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
        previousReports,
        recentEvents,
        followed: input.followedEntityId === entityId,
        ...(input.forkChoiceNote ? { forkChoiceNote: input.forkChoiceNote } : {}),
      }),
      schema: entityReportDraftSchema,
      temperature: 0.85,
      maxOutputTokens: 1600,
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
  signal?: AbortSignal;
}): Promise<Adjudication> {
  const result = await generateStructured({
    instructions: ADJUDICATION_INSTRUCTIONS,
    prompt: buildAdjudicationPrompt({
      session: input.session,
      reports: input.reports,
      ...(input.followedEntityId ? { followedEntityId: input.followedEntityId } : {}),
      ...(input.forkChoiceNote ? { forkChoiceNote: input.forkChoiceNote } : {}),
    }),
    schema: adjudicationSchema,
    temperature: 0.75,
    maxOutputTokens: 8000,
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

  const { session: next, snapshot, fork } = applyAdjudication({ session, reports, adjudication });

  for (const event of snapshot.events) yield { type: "world-event", event };
  for (const chain of snapshot.causalChains) yield { type: "causal-chain", chain };
  if (fork) yield { type: "fork-detected", fork };

  yield { type: "snapshot", snapshot };
  yield { type: "state", state: next.state };
  yield { type: "complete", session: next };
}

/** 不流式的一次性推进:跑到流结束,取最终的会话 */
export async function simulateEraOnce(
  input: {
    session: WorldSimSession;
    followedEntityId?: string;
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

// ==================== 5. 观测选项 ====================

/** 未决分叉是硬约束:它必须出现在选项里,否则玩家会卡在无法推进的状态 */
function buildFallbackObservations(session: WorldSimSession): ObservationOptions {
  const pendingFork = session.forks.find((fork) => !fork.selectedAlternativeId);
  const latest = session.snapshots.at(-1) ?? null;
  const changed = session.state.entities.find((entity) => entity.changedThisEra);

  const options: ObservationOptions["options"] = [
    ...(pendingFork
      ? [
          {
            id: "choose-fork",
            label: `决定「${pendingFork.title}」`,
            hint: "历史停在岔口上,先选一条继续观察,否则时间无法往前。",
            kind: "choose-fork" as const,
            targetId: pendingFork.id,
          },
        ]
      : []),
    {
      id: "advance-era",
      label: `推进到纪元 ${session.state.currentEra + 1}`,
      hint: "所有主体按各自目标自主行动一个阶段,再由世界裁决合并冲突。",
      kind: "advance-era" as const,
    },
    ...(changed
      ? [
          {
            id: `follow-${changed.id}`,
            label: `追踪 ${changed.name}`,
            hint: `${changed.name} 正处于变化之中,展开它的完整决策链。`,
            kind: "follow-entity" as const,
            targetId: changed.id,
          },
        ]
      : []),
    ...(latest?.events[0]
      ? [
          {
            id: `inspect-${latest.events[0].id}`,
            label: `查看「${latest.events[0].title}」`,
            hint: "看清这件事是怎么从各个主体的行动里长出来的。",
            kind: "inspect-event" as const,
            targetId: latest.events[0].id,
          },
        ]
      : []),
  ];

  return { options: options.slice(0, 4) };
}

/** 模型漏掉分叉选项时补上,并保证总数不超过 4 */
function ensureForkOption(
  options: ObservationOptions,
  fallback: ObservationOptions,
): ObservationOptions {
  const forkOption = fallback.options.find((option) => option.kind === "choose-fork");
  if (!forkOption) return { options: options.options.slice(0, 4) };
  if (options.options.some((option) => option.kind === "choose-fork")) {
    return { options: options.options.slice(0, 4) };
  }
  const trimmed = options.options.filter((option) => option.kind !== "advance-era").slice(0, 3);
  return { options: [forkOption, ...trimmed] };
}

export async function generateObservations(input: {
  session: WorldSimSession;
  followedEntityId?: string;
  signal?: AbortSignal;
}): Promise<ObservationOptions> {
  const fallback = buildFallbackObservations(input.session);

  try {
    const result = await generateStructured({
      instructions: OBSERVATION_INSTRUCTIONS,
      prompt: buildObservationPrompt({
        session: input.session,
        ...(input.followedEntityId ? { followedEntityId: input.followedEntityId } : {}),
      }),
      schema: observationOptionsSchema,
      temperature: 0.7,
      maxOutputTokens: 1200,
      abortSignal: input.signal,
    });
    return ensureForkOption(observationOptionsSchema.parse(result), fallback);
  } catch (error) {
    console.error("观测选项生成失败,使用确定性兜底", error);
    return fallback;
  }
}

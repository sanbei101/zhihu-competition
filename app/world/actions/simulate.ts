"use server";

import { generateStructured } from "@/lib/deepseek";
import {
  advanceTime,
  entitySimulationReportSchema,
  type CausalChain,
  type EntitySimulationReport,
  type EraSnapshot,
  type ObservationOption,
  type WorldEvent,
  type WorldFork,
  type WorldSeed,
  type WorldState,
  worldEventSchema,
  worldForkSchema,
} from "@/lib/world-sim";
import { buildEntityPrompt, ENTITY_SIMULATION_INSTRUCTIONS } from "@/lib/world-sim-prompts";

export interface SimulationCallbacks {
  onEvent: (event: SimulationProgressEvent) => void;
}

export type SimulationProgressEvent =
  | { type: "entity-start"; entityId: string }
  | { type: "entity-report"; report: EntitySimulationReport };

function normalizeEvent(event: WorldEvent, fallbackId: string, entityId: string): WorldEvent {
  return worldEventSchema.parse({
    ...event,
    id: fallbackId,
    sourceEntityIds: [entityId],
  });
}

function applyChanges(state: WorldState, reports: EntitySimulationReport[]): WorldState {
  const knownEntities = new Set(state.entities.map((entity) => entity.entityId));
  const changes = reports
    .flatMap((report) => report.stateChanges)
    .filter((change) => knownEntities.has(change.entityId));
  const nextEntities = state.entities.map((entity) => {
    const entityChanges = changes.filter((change) => change.entityId === entity.entityId);
    return {
      ...entity,
      metrics: entity.metrics.map((metric) => {
        const delta = entityChanges
          .filter((change) => change.metricId === metric.id)
          .reduce((total, change) => total + Math.max(-20, Math.min(20, change.delta)), 0);
        return {
          ...metric,
          value: Math.max(0, Math.min(100, metric.value + Math.max(-20, Math.min(20, delta)))),
        };
      }),
      status:
        reports.find((report) => report.entityId === entity.entityId)?.reasoningSummary ??
        entity.status,
      lastAction:
        reports.find((report) => report.entityId === entity.entityId)?.actions[0]?.summary ??
        entity.lastAction,
    };
  });
  const metricDeltas = new Map<string, number>();
  for (const change of changes)
    metricDeltas.set(change.metricId, (metricDeltas.get(change.metricId) ?? 0) + change.delta);
  return {
    ...state,
    time: advanceTime(state.time, { unit: state.time.unit, amount: state.time.amount }),
    entities: nextEntities,
    globalMetrics: state.globalMetrics.map((metric) => ({
      ...metric,
      value: Math.max(
        0,
        Math.min(100, metric.value + Math.max(-20, Math.min(20, metricDeltas.get(metric.id) ?? 0))),
      ),
    })),
  };
}

function createEvents(reports: EntitySimulationReport[]): WorldEvent[] {
  const events = reports.flatMap((report) =>
    report.events.map((event, index) =>
      normalizeEvent(event, `event-${report.entityId}-${index}`, report.entityId),
    ),
  );
  if (events.length >= 3) return events.slice(0, 5);
  return reports.slice(0, 3).map((report, index) =>
    normalizeEvent(
      {
        id: "",
        title: `${report.entityId} 的行动产生外溢影响`,
        summary: report.actions[0]?.summary ?? report.reasoningSummary,
        sourceEntityIds: [report.entityId],
        severity: index === 0 ? "warning" : "info",
      },
      `event-${index + 1}`,
      report.entityId,
    ),
  );
}

function createFork(
  snapshotId: string,
  event: WorldEvent,
  reports: EntitySimulationReport[],
): WorldFork {
  const drivers = reports.slice(0, 3).map((report) => report.intent);
  return worldForkSchema.parse({
    id: `fork-${snapshotId}`,
    snapshotId,
    triggerEventId: event.id,
    title: "冲突行动形成两条稳定路线",
    cause: `${event.summary}使不同主体对下一阶段的资源与制度安排产生分歧。`,
    selectedAlternativeId: null,
    alternatives: [
      {
        id: "coordination",
        title: "协作整合路线",
        premise: "关键主体接受更高程度的共同协调。",
        drivers,
        expectedEffects: ["短期稳定度上升", "资源被集中调度", "地方或边缘主体的自主空间收窄"],
        plausibility: "high",
      },
      {
        id: "fragmentation",
        title: "分散适应路线",
        premise: "主体保留更多自主权,通过局部试错适应新条件。",
        drivers: ["地方资源差异", "互不信任", "多种方案同时竞争"],
        expectedEffects: ["局部创新加快", "短期冲突压力上升", "长期形成新的权力平衡"],
        plausibility: "medium",
      },
    ],
  });
}

export async function simulateWorld(
  seed: WorldSeed,
  state: WorldState,
  observation: ObservationOption,
  history: EraSnapshot[],
  callbacks: SimulationCallbacks,
): Promise<EraSnapshot> {
  const reportsPromise = Promise.all(
    seed.entities.map(async (entity) => {
      callbacks.onEvent({ type: "entity-start", entityId: entity.id });
      const report = await generateStructured({
        instructions: ENTITY_SIMULATION_INSTRUCTIONS,
        prompt: buildEntityPrompt({ seed, state, entity, observation: observation.description }),
        schema: entitySimulationReportSchema,
        temperature: 0.7,
        maxOutputTokens: 1800,
      });
      const parsed = entitySimulationReportSchema.parse(report);
      callbacks.onEvent({ type: "entity-report", report: parsed });
      return parsed;
    }),
  );
  const reports = await reportsPromise;
  const id = `era-${history.length + 1}`;
  const events = createEvents(reports);
  const stateAfter = applyChanges(state, reports);
  const chain: CausalChain = {
    steps: [
      `${state.time.value}${state.time.unit}阶段,主体开始执行各自目标`,
      reports[0]?.actions[0]?.summary ?? "主体行动改变局部状态",
      events[0]?.summary ?? "行动影响扩散到其他主体",
      `全局指标与下一阶段的约束发生变化`,
    ],
    conclusion: "局部行动通过资源、制度或生态关系扩散,世界进入新的稳定区间。",
  };
  const forks = events.length > 0 ? [createFork(id, events[0], reports)] : [];
  return {
    id,
    parentSnapshotId: history.at(-1)?.id ?? null,
    branchId: state.branchId,
    timeBefore: state.time,
    timeAfter: stateAfter.time,
    stateBefore: structuredClone(state),
    reports,
    events,
    causalChains: [chain],
    forks,
    stateAfter: { ...stateAfter, recentEvents: events },
  };
}

import { z } from "zod";

export const simulationModeSchema = z.enum([
  "historical-civilization",
  "ecological-evolution",
  "survival-collapse",
  "planetary-disaster",
  "post-human",
  "socio-technical",
  "first-contact",
]);
export type SimulationMode = z.infer<typeof simulationModeSchema>;

export const timeScaleSchema = z.object({
  unit: z.enum(["hour", "day", "week", "month", "year", "decade", "century", "millennium"]),
  amount: z.number().int().positive().max(1000000),
});
export type TimeScale = z.infer<typeof timeScaleSchema>;

export const timeStateSchema = timeScaleSchema.extend({ value: z.number().int() });
export type TimeState = z.infer<typeof timeStateSchema>;

export const entityKindSchema = z.enum([
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
export type EntityKind = z.infer<typeof entityKindSchema>;

export const globalMetricIdSchema = z.enum([
  "population",
  "stability",
  "resources",
  "technology",
  "cohesion",
  "environment",
  "conflict",
  "knowledge",
]);
export type GlobalMetricId = z.infer<typeof globalMetricIdSchema>;

const metricSchema = z.object({
  id: globalMetricIdSchema,
  label: z.string(),
  value: z.number().min(0).max(100),
});
export type EntityMetric = z.infer<typeof metricSchema>;

export const worldEntitySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(80),
  kind: entityKindSchema,
  description: z.string().max(400),
  goals: z.array(z.string().max(160)).min(1).max(4),
  capabilities: z.array(z.string().max(160)).min(1).max(4),
  constraints: z.array(z.string().max(160)).min(1).max(4),
  metrics: z.array(metricSchema).min(1).max(8),
  pixelArchetype: z.string().max(40),
});
export type WorldEntity = z.infer<typeof worldEntitySchema>;

export const globalMetricSchema = z.object({
  id: globalMetricIdSchema,
  label: z.string(),
  value: z.number().min(0).max(100),
  description: z.string(),
  goodDirection: z.enum(["up", "down", "mixed"]),
});
export type GlobalMetric = z.infer<typeof globalMetricSchema>;

export const worldEventSchema = z.object({
  id: z.string(),
  title: z.string().max(120),
  summary: z.string().max(500),
  sourceEntityIds: z.array(z.string()).min(1),
  severity: z.enum(["info", "warning", "critical"]),
});
export type WorldEvent = z.infer<typeof worldEventSchema>;

export const counterfactualPremiseSchema = z.object({
  statement: z.string().min(1).max(300),
  divergencePoint: z.string().min(1).max(240),
  affectedDomains: z.array(z.string()).min(1).max(6),
  certainty: z.literal("given"),
});
export type CounterfactualPremise = z.infer<typeof counterfactualPremiseSchema>;

export const hardRuleSchema = z.object({ id: z.string(), rule: z.string().max(240) });
export type HardRule = z.infer<typeof hardRuleSchema>;

export const worldSeedSchema = z.object({
  scenarioId: z.string(),
  scenarioTitle: z.string(),
  themeId: z.string(),
  simulationMode: simulationModeSchema,
  premise: counterfactualPremiseSchema,
  startTime: timeStateSchema,
  timeScale: timeScaleSchema,
  hardRules: z.array(hardRuleSchema).min(3).max(6),
  entities: z.array(worldEntitySchema).min(4).max(7),
  globalMetrics: z.array(globalMetricSchema).min(4).max(6),
  initialEvents: z.array(worldEventSchema).min(1).max(4),
});
export type WorldSeed = z.infer<typeof worldSeedSchema>;

export const entityStateSchema = z.object({
  entityId: z.string(),
  metrics: z.array(metricSchema).min(1).max(8),
  status: z.string().max(200),
  lastAction: z.string().max(300),
});
export type EntityState = z.infer<typeof entityStateSchema>;

export const worldStateSchema = z.object({
  time: timeStateSchema,
  branchId: z.string(),
  entities: z.array(entityStateSchema).min(4).max(7),
  globalMetrics: z.array(globalMetricSchema).min(4).max(6),
  recentEvents: z.array(worldEventSchema).max(12),
});
export type WorldState = z.infer<typeof worldStateSchema>;

export const entityActionSchema = z.object({
  summary: z.string().max(240),
  targetEntityId: z.string().nullable(),
  resource: z.string().max(80),
});
export type EntityAction = z.infer<typeof entityActionSchema>;

export const proposedStateChangeSchema = z.object({
  entityId: z.string(),
  metricId: globalMetricIdSchema,
  delta: z.number().int().min(-20).max(20),
  reason: z.string().max(240),
});
export type ProposedStateChange = z.infer<typeof proposedStateChangeSchema>;

export const entitySimulationReportSchema = z.object({
  entityId: z.string(),
  intent: z.string().max(240),
  actions: z.array(entityActionSchema).min(1).max(3),
  stateChanges: z.array(proposedStateChangeSchema).max(4),
  events: z.array(worldEventSchema).max(2),
  reasoningSummary: z.string().max(320),
});
export type EntitySimulationReport = z.infer<typeof entitySimulationReportSchema>;

export const causalChainSchema = z.object({
  steps: z.array(z.string().max(180)).min(3).max(5),
  conclusion: z.string().max(300),
});
export type CausalChain = z.infer<typeof causalChainSchema>;

export const worldForkAlternativeSchema = z.object({
  id: z.string(),
  title: z.string().max(100),
  premise: z.string().max(260),
  drivers: z.array(z.string().max(140)).min(1).max(4),
  expectedEffects: z.array(z.string().max(160)).min(1).max(4),
  plausibility: z.enum(["low", "medium", "high"]),
});
export type WorldForkAlternative = z.infer<typeof worldForkAlternativeSchema>;

export const worldForkSchema = z.object({
  id: z.string(),
  snapshotId: z.string(),
  triggerEventId: z.string(),
  title: z.string().max(120),
  cause: z.string().max(280),
  alternatives: z.array(worldForkAlternativeSchema).min(2).max(3),
  selectedAlternativeId: z.string().nullable(),
});
export type WorldFork = z.infer<typeof worldForkSchema>;

export const eraSnapshotSchema = z.object({
  id: z.string(),
  parentSnapshotId: z.string().nullable(),
  branchId: z.string(),
  timeBefore: timeStateSchema,
  timeAfter: timeStateSchema,
  stateBefore: worldStateSchema,
  reports: z.array(entitySimulationReportSchema),
  events: z.array(worldEventSchema).min(1),
  causalChains: z.array(causalChainSchema).min(1),
  forks: z.array(worldForkSchema),
  stateAfter: worldStateSchema,
});
export type EraSnapshot = z.infer<typeof eraSnapshotSchema>;

export const observationOptionSchema = z.object({
  id: z.string(),
  action: z.enum(["advance-era", "follow-entity", "inspect-event", "choose-fork"]),
  label: z.string().max(80),
  description: z.string().max(200),
  focusEntityId: z.string().nullable(),
  forkAlternativeId: z.string().nullable(),
});
export type ObservationOption = z.infer<typeof observationOptionSchema>;

export const worldSimulationSessionSchema = z.object({
  version: z.literal(2),
  scenarioId: z.string(),
  scenarioTitle: z.string(),
  themeId: z.string(),
  seed: worldSeedSchema,
  currentState: worldStateSchema,
  activeBranchId: z.string(),
  snapshots: z.array(eraSnapshotSchema).max(20),
  focusEntityId: z.string().nullable(),
  status: z.enum(["ongoing", "ended"]),
});
export type WorldSimulationSession = z.infer<typeof worldSimulationSessionSchema>;

export const worldSeedRequestSchema = z.object({
  scenarioId: z.string().min(1),
  title: z.string().min(1).max(300),
  themeId: z.string().min(1),
  themeName: z.string().min(1),
  themeVisual: z.string().min(1),
  themeHint: z.string().min(1),
  url: z.string().optional(),
});

export const simulationRequestSchema = z.object({
  seed: worldSeedSchema,
  state: worldStateSchema,
  observation: observationOptionSchema,
  history: z.array(eraSnapshotSchema).max(20),
});

export const simulationStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("simulation-start") }),
  z.object({ type: z.literal("time-advance"), time: timeStateSchema }),
  z.object({ type: z.literal("entity-start"), entityId: z.string() }),
  z.object({ type: z.literal("entity-report"), report: entitySimulationReportSchema }),
  z.object({ type: z.literal("world-event"), event: worldEventSchema }),
  z.object({ type: z.literal("causal-chain"), chain: causalChainSchema }),
  z.object({ type: z.literal("fork-detected"), fork: worldForkSchema }),
  z.object({ type: z.literal("snapshot"), snapshot: eraSnapshotSchema }),
  z.object({ type: z.literal("complete"), snapshot: eraSnapshotSchema }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type SimulationStreamEvent = z.infer<typeof simulationStreamEventSchema>;

export const seedStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("seed-start") }),
  z.object({ type: z.literal("setting"), premise: counterfactualPremiseSchema }),
  z.object({ type: z.literal("entity-start"), entityId: z.string() }),
  z.object({ type: z.literal("entity"), entity: worldEntitySchema }),
  z.object({ type: z.literal("complete"), seed: worldSeedSchema, state: worldStateSchema }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type SeedStreamEvent = z.infer<typeof seedStreamEventSchema>;

export function worldSimStorageKey(scenarioId: string): string {
  return `world-sim:${scenarioId}`;
}

export function formatTime(time: TimeState): string {
  const unitLabels: Record<TimeScale["unit"], string> = {
    hour: "小时",
    day: "天",
    week: "周",
    month: "月",
    year: "年",
    decade: "十年",
    century: "世纪",
    millennium: "千年",
  };
  return `${time.value}${unitLabels[time.unit]}`;
}

export function advanceTime(time: TimeState, scale: TimeScale): TimeState {
  return { value: time.value + scale.amount, unit: scale.unit, amount: scale.amount };
}

export function createInitialWorldState(seed: WorldSeed): WorldState {
  return {
    time: seed.startTime,
    branchId: "main",
    entities: seed.entities.map((entity) => ({
      entityId: entity.id,
      metrics: entity.metrics,
      status: "等待第一个时代报告",
      lastAction: "尚未行动",
    })),
    globalMetrics: seed.globalMetrics,
    recentEvents: seed.initialEvents,
  };
}

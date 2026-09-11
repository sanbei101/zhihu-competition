"use server";

import { z } from "zod";

import { generateStructured } from "@/lib/deepseek";
import { getScenarioProfile } from "@/lib/scenario-profiles";
import {
  globalMetricSchema,
  hardRuleSchema,
  timeScaleSchema,
  timeStateSchema,
  worldEntitySchema,
  worldEventSchema,
  worldSeedRequestSchema,
  worldSeedSchema,
  type WorldSeed,
} from "@/lib/world-sim";
import { buildSeedPrompt, WORLD_SEED_INSTRUCTIONS } from "@/lib/world-sim-prompts";

const seedOutputSchema = z.object({
  simulationMode: worldSeedSchema.shape.simulationMode,
  premise: worldSeedSchema.shape.premise,
  startTime: timeStateSchema,
  timeScale: timeScaleSchema,
  hardRules: z.array(hardRuleSchema).min(3).max(6),
  entities: z.array(worldEntitySchema).min(4).max(7),
  globalMetrics: z.array(globalMetricSchema).min(4).max(6),
  initialEvents: z.array(worldEventSchema).min(1).max(4),
});

export async function generateWorldSeed(input: unknown): Promise<WorldSeed> {
  const request = worldSeedRequestSchema.parse(input);
  const profile = getScenarioProfile(request.themeId);
  const generated = await generateStructured({
    instructions: WORLD_SEED_INSTRUCTIONS,
    prompt: buildSeedPrompt({ ...request, profile }),
    schema: seedOutputSchema,
    temperature: 0.55,
    maxOutputTokens: 6500,
  });

  const seed = worldSeedSchema.parse({
    ...generated,
    scenarioId: request.scenarioId,
    scenarioTitle: request.title,
    themeId: request.themeId,
  });

  const allowedKinds = new Set(profile.entityKinds);
  if (seed.entities.some((entity) => !allowedKinds.has(entity.kind))) {
    throw new Error("模型生成了不符合主题的主体类型,请重试");
  }

  return seed;
}

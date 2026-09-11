"use server";

import { z } from "zod";

import {
  observationOptionSchema,
  type EraSnapshot,
  type ObservationOption,
  type WorldState,
} from "@/lib/world-sim";

const observationInputSchema = z.object({
  state: z.unknown(),
  history: z.unknown(),
  focusEntityId: z.string().nullable().optional(),
});

export async function generateObservationOptions(input: unknown): Promise<ObservationOption[]> {
  const parsed = observationInputSchema.parse(input);
  const state = parsed.state as WorldState;
  const history = parsed.history as EraSnapshot[];
  const focus = parsed.focusEntityId ?? null;
  const options = [
    {
      id: "advance-era",
      action: "advance-era" as const,
      label: `推进到 ${state.time.value + state.time.amount}${state.time.unit === "year" ? "年" : ""}`,
      description: "让所有主体基于当前状态自主行动,并生成下一份时代报告。",
      focusEntityId: null,
      forkAlternativeId: null,
    },
    {
      id: "follow-entity",
      action: "follow-entity" as const,
      label: `追踪 ${focus ? "当前主体" : "关键主体"}`,
      description: "把下一阶段的报告重点放在一个世界主体的行动与外溢影响上。",
      focusEntityId: focus ?? state.entities[0]?.entityId ?? null,
      forkAlternativeId: null,
    },
    {
      id: "inspect-event",
      action: "inspect-event" as const,
      label: "调查最近事件",
      description: history.length
        ? "沿着最近一条因果链继续观察它如何扩散。"
        : "观察反事实前提如何穿过不同主体。",
      focusEntityId: null,
      forkAlternativeId: null,
    },
  ];
  return options.map((option) => observationOptionSchema.parse(option));
}

"use server";

import { z } from "zod";

import { fail, failParse, requireDeepSeekKey, type ActionResult } from "@/app/world/action-result";
import { generateStructured } from "@/lib/deepseek";
import { OPTIONS_INSTRUCTIONS, buildOptionsPrompt } from "@/lib/prompts";
import { worldCastSchema } from "@/lib/world-cast";
import {
  agentRelationSchema,
  crisisSchema,
  metricsSchema,
  turnRecordSchema,
  ultimatumSchema,
} from "@/lib/world-ending";
import { roundOptionsSchema, type RoundOptions } from "@/lib/world-options";

const generateOptionsInputSchema = z.object({
  cast: worldCastSchema,
  playerId: z.string().min(1),
  metrics: metricsSchema,
  round: z.number().int().min(1),
  history: z.array(turnRecordSchema),
  relations: z.array(agentRelationSchema),
  crisis: crisisSchema.nullable(),
  ultimatum: ultimatumSchema.nullable(),
});

export async function generateOptionsAction(input: unknown): Promise<ActionResult<RoundOptions>> {
  const parsed = generateOptionsInputSchema.safeParse(input);
  if (!parsed.success) return failParse("选项", parsed.error);

  const keyCheck = requireDeepSeekKey();
  if (typeof keyCheck !== "string") return keyCheck;

  const { cast, playerId, metrics, round, history, relations, crisis, ultimatum } = parsed.data;
  const player = cast.playerCharacters.find((character) => character.id === playerId);
  if (!player) return fail({ code: "NOT_FOUND", message: "玩家角色不存在", retryable: false });

  try {
    const object = await generateStructured({
      instructions: OPTIONS_INSTRUCTIONS,
      prompt: buildOptionsPrompt({
        cast,
        player,
        round,
        metrics,
        history,
        relations,
        crisis,
        ultimatum,
      }),
      schema: roundOptionsSchema,
      temperature: 0.85,
      maxOutputTokens: 2600,
    });
    const data = roundOptionsSchema.parse(object);
    const agentIds = cast.agentCharacters.map((character) => character.id);
    const options = data.options.slice(0, 4).map((option) => {
      const covered = new Set(option.forecast.map((entry) => entry.agentId));
      const missing = agentIds.filter((id) => !covered.has(id));
      if (!missing.length) return option;
      return Object.assign({}, option, {
        forecast: [
          ...option.forecast,
          ...missing.map((agentId) => ({ agentId, lean: "doubt" as const })),
        ],
      });
    });
    return { ok: true, data: { ...data, options } };
  } catch (error) {
    console.error("回合选项生成失败", error);
    return fail({ code: "UPSTREAM_FAILURE", message: "选项生成失败,请重试", retryable: true });
  }
}

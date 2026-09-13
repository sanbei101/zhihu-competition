"use server";

import { z } from "zod";

import { runCouncilAction, type ActionResult } from "@/app/world/action-result";
import { generateStructured } from "@/lib/deepseek";
import {
  buildFinaleChapterPrompt,
  buildFinalePlanPrompt,
  finaleChapterInstructions,
  finalePlanInstructions,
} from "@/lib/prompts";
import { worldCastSchema } from "@/lib/world-cast";
import {
  FINALE_CHAPTER_MAX,
  FINALE_CHAPTER_MIN,
  agentRelationSchema,
  crisisSchema,
  finaleChapterCountFor,
  finaleChapterSchema,
  finalePlanSchema,
  metricsSchema,
  ratingForMetrics,
  turnRecordSchema,
  type FinaleChapter,
  type FinalePlan,
} from "@/lib/world-ending";

const generateFinalePlanInputSchema = z.object({
  scenarioId: z.string().min(1).max(100),
  scenarioTitle: z.string().min(1).max(300),
  scenarioUrl: z.string().max(500),
  cast: worldCastSchema,
  playerId: z.string().min(1),
  turns: z.array(turnRecordSchema).min(1),
  metrics: metricsSchema,
  relations: z.array(agentRelationSchema),
  crisis: crisisSchema.nullable(),
  ending: z.object({ type: z.string(), title: z.string(), reason: z.string() }),
});

export async function generateFinalePlanAction(input: unknown): Promise<ActionResult<FinalePlan>> {
  return runCouncilAction({
    name: "终章卷目生成",
    schema: generateFinalePlanInputSchema,
    input,
    handler: async (data) => {
      const { scenarioTitle, cast, playerId, turns, metrics, ending, relations, crisis } = data;
      const player = cast.playerCharacters.find((character) => character.id === playerId);
      if (!player) throw new Error("玩家角色不存在");
      const chapterCount = finaleChapterCountFor(turns.length);

      const object = await generateStructured({
        instructions: finalePlanInstructions(chapterCount),
        prompt: buildFinalePlanPrompt({
          scenarioTitle,
          setting: cast.setting,
          player,
          ending,
          metrics,
          fallbackRating: ratingForMetrics(metrics),
          turns,
          relations,
          crisis,
          chapterCount,
        }),
        schema: finalePlanSchema,
        temperature: 0.75,
        maxOutputTokens: 3000,
      });

      const plan = finalePlanSchema.parse(object);
      const chapters = plan.chapters
        .slice(0, Math.max(chapterCount, FINALE_CHAPTER_MIN))
        .map((chapter, index) => ({
          index: index + 1,
          title: chapter.title,
          brief: chapter.brief,
        }));

      return { ...plan, chapters };
    },
  });
}

const generateFinaleChapterInputSchema = z.object({
  scenarioId: z.string().min(1).max(100),
  scenarioTitle: z.string().min(1).max(300),
  cast: worldCastSchema,
  playerId: z.string().min(1),
  turns: z.array(turnRecordSchema).min(1),
  metrics: metricsSchema,
  ending: z.object({ type: z.string(), title: z.string(), reason: z.string() }),
  chapterCount: z.number().int().min(1).max(FINALE_CHAPTER_MAX),
  chapter: z.object({
    index: z.number().int().min(1),
    title: z.string().min(1).max(40),
    brief: z.string().min(1).max(300),
  }),
  outline: z.array(z.object({ index: z.number().int().min(1), title: z.string() })).min(1),
  previousTitle: z.string().max(40),
  previousTail: z.string().max(4000),
});

export async function generateFinaleChapterAction(
  input: unknown,
): Promise<ActionResult<FinaleChapter>> {
  return runCouncilAction({
    name: "终章正文撰写",
    schema: generateFinaleChapterInputSchema,
    input,
    handler: async (data) => {
      const { scenarioTitle, cast, playerId, turns, metrics, ending, chapterCount, chapter } =
        data;
      const player = cast.playerCharacters.find((character) => character.id === playerId);
      if (!player) throw new Error("玩家角色不存在");

      const object = await generateStructured({
        instructions: finaleChapterInstructions(chapterCount),
        prompt: buildFinaleChapterPrompt({
          scenarioTitle,
          player,
          ending,
          metrics,
          turns,
          chapterCount,
          chapter,
          outline: data.outline,
          previousTail: data.previousTail,
          previousTitle: data.previousTitle,
        }),
        schema: finaleChapterSchema,
        temperature: 0.85,
        maxOutputTokens: 3000,
      });

      return finaleChapterSchema.parse(object);
    },
  });
}

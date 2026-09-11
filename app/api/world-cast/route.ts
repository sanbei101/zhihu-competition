import { z } from "zod";

import { errorResponse, publicError } from "@/lib/app-error";
import { hasLlmKey, generateStructured, missingLlmKeyMessage } from "@/lib/deepseek";
import {
  buildAgentStagePrompt,
  buildPlayerPrompt,
  buildStage1Prompt,
  CAST_INSTRUCTIONS,
} from "@/lib/prompts";
import {
  agentCharacterSchema,
  characterRosterSchema,
  playerCharacterSchema,
  worldCastRequestSchema,
  worldCastAgentResponseSchema,
  worldCastPlayerResponseSchema,
  worldCastSettingResponseSchema,
  worldSettingSchema,
} from "@/lib/world-cast";

const stage1Schema = z.object({
  setting: worldSettingSchema,
  playerRoster: z.array(characterRosterSchema).length(3),
  agentRoster: z.array(characterRosterSchema).length(4),
});

export async function POST(request: Request) {
  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return errorResponse(publicError("INVALID_REQUEST", "请求不是有效的 JSON", false), 400);
  }

  const parsedInput = worldCastRequestSchema.safeParse(input);
  if (!parsedInput.success) {
    return errorResponse(publicError("INVALID_REQUEST", "世界线信息不完整", false), 400);
  }
  if (!hasLlmKey()) {
    return errorResponse(publicError("CONFIG_MISSING", missingLlmKeyMessage(), false), 503);
  }

  try {
    const input = parsedInput.data;
    if (input.stage === "setting") {
      const result = await generateStructured({
        instructions: CAST_INSTRUCTIONS,
        prompt: buildStage1Prompt(input),
        schema: stage1Schema,
        temperature: 0.6,
        maxOutputTokens: 3000,
        abortSignal: request.signal,
      });
      return Response.json(worldCastSettingResponseSchema.parse(result));
    }

    if (input.stage === "player") {
      const character = await generateStructured({
        instructions: CAST_INSTRUCTIONS,
        prompt: buildPlayerPrompt(input),
        schema: playerCharacterSchema,
        temperature: 0.7,
        maxOutputTokens: 1800,
        abortSignal: request.signal,
      });
      return Response.json(worldCastPlayerResponseSchema.parse({ character }));
    }

    const character = await generateStructured({
      instructions: CAST_INSTRUCTIONS,
      prompt: buildAgentStagePrompt(input),
      schema: agentCharacterSchema,
      temperature: 0.7,
      maxOutputTokens: 1800,
      abortSignal: request.signal,
    });
    return Response.json(worldCastAgentResponseSchema.parse({ character }));
  } catch (error) {
    if (request.signal.aborted) {
      return errorResponse(publicError("UPSTREAM_FAILURE", "请求已超时,请重试", true), 504);
    }
    console.error("分阶段角色生成失败", error);
    return errorResponse(publicError("STREAM_FAILURE", "角色生成失败,请重试", true), 502);
  }
}

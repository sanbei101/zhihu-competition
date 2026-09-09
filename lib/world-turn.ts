import { z } from "zod";

import { worldCastSchema } from "@/lib/world-cast";

export const worldTurnRequestSchema = z.object({
  cast: worldCastSchema,
  playerId: z.string(),
  decision: z.string().trim().min(1).max(600),
});

export const agentReactionSchema = z.object({
  speech: z.string().describe("角色当场说出的话,不超过一百二十字"),
  action: z.string().describe("角色立刻采取的具体行动"),
  target: z.string().describe("行动针对的人物、阵营或资源"),
  stance: z.enum(["support", "oppose", "negotiate", "exploit"]),
  impact: z.string().describe("该行动可能造成的直接公开影响"),
});

export const worldTurnEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("agent-start"), agentId: z.string() }),
  z.object({
    type: z.literal("agent-reaction"),
    agentId: z.string(),
    reaction: agentReactionSchema,
  }),
  z.object({ type: z.literal("agent-error"), agentId: z.string(), error: z.string() }),
  z.object({ type: z.literal("complete") }),
]);

export type AgentReaction = z.infer<typeof agentReactionSchema>;
export type WorldTurnEvent = z.infer<typeof worldTurnEventSchema>;

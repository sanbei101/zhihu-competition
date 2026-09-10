import { z } from "zod";

import { worldCastSchema } from "@/lib/world-cast";

export const worldTurnRequestSchema = z.object({
  cast: worldCastSchema,
  playerId: z.string(),
  round: z.number().int().min(1).max(5),
  situation: z.string().trim().min(1).max(500),
  metrics: z.object({
    stability: z.number().min(0).max(100),
    morale: z.number().min(0).max(100),
    support: z.number().min(0).max(100),
    resources: z.number().min(0).max(100),
  }),
  historySummary: z.string().max(5000),
  decision: z.string().trim().min(1).max(600),
});

export const agentReactionSchema = z.object({
  speech: z.string().describe("角色当场说出的话,不超过一百二十字"),
  action: z.string().describe("角色立刻采取的具体行动"),
  target: z.string().describe("行动针对的人物、阵营或资源"),
  stance: z.enum(["support", "oppose", "negotiate", "exploit"]),
  impact: z.string().describe("该行动可能造成的直接公开影响"),
});

const eventMetaSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().min(1).max(50),
  summary: z.string().min(1).max(180),
  source: z.string().min(1).max(80),
  actors: z.array(z.string().min(1).max(40)).min(1).max(4),
  severity: z.enum(["low", "medium", "high"]),
});

export const worldEventSchema = z.discriminatedUnion("kind", [
  eventMetaSchema.extend({
    kind: z.literal("decree"),
    issuer: z.string().min(1).max(50),
    target: z.string().min(1).max(80),
    order: z.string().min(1).max(120),
    cost: z.string().min(1).max(100),
  }),
  eventMetaSchema.extend({
    kind: z.literal("dispatch"),
    location: z.string().min(1).max(80),
    forces: z.string().min(1).max(100),
    movement: z.string().min(1).max(100),
    casualties: z.string().min(1).max(100),
  }),
  eventMetaSchema.extend({
    kind: z.literal("diplomacy"),
    from: z.string().min(1).max(50),
    to: z.string().min(1).max(50),
    offer: z.string().min(1).max(100),
    response: z.string().min(1).max(100),
    relation: z.string().min(1).max(100),
  }),
  eventMetaSchema.extend({
    kind: z.literal("rumor"),
    rumorSource: z.string().min(1).max(80),
    claim: z.string().min(1).max(120),
    credibility: z.number().int().min(0).max(100),
    spread: z.string().min(1).max(100),
  }),
  eventMetaSchema.extend({
    kind: z.literal("shortage"),
    resource: z.string().min(1).max(50),
    stock: z.string().min(1).max(80),
    pressure: z.string().min(1).max(100),
  }),
]);

export type WorldEvent = z.infer<typeof worldEventSchema>;

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

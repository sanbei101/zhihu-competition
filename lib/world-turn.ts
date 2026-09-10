import { z } from "zod";

import { worldCastSchema } from "@/lib/world-cast";

/**
 * 本模块刻意不 import `world-ending`,避免循环依赖。
 * 关系 / 突发事件 / 通牒都以「已渲染好的文本摘要」形式传入,
 * 由 `world-ending` 侧的 `describeRelations` 等函数生成。
 */

const metricsPayloadSchema = z.object({
  stability: z.number().min(0).max(100),
  morale: z.number().min(0).max(100),
  support: z.number().min(0).max(100),
  resources: z.number().min(0).max(100),
});

/** 回合数不再设上限,由「大势熵增」保证收敛。 */
export const worldTurnRequestSchema = z.object({
  cast: worldCastSchema,
  playerId: z.string(),
  round: z.number().int().min(1),
  situation: z.string().trim().min(1).max(600),
  metrics: metricsPayloadSchema,
  historySummary: z.string().max(8000),
  /** 各 Agent 对玩家的信任度摘要 */
  relationsSummary: z.string().max(2000).optional().default(""),
  /** 当前未决的突发事件摘要 */
  crisisSummary: z.string().max(800).optional().default(""),
  /** 当前未决的通牒摘要 */
  ultimatumSummary: z.string().max(800).optional().default(""),
  /** 本回合大势熵增的说明 */
  entropyNote: z.string().max(400).optional().default(""),
  decision: z.string().trim().min(1).max(600),
});

export const ultimatumDraftSchema = z.object({
  demand: z.string().min(1).max(120).describe("你要求玩家在期限内做到的具体事情"),
  penalty: z.string().min(1).max(120).describe("玩家若不照做,你将立刻采取的行动"),
});
export type UltimatumDraft = z.infer<typeof ultimatumDraftSchema>;

export const agentReactionSchema = z.object({
  speech: z.string().describe("角色当场说出的话,不超过一百二十字"),
  action: z.string().describe("角色立刻采取的具体行动"),
  target: z.string().describe("行动针对的人物、阵营或资源"),
  stance: z.enum(["support", "oppose", "negotiate", "exploit"]),
  impact: z.string().describe("该行动可能造成的直接公开影响"),
  trustDelta: z
    .number()
    .int()
    .min(-15)
    .max(15)
    .describe("玩家的这个抉择让你对玩家的信任度变化,-15 到 15;顺你心意给正数,踩到你底线给负数"),
  ultimatum: ultimatumDraftSchema
    .nullish()
    .describe("仅当你已被逼到极限、且当前对你的信任度低于 35 时,才给出最后通牒;否则返回 null"),
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
  z.object({
    type: z.literal("retort-start"),
    agentId: z.string(),
    againstId: z.string(),
  }),
  z.object({
    type: z.literal("agent-retort"),
    agentId: z.string(),
    againstId: z.string(),
    reaction: agentReactionSchema,
  }),
  z.object({ type: z.literal("agent-error"), agentId: z.string(), error: z.string() }),
  z.object({ type: z.literal("complete") }),
]);

export type AgentReaction = z.infer<typeof agentReactionSchema>;
export type WorldTurnEvent = z.infer<typeof worldTurnEventSchema>;

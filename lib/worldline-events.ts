import { z } from "zod";

import { errorCodeSchema } from "@/lib/app-error";
import {
  type WorldlineBeing,
  type WorldlineEvent,
  type WorldlineReaction,
  type WorldlineSeed,
  type WorldlineSegment,
  type WorldlineSession,
  type WorldlineVoice,
} from "@/lib/worldline";

/**
 * 世界线观测台的线上协议层。
 *
 * 这一层只管"服务端往客户端吐什么、客户端往服务端发什么",不承载世界语义。
 * 世界语义全在 lib/worldline.ts,推演纪律全在 lib/prompts/。
 *
 * 两条流:
 *   /api/worldline-seed  一次观测的开场:前提 → 主体 → 开局编年
 *   /api/worldline-wave  往后发一波:五件事 → 世界对每一件的反应
 *
 * 全部事件都是 discriminated union,客户端用 readNdjsonStream 逐行校验,
 * 任何一条对不上就整条流报错 —— 静默吞掉畸形事件比报错更难排查。
 */

/**
 * 校验层只保证"这是个数字 / 这是个数组",范围与长度交给 lib/worldline-reducer.ts
 * 的确定性钳制。
 *
 * 这是被真实事故教出来的:数值上界写死会让一份本来很好的推演整份作废,
 * 而"多写了一条"这种事更不该毁掉一整波事件。校验只防完全失控,不做好学生检查。
 */
const LOOSE = {
  names: 4,
  voices: 3,
  reactions: 3,
  involves: 6,
  events: 8,
  segments: 8,
  domains: 6,
} as const;

const freeNumber = z.number();

const entityKindSchema = z.enum([
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

const witnessArchetypeSchema = z.enum([
  "human",
  "dinosaur",
  "alien",
  "machine",
  "astronaut",
  "microbe",
  "survivor",
]);

export const eventToneSchema = z.enum(["good", "bad", "odd"]);

// ==================== 世界模型片段 ====================

/** 落库形态的台词:站位四件套全部齐备,由 reducer 算好 */
export const voiceSchema = z.object({
  key: witnessArchetypeSchema,
  shift: freeNumber,
  at: freeNumber,
  scale: freeNumber,
  lift: freeNumber,
  name: z.string().min(1),
  line: z.string().min(1),
});

/**
 * 生成阶段的台词草稿。
 *
 * at / scale / lift 允许模型不填 —— 它们由 reducer 按这组台词的人数确定性分配。
 * 让模型管排版没有意义:它算不准相邻气泡会不会压住主体铭牌,而这件事原型期真的踩过。
 * 模型只负责两件事:这人是谁,他此刻说了什么。
 */
const voiceDraftSchema = z.object({
  key: witnessArchetypeSchema,
  shift: freeNumber.optional(),
  at: freeNumber.optional(),
  scale: freeNumber.optional(),
  lift: freeNumber.optional(),
  name: z.string().min(1),
  line: z.string().min(1),
});

export const worldlineBeingSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: entityKindSchema,
  status: z.string().min(1),
  touched: z.boolean(),
});

export const worldlinePremiseSchema = z.object({
  statement: z.string().min(1),
  divergencePoint: z.string().min(1),
  domains: z.array(z.string().min(1)).min(1).max(LOOSE.domains),
});

export const worldlineReactionSchema = z.object({
  by: z.string().min(1),
  delay: z.string().min(1),
  text: z.string().min(1),
  voices: z.array(voiceSchema),
});

export const worldlineEventSchema = z.object({
  id: z.string().min(1),
  tone: eventToneSchema,
  at: z.string().min(1),
  involves: z.array(z.string().min(1)),
  title: z.string().min(1),
  reactions: z.array(worldlineReactionSchema),
});

export const worldlineSegmentSchema = z.object({
  kind: z.enum(["event", "react"]),
  at: z.string().min(1),
  headline: z.string().min(1),
  aftermath: z.string(),
  involves: z.array(z.string().min(1)),
  voices: z.array(voiceSchema),
  mark: z.enum(["crisis", "echo"]).optional(),
});

export const worldlineSeedSchema = z.object({
  scenarioId: z.string().min(1),
  scenarioTitle: z.string().min(1),
  scenarioUrl: z.string(),
  themeId: z.string().min(1),
  premise: worldlinePremiseSchema,
  scaleLabel: z.string().min(1),
  witnessName: z.string().min(1),
  witnessRole: z.string().min(1),
  witnessArchetype: witnessArchetypeSchema,
  beings: z.array(worldlineBeingSchema).min(1).max(LOOSE.names),
  opening: z.array(worldlineSegmentSchema).max(LOOSE.segments),
});

export const worldlineSessionSchema = z.object({
  version: z.literal(1),
  scenarioId: z.string().min(1),
  scenarioTitle: z.string().min(1),
  scenarioUrl: z.string(),
  themeId: z.string().min(1),
  seed: worldlineSeedSchema,
  timeline: z.array(worldlineSegmentSchema),
  waves: z.array(z.array(worldlineEventSchema)),
  played: z.array(z.string()),
});

// ==================== 结构化生成的中间 schema ====================

/** 生成阶段的编年段:台词允许只给 name 与 line */
const segmentDraftSchema = worldlineSegmentSchema.extend({
  voices: z.array(voiceDraftSchema),
  mark: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.enum(["crisis", "echo"]).optional(),
  ),
});

/** 种子生成:前提 + 主体 + 开局编年。模型无权决定主题与题目 */
export const seedGenerationSchema = z.object({
  premise: worldlinePremiseSchema,
  scaleLabel: z.string().min(1),
  witnessName: z.string().min(1),
  witnessRole: z.string().min(1),
  beings: z.array(worldlineBeingSchema.omit({ touched: true })).min(1),
  opening: z.array(segmentDraftSchema).min(1),
});

/** 一波事件:五件大事,此刻先不带反应 */
export const waveGenerationSchema = z.object({
  events: z.array(worldlineEventSchema.omit({ id: true, reactions: true })).min(1),
});

/**
 * 世界对**一件事**的反应。
 *
 * 每件事一次独立调用、彼此不可见 —— 这是这一版"多智能体"的实际含义:
 * 没有谁是总导演,几个主体各自对同一件事做出反应,冲突由此自然产生。
 */
export const reactionGenerationSchema = z.object({
  reactions: z.array(
    z.object({
      byEntityId: z.string().min(1),
      delay: z.string().min(1),
      text: z.string().min(1),
      voices: z.array(voiceDraftSchema),
    }),
  ),
});

// ==================== 请求 schema ====================

export const worldlineSeedRequestSchema = z.object({
  scenarioId: z.string().min(1),
  title: z.string().min(1),
  themeId: z.string().min(1),
});

export const worldlineWaveRequestSchema = z.object({
  session: worldlineSessionSchema,
  /**
   * 原地重发某一波的下标。
   * 只在"上一波中途断了、要接着看"时给;不给我就接在末尾,发新的一波。
   */
  replaceIndex: z.number().int().min(0).optional(),
});

export const worldlineSettleRequestSchema = z.object({
  session: worldlineSessionSchema,
});

// ==================== 流事件 ====================

const streamErrorSchema = z.object({
  code: errorCodeSchema,
  message: z.string().min(1).max(200),
  retryable: z.boolean(),
  fields: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .max(20)
    .optional(),
});

/** /api/worldline-seed 的事件序列 */
export const worldlineSeedEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("seed-start"), themeId: z.string().min(1) }),
  z.object({
    type: z.literal("seed-premise"),
    premise: worldlinePremiseSchema,
    scaleLabel: z.string().min(1),
  }),
  z.object({
    type: z.literal("seed-witness"),
    witnessName: z.string().min(1),
    witnessRole: z.string().min(1),
  }),
  z.object({ type: z.literal("seed-being"), being: worldlineBeingSchema }),
  z.object({ type: z.literal("seed-segment"), segment: worldlineSegmentSchema }),
  z.object({ type: z.literal("seed-complete"), seed: worldlineSeedSchema }),
  z.object({ type: z.literal("error"), error: streamErrorSchema }),
]);

/** /api/worldline-wave 的事件序列 */
export const worldlineWaveEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("wave-start"), index: z.number().int().min(0) }),
  z.object({ type: z.literal("wave-event"), event: worldlineEventSchema }),
  z.object({
    type: z.literal("wave-reactions"),
    eventId: z.string().min(1),
    reactions: z.array(worldlineReactionSchema),
  }),
  z.object({ type: z.literal("wave-complete"), waveIndex: z.number().int().min(0) }),
  z.object({ type: z.literal("error"), error: streamErrorSchema }),
]);

export type WorldlineSeedEvent = z.infer<typeof worldlineSeedEventSchema>;
export type WorldlineWaveEvent = z.infer<typeof worldlineWaveEventSchema>;
export type SeedGeneration = z.infer<typeof seedGenerationSchema>;
export type WaveGeneration = z.infer<typeof waveGenerationSchema>;
export type ReactionGeneration = z.infer<typeof reactionGenerationSchema>;
export type VoiceDraft = z.infer<typeof voiceDraftSchema>;

// 类型层面的对照,防止 zod schema 与世界模型悄悄漂移
type _SeedMatches = WorldlineSeed extends z.infer<typeof worldlineSeedSchema> ? true : never;
type _SegmentMatches =
  WorldlineSegment extends z.infer<typeof worldlineSegmentSchema> ? true : never;
type _EventMatches = WorldlineEvent extends z.infer<typeof worldlineEventSchema> ? true : never;
type _ReactionMatches =
  WorldlineReaction extends z.infer<typeof worldlineReactionSchema> ? true : never;
type _VoiceMatches = WorldlineVoice extends z.infer<typeof voiceSchema> ? true : never;
type _BeingMatches = WorldlineBeing extends z.infer<typeof worldlineBeingSchema> ? true : never;
type _SessionMatches =
  z.infer<typeof worldlineSessionSchema> extends WorldlineSession ? true : never;

export type WorldlineProtocolCheck = [
  _SeedMatches,
  _SegmentMatches,
  _EventMatches,
  _ReactionMatches,
  _VoiceMatches,
  _BeingMatches,
  _SessionMatches,
];

/**
 * 上面那组断言是**惰性**的:只写 type 别名,tsc 不会去求值,漂移照样溜过去。
 * 所以在这里落一个真实的值,把七个断言逼成"必须同时成立"。
 * 任何一处 zod schema 与 lib/worldline.ts 对不上,这一行会直接编译不过。
 */
export const WORLDLINE_PROTOCOL_CHECK: WorldlineProtocolCheck = [
  true,
  true,
  true,
  true,
  true,
  true,
  true,
];

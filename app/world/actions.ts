"use server";

import { z } from "zod";

import { generateStructured } from "@/lib/deepseek";
import { worldCastRequestSchema, worldCastSchema } from "@/lib/world-cast";
import {
  MAX_ROUNDS,
  applyMetricDeltas,
  checkEnding,
  finaleSchema,
  judgeResultSchema,
  metricDeltasSchema,
  metricsSchema,
  ratingForMetrics,
  summarizeReactionsForPrompt,
  summarizeTurnsForPrompt,
  turnReactionRecordSchema,
  turnRecordSchema,
  type JudgeResult,
  type WorldFinale,
} from "@/lib/world-ending";
import { decisionModeSchema } from "@/lib/world-turn";

// ==================== 返回包络 ====================

type ActionOk<T> = { ok: true; data: T };
type ActionErr = { ok: false; error: string; detail?: string };
export type ActionResult<T> = ActionOk<T> | ActionErr;

function fail(error: string, detail?: string): ActionErr {
  return { ok: false, error, detail };
}

function requireDeepSeekKey(): string | ActionErr {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return fail("服务端缺少 DEEPSEEK_API_KEY");
  return key;
}

// ==================== 选角 ====================

export async function generateCastAction(
  input: unknown,
): Promise<ActionResult<z.infer<typeof worldCastSchema>>> {
  const parsed = worldCastRequestSchema.safeParse(input);
  if (!parsed.success) return fail("世界线信息不完整");

  const keyCheck = requireDeepSeekKey();
  if (typeof keyCheck !== "string") return keyCheck;

  try {
    const { scenarioId, title, content } = parsed.data;
    const object = await generateStructured({
      instructions: `你是一名严谨的架空历史推演导演和剧本杀作者。根据知乎假设题建立第一幕角色阵容。

角色必须扎根于题目给出的时代、制度和技术条件,不能使用穿越者或全知视角来偷懒。三个玩家候选角色要拥有不同的权力来源、道德困境和玩法;四个 AI 角色要代表不同利益集团,彼此目标不能完全一致。人物关系中必须包含合作、冲突或债务,使他们在第一回合就有采取行动的理由。

不要续写完整历史,不要提前给出结局,只建立危机爆发时的舞台和可博弈角色。使用简体中文,内容具体、克制。角色 id 使用唯一的简短英文小写标识。`,
      prompt: `为下面这条世界线生成开场角色阵容。\n\n知乎问题编号:${scenarioId}\n问题:${title}\n补充描述:${content || "无"}`,
      schema: worldCastSchema,
      temperature: 0.9,
      maxOutputTokens: 10000,
    });

    return { ok: true, data: worldCastSchema.parse(object) };
  } catch (error) {
    console.error("[岔路] 角色阵容生成失败", error);
    return fail(
      "角色生成失败",
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    );
  }
}

// ==================== 回合裁决 ====================

const judgeTurnInputSchema = z.object({
  cast: worldCastSchema,
  playerId: z.string().min(1),
  metrics: metricsSchema,
  round: z.number().int().min(1).max(MAX_ROUNDS),
  decisionMode: decisionModeSchema,
  decision: z.string().trim().min(1).max(600),
  reactions: z.array(turnReactionRecordSchema).max(8),
  history: z.array(turnRecordSchema).max(MAX_ROUNDS).optional().default([]),
});

const judgeDraftSchema = z.object({
  deltas: metricDeltasSchema.describe("四维指标的单回合增量,每项 -20 到 20 之间"),
  narration: z.string().min(1).max(300).describe("不超过三百字的世界旁白,承上启下"),
  endingTitle: z
    .string()
    .max(40)
    .nullish()
    .transform((value) => value ?? "")
    .describe("若本回合终结世界,给出结局标题(不超过四十字),否则返回空字符串"),
  endingReason: z
    .string()
    .max(200)
    .nullish()
    .transform((value) => value ?? "")
    .describe("若本回合终结世界,给出一句话结局理由,否则返回空字符串"),
});

export async function judgeTurnAction(input: unknown): Promise<ActionResult<JudgeResult>> {
  const parsed = judgeTurnInputSchema.safeParse(input);
  if (!parsed.success) return fail("裁决输入不完整");

  const keyCheck = requireDeepSeekKey();
  if (typeof keyCheck !== "string") return keyCheck;

  const { cast, playerId, metrics, round, decisionMode, decision, reactions, history } =
    parsed.data;
  const player = cast.playerCharacters.find((character) => character.id === playerId);
  if (!player) return fail("玩家角色不存在");

  try {
    const draft = await generateStructured({
      instructions: `你是冷酷公正的世界线裁决者。你只根据玩家决策与各方行动推演世界四维指标(政权稳定/军心士气/民众支持/战略资源)的单回合增量,并写一段承上启下的旁白。

规则:增量每项 -20 到 20;奖惩对称、克制,顺风不乱加,逆风不乱踩;旁白不超过三百字,简体中文,具体而不煽情。你只负责本回合的增量与旁白,最终是否结束由系统按规则计算。`,
      prompt: `当前是第 ${round} / ${MAX_ROUNDS} 回合。
时间:${cast.setting.time};地点:${cast.setting.location};危机:${cast.setting.crisis}
当前四维指标:政权稳定 ${metrics.stability},军心士气 ${metrics.morale},民众支持 ${metrics.support},战略资源 ${metrics.resources}

此前已结算回合:
${summarizeTurnsForPrompt(history)}

本回合玩家(${player.name},${player.identity})以'${decisionMode}'决策:${decision}

本回合各方行动:
${summarizeReactionsForPrompt(reactions)}

请给出四维增量与世界旁白。若你认为局势已崩盘或大局已定,在 endingTitle/endingReason 中给出结局标题与理由(一句话),否则返回空字符串。`,
      schema: judgeDraftSchema,
      temperature: 0.4,
      maxOutputTokens: 1200,
    });

    // 数值与结束判定由服务端确定性计算,不完全信任模型。
    const nextMetrics = applyMetricDeltas(metrics, draft.deltas);
    const systemEnding = checkEnding(nextMetrics, round);
    const isEnded = systemEnding !== null;
    const ending = systemEnding
      ? {
          type: systemEnding.type,
          title: draft.endingTitle.trim() || systemEnding.title,
          reason: draft.endingReason.trim() || systemEnding.reason,
        }
      : null;

    return {
      ok: true,
      data: judgeResultSchema.parse({
        round,
        metrics: nextMetrics,
        deltas: draft.deltas,
        narration: draft.narration,
        isEnded,
        ending,
      }),
    };
  } catch (error) {
    console.error("[岔路] 回合裁决失败", error);
    return fail(
      "冲突裁决失败",
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    );
  }
}

// ==================== 终章结算 ====================

const generateFinaleInputSchema = z.object({
  scenarioId: z.string().min(1).max(100),
  scenarioTitle: z.string().min(1).max(300),
  scenarioUrl: z.string().max(500).optional().default(""),
  cast: worldCastSchema,
  playerId: z.string().min(1),
  turns: z.array(turnRecordSchema).min(1).max(MAX_ROUNDS),
  metrics: metricsSchema,
  ending: z.object({
    type: z.string(),
    title: z.string(),
    reason: z.string(),
  }),
});

export async function generateFinaleAction(input: unknown): Promise<ActionResult<WorldFinale>> {
  const parsed = generateFinaleInputSchema.safeParse(input);
  if (!parsed.success) return fail("结算输入不完整");

  const keyCheck = requireDeepSeekKey();
  if (typeof keyCheck !== "string") return keyCheck;

  const { scenarioTitle, cast, playerId, turns, metrics, ending } = parsed.data;
  const player = cast.playerCharacters.find((character) => character.id === playerId);
  if (!player) return fail("玩家角色不存在");

  const fallbackRating = ratingForMetrics(metrics);

  try {
    const object = await generateStructured({
      instructions: `你是知乎硬核历史区/科幻区的高赞答主兼世界线史官。根据玩家的真实推演记录,整理一篇格式严密的'知乎体深度长文回答'。

要求:只写推演记录里真实发生过的事,不编造新史实;引用至少两处玩家原话;结构为:开篇钩子 / 分幕推演 / 关键抉择复盘 / 反事实对照 / 结论与开放讨论;简体中文,克制、有信息量;timeline 每回合一句话;shareText 是 200 字内的社区分享卡文案,含结局与评级。`,
      prompt: `知乎母本问题:${scenarioTitle}
玩家扮演:${player.name}(${player.identity}),阵营 ${player.faction},公开目标:${player.publicGoal}
最终结局:${ending.title} -- ${ending.reason}
终局四维:政权稳定 ${metrics.stability},军心士气 ${metrics.morale},民众支持 ${metrics.support},战略资源 ${metrics.resources}(参考评级 ${fallbackRating})

完整推演记录:
${summarizeTurnsForPrompt(turns, 4000)}

请输出 verdictTitle(一句话判词标题)、verdictLine(一句话点评)、rating(S/A/B/C)、timeline、articleMarkdown(2000 字左右的知乎体长文)、shareText。`,
      schema: finaleSchema,
      temperature: 0.7,
      maxOutputTokens: 8000,
    });

    return { ok: true, data: finaleSchema.parse(object) };
  } catch (error) {
    console.error("[岔路] 终章结算失败", error);
    return fail(
      "终章生成失败",
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    );
  }
}

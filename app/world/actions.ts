"use server";

import { z } from "zod";

import { generateStructured } from "@/lib/deepseek";
import { worldCastRequestSchema, worldCastSchema, type WorldCast } from "@/lib/world-cast";
import {
  addDeltas,
  advanceCrisis,
  agentRelationSchema,
  applyMetricDeltas,
  applyTrustDeltas,
  checkEnding,
  clampAppliedDeltas,
  crisisBodySchema,
  crisisSchema,
  describeCrisis,
  describeRelations,
  describeUltimatum,
  entropyDeltasForRound,
  entropyNoteForRound,
  finaleSchema,
  judgeResultSchema,
  metricDeltasSchema,
  metricReasonsSchema,
  metricsSchema,
  penaltyAsDeltas,
  ratingForMetrics,
  retortRecordSchema,
  settleUltimatum,
  summarizeReactionsForPrompt,
  summarizeRetortsForPrompt,
  summarizeTurnsForPrompt,
  turnReactionRecordSchema,
  turnRecordSchema,
  ultimatumOutcomeSchema,
  ultimatumSchema,
  type FinaleRating,
  type JudgeResult,
  type RetortRecord,
  type TurnReactionRecord,
  type TurnRecord,
  type UltimatumDraft,
  type WorldFinale,
  type WorldMetrics,
} from "@/lib/world-ending";
import { roundOptionsSchema, type RoundOptions } from "@/lib/world-options";
import { worldEventSchema } from "@/lib/world-turn";

// ==================== 提示词 ====================

const CAST_INSTRUCTIONS = `你是一名严谨的架空历史推演导演和剧本杀作者。根据知乎假设题建立第一幕角色阵容。

角色必须扎根于题目给出的时代、制度和技术条件,不能使用穿越者或全知视角来偷懒。三个玩家候选角色要拥有不同的权力来源、道德困境和玩法;四个 AI 角色要代表不同利益集团,彼此目标不能完全一致。人物关系中必须包含合作、冲突或债务,使他们在第一回合就有采取行动的理由。

必须完整填写 schema 中的每个字段:setting.rules 输出三到六条硬约束;全部七个角色都要填写 voice 和 redLine;三个玩家角色填写 decisionPower 和 privateGoal;四个 Agent 角色填写 pressureMethod 和 openingLine。不要遗漏字段,不要增加角色数量。

privateGoal 是玩家的私密目标:必须具体到可以被判定是否达成,并且与 publicGoal 有张力的可能(比如公开目标是守住城池,私密目标是保住某个人的命)。不要写成「活下去」这种没法判定的空话。

不要续写完整历史,不要提前给出结局,只建立危机爆发时的舞台和可博弈角色。使用简体中文,内容具体、克制。角色 id 使用唯一的简短英文小写标识。`;

const buildCastPrompt = (input: { scenarioId: string; title: string; content?: string }) =>
  `为下面这条世界线生成开场角色阵容。\n\n知乎问题编号:${input.scenarioId}\n问题:${input.title}\n补充描述:${input.content || "无"}`;

const OPTIONS_INSTRUCTIONS = `你是世界线导演。每回合给出一个突发处境和三到五个互斥抉择,供玩家点选。

硬性要求:
1. 每个选项都要填 impact(四维代价方向,只用 ↑↑ ↑ — ↓ ↓↓)和 forecast(在场每一方会站到哪一边)。玩家必须在点下去之前就看得出这笔交易划不划算,以及朝堂上会炸成什么样。
2. forecast 必须覆盖题目给出的全部在场角色,并且至少有一方是 doubt 或 oppose,不许所有人一致赞成。
3. 选项立场与代价差异要足够大,覆盖稳、险、赌三种风险;数量按处境需要给 3 到 5 个,凑数反而扣分。
4. 至少有一个选项直面本回合处境,至少有一个是拆东墙补西墙。
5. 必须承接此前回合留下的未解决问题。若存在正在倒计时的突发事件或未决的最后通牒,优先围绕它们出题。
6. 遵守世界硬约束,只写本回合能做的具体行动,不提前揭示结局。不要写抽象口号。使用简体中文。`;

type PlayerCharacter = WorldCast["playerCharacters"][number];

const buildOptionsPrompt = (input: {
  cast: WorldCast;
  player: PlayerCharacter;
  round: number;
  metrics: WorldMetrics;
  history: TurnRecord[];
  relations: z.infer<typeof agentRelationSchema>[];
  crisis: z.infer<typeof crisisSchema> | null;
  ultimatum: z.infer<typeof ultimatumSchema> | null;
}) => {
  const lastTurn = input.history.at(-1);
  return `当前是第 ${input.round} 回合(回合数没有上限,局势拖得越久越坏)。
时间:${input.cast.setting.time};地点:${input.cast.setting.location};危机:${input.cast.setting.crisis}
世界硬约束:
${input.cast.setting.rules.map((rule) => `- ${rule}`).join("\n")}
玩家:${input.player.name}(${input.player.identity}),可调动:${input.player.decisionPower}
当前四维:政权稳定 ${input.metrics.stability},军心士气 ${input.metrics.morale},民众支持 ${input.metrics.support},战略资源 ${input.metrics.resources}

在场角色(forecast 必须覆盖这些 id):
${input.cast.agentCharacters.map((character) => `- ${character.id} = ${character.name}(${character.identity}),公开诉求是${character.publicGoal}`).join("\n")}

各方对玩家的信任度:
${describeRelations(input.relations)}

压在头上的突发事件:
${describeCrisis(input.crisis)}

未决的最后通牒:
${describeUltimatum(input.ultimatum)}

大势损耗:${entropyNoteForRound(input.round)}

此前已结算回合:
${summarizeTurnsForPrompt(input.history)}

上一回合留下的直接后果(本回合至少要有选项正面处理它):
${lastTurn?.nextSituation ?? input.cast.setting.crisis}

请给出本回合处境与三到五个选项。`;
};

const JUDGE_INSTRUCTIONS = `你是冷酷公正的世界线裁决者。你只根据玩家决策与各方行动推演世界四维指标(政权稳定/军心士气/民众支持/战略资源)的单回合增量,写一段承上启下的旁白,记录真实发生的公开事件,并结算突发事件与最后通牒。

规则:
- 模型增量每项 -20 到 20,奖惩对称。但每回合至少要有一项指标的变化达到 8 以上——如果局势真的毫无波澜,那是你的推演失职,不是世界太平。
- 每个指标都必须给出具体原因;事件必须有来源、参与者和可观察后果;nextSituation 必须从本回合行动自然推导。
- crisisOutcome:若上方存在未决突发事件,判断玩家这次抉择是否实质解决了它,填 resolved 或 unresolved;若本来就没有未决事件,一律填 unresolved。
- newCrisis:仅当上方没有未决突发事件时才允许抛出;必须是会自己倒计时、有明确量化代价的新麻烦,deadline 由系统设定,你只填 title/summary/source/severity/penalty;否则返回 null。
- ultimatumOutcome:若上方存在未决通牒,判断玩家这次抉择是否满足了它的要求,填 honored 或 defied;若本来就没有未决通牒,一律填 none。
- 回合数没有上限,拖延本身就是代价。推演时要体现出各方耐心、资源与信任的持续消耗。
- 旁白不超过三百字,简体中文,具体而不煽情。你只负责本回合的增量、事件、结算与旁白,最终是否结束由系统按规则计算。`;

const buildJudgePrompt = (input: {
  cast: WorldCast;
  player: PlayerCharacter;
  round: number;
  metrics: WorldMetrics;
  situation: string;
  decision: string;
  reactions: TurnReactionRecord[];
  retorts: RetortRecord[];
  history: TurnRecord[];
  relations: z.infer<typeof agentRelationSchema>[];
  crisis: z.infer<typeof crisisSchema> | null;
  ultimatum: z.infer<typeof ultimatumSchema> | null;
}) =>
  `当前是第 ${input.round} 回合(回合数没有上限)。
时间:${input.cast.setting.time};地点:${input.cast.setting.location};危机:${input.cast.setting.crisis}
世界硬约束:
${input.cast.setting.rules.map((rule) => `- ${rule}`).join("\n")}
本回合突发处境:${input.situation}
当前四维指标:政权稳定 ${input.metrics.stability},军心士气 ${input.metrics.morale},民众支持 ${input.metrics.support},战略资源 ${input.metrics.resources}

大势损耗:${entropyNoteForRound(input.round)}

压在头上的突发事件:
${describeCrisis(input.crisis)}

未决的最后通牒:
${describeUltimatum(input.ultimatum)}

各方对玩家的信任度:
${describeRelations(input.relations)}

此前已结算回合:
${summarizeTurnsForPrompt(input.history)}

本回合玩家(${input.player.name},${input.player.identity})作出抉择:「${input.decision}」

本回合各方第一轮表态:
${summarizeReactionsForPrompt(input.reactions)}

本回合面对面的交锋:
${summarizeRetortsForPrompt(input.retorts)}

请给出事件、四维增量、逐项变化原因、世界旁白、下一回合危机,并结算突发事件与最后通牒。若你认为局势已崩盘或大局已定,在 endingTitle/endingReason 中给出结局标题与理由(一句话),否则返回空字符串。`;

const FINALE_INSTRUCTIONS = `你是知乎硬核历史区/科幻区的高赞答主兼世界线史官。根据玩家的真实推演记录,整理一篇格式严密的'知乎体深度长文回答'。

要求:只写推演记录里真实发生过的事,不编造新史实;引用至少两处玩家原话;结构为:开篇钩子 / 分幕推演 / 关键抉择复盘 / 未选择方案的合理推测(明确标注为推测) / 结论与开放讨论;简体中文,克制、有信息量;timeline 必须引用每回合真实发生的事件;shareText 是 200 字内的社区分享卡文案,含结局与评级。

另外必须单独判定玩家的私密目标(privateGoalVerdict 填「达成 / 部分达成 / 未达成」,privateGoalNote 用一到两句说明依据)。判定要严格:只根据推演记录里真实发生的事,不要因为玩家愿望强烈就放水。`;

const buildFinalePrompt = (input: {
  scenarioTitle: string;
  player: PlayerCharacter;
  ending: { type: string; title: string; reason: string };
  metrics: WorldMetrics;
  fallbackRating: FinaleRating;
  turns: TurnRecord[];
  relations: z.infer<typeof agentRelationSchema>[];
  crisis: z.infer<typeof crisisSchema> | null;
}) =>
  `知乎脑洞副本:${input.scenarioTitle}
玩家扮演:${input.player.name}(${input.player.identity}),阵营 ${input.player.faction},公开目标:${input.player.publicGoal}
玩家的私密目标:${input.player.privateGoal}
最终结局:${input.ending.title} -- ${input.ending.reason}
终局四维:政权稳定 ${input.metrics.stability},军心士气 ${input.metrics.morale},民众支持 ${input.metrics.support},战略资源 ${input.metrics.resources}(参考评级 ${input.fallbackRating})
共推演 ${input.turns.length} 回合

终局各方对玩家的信任度:
${describeRelations(input.relations)}

未解决的突发事件:
${describeCrisis(input.crisis)}

完整推演记录:
${summarizeTurnsForPrompt(input.turns, 5000)}

请输出 verdictTitle、verdictLine、rating(S/A/B/C)、privateGoalVerdict、privateGoalNote、timeline、articleMarkdown(2000 字左右的知乎体长文)、shareText。`;

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
      instructions: CAST_INSTRUCTIONS,
      prompt: buildCastPrompt({ scenarioId, title, content }),
      schema: worldCastSchema,
      temperature: 0.6,
      maxOutputTokens: 14000,
    });

    return { ok: true, data: worldCastSchema.parse(object) };
  } catch (error) {
    console.error("角色阵容生成失败", error);
    return fail(
      "角色生成失败",
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    );
  }
}

// ==================== 回合选项 ====================

const generateOptionsInputSchema = z.object({
  cast: worldCastSchema,
  playerId: z.string().min(1),
  metrics: metricsSchema,
  round: z.number().int().min(1),
  history: z.array(turnRecordSchema).optional().default([]),
  relations: z.array(agentRelationSchema).optional().default([]),
  crisis: crisisSchema.nullable().optional().default(null),
  ultimatum: ultimatumSchema.nullable().optional().default(null),
});

export async function generateOptionsAction(input: unknown): Promise<ActionResult<RoundOptions>> {
  const parsed = generateOptionsInputSchema.safeParse(input);
  if (!parsed.success) return fail("选项输入不完整");

  const keyCheck = requireDeepSeekKey();
  if (typeof keyCheck !== "string") return keyCheck;

  const { cast, playerId, metrics, round, history, relations, crisis, ultimatum } = parsed.data;
  const player = cast.playerCharacters.find((character) => character.id === playerId);
  if (!player) return fail("玩家角色不存在");

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

    return { ok: true, data: roundOptionsSchema.parse(object) };
  } catch (error) {
    console.error("回合选项生成失败", error);
    return fail(
      "选项生成失败",
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    );
  }
}

// ==================== 回合裁决 ====================

const judgeTurnInputSchema = z.object({
  cast: worldCastSchema,
  playerId: z.string().min(1),
  metrics: metricsSchema,
  round: z.number().int().min(1),
  situation: z.string().trim().min(1).max(600),
  decision: z.string().trim().min(1).max(600),
  reactions: z.array(turnReactionRecordSchema).max(8),
  retorts: z.array(retortRecordSchema).max(4).optional().default([]),
  history: z.array(turnRecordSchema).optional().default([]),
  relations: z.array(agentRelationSchema).optional().default([]),
  crisis: crisisSchema.nullable().optional().default(null),
  ultimatum: ultimatumSchema.nullable().optional().default(null),
});

const judgeDraftSchema = z.object({
  deltas: metricDeltasSchema.describe("四维指标的单回合增量,每项 -20 到 20 之间"),
  metricReasons: metricReasonsSchema.describe(
    "逐项说明本回合指标为什么变化,必须引用具体行动或事件",
  ),
  events: z
    .array(worldEventSchema)
    .min(1)
    .max(3)
    .describe("一到三个本回合真正发生的公开世界事件,不能只是情绪描述"),
  narration: z.string().min(1).max(320).describe("不超过三百字的世界旁白,承上启下"),
  nextSituation: z.string().min(1).max(300).describe("下一回合最先逼近玩家的具体危机或待处理后果"),
  crisisOutcome: z
    .enum(["resolved", "unresolved"])
    .describe("玩家本次抉择是否实质解决了未决的突发事件;没有未决事件时填 unresolved"),
  newCrisis: crisisBodySchema
    .nullish()
    .describe("仅当当前没有未决突发事件时才可抛出新的倒计时麻烦,否则返回 null"),
  ultimatumOutcome: ultimatumOutcomeSchema.describe(
    "未决通牒是否被本次抉择满足:honored / defied;没有未决通牒时填 none",
  ),
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

  const {
    cast,
    playerId,
    metrics,
    round,
    situation,
    decision,
    reactions,
    retorts,
    history,
    relations,
    crisis,
    ultimatum,
  } = parsed.data;
  const player = cast.playerCharacters.find((character) => character.id === playerId);
  if (!player) return fail("玩家角色不存在");

  try {
    const draft = await generateStructured({
      instructions: JUDGE_INSTRUCTIONS,
      prompt: buildJudgePrompt({
        cast,
        player,
        round,
        metrics,
        situation,
        decision,
        reactions,
        retorts,
        history,
        relations,
        crisis,
        ultimatum,
      }),
      schema: judgeDraftSchema,
      temperature: 0.45,
      maxOutputTokens: 3200,
    });

    const allEntries = [...reactions, ...retorts];

    // 1. 信任度:直接采信各 Agent 自报的 trustDelta
    const withTrust = applyTrustDeltas(
      relations,
      allEntries.map((entry) => ({
        agentId: entry.agentId,
        trustDelta: entry.reaction.trustDelta,
      })),
    );

    // 2. 通牒:优先采信本回合新提出的那条
    const incomingUltimatum =
      allEntries
        .map((entry): { agentId: string; draft: UltimatumDraft } | null =>
          entry.reaction.ultimatum
            ? { agentId: entry.agentId, draft: entry.reaction.ultimatum }
            : null,
        )
        .find((entry): entry is { agentId: string; draft: UltimatumDraft } => entry !== null) ??
      null;
    const ultimatumStep = settleUltimatum({
      pending: ultimatum,
      outcome: draft.ultimatumOutcome,
      round,
      relations: withTrust,
      incoming: incomingUltimatum,
    });

    // 3. 突发事件:倒计时推进 + 逾期扣血
    const crisisStep = advanceCrisis({
      pending: crisis,
      resolved: draft.crisisOutcome === "resolved",
      incoming: draft.newCrisis ?? null,
      round,
    });

    // 4. 数值:模型增量 + 大势熵增 + 逾期惩罚,由服务端确定性叠加
    const entropy = entropyDeltasForRound(metrics, round);
    const crisisPenalty = crisisStep.penalty;
    const deltas = clampAppliedDeltas(
      addDeltas(draft.deltas, entropy, penaltyAsDeltas(crisisPenalty)),
    );
    const nextMetrics = applyMetricDeltas(metrics, deltas);

    // 5. 结束判定只看四维,没有回合上限
    const systemEnding = checkEnding(nextMetrics);
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
        deltas,
        entropy,
        crisisPenalty: penaltyAsDeltas(crisisPenalty),
        metricReasons: draft.metricReasons,
        events: draft.events,
        narration: draft.narration,
        nextSituation: draft.nextSituation,
        relations: ultimatumStep.relations,
        crisis: crisisStep.crisis,
        crisisResolved: crisisStep.expired === false && draft.crisisOutcome === "resolved",
        ultimatum: ultimatumStep.ultimatum,
        ultimatumOutcome: ultimatumStep.defectedAgentId ? "defied" : draft.ultimatumOutcome,
        isEnded,
        ending,
      }),
    };
  } catch (error) {
    console.error("回合裁决失败", error);
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
  turns: z.array(turnRecordSchema).min(1),
  metrics: metricsSchema,
  relations: z.array(agentRelationSchema).optional().default([]),
  crisis: crisisSchema.nullable().optional().default(null),
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

  const { scenarioTitle, cast, playerId, turns, metrics, ending, relations, crisis } = parsed.data;
  const player = cast.playerCharacters.find((character) => character.id === playerId);
  if (!player) return fail("玩家角色不存在");

  const fallbackRating = ratingForMetrics(metrics);

  try {
    const object = await generateStructured({
      instructions: FINALE_INSTRUCTIONS,
      prompt: buildFinalePrompt({
        scenarioTitle,
        player,
        ending,
        metrics,
        fallbackRating,
        turns,
        relations,
        crisis,
      }),
      schema: finaleSchema,
      temperature: 0.7,
      maxOutputTokens: 9000,
    });

    return { ok: true, data: finaleSchema.parse(object) };
  } catch (error) {
    console.error("终章结算失败", error);
    return fail(
      "终章生成失败",
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    );
  }
}

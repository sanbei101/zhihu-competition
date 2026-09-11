"use server";

import { z } from "zod";

import { fail, failParse, requireDeepSeekKey, type ActionResult } from "@/app/world/action-result";
import { generateStructured } from "@/lib/deepseek";
import { type WorldCast, worldCastSchema } from "@/lib/world-cast";
import {
  agentRelationSchema,
  crisisSchema,
  describeCrisis,
  describeRelations,
  describeUltimatum,
  entropyNoteForRound,
  metricsSchema,
  summarizeTurnsForPrompt,
  turnRecordSchema,
  ultimatumSchema,
  type AgentRelation,
  type TurnRecord,
  type WorldCrisis,
  type WorldMetrics,
  type WorldUltimatum,
} from "@/lib/world-ending";
import { roundOptionsSchema, type RoundOptions } from "@/lib/world-options";

const OPTIONS_INSTRUCTIONS = `你是世界线导演。每回合给出一个有压力但可扭转的突发处境和恰好四个互斥抉择,供玩家点选。

硬性要求:
1. 每个选项都要填 impact(四维影响方向,只用 ↑↑ ↑ - ↓ ↓↓)和 forecast(在场每一方会站到哪一边)。玩家必须在点下去之前就看得出这笔交易的收益与代价,以及朝堂上会炸成什么样。
2. forecast 必须覆盖题目给出的全部在场角色,并且至少有一方是 doubt 或 oppose,不许所有人一致赞成。
3. 四个选项的立场与代价差异要足够大,覆盖稳、险、赌三种风险,按 A/B/C/D 顺序排列。
4. 至少有一个选项直面本回合处境,至少有一个是拆东墙补西墙。
5. 若存在正在倒计时的突发事件,必须至少提供一个 crisisAction=true 的选项,它要明确写出解决该事件的具体动作,不能只写缓兵或观察;其余选项可选择承担危机代价。若没有突发事件,所有选项的 crisisAction 都必须为 false。
6. 每个选项都必须有至少一个明确收益,不能四维全部标为下降;至少一个稳妥或积极选项应让两项相关指标上升。风险体现在阵营反应、资源交换或另一项指标代价,不要把所有选项都写成单纯扣血。
7. 必须承接此前回合留下的未解决问题。若存在正在倒计时的突发事件或未决的最后通牒,优先围绕它们出题。
8. 遵守世界硬约束,只写本回合能做的具体行动,不提前揭示结局。不要写抽象口号。使用简体中文。`;

type PlayerCharacter = WorldCast["playerCharacters"][number];

const buildOptionsPrompt = (input: {
  cast: WorldCast;
  player: PlayerCharacter;
  round: number;
  metrics: WorldMetrics;
  history: TurnRecord[];
  relations: AgentRelation[];
  crisis: WorldCrisis | null;
  ultimatum: WorldUltimatum | null;
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
    return { ok: true, data: { ...data, options: data.options.slice(0, 4) } };
  } catch (error) {
    console.error("回合选项生成失败", error);
    return fail({ code: "UPSTREAM_FAILURE", message: "选项生成失败,请重试", retryable: true });
  }
}

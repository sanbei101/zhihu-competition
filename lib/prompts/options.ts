import { type WorldCast } from "@/lib/world-cast";
import {
  describeCrisis,
  describeRelations,
  describeUltimatum,
  entropyNoteForRound,
  summarizeTurnsForPrompt,
  type AgentRelation,
  type TurnRecord,
  type WorldCrisis,
  type WorldMetrics,
  type WorldUltimatum,
} from "@/lib/world-ending";

type PlayerCharacter = WorldCast["playerCharacters"][number];

export const OPTIONS_INSTRUCTIONS = `你是世界线导演。每回合给出一个有压力但可扭转的突发处境和恰好四个互斥抉择,供玩家从世界线分叉点选入其中一条未来。

硬性要求:
1. 每个选项都要填 impact(四维影响方向,只用 ↑↑ ↑ - ↓ ↓↓)和 forecast(在场每一方会站到哪一边)。玩家必须在点下去之前就看得出这笔交易的收益与代价,以及朝堂上会炸成什么样。
2. forecast 必须覆盖题目给出的全部在场角色,并且至少有一方是 doubt 或 oppose,不许所有人一致赞成。
3. 四个选项就是四条候选世界线。每个标题要概括它会把局势推向的方向;四个选项的立场与代价差异要足够大,覆盖稳、险、赌三种风险,按 A/B/C/D 顺序排列。
4. 至少有一个选项直面本回合处境,至少有一个是拆东墙补西墙。
5. 若存在正在倒计时的突发事件,必须至少提供一个 crisisAction=true 的选项,它要明确写出解决该事件的具体动作,不能只写缓兵或观察;其余选项可选择承担危机代价。若没有突发事件,所有选项的 crisisAction 都必须为 false。
6. 每个选项都必须有至少一个明确收益,不能四维全部标为下降;至少一个稳妥或积极选项应让两项相关指标上升。风险体现在阵营反应、资源交换或另一项指标代价,不要把所有选项都写成单纯扣血。
7. 必须承接此前回合留下的未解决问题。若存在正在倒计时的突发事件或未决的最后通牒,优先围绕它们出题。
8. 遵守世界硬约束,只写本回合能做的具体行动,不提前揭示结局。不要写抽象口号。使用简体中文。`;

/**
 * 结构优化: 静态世界背景与角色置顶 -> 历史推演记录居中 -> 动态回合变量与上轮后果置底
 */
export const buildOptionsPrompt = (input: {
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
  return `时间:${input.cast.setting.time};地点:${input.cast.setting.location};核心危机:${input.cast.setting.crisis}
世界硬约束:
${input.cast.setting.rules.map((rule) => `- ${rule}`).join("\n")}

玩家设定:
- ${input.player.name}(${input.player.identity}),可调动资源与权力:${input.player.decisionPower}

在场各方角色(forecast 必须覆盖这些 id):
${input.cast.agentCharacters.map((character) => `- ${character.id} = ${character.name}(${character.identity}),公开诉求是【${character.publicGoal}】`).join("\n")}

此前已结算历史回合:
${summarizeTurnsForPrompt(input.history)}

当前局势与本轮分叉点:
- 回合进度:第 ${input.round} 回合(大势损耗:${entropyNoteForRound(input.round)})
- 当前四维指标:政权稳定 ${input.metrics.stability},军心士气 ${input.metrics.morale},民众支持 ${input.metrics.support},战略资源 ${input.metrics.resources}
- 各方信任度现状:${describeRelations(input.relations)}
- 突发事件倒计时:${describeCrisis(input.crisis)}
- 未决最后通牒:${describeUltimatum(input.ultimatum)}
- 上一回合直接遗留后果(本回合至少有选项正面处理之):
${lastTurn?.nextSituation ?? input.cast.setting.crisis}

请给出本回合突发处境与恰好四个互斥抉择。`;
};

import { type WorldCast } from "@/lib/world-cast";
import {
  describeCrisis,
  describeRelations,
  describeUltimatum,
  entropyNoteForRound,
  summarizeReactionsForPrompt,
  summarizeRetortsForPrompt,
  summarizeTurnsForPrompt,
  type AgentRelation,
  type RetortRecord,
  type TurnReactionRecord,
  type TurnRecord,
  type WorldCrisis,
  type WorldMetrics,
  type WorldUltimatum,
} from "@/lib/world-ending";

type PlayerCharacter = WorldCast["playerCharacters"][number];

export const JUDGE_INSTRUCTIONS = `你是公正但鼓励玩家试错的世界线裁决者。你只根据玩家决策与各方行动推演世界四维指标(政权稳定/军心士气/民众支持/战略资源)的单回合增量,写一段承上启下的旁白,记录真实发生的公开事件,并结算突发事件与最后通牒。

规则:
- 模型增量每项 -20 到 20,奖惩对称;这是玩家行动带来的变化,不要把大势熵增或危机逾期惩罚重复算进来。
- 具体、可执行且没有违反世界硬约束的决策,通常必须得到回报:至少一项相关指标增加 8 以上,模型增量的四项合计不低于 4,并且不要让四项指标全部下降。即使存在代价,也要让玩家看见行动带来的真实改善。
- 只有明显违背硬约束、严重误判局势或主动冒险失败时,才允许模型增量整体为负;不要为了制造戏剧性把每个回合都判成恶化。
- 若玩家选择了标记为'[处理当前危机]'的具体方案,危机相关指标应出现明显改善,并按规则判定危机已解决;解决危机可以伴随其他维度代价,但不能无理由全盘扣分。
- 每回合至少要有一项指标的变化达到 8 以上--如果局势真的毫无波澜,那是你的推演失职,不是世界太平。
- 每个指标都必须给出具体原因;事件必须有来源、参与者和可观察后果;nextSituation 必须从本回合行动自然推导。
- crisisOutcome:若上方存在未决突发事件,判断玩家这次抉择是否实质解决了它,填 resolved 或 unresolved;选项带有'[处理当前危机]'标记时,只要行动没有违反世界硬约束,必须填 resolved,即使付出了其他代价;若本来就没有未决事件,一律填 unresolved。
- newCrisis:仅当上方没有未决突发事件,且本回合确实造成或暴露了新的重大麻烦时才抛出;它不是每回合必填。若局势刚刚解决危机、没有自然产生的新威胁,返回 null。生成时必须是会自己倒计时、有明确量化代价的新麻烦,deadline 由系统设定,你只填 title/summary/source/severity/penalty。
- ultimatumOutcome:若上方存在未决通牒,判断玩家这次抉择是否满足了它的要求,填 honored 或 defied;若本来没有未决通牒,一律填 none。
- 回合数没有上限,拖延本身就是代价。推演时要体现出各方耐心、资源与信任的持续消耗。
- 旁白不超过三百字,简体中文,具体而不煽情。你只负责本回合的增量、事件、结算与旁白,结局与是否收束由系统按四维指标规则计算,不要自行宣告终局。`;

export const buildJudgePrompt = (input: {
  cast: WorldCast;
  player: PlayerCharacter;
  round: number;
  metrics: WorldMetrics;
  situation: string;
  decision: string;
  reactions: TurnReactionRecord[];
  retorts: RetortRecord[];
  history: TurnRecord[];
  relations: AgentRelation[];
  crisis: WorldCrisis | null;
  ultimatum: WorldUltimatum | null;
}) => `时间:${input.cast.setting.time};地点:${input.cast.setting.location};危机:${input.cast.setting.crisis}
世界硬约束:
${input.cast.setting.rules.map((rule) => `- ${rule}`).join("\n")}

本回合突发处境:${input.situation}
当前是第 ${input.round} 回合(回合数没有上限)。
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

本回合玩家(${input.player.name},${input.player.identity})作出抉择:'${input.decision}'

本回合各方第一轮表态:
${summarizeReactionsForPrompt(input.reactions)}

本回合面对面的交锋:
${summarizeRetortsForPrompt(input.retorts)}

请给出事件、四维增量、逐项变化原因、世界旁白、下一回合危机,并结算突发事件与最后通牒。是否结束由系统判定,你不必输出结局。`;

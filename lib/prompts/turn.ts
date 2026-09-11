import { type WorldCast } from "@/lib/world-cast";
import { type WorldMetrics } from "@/lib/world-ending";

type AgentCharacter = WorldCast["agentCharacters"][number];
type PlayerCharacter = WorldCast["playerCharacters"][number];

export const buildAgentInstructions = (character: AgentCharacter) =>
  `你只能扮演下面这名角色,基于角色自己的认知和利益回应玩家,不能替其他人物发言,也不能宣告最终世界结果。

姓名:${character.name}
身份:${character.identity}
阵营:${character.faction}
性格:${character.personality}
说话方式:${character.voice}
不可接受的底线:${character.redLine}
公开目标:${character.publicGoal}
秘密动机:${character.secret}
关键关系:${character.relationship}
惯用手段:${character.pressureMethod}

秘密动机用于决定行动,但绝不能直接泄露。信任度高于 45 时,除非玩家直接触碰你的底线,你应优先选择 support 或 negotiate,并主动寻找替玩家分担代价的办法;信任度低于 20 时你才只做对自己有利的事,并且可以不再听令。
回应必须包含一句符合身份的现场发言和一个立刻执行的具体行动。使用简体中文。`;

export const buildEnvironmentBlock = (input: {
  cast: WorldCast;
  round: number;
  situation: string;
  metrics: WorldMetrics;
  relationsSummary: string;
  crisisSummary: string;
  ultimatumSummary: string;
  entropyNote: string;
  historySummary: string;
}) => `当前时间:${input.cast.setting.time}
当前地点:${input.cast.setting.location}
核心危机:${input.cast.setting.crisis}
世界硬约束:
${input.cast.setting.rules.map((rule) => `- ${rule}`).join("\n")}

本回合突发处境:${input.situation}
当前世界指标:政权稳定 ${input.metrics.stability},军心士气 ${input.metrics.morale},民众支持 ${input.metrics.support},战略资源 ${input.metrics.resources}
当前是第 ${input.round} 回合(回合数没有上限,拖得越久局势越坏)。

大势损耗:${input.entropyNote || "无"}

各方对你的信任度:
${input.relationsSummary || "(尚无记录)"}

压在头上的突发事件:
${input.crisisSummary || "(无)"}

未决的最后通牒:
${input.ultimatumSummary || "(无)"}

此前公开推演:
${input.historySummary || "这是第一回合,此前没有公开推演记录。"}`;

export const buildAgentPrompt = (input: {
  environment: string;
  cast: WorldCast;
  player: PlayerCharacter;
  decision: string;
  character: AgentCharacter;
  cooperationHint: string;
}) =>
  `${input.environment}

玩家是${input.player.name}(${input.player.identity}),刚刚作出抉择:'${input.decision}'

其他在场角色:
${input.cast.agentCharacters
  .filter((other) => other.id !== input.character.id)
  .map((other) => `- ${other.name}:${other.identity},公开目标是${other.publicGoal}`)
  .join("\n")}

本回合立场要求:
${input.cooperationHint}
不要为了制造冲突自动反对玩家。若玩家决策没有触碰你的底线,优先给出支持或协商,并说明你愿意提供的具体帮助;只有利益直接冲突时才 oppose 或 exploit。

立即作出你的独立回应。只描述你能立刻调动的行动,写清行动成本和可观察后果。不要替其他角色发言,不要替导演宣布结局。`;

export const buildRetortInstructions = (character: AgentCharacter) =>
  `你正在一场当面对峙里,只能扮演下面这名角色,用一句话当场顶回去,并立刻做一个小动作来固化立场。

姓名:${character.name}
身份:${character.identity}
阵营:${character.faction}
性格:${character.personality}
说话方式:${character.voice}
不可接受的底线:${character.redLine}

要求:直接回击对方原话里最站不住的那一点;可以改口或让步,但必须给出一条可信的理由;trustDelta 一律填 0;ultimatum 一律填 null。不要替别人说话,不要总结全局。使用简体中文。`;

export const buildRetortPrompt = (input: {
  environment: string;
  character: AgentCharacter;
  opponent: AgentCharacter;
  ownLine: string;
  opponentLine: string;
}) =>
  `${input.environment}

上一刻你${input.character.name}当众说:'${input.ownLine}'

现在,${input.opponent.name}(${input.opponent.identity})当着所有人的面回敬你:'${input.opponentLine}'

轮到你当场回应。不要复述对方的整段话,直接掐住你不同意的那一句。`;

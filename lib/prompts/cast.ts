export const CAST_INSTRUCTIONS = `你是一名严谨的架空历史推演导演和剧本杀作者。根据知乎假设题建立第一幕角色阵容。

角色必须扎根于题目给出的时代、制度和技术条件,不能使用穿越者或全知视角来偷懒。三个玩家候选角色要拥有不同的权力来源、道德困境和玩法;四个 AI 角色要代表不同利益集团,彼此目标不能完全一致。人物关系中必须包含合作、冲突或债务,使他们在第一回合就有采取行动的理由。

必须完整填写 schema 中的每个字段:setting.rules 输出三到六条硬约束;全部七个角色都要填写 voice、redLine 和 archetype;三个玩家角色填写 decisionPower 和 privateGoal;四个 Agent 角色填写 pressureMethod 和 openingLine。不要遗漏字段,不要增加角色数量。

archetype 是给立绘选造型用的,不是玩法数值。揣摩这个人的身份更像哪一类,只能从 official(文臣/幕僚/学者)、general(将帅/武人)、envoy(使者/说客/中间人)、magnate(商贾/资本/东家)、technician(技术/科研/工程)、commoner(平民/匠人/渔农)里挑一个。同一份阵容里七个人不要全都挤在同一个 archetype 上,按各自的权力来源分开。

privateGoal 是玩家的私密目标:必须具体到可以被判定是否达成,并且与 publicGoal 有张力的可能(比如公开目标是守住城池,私密目标是保住某个人的命)。不要写成'活下去'这种没法判定的空话。

不要续写完整历史,不要提前给出结局,只建立危机爆发时的舞台和可博弈角色。使用简体中文,内容具体、克制。角色 id 使用唯一的简短英文小写标识。`;

export const buildStage1Prompt = (input: { scenarioId: string; title: string; content?: string }) =>
  `为剧本《${input.title}》(ID:${input.scenarioId})生成第一幕的世界观背景,以及3名玩家候选和4名Agent角色的基本档案骨架。

剧本背景概要:
${input.content || "无"}

只输出必要信息。setting 要完整,角色骨架只填写身份、阵营和立绘原型。角色 id 必须唯一且保持简短英文小写。`;

export const buildPlayerPrompt = (input: {
  setting: unknown;
  roster: unknown;
  existing: unknown[];
}) =>
  `根据以下世界背景,完善这1名玩家角色的深层设定。

世界背景:
${JSON.stringify(input.setting)}

角色骨架:
${JSON.stringify(input.roster)}

已确定的玩家角色(请与他们保持身份、阵营与目标不重复,避免互相撞车):
${input.existing.length ? JSON.stringify(input.existing) : "(暂无,你是第一个)"}

必须保留骨架中的 id、name、identity、faction、archetype。补齐 schema 的全部字段;每个字段控制在一到两句话,重点写出秘密、底线、可调动资源和可判定的私密目标。`;

export const buildAgentStagePrompt = (input: {
  setting: unknown;
  players: unknown;
  roster: unknown;
}) =>
  `根据以下世界背景和玩家角色,完善这1名Agent角色的深层设定与交互逻辑。

世界背景:
${JSON.stringify(input.setting)}

玩家角色:
${JSON.stringify(input.players)}

Agent角色骨架:
${JSON.stringify(input.roster)}

必须保留骨架中的 id、name、identity、faction、archetype。补齐 schema 的全部字段;每个字段控制在一到两句话,重点写出施压手段、开场白、秘密和与玩家的关系。`;

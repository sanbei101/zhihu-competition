/**
 * 提示词单一来源。
 * `app/api/world-cast/route.ts`(流式)与 `app/world/actions.ts`(Server Action)共用同一份,
 * 避免两边各写一遍之后字段要求漂移——之前 privateGoal 就因为这个漏了一边。
 */

export const CAST_INSTRUCTIONS = `你是一名严谨的架空历史推演导演和剧本杀作者。根据知乎假设题建立第一幕角色阵容。

角色必须扎根于题目给出的时代、制度和技术条件,不能使用穿越者或全知视角来偷懒。三个玩家候选角色要拥有不同的权力来源、道德困境和玩法;四个 AI 角色要代表不同利益集团,彼此目标不能完全一致。人物关系中必须包含合作、冲突或债务,使他们在第一回合就有采取行动的理由。

必须完整填写 schema 中的每个字段:setting.rules 输出三到六条硬约束;全部七个角色都要填写 voice 和 redLine;三个玩家角色填写 decisionPower 和 privateGoal;四个 Agent 角色填写 pressureMethod 和 openingLine。不要遗漏字段,不要增加角色数量。

privateGoal 是玩家的私密目标:必须具体到可以被判定是否达成,并且与 publicGoal 有张力的可能(比如公开目标是守住城池,私密目标是保住某个人的命)。不要写成「活下去」这种没法判定的空话。

不要续写完整历史,不要提前给出结局,只建立危机爆发时的舞台和可博弈角色。使用简体中文,内容具体、克制。角色 id 使用唯一的简短英文小写标识。`;

export const buildCastPrompt = (input: { scenarioId: string; title: string; content?: string }) =>
  `为下面这条世界线生成开场角色阵容。\n\n知乎问题编号:${input.scenarioId}\n问题:${input.title}\n补充描述:${input.content || "无"}`;

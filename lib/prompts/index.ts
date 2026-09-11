/**
 * 世界线推演的提示词出口。
 *
 * 与之前的写法一致:按调用阶段分组,只做具名再导出。
 *
 * 三个阶段对应三次模型调用:
 *   seed          一次把世界的起跑线摆好(含见证者)
 *   entity        每个主体各跑一次,这是真正并行的部分
 *   adjudication  一次把所有提议合并成唯一历史,并挑出玩家可以取舍的节点
 *
 * 原先还有 observation(观测选项)阶段,牌局改版后它被卡牌本身取代了,已经删掉。
 */

export { WORLD_DISCIPLINE, WORLD_FORMAT_RULES } from "./shared";
export { SEED_INSTRUCTIONS, buildSeedPrompt } from "./seed";
export { ENTITY_INSTRUCTIONS, buildEntityPrompt } from "./entity";
export { ADJUDICATION_INSTRUCTIONS, buildAdjudicationPrompt } from "./adjudication";

/**
 * 世界线推演的提示词出口。
 *
 * 与之前的写法一致:按调用阶段分组,只做具名再导出。
 * 共用纪律不在这里导出 —— 它只服务于本目录内部,外部没有理由直接拼接它。
 */

export { WORLD_DISCIPLINE, WORLD_FORMAT_RULES } from "./shared";
export { SEED_INSTRUCTIONS, buildSeedPrompt } from "./seed";
export { ENTITY_INSTRUCTIONS, buildEntityPrompt } from "./entity";
export { ADJUDICATION_INSTRUCTIONS, buildAdjudicationPrompt } from "./adjudication";
export { OBSERVATION_INSTRUCTIONS, buildObservationPrompt } from "./observation";

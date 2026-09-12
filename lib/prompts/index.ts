/**
 * 世界线推演的提示词出口。按调用阶段分文件,这里只做具名再导出。
 *
 * 三个阶段对应三次模型调用:
 *   seed      一次把世界的起跑线与开局编年摆好
 *   wave      一次把接下来五件大事摆出来
 *   reaction  每件事各跑一次 —— 这是唯一真正并行的部分,也是"多智能体"的实际含义
 */

export { DISCIPLINE, NARRATION, STAGE_VOICE } from "./shared";
export { SEED_INSTRUCTIONS, buildSeedPrompt } from "./seed";
export { WAVE_INSTRUCTIONS, buildWavePrompt } from "./wave";
export { REACTION_INSTRUCTIONS, buildReactionPrompt } from "./reaction";
export { SETTLE_INSTRUCTIONS, buildSettlePrompt } from "./settle";

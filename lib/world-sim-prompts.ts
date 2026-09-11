import { type ScenarioProfile } from "@/lib/scenario-profiles";
import {
  entitySimulationReportSchema,
  type WorldEntity,
  type WorldSeed,
  type WorldState,
} from "@/lib/world-sim";

export const WORLD_SEED_INSTRUCTIONS = `你是反事实世界种子设计师。你只能围绕用户给出的知乎问题标题建立一个自洽世界。
不要生成玩家角色,不要写对话,不要使用“AI Agent”作为世界主体。主体必须是生态系统、政权、人口、机构、技术或文明等可观察力量。
题目标题是唯一反事实起点,不可偷换前提。所有硬规则都必须能限制后续行动。指标必须是0到100的数值。
严格输出结构化对象,文本简短,不要 markdown。`;

export function buildSeedPrompt(input: {
  scenarioId: string;
  title: string;
  themeName: string;
  themeVisual: string;
  themeHint: string;
  profile: ScenarioProfile;
}): string {
  return `
知乎题目: ${input.title}
题目 ID: ${input.scenarioId}
主题: ${input.themeName}
视觉线索: ${input.themeVisual}
主题提示: ${input.themeHint}
模拟模式: ${input.profile.mode}
建议时间尺度: ${JSON.stringify(input.profile.defaultTimeScale)}
允许主体类型: ${input.profile.entityKinds.join(", ")}
主体数量: ${input.profile.minEntityCount}-${input.profile.maxEntityCount}
时间提示: ${input.profile.horizonHint}
指标定义: ${input.profile.metricDefinitions.map((item) => `${item.id}=${item.label}`).join(", ")}

生成一个反事实世界种子。premise.statement 必须忠实复述题目核心条件；entities 只生成允许的主体类型；initialEvents 必须有真实主体 sourceEntityIds。
`;
}

export const ENTITY_SIMULATION_INSTRUCTIONS = `你是世界模拟中的一个独立主体。你只负责为指定主体提出本阶段行动报告,不能替其他主体做决定,不能直接宣布全球结局。
输出目标、1到3个行动、有限的状态变化和事件。每个变化的 delta 必须是小幅度,不能超过20。事件必须有来源主体。
禁止角色台词、长篇对话和第一人称戏剧表演。reasoningSummary 只写结构化因果判断。严格输出结构化对象。`;

export function buildEntityPrompt(input: {
  seed: WorldSeed;
  state: WorldState;
  entity: WorldEntity;
  observation: string;
}): string {
  return `
反事实前提: ${input.seed.premise.statement}
模拟模式: ${input.seed.simulationMode}
当前时间: ${JSON.stringify(input.state.time)}
硬规则: ${input.seed.hardRules.map((rule) => rule.rule).join("; ")}
全局指标: ${input.state.globalMetrics.map((metric) => `${metric.label}=${metric.value}`).join(", ")}
本主体: ${JSON.stringify(input.entity)}
主体当前状态: ${JSON.stringify(input.state.entities.find((item) => item.entityId === input.entity.id))}
其他主体公开状态: ${JSON.stringify(input.state.entities.filter((item) => item.entityId !== input.entity.id))}
玩家观测方向: ${input.observation}

只输出 entityId=${input.entity.id} 的报告。stateChanges 可以影响其他主体,但必须写出明确的传导理由。
`;
}

export function reportSchemaDescription() {
  return entitySimulationReportSchema;
}

import type { EntityKind, SimulationMode, TimeScale } from "@/lib/world-sim";

/**
 * Scenario Profile:不保存题目正文,只保存"模拟器如何处理这个主题"。
 * 题库事实数据(lib/scenario-library.ts)保持只读,这里全部是新增的模拟配置。
 *
 * 对应 plan.md §4.3 / §4.4。
 */

/** 一个全局指标的定义:ID 复用统一枚举,标签按主题localize */
export interface MetricDefinition {
  /** 复用统一指标 ID,保证 UI 与服务端都有类型约束 */
  id: string;
  /** 主题化标签,如 historical 的 stability 叫"政权稳定" */
  label: string;
  description: string;
  goodDirection: "up" | "down" | "mixed";
}

export interface ScenarioProfile {
  mode: SimulationMode;
  defaultTimeScale: TimeScale;
  entityKinds: EntityKind[];
  /** 每个世界观下建议的主体数量区间 */
  minEntityCount: number;
  maxEntityCount: number;
  /** 时间尺度切换提示,给种子生成器看 */
  horizonHint: string;
  metricDefinitions: MetricDefinition[];
}

/** 可复用的统一指标 ID */
export type MetricId =
  | "population"
  | "stability"
  | "resources"
  | "technology"
  | "cohesion"
  | "environment"
  | "conflict"
  | "knowledge";

const HISTORICAL_METRICS: MetricDefinition[] = [
  {
    id: "stability",
    label: "政权稳定",
    description: "中央号令能否贯通到郡县与军镇",
    goodDirection: "up",
  },
  {
    id: "population",
    label: "编户人口",
    description: "在册可征发的人口规模",
    goodDirection: "up",
  },
  { id: "resources", label: "钱粮储备", description: "太仓与转运的可用储备", goodDirection: "up" },
  {
    id: "technology",
    label: "工艺水平",
    description: "农具、冶铁、造船与文书技术",
    goodDirection: "up",
  },
  {
    id: "cohesion",
    label: "社会整合",
    description: "士族、军镇与平民对同一秩序的认同",
    goodDirection: "up",
  },
];

const ECOLOGY_METRICS: MetricDefinition[] = [
  {
    id: "environment",
    label: "生态承载",
    description: "栖息地与食物链的总体承载能力",
    goodDirection: "up",
  },
  {
    id: "population",
    label: "种群规模",
    description: "主要物种的个体数量级",
    goodDirection: "mixed",
  },
  {
    id: "conflict",
    label: "物种竞争",
    description: "生态位重叠造成的竞争烈度",
    goodDirection: "down",
  },
  {
    id: "knowledge",
    label: "可观测积累",
    description: "被记录、被传承下来的知识",
    goodDirection: "up",
  },
];

const COLLAPSE_METRICS: MetricDefinition[] = [
  {
    id: "population",
    label: "存活人口",
    description: "仍在有序社会组织内的幸存者",
    goodDirection: "up",
  },
  {
    id: "resources",
    label: "能源供给",
    description: "维持照明、供暖与运输的可用能源",
    goodDirection: "up",
  },
  {
    id: "stability",
    label: "公共秩序",
    description: "强制力与互信还能覆盖的范围",
    goodDirection: "up",
  },
  {
    id: "knowledge",
    label: "医疗科研",
    description: "还能运转的医疗与科研能力",
    goodDirection: "up",
  },
  {
    id: "environment",
    label: "生存环境",
    description: "大气、温度与地表宜居程度",
    goodDirection: "up",
  },
];

const PLANETARY_METRICS: MetricDefinition[] = [
  {
    id: "environment",
    label: "生物圈完整",
    description: "光合作用与初级生产的存续程度",
    goodDirection: "up",
  },
  { id: "population", label: "人口存续", description: "能维持代谢的人口规模", goodDirection: "up" },
  {
    id: "resources",
    label: "基础设施",
    description: "电网、管网与工业体系的可运行比例",
    goodDirection: "up",
  },
  {
    id: "technology",
    label: "知识存续",
    description: "被保存并可复现的技术与知识",
    goodDirection: "up",
  },
];

const POST_HUMAN_METRICS: MetricDefinition[] = [
  {
    id: "environment",
    label: "生态恢复",
    description: "自然植被与食物网的重建程度",
    goodDirection: "up",
  },
  {
    id: "conflict",
    label: "物种多样性",
    description: "生态位重新分配后的物种丰富度",
    goodDirection: "up",
  },
  {
    id: "resources",
    label: "设施残存",
    description: "仍在运转或可被接管的城市设施",
    goodDirection: "down",
  },
  {
    id: "knowledge",
    label: "智慧演化",
    description: "新的智慧与文化出现的可能性积累",
    goodDirection: "up",
  },
];

const TECH_METRICS: MetricDefinition[] = [
  {
    id: "technology",
    label: "技术扩散",
    description: "自动化与智能系统的渗透率",
    goodDirection: "mixed",
  },
  {
    id: "stability",
    label: "制度张力",
    description: "监管、企业与公众之间的摩擦",
    goodDirection: "down",
  },
  {
    id: "population",
    label: "就业结构",
    description: "劳动人口被重新分配的程度",
    goodDirection: "mixed",
  },
  { id: "cohesion", label: "社会共识", description: "公众对技术秩序的接受度", goodDirection: "up" },
];

const CONTACT_METRICS: MetricDefinition[] = [
  {
    id: "knowledge",
    label: "信息清晰度",
    description: "人类对外星意图的理解置信度",
    goodDirection: "up",
  },
  {
    id: "conflict",
    label: "误判风险",
    description: "擦枪走火与单方面行动的概率",
    goodDirection: "down",
  },
  { id: "cohesion", label: "全球协作", description: "各国能否形成统一应对", goodDirection: "up" },
  {
    id: "technology",
    label: "技术代差",
    description: "与对方文明之间的能力落差",
    goodDirection: "mixed",
  },
];

/** 10 个主题的 Profile。key 与 scenario-library 的 theme.id 一一对应 */
export const SCENARIO_PROFILES: Record<string, ScenarioProfile> = {
  dino: {
    mode: "ecological-evolution",
    defaultTimeScale: "millennium",
    entityKinds: ["species", "population", "ecosystem", "institution", "company"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "标题可在天、年、千年与百万年之间切换,不允许每阶段固定推进同样时长",
    metricDefinitions: ECOLOGY_METRICS,
  },
  "three-kingdoms": {
    mode: "historical-civilization",
    defaultTimeScale: "year",
    entityKinds: ["state", "faction", "population", "institution", "company"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "月、年与十年;重点在制度扩张、人口、征税与地方自治",
    metricDefinitions: HISTORICAL_METRICS,
  },
  "qin-han": {
    mode: "historical-civilization",
    defaultTimeScale: "year",
    entityKinds: ["state", "institution", "faction", "population"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "年与十年;重点在郡县与分封、继承、财政与地方反弹",
    metricDefinitions: HISTORICAL_METRICS,
  },
  "tang-song-ming": {
    mode: "historical-civilization",
    defaultTimeScale: "decade",
    entityKinds: ["state", "faction", "company", "institution", "population"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "年、十年与世纪;重点在制度转型、边疆、财政与航海",
    metricDefinitions: HISTORICAL_METRICS,
  },
  apocalypse: {
    mode: "survival-collapse",
    defaultTimeScale: "day",
    entityKinds: ["state", "population", "institution", "ecosystem", "technology"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "灾难初期用小时、天与周,稳定后切到月与年",
    metricDefinitions: COLLAPSE_METRICS,
  },
  cosmic: {
    mode: "planetary-disaster",
    defaultTimeScale: "month",
    entityKinds: ["planetary-system", "ecosystem", "state", "institution", "technology"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "天、月到年;自然系统必须作为独立主体或确定性过程出现",
    metricDefinitions: PLANETARY_METRICS,
  },
  "after-human": {
    mode: "post-human",
    defaultTimeScale: "year",
    entityKinds: ["ecosystem", "species", "technology", "population"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "年、十年到世纪;不生成政府、军队与人类角色",
    metricDefinitions: POST_HUMAN_METRICS,
  },
  evolution: {
    mode: "ecological-evolution",
    defaultTimeScale: "decade",
    entityKinds: ["species", "population", "institution", "company", "ecosystem"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "年与十年;重点在法律主体、生产关系与身份冲突",
    metricDefinitions: ECOLOGY_METRICS,
  },
  "future-tech": {
    mode: "socio-technical",
    defaultTimeScale: "year",
    entityKinds: ["state", "company", "ai", "technology", "population"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "月与年;重点在技术扩散、就业、监管与身份",
    metricDefinitions: TECH_METRICS,
  },
  alien: {
    mode: "first-contact",
    defaultTimeScale: "month",
    entityKinds: ["alien", "state", "institution", "population", "technology"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "天、月与年;重点在信号、误判、外交与技术交换",
    metricDefinitions: CONTACT_METRICS,
  },
};

const FALLBACK_PROFILE: ScenarioProfile = {
  mode: "historical-civilization",
  defaultTimeScale: "year",
  entityKinds: ["state", "faction", "population", "institution"],
  minEntityCount: 3,
  maxEntityCount: 4,
  horizonHint: "按标题推断时间尺度",
  metricDefinitions: HISTORICAL_METRICS,
};

export function getScenarioProfile(themeId: string | undefined): ScenarioProfile {
  if (!themeId) return FALLBACK_PROFILE;
  return SCENARIO_PROFILES[themeId] ?? FALLBACK_PROFILE;
}

import type { EntityKind, GlobalMetricId, SimulationMode, TimeScale } from "@/lib/world-sim";

export interface MetricDefinition {
  id: GlobalMetricId;
  label: string;
  description: string;
  goodDirection: "up" | "down" | "mixed";
}

export interface ScenarioProfile {
  mode: SimulationMode;
  defaultTimeScale: TimeScale;
  entityKinds: EntityKind[];
  metricDefinitions: MetricDefinition[];
  minEntityCount: number;
  maxEntityCount: number;
  horizonHint: string;
}

const historicalMetrics: MetricDefinition[] = [
  { id: "population", label: "人口", description: "可供生产与动员的人口", goodDirection: "up" },
  {
    id: "stability",
    label: "政权稳定",
    description: "制度与统治秩序的稳固程度",
    goodDirection: "up",
  },
  { id: "resources", label: "资源储备", description: "粮食、能源与财政余量", goodDirection: "up" },
  {
    id: "technology",
    label: "技术扩散",
    description: "生产、交通与组织技术的普及",
    goodDirection: "up",
  },
  { id: "cohesion", label: "社会整合", description: "不同群体共享制度的程度", goodDirection: "up" },
];

const disasterMetrics: MetricDefinition[] = [
  {
    id: "population",
    label: "存活人口",
    description: "仍能获得基本供给的人口",
    goodDirection: "up",
  },
  {
    id: "stability",
    label: "公共秩序",
    description: "社会维持协作与安全的能力",
    goodDirection: "up",
  },
  { id: "resources", label: "资源储备", description: "食物、能源和医疗库存", goodDirection: "up" },
  {
    id: "environment",
    label: "环境宜居度",
    description: "环境对长期生存的支持程度",
    goodDirection: "up",
  },
  { id: "conflict", label: "冲突压力", description: "暴力、竞争和失序风险", goodDirection: "down" },
];

const profiles: Record<string, ScenarioProfile> = {
  dino: {
    mode: "ecological-evolution",
    defaultTimeScale: { unit: "year", amount: 10 },
    entityKinds: ["species", "population", "ecosystem", "institution", "state", "technology"],
    metricDefinitions: [
      {
        id: "population",
        label: "种群规模",
        description: "关键物种与人类种群规模",
        goodDirection: "up",
      },
      {
        id: "environment",
        label: "生态完整度",
        description: "食物网与栖息地的完整程度",
        goodDirection: "up",
      },
      {
        id: "technology",
        label: "技术扩散",
        description: "工具与生物技术的扩散程度",
        goodDirection: "up",
      },
      {
        id: "knowledge",
        label: "知识积累",
        description: "可验证并传承的知识总量",
        goodDirection: "up",
      },
      {
        id: "conflict",
        label: "生态冲突",
        description: "物种与社会的竞争压力",
        goodDirection: "down",
      },
    ],
    minEntityCount: 5,
    maxEntityCount: 6,
    horizonHint: "根据题目在数天、数年或数千年间推进，尊重演化和生态位的时间尺度。",
  },
  "three-kingdoms": {
    mode: "historical-civilization",
    defaultTimeScale: { unit: "year", amount: 3 },
    entityKinds: ["state", "faction", "population", "institution", "technology"],
    metricDefinitions: historicalMetrics,
    minEntityCount: 5,
    maxEntityCount: 6,
    horizonHint: "以月、年和十年推进，关注制度扩张、粮运、人口与地方自治。",
  },
  "qin-han": {
    mode: "historical-civilization",
    defaultTimeScale: { unit: "year", amount: 5 },
    entityKinds: ["state", "faction", "population", "institution", "technology"],
    metricDefinitions: historicalMetrics,
    minEntityCount: 5,
    maxEntityCount: 6,
    horizonHint: "以年和十年推进，关注中央集权、法律、财政和地方反弹。",
  },
  "tang-song-ming": {
    mode: "historical-civilization",
    defaultTimeScale: { unit: "year", amount: 10 },
    entityKinds: ["state", "faction", "population", "company", "institution", "technology"],
    metricDefinitions: historicalMetrics,
    minEntityCount: 5,
    maxEntityCount: 6,
    horizonHint: "以十年推进，关注制度、商贸、边疆、航海和国家合法性。",
  },
  apocalypse: {
    mode: "survival-collapse",
    defaultTimeScale: { unit: "day", amount: 7 },
    entityKinds: ["state", "population", "institution", "ecosystem", "technology"],
    metricDefinitions: disasterMetrics,
    minEntityCount: 5,
    maxEntityCount: 6,
    horizonHint: "灾难初期以小时、天和周推进，稳定后切换到月和年。",
  },
  cosmic: {
    mode: "planetary-disaster",
    defaultTimeScale: { unit: "day", amount: 30 },
    entityKinds: [
      "planetary-system",
      "ecosystem",
      "state",
      "institution",
      "population",
      "technology",
    ],
    metricDefinitions: [
      {
        id: "environment",
        label: "生物圈",
        description: "行星环境对生命的支持能力",
        goodDirection: "up",
      },
      {
        id: "stability",
        label: "气候稳定",
        description: "气候系统的可预测程度",
        goodDirection: "up",
      },
      {
        id: "resources",
        label: "能源粮食",
        description: "文明可支配的基础供给",
        goodDirection: "up",
      },
      { id: "population", label: "人口", description: "仍能维持组织的人口", goodDirection: "up" },
      {
        id: "knowledge",
        label: "科学知识",
        description: "解释和应对异常的能力",
        goodDirection: "up",
      },
    ],
    minEntityCount: 5,
    maxEntityCount: 6,
    horizonHint: "先以小时、天和月推进，再根据物理变化切换到年。自然系统必须独立变化。",
  },
  "after-human": {
    mode: "post-human",
    defaultTimeScale: { unit: "year", amount: 20 },
    entityKinds: ["ecosystem", "species", "population", "technology", "ai"],
    metricDefinitions: [
      {
        id: "environment",
        label: "生态恢复",
        description: "生态系统脱离人类维护后的恢复程度",
        goodDirection: "up",
      },
      {
        id: "population",
        label: "物种多样性",
        description: "不同物种的数量和生态位丰富度",
        goodDirection: "up",
      },
      {
        id: "stability",
        label: "基础设施残存",
        description: "城市与基础设施仍可发挥作用的程度",
        goodDirection: "mixed",
      },
      {
        id: "knowledge",
        label: "智慧演化",
        description: "出现复杂学习与文化传递的程度",
        goodDirection: "up",
      },
      {
        id: "conflict",
        label: "生态竞争",
        description: "物种之间的竞争强度",
        goodDirection: "down",
      },
    ],
    minEntityCount: 5,
    maxEntityCount: 6,
    horizonHint: "以十年、百年和千年推进，不能生成政府、军队或其他默认人类主体。",
  },
  evolution: {
    mode: "ecological-evolution",
    defaultTimeScale: { unit: "year", amount: 5 },
    entityKinds: ["population", "species", "company", "institution", "technology", "ecosystem"],
    metricDefinitions: [
      {
        id: "cohesion",
        label: "社会整合",
        description: "不同法律主体之间的协作程度",
        goodDirection: "up",
      },
      {
        id: "technology",
        label: "生产转型",
        description: "新主体进入生产关系的程度",
        goodDirection: "up",
      },
      {
        id: "knowledge",
        label: "公共认知",
        description: "社会对新事实的理解程度",
        goodDirection: "up",
      },
      { id: "population", label: "主体规模", description: "新旧主体的数量", goodDirection: "up" },
      {
        id: "conflict",
        label: "伦理冲突",
        description: "身份、消费和权利冲突",
        goodDirection: "down",
      },
    ],
    minEntityCount: 5,
    maxEntityCount: 6,
    horizonHint: "以年和十年推进，重点观察法律、生产关系和身份冲突。",
  },
  "future-tech": {
    mode: "socio-technical",
    defaultTimeScale: { unit: "year", amount: 2 },
    entityKinds: ["state", "company", "ai", "population", "institution", "technology"],
    metricDefinitions: [
      {
        id: "technology",
        label: "技术扩散",
        description: "新技术进入社会的速度",
        goodDirection: "up",
      },
      {
        id: "cohesion",
        label: "社会整合",
        description: "利益分配和身份秩序的稳定程度",
        goodDirection: "up",
      },
      {
        id: "resources",
        label: "财富分配",
        description: "生产收益在主体间的分布",
        goodDirection: "mixed",
      },
      {
        id: "knowledge",
        label: "公共认知",
        description: "社会识别和理解技术的能力",
        goodDirection: "up",
      },
      {
        id: "conflict",
        label: "失业冲突",
        description: "技术带来的社会对立压力",
        goodDirection: "down",
      },
    ],
    minEntityCount: 5,
    maxEntityCount: 6,
    horizonHint: "以季度、年和十年推进，关注技术扩散、就业、财富、监管和身份。",
  },
  alien: {
    mode: "first-contact",
    defaultTimeScale: { unit: "month", amount: 3 },
    entityKinds: ["state", "faction", "institution", "population", "alien", "technology"],
    metricDefinitions: [
      {
        id: "stability",
        label: "全球稳定",
        description: "各方避免失控冲突的能力",
        goodDirection: "up",
      },
      {
        id: "knowledge",
        label: "信息确定性",
        description: "对信号与对方能力的理解程度",
        goodDirection: "up",
      },
      {
        id: "technology",
        label: "技术交换",
        description: "跨文明知识与工具的可用程度",
        goodDirection: "up",
      },
      {
        id: "cohesion",
        label: "人类共识",
        description: "人类社会共同决策的程度",
        goodDirection: "up",
      },
      {
        id: "conflict",
        label: "误判风险",
        description: "外交和军备冲突的危险程度",
        goodDirection: "down",
      },
    ],
    minEntityCount: 5,
    maxEntityCount: 6,
    horizonHint: "以天、月和年推进，关注信号、误判、外交、军备和技术交换。",
  },
};

export function getScenarioProfile(themeId: string): ScenarioProfile {
  return profiles[themeId] ?? profiles["future-tech"];
}

export function allScenarioProfiles(): Record<string, ScenarioProfile> {
  return profiles;
}

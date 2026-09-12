import type { EntityKind, SimulationMode, TimeScale } from "@/lib/worldline";

/**
 * Scenario Profile:不保存题目正文,只保存"模拟器如何处理这个主题"。
 * 题库事实数据(lib/scenario-library.ts)保持只读,这里全部是新增的模拟配置。
 *
 * 对应 plan.md §4.3 / §4.4。
 */

export interface ScenarioProfile {
  mode: SimulationMode;
  defaultTimeScale: TimeScale;
  entityKinds: EntityKind[];
  /** 每个世界观下建议的主体数量区间 */
  minEntityCount: number;
  maxEntityCount: number;
  /** 时间尺度切换提示,给种子生成器看 */
  horizonHint: string;
}

/** 10 个主题的 Profile。key 与 scenario-library 的 theme.id 一一对应 */
export const SCENARIO_PROFILES: Record<string, ScenarioProfile> = {
  dino: {
    mode: "ecological-evolution",
    defaultTimeScale: "millennium",
    entityKinds: ["species", "population", "ecosystem", "institution", "company"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "标题可在天、年、千年与百万年之间切换,不允许每阶段固定推进同样时长",
  },
  "three-kingdoms": {
    mode: "historical-civilization",
    defaultTimeScale: "year",
    entityKinds: ["state", "faction", "population", "institution", "company"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "月、年与十年;重点在制度扩张、人口、征税与地方自治",
  },
  "qin-han": {
    mode: "historical-civilization",
    defaultTimeScale: "year",
    entityKinds: ["state", "institution", "faction", "population"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "年与十年;重点在郡县与分封、继承、财政与地方反弹",
  },
  "tang-song-ming": {
    mode: "historical-civilization",
    defaultTimeScale: "decade",
    entityKinds: ["state", "faction", "company", "institution", "population"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "年、十年与世纪;重点在制度转型、边疆、财政与航海",
  },
  apocalypse: {
    mode: "survival-collapse",
    defaultTimeScale: "day",
    entityKinds: ["state", "population", "institution", "ecosystem", "technology"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "灾难初期用小时、天与周,稳定后切到月与年",
  },
  cosmic: {
    mode: "planetary-disaster",
    defaultTimeScale: "month",
    entityKinds: ["planetary-system", "ecosystem", "state", "institution", "technology"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "天、月到年;自然系统必须作为独立主体或确定性过程出现",
  },
  "after-human": {
    mode: "post-human",
    defaultTimeScale: "year",
    entityKinds: ["ecosystem", "species", "technology", "population"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "年、十年到世纪;不生成政府、军队与人类角色",
  },
  evolution: {
    mode: "ecological-evolution",
    defaultTimeScale: "decade",
    entityKinds: ["species", "population", "institution", "company", "ecosystem"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "年与十年;重点在法律主体、生产关系与身份冲突",
  },
  "future-tech": {
    mode: "socio-technical",
    defaultTimeScale: "year",
    entityKinds: ["state", "company", "ai", "technology", "population"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "月与年;重点在技术扩散、就业、监管与身份",
  },
  alien: {
    mode: "first-contact",
    defaultTimeScale: "month",
    entityKinds: ["alien", "state", "institution", "population", "technology"],
    minEntityCount: 3,
    maxEntityCount: 4,
    horizonHint: "天、月与年;重点在信号、误判、外交与技术交换",
  },
};

const FALLBACK_PROFILE: ScenarioProfile = {
  mode: "historical-civilization",
  defaultTimeScale: "year",
  entityKinds: ["state", "faction", "population", "institution"],
  minEntityCount: 3,
  maxEntityCount: 4,
  horizonHint: "按标题推断时间尺度",
};

export function getScenarioProfile(themeId: string | undefined): ScenarioProfile {
  if (!themeId) return FALLBACK_PROFILE;
  return SCENARIO_PROFILES[themeId] ?? FALLBACK_PROFILE;
}

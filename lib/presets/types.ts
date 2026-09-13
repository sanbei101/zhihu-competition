import { type WorldCast } from "@/lib/world-cast";

export interface PresetCastEntry {
  /** 预制阵容唯一标识, 如 'three-kingdoms-chibi-win' */
  id: string;
  /** 所属乐园主题 ID, 对应 SCENARIO_THEMES 中的 id (如 'three-kingdoms', 'cosmic' 等) */
  themeId: string;
  /** 专属知乎问题 ID 列表(可选), 若命中这些 ID 则优先精准推荐本预制 */
  scenarioIds?: string[];
  /** 预制线标题/脑洞假设名称 */
  title: string;
  /** 预制线一句话特色介绍 */
  summary: string;
  /** 符合 worldCastSchema 规范的完整设定与角色数据 */
  cast: WorldCast;
}

export interface PresetLookupResult {
  preset: PresetCastEntry;
  /** 当前主题/问题池中可供轮转的预制总数 */
  totalInPool: number;
  /** 当前预制在池中的索引 (从 0 开始) */
  currentIndex: number;
}

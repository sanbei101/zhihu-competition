import { z } from "zod";

/** 定性代价提示:只给方向,不给确切数字,避免玩家把推演玩成算分。 */
export const metricHintSchema = z.enum(["↑↑", "↑", "-", "↓", "↓↓"]);
export type MetricHint = z.infer<typeof metricHintSchema>;

export const impactHintSchema = z.object({
  stability: metricHintSchema.describe("政权稳定"),
  morale: metricHintSchema.describe("军心士气"),
  support: metricHintSchema.describe("民众支持"),
  resources: metricHintSchema.describe("战略资源"),
});
export type ImpactHint = z.infer<typeof impactHintSchema>;

export const leanSchema = z.enum(["back", "doubt", "oppose"]);
export type Lean = z.infer<typeof leanSchema>;

export const leanLabels: Record<Lean, string> = {
  back: "赞成",
  doubt: "观望",
  oppose: "反对",
};

export const forecastEntrySchema = z.object({
  agentId: z.string().describe("必须是所给在场角色列表里的 id,不要发明新 id"),
  lean: leanSchema,
});
export type ForecastEntry = z.infer<typeof forecastEntrySchema>;

export const decisionOptionSchema = z.object({
  id: z.string().describe("选项唯一短 id,如 A/B/C/D"),
  title: z.string().min(1).max(30).describe("选项标题,不超过三十字"),
  desc: z.string().min(1).max(120).describe("选项具体做法与代价,不超过一百二十字"),
  risk: z.enum(["稳", "险", "赌"]).describe("选项风险等级"),
  impact: impactHintSchema.describe("这个选项大致会拉动哪几维指标,只给定性方向"),
  forecast: z
    .array(forecastEntrySchema)
    .min(2)
    .max(6)
    .describe("你对在场各方在此选项下会站到哪一边的预判,覆盖全部在场角色"),
});
export type DecisionOption = z.infer<typeof decisionOptionSchema>;

export const roundOptionsSchema = z.object({
  situation: z.string().min(1).max(300).describe("本回合突发处境,不超过三百字"),
  options: z
    .array(decisionOptionSchema)
    .length(4)
    .describe("恰好四个立场与代价明显不同的抉择,按 A/B/C/D 顺序排列"),
});
export type RoundOptions = z.infer<typeof roundOptionsSchema>;

/** 点选后拼成 decision 字符串,复用现有回合链路。 */
export function decisionTextOf(option: DecisionOption): string {
  return `${option.title}:${option.desc}`;
}

/** 内置的'按兵不动'选项:不是白给的安全牌,熵增会照常收账。 */
export function idleOptionFor(cast: { agentCharacters: { id: string }[] }): DecisionOption {
  return {
    id: "idle",
    title: "按兵不动",
    desc: "不下任何新命令,让各方先动。你能看清谁在替你扛事、谁在趁乱伸手,但局势不会停下来等你。",
    risk: "稳",
    impact: { stability: "↓", morale: "↓", support: "-", resources: "↑" },
    forecast: cast.agentCharacters.map((character) => ({
      agentId: character.id,
      lean: "doubt" as const,
    })),
  };
}

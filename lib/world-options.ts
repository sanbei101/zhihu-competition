import { z } from "zod";

export const decisionOptionSchema = z.object({
  id: z.string().describe("选项唯一短 id,如 A/B/C/D"),
  title: z.string().min(1).max(30).describe("选项标题,不超过三十字"),
  desc: z.string().min(1).max(120).describe("选项具体做法与代价,不超过一百二十字"),
  risk: z.enum(["稳", "险", "赌"]).describe("选项风险等级"),
});
export type DecisionOption = z.infer<typeof decisionOptionSchema>;

export const roundOptionsSchema = z.object({
  situation: z.string().min(1).max(300).describe("本回合突发处境,不超过三百字"),
  options: z.array(decisionOptionSchema).length(4).describe("恰好四个互斥抉择"),
});
export type RoundOptions = z.infer<typeof roundOptionsSchema>;

/** 点选后拼成原 decision 字符串,复用现有回合链路。 */
export function decisionTextOf(option: DecisionOption): string {
  return `${option.title}:${option.desc}`;
}

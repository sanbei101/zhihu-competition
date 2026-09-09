import { z } from "zod";

export const worldCastRequestSchema = z.object({
  scenarioId: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(300),
  content: z.string().trim().max(6000),
});

const characterSchema = z.object({
  id: z.string().describe("角色唯一的简短英文标识"),
  name: z.string().describe("符合时代背景的角色姓名"),
  identity: z.string().describe("角色的身份与职务"),
  faction: z.string().describe("角色所属阵营或利益群体"),
  personality: z.string().describe("两到三个鲜明且会影响决策的性格特征"),
  publicGoal: z.string().describe("角色公开追求的目标"),
  secret: z.string().describe("只有角色自己知道的秘密或真实动机"),
  relationship: z.string().describe("与其他核心人物最重要的关系或矛盾"),
});

export const worldCastSchema = z.object({
  setting: z.object({
    time: z.string().describe("故事发生的具体时间"),
    location: z.string().describe("故事开始的地点"),
    crisis: z.string().describe("此刻所有角色必须面对的核心危机"),
    opening: z.string().describe("不超过一百五十字的第一幕开场旁白"),
  }),
  playerCharacters: z
    .array(
      characterSchema.extend({
        decisionPower: z.string().describe("玩家扮演此角色时能直接调动的关键资源或权力"),
      }),
    )
    .length(3)
    .describe("三个立场和玩法明显不同的玩家候选角色"),
  agentCharacters: z
    .array(
      characterSchema.extend({
        pressureMethod: z.string().describe("该角色向玩家施压或推进局势的主要手段"),
        openingLine: z.string().describe("该角色在第一幕对玩家说的第一句话"),
      }),
    )
    .length(4)
    .describe("四个将在后续回合中分别由独立 AI Agent 扮演的角色"),
});

export type WorldCast = z.infer<typeof worldCastSchema>;

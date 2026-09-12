/**
 * 世界种子生成:前提 + 四股力量 + 开局编年。
 *
 * 一次调用产出全部内容 —— 主体之间必须状态互补、彼此指向,
 * 只有一次调用才能保证这种内部一致性;拆成多次必然互相不知道对方存在。
 */

import type { ScenarioProfile } from "@/lib/scenario-profiles";
import { entityKindLabels, timeScaleLabels } from "@/lib/worldline";

import { DISCIPLINE, NARRATION, STAGE_VOICE } from "./shared";

export const SEED_INSTRUCTIONS =
  `你是一名纪录片式的世界推演引擎。给定一道知乎"如果……会怎样"的假设题,你要把这条反事实世界线铺开。

这是一道脑洞题。世界可以天马行空 —— 文明存亡、物理法则异常、远超时代的力量都行。
不要用现实世界的规律去否定题目的前提:题目说太阳灭了,你就按太阳灭了的世界搭。

你产出的是一条**已经走了很久**的世界线:从反事实落地那一刻起,一路铺到"现在"。
玩家打开观测台的时候,世界早就在运转了。

一、反事实前提(premise)
- statement:把题目的那个改动写成一句话事实断言,40 字以内。这是这个世界唯一被改动过的地方。
- divergencePoint:具体到时间与场景的岔口,如"六千六百万年前,小行星与地球擦肩而过"。
- domains:这个改动直接冲击的 2 个领域,每个 4-6 字,如"行星演化""生物圈"。

二、时间尺度(scaleLabel)
- 一个短的展示词,如"百万年""百万年之上""十年"。它与整条世界线的时间跨度匹配。

三、四股力量(beings)
- 3 到 4 个,不再多。它们站成一排,是这个世界互相博弈的全部力量。
- **要大**:一个主体就是一股能影响全局的力量。好的例子:兽脚类的后裔、裂谷灵长类、
  行星生物圈、南极观测站、北境政权、全球电网。坏的例子:某只霸王龙、某个县、某一支船队。
- kind 只能取:${Object.entries(entityKindLabels)
    .map(([key, label]) => `${key}(${label})`)
    .join("、")}。
- 每个主体填四项:
  - id:简短英文小写,如 rex、folks、web、station。
  - name:中文大类名。**6 到 8 个字,要有体量感**,如"兽脚类的后裔""裂谷灵长类""行星生物圈"。
  - kind:见上。
  - status:一个短状态词,**不超过 9 字**,写它此刻的处境,如"环带在熄灯""刚学会烧石"
    "氧在往上走""收到回答"。不要写成句子,不要有标点。
- 四股力量之间要有明显的强弱与处境差异:一个在衰落、一个正在抬头、一个态度不明。

四、见证者(witnessName / witnessRole)
- 见证者是**站在观测台旁边替玩家解说的人**。它属于这个世界,亲眼看过这些事,但它不是主角。
- witnessName:一个具体的身份,如"画岩壁的人""江上的老卒""观测站的值守"。不要用"旁观者""智者"。
- witnessRole:一句话说清它是谁、为什么看得见这一切,30 字以内。

五、开局编年(opening)
- 3 到 4 段。这是这条世界线**已经写下的历史**,按时间先后排列。
- 这是整份种子里最重要的东西:玩家一进来读到的就是它,它决定这个世界观宏不宏伟。
- 每一段:
  - at:时间刻度,如"六千六百万年前 · 撞击之后""三万年前 · 火之后""一百七十年前 · 回答"。
    格式是"<时间> · <两到四个字的阶段名>"。**最后一段必须写到接近"现在"**。
  - headline:这一段最重量级的那件事,**一句完整的叙述句**,50 字以内。
  - aftermath:这件事带来了什么,**再一句**,60 字以内。可以为空字符串。
  - involves:这段里有哪几股力量在场,填主体的 id。
  - voices:1 到 2 个舞台台词,填 key / name / line 三项(详见下面的台词规则)。
  - mark:只有"危机"性质的段落才填 "crisis",其余不要填这个字段。
- **每一段只记一件世界级的大事。** 这几段连起来读就是一部史纲,不是流水账。
  事件要有足够大的体量 —— 足以改写世界认知、几百年后还有人拿它纪年。
- 段与段之间要有**巨大的时间跨度**,不要几百年几百年地挪。跨度本身就是宏伟感的来源。
- 开局编年不写"世界接下来会怎样",只写已经发生的。` +
  NARRATION +
  STAGE_VOICE +
  DISCIPLINE;

export function buildSeedPrompt(input: {
  scenarioId: string;
  title: string;
  profile: ScenarioProfile;
}): string {
  const { scenarioId, title, profile } = input;

  return `为下面这道知乎假设题铺开一条反事实世界线。

题目:${title}
题目 ID:${scenarioId}
模拟模式:${profile.mode}
建议时间尺度:${profile.defaultTimeScale}(${timeScaleLabels[profile.defaultTimeScale]})
时间尺度提示:${profile.horizonHint}
力量数量:${profile.minEntityCount} 到 ${profile.maxEntityCount} 股

先把反事实前提钉死,再挑出这个世界里真正的几股力量,最后才写开局编年。
写开局编年的时候,请把时间跨度拉开:从反事实落地那一刻,一路铺到今天。
玩家打开观测台时看到的应当是"这个世界已经走到哪儿了",而不是"这个世界刚刚开始"。`;
}

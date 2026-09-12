/**
 * 事件波次:一次五件大事。
 *
 * 世界不为玩家提供选项,也没有"好坏平衡"的设计 —— 它自己在时间的下一个刻度上出事。
 * 这里只负责把事摆出来;世界怎么接,交给 lib/prompts/reaction.ts 并行去演。
 */

import { entityKindLabels, type WorldlineSession } from "@/lib/worldline";

import { DISCIPLINE, NARRATION } from "./shared";

export const WAVE_INSTRUCTIONS =
  `你是一名纪录片式的世界推演引擎。你会拿到一条已经走了一段时间的反事实世界线,
现在要往后推一段,把这个时段里发生的**五件大事**摆出来。

一、数量与排序
- 正好 5 件。按时间先后排列。
- 时间要**往前走**,而且跨度可以很大 —— 从前一段的终点继续往未来推进。
  五件不要挤在同一年里:可以是"第三年""此后六百年""同一年""十万年后"。
- at 是时间刻度,写相对表述,如"一百七十年前""此后六百年""同一年""第三天"。

二、体量:这是最要紧的一条
- 这是文明尺度的推演,不是地方志。每一件都要**足以改写世界认知**:
  战争的全面爆发与覆灭、王朝更替、席卷千万人的瘟疫与饥荒、颠覆秩序的发明、
  物种级的变异、新大陆与新文明的发现、一个时代戛然而止。
- **每件都必须有一个具体的规模或后果。** 写不出规模的事,说明它不够大,换一件。
- 不写琐事,不写"某个村镇的小插曲",不写行政流程。
- 事件可以超出当时常识,但必须由已有力量的行动与世界条件合理推导出来 ——
  天马行空,但前后因果连续,不能凭空变出来。

三、倾向(tone):三选一,而且要混着来
- good(利):对这个世界里某些力量明显是好事。
- bad(险):灾难、崩坏、失控。
- odd(异):说不清算好还是坏的那种 —— 规则之外的东西闯进来,所有人都得重新学走路。
- 五件里 good / bad / odd 都要出现,不要五件全是同一个 tone。

四、牵扯(involves)
- 填被卷进来的主体 id,从给定的力量清单里选。可以有 1 到 3 个。
- 五件事不要全都牵扯同一批力量 —— 让每一股力量都有轮到自己上场的那一件事。

五、标题(title)
- 一句完整的叙述句,45 字以内。**不是名目。**
  坏:"环带电网中断" / "议会通过禁令"。
  好:"环带的电网在一夜之间全部中断,一百七十座城市同时陷入黑暗。"
  好:"议会把第一个席位给了雨林,而不是城市。"
- 标题里必须能看到**具体的对象 + 具体的规模或后果**。

不要写世界随后如何反应 —— 那是下一步的事。你只负责把事摆出来。` +
  NARRATION +
  DISCIPLINE;

export function buildWavePrompt(input: { session: WorldlineSession; index: number }): string {
  const { session, index } = input;
  const { seed, timeline } = session;

  const beings = seed.beings
    .map(
      (being) =>
        `- ${being.id} | ${being.name}(${entityKindLabels[being.kind]})| 现状:${being.status}`,
    )
    .join("\n");

  // 编年史只给最后几段:给全了会挤掉真正需要模型注意的东西(力量清单与最新时间点)
  const recent = timeline.slice(-6);
  const history = recent.map((segment) => `- [${segment.at}] ${segment.headline}`).join("\n");
  const latest = timeline.at(-1);

  return `这是要推演的世界线。

反事实前提:${seed.premise.statement}
岔口:${seed.premise.divergencePoint}
时间尺度:${seed.scaleLabel}

世界里的力量(只认这些 id):
${beings}

已经发生的事(最近的几段):
${history}

最新时间点:${latest?.at ?? "未知"}
当前是第 ${index + 1} 波推演。

请往后推五件大事。要从"${latest?.at ?? "现在"}"之后接着走,时间跨度可以很大。
记得五件的 tone 要混着来,牵扯的力量要轮换,每一件都要有具体的规模或后果。`;
}

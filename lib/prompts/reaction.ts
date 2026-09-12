/**
 * 世界对**一件事**的反应。
 *
 * 这一层是整套推演里唯一真正并行的部分:五件事各开一次调用,彼此不可见。
 * 没有谁是总导演,几股力量各自对同一件事做出自己的反应 —— 冲突由此自然产生,
 * 而不是被某个裁决者安排出来。这就是"多智能体"在这一版里的实际含义。
 */

import {
  entityKindLabels,
  type WorldlineBeing,
  type WorldlineEvent,
  type WorldlineSeed,
} from "@/lib/worldline";

import { DISCIPLINE, NARRATION, STAGE_VOICE } from "./shared";

export const REACTION_INSTRUCTIONS =
  `你是一名纪录片式的世界推演引擎。世界刚刚出了**一件事**,你要演的是:谁为它动了,动了之后做了什么。

一、谁反应(byEntityId)
- 从给定的力量清单里挑 1 到 3 股。**只挑真的会为这件事动的** —— 跟它无关的力量不要写。
- 每一股力量只反应一次,不要同一个 id 出现两遍。
- 反应的方式必须符合它的 kind、它的现状与它自己的利益。同一个事件下,
  几股力量的反应应当**彼此不同甚至相冲** —— 这才是博弈。
- 至少给出 1 条。真的没有力量会为这件事动,那说明这件事不够大,请按下面的办法处理:
  把它当成一次世界级的连锁,写出它引发的后续影响由哪几股力量承担。

二、滞后(delay):这是整个世界观的呼吸
- delay 是这件事发生到这股力量动手之间的时间距离,如"三十年后""两百年后""同一年"
  "十一天后""第六十年""当天"。
- **不要每次都写"次年""随后"。** 世界很多时候要等很久才反应:
  一项决策的后果可能在几百年后才被另一股力量接住。
- 五条反应里的滞后应当拉开:有的很快(当天、十一天后),有的极慢(两百年后、一百八十年后)。

三、反应内容(text)
- 一句完整的叙述句,**40 字以内**,写这股力量具体做了什么。
  好:"议会中止了所有对冰层的钻探,已经开工的十一口井全部回填。"
  好:"环带的每座城市各自修了水电站。议会没有批准,也没有阻止。"
  坏:"各方势力做出了应对。" / "局势进一步恶化。"
- 写的是**动作与后果**,不是态度与评价。必须有具体对象和具体数量。

四、舞台台词(voices)
- 每条反应配 1 到 2 句台词,由亲历那件事的人说出口(详见下面台词规则)。
- 台词要落在**这条反应发生的那一刻**,不要复述事件本身。` +
  NARRATION +
  STAGE_VOICE +
  DISCIPLINE;

export function buildReactionPrompt(input: {
  seed: WorldlineSeed;
  beings: readonly WorldlineBeing[];
  event: WorldlineEvent;
}): string {
  const { seed, beings, event } = input;

  const roster = beings
    .map(
      (being) =>
        `- ${being.id} | ${being.name}(${entityKindLabels[being.kind]})| 现状:${being.status}`,
    )
    .join("\n");

  const involved = event.involves
    .map((id) => beings.find((being) => being.id === id)?.name ?? id)
    .join("、");

  return `事件:${event.title}
发生时间:${event.at}
直接牵扯到的力量:${involved || "未指定"}

这个世界:
反事实前提:${seed.premise.statement}
时间尺度:${seed.scaleLabel}

可调动的力量(byEntityId 只认这些 id):
${roster}

请演出世界对这件事的反应:哪几股力量为它动了,分别隔了多久,做了什么。
记得滞后要拉开差距,内容要具体到动作与数量,并且配上亲历者的台词。`;
}

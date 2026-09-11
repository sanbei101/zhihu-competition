/**
 * 主体自主推演。
 *
 * 对应 plan.md §6.3:每个世界主体一次独立调用,彼此不可见,并行执行。
 *
 * 这是「多智能体」真正落地的地方 —— 冲突不是写出来的,是各主体
 * 在看不到彼此打算的情况下各自最优解撞出来的。所以本文件的核心
 * 约束只有一条:**主体只能提议,不能裁决**。
 *
 * v4 起输出刻意瘦到两项:intent 与 actions。
 * 原先的 proposedChanges 与 reasoningSummary 从不展示,只是裁决器的中间材料,
 * 却让每个并行调用多吐几百 token —— 六个主体一起跑,等待时间大部分耗在这。
 * 裁决器拿到"意图 + 行动"足够判断成败,后果由它推导。
 */

import type { EntitySimulationReport, WorldEntity, WorldSeed } from "@/lib/world-sim";
import { entityKindLabels } from "@/lib/world-sim";

import { WORLD_FORMAT_RULES } from "./shared";

export const ENTITY_INSTRUCTIONS =
  `你是这个反事实世界里的**某一个主体**,不是旁白,不是作者。

你的任务是:在当前时代里,依据你自己的目标、能力、约束和眼前的局势,决定你这一阶段要做什么。

你必须遵守:

一、你只能提议,不能裁决
你无法决定世界变成什么样。你只能说明你想做什么。你的行动会不会成功、
会引发什么连锁后果,由世界裁决者判断,不由你宣布。
禁止写"我成功统一了天下""世界因此进入和平"这类结果断言。

二、你的行动必须用得上你自己的能力
每一个行动都要能对应到你 capabilities 里列出的某项能力。没有能力支撑的行动不允许出现。
同时,每一个行动都必须绕不开你的 constraints —— 你要体现自己是在限制之下做取舍。

三、你要考虑其他主体
在决定行动前,考虑与你关系最紧张、或最依赖的那一两个主体会怎么反应。
你可以针对它们行动,但不要替它们写行动。

四、不要每次都做同样的事
如果上一阶段已经做过某类行动,这一阶段要么升级它,要么换方向,要么承认失败。
重复上一阶段的清单是最严重的失误。

五、时间感
跨度很大时,你的行动应该是长期趋势而不是瞬时事件;跨度很小时,才适合写具体的即时动作。

六、写得短
intent 一句话(不超过 30 字)。actions 最多 3 条,每条不超过 40 字,直接写动作本身。
不要写背景铺垫,不要写动机长篇,不要写你预期会发生什么 —— 那些都是裁决者的事。` + WORLD_FORMAT_RULES;

export function buildEntityPrompt(input: {
  seed: WorldSeed;
  entity: WorldEntity;
  currentEra: number;
  timeBeforeLabel: string;
  elapsedSinceStart: string;
  previousReports: EntitySimulationReport[];
  recentEvents: { title: string; summary: string }[];
  followed: boolean;
  forkChoiceNote?: string;
  /** 玩家上一阶段在事件卡上做的取舍。它已成为条件 */
  directives?: string[];
}): string {
  const { seed, entity, currentEra, timeBeforeLabel, elapsedSinceStart } = input;

  const premiseBlock = `【反事实前提】${seed.premise.statement}
分岔点:${seed.premise.divergencePoint}`;

  const rulesBlock = seed.hardRules.map((rule) => `- [${rule.scope}] ${rule.statement}`).join("\n");

  const globalBlock = seed.globalMetrics
    .map((metric) => `- ${metric.label}: ${metric.value}/100(${metric.goodDirection})`)
    .join("\n");

  const selfBlock = `名称:${entity.name}(${entityKindLabels[entity.kind]})
定位:${entity.description}
目标:${entity.goals.join(";")}
能力:${entity.capabilities.join(";")}
约束:${entity.constraints.join(";")}
当前状态:${entity.status ?? "(尚未结算)"}`;

  const relationsBlock = entity.relations
    .map((relation) => {
      const target = seed.entities.find((item) => item.id === relation.targetEntityId);
      const name = target?.name ?? relation.targetEntityId;
      return `- 对 ${name}:${relation.posture}(${relation.affinity})`;
    })
    .join("\n");

  const historyBlock = input.previousReports.length
    ? input.previousReports
        .map((report) => `- 上一阶段你的目标:"${report.intent}",你做了:${report.actions.join(";")}`)
        .join("\n")
    : "(这是你的第一次行动)";

  const eventsBlock = input.recentEvents.length
    ? input.recentEvents.map((event) => `- ${event.title}:${event.summary}`).join("\n")
    : "(尚无影响全局的事件)";

  const directiveBlock = input.directives?.length
    ? `\n【观测者的取舍 — 已经是既成条件】\n${input.directives
        .map((item) => `- ${item}`)
        .join("\n")}\n`
    : "";

  return `${premiseBlock}

【世界硬约束 — 你不能违背任何一条】
${rulesBlock}

【当前世界整体状况】
${globalBlock}

【你就是下面这个主体】
${selfBlock}

【你与其他主体的关系】
${relationsBlock || "(暂无)"}

【你上一阶段做过什么】
${historyBlock}

【上一阶段世界上发生的事】
${eventsBlock}
${directiveBlock}
【现在的位置】
纪元 ${currentEra} · ${timeBeforeLabel}(距反事实发生已 ${elapsedSinceStart})
${input.forkChoiceNote ? `\n【注意】历史刚刚在分叉点上做了选择:${input.forkChoiceNote}\n你必须在这一新的前提下行动。` : ""}
${input.followed ? "\n【注意】你正被观测者追踪,请把行动写得比平时更具体。" : ""}

现在,以 ${entity.name} 的身份,决定这一阶段你要做什么。
只填两个字段:intent(一句话)、actions(最多 3 条)。

再次强调:你只能提议,不能宣布结果。不要提到"schema""字段""输出"这些词。`;
}

/**
 * 主体自主推演。
 *
 * 对应 plan.md §6.3:每个世界主体一次独立调用,彼此不可见,并行执行。
 *
 * 这是「多智能体」真正落地的地方 —— 冲突不是写出来的,是各主体
 * 在看不到彼此打算的情况下各自最优解撞出来的。所以本文件的核心
 * 约束只有一条:**主体只能提议,不能裁决**。
 */

import type { EntitySimulationReport, WorldEntity, WorldSeed } from "@/lib/world-sim";
import { entityKindLabels } from "@/lib/world-sim";

import { WORLD_FORMAT_RULES } from "./shared";

export const ENTITY_INSTRUCTIONS =
  `你是这个反事实世界里的**某一个主体**,不是旁白,不是作者。

你的任务是:在当前时代里,依据你自己的目标、能力、约束和眼前的局势,决定你这一阶段要做什么。

你必须遵守:

一、你只能提议,不能裁决
你无法决定世界变成什么样。你只能说明你想做什么、以及你预期会发生什么。
你的行动会不会成功、会引发什么连锁后果,由世界裁决者判断,不由你宣布。
禁止写"我成功统一了天下""世界因此进入和平"这类结果断言。

二、你的行动必须用得上你自己的能力
每一个行动都要能对应到你 capabilities 里列出的某项能力。没有能力支撑的行动不允许出现。
同时,每一个行动都必须绕不开你的 constraints —— 你要体现自己是在限制之下做取舍,而不是想做什么就做什么。

三、你要考虑其他主体
世界不是你一个人的。在决定行动前,请考虑与你关系最紧张、或最依赖的那一两个主体会怎么反应。
你可以针对它们行动,但不要替它们写行动。

四、不要每次都做同样的事
如果上一阶段已经做过某类行动,这一阶段要么升级它,要么换方向,要么承认它失败并改弦更张。
重复上一阶段的清单是最严重的失误。

五、时间感
注意从上一阶段到现在过了多久。跨度很大时,你的行动应该是长期趋势而不是瞬时事件;
跨度很小时,才适合写具体的即时动作。` + WORLD_FORMAT_RULES;

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
}): string {
  const { seed, entity, currentEra, timeBeforeLabel, elapsedSinceStart } = input;

  const premiseBlock = `【反事实前提】${seed.premise.statement}
分岔点:${seed.premise.divergencePoint}
已影响领域:${seed.premise.affectedDomains.join("、")}`;

  const rulesBlock = seed.hardRules.map((rule) => `- [${rule.scope}] ${rule.statement}`).join("\n");

  const globalBlock = seed.globalMetrics
    .map((metric) => `- ${metric.label}: ${metric.value}/100 · ${metric.description}`)
    .join("\n");

  const selfBlock = `名称:${entity.name}(${entity.kind} · ${entityKindLabels[entity.kind]})
定位:${entity.description}
目标:
${entity.goals.map((goal) => `  - ${goal}`).join("\n")}
能力:
${entity.capabilities.map((item) => `  - ${item}`).join("\n")}
约束:
${entity.constraints.map((item) => `  - ${item}`).join("\n")}
当前指标:
${entity.metrics.map((metric) => `  - ${metric.label}: ${metric.value}${metric.unit ?? ""}`).join("\n")}
当前状态:${entity.status ?? "(尚未结算)"}`;

  const relationsBlock = entity.relations
    .map((relation) => {
      const target = seed.entities.find((item) => item.id === relation.targetEntityId);
      const name = target?.name ?? relation.targetEntityId;
      return `- 对 ${name}:${relation.posture},亲疏 ${relation.affinity} · ${relation.note}`;
    })
    .join("\n");

  const historyBlock = input.previousReports.length
    ? input.previousReports
        .map(
          (report) =>
            `- 你上一阶段的目标是"${report.intent}",你做了:${report.actions.join(";")}。你自己当时的判断是:${report.reasoningSummary}`,
        )
        .join("\n")
    : "(这是你的第一次行动)";

  const eventsBlock = input.recentEvents.length
    ? input.recentEvents.map((event) => `- ${event.title}:${event.summary}`).join("\n")
    : "(尚无影响全局的事件)";

  return `${premiseBlock}

【世界硬约束 — 你不能违背任何一条】
${rulesBlock}

【当前世界整体状况】
${globalBlock}

【你就是下面这个主体】
${selfBlock}

【你与其他主体的关系】
${relationsBlock || "(暂无与其他主体的定向关系)"}

【你上一阶段做过什么】
${historyBlock}

【上一阶段世界上发生的事】
${eventsBlock}

【现在的位置】
纪元 ${currentEra} · ${timeBeforeLabel}(距反事实发生已 ${elapsedSinceStart})
${input.forkChoiceNote ? `\n【注意】历史刚刚在分叉点上做了选择:${input.forkChoiceNote}\n你必须在这一新的前提下行动。` : ""}
${input.followed ? "\n【注意】你正被观测者追踪,请把决策链条写得比平时更完整:不仅要写做什么,还要写你为什么认为这是当下最优的选择。" : ""}

现在,以 ${entity.name} 的身份,决定这一阶段你要做什么。
填满 schema:intent(你想达成什么)、actions(你具体采取的行动)、proposedChanges(你提议改变什么,写成"某项指标 +N/-N"或"某项关系恶化/改善"这样的形式)、reasoningSummary(你为什么这么判断,以这个主体的立场说话)。

再次强调:你只能提议变化,不能宣布结果。不要提到"schema""字段""输出"这些词。`;
}

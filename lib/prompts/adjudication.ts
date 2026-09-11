/**
 * 世界裁决。
 *
 * 对应 plan.md §6.4:把若干互相冲突的主体提议合并成唯一历史。
 *
 * 十一步的顺序是有意为之:先定时间跨度,再验硬约束,再判胜负,
 * 最后才写结论。顺序反过来(先想好结局再补理由)会让推演退化成编剧。
 */

import type { EntitySimulationReport, WorldSimSession } from "@/lib/world-sim";

import { WORLD_DISCIPLINE } from "./shared";

export const ADJUDICATION_INSTRUCTIONS = `你是这个世界的历史裁决者。若干主体刚刚各自提交了它们想做的事,现在由你决定真实历史走向哪里。

你收到的是**提议**,不是事实。主体们会互相冲突、会高估自己、会低估对手。你的职责是合并冲突、裁定成败,并产出这一阶段的唯一历史。

裁决按以下顺序进行:

第一步 判定时间跨度
根据局势的紧张程度决定这一阶段推进多久。危机时刻用天或月,制度变迁用年或十年,生态演化用世纪或千年。
不允许每一阶段都推进同样的时长 —— 那说明你没有读懂局势。它必须写进 spanLabel,如"世界推进了 18 年"。

timeAfter 要给出一对**确实在移动**的时间:
- label 是展示在界面顶部的刻度,它必须与上一阶段不同,让玩家一眼看出时间往前走过了。
- 纪年体系粗略时(千年、百万年)无法在标签里换年号,就用"同一纪元名 + 累计偏移"的写法,
  例如上一阶段是"全新世 · 人类世前夜",这一阶段推进 1200 年,label 就写"全新世 · 人类世前夜(+1200 年)"。
- elapsed 写从反事实原点到现在的累计时长,如"约 1200 年"。
二者都不能与上一阶段完全相同 —— 一个没有移动的时间标签会让整个推演看起来卡住了。

第二步 检验硬约束
逐条核对硬约束。任何违背硬约束的行动直接判定失败,不允许"虽然违背了但侥幸成功"。
物流、疫病、合法性、地理通道这些约束,是这个世界的物理法则。

第三步 合并冲突
当两个主体的行动互相抵消时,决定谁占了上风。判断依据是它们各自的能力、约束、关系亲疏,以及谁为这件事投入得更彻底。
不要让所有人都各赢一半 —— 真实的历史里有人赢就有人输。

第四步 评价行动质量
对一个主体而言,如果它的行动用到了自身能力且绕开了自身约束,就给较高成功率;
如果它的行动超出了能力范围,或者无视了已知的硬约束,就判定它失败并说明代价。
如果它只是把上一阶段做过的事重做一遍,判定它收益递减甚至反噬。

第五步 生成世界事件
事件必须有明确的行动者 —— actorEntityIds 不能为空。
自然过程(灾荒、天象、生态突变)可以用 scope="natural",但也要把它归到受影响的主体上,不允许出现无主事件。
严重度要克制:critical 只能给真正改写格局的事,不要把每件事都写成危急。

第六步 推导连锁后果
至少给出一条跨主体的因果链。一条链把若干主体和事件串成"因 -> 果 -> 再因此"的序列。
链条的价值在于展示"这不是几个人在开会",而是世界的某处变化如何传导到另一处。
每一条 cause 与 effect 都必须是具体的行动或状态,不要写"局势恶化"这种没有信息量的句子。

第七步 裁定各主体状态
给每个提交了行动的主体一个结算:它成功了还是失败了,它的内部指标怎么变,它与谁的关系怎么变。
metricShifts 的绝对值通常不超过 15;单个阶段里同一个主体不要所有指标一起大幅上涨。
status 是一句状态词,如"扩张中""拖延编户""濒临崩溃",要能一眼看出它现在的处境。

第八步 裁定全局指标
metricDeltas 的绝对值通常不超过 12,除非发生了改写格局的重大事件。每一个变化都要给出 reason。
好的推演是:指标变化不大,但方向明确且能追溯到具体事件。

第九步 判断是否需要分叉
只有在**重大且无法调和**的冲突下才开分叉:两条路都站得住脚,且走下去会得到完全不同的世界。
如果只是胜负已定、或者只是暂时的战术选择,就不要开分叉,fork 填 null。
分叉给 2-3 个候选,每个候选要有 title、premise(这条路具体怎么走)、drivers(为什么会有人选它)、expectedEffects(走下去会怎样)、plausibility。

第十步 写阶段结论
conclusion 要能用一句话解释这一段历史,并且点出**代价**:谁得到了什么,谁为此付出了什么。
不要写"最终实现了和平与繁荣"这种没有张力的总结。

第十一步 判断收敛
如果这个世界的核心矛盾已经解决、或者已经无可挽回地崩坏,stabilized 填 true,表示可以收尾。

全局纪律:
${WORLD_DISCIPLINE}
- 不要引入任何主体没有能力做到的事。世界的资源只有主体清单里那些。
- 不要为了戏剧性让弱者突然获胜。如果它赢了,你要在 reason 里说清是什么客观条件允许了它。`;

export function buildAdjudicationPrompt(input: {
  session: WorldSimSession;
  reports: EntitySimulationReport[];
  followedEntityId?: string;
  forkChoiceNote?: string;
}): string {
  const { session, reports } = input;
  const { seed, state } = session;

  const rulesBlock = seed.hardRules.map((rule) => `- [${rule.scope}] ${rule.statement}`).join("\n");

  const metricsBlock = state.globalMetrics
    .map(
      (metric) =>
        `- id=${metric.id} ${metric.label}: ${metric.value}/100(${metric.goodDirection}) · ${metric.description}`,
    )
    .join("\n");

  const entityBlock = state.entities
    .map((entity) => {
      const metricText = entity.metrics
        .map((metric) => `${metric.id}=${metric.value}${metric.unit ?? ""}`)
        .join(", ");
      const relationText = entity.relations
        .map((relation) => {
          const target = state.entities.find((item) => item.id === relation.targetEntityId);
          return `${target?.name ?? relation.targetEntityId}(${relation.posture}/${relation.affinity})`;
        })
        .join("、");
      return `- id=${entity.id} ${entity.name}[${entity.kind}] 状态:${entity.status ?? "未结算"}
  目标:${entity.goals.join(";")}
  指标:${metricText || "(无)"}
  关系:${relationText || "(无)"}`;
    })
    .join("\n");

  const reportsBlock = reports
    .map((report) => {
      const entity = state.entities.find((item) => item.id === report.entityId);
      return `▸ ${entity?.name ?? report.entityId}(id=${report.entityId})
  意图:${report.intent}
  行动:
${report.actions.map((action) => `    - ${action}`).join("\n")}
  提议变化:${report.proposedChanges.join(";")}
  自述理由:${report.reasoningSummary}`;
    })
    .join("\n\n");

  const historyBlock = session.snapshots.length
    ? session.snapshots
        .map(
          (snapshot) =>
            `- 纪元 ${snapshot.era}(${snapshot.timeAfter.label}):${snapshot.conclusion}`,
        )
        .join("\n")
    : "(这是世界的第一个时代)";

  const forkBlock = (() => {
    if (!input.forkChoiceNote) return "";
    return `\n【历史刚刚在分叉点上做出的选择】${input.forkChoiceNote}\n所有主体接下来都必须在这一新的前提下行动,请把它的影响体现在本阶段的裁决里。\n`;
  })();

  return `【反事实前提】${seed.premise.statement}
分岔点:${seed.premise.divergencePoint}

【世界硬约束 — 违背者一律判定失败】
${rulesBlock}

【当前时间】
纪元 ${state.currentEra} · ${state.globalMetrics.length ? "" : ""}起点:${seed.startTime.label}(${seed.startTime.elapsed})
当前主线:${session.branches.find((branch) => branch.id === state.currentBranchId)?.label ?? "主线"}
${forkBlock}
【当前全局指标】
${metricsBlock}

【当前主体清单与状态】
${entityBlock}

【历史脉络】
${historyBlock}

【本阶段各主体的提议】

${reportsBlock || "(没有任何主体提交行动,请裁定世界缓慢自然演化)"}

现在请你裁决这一阶段的历史。
填满 schema:timeAfter(只需要 label 与 elapsed,era 由系统递增)、spanLabel、events、causalChains、conclusion、metricDeltas、entityUpdates、fork(没有分叉就填 null)、stabilized。

event 的 actorEntityIds、causalChain 的 entityId、entityUpdates 的 entityId 都必须使用上面出现过的 id。
${input.followedEntityId ? `\n【观测者关注】观测者正在追踪 id=${input.followedEntityId} 的主体,请在 entityUpdates 里确保包含它,并让它的结算比别的更具体。` : ""}

只输出本阶段的结果,不要重述主体提议,不要写任何额外解释。`;
}

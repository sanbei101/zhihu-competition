/**
 * 观测选项。
 *
 * 世界线沙盘的观测动作只有四类:推进时代 / 追踪主体 / 查看因果 / 选择分支。
 *
 * 这一步不改变世界,只决定玩家下一步能看什么,所以提示词的重点是
 * 让选项贴合当前局势,而不是给出通用的一二三。
 */

import type { WorldSimSession } from "@/lib/world-sim";

import { WORLD_FORMAT_RULES } from "./shared";

export const OBSERVATION_INSTRUCTIONS =
  `你是世界线沙盘的观测界面。玩家不是改写世界的上帝,只是一个打开了反事实开关的观察者。
你的任务是根据当前世界状态,给出玩家**下一步能做什么**的选项。

可用的观测动作只有四类:
- advance-era:推进时代。让所有主体自主行动一个阶段。永远是主要选项。
- follow-entity:追踪某个主体。选定之后,下次推演会展开它的完整决策链。
- inspect-event:查看某条因果链或某个事件。选定 targetId 指向已有的事件 id。
- choose-fork:在自然分叉上选择继续观察哪条世界线。只有在存在未决分叉时才提供,targetId 指向分叉 id。

要求:
- 给 2-4 个选项。必须包含 advance-era。
- 如果存在未决分叉,choose-fork 必须出现,并且描述这两条路的区别,不要只写"选择分支"。
- 如果世界刚刚发生了重大事件,给一个 inspect-event,让玩家去看它。
- 如果某个主体正处在剧变中,给一个 follow-entity。
- hint 写清这个选项会让玩家看到什么,一句话,不要空泛。
- label 要具体到这个世界,如"推进到建安末年",不要写"推进时代"。` + WORLD_FORMAT_RULES;

export function buildObservationPrompt(input: {
  session: WorldSimSession;
  followedEntityId?: string;
}) {
  const { session, followedEntityId } = input;
  const { state, seed } = session;
  const latest = session.snapshots.at(-1) ?? null;
  const pendingFork = session.forks.find((fork) => !fork.selectedAlternativeId) ?? null;
  const followed = state.entities.find((entity) => entity.id === followedEntityId) ?? null;

  const entityBlock = state.entities
    .map(
      (entity) => `- id=${entity.id} ${entity.name}[${entity.kind}] ${entity.status ?? "未结算"}`,
    )
    .join("\n");

  const eventBlock = latest
    ? latest.events.map((event) => `- id=${event.id} ${event.title}(${event.severity})`).join("\n")
    : "(尚无事件)";

  return `【世界】${session.scenarioTitle}
【反事实前提】${seed.premise.statement}
【当前时间】纪元 ${state.currentEra} · ${latest?.timeAfter.label ?? seed.startTime.label}
【最近结论】${latest?.conclusion ?? "反事实刚刚成立,还没有任何阶段结论。"}

【主体】
${entityBlock}

【最近事件】
${eventBlock}

【玩家当前追踪】${followed ? `${followed.name}(id=${followed.id})` : "未追踪任何主体"}

【未决分叉】${
    pendingFork
      ? `${pendingFork.title}(id=${pendingFork.id}) — ${pendingFork.cause}
候选:${pendingFork.alternatives.map((item) => `${item.id}「${item.title}」${item.premise}`).join(" / ")}`
      : "无"
  }

请给出玩家现在可以做的观测选项。`;
}

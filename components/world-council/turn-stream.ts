import { userErrorMessage } from "@/lib/app-error";
import { readNdjsonStream } from "@/lib/ndjson-stream";
import { type WorldCast } from "@/lib/world-cast";
import {
  describeCrisis,
  describeRelations,
  describeUltimatum,
  summarizeTurnsForPrompt,
  type AgentRelation,
  type RetortRecord,
  type TurnReactionRecord,
  type TurnRecord,
  type WorldCrisis,
  type WorldMetrics,
  type WorldUltimatum,
} from "@/lib/world-ending";
import { entropyNoteForRound } from "@/lib/world-ending";
import { type WorldTurnEvent, worldTurnEventSchema } from "@/lib/world-turn";

interface TurnStreamInput {
  cast: WorldCast;
  playerId: string;
  round: number;
  situation: string;
  metrics: WorldMetrics;
  turns: TurnRecord[];
  relations: AgentRelation[];
  crisis: WorldCrisis | null;
  ultimatum: WorldUltimatum | null;
  decision: string;
}

export async function collectWorldTurn(
  input: TurnStreamInput,
  onEvent: (event: WorldTurnEvent) => void,
): Promise<{ reactions: TurnReactionRecord[]; retorts: RetortRecord[] }> {
  const response = await fetch("/api/world-turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      historySummary: summarizeTurnsForPrompt(input.turns, 4000),
      relationsSummary: describeRelations(input.relations),
      crisisSummary: describeCrisis(input.crisis),
      ultimatumSummary: describeUltimatum(input.ultimatum),
      entropyNote: entropyNoteForRound(input.round),
    }),
  });

  if (!response.ok) {
    let message = `回合推演失败(${response.status})`;
    try {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "error" in body) {
        const error = body.error;
        if (typeof error === "object" && error !== null && "message" in error) {
          message = String(error.message);
        }
      }
    } catch {
      // 保留状态码兜底提示
    }
    throw new Error(message);
  }

  const reactions: TurnReactionRecord[] = [];
  const retorts: RetortRecord[] = [];
  const expectedAgents = new Set<string>();
  const expectedRetorts = new Set<string>();
  const completedAgents = new Set<string>();
  const completedRetorts = new Set<string>();
  let streamCompleted = false;
  let streamError = "";

  const applyEvent = (event: WorldTurnEvent) => {
    if (event.type === "agent-start") {
      expectedAgents.add(event.agentId);
    } else if (event.type === "agent-reaction") {
      reactions.push({ agentId: event.agentId, reaction: event.reaction });
      completedAgents.add(event.agentId);
    } else if (event.type === "retort-start") {
      expectedRetorts.add(event.agentId);
    } else if (event.type === "agent-retort") {
      retorts.push({
        agentId: event.agentId,
        againstId: event.againstId,
        reaction: event.reaction,
      });
      completedRetorts.add(event.agentId);
    } else if (event.type === "agent-error") {
      streamError = userErrorMessage(event.error);
    } else if (event.type === "error") {
      streamError = userErrorMessage(event.error);
    } else if (event.type === "complete") {
      streamCompleted = true;
    }
    onEvent(event);
  };

  await readNdjsonStream(response, worldTurnEventSchema, applyEvent);

  if (streamError) throw new Error(streamError);
  if (!streamCompleted) throw new Error("回合响应未正常结束,请重试");
  if (
    expectedAgents.size !== input.cast.agentCharacters.length ||
    completedAgents.size !== expectedAgents.size ||
    expectedRetorts.size !== completedRetorts.size
  ) {
    throw new Error("部分角色回应失败,本回合无法继续");
  }

  return { reactions, retorts };
}

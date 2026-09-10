"use client";

import { ArrowLeft, CircleDot, Clock3 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { generateOptionsAction, judgeTurnAction } from "@/app/world/actions";
import { ThemeScene } from "@/components/pixel/theme-scene";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { DecisionPanel } from "@/components/world-council/decision-panel";
import { SeatsPanel, type AgentStatus } from "@/components/world-council/seats-panel";
import { Timeline } from "@/components/world-council/timeline";
import { WorldTabs } from "@/components/world-council/world-tabs";
import { WorldIntro } from "@/components/world-intro";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import { type WorldCast, worldCouncilStorageKey } from "@/lib/world-cast";
import {
  MAX_ROUNDS,
  MIN_ROUND_TO_CLOSE,
  actForRound,
  buildVoluntaryEnding,
  endingLabels,
  summarizeTurnsForPrompt,
  worldGameSessionSchema,
  type MetricDeltas,
  type TurnReactionRecord,
  type WorldEnding,
  type WorldGameSession,
  type WorldMetrics,
} from "@/lib/world-ending";
import { decisionTextOf, type DecisionOption, type RoundOptions } from "@/lib/world-options";
import { type WorldTurnEvent, worldTurnEventSchema } from "@/lib/world-turn";

interface WorldCouncilProps {
  initial: WorldGameSession;
  worldId: string;
  onBack: () => void;
  skin: ScenarioSkin;
}

function WorldCouncil({ initial, worldId, onBack, skin }: WorldCouncilProps) {
  const router = useRouter();
  const cast: WorldCast = initial.cast;
  const player = cast.playerCharacters.find((character) => character.id === initial.playerId);

  const [round, setRound] = useState(initial.round);
  const [metrics, setMetrics] = useState<WorldMetrics>(initial.metrics);
  const [turns, setTurns] = useState<WorldGameSession["turns"]>(initial.turns);
  const [ending, setEnding] = useState<WorldEnding | null>(initial.ending);

  const [submittedDecision, setSubmittedDecision] = useState("");
  // 开场片头只在新开对局播一次:中途刷新、下一回合不再重播。
  const [showIntro, setShowIntro] = useState(initial.turns.length === 0);
  const [options, setOptions] = useState<RoundOptions | null>(null);
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  const [reactions, setReactions] = useState<TurnReactionRecord[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [isResolving, setIsResolving] = useState(false);
  const [isJudging, setIsJudging] = useState(false);
  const [isTurnComplete, setIsTurnComplete] = useState(
    initial.status === "ended" && initial.turns.length > 0,
  );
  const [turnError, setTurnError] = useState("");
  const [judgeError, setJudgeError] = useState("");
  const [lastDeltas, setLastDeltas] = useState<MetricDeltas | null>(
    initial.turns.length ? initial.turns[initial.turns.length - 1].deltas : null,
  );

  const pendingJudgeRef = useRef<{
    decision: string;
    collected: TurnReactionRecord[];
    situation: string;
  } | null>(null);

  if (!player) {
    return (
      <Card className="mx-auto max-w-lg shadow-none">
        <CardHeader>
          <CardTitle>玩家角色丢失</CardTitle>
          <p className="text-muted-foreground text-sm leading-6">
            存档中的角色与当前阵容不一致,请返回世界线页面重新建档。
          </p>
        </CardHeader>
        <CardContent>
          <Button
            nativeButton={false}
            render={<Link href={`/world/${encodeURIComponent(worldId)}`} />}
          >
            返回世界线
            <ArrowLeft data-icon="inline-end" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  const ended = ending !== null;
  const currentTurnSettled = turns.some((turn) => turn.round === round);
  const storageKey = worldCouncilStorageKey(worldId);
  // 守卫之后收窄为非空别名
  const activePlayer = player;

  useEffect(() => {
    const session: WorldGameSession = {
      scenarioId: worldId,
      scenarioTitle: initial.scenarioTitle,
      scenarioUrl: initial.scenarioUrl,
      playerId: initial.playerId,
      cast,
      metrics,
      round,
      turns,
      status: ending ? "ended" : "ongoing",
      ending,
    };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(session));
    } catch (error) {
      console.error("对局存档写入失败", error);
    }
  }, [
    cast,
    ending,
    initial.playerId,
    initial.scenarioTitle,
    initial.scenarioUrl,
    metrics,
    round,
    storageKey,
    turns,
    worldId,
  ]);

  useEffect(() => {
    if (ended || currentTurnSettled || submittedDecision || options) return;
    let cancelled = false;
    setIsGeneratingOptions(true);
    setOptionsError("");
    void generateOptionsAction({
      cast,
      playerId: activePlayer.id,
      metrics,
      round,
      history: turns,
    }).then((result) => {
      if (cancelled) return;
      setIsGeneratingOptions(false);
      if (!result.ok) {
        const message = `${result.error}${result.detail ? `:${result.detail}` : ""}(可重试,不会丢失进度)`;
        setOptionsError(message);
        toast.add({ title: "选项生成失败", description: result.error, type: "error" });
        return;
      }
      setOptions(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [
    activePlayer.id,
    cast,
    currentTurnSettled,
    ended,
    metrics,
    options,
    optionsAttempt,
    round,
    submittedDecision,
    turns,
  ]);

  function retryOptions() {
    setOptionsError("");
    setOptionsAttempt((attempt) => attempt + 1);
  }

  async function runJudge(
    judgeDecision: string,
    collected: TurnReactionRecord[],
    judgeSituation: string,
  ) {
    pendingJudgeRef.current = { decision: judgeDecision, collected, situation: judgeSituation };
    setIsJudging(true);
    setJudgeError("");

    const result = await judgeTurnAction({
      cast,
      playerId: activePlayer.id,
      metrics,
      round,
      situation: judgeSituation,
      decision: judgeDecision,
      reactions: collected,
      history: turns,
    });

    setIsJudging(false);
    if (!result.ok) {
      const message = `${result.error}${result.detail ? `:${result.detail}` : ""}(可重试,不会丢失本回合回应)`;
      setJudgeError(message);
      toast.add({ title: "冲突裁决失败", description: result.error, type: "error" });
      return;
    }

    pendingJudgeRef.current = null;
    const judged = result.data;
    setMetrics(judged.metrics);
    setLastDeltas(judged.deltas);
    setTurns((current) => [
      ...current,
      {
        round,
        decision: judgeDecision,
        reactions: collected,
        events: judged.events,
        narration: judged.narration,
        deltas: judged.deltas,
        metricReasons: judged.metricReasons,
        nextSituation: judged.nextSituation,
      },
    ]);
    if (judged.isEnded && judged.ending) {
      setEnding(judged.ending);
    }
    setIsTurnComplete(true);
    toast.add({ title: `第 ${round} 回合已裁决`, type: "success" });
  }

  function retryJudge() {
    const pending = pendingJudgeRef.current;
    if (pending) void runJudge(pending.decision, pending.collected, pending.situation);
  }

  function startNextRound() {
    if (ended || round >= MAX_ROUNDS) return;
    setRound(round + 1);
    setSubmittedDecision("");
    setOptions(null);
    setOptionsError("");
    setReactions([]);
    setAgentStatuses({});
    setIsTurnComplete(false);
    setTurnError("");
    setJudgeError("");
  }

  function closeVoluntarily() {
    if (ended || round < MIN_ROUND_TO_CLOSE) return;
    setEnding(buildVoluntaryEnding(round));
    setJudgeError("");
    toast.add({ title: "世界线已收束", description: "可查看终章结算", type: "success" });
  }

  function goFinale() {
    router.push(`/world/${encodeURIComponent(worldId)}/finale`);
  }

  async function chooseOption(option: DecisionOption) {
    const content = decisionTextOf(option);
    const situation = options?.situation ?? cast.setting.crisis;
    if (!content || isResolving || isJudging || isTurnComplete || ended) return;

    setSubmittedDecision(content);
    setReactions([]);
    setAgentStatuses({});
    setIsResolving(true);
    setIsTurnComplete(false);
    setTurnError("");
    setJudgeError("");

    const collected: TurnReactionRecord[] = [];

    function applyEvent(turnEvent: WorldTurnEvent) {
      if (turnEvent.type === "agent-start") {
        setAgentStatuses((statuses) => ({
          ...statuses,
          [turnEvent.agentId]: "thinking",
        }));
      } else if (turnEvent.type === "agent-reaction") {
        const record = { agentId: turnEvent.agentId, reaction: turnEvent.reaction };
        collected.push(record);
        setReactions((current) => [...current, record]);
        setAgentStatuses((statuses) => ({
          ...statuses,
          [turnEvent.agentId]: "done",
        }));
      } else if (turnEvent.type === "agent-error") {
        setAgentStatuses((statuses) => ({
          ...statuses,
          [turnEvent.agentId]: "error",
        }));
      }
    }

    function applyLine(line: string) {
      const trimmed = line.trim();
      if (!trimmed) return;
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(trimmed);
      } catch (error) {
        console.error("回合事件不是合法 JSON", error, trimmed.slice(0, 200));
        return;
      }
      const parsedEvent = worldTurnEventSchema.safeParse(parsedJson);
      if (!parsedEvent.success) {
        console.error("回合事件结构不匹配", parsedEvent.error, trimmed.slice(0, 200));
        return;
      }
      applyEvent(parsedEvent.data);
    }

    try {
      const response = await fetch("/api/world-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cast,
          playerId: activePlayer.id,
          round,
          situation,
          metrics,
          historySummary: summarizeTurnsForPrompt(turns, 3600),
          decision: content,
        }),
      });

      if (!response.ok) {
        let message = `回合推演失败(${response.status})`;
        try {
          const body: unknown = await response.json();
          if (typeof body === "object" && body !== null && "error" in body) {
            message = String(body.error);
          }
        } catch {
          // 服务端返回的不是 JSON,保留默认提示
        }
        throw new Error(message);
      }
      if (!response.body) throw new Error("浏览器未收到回合响应流");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        // eslint-disable-next-line no-await-in-loop -- 流式读取必须串行等待每个 chunk
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) applyLine(line);
      }

      buffer += decoder.decode();
      if (buffer.trim()) applyLine(buffer);
    } catch (error) {
      console.error("回合响应流失败", error);
      const message = error instanceof Error ? error.message : "回合推演失败";
      setTurnError(message);
      toast.add({ title: "回合推演失败", description: message, type: "error" });
      // 失败时收回提交态,选项卡片恢复可点,保证可以直接重试
      setSubmittedDecision("");
      setIsResolving(false);
      return;
    }

    setIsResolving(false);
    // 流式回应收齐后自动进入冲突裁决
    await runJudge(content, collected, situation);
  }

  const choiceDisabled = isResolving || isJudging || isTurnComplete || ended;
  const canCloseVoluntarily =
    !ended && isTurnComplete && round >= MIN_ROUND_TO_CLOSE && round < MAX_ROUNDS;

  return (
    <div className="space-y-4">
      <ThemeScene skin={skin} variant="strip" className="border-border rounded-md border" />
      {showIntro ? (
        <WorldIntro
          crisis={cast.setting.crisis}
          opening={cast.setting.opening}
          onDone={() => setShowIntro(false)}
        />
      ) : null}
      <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="返回角色选择">
            <ArrowLeft />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{`回合 ${String(round).padStart(2, "0")} / ${String(MAX_ROUNDS).padStart(2, "0")}`}</Badge>
              <Badge variant="outline">
                <CircleDot data-icon="inline-start" />
                {actForRound(round)}
              </Badge>
              <Badge variant="secondary">{skin.name}</Badge>
              {ended && ending ? (
                <Badge variant="secondary">{endingLabels[ending.type]}</Badge>
              ) : null}
            </div>
            <h2 className="mt-2 text-xl font-semibold">危机议事</h2>
            <p className="text-muted-foreground mt-1 line-clamp-1 text-sm">
              {initial.scenarioTitle}
            </p>
          </div>
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Clock3 className="size-4" />
          {cast.setting.time} · {cast.setting.location}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)_17rem]">
        <SeatsPanel cast={cast} activePlayer={activePlayer} agentStatuses={agentStatuses} />

        <Card className="order-1 min-w-0 shadow-none lg:order-2">
          <CardContent className="p-0">
            <Timeline
              cast={cast}
              activePlayer={activePlayer}
              turns={turns}
              submittedDecision={submittedDecision}
              reactions={reactions}
              currentTurnSettled={currentTurnSettled}
              ended={ended}
              ending={ending}
              openingAnimate={!showIntro && initial.turns.length === 0}
              onGoFinale={goFinale}
            />
            <DecisionPanel
              ended={ended}
              currentTurnSettled={currentTurnSettled}
              submittedDecision={submittedDecision}
              isGeneratingOptions={isGeneratingOptions}
              options={options}
              optionsError={optionsError}
              onRetryOptions={retryOptions}
              choiceDisabled={choiceDisabled}
              onChooseOption={(option) => void chooseOption(option)}
              isResolving={isResolving}
              reactions={reactions}
              agentCount={cast.agentCharacters.length}
              isJudging={isJudging}
              judgeError={judgeError}
              onRetryJudge={retryJudge}
              isTurnComplete={isTurnComplete}
              round={round}
              turnsCount={turns.length}
              onStartNextRound={startNextRound}
              canCloseVoluntarily={canCloseVoluntarily}
              onCloseVoluntarily={closeVoluntarily}
              onGoFinale={goFinale}
              turnError={turnError}
            />
          </CardContent>
        </Card>

        <WorldTabs
          cast={cast}
          activePlayer={activePlayer}
          metrics={metrics}
          lastDeltas={lastDeltas}
          turns={turns}
          reactions={reactions}
          submittedDecision={submittedDecision}
          currentTurnSettled={currentTurnSettled}
          isTurnComplete={isTurnComplete}
        />
      </div>
    </div>
  );
}

export function WorldCouncilSession({ worldId, skin }: { worldId: string; skin: ScenarioSkin }) {
  const router = useRouter();
  const [session, setSession] = useState<WorldGameSession | null>();
  const key = worldCouncilStorageKey(worldId);

  useEffect(() => {
    const storedSession = sessionStorage.getItem(key);

    if (!storedSession) {
      setSession(null);
      return;
    }

    try {
      const raw: unknown = JSON.parse(storedSession);
      const parsed = worldGameSessionSchema.safeParse(raw);
      setSession(parsed.success && parsed.data.scenarioId === worldId ? parsed.data : null);
    } catch (error) {
      console.error("对局会话恢复失败", error);
      sessionStorage.removeItem(key);
      setSession(null);
    }
  }, [key, worldId]);

  if (session === undefined) {
    return (
      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)_17rem]">
        <Skeleton className="h-80" />
        <Skeleton className="h-160" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  const player = session?.cast.playerCharacters.find(
    (character) => character.id === session.playerId,
  );

  if (!session || !player) {
    return (
      <Card className="mx-auto max-w-lg shadow-none">
        <CardHeader>
          <CardTitle>对局尚未建立</CardTitle>
          <p className="text-muted-foreground text-sm leading-6">
            请先返回世界线页面生成阵容并选择角色。
          </p>
        </CardHeader>
        <CardContent>
          <Button
            nativeButton={false}
            render={<Link href={`/world/${encodeURIComponent(worldId)}`} />}
          >
            返回世界线
            <ArrowLeft data-icon="inline-end" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <WorldCouncil initial={session} worldId={worldId} onBack={() => router.back()} skin={skin} />
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { judgeTurnAction } from "@/app/world/actions/judge";
import { generateOptionsAction } from "@/app/world/actions/options";
import { toast } from "@/components/ui/toast";
import type { AgentStatus } from "@/components/world-council/seats-panel";
import type { StageBeat, StagePhase } from "@/components/world-council/speech-stage";
import { collectWorldTurn } from "@/components/world-council/turn-stream";
import { userErrorMessage } from "@/lib/app-error";
import { getInitialRoundOptions } from "@/lib/presets/initial-options";
import { type WorldCast, worldCouncilStorageKey } from "@/lib/world-cast";
import {
  MIN_ROUND_TO_CLOSE,
  buildVoluntaryEnding,
  entropyForRound,
  pressureLevel,
  type AgentRelation,
  type AppliedDeltas,
  type JudgeResult,
  type RetortRecord,
  type TurnReactionRecord,
  type WorldCrisis,
  type WorldEnding,
  type WorldGameSession,
  type WorldMetrics,
  type WorldUltimatum,
} from "@/lib/world-ending";
import {
  decisionTextOf,
  idleOptionFor,
  type DecisionOption,
  type RoundOptions,
} from "@/lib/world-options";
import type { WorldTurnEvent } from "@/lib/world-turn";

export type CouncilPhase =
  | "IDLE_CHOICE"
  | "AGENTS_DEBATING"
  | "JUDGING"
  | "STAGE_PLAYING"
  | "ROUND_SETTLED";

export type TurnBeatEvent =
  | { type: "reaction"; agentId: string }
  | { type: "retort"; agentId: string; againstId: string };

interface UseCouncilSessionOptions {
  initial: WorldGameSession;
  worldId: string;
}

export function useCouncilSession({ initial, worldId }: UseCouncilSessionOptions) {
  const cast: WorldCast = initial.cast;
  const player = cast.playerCharacters.find((character) => character.id === initial.playerId);

  // 1. 核心游戏对局状态
  const [round, setRound] = useState(initial.round);
  const [metrics, setMetrics] = useState<WorldMetrics>(initial.metrics);
  const [turns, setTurns] = useState<WorldGameSession["turns"]>(initial.turns);
  const [ending, setEnding] = useState<WorldEnding | null>(initial.ending);
  const [relations, setRelations] = useState<AgentRelation[]>(initial.relations);
  const [crisis, setCrisis] = useState<WorldCrisis | null>(initial.crisis);
  const [ultimatum, setUltimatum] = useState<WorldUltimatum | null>(initial.ultimatum);

  // 2. 玩家决策与选项状态
  const [submittedDecision, setSubmittedDecision] = useState("");
  const [submittedBranch, setSubmittedBranch] = useState<DecisionOption | null>(null);
  const [options, setOptions] = useState<RoundOptions | null>(null);
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [optionsAttempt, setOptionsAttempt] = useState(0);

  // 3. 回合智能体回应与交锋状态
  const [reactions, setReactions] = useState<TurnReactionRecord[]>([]);
  const [retorts, setRetorts] = useState<RetortRecord[]>([]);
  const [turnBeatEvents, setTurnBeatEvents] = useState<TurnBeatEvent[]>([]);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [isResolving, setIsResolving] = useState(false);
  const [isJudging, setIsJudging] = useState(false);
  const [isTurnComplete, setIsTurnComplete] = useState(
    initial.status === "ended" && initial.turns.length > 0,
  );
  const [turnError, setTurnError] = useState("");
  const [judgeError, setJudgeError] = useState("");

  // 4. 上一轮增量指标
  const [lastDeltas, setLastDeltas] = useState<AppliedDeltas | null>(
    initial.turns.length ? initial.turns[initial.turns.length - 1].deltas : null,
  );
  const [lastEntropy, setLastEntropy] = useState<AppliedDeltas | null>(
    initial.turns.length ? initial.turns[initial.turns.length - 1].entropy : null,
  );
  const [lastCrisisPenalty, setLastCrisisPenalty] = useState<AppliedDeltas | null>(
    initial.turns.length ? initial.turns[initial.turns.length - 1].crisisPenalty : null,
  );

  // 5. 舞台演出队列与调度
  const [playIndex, setPlayIndex] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [performance, setPerformance] = useState<"none" | "opening" | "turn">("none");
  const [openingStarted, setOpeningStarted] = useState(initial.turns.length > 0);
  const [showIntro, setShowIntro] = useState(initial.turns.length === 0);

  // 6. 裁判与预取引用
  const pendingJudgeRef = useRef<{
    decision: string;
    collected: TurnReactionRecord[];
    retortRecords: RetortRecord[];
    situation: string;
  } | null>(null);
  const pendingVerdictRef = useRef<JudgeResult | null>(null);
  const [hasPendingVerdict, setHasPendingVerdict] = useState(false);
  const prefetchedOptionsRef = useRef<RoundOptions | null>(null);

  const ended = ending !== null;
  const currentTurnSettled = turns.some((turn) => turn.round === round);
  const storageKey = worldCouncilStorageKey(worldId);
  const idleOption = idleOptionFor(cast);
  const pressure = pressureLevel(metrics);
  const entropy = entropyForRound(round);

  const agentById = useMemo(
    () => new Map(cast.agentCharacters.map((character) => [character.id, character])),
    [cast],
  );

  // 计算状态机阶段枚举
  const phase: CouncilPhase = useMemo(() => {
    if (ended || isTurnComplete) return "ROUND_SETTLED";
    if (isResolving) return "AGENTS_DEBATING";
    if (isJudging) return "JUDGING";
    if (performance !== "none") return "STAGE_PLAYING";
    return "IDLE_CHOICE";
  }, [ended, isTurnComplete, isResolving, isJudging, performance]);

  // 演出队列构建
  const openingBeats = useMemo<StageBeat[]>(() => {
    const list: StageBeat[] = [
      {
        key: "opening:director",
        directorName: "世界线导演",
        speech: cast.setting.opening,
        variant: "opening",
        label: "事件公布",
      },
    ];

    cast.agentCharacters.forEach((character, index) => {
      list.push({
        key: `opening:${character.id}`,
        speaker: character,
        speech: character.openingLine,
        variant: "opening",
        label: index < 2 ? "公开表态" : "旁听发言",
      });
    });

    return list;
  }, [cast]);

  const turnBeats = useMemo<StageBeat[]>(() => {
    const list: StageBeat[] = [];

    if (submittedDecision && player) {
      list.push({
        key: `decision:${round}`,
        speaker: player,
        speech: submittedDecision,
        variant: "decision",
      });
    }

    for (const event of turnBeatEvents) {
      if (event.type === "reaction") {
        const record = reactions.find((candidate) => candidate.agentId === event.agentId);
        const character = agentById.get(event.agentId);
        if (!record || !character) continue;
        const { reaction } = record;
        list.push({
          key: `reaction:${round}:${record.agentId}`,
          speaker: character,
          speech: reaction.speech,
          variant: "reaction",
          stance: reaction.stance,
          action: reaction.action,
          target: reaction.target,
          impact: reaction.impact,
        });
        continue;
      }

      const record = retorts.find(
        (candidate) =>
          candidate.agentId === event.agentId && candidate.againstId === event.againstId,
      );
      const character = agentById.get(event.agentId);
      if (!record || !character) continue;
      const { reaction } = record;
      list.push({
        key: `retort:${round}:${record.agentId}`,
        speaker: character,
        speech: reaction.speech,
        variant: "retort",
        stance: reaction.stance,
        against: agentById.get(record.againstId),
        action: reaction.action,
        target: reaction.target,
        impact: reaction.impact,
      });
    }

    return list;
  }, [agentById, player, reactions, retorts, round, submittedDecision, turnBeatEvents]);

  const beats = performance === "opening" ? openingBeats : turnBeats;

  const currentBeat =
    performance !== "none" && !skipped && playIndex < beats.length ? beats[playIndex] : null;

  const stagePhase: StagePhase =
    performance === "none"
      ? "idle"
      : currentBeat
        ? "performing"
        : performance === "opening"
          ? "idle"
          : isResolving
            ? "waiting"
            : "judging";

  const stageIdleHint = ended
    ? "这条世界线已经收束,去终章看看它留下了什么。"
    : isTurnComplete
      ? "本轮已经裁决。看完下面的结果,再决定要不要往下走。"
      : "该你下令了 -- 从下面的选项里挑一个。";

  // 自动开演序幕
  useEffect(() => {
    if (showIntro || openingStarted) return;
    setOpeningStarted(true);
    setPerformance("opening");
    setPlayIndex(0);
    setSkipped(false);
  }, [openingStarted, showIntro]);

  // 序幕散场
  useEffect(() => {
    if (performance !== "opening") return;
    if (!skipped && playIndex < beats.length) return;
    setPerformance("none");
    setPlayIndex(0);
    setSkipped(false);
  }, [beats.length, performance, playIndex, skipped]);

  // 把裁决结果落进存档
  const commitJudgement = useCallback(
    (judged: JudgeResult) => {
      const newlyDefected = judged.relations.filter(
        (relation) =>
          relation.attitude === "defected" &&
          (relations.find((previous) => previous.agentId === relation.agentId)?.attitude ??
            "wary") !== "defected",
      );

      setMetrics(judged.metrics);
      setLastDeltas(judged.deltas);
      setLastEntropy(judged.entropy);
      setLastCrisisPenalty(judged.crisisPenalty);
      setRelations(judged.relations);
      setCrisis(judged.crisis);
      setUltimatum(judged.ultimatum);
      setTurns((current) => [
        ...current,
        {
          round,
          branchId: submittedBranch?.id,
          branchTitle: submittedBranch?.title,
          branchOptions: options?.options,
          decision: pendingJudgeRef.current?.decision ?? submittedDecision,
          reactions,
          retorts,
          events: judged.events,
          narration: judged.narration,
          deltas: judged.deltas,
          entropy: judged.entropy,
          crisisPenalty: judged.crisisPenalty,
          metricReasons: judged.metricReasons,
          relations: judged.relations,
          crisis: judged.crisis,
          crisisResolved: judged.crisisResolved,
          ultimatum: judged.ultimatum,
          ultimatumOutcome: judged.ultimatumOutcome,
          nextSituation: judged.nextSituation,
        },
      ]);
      if (judged.isEnded && judged.ending) {
        setEnding(judged.ending);
      }
      setIsTurnComplete(true);

      for (const defector of newlyDefected) {
        const name =
          cast.agentCharacters.find((agent) => agent.id === defector.agentId)?.name ??
          defector.agentId;
        toast.add({
          title: `${name} 已离心`,
          description: "他不再把命令当回事,下一回合可能自行其是。",
          type: "error",
        });
      }
      if (!crisis && judged.crisis) {
        toast.add({
          title: "新的突发事件压了上来",
          description: judged.crisis.title,
          type: "warning",
        });
      }
      if (judged.ultimatumOutcome === "defied") {
        toast.add({
          title: "最后通牒已被无视",
          description: "有人不再等你表态。",
          type: "error",
        });
      }
    },
    [
      cast,
      crisis,
      options?.options,
      reactions,
      relations,
      retorts,
      round,
      submittedBranch,
      submittedDecision,
    ],
  );

  // 回合收尾闸门
  useEffect(() => {
    if (performance !== "turn" || !hasPendingVerdict || isResolving) return;
    if (!skipped && playIndex < beats.length) return;
    const judged = pendingVerdictRef.current;
    if (!judged) return;
    pendingVerdictRef.current = null;
    setHasPendingVerdict(false);
    commitJudgement(judged);
  }, [
    beats.length,
    commitJudgement,
    hasPendingVerdict,
    isResolving,
    performance,
    playIndex,
    skipped,
  ]);

  // 状态自动同步至 sessionStorage
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
      relations,
      crisis,
      ultimatum,
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
    crisis,
    ending,
    initial.playerId,
    initial.scenarioTitle,
    initial.scenarioUrl,
    metrics,
    relations,
    round,
    storageKey,
    turns,
    ultimatum,
    worldId,
  ]);

  // 回合选项生成 (优先查预制，次查预取，最后拉取 API)
  useEffect(() => {
    if (!player) return;
    if (ended || currentTurnSettled || submittedDecision || options) return;

    if (round === 1) {
      const presetOptions = getInitialRoundOptions({
        scenarioId: worldId,
        playerId: player.id,
        fallbackSituation: cast.setting.crisis,
      });
      if (presetOptions) {
        setOptions(presetOptions);
        setIsGeneratingOptions(false);
        return;
      }
    }

    if (prefetchedOptionsRef.current) {
      setOptions(prefetchedOptionsRef.current);
      prefetchedOptionsRef.current = null;
      setIsGeneratingOptions(false);
      return;
    }

    let cancelled = false;
    setIsGeneratingOptions(true);
    setOptionsError("");
    void generateOptionsAction({
      cast,
      playerId: player.id,
      metrics,
      round,
      history: turns,
      relations,
      crisis,
      ultimatum,
    })
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          const message = userErrorMessage(result.error);
          setOptionsError(message);
          toast.add({ title: "选项生成失败", description: result.error.message, type: "error" });
          return;
        }
        setOptions(result.data);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("选项生成请求失败", error);
        const message = "选项生成失败,请重试";
        setOptionsError(message);
        toast.add({ title: "选项生成失败", description: message, type: "error" });
      })
      .finally(() => {
        if (!cancelled) setIsGeneratingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    cast,
    crisis,
    currentTurnSettled,
    ended,
    metrics,
    options,
    optionsAttempt,
    player,
    relations,
    round,
    submittedDecision,
    turns,
    ultimatum,
    worldId,
  ]);

  const runJudge = useCallback(
    async (
      judgeDecision: string,
      collected: TurnReactionRecord[],
      retortRecords: RetortRecord[],
      judgeSituation: string,
    ) => {
      if (!player) return;

      pendingJudgeRef.current = {
        decision: judgeDecision,
        collected,
        retortRecords,
        situation: judgeSituation,
      };
      setIsJudging(true);
      setJudgeError("");

      try {
        const result = await judgeTurnAction({
          cast,
          playerId: player.id,
          metrics,
          round,
          situation: judgeSituation,
          decision: judgeDecision,
          reactions: collected,
          retorts: retortRecords,
          history: turns,
          relations,
          crisis,
          ultimatum,
        });

        if (!result.ok) {
          const message = userErrorMessage(result.error);
          setJudgeError(message);
          toast.add({ title: "冲突裁决失败", description: result.error.message, type: "error" });
          return;
        }

        pendingJudgeRef.current = null;
        pendingVerdictRef.current = result.data;
        setHasPendingVerdict(true);

        // 后台静默预取下轮选项
        if (!result.data.isEnded) {
          const nextTurns = [
            ...turns,
            {
              round,
              situation: judgeSituation,
              decision: judgeDecision,
              reactions: collected,
              retorts: retortRecords,
              deltas: result.data.deltas,
              entropy: result.data.entropy,
              crisisPenalty: result.data.crisisPenalty,
              metrics: result.data.metrics,
              events: result.data.events,
              narration: result.data.narration,
              nextSituation: result.data.nextSituation,
              crisis: result.data.crisis,
              ultimatum: result.data.ultimatum,
            },
          ];
          void generateOptionsAction({
            cast,
            playerId: player.id,
            metrics: result.data.metrics,
            round: round + 1,
            history: nextTurns,
            relations: result.data.relations,
            crisis: result.data.crisis,
            ultimatum: result.data.ultimatum,
          })
            .then((preResult) => {
              if (preResult.ok) prefetchedOptionsRef.current = preResult.data;
            })
            .catch((err) => {
              console.warn("下一轮选项后台预取异常", err);
            });
        }
      } catch (error) {
        console.error("冲突裁决请求失败", error);
        const message = "冲突裁决失败,请重试";
        setJudgeError(message);
        toast.add({ title: "冲突裁决失败", description: message, type: "error" });
      } finally {
        setIsJudging(false);
      }
    },
    [cast, crisis, metrics, player, relations, round, turns, ultimatum],
  );

  const chooseOption = useCallback(
    async (option: DecisionOption) => {
      if (!player) return;
      const content = decisionTextOf(option);
      const situation = options?.situation ?? cast.setting.crisis;
      if (!content || isResolving || isJudging || isTurnComplete || ended) return;

      setSubmittedDecision(content);
      setSubmittedBranch(option);
      setReactions([]);
      setRetorts([]);
      setTurnBeatEvents([]);
      setAgentStatuses({});
      setIsResolving(true);
      setIsTurnComplete(false);
      setTurnError("");
      setJudgeError("");

      setPerformance("turn");
      setSkipped(false);
      setPlayIndex(0);
      pendingVerdictRef.current = null;
      setHasPendingVerdict(false);

      function applyEvent(turnEvent: WorldTurnEvent) {
        if (turnEvent.type === "agent-start") {
          setAgentStatuses((statuses) => ({ ...statuses, [turnEvent.agentId]: "thinking" }));
        } else if (turnEvent.type === "agent-reaction") {
          const record = { agentId: turnEvent.agentId, reaction: turnEvent.reaction };
          setReactions((current) => [...current, record]);
          setTurnBeatEvents((current) => [
            ...current,
            { type: "reaction", agentId: turnEvent.agentId },
          ]);
          setAgentStatuses((statuses) => ({ ...statuses, [turnEvent.agentId]: "done" }));
        } else if (turnEvent.type === "retort-start") {
          setAgentStatuses((statuses) => ({ ...statuses, [turnEvent.agentId]: "thinking" }));
        } else if (turnEvent.type === "agent-retort") {
          setRetorts((current) => [
            ...current,
            {
              agentId: turnEvent.agentId,
              againstId: turnEvent.againstId,
              reaction: turnEvent.reaction,
            },
          ]);
          setTurnBeatEvents((current) => [
            ...current,
            { type: "retort", agentId: turnEvent.agentId, againstId: turnEvent.againstId },
          ]);
          setAgentStatuses((statuses) => ({ ...statuses, [turnEvent.agentId]: "done" }));
        } else if (turnEvent.type === "agent-error") {
          setAgentStatuses((statuses) => ({ ...statuses, [turnEvent.agentId]: "error" }));
        }
      }

      let collected: Awaited<ReturnType<typeof collectWorldTurn>> | null = null;
      try {
        collected = await collectWorldTurn(
          {
            cast,
            playerId: player.id,
            round,
            situation,
            metrics,
            turns,
            relations,
            crisis,
            ultimatum,
            decision: content,
          },
          applyEvent,
        );
      } catch (error) {
        console.error("回合响应流失败", error);
        const message = error instanceof Error ? error.message : "回合推演失败";
        setTurnError(message);
        toast.add({ title: "回合推演失败", description: message, type: "error" });
        setSubmittedDecision("");
        setSubmittedBranch(null);
        setIsResolving(false);
        return;
      }

      if (!collected) return;
      setIsResolving(false);
      await runJudge(content, collected.reactions, collected.retorts, situation);
    },
    [
      cast,
      isJudging,
      isResolving,
      isTurnComplete,
      ended,
      metrics,
      options?.situation,
      player,
      round,
      runJudge,
      turns,
      relations,
      crisis,
      ultimatum,
    ],
  );

  const startNextRound = useCallback(() => {
    if (ended) return;
    setRound((r) => r + 1);
    setSubmittedDecision("");
    setSubmittedBranch(null);
    if (prefetchedOptionsRef.current) {
      setOptions(prefetchedOptionsRef.current);
      prefetchedOptionsRef.current = null;
    } else {
      setOptions(null);
    }
    setOptionsError("");
    setReactions([]);
    setRetorts([]);
    setTurnBeatEvents([]);
    setAgentStatuses({});
    setIsTurnComplete(false);
    setTurnError("");
    setJudgeError("");
    setPerformance("none");
    setSkipped(false);
    setPlayIndex(0);
  }, [ended]);

  const retryJudge = useCallback(() => {
    const pending = pendingJudgeRef.current;
    if (pending) {
      void runJudge(pending.decision, pending.collected, pending.retortRecords, pending.situation);
    }
  }, [runJudge]);

  const retryOptions = useCallback(() => {
    setOptionsError("");
    setOptionsAttempt((a) => a + 1);
  }, []);

  const closeVoluntarily = useCallback(() => {
    if (ended || round < MIN_ROUND_TO_CLOSE) return;
    setEnding(buildVoluntaryEnding(round, metrics));
    setJudgeError("");
    toast.add({ title: "世界线已收束", description: "可查看终章结算", type: "success" });
  }, [ended, metrics, round]);

  const handleBeatDone = useCallback(() => {
    setPlayIndex((i) => i + 1);
  }, []);

  const skipPerformance = useCallback(() => {
    setSkipped(true);
  }, []);

  const choiceDisabled =
    isResolving || isJudging || isTurnComplete || ended || performance === "opening";
  const canCloseVoluntarily = !ended && isTurnComplete && round >= MIN_ROUND_TO_CLOSE;
  const stageSpeakerId = currentBeat?.speaker?.id ?? null;
  const stageOpponentId = currentBeat?.against?.id ?? null;
  const showOpening = !showIntro && performance !== "opening";

  return {
    cast,
    player,
    round,
    metrics,
    turns,
    ending,
    relations,
    crisis,
    ultimatum,
    ended,
    currentTurnSettled,
    pressure,
    entropy,
    phase,
    options,
    isGeneratingOptions,
    optionsError,
    choiceDisabled,
    chooseOption,
    retryOptions,
    submittedDecision,
    submittedBranch,
    reactions,
    retorts,
    isResolving,
    isJudging,
    judgeError,
    retryJudge,
    isTurnComplete,
    startNextRound,
    canCloseVoluntarily,
    closeVoluntarily,
    turnError,
    idleOption,
    currentBeat,
    stagePhase,
    stageIdleHint,
    stageSpeakerId,
    stageOpponentId,
    handleBeatDone,
    skipPerformance,
    showIntro,
    setShowIntro,
    agentStatuses,
    lastDeltas,
    lastEntropy,
    lastCrisisPenalty,
    showOpening,
  };
}

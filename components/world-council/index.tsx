"use client";

import { ArrowLeft, CircleDot, Clock3, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { judgeTurnAction } from "@/app/world/actions/judge";
import { generateOptionsAction } from "@/app/world/actions/options";
import { ThemeScene } from "@/components/pixel/theme-scene";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { DecisionPanel } from "@/components/world-council/decision-panel";
import { SeatsPanel, type AgentStatus } from "@/components/world-council/seats-panel";
import {
  SpeechStage,
  type StageBeat,
  type StagePhase,
} from "@/components/world-council/speech-stage";
import { Timeline } from "@/components/world-council/timeline";
import { collectWorldTurn } from "@/components/world-council/turn-stream";
import { WorldTabs } from "@/components/world-council/world-tabs";
import { WorldIntro } from "@/components/world-intro";
import { userErrorMessage } from "@/lib/app-error";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import { type WorldCast, worldCouncilStorageKey } from "@/lib/world-cast";
import {
  MIN_ROUND_TO_CLOSE,
  actForRound,
  buildVoluntaryEnding,
  endingLabels,
  entropyForRound,
  pressureLabels,
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

interface WorldCouncilProps {
  initial: WorldGameSession;
  worldId: string;
  onBack: () => void;
  skin: ScenarioSkin;
}

type TurnBeatEvent =
  | { type: "reaction"; agentId: string }
  | { type: "retort"; agentId: string; againstId: string };

export function WorldCouncil({ initial, worldId, onBack, skin }: WorldCouncilProps) {
  const router = useRouter();
  const cast: WorldCast = initial.cast;
  const player = cast.playerCharacters.find((character) => character.id === initial.playerId);

  const [round, setRound] = useState(initial.round);
  const [metrics, setMetrics] = useState<WorldMetrics>(initial.metrics);
  const [turns, setTurns] = useState<WorldGameSession["turns"]>(initial.turns);
  const [ending, setEnding] = useState<WorldEnding | null>(initial.ending);
  const [relations, setRelations] = useState<AgentRelation[]>(initial.relations);
  const [crisis, setCrisis] = useState<WorldCrisis | null>(initial.crisis);
  const [ultimatum, setUltimatum] = useState<WorldUltimatum | null>(initial.ultimatum);

  const [submittedDecision, setSubmittedDecision] = useState("");
  // 开场片头只在新开对局播一次:中途刷新、下一回合不再重播。
  const [showIntro, setShowIntro] = useState(initial.turns.length === 0);
  const [options, setOptions] = useState<RoundOptions | null>(null);
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [optionsAttempt, setOptionsAttempt] = useState(0);
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
  const [lastDeltas, setLastDeltas] = useState<AppliedDeltas | null>(
    initial.turns.length ? initial.turns[initial.turns.length - 1].deltas : null,
  );
  const [lastEntropy, setLastEntropy] = useState<AppliedDeltas | null>(
    initial.turns.length ? initial.turns[initial.turns.length - 1].entropy : null,
  );
  const [lastCrisisPenalty, setLastCrisisPenalty] = useState<AppliedDeltas | null>(
    initial.turns.length ? initial.turns[initial.turns.length - 1].crisisPenalty : null,
  );

  const pendingJudgeRef = useRef<{
    decision: string;
    collected: TurnReactionRecord[];
    retortRecords: RetortRecord[];
    situation: string;
  } | null>(null);

  // 舞台演出:每一拍排成一条队列,一次只演一拍,逐字说完才推进下一拍。
  // 开场白也走同一套机制 -- 第一眼的观感不该还是'四条消息自己在下面打字'。
  const [playIndex, setPlayIndex] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [performance, setPerformance] = useState<"none" | "opening" | "turn">("none");
  const [openingStarted, setOpeningStarted] = useState(initial.turns.length > 0);
  // 裁决先攥在手里,等演出收尾再提交 -- 否则裁决卡会在别人还在说话时弹出来
  const pendingVerdictRef = useRef<JudgeResult | null>(null);
  const [hasPendingVerdict, setHasPendingVerdict] = useState(false);

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

  /**
   * 序幕的队列:导演先公布事件,然后四位 Agent 依次开口。
   * 前两位是公开表态,后两位只是旁听插话,这个由头沿用历史流里的说法。
   */
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

  /** 本回合按事件抵达顺序演出,辩论不必等所有 Agent 表态结束。 */
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
        // 交锋是两人同框:被回击的那个人一起上台,压暗站在对面
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

  /**
   * 片头过场散场后自动开演序幕。已经有回合的存档不再重演。
   */
  useEffect(() => {
    if (showIntro || openingStarted) return;
    setOpeningStarted(true);
    setPerformance("opening");
    setPlayIndex(0);
    setSkipped(false);
  }, [openingStarted, showIntro]);

  /** 序幕散场:台上交还给玩家,四条开场白落进下方的历史流 */
  useEffect(() => {
    if (performance !== "opening") return;
    if (!skipped && playIndex < beats.length) return;
    setPerformance("none");
    setPlayIndex(0);
    setSkipped(false);
  }, [beats.length, performance, playIndex, skipped]);

  /**
   * 回合的收尾闸门:每一拍都演完(或被跳过)、流式回应收齐、裁决结果到手,
   * 三件事同时满足才把裁决落进存档。
   */
  useEffect(() => {
    if (performance !== "turn" || !hasPendingVerdict || isResolving) return;
    if (!skipped && playIndex < beats.length) return;
    const judged = pendingVerdictRef.current;
    if (!judged) return;
    pendingVerdictRef.current = null;
    setHasPendingVerdict(false);
    commitJudgement(judged);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 提交动作每帧重建,靠上面三道门槛保证只提交一次
  }, [beats.length, hasPendingVerdict, performance, isResolving, playIndex, skipped]);

  function handleBeatDone() {
    setPlayIndex((index) => index + 1);
  }

  function skipPerformance() {
    setSkipped(true);
  }

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

  useEffect(() => {
    if (!player) return;
    if (ended || currentTurnSettled || submittedDecision || options) return;
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
  ]);

  function retryOptions() {
    setOptionsError("");
    setOptionsAttempt((attempt) => attempt + 1);
  }

  async function runJudge(
    judgeDecision: string,
    collected: TurnReactionRecord[],
    retortRecords: RetortRecord[],
    judgeSituation: string,
  ) {
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
        playerId: activePlayer.id,
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
      // 先攥在手里:等台上的戏演完再提交,不然裁决卡会插在别人说话中间
      pendingVerdictRef.current = result.data;
      setHasPendingVerdict(true);
    } catch (error) {
      console.error("冲突裁决请求失败", error);
      const message = "冲突裁决失败,请重试";
      setJudgeError(message);
      toast.add({ title: "冲突裁决失败", description: message, type: "error" });
    } finally {
      setIsJudging(false);
    }
  }

  /** 把裁决落进存档。只在演出收尾之后调用,所以它是'一幕'的最后一个动作。 */
  function commitJudgement(judged: JudgeResult) {
    // 找出这一回合新离心的人,单独提醒
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
    // 落幕:舞台交还给玩家,等下一步指令
    setPerformance("none");
    setSkipped(false);
    setPlayIndex(0);
    toast.add({ title: `第 ${round} 回合已裁决`, type: "success" });

    for (const defector of newlyDefected) {
      const name =
        cast.agentCharacters.find((character) => character.id === defector.agentId)?.name ??
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
        type: "error",
      });
    }
    if (judged.ultimatumOutcome === "defied") {
      toast.add({
        title: "最后通牒已被无视",
        description: "有人不再等你表态。",
        type: "error",
      });
    }
  }

  function retryJudge() {
    const pending = pendingJudgeRef.current;
    if (pending) {
      void runJudge(pending.decision, pending.collected, pending.retortRecords, pending.situation);
    }
  }

  function startNextRound() {
    if (ended) return;
    setRound(round + 1);
    setSubmittedDecision("");
    setOptions(null);
    setOptionsError("");
    setReactions([]);
    setRetorts([]);
    setTurnBeatEvents([]);
    setAgentStatuses({});
    setIsTurnComplete(false);
    setTurnError("");
    setJudgeError("");
    // 新的一幕,舞台重新开场
    setPerformance("none");
    setSkipped(false);
    setPlayIndex(0);
  }

  function closeVoluntarily() {
    if (ended || round < MIN_ROUND_TO_CLOSE) return;
    setEnding(buildVoluntaryEnding(round, metrics));
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
    setRetorts([]);
    setTurnBeatEvents([]);
    setAgentStatuses({});
    setIsResolving(true);
    setIsTurnComplete(false);
    setTurnError("");
    setJudgeError("");
    // 开幕:先从你的抉择演起
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
          playerId: activePlayer.id,
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
      // 失败时收回提交态,选项卡片恢复可点,保证可以直接重试
      setSubmittedDecision("");
      setIsResolving(false);
      return;
    }

    if (!collected) return;
    setIsResolving(false);
    // 流式回应收齐后自动进入冲突裁决
    await runJudge(content, collected.reactions, collected.retorts, situation);
  }

  // hook 全部调用完之后才允许提前返回,避免条件调用 hook
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

  // 守卫之后收窄为非空别名
  const activePlayer = player;
  // 序幕演出期间不让下令:戏还没开演就点选项,序幕会被打断,那四条开场白就再也落不进历史流了
  const choiceDisabled =
    isResolving || isJudging || isTurnComplete || ended || performance === "opening";
  const canCloseVoluntarily = !ended && isTurnComplete && round >= MIN_ROUND_TO_CLOSE;
  /** 台上正在发言的人(玩家的抉择也算):左栏据此点亮他那一席、压暗其余。导演没有席位,自然不参与 */
  const stageSpeakerId = currentBeat?.speaker?.id ?? null;
  /** 交锋时站在对面的那个人 */
  const stageOpponentId = currentBeat?.against?.id ?? null;
  /** 四条开场白只在'没在台上演'且片头已散场时才落进历史流,免得同一句话出现两次 */
  const showOpening = !showIntro && performance !== "opening";

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
              <Badge>{`回合 ${String(round).padStart(2, "0")}`}</Badge>
              <Badge variant="outline">
                <CircleDot data-icon="inline-start" />
                {actForRound(round)}
              </Badge>
              {pressure !== "stable" ? (
                <Badge variant="destructive">{pressureLabels[pressure]}</Badge>
              ) : null}
              {entropy > 0 ? (
                <Badge variant="outline" className="gap-1">
                  <TrendingDown className="size-3" />
                  大势每回合流失 {entropy}
                </Badge>
              ) : null}
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
        <SeatsPanel
          cast={cast}
          activePlayer={activePlayer}
          agentStatuses={agentStatuses}
          relations={relations}
          ultimatum={ultimatum}
          speakingId={stageSpeakerId}
          opposingId={stageOpponentId}
          skin={skin}
        />

        <div className="order-1 min-w-0 space-y-4 lg:order-2">
          <SpeechStage
            skin={skin}
            beat={currentBeat}
            player={activePlayer}
            phase={stagePhase}
            idleHint={stageIdleHint}
            onBeatDone={handleBeatDone}
            onSkip={skipPerformance}
          />

          <Card className="shadow-none">
            <CardContent className="p-0">
              <Timeline
                cast={cast}
                activePlayer={activePlayer}
                turns={turns}
                ended={ended}
                ending={ending}
                showOpening={showOpening}
                onGoFinale={goFinale}
              />
              <DecisionPanel
                cast={cast}
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
                isJudging={isJudging}
                judgeError={judgeError}
                onRetryJudge={retryJudge}
                isTurnComplete={isTurnComplete}
                turnsCount={turns.length}
                onStartNextRound={startNextRound}
                canCloseVoluntarily={canCloseVoluntarily}
                onCloseVoluntarily={closeVoluntarily}
                onGoFinale={goFinale}
                turnError={turnError}
                crisis={crisis}
                ultimatum={ultimatum}
                idleOption={idleOption}
              />
            </CardContent>
          </Card>
        </div>

        <WorldTabs
          cast={cast}
          activePlayer={activePlayer}
          metrics={metrics}
          lastDeltas={lastDeltas}
          lastEntropy={lastEntropy}
          lastCrisisPenalty={lastCrisisPenalty}
          round={round}
          turns={turns}
          relations={relations}
          reactions={reactions}
          retorts={retorts}
          submittedDecision={submittedDecision}
          currentTurnSettled={currentTurnSettled}
          isTurnComplete={isTurnComplete}
          crisis={crisis}
          ultimatum={ultimatum}
        />
      </div>
    </div>
  );
}

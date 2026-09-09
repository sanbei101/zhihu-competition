"use client";

import {
  Activity,
  ArrowLeft,
  Check,
  CircleDot,
  Clock3,
  Flag,
  GitBranch,
  LoaderCircle,
  ScrollText,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";

import { generateOptionsAction, judgeTurnAction } from "@/app/world/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { WorldIntro } from "@/components/world-intro";
import { type WorldCast, worldCouncilStorageKey } from "@/lib/world-cast";
import {
  MAX_ROUNDS,
  MIN_ROUND_TO_CLOSE,
  actForRound,
  buildVoluntaryEnding,
  endingLabels,
  metricKeys,
  metricLabels,
  worldGameSessionSchema,
  type MetricDeltas,
  type TurnReactionRecord,
  type WorldEnding,
  type WorldGameSession,
  type WorldMetrics,
} from "@/lib/world-ending";
import { decisionTextOf, type DecisionOption, type RoundOptions } from "@/lib/world-options";
import { type AgentReaction, type WorldTurnEvent, worldTurnEventSchema } from "@/lib/world-turn";

interface WorldCouncilProps {
  initial: WorldGameSession;
  worldId: string;
  onBack: () => void;
}

type AgentStatus = "thinking" | "done" | "error";

const stanceLabels: Record<AgentReaction["stance"], string> = {
  support: "支持",
  oppose: "反对",
  negotiate: "交涉",
  exploit: "借势",
};

function PlayerDecisionMessage({
  playerName,
  decision,
  roundLabel,
}: {
  playerName: string;
  decision: string;
  roundLabel?: string;
}) {
  return (
    <Message align="end">
      <MessageAvatar className="bg-primary text-primary-foreground size-8">
        {playerName.slice(0, 1)}
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>
          {playerName} · 你的抉择{roundLabel ? ` · ${roundLabel}` : null}
        </MessageHeader>
        <div className="bg-primary text-primary-foreground max-w-2xl rounded-lg px-4 py-3 leading-7">
          {decision}
        </div>
      </MessageContent>
    </Message>
  );
}

function ReactionMessage({
  characterName,
  reaction,
}: {
  characterName: string;
  reaction: AgentReaction;
}) {
  return (
    <Message>
      <MessageAvatar className="size-8">{characterName.slice(0, 1)}</MessageAvatar>
      <MessageContent>
        <MessageHeader className="gap-2">
          <span>{characterName}</span>
          <Badge variant="outline">{stanceLabels[reaction.stance]}</Badge>
        </MessageHeader>
        <div className="border-border bg-background max-w-2xl rounded-lg border px-4 py-3 leading-7">
          {reaction.speech}
        </div>
        <MessageFooter className="max-w-2xl items-start leading-5">
          行动:{reaction.action} · 影响:{reaction.impact}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}

function DirectorNarrationMessage({
  title,
  narration,
  deltas,
}: {
  title: string;
  narration: string;
  deltas: MetricDeltas | null;
}) {
  return (
    <Message>
      <MessageAvatar className="bg-primary text-primary-foreground size-8">
        <GitBranch className="size-4" />
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>{title}</MessageHeader>
        <div className="bg-muted max-w-2xl rounded-lg px-4 py-3 leading-7">{narration}</div>
        {deltas ? (
          <MessageFooter className="max-w-2xl items-start leading-5">
            {metricKeys
              .map((key) => {
                const delta = deltas[key];
                if (delta === 0) return null;
                return `${metricLabels[key]}${delta > 0 ? `+${delta}` : delta}`;
              })
              .filter(Boolean)
              .join(" · ") || "四维指标持平"}
          </MessageFooter>
        ) : null}
      </MessageContent>
    </Message>
  );
}

function WorldCouncil({ initial, worldId, onBack }: WorldCouncilProps) {
  const router = useRouter();
  const cast: WorldCast = initial.cast;
  const player = cast.playerCharacters.find((character) => character.id === initial.playerId);

  const [round, setRound] = useState(initial.round);
  const [metrics, setMetrics] = useState<WorldMetrics>(initial.metrics);
  const [turns, setTurns] = useState<WorldGameSession["turns"]>(initial.turns);
  const [ending, setEnding] = useState<WorldEnding | null>(initial.ending);

  const [submittedDecision, setSubmittedDecision] = useState("");
  // 开场片头只在新开对局播一次：中途刷新、下一回合不再重播。
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
          <Button render={<Link href={`/world/${encodeURIComponent(worldId)}`} />}>
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
  // 守卫之后收窄为非空别名,供闭包与 JSX 使用(tsgolint 不跟踪闭包内的收窄)
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

  // 回合开始时生成处境与四个选项;已结算/已提交/已生成时不再请求。
  // 注意:守卫条件里不能放 isGeneratingOptions -- dev 下 StrictMode 会把 effect 跑两遍,
  // 第一遍 setIsGeneratingOptions(true) 后 cleanup 取消请求,第二遍会被守卫拦住,
  // 而被取消的请求又永远不会把 flag 置回 false,骨架屏就一直转下去了。
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
        const message = `${result.error}${result.detail ? `：${result.detail}` : ""}（可重试，不会丢失进度）`;
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

  async function runJudge(judgeDecision: string, collected: TurnReactionRecord[]) {
    pendingJudgeRef.current = { decision: judgeDecision, collected };
    setIsJudging(true);
    setJudgeError("");

    const result = await judgeTurnAction({
      cast,
      playerId: activePlayer.id,
      metrics,
      round,
      decision: judgeDecision,
      reactions: collected,
      history: turns,
    });

    setIsJudging(false);
    if (!result.ok) {
      const message = `${result.error}${result.detail ? `：${result.detail}` : ""}（可重试，不会丢失本回合回应）`;
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
        narration: judged.narration,
        deltas: judged.deltas,
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
    if (pending) void runJudge(pending.decision, pending.collected);
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

      async function pump(): Promise<void> {
        const { done, value } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) applyLine(line);
        await pump();
      }

      await pump();

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
    await runJudge(content, collected);
  }

  const choiceDisabled = isResolving || isJudging || isTurnComplete || ended;
  const canCloseVoluntarily =
    !ended && isTurnComplete && round >= MIN_ROUND_TO_CLOSE && round < MAX_ROUNDS;

  return (
    <div className="space-y-4">
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
        <Card className="order-2 shadow-none lg:order-1">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-4" />
              议事席位
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <HoverCard>
              <HoverCardTrigger render={<Item variant="muted" className="hover:bg-muted" />}>
                <ItemMedia>
                  <Avatar>
                    <AvatarFallback>{activePlayer.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>{activePlayer.name}</ItemTitle>
                  <p className="text-muted-foreground truncate text-xs">{activePlayer.identity}</p>
                </ItemContent>
                <ItemActions>
                  <Badge variant="outline" className="px-1.5">
                    由你扮演
                  </Badge>
                </ItemActions>
              </HoverCardTrigger>
              <HoverCardContent side="right" align="start" className="w-72">
                <div className="space-y-2">
                  <div>
                    <p className="font-medium">{activePlayer.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {activePlayer.identity} · {activePlayer.faction}
                    </p>
                  </div>
                  <p className="text-xs leading-5">{activePlayer.personality}</p>
                  <div>
                    <p className="text-muted-foreground text-xs">公开目标</p>
                    <p className="text-xs leading-5">{activePlayer.publicGoal}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">可调动资源</p>
                    <p className="text-xs leading-5">{activePlayer.decisionPower}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">你的秘密</p>
                    <p className="text-xs leading-5">{activePlayer.secret}</p>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>

            <Separator />

            <ItemGroup className="gap-1">
              {cast.agentCharacters.map((character) => (
                <HoverCard key={character.id}>
                  <HoverCardTrigger render={<Item size="xs" className="hover:bg-muted" />}>
                    <ItemMedia>
                      <Avatar size="sm">
                        <AvatarFallback>{character.name.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle>{character.name}</ItemTitle>
                      <p className="text-muted-foreground truncate text-xs">{character.faction}</p>
                    </ItemContent>
                    <ItemActions>
                      <span
                        className={
                          agentStatuses[character.id] === "done"
                            ? "size-2 rounded-full bg-emerald-500"
                            : agentStatuses[character.id] === "thinking"
                              ? "size-2 animate-pulse rounded-full bg-amber-500"
                              : agentStatuses[character.id] === "error"
                                ? "bg-destructive size-2 rounded-full"
                                : "bg-muted-foreground/30 size-2 rounded-full"
                        }
                        aria-label={
                          agentStatuses[character.id] === "done"
                            ? "已回应"
                            : agentStatuses[character.id] === "thinking"
                              ? "思考中"
                              : agentStatuses[character.id] === "error"
                                ? "回应失败"
                                : "等待中"
                        }
                      />
                    </ItemActions>
                  </HoverCardTrigger>
                  <HoverCardContent side="right" align="start" className="w-72">
                    <div className="space-y-2">
                      <div>
                        <p className="font-medium">{character.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {character.identity} · {character.faction}
                        </p>
                      </div>
                      <p className="text-xs leading-5">{character.personality}</p>
                      <div>
                        <p className="text-muted-foreground text-xs">公开诉求</p>
                        <p className="text-xs leading-5">{character.publicGoal}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">施压手段</p>
                        <p className="text-xs leading-5">{character.pressureMethod}</p>
                      </div>
                      <blockquote className="text-muted-foreground border-l pl-2 text-xs leading-5">
                        “{character.openingLine}”
                      </blockquote>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>

        <Card className="order-1 min-w-0 shadow-none lg:order-2">
          <CardContent className="p-0">
            <MessageScrollerProvider>
              <MessageScroller className="h-128">
                <MessageScrollerViewport>
                  <MessageScrollerContent className="p-5 sm:p-6">
                    <MessageScrollerItem>
                      <Message>
                        <MessageAvatar className="bg-primary text-primary-foreground size-8">
                          <GitBranch className="size-4" />
                        </MessageAvatar>
                        <MessageContent>
                          <MessageHeader>世界线导演</MessageHeader>
                          <div className="bg-muted max-w-2xl rounded-lg px-4 py-3 leading-7">
                            {cast.setting.opening}
                          </div>
                          <MessageFooter>事件公布</MessageFooter>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>

                    {cast.agentCharacters.map((character, index) => (
                      <MessageScrollerItem key={character.id}>
                        <Message>
                          <MessageAvatar className="size-8">
                            {character.name.slice(0, 1)}
                          </MessageAvatar>
                          <MessageContent>
                            <MessageHeader className="gap-2">
                              <span>{character.name}</span>
                              <span className="font-normal">{character.identity}</span>
                            </MessageHeader>
                            <div className="border-border bg-background max-w-2xl rounded-lg border px-4 py-3 leading-7">
                              {character.openingLine}
                            </div>
                            <MessageFooter>{index < 2 ? "公开表态" : "旁听发言"}</MessageFooter>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ))}

                    {turns.map((turn) => (
                      <Fragment key={`turn-${turn.round}`}>
                        <MessageScrollerItem>
                          <PlayerDecisionMessage
                            playerName={activePlayer.name}
                            decision={turn.decision}
                            roundLabel={`第 ${turn.round} 回合`}
                          />
                        </MessageScrollerItem>
                        {turn.reactions.map(({ agentId, reaction }) => {
                          const character = cast.agentCharacters.find(
                            (candidate) => candidate.id === agentId,
                          );
                          if (!character) return null;
                          return (
                            <MessageScrollerItem key={`turn-${turn.round}-reaction-${agentId}`}>
                              <ReactionMessage characterName={character.name} reaction={reaction} />
                            </MessageScrollerItem>
                          );
                        })}
                        <MessageScrollerItem>
                          <DirectorNarrationMessage
                            title={`世界线导演 · 第 ${turn.round} 回合裁决`}
                            narration={turn.narration}
                            deltas={turn.deltas}
                          />
                        </MessageScrollerItem>
                      </Fragment>
                    ))}

                    {!currentTurnSettled && submittedDecision ? (
                      <MessageScrollerItem scrollAnchor>
                        <PlayerDecisionMessage
                          playerName={activePlayer.name}
                          decision={submittedDecision}
                        />
                      </MessageScrollerItem>
                    ) : null}

                    {!currentTurnSettled
                      ? reactions.map(({ agentId, reaction }) => {
                          const character = cast.agentCharacters.find(
                            (candidate) => candidate.id === agentId,
                          );
                          if (!character) return null;

                          return (
                            <MessageScrollerItem key={`reaction-${agentId}`} scrollAnchor>
                              <ReactionMessage characterName={character.name} reaction={reaction} />
                            </MessageScrollerItem>
                          );
                        })
                      : null}

                    {ended && ending ? (
                      <MessageScrollerItem scrollAnchor>
                        <Message>
                          <MessageAvatar className="size-8 bg-emerald-100 text-emerald-700">
                            <Flag className="size-4" />
                          </MessageAvatar>
                          <MessageContent>
                            <MessageHeader>世界线终局 · {endingLabels[ending.type]}</MessageHeader>
                            <div className="bg-muted max-w-2xl rounded-lg px-4 py-3 leading-7">
                              <p className="font-medium">{ending.title}</p>
                              <p className="text-muted-foreground mt-1 text-sm leading-6">
                                {ending.reason}
                              </p>
                            </div>
                            <MessageFooter>
                              <Button type="button" size="sm" onClick={goFinale}>
                                <ScrollText data-icon="inline-start" />
                                查看终章结算
                              </Button>
                            </MessageFooter>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ) : null}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>

            <div className="border-t p-4 sm:p-5">
              {!ended && !currentTurnSettled && !submittedDecision ? (
                <div aria-live="polite">
                  {isGeneratingOptions ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[0, 1, 2, 3].map((index) => (
                        <Skeleton key={index} className="h-24" />
                      ))}
                    </div>
                  ) : null}
                  {optionsError ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-destructive text-xs" role="alert">
                        {optionsError}
                      </p>
                      <Button type="button" variant="outline" size="sm" onClick={retryOptions}>
                        重试生成选项
                      </Button>
                    </div>
                  ) : null}
                  {options && !isGeneratingOptions ? (
                    <div className="space-y-3">
                      <p className="text-sm leading-7">{options.situation}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {options.options.map((option, index) => (
                          <Button
                            key={option.id}
                            type="button"
                            variant="outline"
                            disabled={choiceDisabled}
                            onClick={() => void chooseOption(option)}
                            className="h-auto flex-col items-start gap-1 p-4 text-left"
                          >
                            <span className="flex w-full items-center gap-2">
                              <span className="bg-primary text-primary-foreground grid size-5 shrink-0 place-items-center rounded font-mono text-[11px]">
                                {["A", "B", "C", "D"][index] ?? index + 1}
                              </span>
                              <span className="font-medium">{option.title}</span>
                              <Badge variant="secondary" className="ml-auto shrink-0">
                                {option.risk}
                              </Badge>
                            </span>
                            <span className="text-muted-foreground text-xs leading-5 font-normal whitespace-normal">
                              {option.desc}
                            </span>
                          </Button>
                        ))}
                      </div>
                      <p className="text-muted-foreground text-xs">点选其一即提交,不可更改</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {isResolving ? (
                <div
                  className="text-muted-foreground mt-3 flex items-center gap-2 text-xs"
                  aria-live="polite"
                >
                  <LoaderCircle className="size-3.5 animate-spin" />
                  已收到 {reactions.length} / {cast.agentCharacters.length} 条回应
                </div>
              ) : null}
              {isJudging ? (
                <div
                  className="text-muted-foreground mt-3 flex items-center gap-2 text-xs"
                  aria-live="polite"
                >
                  <LoaderCircle className="size-3.5 animate-spin" />
                  各方表态收齐,正在裁决世界走向……
                </div>
              ) : null}
              {judgeError ? (
                <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
                  <p className="text-destructive text-xs" role="alert">
                    {judgeError}
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={retryJudge}>
                    重试裁决
                  </Button>
                </div>
              ) : null}
              {isTurnComplete && !ended && !isJudging && !judgeError ? (
                <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
                  <div className="flex items-center gap-2 text-xs text-emerald-700">
                    <Check className="size-3.5" />
                    本回合已裁决
                    {round >= MAX_ROUNDS ? "" : `(已演 ${turns.length} / ${MAX_ROUNDS} 回合)`}
                  </div>
                  {round < MAX_ROUNDS ? (
                    <Button type="button" variant="outline" size="sm" onClick={startNextRound}>
                      开始下一回合
                    </Button>
                  ) : null}
                  {canCloseVoluntarily ? (
                    <Button type="button" variant="ghost" size="sm" onClick={closeVoluntarily}>
                      <Flag data-icon="inline-start" />
                      收束世界线
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {ended ? (
                <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
                  <Button type="button" size="sm" onClick={goFinale}>
                    <ScrollText data-icon="inline-start" />
                    查看终章结算
                  </Button>
                </div>
              ) : null}
              {turnError ? (
                <p className="text-destructive mt-3 text-xs" role="alert">
                  {turnError}(可直接重选其一重试)
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="order-3 shadow-none">
          <Tabs defaultValue="world">
            <CardHeader className="border-b">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="world">
                  <Activity data-icon="inline-start" />
                  世界状态
                </TabsTrigger>
                <TabsTrigger value="round">
                  <GitBranch data-icon="inline-start" />
                  回合进程
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="world" className="space-y-6">
                {metricKeys.map((key) => {
                  const delta = lastDeltas?.[key] ?? 0;
                  const showDelta = turns.length > 0 && delta !== 0;
                  return (
                    <Progress key={key} value={metrics[key]}>
                      <ProgressLabel>{metricLabels[key]}</ProgressLabel>
                      <ProgressValue>
                        {() => (
                          <>
                            {metrics[key]}
                            {showDelta ? (
                              <span
                                className={
                                  delta > 0 ? "ml-1 text-emerald-600" : "text-destructive ml-1"
                                }
                              >
                                {delta > 0 ? `+${delta}` : delta}
                              </span>
                            ) : null}
                          </>
                        )}
                      </ProgressValue>
                    </Progress>
                  );
                })}
                <Separator />
                <div>
                  <p className="text-muted-foreground text-xs">当前身份</p>
                  <p className="mt-1 font-medium">{activePlayer.identity}</p>
                  <p className="text-muted-foreground mt-2 text-xs leading-5">
                    {activePlayer.decisionPower}
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="round">
                <ol className="space-y-5 text-sm">
                  <li className="flex gap-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                      <Check className="size-3.5" />
                    </span>
                    <div>
                      <p className="font-medium">事件公布</p>
                      <p className="text-muted-foreground mt-1 text-xs">危机进入所有角色视野</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span
                      className={
                        submittedDecision || currentTurnSettled
                          ? "grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"
                          : "bg-primary text-primary-foreground grid size-6 shrink-0 place-items-center rounded-full font-mono text-xs"
                      }
                    >
                      {submittedDecision || currentTurnSettled ? <Check className="size-3.5" /> : 2}
                    </span>
                    <div>
                      <p className="font-medium">玩家决策</p>
                      <p className="text-muted-foreground mt-1 text-xs">从四个选项中做出抉择</p>
                    </div>
                  </li>
                  {[
                    { label: "Agent 行动", done: reactions.length > 0 || currentTurnSettled },
                    { label: "冲突裁决", done: isTurnComplete },
                    { label: "世界更新", done: isTurnComplete },
                  ].map((step, index) => (
                    <li
                      key={step.label}
                      className={step.done ? "flex gap-3" : "text-muted-foreground flex gap-3"}
                    >
                      <span
                        className={
                          step.done
                            ? "grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"
                            : "bg-muted grid size-6 shrink-0 place-items-center rounded-full font-mono text-xs"
                        }
                      >
                        {step.done ? <Check className="size-3.5" /> : index + 3}
                      </span>
                      <p className="pt-0.5">{step.label}</p>
                    </li>
                  ))}
                  <li className="text-muted-foreground flex gap-3">
                    <span className="bg-muted grid size-6 shrink-0 place-items-center rounded-full font-mono text-xs">
                      终
                    </span>
                    <div className="pt-0.5">
                      <p>终章结算({MAX_ROUNDS} 回合或提前终局)</p>
                      <p className="mt-1 text-xs">
                        已演 {turns.length} / {MAX_ROUNDS} 回合
                      </p>
                    </div>
                  </li>
                </ol>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

export function WorldCouncilSession({ worldId }: { worldId: string }) {
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
          <Button render={<Link href={`/world/${encodeURIComponent(worldId)}`} />}>
            返回世界线
            <ArrowLeft data-icon="inline-end" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <WorldCouncil initial={session} worldId={worldId} onBack={() => router.back()} />;
}

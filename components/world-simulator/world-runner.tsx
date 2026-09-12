"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { WorldSimulator } from "@/components/world-simulator";
import { SeedStage } from "@/components/world-simulator/seed-stage";
import type { DeckStage, DeckSummary } from "@/components/world-simulator/world-deck";
import { errorEnvelopeSchema, userErrorMessage } from "@/lib/app-error";
import { readNdjsonStream } from "@/lib/ndjson-stream";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import {
  dealHand,
  hasSettled,
  metricDeltas,
  originCard,
  PICKS_PER_HAND,
  settleCard,
  type WorldCard,
} from "@/lib/world-cards";
import type {
  CounterfactualPremise,
  EventChoice,
  GlobalMetric,
  HardRule,
  PlayerDirective,
  TimeScale,
  TimeState,
  WorldEntity,
  WorldSeed,
  WorldSimSession,
  WitnessLine,
} from "@/lib/world-sim";
import { worldSeedEventSchema, worldSimulateEventSchema } from "@/lib/world-sim-events";
import { createSession } from "@/lib/world-sim-reducer";
import {
  clearWorldSimSession,
  loadWorldSimSession,
  saveWorldSimSession,
} from "@/lib/world-sim-storage";

/**
 * 世界线牌局的运行时。
 *
 * 这是"世界模型"与"牌桌界面"之间唯一的胶水层。
 *
 * v4 的核心变化是**盲抽**:每次推进,世界发 5 张背面朝上的牌,
 * 玩家只能翻开一张、做一次取舍。没翻到的牌不是不存在 ——
 * 它们照样发生了,只是你没能盯住它们。这就是"观察者"设定的游戏化:
 * 你的注意力是稀缺资源,而稀有度是抽卡的赌注。
 *
 * 状态机:
 *   origin  原点卡正面朝上 → 拉开世界线
 *   pick    一批背面朝上   → 翻一张
 *   open    翻开了         → 做取舍(或"收下"一张白卡)
 *   closed  阶段收束       → 推进时间
 *   empty   从存档恢复     → 推进时间
 *
 * 存档恢复时**不重发牌**:手牌的光标没有持久化,重发会让已经做过的取舍被再做一次。
 */

/** 翻牌动画的时长。和 globals.css 里的 card-flip 保持一致 */
const FLIP_MS = 480;

interface SeedProgressState {
  phase: "connecting" | "building" | "error";
  witness: WitnessLine | null;
  premise: CounterfactualPremise | null;
  startTime: TimeState | null;
  timeScale: TimeScale | null;
  hardRules: HardRule[];
  entities: WorldEntity[];
  globalMetrics: GlobalMetric[];
  error: string;
}

const EMPTY_SEED_PROGRESS: SeedProgressState = {
  phase: "connecting",
  witness: null,
  premise: null,
  startTime: null,
  timeScale: null,
  hardRules: [],
  entities: [],
  globalMetrics: [],
  error: "",
};

/** 推进过程中的实时进度。牌局界面里只在底部指标条上占一行 */
interface AdvanceProgress {
  phase: "idle" | "entities" | "adjudicating";
  startedIds: string[];
  /** 已上报的主体意图,供"世界演算中"面板逐条亮出 */
  intents: { entityId: string; intent: string }[];
  /** 裁决阶段流出的世界事件,供"世界演算中"面板滚动展示 */
  worldEvents: string[];
  reports: number;
  errors: string[];
}

const IDLE_ADVANCE: AdvanceProgress = {
  phase: "idle",
  startedIds: [],
  intents: [],
  worldEvents: [],
  reports: 0,
  errors: [],
};

/** 阶段结算。收束与空桌状态共用 */
function summaryFor(session: WorldSimSession): DeckSummary | null {
  const snapshot = session.snapshots.at(-1);
  if (!snapshot) return null;
  return {
    era: snapshot.era,
    conclusion: snapshot.conclusion,
    deltas: metricDeltas(session.state.globalMetrics, snapshot.metricDeltas),
  };
}

/** 见证者此刻该说什么 */
function witnessLineFor(
  session: WorldSimSession,
  stage: DeckStage,
  picked: WorldCard | null,
  busy: boolean,
  pickedCount: number,
): WitnessLine | null {
  const name = session.seed.witness.name;

  if (busy) {
    return { speaker: name, line: "别催。这个世界要自己走完这一步,谁也快不了它。" };
  }
  if (stage === "pick") {
    return pickedCount === 0
      ? {
          speaker: name,
          line: "牌都扣着呢,你能盯住两张。先挑一张 —— 手气也是历史的一部分。",
        }
      : {
          speaker: name,
          line: "还能再翻一张。剩下的这一次,挑你最放不下的。",
        };
  }
  if (stage === "closed") {
    return { speaker: name, line: "这一阶段就到这儿。要接着往下走,就得放手让它自己走。" };
  }
  if (picked?.narrator) return picked.narrator;
  if (stage === "empty") {
    return { speaker: name, line: "回来得正好。上一阶段的事我都替你记着呢。" };
  }
  return { speaker: name, line: session.seed.witness.openingLine };
}

export function WorldRunner({
  scenarioId,
  scenarioTitle,
  themeId,
  themeName,
  skin,
}: {
  scenarioId: string;
  scenarioTitle: string;
  themeId: string;
  themeName: string;
  skin: ScenarioSkin;
}) {
  const router = useRouter();
  const [session, setSession] = useState<WorldSimSession | null>(null);
  const [seedProgress, setSeedProgress] = useState<SeedProgressState>(EMPTY_SEED_PROGRESS);
  const [hand, setHand] = useState<WorldCard[]>([]);
  const [stage, setStage] = useState<DeckStage>("empty");
  const [pickedIds, setPickedIds] = useState<string[]>([]);
  /** 当前正面朝上、正在做取舍的那张牌 */
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [flippingId, setFlippingId] = useState<string | null>(null);
  const [resolvedChoiceId, setResolvedChoiceId] = useState<string | null>(null);
  /** 已经做完取舍的牌。满了 PICKS_PER_HAND 张,阶段才收束 */
  const [settledIds, setSettledIds] = useState<string[]>([]);
  const [directives, setDirectives] = useState<PlayerDirective[]>([]);
  const [pendingFork, setPendingFork] = useState<{ forkId: string; alternativeId: string } | null>(
    null,
  );
  const [advance, setAdvance] = useState<AdvanceProgress>(IDLE_ADVANCE);
  const [followedEntityId, setFollowedEntityId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  // 防止严格模式下 useEffect 跑两次发出两条种子流
  const seedStarted = useRef(false);
  // 推进中的存档写入要靠当前会话,用 ref 避开闭包过期
  const sessionRef = useRef<WorldSimSession | null>(null);
  sessionRef.current = session;

  const busy = advance.phase !== "idle";
  const busyRef = useRef(busy);
  busyRef.current = busy;

  // ==================== 首次进入:读存档或构建世界 ====================

  const buildWorld = useCallback(async () => {
    setSeedProgress({ ...EMPTY_SEED_PROGRESS, phase: "connecting" });

    try {
      const response = await fetch("/api/world-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, title: scenarioTitle, themeId }),
      });

      if (!response.ok) {
        let message = `世界构建请求失败(${response.status})`;
        try {
          const parsed = errorEnvelopeSchema.safeParse(await response.json());
          if (parsed.success) message = userErrorMessage(parsed.data.error);
        } catch {
          // 保留状态码兜底
        }
        throw new Error(message);
      }

      let built: WorldSeed | null = null;

      await readNdjsonStream(response, worldSeedEventSchema, (event) => {
        switch (event.type) {
          case "seed-start":
            setSeedProgress((prev) => ({ ...prev, phase: "building" }));
            break;
          case "seed-witness":
            setSeedProgress((prev) => ({
              ...prev,
              phase: "building",
              witness: { speaker: event.witness.name, line: event.witness.openingLine },
            }));
            break;
          case "seed-setting":
            setSeedProgress((prev) => ({
              ...prev,
              phase: "building",
              premise: event.premise,
              startTime: event.startTime,
              timeScale: event.timeScale,
            }));
            break;
          case "seed-rules":
            setSeedProgress((prev) => ({ ...prev, hardRules: event.hardRules }));
            break;
          case "entity":
            setSeedProgress((prev) => ({ ...prev, entities: [...prev.entities, event.entity] }));
            break;
          case "seed-metrics":
            setSeedProgress((prev) => ({ ...prev, globalMetrics: event.globalMetrics }));
            break;
          case "seed-complete":
            built = event.seed;
            break;
          case "entity-start":
          case "seed-events":
            break;
          case "error":
            throw new Error(userErrorMessage(event.error));
        }
      });

      if (!built) throw new Error("世界构建流没有返回完整种子");

      const next = createSession(built);
      const origin = originCard(next.seed);
      setSession(next);
      setHand([origin]);
      setStage("origin");
      // 原点卡是唯一一张开局就正面朝上的牌:activeCardId 必须钉死,
      // 否则牌桌的 (origin|open) && picked 判据落空,整张牌根本不渲染。
      setPickedIds([origin.id]);
      setActiveCardId(origin.id);
      setFlippingId(null);
      setResolvedChoiceId(null);
      setSettledIds([origin.id]);
      setDirectives([]);
      setPendingFork(null);
      saveWorldSimSession(scenarioId, next);
      setNotice("世界已经搭好。原点卡就摆在桌上 —— 拉开它,这条世界线才会开始走。");
    } catch (error) {
      console.error("世界构建失败", error);
      setSeedProgress((prev) => ({
        ...prev,
        phase: "error",
        error: error instanceof Error ? error.message : "世界构建失败",
      }));
    }
  }, [scenarioId, scenarioTitle, themeId]);

  useEffect(() => {
    if (seedStarted.current) return;
    seedStarted.current = true;

    const stored = loadWorldSimSession(scenarioId);
    if (stored) {
      setSession(stored.session);
      // 恢复时不重发牌:直接给上一阶段的结算,避免已有的取舍被重做一次
      setHand([]);
      setStage("empty");
      setPickedIds([]);
      setActiveCardId(null);
      setFlippingId(null);
      setResolvedChoiceId(null);
      setSettledIds([]);
      setDirectives([]);
      setPendingFork(null);
      setFollowedEntityId(
        stored.session.state.entities.find((entity) => entity.changedThisEra)?.id ??
          stored.session.state.entities[0]?.id ??
          null,
      );
      setNotice(
        `已从本地存档恢复(${new Date(stored.savedAt).toLocaleString("zh-CN", { hour12: false })})`,
      );
      return;
    }

    void buildWorld();
  }, [buildWorld, scenarioId]);

  // ==================== 推进一个时代 ====================

  const advanceEra = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || busyRef.current) return;

    setNotice("");
    setAdvance({
      phase: "entities",
      startedIds: [],
      intents: [],
      worldEvents: [],
      reports: 0,
      errors: [],
    });

    try {
      const response = await fetch("/api/world-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session: current,
          ...(followedEntityId ? { followedEntityId } : {}),
          ...(pendingFork ? { forkChoice: pendingFork } : {}),
          ...(directives.length ? { directives } : {}),
        }),
      });

      if (!response.ok) {
        let message = `推演请求失败(${response.status})`;
        try {
          const parsed = errorEnvelopeSchema.safeParse(await response.json());
          if (parsed.success) message = userErrorMessage(parsed.data.error);
        } catch {
          // 保留状态码兜底
        }
        throw new Error(message);
      }

      let finished: WorldSimSession | null = null;
      let streamError = "";

      await readNdjsonStream(response, worldSimulateEventSchema, (event) => {
        switch (event.type) {
          case "entity-start":
            setAdvance((prev) => ({
              ...prev,
              phase: "entities",
              startedIds: [...prev.startedIds, event.entityId],
            }));
            break;
          case "entity-report":
            setAdvance((prev) => ({
              ...prev,
              reports: prev.reports + 1,
              intents: [
                ...prev.intents,
                { entityId: event.report.entityId, intent: event.report.intent },
              ],
            }));
            break;
          case "entity-error":
            setAdvance((prev) => ({
              ...prev,
              errors: [...prev.errors, event.error.message],
            }));
            break;
          case "adjudicating":
            setAdvance((prev) => ({ ...prev, phase: "adjudicating" }));
            break;
          case "world-event":
            setAdvance((prev) => ({
              ...prev,
              worldEvents: [...prev.worldEvents, event.event.summary],
            }));
            break;
          case "complete":
            finished = event.session;
            break;
          case "error":
            streamError = userErrorMessage(event.error);
            break;
          case "simulation-start":
          case "fork-detected":
          case "snapshot":
          case "state":
            break;
        }
      });

      if (!finished) throw new Error(streamError || "推演流没有返回完整会话");

      const next: WorldSimSession = finished;
      setSession(next);
      setPickedIds([]);
      setActiveCardId(null);
      setFlippingId(null);
      setResolvedChoiceId(null);
      setSettledIds([]);
      setDirectives([]);
      setPendingFork(null);
      setAdvance(IDLE_ADVANCE);
      saveWorldSimSession(scenarioId, next);

      // 世界收敛了就不再盲抽:结算卡正面朝上,它不是赌注,是出口
      if (hasSettled(next)) {
        const settle = settleCard(next);
        setHand([settle]);
        setPickedIds([settle.id]);
        setActiveCardId(settle.id);
        setSettledIds([settle.id]);
        setStage("open");
        setNotice("这个世界的故事讲完了。结算卡已经翻开。");
        return;
      }

      const latest = next.snapshots.at(-1);
      setHand(dealHand({ session: next, snapshot: latest!, fork: null }));
      setStage("pick");
      setNotice(
        `世界又往前走了一段(${latest?.spanLabel ?? ""}),发出了 ${next.snapshots.at(-1)?.events.length ?? 0} 张牌。你能翻开其中 ${PICKS_PER_HAND} 张。`,
      );
    } catch (error) {
      console.error("时代推演失败", error);
      setAdvance(IDLE_ADVANCE);
      setNotice(error instanceof Error ? error.message : "时代推演失败,请重试");
    }
  }, [directives, followedEntityId, pendingFork, scenarioId]);

  // ==================== 盲抽与取舍 ====================

  /** 翻牌:先播半圈动画,再让正面出现 —— 那半秒是整个玩法的心跳 */
  const pick = useCallback(
    (card: WorldCard) => {
      if (stage !== "pick" || busy || flippingId) return;
      if (pickedIds.includes(card.id) || pickedIds.length >= PICKS_PER_HAND) return;
      setFlippingId(card.id);
      setTimeout(() => {
        setFlippingId(null);
        setActiveCardId(card.id);
        setPickedIds((prev) => [...prev, card.id]);
        setResolvedChoiceId(null);
        setStage("open");
      }, FLIP_MS);
    },
    [busy, flippingId, pickedIds, stage],
  );

  /**
   * 结掉一张牌的取舍。
   *
   * 还差一张没翻、且手上仍有没翻的牌时,回 pick 继续挑第二张;
   * 否则本阶段收束。分叉是阶段的终结者,选完直接收束。
   */
  const finalizeCard = useCallback(
    (card: WorldCard, choice: EventChoice | null) => {
      if (choice) setResolvedChoiceId(choice.id);

      const fork = card.kind === "fork" ? card.fork : null;
      if (fork && choice) {
        setPendingFork({ forkId: fork.id, alternativeId: choice.id });
        setStage("closed");
        return;
      }

      if (choice) {
        setDirectives((prev) => [
          ...prev,
          {
            cardId: card.id,
            cardTitle: card.title,
            choiceId: choice.id,
            choiceLabel: choice.label,
            note: choice.hint,
          },
        ]);
      }

      const nextSettled = [...settledIds, card.id];
      setSettledIds(nextSettled);
      const remaining = hand.filter((item) => !pickedIds.includes(item.id));
      setStage(nextSettled.length < PICKS_PER_HAND && remaining.length > 0 ? "pick" : "closed");
    },
    [hand, pickedIds, settledIds],
  );

  /** 在翻开的牌上做取舍。这是本阶段唯一的一次 */
  const choose = useCallback(
    (card: WorldCard, choice: EventChoice) => {
      if (stage !== "open" || busy) return;
      finalizeCard(card, choice);
    },
    [busy, finalizeCard, stage],
  );

  /** 收下一张没有取舍的白卡:读完,合上,继续挑下一张 */
  const closeCard = useCallback(() => {
    if (stage !== "open") return;
    const card = hand.find((item) => item.id === activeCardId);
    if (!card) return;
    finalizeCard(card, null);
  }, [activeCardId, finalizeCard, hand, stage]);

  const resetSession = useCallback(() => {
    clearWorldSimSession(scenarioId);
    setSession(null);
    setHand([]);
    setStage("empty");
    setPickedIds([]);
    setActiveCardId(null);
    setFlippingId(null);
    setResolvedChoiceId(null);
    setSettledIds([]);
    setDirectives([]);
    setPendingFork(null);
    setAdvance(IDLE_ADVANCE);
    setFollowedEntityId(null);
    setNotice("");
    void buildWorld();
  }, [buildWorld, scenarioId]);

  // ==================== 渲染 ====================

  if (!session) {
    return (
      <SeedStage
        skin={skin}
        themeName={themeName}
        themeId={themeId}
        phase={seedProgress.phase}
        witness={seedProgress.witness}
        premise={seedProgress.premise}
        startTime={seedProgress.startTime}
        timeScale={seedProgress.timeScale}
        hardRules={seedProgress.hardRules}
        entities={seedProgress.entities}
        globalMetrics={seedProgress.globalMetrics}
        error={seedProgress.error}
        onRetry={() => void buildWorld()}
      />
    );
  }

  const picked = hand.find((card) => card.id === activeCardId) ?? null;
  // origin 也算可推进:原点卡上的按钮是主出口,底部按钮是同一出口的兜底。
  // 两个出口指向同一个动作,不会制造分叉 —— 但卡片万一没渲染出来,局面不会死。
  const canAdvance = (stage === "origin" || stage === "closed" || stage === "empty") && !busy;
  const total = session.state.entities.length;
  const done = advance.reports + advance.errors.length;

  return (
    <WorldSimulator
      session={session}
      skin={skin}
      hand={hand}
      stage={stage}
      pickedIds={pickedIds}
      activeCardId={activeCardId}
      flippingId={flippingId}
      resolvedChoiceId={resolvedChoiceId}
      simView={
        busy
          ? {
              phase: advance.phase,
              startedIds: advance.startedIds,
              intents: advance.intents,
              worldEvents: advance.worldEvents,
              errors: advance.errors,
            }
          : null
      }
      played={directives.map((item) => ({
        label: item.choiceLabel,
        tier: (hand.find((card) => card.id === item.cardId)?.tier ?? "white") as WorldCard["tier"],
      }))}
      summary={stage === "closed" || stage === "empty" ? summaryFor(session) : null}
      witnessLine={witnessLineFor(session, stage, picked, busy, pickedIds.length)}
      onPick={pick}
      onChoose={(choice) => {
        if (picked) choose(picked, choice);
      }}
      onCardClose={closeCard}
      onAdvance={() => void advanceEra()}
      advanceLabel={
        busy
          ? "世界正在自己往前走"
          : stage === "origin"
            ? "先拉开这条世界线"
            : stage === "pick"
              ? pickedIds.length === 0
                ? "先翻开两张牌"
                : "再翻开一张牌"
              : stage === "open"
                ? "先做完这张牌的取舍"
                : `推进时间 · 纪元 ${session.state.currentEra + 1}`
      }
      advanceDisabled={!canAdvance}
      progress={
        busy
          ? {
              label:
                advance.phase === "adjudicating"
                  ? "历史正在合并这些冲突"
                  : `${done}/${total} 个主体已经各自盘算完`,
              done: advance.phase === "adjudicating" ? total : done,
              total,
            }
          : null
      }
      busy={busy}
      followedEntityId={followedEntityId}
      onFocus={setFollowedEntityId}
      notice={notice}
      onBack={() => router.back()}
      onReset={resetSession}
    />
  );
}

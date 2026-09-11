"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { WorldSimulator } from "@/components/world-simulator";
import { SeedStage } from "@/components/world-simulator/seed-stage";
import type { DeckSummary } from "@/components/world-simulator/world-deck";
import { errorEnvelopeSchema, userErrorMessage } from "@/lib/app-error";
import { readNdjsonStream } from "@/lib/ndjson-stream";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import {
  eraCards,
  hasSettled,
  metricDeltas,
  originCard,
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
 * 这是"世界模型"与"牌桌界面"之间唯一的胶水层:所有会话状态、存档、
 * 两条流式接口、手牌的发放与光标推进都在这里。下面的 WorldSimulator 只是壳。
 *
 * 三条数据通路:
 *   1. 首次进入   没有存档 -> POST /api/world-seed,见证者先出场,世界再从他身后长出来
 *   2. 推进时代   有存档 -> POST /api/world-simulate,主体报告逐个回来,最后裁决成手牌
 *   3. 取舍       玩家在事件卡上做的选择 -> 攒进 directives,下一次推进时作为条件送给裁决器
 *
 * 存档每次 complete 都写一次 localStorage。
 *
 * 一个刻意的取舍:从存档恢复时**不重新发牌**,直接让玩家看到上一阶段的结算。
 * 原因是手牌的光标没有持久化,重发一遍会让已经做过的取舍被再做一次 ——
 * 宁可少看一遍牌,也不要让"我明明选过了"这种事发生。
 */

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

/** 推进过程中的实时进度。卡牌界面里只在底部指标条上占一行 */
interface AdvanceProgress {
  phase: "idle" | "entities" | "adjudicating";
  startedIds: string[];
  reports: number;
  errors: string[];
}

const IDLE_ADVANCE: AdvanceProgress = {
  phase: "idle",
  startedIds: [],
  reports: 0,
  errors: [],
};

/** 阶段结算。空桌状态下展示,也是"不打小结卡"的替代方案 */
function summaryFor(session: WorldSimSession): DeckSummary | null {
  const snapshot = session.snapshots.at(-1);
  if (!snapshot) return null;
  return {
    era: snapshot.era,
    conclusion: snapshot.conclusion,
    deltas: metricDeltas(session.state.globalMetrics, snapshot.metricDeltas),
  };
}

/** 发牌:把最近一次裁决投影成本阶段的手牌 */
function dealFor(session: WorldSimSession): WorldCard[] {
  const snapshot = session.snapshots.at(-1);
  if (!snapshot) return [originCard(session.seed)];

  const fork = session.forks.find((item) => !item.selectedAlternativeId) ?? null;
  const cards = eraCards({ session, snapshot, fork });
  // 世界收敛了就补一张结算卡 —— 它是"结算即内容"的入口
  if (hasSettled(session)) cards.push(settleCard(session));
  return cards;
}

/** 见证者此刻该说什么。优先级:推演中 > 卡牌自带 > 空桌 */
function witnessLineFor(
  session: WorldSimSession,
  card: WorldCard | null,
  busy: boolean,
): WitnessLine | null {
  const name = session.seed.witness.name;

  if (busy) {
    return { speaker: name, line: "别催。这个世界要自己走完这一步,谁也快不了它。" };
  }
  if (card?.narrator) return card.narrator;
  if (card) return null;
  if (session.snapshots.length === 0) {
    return { speaker: name, line: session.seed.witness.openingLine };
  }
  return { speaker: name, line: "这一阶段就到这儿。要接着往下走,就得放手让它自己走。" };
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
  const [deck, setDeck] = useState<WorldCard[]>([]);
  const [cursor, setCursor] = useState(0);
  const [resolvedChoiceId, setResolvedChoiceId] = useState<string | null>(null);
  const [played, setPlayed] = useState<{ label: string; severity: WorldCard["severity"] }[]>([]);
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
      setSession(next);
      setDeck([originCard(next.seed)]);
      setCursor(0);
      setResolvedChoiceId(null);
      setPlayed([]);
      setDirectives([]);
      setPendingFork(null);
      saveWorldSimSession(scenarioId, next);
      setNotice("世界已经搭好。原点卡就在桌上 —— 翻开它,这条世界线才会开始走。");
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
      setDeck([]);
      setCursor(0);
      setResolvedChoiceId(null);
      setPlayed([]);
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
    if (!current || busy) return;

    setNotice("");
    setAdvance({ phase: "entities", startedIds: [], reports: 0, errors: [] });

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
            setAdvance((prev) => ({ ...prev, reports: prev.reports + 1 }));
            break;
          case "entity-error":
            setAdvance((prev) => ({ ...prev, errors: [...prev.errors, event.error.message] }));
            break;
          case "adjudicating":
            setAdvance((prev) => ({ ...prev, phase: "adjudicating" }));
            break;
          case "complete":
            finished = event.session;
            break;
          case "error":
            streamError = userErrorMessage(event.error);
            break;
          case "simulation-start":
          case "world-event":
          case "causal-chain":
          case "fork-detected":
          case "snapshot":
          case "state":
            break;
        }
      });

      if (!finished) throw new Error(streamError || "推演流没有返回完整会话");

      const next: WorldSimSession = finished;
      const nextDeck = dealFor(next);

      setSession(next);
      setDeck(nextDeck);
      setCursor(0);
      setResolvedChoiceId(null);
      setPlayed([]);
      setDirectives([]);
      setPendingFork(null);
      setAdvance(IDLE_ADVANCE);
      saveWorldSimSession(scenarioId, next);

      const latest = next.snapshots.at(-1);
      setNotice(
        nextDeck.length > 0
          ? `世界又往前走了一段(${latest?.spanLabel ?? ""})。这一步它发出了 ${nextDeck.length} 张牌。`
          : (latest?.conclusion ?? "这一阶段推进完毕。"),
      );
    } catch (error) {
      console.error("时代推演失败", error);
      setAdvance(IDLE_ADVANCE);
      setNotice(error instanceof Error ? error.message : "时代推演失败,请重试");
    }
  }, [busy, directives, followedEntityId, pendingFork, scenarioId]);

  // ==================== 手牌交互 ====================

  const choose = useCallback((card: WorldCard, choice: EventChoice) => {
    setResolvedChoiceId(choice.id);
    setPlayed((prev) => [...prev, { label: choice.label, severity: card.severity }]);

    if (card.kind === "fork" && card.fork) {
      setPendingFork({ forkId: card.fork.id, alternativeId: choice.id });
      return;
    }

    // 事件卡与见证者之问都产出"取舍"。它不改写已经发生的事,
    // 而是成为下一阶段的既有条件 —— 这是观察者真正拥有的那点权力。
    setDirectives((prev) => [
      ...prev,
      {
        cardId: card.id,
        cardTitle: card.title,
        choiceId: choice.id,
        choiceLabel: choice.label,
        note: card.kind === "attention" ? `观测者把注意力放在:${choice.hint}` : choice.hint,
      },
    ]);
  }, []);

  const nextCard = useCallback(() => {
    setResolvedChoiceId(null);
    setCursor((prev) => prev + 1);
  }, []);

  const resetSession = useCallback(() => {
    clearWorldSimSession(scenarioId);
    setSession(null);
    setDeck([]);
    setCursor(0);
    setResolvedChoiceId(null);
    setPlayed([]);
    setDirectives([]);
    setPendingFork(null);
    setAdvance(IDLE_ADVANCE);
    setFollowedEntityId(null);
    setNotice("");
    void buildWorld();
  }, [buildWorld, scenarioId]);

  const handleCardAction = useCallback(
    (card: WorldCard) => {
      if (card.kind === "origin") {
        void advanceEra();
        return;
      }
      if (card.kind === "settle") {
        resetSession();
        return;
      }
      nextCard();
    },
    [advanceEra, nextCard, resetSession],
  );

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

  const hasCardsLeft = cursor < deck.length;
  const total = session.state.entities.length;
  const done = advance.reports + advance.errors.length;

  return (
    <WorldSimulator
      session={session}
      skin={skin}
      cards={deck}
      cursor={cursor}
      resolvedChoiceId={resolvedChoiceId}
      played={played}
      summary={hasCardsLeft ? null : summaryFor(session)}
      witnessLine={witnessLineFor(session, deck[cursor] ?? null, busy)}
      onChoose={choose}
      onCardAction={handleCardAction}
      onAdvance={() => void advanceEra()}
      advanceLabel={
        busy
          ? "世界正在自己往前走"
          : hasCardsLeft
            ? "先打完手上这几张牌"
            : `推进时间 · 纪元 ${session.state.currentEra + 1}`
      }
      advanceDisabled={busy || hasCardsLeft}
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

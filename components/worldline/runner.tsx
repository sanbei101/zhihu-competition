"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Observatory, type ObservatoryPhase, type ObservatoryView } from "@/components/worldline";
import type { ProclamationData } from "@/components/worldline/proclamation";
import type { ActiveVoice } from "@/components/worldline/stage";
import { errorEnvelopeSchema, userErrorMessage } from "@/lib/app-error";
import { readNdjsonStream } from "@/lib/ndjson-stream";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import {
  witnessArchetypeFor,
  type WorldlineBeing,
  type WorldlineEvent,
  type WorldlinePremise,
  type WorldlineReaction,
  type WorldlineSegment,
  type WorldlineSession,
  type WorldlineVoice,
} from "@/lib/worldline";
import { getEpicQuote, inferMilestoneFromWave } from "@/lib/worldline-epics";
import { worldlineSeedEventSchema, worldlineWaveEventSchema } from "@/lib/worldline-events";
import { applyWave, createSession, eventSegment, reactionSegment } from "@/lib/worldline-reducer";
import { clearWorldline, loadWorldline, saveWorldline } from "@/lib/worldline-storage";

/**
 * 世界线观测台的运行时。
 *
 * 这是"世界模型"与"观测屏界面"之间唯一的胶水层。它只做三件事:
 *   1. 开一个新世界,或者从本地存档接上
 *   2. 向 /api/worldline-wave 要下一波,让五件事一张张落到桌上
 *   3. 玩家按下"看世界的反应"之后,把世界的反应按节拍逐条写进编年史
 *
 * 节拍全部照搬原型:落牌 260ms 一张,反应 1600ms 一条,台词说满 8.6 秒就走。
 * 这些数字不是随手定的 —— 它们决定了这个世界读起来是"在演"还是"在刷"。
 */

/** 落牌节拍。与原型一致:五件事一张张落到桌上,而不是一次蹦出来 */
const DEAL_STEP_MS = 260;
/** 两条反应之间的间隔。留一口气,让玩家读完上一句 */
const REACTION_STEP_MS = 1600;
/** 反应"开口"到"落进编年史"之间那一下停顿 */
const REACTION_SETTLE_MS = 260;
/** 上场到开始淡出 / 完全消失 */
const VOICE_FADE_MS = 8600;
const VOICE_GONE_MS = 9400;
/** 同一组台词里每个人出场的错拍 */
const VOICE_STAGGER_MS = 420;
/** 一波按原型固定五件事。事件还没到齐时,桌上先扣着这么多张 */
const WAVE_SIZE = 5;

interface BootState {
  premise: WorldlinePremise | null;
  scaleLabel: string;
  witnessName: string;
  witnessRole: string;
  beings: WorldlineBeing[];
  opening: WorldlineSegment[];
  error: string;
}

const EMPTY_BOOT: BootState = {
  premise: null,
  scaleLabel: "",
  witnessName: "",
  witnessRole: "",
  beings: [],
  opening: [],
  error: "",
};

export function WorldlineRunner({
  scenarioId,
  scenarioTitle,
  themeId,
  skin,
}: {
  scenarioId: string;
  scenarioTitle: string;
  themeId: string;
  skin: ScenarioSkin;
}) {
  const [session, setSession] = useState<WorldlineSession | null>(null);
  const [boot, setBoot] = useState<BootState>(EMPTY_BOOT);
  const [phase, setPhase] = useState<ObservatoryPhase>("boot");

  /** 已经落到桌上的那几件。它永远是整波的前缀 */
  const [deck, setDeck] = useState<WorldlineEvent[]>([]);
  const [playing, setPlaying] = useState<number | null>(null);
  const [played, setPlayed] = useState<number[]>([]);
  const [reactionDone, setReactionDone] = useState(0);
  const [reactionTotal, setReactionTotal] = useState(0);
  const [reactionsReady, setReactionsReady] = useState(false);

  const [voices, setVoices] = useState<ActiveVoice[]>([]);
  const [litIds, setLitIds] = useState<string[]>([]);
  const [witnessLine, setWitnessLine] = useState("桌上会落五件事。等它们落定,世界才开始动。");
  const [notice, setNotice] = useState("");
  const [proclamation, setProclamation] = useState<ProclamationData | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const seedStarted = useRef(false);
  const timers = useRef<number[]>([]);
  const voiceTimers = useRef<number[]>([]);
  const voiceSeq = useRef(0);

  /** 已经收到、但还没上台的事件。按节拍一张张放出去 */
  const queued = useRef<WorldlineEvent[]>([]);
  const reactionsByEvent = useRef<Record<string, WorldlineReaction[]>>({});
  /** 这一波的全部事件(含还没上台的)。wave-complete 时用它组装会话 */
  const waveAccum = useRef<WorldlineEvent[]>([]);
  const streamStarted = useRef(false);
  const streamDone = useRef(false);
  const dealTimer = useRef<number | null>(null);

  // ==================== 计时器 ====================

  const stopDeal = useCallback(() => {
    if (dealTimer.current !== null) {
      window.clearInterval(dealTimer.current);
      dealTimer.current = null;
    }
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.splice(0).forEach((id) => window.clearTimeout(id));
    stopDeal();
  }, [stopDeal]);

  const clearVoices = useCallback(() => {
    voiceTimers.current.splice(0).forEach((id) => window.clearTimeout(id));
    setVoices([]);
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  /**
   * 让一组人在舞台上开口。
   *
   * 说完就走:气泡飘一会儿就落下去,别把舞台堵死 —— 世界还在往前走,
   * 停留在十秒前那句话上的舞台看起来像卡住了。
   */
  const speak = useCallback((list: readonly WorldlineVoice[]) => {
    voiceTimers.current.splice(0).forEach((id) => window.clearTimeout(id));
    if (!list.length) {
      setVoices([]);
      return;
    }

    const batch = voiceSeq.current;
    voiceSeq.current += 1;
    setVoices(list.map((voice, index) => ({ id: `${batch}-${index}`, voice, leaving: false })));

    list.forEach((_, index) => {
      voiceTimers.current.push(
        window.setTimeout(
          () => {
            setVoices((prev) =>
              prev.map((entry, i) => (i === index ? { ...entry, leaving: true } : entry)),
            );
          },
          VOICE_FADE_MS + index * VOICE_STAGGER_MS,
        ),
      );
      voiceTimers.current.push(
        window.setTimeout(
          () => {
            setVoices((prev) => prev.filter((entry) => entry.id !== `${batch}-${index}`));
          },
          VOICE_GONE_MS + index * VOICE_STAGGER_MS,
        ),
      );
    });
  }, []);

  const appendTimeline = useCallback((segments: WorldlineSegment[]) => {
    setSession((prev) => (prev ? { ...prev, timeline: [...prev.timeline, ...segments] } : prev));
  }, []);

  // ==================== 发一波 ====================

  /**
   * 落牌。
   *
   * 一波五件出自同一次模型调用,它们会在几十毫秒内全部到达。来一张上一张的话
   * 五张会同时蹦出来,原型的节拍感就没了。所以收到的先排队,由这个定时器
   * 按 260ms 放一张上台。
   */
  const startDeal = useCallback(() => {
    if (dealTimer.current !== null) return;
    dealTimer.current = window.setInterval(() => {
      const next = queued.current.shift();
      if (next) {
        setDeck((prev) => [...prev, next]);
        return;
      }
      if (streamDone.current) {
        stopDeal();
        setPhase((prev) => (prev === "deal" ? "idle" : prev));
      }
    }, DEAL_STEP_MS);
  }, [stopDeal]);

  /** startWave 要在 buildWorld 里被调用,而 buildWorld 定义得更早 —— 用 ref 绕开声明顺序 */
  const startWaveRef = useRef<((base: WorldlineSession) => Promise<void>) | null>(null);

  const startWave = useCallback(
    async (base: WorldlineSession) => {
      clearTimers();
      clearVoices();

      queued.current = [];
      reactionsByEvent.current = {};
      waveAccum.current = [];
      streamStarted.current = false;
      streamDone.current = false;

      setDeck([]);
      setPlaying(null);
      setPlayed([]);
      setReactionDone(0);
      setReactionTotal(0);
      setReactionsReady(false);
      setLitIds([]);
      setPhase("deal");
      setNotice("");
      setWitnessLine("这五件事是这一波要落到世界上的。先看它们落定。");

      try {
        const response = await fetch("/api/worldline-wave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session: base }),
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

        let streamError = "";

        await readNdjsonStream(response, worldlineWaveEventSchema, (event) => {
          switch (event.type) {
            case "wave-start":
              streamStarted.current = true;
              startDeal();
              break;
            case "wave-event":
              waveAccum.current.push(event.event);
              queued.current.push(event.event);
              startDeal();
              break;
            case "wave-reactions":
              reactionsByEvent.current[event.eventId] = event.reactions;
              // 分母逐步长出来:世界在盘算的过程中,玩家能看见它的反应有几种
              setReactionTotal((prev) => prev + event.reactions.length);
              break;
            case "wave-complete": {
              streamDone.current = true;
              const wave = waveAccum.current.map((item) => ({
                ...item,
                reactions: reactionsByEvent.current[item.id] ?? [],
              }));
              waveAccum.current = wave;
              setReactionsReady(true);
              setSession((prev) => (prev ? applyWave({ session: prev, wave }).session : prev));

              // 触发本纪元史诗宣言横幅
              const eraCount = (base.waves.length ?? 0) + 1;
              const milestone = inferMilestoneFromWave({
                eraNo: eraCount,
                hasCrisis: wave.some((e) => e.tone === "bad"),
                tone: wave[0]?.tone,
              });
              const waveEpic = getEpicQuote({
                themeId,
                milestone,
                index: eraCount - 1,
              });
              setProclamation({
                id: `wave-${eraCount}-${Date.now()}`,
                ...waveEpic,
                durationMs: 7000,
              });
              break;
            }
            case "error":
              streamError = userErrorMessage(event.error);
              break;
          }
        });

        if (streamError) throw new Error(streamError);
        if (!streamStarted.current) throw new Error("这一波没有任何事件回来");
      } catch (error) {
        console.error("波次推演失败", error);
        // 失败时落到 done:世界停在原地,玩家可以原地下一次请求
        streamDone.current = true;
        setNotice(error instanceof Error ? error.message : "这一波推演失败,请重试");
        setPhase("done");
      } finally {
        startDeal();
      }
    },
    [clearTimers, clearVoices, startDeal],
  );
  startWaveRef.current = startWave;

  // ==================== 开一个新世界 ====================

  const buildWorld = useCallback(async () => {
    clearTimers();
    clearVoices();
    setBoot(EMPTY_BOOT);
    setSession(null);
    setDeck([]);
    setPlaying(null);
    setPlayed([]);
    setReactionDone(0);
    setReactionTotal(0);
    setReactionsReady(false);
    setLitIds([]);
    setNotice("");
    setPhase("boot");
    setWitnessLine("桌上会落五件事。等它们落定,世界才开始动。");

    try {
      const response = await fetch("/api/worldline-seed", {
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

      let built: WorldlineSession | null = null;

      await readNdjsonStream(response, worldlineSeedEventSchema, (event) => {
        switch (event.type) {
          case "seed-start":
            break;
          case "seed-premise":
            setBoot((prev) => ({
              ...prev,
              premise: event.premise,
              scaleLabel: event.scaleLabel,
            }));
            break;
          case "seed-witness":
            setBoot((prev) => ({
              ...prev,
              witnessName: event.witnessName,
              witnessRole: event.witnessRole,
            }));
            break;
          case "seed-being":
            setBoot((prev) => ({ ...prev, beings: [...prev.beings, event.being] }));
            break;
          case "seed-segment":
            setBoot((prev) => ({ ...prev, opening: [...prev.opening, event.segment] }));
            break;
          case "seed-complete":
            built = createSession(event.seed);
            break;
          case "error":
            throw new Error(userErrorMessage(event.error));
        }
      });

      if (!built) {
        throw new Error("未能生成世界线会话种子");
      }
      const next: WorldlineSession = built;
      setSession(next);
      const genesisEpic = getEpicQuote({ themeId, milestone: "genesis" });
      setProclamation({
        id: `genesis-${Date.now()}`,
        ...genesisEpic,
        durationMs: 7500,
      });
      /**
       * 开场那几句台词来自最新的一段 —— 玩家先看见有人站在那儿说话,
       * 再看见世界从他身后长出来。顺序反过来就没有"有人陪着"的感觉了。
       */
      speak(next.timeline.at(-1)?.voices ?? []);
      await startWaveRef.current?.(next);
    } catch (error) {
      console.error("世界构建失败", error);
      setBoot((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "世界构建失败",
      }));
      setPhase("boot");
      setWitnessLine("这条世界线没能铺开。重建一次试试。");
    }
  }, [clearTimers, clearVoices, scenarioId, scenarioTitle, speak, themeId]);

  // 首屏:读存档,或构建世界
  useEffect(() => {
    if (seedStarted.current) return;
    seedStarted.current = true;

    const stored = loadWorldline(scenarioId);
    if (stored) {
      const restored = stored.session;
      const wave = restored.waves.at(-1) ?? [];
      const total = wave.reduce((sum, item) => sum + item.reactions.length, 0);

      setSession(restored);
      // 恢复时不再重播落牌动画,反应也按"已播完"处理 ——
      // 否则玩家一回来就被上一波的反应刷屏,而他并没有按过那个按钮
      setDeck(wave);
      setPlayed(wave.map((_, index) => index));
      setReactionDone(total);
      setReactionTotal(total);
      setReactionsReady(true);
      setPhase("done");
      setWitnessLine("这一波反应走完了。想看下一波,就再发一次。");
      setNotice(
        `已从本地存档接上(${new Date(stored.savedAt).toLocaleString("zh-CN", { hour12: false })})`,
      );
      speak(restored.timeline.at(-1)?.voices ?? []);
      return;
    }

    void buildWorld();
  }, [buildWorld, scenarioId, speak]);

  // 会话一变就落盘。写入很便宜,而丢掉一整条世界线的代价很高
  useEffect(() => {
    if (session) saveWorldline(scenarioId, session);
  }, [scenarioId, session]);

  // 编年史一长出新的一段,视线就跟到下面 —— 世界线是往下长的
  const timelineLength = session?.timeline.length ?? boot.opening.length;
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const newest = scroller.querySelector<HTMLElement>('.era[data-newest="1"]');
    if (newest) scroller.scrollTop = Math.max(0, newest.offsetTop - 20);
  }, [timelineLength]);

  // 卸载时把挂着的计时器收干净,免得在别的页面里继续 setState
  useEffect(
    () => () => {
      timers.current.splice(0).forEach((id) => window.clearTimeout(id));
      voiceTimers.current.splice(0).forEach((id) => window.clearTimeout(id));
      if (dealTimer.current !== null) window.clearInterval(dealTimer.current);
    },
    [],
  );

  // ==================== 世界的反应 ====================

  const nameOf = useCallback(
    (id: string) => session?.seed.beings.find((being) => being.id === id)?.name ?? id,
    [session],
  );

  /**
   * 把这一波的反应逐条写进编年史。
   *
   * 顺序是刻意的:五件事先一次性记档(它们确实都发生在这一段里),
   * 然后世界的反应一条一条接上来,每条之间留足一口气。
   * 反应彼此不相干 —— 有的当天就有回音,有的要等一百八十年。
   */
  const playReactions = useCallback(() => {
    if (phase !== "idle" || !reactionsReady) return;

    clearTimers();
    setPhase("react");
    setPlaying(null);
    setLitIds([]);

    const wave = waveAccum.current.length ? waveAccum.current : deck;
    appendTimeline(wave.map(eventSegment));

    const queue: { index: number; event: WorldlineEvent; reaction: WorldlineReaction }[] = [];
    wave.forEach((event, index) => {
      event.reactions.forEach((reaction) => queue.push({ index, event, reaction }));
    });

    if (!queue.length) {
      setReactionDone(0);
      setReactionTotal(0);
      setPhase("done");
      setWitnessLine("这一波没有谁开口。世界把它咽下去了。");
      return;
    }

    setReactionDone(0);
    setReactionTotal(queue.length);

    let done = 0;
    queue.forEach((item, order) => {
      later(
        () => {
          setPlaying(item.index);
          setWitnessLine(`${nameOf(item.reaction.by)}对这件事开口了。`);
          later(() => {
            appendTimeline([reactionSegment(item.event, item.reaction)]);
            setPlayed((prev) => (prev.includes(item.index) ? prev : [...prev, item.index]));
            setPlaying(null);
            speak(item.reaction.voices);
            setLitIds([item.reaction.by]);

            done += 1;
            setReactionDone(done);
            if (done === queue.length) {
              setPhase("done");
              setWitnessLine("这一波反应走完了。想看下一波,就再发一次。");
            }
          }, REACTION_SETTLE_MS);
        },
        500 + order * REACTION_STEP_MS,
      );
    });
  }, [appendTimeline, clearTimers, deck, later, nameOf, phase, reactionsReady, speak]);

  const advance = useCallback(() => {
    if (phase === "idle" && reactionsReady) {
      playReactions();
      return;
    }
    if (phase === "done" && session) {
      void startWave(session);
    }
  }, [phase, playReactions, reactionsReady, session, startWave]);

  const rebuild = useCallback(() => {
    clearWorldline(scenarioId);
    void buildWorld();
  }, [buildWorld, scenarioId]);

  // ==================== 视图 ====================

  const timeline = session?.timeline ?? boot.opening;
  const premiseStatement =
    session?.seed.premise.statement ?? boot.premise?.statement ?? "正在把这道假设题翻成一条世界线…";

  const deckWithReactions = deck.map((event) => ({
    ...event,
    reactions: reactionsByEvent.current[event.id] ?? event.reactions,
  }));

  // 还扣着的张数。事件还没到齐时按五张算,到齐之后以实际数量为准
  const pending = session
    ? streamDone.current
      ? Math.max(0, waveAccum.current.length - deck.length)
      : Math.max(0, WAVE_SIZE - deck.length)
    : 0;

  const view: ObservatoryView = {
    scenarioTitle: session?.scenarioTitle ?? scenarioTitle,
    themeId,
    premiseStatement,
    domains: session?.seed.premise.domains ?? boot.premise?.domains ?? [],
    scaleLabel: session?.seed.scaleLabel ?? boot.scaleLabel,
    witnessName: session?.seed.witnessName ?? boot.witnessName,
    witnessArchetype: session?.seed.witnessArchetype ?? witnessArchetypeFor(themeId),
    beings: session?.seed.beings ?? boot.beings,
    timeline,
    events: deckWithReactions,
    pending,
    playing,
    played,
    voices,
    phase,
    reactionDone,
    reactionTotal,
    witnessLine: boot.error || witnessLine,
    notice: notice || boot.error,
    busy: phase === "boot" || phase === "deal" || phase === "react",
    loading: !session,
    reactionsReady,
  };

  return (
    <Observatory
      view={view}
      skin={skin}
      litIds={litIds}
      onLit={(involves) => setLitIds(involves ?? [])}
      scrollerRef={scrollerRef}
      onAdvance={advance}
      onReset={rebuild}
      proclamation={proclamation}
      onDismissProclamation={() => setProclamation(null)}
    />
  );
}

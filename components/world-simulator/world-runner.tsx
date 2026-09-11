"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { WorldSimulator } from "@/components/world-simulator";
import { SeedStage } from "@/components/world-simulator/seed-stage";
import type { AdvanceProgress } from "@/components/world-simulator/world-console";
import { errorEnvelopeSchema, userErrorMessage } from "@/lib/app-error";
import { readNdjsonStream } from "@/lib/ndjson-stream";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import type {
  CounterfactualPremise,
  EntitySimulationReport,
  GlobalMetric,
  HardRule,
  TimeScale,
  TimeState,
  WorldEntity,
  WorldSeed,
  WorldSimSession,
} from "@/lib/world-sim";
import {
  worldSeedEventSchema,
  worldSimulateEventSchema,
  type ObservationOptions,
} from "@/lib/world-sim-events";
import { createSession } from "@/lib/world-sim-reducer";
import {
  clearWorldSimSession,
  loadWorldSimSession,
  saveWorldSimSession,
} from "@/lib/world-sim-storage";

/**
 * 世界线控制台的运行时。
 *
 * 这是静态 demo 与真实链路的分界点:所有会话状态、存档、两条流式接口都在这里,
 * 下面的 WorldSimulator 只是一副壳,收到的永远是"可以直接画"的数据。
 *
 * 三条数据通路:
 *   1. 首次进入     没有存档 -> POST /api/world-seed,事件逐个长成舞台
 *   2. 推进时代     有存档 -> POST /api/world-simulate,主体报告逐个回来,最后裁决
 *   3. 观测选项     阶段结束后 -> POST /api/world-observations,给出下一步能做什么
 *
 * 存档每次 complete 都写一次 localStorage。刷新页面直接从存档恢复,不重跑模型。
 */

interface SeedProgressState {
  phase: "connecting" | "building" | "error";
  premise: CounterfactualPremise | null;
  startTime: TimeState | null;
  timeScale: TimeScale | null;
  hardRules: HardRule[];
  entities: WorldEntity[];
  announcedIds: string[];
  globalMetrics: GlobalMetric[];
  error: string;
}

const EMPTY_SEED_PROGRESS: SeedProgressState = {
  phase: "connecting",
  premise: null,
  startTime: null,
  timeScale: null,
  hardRules: [],
  entities: [],
  announcedIds: [],
  globalMetrics: [],
  error: "",
};

const IDLE_ADVANCE: AdvanceProgress = {
  phase: "idle",
  startedIds: [],
  reports: [],
  errors: [],
};

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
  const [advance, setAdvance] = useState<AdvanceProgress>(IDLE_ADVANCE);
  const [observations, setObservations] = useState<ObservationOptions | null>(null);
  const [followedEntityId, setFollowedEntityId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  // 防止严格模式下 useEffect 跑两次发出两条种子流
  const seedStarted = useRef(false);
  // 推进中的存档写入要靠当前会话,用 ref 避开闭包过期
  const sessionRef = useRef<WorldSimSession | null>(null);
  sessionRef.current = session;

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
          case "entity-start":
            setSeedProgress((prev) => ({
              ...prev,
              announcedIds: [...prev.announcedIds, event.entityId],
            }));
            break;
          case "entity":
            setSeedProgress((prev) => ({ ...prev, entities: [...prev.entities, event.entity] }));
            break;
          case "seed-metrics":
            setSeedProgress((prev) => ({ ...prev, globalMetrics: event.globalMetrics }));
            break;
          case "seed-events":
            break;
          case "seed-complete":
            built = event.seed;
            break;
          case "error":
            throw new Error(userErrorMessage(event.error));
        }
      });

      if (!built) throw new Error("世界构建流没有返回完整种子");

      const next = createSession(built);
      setSession(next);
      saveWorldSimSession(scenarioId, next);
      setNotice("世界已经搭好。推进时间,看它自己怎么走。");
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

  // ==================== 观测选项 ====================

  const refreshObservations = useCallback(
    async (target: WorldSimSession, followed: string | null) => {
      try {
        const response = await fetch("/api/world-observations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session: target,
            ...(followed ? { followedEntityId: followed } : {}),
          }),
        });
        if (!response.ok) return;
        const parsed = (await response.json()) as ObservationOptions;
        setObservations(parsed);
      } catch (error) {
        console.error("观测选项获取失败", error);
      }
    },
    [],
  );

  useEffect(() => {
    if (!session) return;
    if (observations) return;
    void refreshObservations(session, followedEntityId);
  }, [followedEntityId, observations, refreshObservations, session]);

  // ==================== 推进时代 ====================

  const advanceEra = useCallback(
    async (fork?: { forkId: string; alternativeId: string }) => {
      const current = sessionRef.current;
      if (!current) return;

      setNotice("");
      setAdvance({
        phase: "entities",
        startedIds: [],
        reports: [],
        errors: [],
      });

      try {
        const response = await fetch("/api/world-simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session: current,
            ...(followedEntityId ? { followedEntityId } : {}),
            ...(fork ? { forkChoice: fork } : {}),
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
            case "simulation-start":
              break;
            case "entity-start":
              setAdvance((prev) => ({
                ...prev,
                phase: "entities",
                startedIds: [...prev.startedIds, event.entityId],
              }));
              break;
            case "entity-report": {
              const report: EntitySimulationReport = event.report;
              setAdvance((prev) => ({ ...prev, reports: [...prev.reports, report] }));
              break;
            }
            case "entity-error":
              setAdvance((prev) => ({ ...prev, errors: [...prev.errors, event.error.message] }));
              break;
            case "adjudicating":
              setAdvance((prev) => ({ ...prev, phase: "adjudicating" }));
              break;
            case "world-event":
            case "causal-chain":
            case "fork-detected":
            case "snapshot":
            case "state":
              break;
            case "complete":
              finished = event.session;
              break;
            case "error":
              streamError = userErrorMessage(event.error);
              break;
          }
        });

        if (!finished) throw new Error(streamError || "推演流没有返回完整会话");

        const next: WorldSimSession = finished;
        setSession(next);
        saveWorldSimSession(scenarioId, next);
        setObservations(null);
        setAdvance(IDLE_ADVANCE);

        const pendingFork = next.forks.find((item) => !item.selectedAlternativeId);
        const latest = next.snapshots.at(-1);
        setNotice(
          pendingFork
            ? `历史走到一个岔口:${pendingFork.title}`
            : (latest?.conclusion ?? "这一阶段推进完毕。"),
        );

        void refreshObservations(next, followedEntityId);
      } catch (error) {
        console.error("时代推演失败", error);
        setAdvance({
          ...IDLE_ADVANCE,
          errors: [error instanceof Error ? error.message : "推演失败"],
        });
        setNotice(error instanceof Error ? error.message : "时代推演失败,请重试");
      }
    },
    [followedEntityId, refreshObservations, scenarioId],
  );

  // ==================== 分叉选择 ====================

  const chooseForkAlternative = useCallback(
    (forkId: string, alternativeId: string) => {
      void advanceEra({ forkId, alternativeId });
    },
    [advanceEra],
  );

  const resetSession = useCallback(() => {
    clearWorldSimSession(scenarioId);
    setSession(null);
    setObservations(null);
    setFollowedEntityId(null);
    setAdvance(IDLE_ADVANCE);
    setNotice("");
    void buildWorld();
  }, [buildWorld, scenarioId]);

  // ==================== 渲染 ====================

  if (!session) {
    return (
      <SeedStage
        skin={skin}
        themeName={themeName}
        phase={seedProgress.phase}
        premise={seedProgress.premise}
        startTime={seedProgress.startTime}
        timeScale={seedProgress.timeScale}
        hardRules={seedProgress.hardRules}
        entities={seedProgress.entities}
        announcedIds={seedProgress.announcedIds}
        globalMetrics={seedProgress.globalMetrics}
        error={seedProgress.error}
        onRetry={() => void buildWorld()}
      />
    );
  }

  return (
    <WorldSimulator
      session={session}
      skin={skin}
      onBack={() => router.back()}
      followedEntityId={followedEntityId}
      onFollow={setFollowedEntityId}
      advance={advance}
      onAdvance={() => void advanceEra()}
      onChooseFork={chooseForkAlternative}
      observations={observations}
      notice={notice}
      onReset={resetSession}
    />
  );
}

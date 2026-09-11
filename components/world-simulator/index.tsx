"use client";

import { ArrowLeft, Clock3, GitFork, Globe2, RotateCcw, ScrollText, Users } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntityPanel } from "@/components/world-simulator/entity-panel";
import { EraReport } from "@/components/world-simulator/era-report";
import { WorldConsole, type AdvanceProgress } from "@/components/world-simulator/world-console";
import { WorldHistory } from "@/components/world-simulator/world-history";
import { WorldStage } from "@/components/world-simulator/world-stage";
import { getScenarioProfile } from "@/lib/scenario-profiles";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import { simulationModeLabels, timeScaleLabels, type WorldSimSession } from "@/lib/world-sim";
import type { ObservationOptions } from "@/lib/world-sim-events";

/**
 * 世界线控制台的壳。
 *
 * 结构上刻意与旧 world-council/index.tsx 对齐:
 * 顶部像素带 -> 标题状态行 -> Tabs -> 内部三列网格。
 * 视觉语言(皮肤变量、像素舞台、徽记)完全沿用,换掉的只是"台上在演什么"。
 *
 * 这个组件是纯展示:会话、追踪目标、推演进度、观测选项全部由 WorldRunner 注入。
 * 好处是它不关心数据从哪来 —— 静态 mock 与真实 LLM 链路都能直接喂进来。
 */
export function WorldSimulator({
  session,
  skin,
  onBack,
  followedEntityId,
  onFollow,
  advance,
  onAdvance,
  onChooseFork,
  observations,
  notice,
  onReset,
}: {
  session: WorldSimSession;
  skin: ScenarioSkin;
  onBack: () => void;
  followedEntityId: string | null;
  onFollow: (entityId: string) => void;
  advance: AdvanceProgress;
  onAdvance: () => void;
  onChooseFork: (forkId: string, alternativeId: string) => void;
  observations: ObservationOptions | null;
  notice: string;
  onReset: () => void;
}) {
  const profile = getScenarioProfile(session.seed.themeId);
  const [era, setEra] = useState(session.state.currentEra);

  const latest = session.snapshots.at(-1) ?? null;
  const pendingFork = session.forks.find((fork) => !fork.selectedAlternativeId) ?? null;
  const activeBranch = session.branches.find((branch) => branch.active) ?? null;
  const isRunning = advance.phase !== "idle";

  return (
    <div className="space-y-4">
      {/* 世界舞台:整屏像素演出,台上是正在变化的主体 */}
      <WorldStage
        skin={skin}
        session={session}
        focusedEntityId={followedEntityId}
        onFocus={onFollow}
      />

      {/* 标题状态行 */}
      <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="返回世界线">
            <ArrowLeft />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>
                <Clock3 data-icon="inline-start" />
                {latest?.timeAfter.label ?? session.seed.startTime.label}
              </Badge>
              <Badge variant="outline">
                <Globe2 data-icon="inline-start" />
                {simulationModeLabels[session.seed.simulationMode]}
              </Badge>
              <Badge variant="outline">
                <Users data-icon="inline-start" />
                {session.state.entities.length} 个主体
              </Badge>
              <Badge variant="outline">
                <GitFork data-icon="inline-start" />
                {activeBranch?.label ?? "主线"}
              </Badge>
              {pendingFork ? <Badge variant="destructive">分叉待决</Badge> : null}
              {isRunning ? <Badge variant="secondary">推演中</Badge> : null}
              <Badge variant="secondary">{skin.name}</Badge>
            </div>
            <h1 className="mt-2 text-xl font-semibold">世界线控制台</h1>
            <p className="text-muted-foreground mt-1 line-clamp-1 text-sm">
              {session.scenarioTitle}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <div className="text-muted-foreground text-sm sm:text-right">
            <p>时间尺度 · {timeScaleLabels[session.seed.timeScale]}</p>
            <p className="line-clamp-1">{profile.horizonHint.split(";")[0]}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onReset} disabled={isRunning}>
            <RotateCcw data-icon="inline-start" />
            重建这个世界
          </Button>
        </div>
      </div>

      <Tabs defaultValue="console" className="gap-4">
        <TabsList className="grid h-10 w-full grid-cols-2 sm:w-fit sm:min-w-[34rem] sm:grid-cols-4">
          <TabsTrigger value="console">
            <Globe2 data-icon="inline-start" />
            世界控制台
          </TabsTrigger>
          <TabsTrigger value="report">
            <ScrollText data-icon="inline-start" />
            时代报告
          </TabsTrigger>
          <TabsTrigger value="history">
            <GitFork data-icon="inline-start" />
            世界线
          </TabsTrigger>
          <TabsTrigger value="entities">
            <Users data-icon="inline-start" />
            主体档案
          </TabsTrigger>
        </TabsList>

        <TabsContent value="console" className="mt-0">
          <WorldConsole
            session={session}
            skin={skin}
            followedEntityId={followedEntityId}
            onFocus={onFollow}
            advance={advance}
            onAdvance={onAdvance}
            observations={observations}
            notice={notice}
          />
        </TabsContent>

        <TabsContent value="report" className="mt-0">
          <EraReport session={session} skin={skin} era={era} onSelectEra={setEra} />
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <WorldHistory
            session={session}
            skin={skin}
            onSelectForkAlternative={onChooseFork}
            advancing={isRunning}
          />
        </TabsContent>

        <TabsContent value="entities" className="mt-0">
          <EntityPanel
            session={session}
            skin={skin}
            focusedEntityId={followedEntityId}
            onFocus={onFollow}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import { Activity, GitBranch, Orbit, Radar, ScrollText, Target, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readNdjsonStream } from "@/lib/ndjson-stream";
import {
  formatTime,
  type EraSnapshot,
  type EntitySimulationReport,
  type ObservationOption,
  simulationStreamEventSchema,
  type SimulationStreamEvent,
  type WorldEntity,
  type WorldSimulationSession,
  type WorldState,
} from "@/lib/world-sim";

interface WorldSimulatorProps {
  initial: WorldSimulationSession;
  onBack: () => void;
}

const metricValue = (state: WorldState, id: string) =>
  state.globalMetrics.find((metric) => metric.id === id)?.value ?? 0;

export function WorldSimulator({ initial, onBack }: WorldSimulatorProps) {
  const [session, setSession] = useState(initial);
  const [options, setOptions] = useState<ObservationOption[]>([]);
  const [tab, setTab] = useState("console");
  const [running, setRunning] = useState(false);
  const [reports, setReports] = useState<EntitySimulationReport[]>([]);
  const [feed, setFeed] = useState<string[]>([]);
  const latest = session.snapshots.at(-1) ?? null;

  useEffect(() => {
    void loadOptions(session.currentState, session.snapshots, session.focusEntityId);
  }, []);

  async function loadOptions(
    state: WorldState,
    history: EraSnapshot[],
    focusEntityId: string | null,
  ) {
    const response = await fetch("/api/world-observations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ worldState: state, history, focusEntityId }),
    });
    if (!response.ok) return;
    const data: unknown = await response.json();
    if (
      typeof data === "object" &&
      data !== null &&
      "options" in data &&
      Array.isArray(data.options)
    )
      setOptions(data.options as ObservationOption[]);
  }

  async function advance(observation: ObservationOption) {
    if (running) return;
    setRunning(true);
    setReports([]);
    setFeed([]);
    try {
      const response = await fetch("/api/world-simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seed: session.seed,
          state: session.currentState,
          observation,
          history: session.snapshots,
        }),
      });
      if (!response.ok) throw new Error("世界推进请求失败");
      const result: { value: EraSnapshot | null } = { value: null };
      await readNdjsonStream(
        response,
        simulationStreamEventSchema,
        (event: SimulationStreamEvent) => {
          if (event.type === "entity-report") setReports((current) => [...current, event.report]);
          if (event.type === "world-event") setFeed((current) => [...current, event.event.title]);
          if (event.type === "causal-chain")
            setFeed((current) => [...current, event.chain.conclusion]);
          if (event.type === "fork-detected")
            setFeed((current) => [...current, `出现分叉: ${event.fork.title}`]);
          if (event.type === "complete") result.value = event.snapshot;
          if (event.type === "error") throw new Error(event.message);
        },
      );
      if (!result.value) throw new Error("世界推进没有生成快照");
      const nextSession = {
        ...session,
        currentState: result.value.stateAfter,
        snapshots: [...session.snapshots, result.value].slice(-20),
      };
      sessionStorage.setItem(`world-sim:${session.scenarioId}`, JSON.stringify(nextSession));
      setSession(nextSession);
      await loadOptions(nextSession.currentState, nextSession.snapshots, nextSession.focusEntityId);
      setTab("report");
    } catch (error) {
      setFeed([error instanceof Error ? error.message : "世界推进失败"]);
    } finally {
      setRunning(false);
    }
  }

  function focus(entityId: string) {
    const next = { ...session, focusEntityId: entityId };
    setSession(next);
    sessionStorage.setItem(`world-sim:${session.scenarioId}`, JSON.stringify(next));
    void loadOptions(next.currentState, next.snapshots, entityId);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack}>
            返回题目
          </Button>
          <p className="text-muted-foreground mt-3 text-xs tracking-[0.18em] uppercase">
            WORLDLINE CONTROL / {session.themeId}
          </p>
          <h1 className="mt-2 text-2xl leading-tight font-semibold sm:text-3xl">
            {session.scenarioTitle}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">
            <Orbit className="mr-1 size-3" />
            {session.seed.simulationMode}
          </Badge>
          <Badge variant="secondary">
            <GitBranch className="mr-1 size-3" />
            主线 {session.activeBranchId}
          </Badge>
          <Badge variant="secondary">
            <Users className="mr-1 size-3" />
            {session.seed.entities.length} 个主体
          </Badge>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        <MetricCard
          label={session.currentState.globalMetrics[0]?.label ?? "稳定度"}
          value={metricValue(
            session.currentState,
            session.currentState.globalMetrics[0]?.id ?? "stability",
          )}
        />
        <MetricCard
          label={session.currentState.globalMetrics[1]?.label ?? "资源"}
          value={metricValue(
            session.currentState,
            session.currentState.globalMetrics[1]?.id ?? "resources",
          )}
        />
        <MetricCard label="时代阶段" value={session.snapshots.length} suffix=" 次推进" />
        <MetricCard
          label="当前时间"
          value={session.currentState.time.value}
          suffix={session.currentState.time.unit}
        />
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(String(value))} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto" variant="line">
          <TabsTrigger value="console">
            <Radar />
            世界控制台
          </TabsTrigger>
          <TabsTrigger value="report">
            <ScrollText />
            时代报告
          </TabsTrigger>
          <TabsTrigger value="history">
            <GitBranch />
            世界线
          </TabsTrigger>
          <TabsTrigger value="entities">
            <Users />
            主体档案
          </TabsTrigger>
        </TabsList>
        <TabsContent value="console" className="mt-5">
          <Console
            state={session.currentState}
            seed={session.seed}
            options={options}
            running={running}
            onAdvance={advance}
            focusEntityId={session.focusEntityId}
            onFocus={focus}
          />
        </TabsContent>
        <TabsContent value="report" className="mt-5">
          <Report snapshot={latest} reports={reports} feed={feed} />
        </TabsContent>
        <TabsContent value="history" className="mt-5">
          <History session={session} />
        </TabsContent>
        <TabsContent value="entities" className="mt-5">
          <Entities
            seedEntities={session.seed.entities}
            state={session.currentState}
            focusEntityId={session.focusEntityId}
            onFocus={focus}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  label,
  value,
  suffix = "%",
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">
          {value}
          <span className="text-muted-foreground ml-1 text-xs font-normal">{suffix}</span>
        </p>
        <Progress value={suffix === "%" ? value : Math.min(100, value * 5)} className="mt-3 h-1" />
      </CardContent>
    </Card>
  );
}

function Console({
  state,
  seed,
  options,
  running,
  onAdvance,
  focusEntityId,
  onFocus,
}: {
  state: WorldState;
  seed: WorldSimulationSession["seed"];
  options: ObservationOption[];
  running: boolean;
  onAdvance: (option: ObservationOption) => void;
  focusEntityId: string | null;
  onFocus: (id: string) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-5">
        <Card className="shadow-none">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardDescription>当前阶段</CardDescription>
                <CardTitle className="mt-1 text-xl">
                  {formatTime(state.time)} · 世界正在自行演化
                </CardTitle>
              </div>
              <Badge variant="outline">
                <Activity className="mr-1 size-3" />
                观察者模式
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm leading-7">
              反事实起点：{seed.premise.statement}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {state.recentEvents.slice(0, 4).map((event) => (
                <div key={event.id} className="bg-muted/60 rounded-md p-3 text-sm">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-muted-foreground mt-1 leading-6">{event.summary}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">观测方向</h2>
              <p className="text-muted-foreground mt-1 text-sm">选择关注角度，不直接改写世界。</p>
            </div>
            {running ? <Badge>模型推演中</Badge> : null}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {options.map((option) => (
              <Card key={option.id} className="shadow-none">
                <CardHeader className="p-4">
                  <CardTitle className="text-base">{option.label}</CardTitle>
                  <CardDescription className="mt-1 leading-5">{option.description}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <Button
                    className="w-full"
                    variant={option.focusEntityId === focusEntityId ? "secondary" : "default"}
                    disabled={running}
                    onClick={() => onAdvance(option)}
                  >
                    {option.action === "follow-entity" ? (
                      <Target data-icon="inline-start" />
                    ) : (
                      <Orbit data-icon="inline-start" />
                    )}
                    观察推进
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
      <aside className="space-y-4">
        <Card className="shadow-none">
          <CardHeader className="p-4">
            <CardTitle className="text-base">硬规则</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {seed.hardRules.map((rule) => (
              <p
                key={rule.id}
                className="border-border text-muted-foreground border-t py-2 text-xs leading-5"
              >
                {rule.rule}
              </p>
            ))}
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="p-4">
            <CardTitle className="text-base">追踪主体</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-4 pt-0">
            {seed.entities.map((entity) => (
              <button
                key={entity.id}
                type="button"
                className="hover:bg-muted flex w-full items-center gap-2 rounded-md p-2 text-left text-sm"
                onClick={() => onFocus(entity.id)}
              >
                <span className="bg-primary size-2 shrink-0 rounded-full" />
                {entity.name}
              </button>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function Report({
  snapshot,
  reports,
  feed,
}: {
  snapshot: EraSnapshot | null;
  reports: EntitySimulationReport[];
  feed: string[];
}) {
  return (
    <div className="space-y-5">
      <Card className="shadow-none">
        <CardHeader>
          <CardDescription>STRUCTURED ERA REPORT</CardDescription>
          <CardTitle>
            {snapshot
              ? `${formatTime(snapshot.timeBefore)} → ${formatTime(snapshot.timeAfter)}`
              : "等待下一次世界推进"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {snapshot?.causalChains[0] ? (
            <div className="border-primary border-l-2 pl-4 text-sm leading-7">
              {snapshot.causalChains[0].steps.map((step) => (
                <p key={step}>{step}</p>
              ))}
              <p className="mt-2 font-medium">结论：{snapshot.causalChains[0].conclusion}</p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">从世界控制台选择一个观测方向。</p>
          )}
        </CardContent>
      </Card>
      {feed.length ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">本阶段关键变化</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {feed.map((item, index) => (
              <div key={`${item}-${index}`} className="flex gap-3 text-sm">
                <span className="text-primary font-mono">{String(index + 1).padStart(2, "0")}</span>
                <p className="leading-6">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.entityId} className="shadow-none">
            <CardHeader className="p-4">
              <CardDescription>{report.entityId}</CardDescription>
              <CardTitle className="text-base">{report.intent}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0 text-sm">
              <p className="text-muted-foreground leading-6">{report.reasoningSummary}</p>
              {report.actions.map((action) => (
                <p key={action.summary} className="border-border border-t pt-2">
                  {action.summary}
                </p>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function History({ session }: { session: WorldSimulationSession }) {
  return (
    <div className="space-y-4">
      {session.snapshots.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="text-muted-foreground p-8 text-sm">
            世界线还没有经过第一次推进。
          </CardContent>
        </Card>
      ) : (
        session.snapshots.map((snapshot, index) => (
          <Card key={snapshot.id} className="shadow-none">
            <CardContent className="grid gap-3 p-5 sm:grid-cols-[7rem_minmax(0,1fr)_12rem] sm:items-start">
              <div className="text-primary font-mono text-sm">
                ERA {String(index + 1).padStart(2, "0")}
                <p className="text-muted-foreground mt-1 text-xs">
                  {formatTime(snapshot.timeAfter)}
                </p>
              </div>
              <div>
                <p className="font-medium">{snapshot.events[0]?.title}</p>
                <p className="text-muted-foreground mt-1 text-sm leading-6">
                  {snapshot.causalChains[0]?.conclusion}
                </p>
              </div>
              <div className="text-muted-foreground text-xs">
                {snapshot.forks.length ? `自然分叉 ${snapshot.forks.length} 个` : "暂无分叉"}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function Entities({
  seedEntities,
  state,
  focusEntityId,
  onFocus,
}: {
  seedEntities: WorldEntity[];
  state: WorldState;
  focusEntityId: string | null;
  onFocus: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {seedEntities.map((entity) => {
        const current = state.entities.find((item) => item.entityId === entity.id);
        return (
          <Card
            key={entity.id}
            className={focusEntityId === entity.id ? "border-primary shadow-none" : "shadow-none"}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardDescription>{entity.kind}</CardDescription>
                  <CardTitle className="mt-1">{entity.name}</CardTitle>
                </div>
                <span className="bg-primary/20 text-primary grid size-9 place-items-center rounded-md text-xs font-bold">
                  {entity.name.slice(0, 1)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground leading-6">{entity.description}</p>
              <div>
                <p className="text-muted-foreground text-xs">当前目标</p>
                <p className="mt-1">{entity.goals[0]}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">当前状态</p>
                <p className="mt-1 leading-6">{current?.status}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onFocus(entity.id)}>
                {focusEntityId === entity.id ? "正在追踪" : "追踪主体"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

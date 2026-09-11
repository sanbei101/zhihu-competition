import { Activity, Eye, GitFork, LoaderCircle, Play, Sparkles } from "lucide-react";

import { EntityEmblem } from "@/components/pixel/entity-emblem-view";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MetricBar } from "@/components/world-simulator/metric-bar";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import type { EntitySimulationReport, WorldSimSession } from "@/lib/world-sim";
import type { ObservationOptions } from "@/lib/world-sim-events";

/**
 * 推演进度。由 WorldRunner 维护,壳把它原样传下来。
 *
 * phase 的三种取值对应三条线:
 *   entities     主体正在并行推演,报告一份份回来
 *   adjudicating 主体都交完了,世界裁决器正在合并冲突
 *   idle         没有在跑
 */
export interface AdvanceProgress {
  phase: "idle" | "entities" | "adjudicating";
  /** 已经被点名开始推演的主体(事件一到就亮) */
  startedIds: string[];
  /** 已经交回报告的主体 */
  reports: EntitySimulationReport[];
  /** 部分主体失败的说明。失败不终止整局,裁决时按"它没行动"处理 */
  errors: string[];
}

const observationIcons = {
  "advance-era": Play,
  "follow-entity": Eye,
  "inspect-event": Activity,
  "choose-fork": GitFork,
} as const;

/**
 * 世界控制台:首屏核心界面。
 * 当前时间与全局指标 / 当前阶段摘要 / 观测操作 / 推演中的实时进度。
 * 对应 plan.md §8.2 的第一个 Tab。
 */
export function WorldConsole({
  session,
  skin,
  followedEntityId,
  onFocus,
  advance,
  onAdvance,
  observations,
  notice,
}: {
  session: WorldSimSession;
  skin: ScenarioSkin;
  followedEntityId: string | null;
  onFocus: (entityId: string) => void;
  advance: AdvanceProgress;
  onAdvance: () => void;
  observations: ObservationOptions | null;
  notice: string;
}) {
  const latest = session.snapshots.at(-1) ?? null;
  const pendingFork = session.forks.find((fork) => !fork.selectedAlternativeId) ?? null;
  const followed = session.state.entities.find((entity) => entity.id === followedEntityId) ?? null;
  const changed = session.state.entities.filter((entity) => entity.changedThisEra);
  const isRunning = advance.phase !== "idle";
  // 未决分叉时必须先把分叉选掉,否则时间不允许往前
  const blocked = Boolean(pendingFork);
  const busyIds = new Set(advance.startedIds);
  const reportedIds = new Set(advance.reports.map((report) => report.entityId));

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)_18rem]">
      {/* 左:全局指标 */}
      <Card className="order-2 shadow-none lg:order-1">
        <CardHeader>
          <CardTitle>全局指标</CardTitle>
          <CardDescription>各主体行动合并之后,世界整体怎么变了</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {session.state.globalMetrics.map((metric) => (
            <div key={metric.id} className="space-y-1.5">
              <MetricBar metric={metric} />
              <p className="text-muted-foreground text-xs">{metric.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 中:阶段摘要 + 观测操作 + 实时推演 */}
      <div className="order-1 min-w-0 space-y-4 lg:order-2">
        {notice ? (
          <Alert>
            <Sparkles />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ) : null}

        {/* 推演进行中:主体逐个交出报告的过程,这就是"多智能体"的可视化 */}
        {isRunning ? (
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LoaderCircle className="animate-spin" />
                {advance.phase === "adjudicating" ? "世界正在裁定这一段历史" : "各主体正在各自盘算"}
              </CardTitle>
              <CardDescription>
                {advance.phase === "adjudicating"
                  ? "所有主体都交了底牌,现在由裁决者合并冲突、决定谁赢谁输"
                  : "每个主体只看得到世界状态,看不到彼此这一阶段的打算 —— 冲突正是在这里产生"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {session.state.entities.map((entity) => {
                const report = advance.reports.find((item) => item.entityId === entity.id);
                const started = busyIds.has(entity.id);
                const reported = reportedIds.has(entity.id);
                return (
                  <div key={entity.id} className="rounded-md border p-2.5">
                    <div className="flex items-center gap-2">
                      <EntityEmblem entity={entity} skin={skin} scale={2} />
                      <span className="text-sm font-medium">{entity.name}</span>
                      {reported ? (
                        <Badge variant="secondary" className="ml-auto">
                          已提交
                        </Badge>
                      ) : started ? (
                        <Badge variant="outline" className="ml-auto">
                          推演中
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="ml-auto">
                          排队
                        </Badge>
                      )}
                    </div>
                    {report ? (
                      <p className="text-muted-foreground mt-1.5 text-xs leading-5">
                        {report.intent}
                      </p>
                    ) : null}
                  </div>
                );
              })}
              {advance.errors.length ? (
                <p className="text-destructive text-xs leading-5">{advance.errors.join(";")}</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>本阶段摘要</CardTitle>
            <CardDescription>
              {latest ? latest.spanLabel : "世界仍停留在你的假设里"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {latest ? (
              <>
                <p className="text-sm leading-6">{latest.conclusion}</p>
                <Separator />
                <div>
                  <p className="text-muted-foreground mb-2 text-xs">
                    本阶段发生变化的主体({changed.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {changed.map((entity) => (
                      <button
                        key={entity.id}
                        type="button"
                        onClick={() => onFocus(entity.id)}
                        className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
                          followedEntityId === entity.id
                            ? "border-primary bg-accent/50"
                            : "border-border"
                        }`}
                      >
                        <EntityEmblem entity={entity} skin={skin} scale={2} />
                        {entity.name}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                反事实刚刚成立,所有主体都还没有行动。推进之后,它们会按各自的目标开始互相博弈。
              </p>
            )}
          </CardContent>
        </Card>

        {/* 观测操作 */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>观测操作</CardTitle>
            <CardDescription>
              你不是每回合改写世界的上帝,只是打开反事实开关之后的观察者
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={onAdvance} disabled={blocked || isRunning}>
              {isRunning ? (
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
              ) : (
                <Play data-icon="inline-start" />
              )}
              {isRunning ? "推演进行中" : "推进到下一个时代"}
            </Button>
            <p className="text-muted-foreground text-xs">
              {blocked
                ? "历史停在了一个自然分叉上。先去世界线页决定继续观察哪一条。"
                : "推进后,所有主体会按各自目标自主行动一个阶段,再由世界裁决合并冲突。"}
            </p>

            <Separator />

            {/* 观测选项来自 /api/world-observations:读当前局势生成,不是固定清单 */}
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">
                {observations ? "这一阶段可以做的事" : "正在等你决定下一步"}
              </p>
              {(observations?.options ?? []).map((option) => {
                const Icon = observationIcons[option.kind];
                const isAdvance = option.kind === "advance-era";
                return (
                  <div key={option.id} className="rounded-md border p-2.5">
                    <p className="flex items-center gap-1.5 text-xs font-medium">
                      <Icon className="size-3" />
                      {option.label}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs leading-5">{option.hint}</p>
                    {isAdvance ? null : (
                      <Button
                        size="xs"
                        variant="outline"
                        className="mt-2"
                        disabled={isRunning}
                        onClick={() => {
                          if (option.kind === "follow-entity" && option.targetId) {
                            onFocus(option.targetId);
                          }
                        }}
                      >
                        {option.kind === "choose-fork"
                          ? "去世界线页选择"
                          : option.kind === "inspect-event"
                            ? "在时代报告里查看"
                            : "追踪这个主体"}
                      </Button>
                    )}
                  </div>
                );
              })}
              {!observations ? (
                <p className="text-muted-foreground text-xs leading-5">
                  推进一个时代之后,这里会列出基于当前局势生成的观测选项。
                </p>
              ) : null}
            </div>

            <Separator />

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-md border p-2.5">
                <p className="flex items-center gap-1 text-xs font-medium">
                  <Play className="size-3" />
                  推进
                </p>
                <p className="text-muted-foreground mt-1 text-xs">让时间往前走一个阶段</p>
              </div>
              <div className="rounded-md border p-2.5">
                <p className="flex items-center gap-1 text-xs font-medium">
                  <Eye className="size-3" />
                  追踪
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {followed ? `正在追踪 ${followed.name}` : "选择要展开的主体"}
                </p>
              </div>
              <div className="rounded-md border p-2.5">
                <p className="flex items-center gap-1 text-xs font-medium">
                  <GitFork className="size-3" />
                  选择分叉
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {pendingFork
                    ? `待决 · ${pendingFork.title}`
                    : session.forks.some((fork) => fork.selectedAlternativeId)
                      ? "已选定一条世界线"
                      : "尚未出现分叉"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 右:正在变化的主体 */}
      <Card className="order-3 shadow-none">
        <CardHeader>
          <CardTitle>正在变化的主体</CardTitle>
          <CardDescription>追踪之后,下次推演会展开它的完整决策链</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {changed.map((entity) => (
            <div
              key={entity.id}
              className={`rounded-md border p-2.5 ${
                followedEntityId === entity.id ? "border-primary bg-accent/40" : "border-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <EntityEmblem entity={entity} skin={skin} scale={2} />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{entity.name}</span>
                  {entity.status ? (
                    <Badge variant="outline" className="mt-1">
                      {entity.status}
                    </Badge>
                  ) : null}
                </div>
                <Button
                  size="xs"
                  variant={followedEntityId === entity.id ? "default" : "outline"}
                  onClick={() => onFocus(entity.id)}
                >
                  {followedEntityId === entity.id ? "追踪中" : "追踪"}
                </Button>
              </div>
            </div>
          ))}
          {changed.length === 0 ? (
            <p className="text-muted-foreground text-xs leading-5">
              还没有主体发生变化。推进一个时代之后,这里会列出被改写的那些力量。
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

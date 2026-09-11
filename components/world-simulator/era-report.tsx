import { EntityEmblem } from "@/components/pixel/entity-emblem-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MetricDeltaBadge, metricToneClass } from "@/components/world-simulator/metric-bar";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import {
  entityKindLabels,
  eventScopeLabels,
  eventSeverityLabels,
  hardRuleScopeLabels,
  type CausalChain,
  type WorldSimSession,
} from "@/lib/world-sim";

function CausalChainList({ chains }: { chains: CausalChain[] }) {
  return (
    <div className="space-y-5">
      {chains.map((chain) => (
        <div key={chain.id} className="space-y-2">
          <p className="text-sm font-medium">{chain.title}</p>
          <ol className="space-y-2">
            {chain.links.map((link) => (
              <li key={link.id} className="border-border border-l-2 pl-3">
                <p className="text-xs leading-5">
                  <span className="font-medium">{link.cause}</span>
                  <span className="text-muted-foreground mx-1.5">&rarr;</span>
                  <span className="text-muted-foreground">{link.effect}</span>
                </p>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

/**
 * 时代报告:结构化的历史报告,不是聊天气泡。
 * 对应 plan.md §8.2 的第二个 Tab,也是旧 timeline 的替代物。
 */
export function EraReport({
  session,
  skin,
  era,
  onSelectEra,
}: {
  session: WorldSimSession;
  skin: ScenarioSkin;
  era: number;
  onSelectEra: (era: number) => void;
}) {
  const snapshot =
    session.snapshots.find((item) => item.era === era) ?? session.snapshots.at(-1) ?? null;

  if (!snapshot) {
    return (
      <Card className="shadow-none">
        <CardContent className="text-muted-foreground py-14 text-center text-sm">
          还没有任何时代报告。推进一个时代之后,这里会出现结构化的历史记录。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="shadow-none">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <CardTitle>{snapshot.spanLabel}</CardTitle>
            <Badge variant="outline">{snapshot.timeAfter.label}</Badge>
            {session.snapshots.length > 1 ? (
              <div className="ml-auto flex gap-1">
                {session.snapshots.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectEra(item.era)}
                    className={`rounded px-2 py-0.5 text-xs transition-colors ${
                      item.era === snapshot.era
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    纪元 {item.era}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <CardDescription>
            {snapshot.timeBefore.label} &rarr; {snapshot.timeAfter.label}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 事件清单 */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">全球事件与状态变化</h3>
            {snapshot.events.map((event) => (
              <div key={event.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant={
                      event.severity === "critical" || event.severity === "severe"
                        ? "destructive"
                        : "outline"
                    }
                  >
                    {eventSeverityLabels[event.severity]}
                  </Badge>
                  <Badge variant="outline">{eventScopeLabels[event.scope]}</Badge>
                  <span className="text-sm font-medium">{event.title}</span>
                </div>
                <p className="text-muted-foreground mt-1.5 text-xs leading-5">{event.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {event.actorEntityIds.map((actorId) => {
                    const actor = session.state.entities.find((item) => item.id === actorId);
                    if (!actor) return null;
                    return (
                      <span
                        key={actorId}
                        className="bg-muted text-muted-foreground flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.7rem]"
                      >
                        <EntityEmblem entity={actor} skin={skin} scale={1.5} />
                        {actor.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>

          <Separator />

          {/* 各主体自主行动 */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">各主体自主行动</h3>
            {snapshot.reports.map((report) => {
              const entity = session.state.entities.find((item) => item.id === report.entityId);
              if (!entity) return null;
              return (
                <div key={report.entityId} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <EntityEmblem entity={entity} skin={skin} scale={2} />
                    <span className="text-sm font-medium">{entity.name}</span>
                    <Badge variant="outline">{entityKindLabels[entity.kind]}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5">
                    <span className="font-medium">意图 · </span>
                    <span className="text-muted-foreground">{report.intent}</span>
                  </p>
                  <ul className="mt-2 space-y-1">
                    {report.actions.map((action) => (
                      <li key={action} className="text-xs leading-5">
                        <span className="text-muted-foreground mr-1.5">·</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {report.proposedChanges.map((change) => (
                      <span
                        key={change}
                        className="bg-accent text-accent-foreground rounded px-1.5 py-0.5 text-[0.7rem]"
                      >
                        {change}
                      </span>
                    ))}
                  </div>
                  <p className="border-border text-muted-foreground mt-2.5 border-l-2 pl-2.5 text-xs leading-5 italic">
                    {report.reasoningSummary}
                  </p>
                </div>
              );
            })}
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-medium">连锁后果</h3>
            <CausalChainList chains={snapshot.causalChains} />
          </section>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>阶段结论</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-6">{snapshot.conclusion}</p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>指标变化与原因</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.metricDeltas.map((delta) => {
              const metric = session.state.globalMetrics.find((item) => item.id === delta.metricId);
              if (!metric) return null;
              return (
                <div key={delta.metricId} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{metric.label}</span>
                    <span
                      className={`text-xs ${metricToneClass({ ...metric, delta: delta.delta })}`}
                    >
                      <MetricDeltaBadge metric={metric} delta={delta.delta} />
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs leading-5">{delta.reason}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>世界硬约束</CardTitle>
            <CardDescription>任何主体都不能违背</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {session.seed.hardRules.map((rule) => (
              <p key={rule.id} className="text-muted-foreground text-xs leading-5">
                <span className="text-foreground">[{hardRuleScopeLabels[rule.scope]}]</span>{" "}
                {rule.statement}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { EntityEmblem } from "@/components/pixel/entity-emblem-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EntityRow } from "@/components/world-simulator/entity-row";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import { entityKindLabels, relationPostureLabels, type WorldSimSession } from "@/lib/world-sim";

/**
 * 主体档案:每个主体的徽记、类型、目标、资源、状态、最近行动与关系摘要。
 * 对应 plan.md §8.2 的第四个 Tab,也是旧 seats-panel 的替代物。
 */
export function EntityPanel({
  session,
  skin,
  focusedEntityId,
  onFocus,
}: {
  session: WorldSimSession;
  skin: ScenarioSkin;
  focusedEntityId: string | null;
  onFocus: (entityId: string) => void;
}) {
  const followed = session.state.entities.find((entity) => entity.id === focusedEntityId) ?? null;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>世界主体({session.state.entities.length})</CardTitle>
          <CardDescription>
            主体不是角色。它们代表这个世界里互相博弈的力量,各有彼此不重叠的目标
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {session.state.entities.map((entity) => (
            <EntityRow
              key={entity.id}
              entity={entity}
              skin={skin}
              followedId={focusedEntityId}
              onFollow={onFocus}
            />
          ))}
        </CardContent>
      </Card>

      {followed ? (
        <Card className="shadow-none">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <EntityEmblem entity={followed} skin={skin} scale={3} />
              <div className="min-w-0">
                <CardTitle className="truncate">{followed.name}</CardTitle>
                <CardDescription>{entityKindLabels[followed.kind]}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-xs leading-5">{followed.description}</p>

            <section>
              <p className="text-xs font-medium">独立目标</p>
              <ul className="mt-1.5 space-y-1">
                {followed.goals.map((goal) => (
                  <li key={goal} className="text-xs leading-5">
                    <span className="text-muted-foreground mr-1.5">·</span>
                    {goal}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <p className="text-xs font-medium">主要资源与能力</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {followed.capabilities.map((capability) => (
                  <Badge key={capability} variant="outline">
                    {capability}
                  </Badge>
                ))}
              </div>
            </section>

            <section>
              <p className="text-xs font-medium">当前状态</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {followed.metrics.map((metric) => (
                  <span
                    key={metric.id}
                    className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[0.7rem] tabular-nums"
                  >
                    {metric.label} {metric.value}
                    {metric.unit ?? ""}
                  </span>
                ))}
              </div>
            </section>

            <section>
              <p className="text-xs font-medium">无法逾越的约束</p>
              <ul className="mt-1.5 space-y-1">
                {followed.constraints.map((constraint) => (
                  <li key={constraint} className="text-muted-foreground text-xs leading-5">
                    · {constraint}
                  </li>
                ))}
              </ul>
            </section>

            <Separator />

            <section>
              <p className="text-xs font-medium">关系摘要</p>
              <ul className="mt-2 space-y-2.5">
                {followed.relations.map((relation) => {
                  const target = session.state.entities.find(
                    (item) => item.id === relation.targetEntityId,
                  );
                  if (!target) return null;
                  return (
                    <li key={relation.targetEntityId} className="flex items-start gap-2">
                      <EntityEmblem entity={target} skin={skin} scale={2} className="mt-0.5" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium">{target.name}</span>
                          <Badge variant="outline">{relationPostureLabels[relation.posture]}</Badge>
                        </div>
                        <p className="text-muted-foreground text-xs leading-5">{relation.note}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-none">
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            选择左侧任一主体查看详情
          </CardContent>
        </Card>
      )}
    </div>
  );
}

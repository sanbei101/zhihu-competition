import { EntityEmblem } from "@/components/pixel/entity-emblem-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import { entityKindLabels, relationPostureLabels, type WorldEntity } from "@/lib/world-sim";

/**
 * 主体行:档案列表里的单条。
 * 徽记 + 类型 + 状态 + 指标 + 关系摘要 + 追踪按钮。
 */
export function EntityRow({
  entity,
  skin,
  followedId,
  onFollow,
}: {
  entity: WorldEntity;
  skin: ScenarioSkin;
  followedId: string | null;
  onFollow: (id: string) => void;
}) {
  const followed = followedId === entity.id;

  return (
    <div
      className={`rounded-md border p-3 transition-colors ${
        followed
          ? "border-primary bg-accent/40"
          : entity.changedThisEra
            ? "border-border"
            : "border-transparent"
      }`}
    >
      <div className="flex items-start gap-3">
        <EntityEmblem entity={entity} skin={skin} scale={3} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">{entity.name}</span>
            <Badge variant="outline">{entityKindLabels[entity.kind]}</Badge>
            {entity.status ? <Badge variant="secondary">{entity.status}</Badge> : null}
            {entity.changedThisEra ? <Badge>本阶段变化</Badge> : null}
          </div>
          <p className="text-muted-foreground mt-1 text-xs leading-5">{entity.description}</p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {entity.metrics.map((metric) => (
              <span
                key={metric.id}
                className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[0.7rem] tabular-nums"
              >
                {metric.label} {metric.value}
                {metric.unit ?? ""}
              </span>
            ))}
          </div>

          <div className="mt-2 flex items-end justify-between gap-2">
            <div className="text-muted-foreground flex min-w-0 flex-col gap-0.5 text-[0.7rem]">
              {entity.relations.slice(0, 2).map((relation) => (
                <span key={relation.targetEntityId} className="truncate">
                  {relationPostureLabels[relation.posture]} · {relation.note}
                </span>
              ))}
            </div>
            <Button
              size="xs"
              variant={followed ? "default" : "outline"}
              onClick={() => onFollow(entity.id)}
            >
              {followed ? "追踪中" : "追踪"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

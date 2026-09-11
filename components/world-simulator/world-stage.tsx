"use client";

import { EntityEmblem } from "@/components/pixel/entity-emblem-view";
import { StageBackdrop } from "@/components/pixel/theme-stage";
import { Badge } from "@/components/ui/badge";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import { simulationModeLabels, type WorldSimSession } from "@/lib/world-sim";

/**
 * 世界舞台。
 *
 * 一横条,只回答三个问题:我在哪条世界线上、现在是什么时候、台上有哪些力量。
 *
 * 刻意做得很矮 —— 卡牌才是主角,舞台只是背景板。
 * 主体也不再是"值得单独开一个面板的东西":每个只有一枚徽记、一个名字、一个状态词,
 * 想看细节就把它按亮,它会展开自己此刻的目标。
 */
export function WorldStage({
  skin,
  session,
  focusedEntityId,
  onFocus,
}: {
  skin: ScenarioSkin;
  session: WorldSimSession;
  focusedEntityId: string | null;
  onFocus: (entityId: string | null) => void;
}) {
  const { seed, state } = session;
  const time = session.snapshots.at(-1)?.timeAfter ?? seed.startTime;
  const branch = session.branches.find((item) => item.active) ?? null;

  return (
    <section className="relative h-52 overflow-hidden rounded-lg border">
      <StageBackdrop skin={skin} />

      <div className="relative flex h-full flex-col justify-between p-4">
        {/* 上:反事实前提 + 时间 */}
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground font-mono text-[10px] tracking-[0.16em] uppercase">
              反事实世界线
            </p>
            <p className="mt-1 line-clamp-2 max-w-2xl text-base leading-6 font-semibold">
              {seed.premise.statement}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary">{simulationModeLabels[seed.simulationMode]}</Badge>
              <Badge variant="outline">{branch?.label ?? "主线"}</Badge>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-primary font-mono text-2xl leading-none">
              {state.currentEra === 0 ? "原点" : `纪元 ${state.currentEra}`}
            </p>
            <p className="text-muted-foreground mt-1.5 font-mono text-[11px]">{time.label}</p>
            <p className="text-muted-foreground font-mono text-[11px]">{time.elapsed}</p>
          </div>
        </div>

        {/* 下:世界主体 */}
        <div className="flex flex-wrap items-end gap-2">
          {state.entities.map((entity) => {
            const focused = focusedEntityId === entity.id;
            return (
              <button
                key={entity.id}
                type="button"
                onClick={() => onFocus(focused ? null : entity.id)}
                className={`bg-card/85 supports-[backdrop-filter]:bg-card/70 flex max-w-64 items-center gap-2 rounded-sm border px-2 py-1.5 text-left backdrop-blur transition-colors ${
                  focused ? "border-primary" : "hover:border-primary/60"
                }`}
              >
                <EntityEmblem entity={entity} skin={skin} scale={3} />

                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium">{entity.name}</span>
                    {entity.changedThisEra ? (
                      <span className="bg-primary size-1.5 shrink-0 rounded-full" />
                    ) : null}
                  </span>
                  <span
                    className={`text-muted-foreground block text-[10px] leading-4 ${
                      focused ? "" : "truncate"
                    }`}
                  >
                    {focused ? entity.goals[0] : (entity.status ?? entity.description)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

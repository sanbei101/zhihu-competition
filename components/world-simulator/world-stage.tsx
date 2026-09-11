import { EntityEmblem, WorldlineEmblem } from "@/components/pixel/entity-emblem-view";
import { PixelSprite } from "@/components/pixel/pixel-sprite";
import { spritesForSkin } from "@/components/pixel/sprites";
import { ThemeScene } from "@/components/pixel/theme-scene";
import { GROUND_LINE, StageBackdrop } from "@/components/pixel/theme-stage";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import type { WorldSimSession } from "@/lib/world-sim";

/**
 * 世界舞台:继承原议事厅的整屏像素演出,但台上站的不是人。
 *
 * 原来的舞台演"某个人正在说话",现在的舞台演"哪些力量正在发生变化"。
 * 底部整屏像素场景与天空精灵完全复用 StageBackdrop / ThemeScene / spritesForSkin,
 * 所以换到任何一个主题,观感都和历史版本一脉相承。
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
  onFocus?: (entityId: string) => void;
}) {
  const sprites = spritesForSkin(skin);
  const landmark = sprites.find((sprite) => sprite.slot === "sky");
  const changed = session.state.entities.filter((entity) => entity.changedThisEra);
  const latest = session.snapshots.at(-1);

  return (
    <div className="space-y-4">
      {/* 顶部像素带:和旧议事厅一模一样的那条,舞台的"身份证" */}
      <ThemeScene skin={skin} variant="strip" className="border-border rounded-md border" />

      <div className="relative overflow-hidden rounded-md border">
        {/*
          舞台高度必须给足:这一版把原来的"人物对峙"换成了"多种力量并立",
          台上同时要站下 5 个徽记 + 各自的名字,矮了就没有舞台感了。
          用固定档位而不是 h-68 这类不存在的类名 -- 写错的类不生成规则,舞台会直接塌掉。
        */}
        <div className="relative h-72 sm:h-80 lg:h-96">
          <StageBackdrop skin={skin} />

          {/* 地标:沿用天空精灵,世界本身没变,变的只是台上站着谁 */}
          {landmark ? (
            <div className={`absolute ${GROUND_LINE} right-[6%]`} aria-hidden="true">
              <PixelSprite
                label={landmark.label}
                frames={landmark.frames}
                palette={landmark.palette}
                duration={landmark.duration}
                scale={5}
                className="origin-bottom scale-[0.65] sm:scale-[0.85] lg:scale-100"
              />
            </div>
          ) : null}

          {/* 地平线上的主体:正在变化的那些力量,首位站 C 位 */}
          <div
            className={`absolute inset-x-0 ${GROUND_LINE} flex items-end justify-center gap-2 px-3 sm:gap-6 sm:px-10 lg:gap-10`}
          >
            {changed.slice(0, 5).map((entity, index) => {
              const dimmed = focusedEntityId !== null && focusedEntityId !== entity.id;
              const focused = focusedEntityId === entity.id;
              // 徽记尺寸按"C 位最大、其余一档略小"排布,和原版 hero/prop 的层次感一致
              const scale = focused ? 7 : index === 0 ? 6 : 5;
              return (
                <button
                  key={entity.id}
                  type="button"
                  onClick={() => onFocus?.(entity.id)}
                  className={`flex flex-col items-center gap-1.5 transition-opacity ${
                    dimmed ? "opacity-50" : "opacity-100"
                  }`}
                  aria-label={`追踪${entity.name}`}
                >
                  <EntityEmblem
                    entity={entity}
                    skin={skin}
                    scale={scale}
                    className={`origin-bottom scale-[0.6] sm:scale-[0.8] lg:scale-100 ${
                      focused ? "animate-portrait-talk" : ""
                    }`}
                  />
                  <span className="text-muted-foreground line-clamp-1 max-w-16 text-[0.68rem] sm:max-w-24 sm:text-xs">
                    {entity.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 左上:纪元徽记与时间刻度 */}
          <div className="absolute top-3 left-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <WorldlineEmblem skin={skin} scale={2} />
              <span className="font-pixel text-[0.7rem] tracking-wide">
                {latest ? `纪元 ${latest.era}` : "反事实原点"}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              {latest?.timeAfter.label ?? session.seed.startTime.label}
            </p>
          </div>

          {/* 右上:本阶段推进幅度 */}
          {latest ? (
            <div className="absolute top-3 right-3 text-right">
              <p className="font-pixel text-[0.7rem] tracking-wide">{latest.spanLabel}</p>
              <p className="text-muted-foreground text-xs">{latest.timeBefore.label} 起</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

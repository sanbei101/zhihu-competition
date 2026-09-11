import { emblemFor, worldlineEmblem } from "@/components/pixel/entity-emblem";
import { PixelSprite } from "@/components/pixel/pixel-sprite";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import type { EntityKind } from "@/lib/world-sim";

/**
 * 主体徽记:把 emblemFor 的输出包成一个可直接用的组件。
 * 徽记承担原来立绘的位置,但语义从"某个人"变成了"某种力量"。
 */
export function EntityEmblem({
  entity,
  skin,
  scale = 4,
  className,
}: {
  entity: { id: string; name: string; kind: EntityKind };
  skin: ScenarioSkin;
  scale?: number;
  className?: string;
}) {
  const emblem = emblemFor(entity, skin);
  return (
    <PixelSprite
      label={emblem.label}
      frames={emblem.frames}
      palette={emblem.palette}
      scale={scale}
      className={className}
    />
  );
}

/** 世界线徽记:分叉树,用于控制台顶部与历史页 */
export function WorldlineEmblem({
  skin,
  scale = 4,
  className,
}: {
  skin: ScenarioSkin;
  scale?: number;
  className?: string;
}) {
  const emblem = worldlineEmblem(skin);
  return (
    <PixelSprite
      label={emblem.label}
      frames={emblem.frames}
      palette={emblem.palette}
      scale={scale}
      className={className}
    />
  );
}

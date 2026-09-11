"use client";

import { PixelSprite } from "@/components/pixel/pixel-sprite";
import { witnessSprite } from "@/components/pixel/witness";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import type { WitnessArchetype } from "@/lib/world-sim";

/**
 * 卡牌旁边站着的那个像素角色。
 *
 * 它只做两件事:站着,和说话。所以这里刻意没有状态、没有交互 ——
 * 状态在调用方(说得越多、点头越快),这样它永远是个纯展示组件。
 */
export function WitnessFigure({
  archetype,
  skin,
  label,
  speaking,
  scale = 5,
  className,
}: {
  archetype: WitnessArchetype;
  skin: ScenarioSkin;
  label: string;
  /** 正在说话 -> 切换到更快的点头节奏 */
  speaking: boolean;
  scale?: number;
  className?: string;
}) {
  const sprite = witnessSprite(archetype, skin, label);

  return (
    <div
      className={`${speaking ? "animate-witness-talk" : "animate-witness-idle"} ${className ?? ""}`}
    >
      <PixelSprite
        frames={sprite.frames}
        palette={sprite.palette}
        label={label}
        scale={scale}
        duration={speaking ? 460 : 900}
      />
    </div>
  );
}

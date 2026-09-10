import { PixelSprite } from "@/components/pixel/pixel-sprite";
import { spritesForSkin } from "@/components/pixel/sprites";
import type { ScenarioSkin } from "@/lib/scenario-skin";

function PixelGround({ skin }: { skin: ScenarioSkin }) {
  const patternId = `pixel-ground-${skin.id}`;

  return (
    <svg width="100%" height="10" aria-hidden="true" className="block" shapeRendering="crispEdges">
      <defs>
        <pattern id={patternId} width="4" height="10" patternUnits="userSpaceOnUse">
          <rect x="0" y="3" width="4" height="7" fill={skin.pixel.o} />
          <rect x="0" y="1" width="2" height="2" fill={skin.pixel.x} />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="10" fill={`url(#${patternId})`} />
    </svg>
  );
}

function PixelStars({ skin }: { skin: ScenarioSkin }) {
  const patternId = `pixel-stars-${skin.id}`;

  return (
    <svg
      width="100%"
      height="100%"
      aria-hidden="true"
      className="absolute inset-0"
      shapeRendering="crispEdges"
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id={patternId} width="24" height="18" patternUnits="userSpaceOnUse">
          <rect x="3" y="4" width="1" height="1" fill={skin.inkSoft} opacity="0.5" />
          <rect x="14" y="9" width="1" height="1" fill={skin.inkSoft} opacity="0.35" />
          <rect x="20" y="2" width="1" height="1" fill={skin.inkSoft} opacity="0.25" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}

interface ThemeSceneProps {
  skin: ScenarioSkin;
  /** banner 用于首页分区,strip 用于议事厅顶部 */
  variant?: "banner" | "strip";
  className?: string;
}

export function ThemeScene({ skin, variant = "banner", className }: ThemeSceneProps) {
  const all = spritesForSkin(skin);
  const factor = variant === "strip" ? 0.5 : 1;
  const ground = all.filter((sprite) => sprite.slot !== "sky");
  const sky = all.filter((sprite) => sprite.slot === "sky");
  const visibleGround = variant === "strip" ? ground.slice(0, 2) : ground;
  const visibleSky = variant === "strip" ? sky.slice(0, 1) : sky;

  return (
    <div
      className={`relative overflow-hidden ${className ?? ""}`}
      style={{ backgroundColor: skin.bg }}
      aria-hidden="true"
    >
      <PixelStars skin={skin} />

      {visibleSky.map((sprite, index) => (
        <div
          key={sprite.id}
          className={index % 2 === 0 ? "absolute top-2 left-[6%]" : "absolute top-4 right-[10%]"}
        >
          <PixelSprite
            label={sprite.label}
            frames={sprite.frames}
            palette={sprite.palette}
            duration={sprite.duration}
            scale={Math.max(2, Math.round((sprite.scale ?? 5) * factor))}
          />
        </div>
      ))}

      <div className="relative flex items-end gap-4 px-[6%] sm:gap-6">
        {visibleGround.map((sprite) => (
          <PixelSprite
            key={sprite.id}
            label={sprite.label}
            frames={sprite.frames}
            palette={sprite.palette}
            duration={sprite.duration}
            scale={Math.max(2, Math.round((sprite.scale ?? 5) * factor))}
          />
        ))}
      </div>

      <PixelGround skin={skin} />
    </div>
  );
}

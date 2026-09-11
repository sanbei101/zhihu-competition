import { PixelSprite } from "@/components/pixel/pixel-sprite";
import { spritesForSkin, type SpriteDef } from "@/components/pixel/sprites";
import type { ScenarioSkin } from "@/lib/scenario-skin";

/** 地台高度与地平线高度必须成对出现,改一处要三处同步 */
export const GROUND_BAND = "h-7 sm:h-9 lg:h-11";
export const GROUND_LINE = "bottom-7 sm:bottom-9 lg:bottom-11";

/** 小屏整体收一档,避免精灵把整屏挤满 */
const SPRITE_FIT = "origin-bottom scale-[0.6] sm:scale-[0.8] lg:scale-100";

/**
 * 每层精灵的高度上限(视口高度百分比)。
 * 首页一整屏里,下半部分要留给'演出带',精灵再大也不能越过这条线,
 * 用 max-h + w-auto 让 SVG 等比缩,像素比不整也比压住文案好。
 */
const FIT = {
  hero: "w-auto max-h-[21dvh] sm:max-h-[26dvh] lg:max-h-[32dvh]",
  prop: "w-auto max-h-[13dvh] sm:max-h-[16dvh] lg:max-h-[19dvh]",
  landmark: "w-auto max-h-[17dvh] sm:max-h-[21dvh] lg:max-h-[26dvh]",
  floating: "w-auto max-h-[11dvh] sm:max-h-[13dvh] lg:max-h-[15dvh]",
} as const;

/** 远山起伏,写死数组保证服务端与客户端渲染一致 */
const RIDGE_STEPS = [11, 17, 25, 19, 31, 23, 14, 8, 13, 21, 28, 16, 10, 18, 24, 12];

/** 浅色皮肤上剪影要收着画,否则一整块深色会把天空压掉 */
function silhouetteOpacity(skin: ScenarioSkin) {
  const hex = skin.bg.replace("#", "");
  if (hex.length < 6) return 0.75;
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.5 ? 0.28 : 0.75;
}

/** 把一个精灵放大到目标显示高度;取整让像素边缘保持锐利 */
export function stagePixelSize(sprite: SpriteDef, targetHeight: number) {
  const base = sprite.scale ?? 5;
  const rows = sprite.frames[0]?.length ?? 0;
  const native = rows * base;
  if (!native) return base;
  return Math.max(2, Math.round((targetHeight / native) * base));
}

export function StageSprite({
  sprite,
  targetHeight,
  fit,
  className,
}: {
  sprite: SpriteDef;
  targetHeight: number;
  /** 高度上限,防止精灵越过后面的浮动层 */
  fit?: string;
  className?: string;
}) {
  return (
    <div className={`${SPRITE_FIT} ${className ?? ""}`}>
      <PixelSprite
        label={sprite.label}
        frames={sprite.frames}
        palette={sprite.palette}
        duration={sprite.duration}
        scale={stagePixelSize(sprite, targetHeight)}
        className={fit}
      />
    </div>
  );
}

/** 天空 / 星尘 / 地平线光晕 / 远山 / 地台:所有整屏演出共用的底子 */
export function StageBackdrop({ skin }: { skin: ScenarioSkin }) {
  const skyId = `stage-sky-${skin.id}`;
  const groundId = `stage-ground-${skin.id}`;
  const ridgeWidth = RIDGE_STEPS.length * 4;
  const ridgeAlpha = silhouetteOpacity(skin);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: skin.bg }}
      aria-hidden="true"
    >
      {/* 天幕:顶部压深,靠近地平线提亮 */}
      <div
        className="absolute inset-0"
        style={{ backgroundImage: `linear-gradient(to bottom, ${skin.bg}, ${skin.raised})` }}
      />

      {/* 星尘 */}
      <svg className="absolute inset-0 size-full" shapeRendering="crispEdges">
        <defs>
          <pattern id={skyId} width="56" height="44" patternUnits="userSpaceOnUse">
            <rect x="7" y="8" width="2" height="2" fill={skin.ink} opacity="0.16" />
            <rect x="33" y="21" width="1" height="1" fill={skin.ink} opacity="0.26" />
            <rect x="47" y="7" width="1" height="1" fill={skin.ink} opacity="0.12" />
            <rect x="23" y="36" width="2" height="2" fill={skin.ink} opacity="0.08" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill={`url(#${skyId})`} />
      </svg>

      {/* 地平线光晕 */}
      <div
        className={`absolute inset-x-0 ${GROUND_LINE} h-2/3`}
        style={{
          backgroundImage: `radial-gradient(72% 100% at 50% 100%, ${skin.accent}22, transparent 70%)`,
        }}
      />

      {/* 远山剪影 */}
      <svg
        viewBox={`0 0 ${ridgeWidth} 32`}
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
        className={`absolute inset-x-0 ${GROUND_LINE} h-24 w-full sm:h-32 lg:h-40`}
        aria-hidden="true"
      >
        {RIDGE_STEPS.map((step, index) => (
          <rect
            key={index}
            x={index * 4}
            y={32 - step}
            width="4"
            height={step}
            fill={skin.pixel.o}
            opacity={ridgeAlpha}
          />
        ))}
      </svg>

      {/* 地台 */}
      <svg
        className={`absolute inset-x-0 bottom-0 ${GROUND_BAND} w-full`}
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        <defs>
          <pattern id={groundId} width="16" height="16" patternUnits="userSpaceOnUse">
            <rect x="0" y="0" width="16" height="16" fill={skin.pixel.o} />
            <rect x="0" y="0" width="8" height="8" fill={skin.pixel.x} opacity="0.5" />
            <rect x="8" y="8" width="8" height="8" fill={skin.pixel.x} opacity="0.3" />
          </pattern>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill={`url(#${groundId})`} />
        <rect x="0" y="0" width="100%" height="2" fill={skin.pixel.y} opacity="0.5" />
      </svg>
    </div>
  );
}

interface ThemeStageProps {
  skin: ScenarioSkin;
  /** 文案在右侧时整幅演出镜像,给文字让出左上与右上空间 */
  reversed?: boolean;
  className?: string;
}

/**
 * 一整屏的像素演出:天空精灵落在地平线上、其余悬空,地面精灵一线排开踩在地台上。
 * 每个主题只需要在 spritesForSkin 里补一组精灵,这里自动排布。
 */
export function ThemeStage({ skin, reversed = false, className }: ThemeStageProps) {
  const sprites = spritesForSkin(skin);
  const ground = sprites.filter((sprite) => sprite.slot !== "sky");
  const [landmark, ...floating] = sprites.filter((sprite) => sprite.slot === "sky");
  const rowPadding = landmark && reversed ? "lg:pl-[22%]" : landmark ? "lg:pr-[22%]" : "";

  return (
    <div className={`absolute inset-0 overflow-hidden ${className ?? ""}`}>
      <StageBackdrop skin={skin} />

      {/* 立在远山附近的地标:火山、大纛、坠落的碟形飞行器 */}
      {landmark ? (
        <div
          className={`absolute ${GROUND_LINE} ${reversed ? "left-[6%]" : "right-[6%]"}`}
          aria-hidden="true"
        >
          <StageSprite sprite={landmark} targetHeight={228} fit={FIT.landmark} />
        </div>
      ) : null}

      {/* 悬空精灵:掠过天空的翼龙、卫星、信号。放在文案同侧、文案下方,避免被地面精灵盖住 */}
      {floating.slice(0, 2).map((sprite, index) => (
        <div
          key={sprite.id}
          className={`absolute ${index === 0 ? "top-[17%]" : "top-[28%]"} ${
            reversed ? "right-[8%]" : "left-[8%]"
          }`}
          aria-hidden="true"
        >
          <StageSprite sprite={sprite} targetHeight={126} fit={FIT.floating} />
        </div>
      ))}

      {/* 地面精灵:首位站 C 位,其余作前景;精灵少的时候 justify-around 才不会全挤到两头 */}
      <div
        className={`absolute inset-x-0 ${GROUND_LINE} flex items-end justify-around gap-4 px-[6%] sm:px-[9%] ${rowPadding}`}
        aria-hidden="true"
      >
        {ground.map((sprite, index) => (
          <StageSprite
            key={sprite.id}
            sprite={sprite}
            targetHeight={index === 0 ? 288 : 168}
            fit={index === 0 ? FIT.hero : FIT.prop}
          />
        ))}
      </div>
    </div>
  );
}

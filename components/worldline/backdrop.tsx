import type { CSSProperties } from "react";

import type { ScenarioSkin } from "@/lib/scenario-skin";

/**
 * 舞台的天幕。
 *
 * 远山的轮廓是**写死的一条地形线**而不是随机生成 —— 每次渲染都得到同一座山,
 * 这是"这是一个确定的世界"的第一层暗示,也是 SSR 与 CSR 不打架的前提。
 * 浮尘则相反,它必须动:一个完全静止的画面读起来是"一张图片",不是"一个世界"。
 */

const RIDGE_STEPS = [11, 17, 25, 19, 31, 23, 14, 8, 13, 21, 28, 16, 10, 18, 24, 12];

const MOTE_COUNT = 9;

export function StageBackdrop({ skin }: { skin: ScenarioSkin }) {
  const pixel = skin.pixel;

  return (
    <>
      <div className="layer sky-bg" />

      <svg className="layer" shapeRendering="crispEdges" aria-hidden="true">
        <defs>
          <pattern id="obs-sky" width="56" height="44" patternUnits="userSpaceOnUse">
            <rect x="7" y="8" width="2" height="2" fill={skin.ink} opacity="0.16" />
            <rect x="33" y="21" width="1" height="1" fill={skin.ink} opacity="0.26" />
            <rect x="47" y="7" width="1" height="1" fill={skin.ink} opacity="0.12" />
            <rect x="23" y="36" width="2" height="2" fill={skin.ink} opacity="0.08" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#obs-sky)" />
      </svg>

      <div className="layer horizon" />

      <svg
        className="ridge"
        shapeRendering="crispEdges"
        aria-hidden="true"
        preserveAspectRatio="none"
        viewBox="0 0 64 32"
      >
        {RIDGE_STEPS.map((step, index) => (
          <rect
            key={index}
            x={index * 4}
            y={32 - step}
            width="4"
            height={step}
            fill={pixel.o}
            opacity="0.75"
          />
        ))}
      </svg>

      <div className="layer">
        {Array.from({ length: MOTE_COUNT }, (_, index) => {
          const small = index % 3 === 0;
          const style = {
            left: `${4 + index * 10.5}%`,
            top: `${26 + (index % 4) * 13}%`,
            animationDuration: `${11 + (index % 5) * 2.6}s`,
            animationDelay: `${-index * 1.7}s`,
            ...(small ? { width: "2px", height: "2px" } : {}),
          } as CSSProperties;
          return <span key={index} className="mote" style={style} />;
        })}
      </div>

      <div className="layer vignette" />
      <div className="layer scan" />

      <svg className="ground" shapeRendering="crispEdges" aria-hidden="true">
        <defs>
          <pattern id="obs-earth" width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="16" height="16" fill={pixel.o} />
            <rect width="8" height="8" fill={pixel.x} opacity="0.5" />
            <rect x="8" y="8" width="8" height="8" fill={pixel.x} opacity="0.3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#obs-earth)" />
        <rect width="100%" height="2" fill={pixel.y} opacity="0.5" />
      </svg>
    </>
  );
}

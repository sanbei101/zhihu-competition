import { emblemFor, worldlineEmblem } from "@/components/pixel/entity-emblem";
import { witnessSprite } from "@/components/pixel/witness";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import type { EntityKind, WitnessArchetype } from "@/lib/worldline";

/**
 * 世界线观测台用的像素 SVG。
 *
 * 三件东西,全部纯函数、无随机,保证 SSR 与 CSR 渲染结果一致:
 *   EmblemSvg  世界主体的一枚徽记(16×16 网格)
 *   VoiceSvg   舞台上开口的小人(24×30,两帧走 CSS 逐帧)
 *   StandSvg   牌桌旁边那位见证者(同一套小人,但不走动画)
 *
 * 刻意不用 components/pixel/pixel-sprite.tsx:那一版用 SMIL 驱动多帧,
 * 而观测台的小人帧切换走的是 observatory.css 里的 .f0/.f1 关键帧
 * (与原型同一条时间轴)。两套机制混用会让两帧同时可见。
 */

/** 同一行连续同色像素合并成一个 rect —— 与原型逐像素一致地降节点数 */
function rowRects(
  row: string,
  y: number,
  palette: Record<string, string>,
  scale: number,
  keyPrefix: string,
) {
  const rects: React.ReactElement[] = [];
  let x = 0;

  while (x < row.length) {
    const fill = palette[row[x]];
    if (!fill) {
      x += 1;
      continue;
    }
    let run = 1;
    while (x + run < row.length && row[x + run] === row[x]) run += 1;
    rects.push(
      <rect
        key={`${keyPrefix}-${x}-${y}`}
        x={x * scale}
        y={y * scale}
        width={run * scale}
        height={scale}
        fill={fill}
      />,
    );
    x += run;
  }

  return rects;
}

function frameRects(
  frame: readonly string[],
  palette: Record<string, string>,
  scale: number,
  keyPrefix: string,
) {
  return frame.flatMap((row, y) => rowRects(row, y, palette, scale, keyPrefix));
}

type PixelFrameProps = {
  frames: readonly (readonly string[])[];
  palette: Record<string, string>;
  scale: number;
  label: string;
  /** 两帧各自挂一个 class,由 observatory.css 决定谁在什么时候可见 */
  frameClassName?: (index: number) => string;
};

/**
 * 原型里的 viewBox 用的是"缩放后"的画布尺寸(width = 像素数 × scale)。
 *
 * 这里保持同样的写法,而且**不加任何内联样式**:
 *   - 换一个 viewBox 虽然数学上等价,但在 crispEdges 下的取整会差半个像素
 *   - 内联 display:block 会吃掉 SVG 作为行内元素时的那一点下行间隙,
 *     于是四枚徽记、舞台小人与见证者的垂直位置全体上移几像素
 * 两件事都会让整屏和原型对不齐,所以宁可什么都不加。
 */
function PixelFrame({ frames, palette, scale, label, frameClassName }: PixelFrameProps) {
  if (!frames.length) return null;

  const width = frames[0][0]?.length ?? 0;
  const height = frames[0].length;

  return (
    <svg
      width={width * scale}
      height={height * scale}
      viewBox={`0 0 ${width * scale} ${height * scale}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
    >
      {frames.map((frame, index) => (
        <g key={index} className={frameClassName?.(index)}>
          {frameRects(frame, palette, scale, `f${index}`)}
        </g>
      ))}
    </svg>
  );
}

/** 世界主体的一枚徽记 */
export function EmblemSvg({
  id,
  name,
  kind,
  skin,
  scale,
}: {
  id: string;
  name: string;
  kind: EntityKind;
  skin: ScenarioSkin;
  scale: number;
}) {
  const emblem = emblemFor({ id, name, kind }, skin);
  return (
    <PixelFrame
      frames={emblem.frames}
      palette={emblem.palette}
      scale={scale}
      label={`${name}的徽记`}
    />
  );
}

/** 顶栏左边那枚"一条正在分叉的世界线"。它是观测台的印章 */
export function WorldlineMarkSvg({ skin, scale }: { skin: ScenarioSkin; scale: number }) {
  const emblem = worldlineEmblem(skin);
  return (
    <PixelFrame
      frames={emblem.frames}
      palette={emblem.palette}
      scale={scale}
      label={emblem.label}
    />
  );
}

/**
 * 舞台小人的色板微调。
 *
 * 同一套规则搬自 entity-emblem 的 emblemPalette:同一个 shift 永远长成同一个人。
 * 于是"环带的配电站值守"在第一波和第五波里是同一个人,玩家认得出来。
 */
export function voicePalette(skin: ScenarioSkin, shift: number): Record<string, string> {
  const p = skin.pixel;
  const s = ((shift % 3) + 3) % 3;
  return {
    x: s === 0 ? p.x : s === 1 ? p.y : p.e,
    o: p.o,
    y: p.y,
    e: s === 2 ? p.x : p.e,
  };
}

/** 舞台上开口的小人。两帧的显隐交给 CSS,只有 .talking 时才点头 */
export function VoiceSvg({
  archetype,
  skin,
  shift,
  scale,
  label,
}: {
  archetype: WitnessArchetype;
  skin: ScenarioSkin;
  shift: number;
  scale: number;
  label: string;
}) {
  const sprite = witnessSprite(archetype, skin, label);
  return (
    <PixelFrame
      frames={sprite.frames}
      palette={voicePalette(skin, shift)}
      scale={scale}
      label={label}
      frameClassName={(index) => `f${index}`}
    />
  );
}

/**
 * 牌桌旁边那位见证者。
 *
 * 与舞台小人同一套造型,但它**不带** .f0/.f1 的显隐规则(原型的 .stand 也不在
 * .voice .fig 里面),两帧因此叠在一起 —— 观感上是一个更实心的小人。
 * 这一点是照搬原型的,不是遗漏。
 */
export function StandSvg({
  archetype,
  skin,
  scale,
  label,
}: {
  archetype: WitnessArchetype;
  skin: ScenarioSkin;
  scale: number;
  label: string;
}) {
  const sprite = witnessSprite(archetype, skin, label);
  return <PixelFrame frames={sprite.frames} palette={sprite.palette} scale={scale} label={label} />;
}

interface PixelRect {
  x: number;
  y: number;
  width: number;
  fill: string;
}

/** 同一行连续同色像素合并成一个 rect,节点数直接砍一个量级 */
function frameToRects(frame: readonly string[], palette: Record<string, string>): PixelRect[] {
  const rects: PixelRect[] = [];

  frame.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x];
      const fill = palette[key];
      if (!fill) {
        x += 1;
        continue;
      }
      let width = 1;
      while (x + width < row.length && row[x + width] === key) width += 1;
      rects.push({ x, y, width, fill });
      x += width;
    }
  });

  return rects;
}

interface PixelSpriteProps {
  frames: readonly (readonly string[])[];
  palette: Record<string, string>;
  /** 单个像素的显示边长 */
  scale?: number;
  /** 播放一轮的毫秒数 */
  duration?: number;
  className?: string;
  label: string;
}

export function PixelSprite({
  frames,
  palette,
  scale = 4,
  duration = 720,
  className,
  label,
}: PixelSpriteProps) {
  if (!frames.length) return null;

  const width = frames[0][0]?.length ?? 0;
  const height = frames[0].length;
  const total = frames.length;
  const keyTimes = frames.map((_, index) => index / total).join(";");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width * scale}
      height={height * scale}
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
      className={className}
      style={{ imageRendering: "pixelated", flexShrink: 0 }}
    >
      <title>{label}</title>
      {frames.map((frame, frameIndex) => {
        const values = frames.map((_, index) => (index === frameIndex ? 1 : 0)).join(";");
        return (
          <g key={frameIndex} opacity={frameIndex === 0 ? 1 : 0}>
            <animate
              attributeName="opacity"
              values={values}
              keyTimes={keyTimes}
              calcMode="discrete"
              dur={`${duration}ms`}
              repeatCount="indefinite"
            />
            {frameToRects(frame, palette).map((rect) => (
              <rect
                key={`${rect.x}-${rect.y}-${rect.width}`}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={1}
                fill={rect.fill}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

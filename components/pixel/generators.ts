/**
 * 程序化像素帧生成器:纯函数、无随机,服务端与客户端渲染结果一致。
 * 每个生成器输出若干帧字符网格,交给 PixelSprite 循环播放。
 */

type Grid = string[][];

function makeGrid(width: number, height: number): Grid {
  return Array.from({ length: height }, () => Array<string>(width).fill("."));
}

function seal(grid: Grid): string[] {
  return grid.map((row) => row.join(""));
}

function put(grid: Grid, x: number, y: number, char: string) {
  if (y < 0 || y >= grid.length) return;
  if (x < 0 || x >= (grid[y]?.length ?? 0)) return;
  grid[y][x] = char;
}

/** 羽状植物:主茎 + 对生小叶,随帧摆动 */
export function plantFrames(width: number, height: number, count: number, leaf = 3): string[][] {
  const frames: string[][] = [];
  const mid = Math.floor(width / 2);

  for (let f = 0; f < count; f += 1) {
    const grid = makeGrid(width, height);
    const phase = (f / count) * Math.PI * 2;

    for (let y = height - 1; y >= 1; y -= 1) {
      const t = (height - 1 - y) / (height - 1);
      const bend = Math.round(Math.sin(phase + t * 1.9) * t * 2);
      const stemX = mid + bend;
      put(grid, stemX, y, "x");

      if ((height - y) % 2 === 0) {
        const len = Math.max(1, Math.round(leaf * (1 - t * 0.75)));
        for (let i = 1; i <= len; i += 1) {
          put(grid, stemX - i, y + Math.floor(i / 2), i === len ? "o" : "x");
          put(grid, stemX + i, y + Math.floor(i / 2), i === len ? "o" : "x");
        }
      }
    }

    frames.push(seal(grid));
  }

  return frames;
}

/** 山体 + 上升的烟/火 */
export function peakFrames(width: number, height: number, count: number): string[][] {
  const frames: string[][] = [];
  const base = height - 1;
  const peakTop = 3;

  for (let f = 0; f < count; f += 1) {
    const grid = makeGrid(width, height);

    for (let y = peakTop; y <= base; y += 1) {
      const t = (y - peakTop) / (base - peakTop);
      const half = Math.round(t * (width / 2 - 1));
      const mid = Math.floor(width / 2);
      for (let x = mid - half; x <= mid + half; x += 1) {
        put(grid, x, y, y === peakTop ? "y" : "x");
      }
      put(grid, mid - half, y, "o");
      put(grid, mid + half, y, "o");
    }

    const mid = Math.floor(width / 2);
    for (let i = 0; i < 3; i += 1) {
      const step = (f + i) % count;
      const y = peakTop - 1 - step;
      const x = mid + Math.round(Math.sin(step * 1.2 + f) * 1);
      put(grid, x, y, i === 0 ? "e" : "y");
    }

    frames.push(seal(grid));
  }

  return frames;
}

/** 球体 + 倾斜环 + 环上运动的卫星 */
export function orbFrames(width: number, height: number, count: number): string[][] {
  const frames: string[][] = [];
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const radius = Math.min(cx, cy) * 0.6;

  for (let f = 0; f < count; f += 1) {
    const grid = makeGrid(width, height);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          put(grid, x, y, dist > radius - 1 ? "o" : dx < 0 ? "x" : "y");
        }
      }
    }

    const ringRx = radius + 2.2;
    const ringRy = radius * 0.45;
    for (let i = 0; i < 72; i += 1) {
      const angle = (i / 72) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(angle) * ringRx);
      const y = Math.round(cy + Math.sin(angle) * ringRy);
      put(grid, x, y, "e");
    }

    const satAngle = (f / count) * Math.PI * 2;
    put(
      grid,
      Math.round(cx + Math.cos(satAngle) * ringRx),
      Math.round(cy + Math.sin(satAngle) * ringRy),
      "y",
    );

    frames.push(seal(grid));
  }

  return frames;
}

/** 双螺旋,横向相位滚动 */
export function helixFrames(width: number, height: number, count: number): string[][] {
  const frames: string[][] = [];

  for (let f = 0; f < count; f += 1) {
    const grid = makeGrid(width, height);
    const offset = (f / count) * Math.PI * 2;

    for (let x = 0; x < width; x += 1) {
      const t = (x / width) * Math.PI * 2;
      const a = Math.round(((Math.sin(t + offset) + 1) / 2) * (height - 1));
      const b = Math.round(((Math.sin(t + offset + Math.PI) + 1) / 2) * (height - 1));
      put(grid, x, a, "x");
      put(grid, x, b, "y");
      if (x % 2 === 0) {
        const from = Math.min(a, b);
        const to = Math.max(a, b);
        for (let y = from + 1; y < to; y += 1) put(grid, x, y, "o");
      }
    }

    frames.push(seal(grid));
  }

  return frames;
}

/** 塔/灯柱 + 塔尖向上起伏的光柱 */
export function beaconFrames(width: number, height: number, count: number): string[][] {
  const frames: string[][] = [];
  const mid = Math.floor(width / 2);
  const top = Math.max(3, Math.round(height * 0.28));

  for (let f = 0; f < count; f += 1) {
    const grid = makeGrid(width, height);

    for (let y = top; y < height; y += 1) {
      const half = y > height - 4 ? 3 : y > height - 8 ? 2 : 1;
      for (let x = mid - half; x <= mid + half; x += 1) {
        put(grid, x, y, x === mid - half || x === mid + half ? "o" : "x");
      }
    }

    // 塔尖光柱:高度逐帧起伏,顶端最亮,像素放大后依然干净
    put(grid, mid, top - 1, "e");
    const beam = (f % 3) + 1;
    for (let i = 1; i <= beam; i += 1) {
      const y = top - 1 - i;
      if (y < 0) break;
      put(grid, mid, y, i === beam ? "e" : "y");
    }

    frames.push(seal(grid));
  }

  return frames;
}

/** 旗杆 + 波浪旗面 */
export function bannerFrames(width: number, height: number, count: number): string[][] {
  const frames: string[][] = [];
  const pole = 1;

  for (let f = 0; f < count; f += 1) {
    const grid = makeGrid(width, height);
    const phase = (f / count) * Math.PI * 2;

    for (let y = 0; y < height; y += 1) put(grid, pole, y, "o");

    const clothTop = 2;
    const clothBottom = height - 4;
    for (let y = clothTop; y <= clothBottom; y += 1) {
      const wobble = Math.round(Math.sin(phase + (y - clothTop) * 0.7) * 1.5);
      const end = width - 2 + wobble;
      for (let x = pole + 1; x <= end; x += 1) {
        if (x >= width) break;
        put(grid, x, y, y === clothTop || y === clothBottom ? "o" : x > end - 2 ? "y" : "x");
      }
    }

    frames.push(seal(grid));
  }

  return frames;
}

/** 器物剪影 + 自上而下的扫描高光 */
export function relicFrames(width: number, height: number, count: number): string[][] {
  const frames: string[][] = [];

  for (let f = 0; f < count; f += 1) {
    const grid = makeGrid(width, height);
    const left = 1;
    const right = width - 2;
    const top = 3;
    const bottom = height - 2;

    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        const edge = x === left || x === right || y === bottom;
        put(grid, x, y, edge ? "o" : "x");
      }
    }
    for (let x = left - 1; x <= right + 1; x += 1) put(grid, x, top - 1, "o");

    const scanY = top + Math.round((f / count) * (bottom - top));
    for (let x = left; x <= right; x += 1) put(grid, x, scanY, "y");
    put(grid, Math.floor((left + right) / 2), top - 2, "e");

    frames.push(seal(grid));
  }

  return frames;
}

/** 蛋:裂纹随帧加深,最后一帧冒出眼睛 */
export function eggFrames(width: number, height: number, count: number): string[][] {
  const frames: string[][] = [];
  const cx = (width - 1) / 2;
  const rx = width / 2 - 0.5;
  const ry = height / 2 - 0.5;

  for (let f = 0; f < count; f += 1) {
    const grid = makeGrid(width, height);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const nx = (x - cx) / rx;
        const ny = (y - (height - 1) / 2) / ry;
        if (nx * nx + ny * ny <= 1) {
          const shell = nx * nx + ny * ny > 0.62;
          put(grid, x, y, shell ? "x" : "y");
        }
      }
    }

    const crackDepth = Math.round(((f + 1) / count) * (height - 4));
    for (let i = 0; i <= crackDepth; i += 1) {
      const y = 1 + i;
      const x = Math.round(cx + Math.sin(i * 1.1) * 1.6);
      put(grid, x, y, "o");
      put(grid, x + 1, y, "o");
    }

    if (f === count - 1) {
      put(grid, Math.round(cx) - 1, 3, "e");
      put(grid, Math.round(cx) + 1, 3, "e");
    }

    frames.push(seal(grid));
  }

  return frames;
}

import type { ScenarioSkin } from "@/lib/scenario-skin";
import type { EntityKind } from "@/lib/worldline";

/**
 * 世界主体的像素徽记。
 *
 * 立绘体系(portraits.ts)服务"某个人",这套徽记服务"某种力量"。
 * 每种 EntityKind 一个固定造型:政权是城垛、生态是树冠、行星系统是带环球体……
 * 同一个主体 id 只影响色板微调,不影响造型 -- 一眼就能认出这是什么,才是徽记的职责。
 *
 * 全部纯函数、无随机,SSR 与 CSR 一致。
 */

const SIZE = 16;

function makeGrid(): string[][] {
  return Array.from({ length: SIZE }, () => Array<string>(SIZE).fill("."));
}

function seal(grid: string[][]): string[] {
  return grid.map((row) => row.join(""));
}

function put(grid: string[][], x: number, y: number, key: string) {
  if (y < 0 || y >= SIZE || x < 0 || x >= SIZE) return;
  grid[y][x] = key;
}

function rect(grid: string[][], x: number, y: number, w: number, h: number, key: string) {
  for (let i = 0; i < w; i += 1) {
    for (let j = 0; j < h; j += 1) put(grid, x + i, y + j, key);
  }
}

/** 圆盘点阵:徽记里所有球体(生态、行星、智能)共用 */
function disc(grid: string[][], cx: number, cy: number, radius: number, key: string) {
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (Math.hypot(x - cx, y - cy) <= radius) put(grid, x, y, key);
    }
  }
}

/** Bresenham 直线:徽记里的连线(关系、因果、轨道)全靠它 */
function line(
  grid: string[][],
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  key: string,
) {
  let x = fromX;
  let y = fromY;
  const deltaX = Math.abs(toX - fromX);
  const deltaY = Math.abs(toY - fromY);
  const stepX = fromX < toX ? 1 : -1;
  const stepY = fromY < toY ? 1 : -1;
  let error = deltaX - deltaY;

  for (;;) {
    put(grid, x, y, key);
    if (x === toX && y === toY) break;
    const doubled = 2 * error;
    if (doubled > -deltaY) {
      error -= deltaY;
      x += stepX;
    }
    if (doubled < deltaX) {
      error += deltaX;
      y += stepY;
    }
  }
}

/**
 * 造型表:每种主体一个 16×16 字符网格。
 * x 主色 / o 暗部 / y 高光 / e 点睛色。
 */
const GLYPHS: Record<EntityKind, (grid: string[][]) => void> = {
  /** 政权:城垛 + 门洞,一眼是"一座有秩序的城" */
  state: (grid) => {
    rect(grid, 1, 7, 14, 8, "x");
    for (const x of [1, 4, 7, 10, 13]) rect(grid, x, 4, 2, 3, "x");
    rect(grid, 1, 14, 14, 1, "o");
    rect(grid, 7, 9, 2, 6, "e");
    put(grid, 7, 6, "y");
    put(grid, 8, 6, "y");
  },
  /** 势力:两面交错的旗,表示并立而非统一 */
  faction: (grid) => {
    line(grid, 3, 3, 3, 13, "o");
    line(grid, 12, 3, 12, 13, "o");
    rect(grid, 4, 3, 5, 3, "x");
    rect(grid, 7, 3, 2, 3, "y");
    rect(grid, 8, 8, 5, 3, "x");
    rect(grid, 8, 8, 2, 3, "y");
  },
  /** 人群:三个高矮不一的剪影,强调"是很多人" */
  population: (grid) => {
    disc(grid, 8, 4, 2, "x");
    disc(grid, 4, 6, 1.8, "y");
    disc(grid, 12, 6, 1.8, "y");
    rect(grid, 6, 7, 5, 6, "x");
    rect(grid, 2, 9, 3, 5, "y");
    rect(grid, 11, 9, 3, 5, "y");
    rect(grid, 2, 14, 12, 1, "o");
  },
  /** 生态系统:树冠 + 根系,自下而上的循环 */
  ecosystem: (grid) => {
    disc(grid, 8, 6, 4.4, "x");
    disc(grid, 5, 5, 2, "y");
    disc(grid, 11, 7, 2, "y");
    rect(grid, 7, 10, 2, 4, "o");
    line(grid, 8, 10, 4, 14, "e");
    line(grid, 8, 10, 12, 14, "e");
    put(grid, 8, 2, "e");
  },
  /** 物种:一串脚印/个体,强调"同一类生命" */
  species: (grid) => {
    disc(grid, 5, 5, 3, "x");
    put(grid, 4, 4, "e");
    disc(grid, 11, 9, 3, "x");
    put(grid, 10, 8, "e");
    rect(grid, 3, 9, 4, 1, "o");
    rect(grid, 9, 13, 4, 1, "o");
  },
  /** 企业:带上升箭头的方章,资本的形状 */
  company: (grid) => {
    rect(grid, 2, 4, 12, 10, "x");
    rect(grid, 2, 4, 12, 1, "o");
    rect(grid, 2, 13, 12, 1, "o");
    line(grid, 4, 11, 8, 7, "y");
    line(grid, 8, 7, 12, 9, "y");
    put(grid, 8, 6, "e");
    put(grid, 7, 6, "e");
  },
  /** 机构:档案柜/建筑立面,规整的开窗 */
  institution: (grid) => {
    rect(grid, 3, 5, 10, 10, "x");
    rect(grid, 2, 4, 12, 1, "o");
    rect(grid, 3, 14, 10, 1, "o");
    for (const y of [7, 10, 13]) {
      for (const x of [5, 8, 11]) put(grid, x, y, "e");
    }
  },
  /** 技术系统:节点连成的网络,亮起的节点表示扩散 */
  technology: (grid) => {
    line(grid, 3, 4, 12, 4, "o");
    line(grid, 3, 4, 3, 12, "o");
    line(grid, 12, 4, 12, 12, "o");
    line(grid, 3, 12, 12, 12, "o");
    line(grid, 3, 4, 12, 12, "o");
    for (const [x, y] of [
      [3, 4],
      [12, 4],
      [3, 12],
      [12, 12],
    ]) {
      rect(grid, x - 1, y - 1, 3, 3, "x");
    }
    rect(grid, 6, 6, 4, 4, "y");
    put(grid, 7, 7, "e");
    put(grid, 8, 8, "e");
  },
  /** AI:环形 + 中心眼,表示"在观察的智能" */
  ai: (grid) => {
    disc(grid, 8, 8, 6.4, "x");
    disc(grid, 8, 8, 4.2, "o");
    disc(grid, 8, 8, 2.2, "e");
    for (const [x, y] of [
      [8, 1],
      [8, 14],
      [1, 8],
      [14, 8],
    ]) {
      put(grid, x, y, "y");
    }
  },
  /** 异星文明:不对称的三足结构,刻意不像人类造物 */
  alien: (grid) => {
    disc(grid, 8, 4, 2.6, "x");
    line(grid, 8, 6, 3, 13, "y");
    line(grid, 8, 6, 13, 13, "y");
    line(grid, 8, 6, 8, 13, "x");
    rect(grid, 6, 4, 5, 1, "e");
    put(grid, 8, 2, "e");
    put(grid, 8, 13, "e");
  },
  /** 行星系统:带环球体,自然尺度的代表 */
  "planetary-system": (grid) => {
    disc(grid, 8, 7, 4.4, "x");
    disc(grid, 6, 6, 1.6, "y");
    for (let x = 0; x < SIZE; x += 1) {
      const offset = Math.round((x - 8) * 0.28);
      put(grid, x, 11 + offset, "e");
    }
    put(grid, 2, 9, "e");
    put(grid, 14, 12, "e");
    put(grid, 8, 14, "o");
  },
};

/** 徽记色板:沿用皮肤的像素色,保证与整屏演出同一套语言 */
function emblemPalette(skin: ScenarioSkin, seed: number): Record<string, string> {
  const pixel = skin.pixel;
  const shift = seed % 3;
  return {
    x: shift === 0 ? pixel.x : shift === 1 ? pixel.y : pixel.e,
    o: pixel.o,
    y: pixel.y,
    e: shift === 2 ? pixel.x : pixel.e,
  };
}

export interface EmblemDef {
  frames: string[][];
  palette: Record<string, string>;
  label: string;
}

/** FNV-1a:同一个主体永远用同一套色板微调 */
function hashOf(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/** 一个主体一枚徽记 */
export function emblemFor(
  entity: { id: string; name: string; kind: EntityKind },
  skin: ScenarioSkin,
): EmblemDef {
  const grid = makeGrid();
  GLYPHS[entity.kind](grid);
  const seed = hashOf(`${entity.id}:${entity.name}`);

  return {
    frames: [seal(grid)],
    palette: emblemPalette(skin, seed),
    label: `${entity.name}的徽记`,
  };
}

/** 世界线徽记:导演印章的继承者,表示"一条正在分叉的世界线" */
export function worldlineEmblem(skin: ScenarioSkin): EmblemDef {
  const grid = makeGrid();
  const trunkX = 8;
  const forkY = 7;

  line(grid, trunkX, 14, trunkX, forkY, "x");
  put(grid, trunkX, 15, "e");
  line(grid, trunkX, forkY, 4, 3, "y");
  line(grid, trunkX, forkY, 12, 3, "y");
  rect(grid, 3, 2, 3, 3, "e");
  rect(grid, 11, 2, 3, 3, "e");
  rect(grid, 7, 13, 3, 3, "e");

  return {
    frames: [seal(grid)],
    palette: {
      x: skin.pixel.x,
      o: skin.pixel.o,
      y: skin.pixel.y,
      e: skin.pixel.e,
    },
    label: "世界线徽记",
  };
}

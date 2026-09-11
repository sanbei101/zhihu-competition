import type { ScenarioSkin } from "@/lib/scenario-skin";
import type { CharacterArchetype } from "@/lib/world-cast";

/**
 * 议事厅舞台用的角色立绘:手工像素部件按坐标裁剪合成。
 *
 * 一张立绘 = 躯干 + 头 + 胡须 + 冠帽 + 手持物,各部件单独手绘、共用一个 24×28 画布。
 * 这样 4 种躯干 × 5 种冠帽 × 3 种胡须 × 5 种手持物 能组合出上百种造型,
 * 比一个原型硬画一张省得多,而且新增原型只要补一行映射。
 *
 * 全部是纯函数、无随机:同一个角色 id 永远得到同一张脸,服务端与客户端渲染一致。
 */

type Grid = string[];

const CANVAS_W = 24;
const CANVAS_H = 28;

/** 各部件的落点。躯干最底行正好压在画布底边,人物才像'踩在同一条地平线'。 */
const HEAD_AT = { x: 8, y: 4 };
const HAT_AT = { x: 5, y: 0 };
const BEARD_AT = { x: 8, y: 9 };
const BODY_AT = { x: 5, y: 12 };
const PROP_AT = { x: 19, y: 14 };

/** 底色板里没有肤色,皮肤全局固定,再按皮肤色调混出暗面,免得换个主题人就变色 */
const SKIN_TONE = "#e9c6a2";

// ==================== 部件:头与须 ====================

/** 正中脸:两侧 h 是鬓角,k 是眼,S 是颊影 */
const HEAD: Grid = [
  "..hhhh..",
  ".hhhhhh.",
  ".hssssh.",
  ".hskksh.",
  ".hssssh.",
  ".hsSSsh.",
  "..ssss..",
  "...ss...",
];

const HEADS: Record<string, Grid> = {
  composed: HEAD,
  sharp: [
    "..hhhh..",
    ".hhhhhh.",
    ".hssssh.",
    ".hskksh.",
    ".hssmsh.",
    ".hsSSsh.",
    "..ssss..",
    "...ss...",
  ],
  round: [
    "...hh...",
    "..hhhh..",
    ".hssssh.",
    ".hskksh.",
    ".hssmsh.",
    ".hsSSsh.",
    ".ssssss.",
    "..ssss..",
  ],
  guarded: [
    "..hhhh..",
    ".hhhhhh.",
    ".hssssh.",
    ".hskksh.",
    ".hssmsh.",
    ".hSSSsh.",
    "..ssss..",
    "...ss...",
  ],
};

const BEARDS: Record<string, Grid | null> = {
  none: null,
  short: ["........", "........", "..hhhh..", ".hhhhhh.", "..hhhh.."],
  long: ["........", "........", ".hhhhhh.", ".hhhhhh.", "..hhhh.."],
};

// ==================== 部件:冠帽 ====================

const HATS: Record<string, Grid> = {
  /** 进贤冠:文臣的高冠。最宽处只比头宽两像素,否则会宽过肩线 */
  guan: ["......hhhh....", ".....hHHHHh...", "....hhhhhhhh..", "...hhhhhhhhhh.", ".............."],
  /** 幞头:软巾,两侧垂带 */
  jin: [".....hhhh.....", "....hhhhhh....", "...hhhhhhhh...", "..hhhhhhhhhh..", "..hh......hh.."],
  /** 兜鍪:盔缨 + 护耳 */
  kui: ["......ee......", ".....hHHh.....", "....hHHHHh....", "...hhhhhhhhhh.", "..eh......he.."],
  /** 短发:不戴帽,只有一层贴头皮的短发 */
  cap: ["....hhhhhh....", "...hhhhhhhh...", "..hhhhhhhhhh..", "..hhhhhhhhhh..", ".............."],
  /** 斗笠:宽檐草帽,本来就该比肩宽 */
  dou: ["......ee......", ".....yyyy.....", "...yyyyyyyy...", ".yyyyyyyyyyyy.", "yyyyyyyyyyyyyy"],
};

// ==================== 部件:躯干 ====================

const BODIES: Record<string, Grid> = {
  /** 文士长袍:宽袖、交领、束腰、下摆外扩 */
  robe: [
    "....oooooo....",
    "..ooxxxxxxoo..",
    "ooxxxxxxxxxxoo",
    "ooxxxxxxxxxxoo",
    ".oxxxyyxxxxxo.",
    ".oxxxyyxxxxxo.",
    ".oxxxeeexxxxo.",
    ".oxxxeeexxxxo.",
    ".oxxxxxxxxxxo.",
    ".oxxxxxxxxxxo.",
    ".oxxxxxxxxxxo.",
    ".oxxxxxxxxxxo.",
    "oxxxxxxxxxxxxo",
    "oxxxxxxxxxxxxo",
    "oxxxxxxxxxxxxo",
    "oooooooooooooo",
  ],
  /** 甲胄:分片肩甲、胸甲、宽腰带 */
  armor: [
    "..oooo..oooo..",
    ".ooxxxxooxxxxo",
    ".oxxxxxxxxxxo.",
    "ooxxxxxxxxxxoo",
    ".oxxyyyyyyxxo.",
    ".oxxyyyyyyxxo.",
    ".oxeeeeeeeexo.",
    ".oxxxxxxxxxxo.",
    ".oxxxxxxxxxxo.",
    ".oxxxxxxxxxxo.",
    ".oxxxxxxxxxxo.",
    ".ooxxxxxxxxoo.",
    ".ooxxxxxxxxoo.",
    "ooxxxxxxxxxxoo",
    "ooxxxxxxxxxxoo",
    "oooooooooooooo",
  ],
  /** 短打:紧身衣 + 裤腿分开 */
  tunic: [
    "....oooooo....",
    "...oxxxxxxo...",
    "...oxxxxxxo...",
    "...oxxxxxxo...",
    "...oyyyyyyo...",
    "...oxxxxxxo...",
    "...oxxxxxxo...",
    "...oeeeeeeo...",
    "...ooxxxxoo...",
    "...oxxxxxxo...",
    "...oxxxxxxo...",
    "...ooxxxxoo...",
    "...ooxxxxoo...",
    "...ooo..ooo...",
    "...ooo..ooo...",
    "..oooo..oooo..",
  ],
  /** 外套/白褂:翻领、前襟、束腰 */
  coat: [
    "..oooo..oooo..",
    ".oxxxxooxxxxo.",
    ".oxxxxxxxxxxo.",
    ".oxxxwwwwxxxo.",
    ".oxxxwwwwxxxo.",
    ".oxxxwwwwxxxo.",
    ".oxxxeexxxxxo.",
    ".oxxxxxexxxxxo",
    ".oxxxxxxxxxxo.",
    ".oxxxxxxxxxxo.",
    ".oxxxxxxxxxxo.",
    "oxxxxxxxxxxxxo",
    "oxxxxxxxxxxxxo",
    "ooxxxxxxxxxxoo",
    "ooxxxxxxxxxxoo",
    "oooooooooooooo",
  ],
};

// ==================== 部件:手持物 ====================

const PROPS: Record<string, Grid | null> = {
  none: null,
  /** 刀剑:竖握 */
  blade: [
    "..y..",
    "..y..",
    "..y..",
    "..y..",
    "..y..",
    "..y..",
    ".eee.",
    ".eee.",
    "..e..",
    "..o..",
    "..o..",
  ],
  /** 节杖:顶端一面小旗 */
  staff: [
    "ee...",
    "eee..",
    "ee...",
    "..y..",
    "..y..",
    "..y..",
    "..y..",
    "..y..",
    "..y..",
    "..y..",
    "..y..",
  ],
  /** 数据板:掌中一块亮屏 */
  tablet: [
    ".....",
    ".....",
    ".....",
    ".....",
    ".ooo.",
    ".owwo",
    ".owwo",
    ".owwo",
    ".ooo.",
    ".....",
    ".....",
  ],
  /** 钱袋/行囊 */
  sack: [
    ".....",
    ".....",
    ".....",
    ".....",
    "..e..",
    ".eee.",
    "eeeee",
    "eeeee",
    ".eee.",
    ".....",
    ".....",
  ],
};

// ==================== 原型 → 部件池 ====================

interface ArchetypeKit {
  hats: string[];
  bodies: string[];
  beards: string[];
  props: string[];
  faces: string[];
  gestures: string[];
  motion: PortraitMotion;
}

export type PortraitMotion = "scribe" | "guard" | "plead" | "weigh" | "scan" | "work";

const GESTURES: Record<string, Grid> = {
  /** 持笏低眉:文臣的手臂收在袖中,保留手部轮廓。 */
  scribe: ["......", ".s....", ".ss...", "..s..."],
  /** 按住刀柄:武将的一只手落在腰侧。 */
  guard: ["......", "....s.", "....ss", ".....s"],
  /** 展袖示意:使者的手臂朝对面打开。 */
  plead: ["s.....", "ss....", ".s....", ".s...."],
  /** 托住钱袋:商贾的手势更低,轮廓也更圆。 */
  weigh: ["......", "....s.", "...ss.", "....s."],
  /** 举板核对:技术人员一只手抬到胸前。 */
  scan: ["...s..", "...ss.", "....s.", "....s."],
  /** 扛包/递物:平民的手臂自然垂下。 */
  work: ["s.....", "ss....", ".s....", ".s...."],
};

/**
 * 原型 → 部件池。池子里重复写一项就是加权:同一原型的人不必各各不同,
 * 但胡须、手持物、衣着三处一起抽,撞脸的概率就很低了。
 */
const ARCHETYPE_KITS: Record<CharacterArchetype, ArchetypeKit> = {
  official: {
    hats: ["guan", "jin", "cap"],
    bodies: ["robe"],
    beards: ["long", "short", "none", "long"],
    props: ["none", "tablet"],
    faces: ["composed", "sharp"],
    gestures: ["scribe"],
    motion: "scribe",
  },
  general: {
    hats: ["kui", "guan"],
    bodies: ["armor"],
    beards: ["short", "short", "long"],
    props: ["blade"],
    faces: ["sharp", "guarded"],
    gestures: ["guard"],
    motion: "guard",
  },
  envoy: {
    hats: ["jin", "guan", "cap"],
    bodies: ["robe"],
    beards: ["none", "short"],
    props: ["staff"],
    faces: ["composed", "round"],
    gestures: ["plead"],
    motion: "plead",
  },
  magnate: {
    hats: ["jin", "cap", "guan"],
    bodies: ["robe", "coat"],
    beards: ["short", "none", "none"],
    props: ["sack"],
    faces: ["round", "composed"],
    gestures: ["weigh"],
    motion: "weigh",
  },
  technician: {
    hats: ["cap", "jin", "cap"],
    bodies: ["coat"],
    beards: ["none", "none", "short"],
    props: ["tablet"],
    faces: ["sharp", "round"],
    gestures: ["scan"],
    motion: "scan",
  },
  commoner: {
    hats: ["dou", "cap", "jin"],
    bodies: ["tunic"],
    beards: ["short", "none"],
    props: ["sack", "staff", "none"],
    faces: ["round", "composed"],
    gestures: ["work"],
    motion: "work",
  },
};

// ==================== 调色板 ====================

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : clean;
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function toHex(channels: [number, number, number]): string {
  return `#${channels
    .map((value) =>
      Math.max(0, Math.min(255, Math.round(value)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** 把 a 朝 b 混过去 t 比例,用来从皮肤色板上派生出立绘需要的深浅色 */
function mix(a: string, b: string, t: number): string {
  const from = parseHex(a);
  const to = parseHex(b);
  return toHex([
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ]);
}

/**
 * 立绘色板全部从皮肤的像素色演变而来,所以同一套立绘在 10 个主题下自动改色。
 * 肤色固定,只把它按皮肤暗部压暗一点做颊影与脖颈。
 * seed 用来给每个角色微调发色深浅 -- 不然同原型的两个人会像双胞胎。
 */
export function portraitPaletteOf(skin: ScenarioSkin, seed = 0): Record<string, string> {
  const pixel = skin.pixel;
  // 同一套皮肤下按角色微调三处,避免同原型的两个人像双胞胎:
  // 发色深浅、冠饰用高光色还是点睛色、衣色朝亮面还是暗面偏一点。
  const shift = seed % 5;
  return {
    h: mix(pixel.o, "#000000", 0.08 + shift * 0.07),
    H: seed % 2 === 0 ? pixel.y : pixel.e,
    k: mix(pixel.o, "#000000", 0.4),
    x: mix(pixel.x, seed % 3 === 0 ? pixel.o : pixel.y, 0.1),
    o: mix(pixel.x, pixel.o, 0.6),
    y: pixel.y,
    e: pixel.e,
    s: mix(SKIN_TONE, "#000000", shift * 0.02),
    S: mix(SKIN_TONE, pixel.o, 0.3),
    m: mix(SKIN_TONE, "#000000", 0.58),
    w: "#f2ede0",
  };
}

// ==================== 组合 ====================

function makeCanvas(): string[][] {
  return Array.from({ length: CANVAS_H }, () => Array<string>(CANVAS_W).fill("."));
}

/** 把部件盖到画布上,部件里的 '.' 视为透明 */
function stamp(canvas: string[][], part: Grid, atX: number, atY: number) {
  part.forEach((row, y) => {
    const targetY = atY + y;
    if (targetY < 0 || targetY >= CANVAS_H) return;
    for (let x = 0; x < row.length; x += 1) {
      const key = row[x];
      if (key === ".") continue;
      const targetX = atX + x;
      if (targetX < 0 || targetX >= CANVAS_W) continue;
      canvas[targetY][targetX] = key;
    }
  });
}

function put(canvas: string[][], x: number, y: number, key: string) {
  if (y < 0 || y >= CANVAS_H || x < 0 || x >= CANVAS_W) return;
  canvas[y][x] = key;
}

function drawHumanAnatomy(canvas: string[][], bodyKind: string) {
  // 领口、手与脚把宽袍重新拆回一个能读出姿态的人形。
  put(canvas, 10, 11, "s");
  put(canvas, 11, 11, "s");
  put(canvas, 4, 18, "s");
  put(canvas, 19, 18, "s");

  // 甲胄、短打和外套露出两条腿;长袍保留开衩,不画成机器人方底。
  if (bodyKind === "robe") {
    put(canvas, 11, 24, ".");
    put(canvas, 12, 24, ".");
  } else {
    for (const y of [23, 24, 25, 26]) {
      put(canvas, 11, y, ".");
      put(canvas, 12, y, ".");
      put(canvas, 9, y, "x");
      put(canvas, 10, y, "x");
      put(canvas, 13, y, "x");
      put(canvas, 14, y, "x");
    }
  }
  put(canvas, 8, 27, "o");
  put(canvas, 9, 27, "o");
  put(canvas, 14, 27, "o");
  put(canvas, 15, 27, "o");
}

/** FNV-1a:同一个 id 永远挑到同一套部件 */
function hashOf(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/** 每个部件独立散列,避免'换了帽子就一定是换了衣服'这种成对出现的规律 */
function pick<T>(list: T[], key: string): T {
  return list[hashOf(key) % list.length];
}

// ==================== 导演徽记 ====================

/** Bresenham 直线:徽记里的分岔是算出来的,手写 28 行斜线太容易错 */
function strokeLine(
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
    if (y >= 0 && y < CANVAS_H && x >= 0 && x < CANVAS_W) grid[y][x] = key;
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

/** 十字节点:世界线两端的'事件点' */
function markNode(grid: string[][], x: number, y: number, key: string) {
  const neighbours = [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [offsetX, offsetY] of neighbours) {
    const targetX = x + offsetX;
    const targetY = y + offsetY;
    if (targetY < 0 || targetY >= CANVAS_H) continue;
    if (targetX < 0 || targetX >= CANVAS_W) continue;
    grid[targetY][targetX] = key;
  }
}

/**
 * 世界线导演的徽记:他不是人,所以没有立绘,给他一枚印章。
 * 深色外圈 + 主色盘面 + 一条从底部升起、到中间分成两岔的世界线 --
 * 和界面里那个分叉图标是同一个隐喻,也就省掉了'导演长什么样'这个没法回答的问题。
 */
export function directorEmblem(skin: ScenarioSkin): PortraitDef {
  const grid = makeCanvas();
  const centerX = (CANVAS_W - 1) / 2;
  const centerY = (CANVAS_H - 1) / 2;
  const discRadius = 10.2;
  const faceRadius = 9.2;

  for (let y = 0; y < CANVAS_H; y += 1) {
    for (let x = 0; x < CANVAS_W; x += 1) {
      const distance = Math.hypot(x - centerX, y - centerY);
      if (distance <= faceRadius) grid[y][x] = "x";
      else if (distance <= discRadius) grid[y][x] = "o";
    }
  }

  const forkY = 14;
  // 主干:从底部升到分岔点
  for (let y = forkY; y <= 22; y += 1) {
    grid[y][11] = "y";
    grid[y][12] = "y";
  }
  // 两条支线各朝一边斜上去
  strokeLine(grid, 11, forkY, 6, 8, "y");
  strokeLine(grid, 12, forkY, 17, 8, "y");
  // 三个事件点:源头一个,两个分岔末端各一个
  markNode(grid, 6, 8, "e");
  markNode(grid, 17, 8, "e");
  grid[22][11] = "e";
  grid[22][12] = "e";

  return {
    frames: [grid.map((row) => row.join(""))],
    palette: portraitPaletteOf(skin),
    label: "世界线导演的徽记",
    motion: "director",
  };
}

export interface PortraitDef {
  /** 单帧:律动交给 CSS 动画,不占帧 */
  frames: string[][];
  palette: Record<string, string>;
  label: string;
  motion: PortraitMotion | "director";
}

/** 让不同身份拥有不同重心,说话时也不会全员做同一个上下弹跳。 */
export function portraitMotionClass(motion: PortraitDef["motion"], talking: boolean): string {
  if (motion === "director") {
    return talking ? "animate-portrait-talk" : "animate-portrait-idle";
  }
  if (talking) {
    return {
      scribe: "animate-portrait-scribe-talk",
      guard: "animate-portrait-guard-talk",
      plead: "animate-portrait-plead-talk",
      weigh: "animate-portrait-weigh-talk",
      scan: "animate-portrait-scan-talk",
      work: "animate-portrait-work-talk",
    }[motion];
  }
  return {
    scribe: "animate-portrait-scribe",
    guard: "animate-portrait-guard",
    plead: "animate-portrait-plead",
    weigh: "animate-portrait-weigh",
    scan: "animate-portrait-scan",
    work: "animate-portrait-work",
  }[motion];
}

export interface PortraitSubject {
  id: string;
  name: string;
  identity?: string;
  faction?: string;
  /** 角色阵容一定会给这个字段,所以立绘造型是确定的,不留兜底 */
  archetype: CharacterArchetype;
}

/** 一个角色一张立绘。同一个 id 与名字永远得到同一张,且与皮肤无关地保持特征一致。 */
export function portraitFor(subject: PortraitSubject, skin: ScenarioSkin): PortraitDef {
  const kit = ARCHETYPE_KITS[subject.archetype];
  const key = `${subject.id}:${subject.name}`;
  const seed = hashOf(key);

  const bodyKind = pick(kit.bodies, `${key}:body`);
  const body = BODIES[bodyKind];
  const head = HEADS[pick(kit.faces, `${key}:face`)];
  const beard = BEARDS[pick(kit.beards, `${key}:beard`)];
  const hat = HATS[pick(kit.hats, `${key}:hat`)];
  const prop = PROPS[pick(kit.props, `${key}:prop`)];
  const gesture = GESTURES[pick(kit.gestures, `${key}:gesture`)];

  function frameOf(frame: number): string[] {
    const canvas = makeCanvas();
    stamp(canvas, body, BODY_AT.x, BODY_AT.y);
    drawHumanAnatomy(canvas, bodyKind);
    stamp(canvas, head, HEAD_AT.x, HEAD_AT.y);
    if (beard) stamp(canvas, beard, BEARD_AT.x, BEARD_AT.y);

    // 冠帽最后盖上去,压住头顶那一排头发
    stamp(canvas, hat, HAT_AT.x, HAT_AT.y);
    stamp(canvas, gesture, 3, 16);
    if (prop) stamp(canvas, prop, PROP_AT.x - frame, PROP_AT.y);

    // 第二帧只让道具换一点重心,脸部特征始终保持可读。
    return canvas.map((row) => row.join(""));
  }

  return {
    frames: [frameOf(0), frameOf(1)],
    palette: portraitPaletteOf(skin, seed),
    label: `${subject.name}的立绘`,
    motion: kit.motion,
  };
}

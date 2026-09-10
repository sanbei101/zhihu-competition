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

/** 各部件的落点。躯干最底行正好压在画布底边,人物才像「踩在同一条地平线」。 */
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

const BEARDS: Record<string, Grid | null> = {
  none: null,
  short: ["..hhhh..", ".hhhhhh.", "..hhhh..", "........", "........"],
  long: ["..hhhh..", ".hhhhhh.", ".hhhhhh.", "..hhhh..", "...hh..."],
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
}

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
  },
  general: {
    hats: ["kui", "guan"],
    bodies: ["armor"],
    beards: ["short", "short", "long"],
    props: ["blade"],
  },
  envoy: {
    hats: ["jin", "guan", "cap"],
    bodies: ["robe"],
    beards: ["none", "short"],
    props: ["staff"],
  },
  magnate: {
    hats: ["jin", "cap", "guan"],
    bodies: ["robe", "coat"],
    beards: ["short", "none", "none"],
    props: ["sack"],
  },
  technician: {
    hats: ["cap", "jin", "cap"],
    bodies: ["coat"],
    beards: ["none", "none", "short"],
    props: ["tablet"],
  },
  commoner: {
    hats: ["dou", "cap", "jin"],
    bodies: ["tunic"],
    beards: ["short", "none"],
    props: ["sack", "staff", "none"],
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
 * seed 用来给每个角色微调发色深浅 —— 不然同原型的两个人会像双胞胎。
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

/** FNV-1a:同一个 id 永远挑到同一套部件 */
function hashOf(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/** 每个部件独立散列,避免「换了帽子就一定是换了衣服」这种成对出现的规律 */
function pick<T>(list: T[], key: string): T {
  return list[hashOf(key) % list.length];
}

const ARCHETYPE_KEYWORDS: { archetype: CharacterArchetype; words: string[] }[] = [
  {
    archetype: "general",
    words: ["将", "帅", "军", "兵", "武", "校", "尉", "统帅", "司令", "舰队", "安保", "护"],
  },
  {
    archetype: "technician",
    words: [
      "技术",
      "工程",
      "科学",
      "研究",
      "数据",
      "程序",
      "算",
      "医",
      "实验",
      "学者",
      "博士",
      "监测",
      "机",
    ],
  },
  {
    archetype: "magnate",
    words: ["商", "资", "财", "董事", "老板", "公司", "东家", "钱庄", "贸易", "集团", "掌门"],
  },
  {
    archetype: "envoy",
    words: ["使", "外交", "说客", "谈判", "中间人", "代表", "翻译", "特使", "联络"],
  },
  {
    archetype: "official",
    words: ["相", "臣", "令", "尚书", "官", "幕僚", "参谋", "书记", "市长", "理事", "文书", "监"],
  },
  { archetype: "commoner", words: ["平民", "渔民", "农", "匠", "工", "厨", "船", "牧", "冷库"] },
];

/**
 * 老存档里没有 archetype 字段时的兜底:按身份与阵营的关键词猜一个原型。
 * 猜不到就当文臣 —— 议事厅里这个概率最高。
 */
export function guessArchetype(text: string): CharacterArchetype {
  for (const entry of ARCHETYPE_KEYWORDS) {
    if (entry.words.some((word) => text.includes(word))) return entry.archetype;
  }
  return "official";
}

export interface PortraitDef {
  /** 单帧:律动交给 CSS 动画,不占帧 */
  frames: string[][];
  palette: Record<string, string>;
  label: string;
}

export interface PortraitSubject {
  id: string;
  name: string;
  identity?: string;
  faction?: string;
  archetype?: CharacterArchetype;
}

/** 一个角色一张立绘。同一个 id 与名字永远得到同一张,且与皮肤无关地保持特征一致。 */
export function portraitFor(subject: PortraitSubject, skin: ScenarioSkin): PortraitDef {
  const archetype =
    subject.archetype ??
    guessArchetype(`${subject.identity ?? ""} ${subject.faction ?? ""} ${subject.name}`);
  const kit = ARCHETYPE_KITS[archetype];
  const key = `${subject.id}:${subject.name}`;
  const seed = hashOf(key);

  const canvas = makeCanvas();
  stamp(canvas, BODIES[pick(kit.bodies, `${key}:body`)], BODY_AT.x, BODY_AT.y);
  stamp(canvas, HEAD, HEAD_AT.x, HEAD_AT.y);

  const beard = BEARDS[pick(kit.beards, `${key}:beard`)];
  if (beard) stamp(canvas, beard, BEARD_AT.x, BEARD_AT.y);

  // 冠帽最后盖上去,压住头顶那一排头发
  stamp(canvas, HATS[pick(kit.hats, `${key}:hat`)], HAT_AT.x, HAT_AT.y);

  const prop = PROPS[pick(kit.props, `${key}:prop`)];
  if (prop) stamp(canvas, prop, PROP_AT.x, PROP_AT.y);

  return {
    frames: [canvas.map((row) => row.join(""))],
    palette: portraitPaletteOf(skin, seed),
    label: `${subject.name}的立绘`,
  };
}

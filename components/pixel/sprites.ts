import {
  bannerFrames,
  beaconFrames,
  eggFrames,
  helixFrames,
  orbFrames,
  peakFrames,
  plantFrames,
  relicFrames,
} from "@/components/pixel/generators";
import type { ScenarioSkin } from "@/lib/scenario-skin";

/** hero 站 C 位,prop 在地面排列,sky 悬在天上 */
export type SpriteSlot = "hero" | "prop" | "sky";

export interface SpriteDef {
  id: string;
  label: string;
  slot: SpriteSlot;
  frames: string[][];
  palette: Record<string, string>;
  scale?: number;
  duration?: number;
}

/** 手绘:霸王龙行走,头朝右、尾拖地 */
const TREX_FRAMES: string[][] = [
  [
    "...........oooo.",
    "..........oxxxo.",
    ".........oxexxo.",
    "...oooo.oxxxxo..",
    ".ooxxxoooxxxxo..",
    "ooxxxxxoxxxxxo..",
    ".oxxxxxxxxxxxo..",
    ".oxxxxxxxxxxo...",
    "..oxxxxxxxxo....",
    "..ooxxxxxoo.....",
    "..ooxxooxxo.....",
    ".ooo..oxxo......",
    ".oo...ooo.......",
  ],
  [
    "................",
    "...........oooo.",
    "..........oxxxo.",
    "....oooo.oxexxo.",
    "..ooxxxoooxxxxo.",
    ".oxxxxxoxxxxxxo.",
    "ooxxxxxxxxxxxxo.",
    ".oxxxxxxxxxxxo..",
    ".oxxxxxxxxxxo...",
    "..ooxxxxxxoo....",
    "..ooxxooxxo.....",
    "..ooo.oxxo......",
    "...oo.ooo.......",
  ],
];

/** 手绘:翼龙扇翅 */
const PTERO_FRAMES: string[][] = [
  [
    "..o..........o..",
    ".oxo........oxo.",
    ".oxxo..oo..oxxo.",
    "..oxxooxxxooxxo.",
    "...oooxxxxooo...",
    "......ooxoo.....",
    "................",
  ],
  [
    "................",
    "................",
    "o..............o",
    "oxo...oo....oxo.",
    ".oxxooxxxxooxxo.",
    "..ooooxxxxoooo..",
    "......ooxo......",
  ],
];

function paletteOf(skin: ScenarioSkin): Record<string, string> {
  return { o: skin.pixel.o, x: skin.pixel.x, y: skin.pixel.y, e: skin.pixel.e };
}

/**
 * 每个主题一组像素动图,新增主题只需要在下面补一个 case。
 * 首页分区和议事厅都会自动带上对应的场景。
 */
export function spritesForSkin(skin: ScenarioSkin): SpriteDef[] {
  const palette = paletteOf(skin);

  switch (skin.id) {
    case "dino":
      return [
        {
          id: "trex",
          label: "霸王龙巡视领地",
          slot: "hero",
          frames: TREX_FRAMES,
          palette,
          scale: 7,
          duration: 900,
        },
        {
          id: "volcano",
          label: "远方火山冒烟",
          slot: "sky",
          frames: peakFrames(13, 12, 3),
          palette,
          scale: 5,
          duration: 1500,
        },
        {
          id: "fern",
          label: "蕨叶摇曳",
          slot: "prop",
          frames: plantFrames(11, 14, 3, 4),
          palette,
          scale: 5,
          duration: 1200,
        },
        {
          id: "egg",
          label: "巢中恐龙蛋",
          slot: "prop",
          frames: eggFrames(11, 12, 4),
          palette,
          scale: 4,
          duration: 1600,
        },
        {
          id: "ptero",
          label: "翼龙掠过",
          slot: "sky",
          frames: PTERO_FRAMES,
          palette,
          scale: 5,
          duration: 800,
        },
      ];
    case "three-kingdoms":
      return [
        {
          id: "banner",
          label: "旌旗猎猎",
          slot: "hero",
          frames: bannerFrames(14, 14, 4),
          palette,
          scale: 6,
          duration: 900,
        },
        {
          id: "bamboo",
          label: "竹影婆娑",
          slot: "prop",
          frames: plantFrames(9, 14, 3, 2),
          palette,
          scale: 5,
          duration: 1400,
        },
        {
          id: "scroll",
          label: "竹简展开",
          slot: "prop",
          frames: relicFrames(12, 12, 4),
          palette,
          scale: 5,
          duration: 1200,
        },
      ];
    case "qin-han":
      return [
        {
          id: "ding",
          label: "青铜鼎",
          slot: "hero",
          frames: relicFrames(13, 13, 4),
          palette,
          scale: 6,
          duration: 1300,
        },
        {
          id: "standard",
          label: "玄色大纛",
          slot: "sky",
          frames: bannerFrames(12, 13, 4),
          palette,
          scale: 5,
          duration: 1000,
        },
        {
          id: "tally",
          label: "兵符虎符",
          slot: "prop",
          frames: relicFrames(11, 10, 3),
          palette,
          scale: 5,
          duration: 1500,
        },
      ];
    case "tang-song-ming":
      return [
        {
          id: "lantern",
          label: "宫灯摇晃",
          slot: "hero",
          frames: beaconFrames(13, 14, 3),
          palette,
          scale: 6,
          duration: 1400,
        },
        {
          id: "willow",
          label: "垂柳拂岸",
          slot: "prop",
          frames: plantFrames(11, 13, 3, 4),
          palette,
          scale: 5,
          duration: 1500,
        },
        {
          id: "junk",
          label: "汴河帆影",
          slot: "sky",
          frames: bannerFrames(14, 12, 4),
          palette,
          scale: 5,
          duration: 1100,
        },
      ];
    case "apocalypse":
      return [
        {
          id: "siren",
          label: "警报塔脉冲",
          slot: "hero",
          frames: beaconFrames(13, 14, 4),
          palette,
          scale: 6,
          duration: 900,
        },
        {
          id: "blast",
          label: "尘云升起",
          slot: "sky",
          frames: peakFrames(13, 12, 3),
          palette,
          scale: 5,
          duration: 1200,
        },
        {
          id: "shelter",
          label: "掩体指示灯",
          slot: "prop",
          frames: relicFrames(12, 11, 4),
          palette,
          scale: 5,
          duration: 1600,
        },
      ];
    case "cosmic":
      return [
        {
          id: "planet",
          label: "行星与环",
          slot: "hero",
          frames: orbFrames(16, 14, 4),
          palette,
          scale: 6,
          duration: 1600,
        },
        {
          id: "moon",
          label: "卫星掠过",
          slot: "sky",
          frames: orbFrames(11, 10, 4),
          palette,
          scale: 4,
          duration: 1200,
        },
        {
          id: "orbit",
          label: "轨道相位",
          slot: "prop",
          frames: helixFrames(14, 9, 4),
          palette,
          scale: 5,
          duration: 1000,
        },
      ];
    case "after-human":
      return [
        {
          id: "vine",
          label: "藤蔓爬上废墟",
          slot: "hero",
          frames: plantFrames(11, 14, 3, 3),
          palette,
          scale: 6,
          duration: 1700,
        },
        {
          id: "ruin",
          label: "空楼窗格",
          slot: "prop",
          frames: relicFrames(13, 13, 4),
          palette,
          scale: 5,
          duration: 1500,
        },
        {
          id: "beacon",
          label: "无人灯塔",
          slot: "sky",
          frames: beaconFrames(11, 12, 3),
          palette,
          scale: 4,
          duration: 1800,
        },
      ];
    case "evolution":
      return [
        {
          id: "dna",
          label: "双螺旋解旋",
          slot: "hero",
          frames: helixFrames(15, 13, 4),
          palette,
          scale: 6,
          duration: 900,
        },
        {
          id: "dish",
          label: "培养皿孵化",
          slot: "prop",
          frames: eggFrames(12, 12, 4),
          palette,
          scale: 5,
          duration: 1500,
        },
        {
          id: "colony",
          label: "菌落蔓延",
          slot: "sky",
          frames: plantFrames(11, 12, 3, 3),
          palette,
          scale: 4,
          duration: 1300,
        },
      ];
    case "future-tech":
      return [
        {
          id: "stream",
          label: "数据流",
          slot: "hero",
          frames: helixFrames(15, 11, 4),
          palette,
          scale: 6,
          duration: 800,
        },
        {
          id: "chip",
          label: "芯片扫描",
          slot: "prop",
          frames: relicFrames(13, 12, 4),
          palette,
          scale: 5,
          duration: 1100,
        },
        {
          id: "mast",
          label: "通信塔",
          slot: "sky",
          frames: beaconFrames(13, 13, 4),
          palette,
          scale: 5,
          duration: 1000,
        },
      ];
    case "alien":
      return [
        {
          id: "saucer",
          label: "碟形飞行器",
          slot: "sky",
          frames: orbFrames(16, 11, 4),
          palette,
          scale: 7,
          duration: 1200,
        },
        {
          id: "signal",
          label: "信号塔回应",
          slot: "hero",
          frames: beaconFrames(12, 13, 4),
          palette,
          scale: 6,
          duration: 1000,
        },
        {
          id: "beam",
          label: "光束相位",
          slot: "prop",
          frames: helixFrames(14, 10, 4),
          palette,
          scale: 5,
          duration: 900,
        },
      ];
    default:
      return [
        {
          id: "shard",
          label: "未归档碎片",
          slot: "hero",
          frames: relicFrames(12, 12, 4),
          palette,
          scale: 5,
          duration: 1400,
        },
        {
          id: "orbit",
          label: "无名轨道",
          slot: "sky",
          frames: helixFrames(14, 10, 4),
          palette,
          scale: 5,
          duration: 1200,
        },
      ];
  }
}

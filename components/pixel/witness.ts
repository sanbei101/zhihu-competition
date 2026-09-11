import type { ScenarioSkin } from "@/lib/scenario-skin";
import type { WitnessArchetype } from "@/lib/world-sim";

/**
 * 世界见证者的像素形象。
 *
 * 卡牌旁边站着说话的那个人：人 / 恐龙 / 外星人 / 机器 / 宇航员 / 菌落 / 幸存者。
 * 它在世界种子生成时就定下来，之后整局都不换。
 *
 * 两条硬约定：
 *   1. 原型由 themeId **确定性**映射，绝不让模型自己挑 ——
 *      三国世界里站出一只恐龙会让整套视觉立刻垮掉。模型只负责给它起名字、写身份。
 *   2. 全部生成器都是纯函数，不用随机、不读时间，保证 SSR 与 CSR 渲染一致。
 */

/** 主题 -> 形象原型。十个主题收敛到七种造型，同主题组靠皮肤色板区分 */
const ARCHETYPE_BY_THEME: Record<string, WitnessArchetype> = {
  "three-kingdoms": "human",
  "qin-han": "human",
  "tang-song-ming": "human",
  dino: "dinosaur",
  alien: "alien",
  "future-tech": "machine",
  "after-human": "machine",
  cosmic: "astronaut",
  evolution: "microbe",
  apocalypse: "survivor",
};

export function witnessArchetypeFor(themeId: string | undefined): WitnessArchetype {
  if (!themeId) return "human";
  return ARCHETYPE_BY_THEME[themeId] ?? "human";
}

/**
 * 一帧造型。head 是头部在画布上的行区间，用来做点头动画：
 * 第二帧把头部整体下移一格，顶行复制一份保持填充，读起来就是点了一下头。
 */
interface WitnessArt {
  readonly rows: readonly string[];
  readonly head: readonly [number, number];
}

const ART: Record<WitnessArchetype, WitnessArt> = {
  human: {
    head: [3, 9],
    rows: [
      "........................",
      "........................",
      "........................",
      ".........oooooo.........",
      "........oyxxxxyo........",
      "........oxxxxxxo........",
      "........oexxexo.........",
      "........oxxxxxxo........",
      ".........oxoxo..........",
      "..........oxo...........",
      "......oooooxxooooo......",
      ".....oxxxxxxxxxxxxo.....",
      ".....oxxxyyyyyxxxxo.....",
      "....oxxxyxxxxxyxxxxo....",
      "....oxxxyxxxxxyxxxxo....",
      "....oxxxyxxxxxyxxxxo....",
      "....oxxxyxxxxxyxxxxo....",
      ".....oxxyxxxxxyxxo......",
      ".....oxxyxxxxxyxxo......",
      ".....oxxyxxxxxyxxo......",
      ".....oxxxxxxxxxxxo......",
      ".....oyxxxxxxxxxyo......",
      ".....oxxxxxxxxxxxo......",
      ".....oxxxxxxxxxxxo......",
      "....oxxxxxxxxxxxxxo.....",
      "....oxxxxxxxxxxxxxo.....",
      "....ooooooooooooooo.....",
      ".....ooxxo...oxxoo......",
      ".....ooxxo...oxxoo......",
      "......ooo.....ooo.......",
    ],
  },
  dinosaur: {
    head: [5, 11],
    rows: [
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "..........ooooo.........",
      ".........oyxxxyo........",
      ".........oxxxxxo........",
      "........oxexxexo........",
      "........oxxxxxxxo.......",
      "........oxxoxooo........",
      "........oxxxxo..........",
      ".......oxxxxxo..........",
      "......ooxxxxxoo.........",
      ".....oxxxxxxxxxo........",
      "....oxxxyyyyyyxxo.......",
      "...oxxxyyyyyyyyxxxo.....",
      "...oxxxyyyyyyyyxxxo.....",
      "..oxxxxxyxxxxxxyxxxxo...",
      "..oxxxxxxxxxxxxxxxxxxx..",
      "...oxxxxxxxxxxxxxxxxx...",
      "...oxxxxxxxxxxxxxxxx....",
      "...oxxxxxxxxxxxxxxxx....",
      "....oxxxxxxxxxxxxxx.....",
      ".....oxxxxxxxxxxxx......",
      "......oxxxo..ooxxo......",
      "......oxxo....oxxo......",
      "......oxxo.....oxxo.....",
      "......oxxo.....oxxo.....",
      ".....ooooo.....oooo.....",
    ],
  },
  alien: {
    head: [8, 17],
    rows: [
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      ".........oooooo.........",
      ".......ooyxxxxyoo.......",
      "......oyxxxxxxxxyo......",
      "......oxxxxxxxxxxo......",
      "......oxxoooxxoo........",
      "......oxoeeoeoo.........",
      "......oxxoooxxoo........",
      "......oyxxxxxxxo........",
      ".......ooxxxxoxo........",
      "........ooxxxxoo........",
      "..........oxxo..........",
      "........ooxxxxoo........",
      ".......oxxxxxxxxo.......",
      ".......oxxxxxxxxo.......",
      "......oxxxxxxxxxxo......",
      "......oxxxxxxxxxxo......",
      "......oxxxxxxxxxxo......",
      "......oxxxxxxxxxxo......",
      "......oxxxxxxxxxxo......",
      ".......oxxxxxxxo........",
      ".......oxxxxxxxo........",
      "........oooooo..........",
    ],
  },
  machine: {
    head: [9, 16],
    rows: [
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "............oy..........",
      ".............o..........",
      ".........oooooo.........",
      "........oyxxxxyo........",
      "........oxxxxxxo........",
      "........oxexxexo........",
      "........oxxxxxxo........",
      "........oxxooxo.........",
      "........oxxxxxxxo.......",
      ".........oooooo.........",
      ".......ooxxxxxxoo.......",
      "......oxxxxxxxxxxo......",
      "......oxxxooooxxo.......",
      "......oxxxxxxxxxxo......",
      "......oxxxxxxxxxxo......",
      "......oxxxxxxxxxxo......",
      "......oxxxxxxxxxxo......",
      ".......oxxxxxxxxo.......",
      ".......ooxxxxxxoo.......",
      "........oxxoxxo.........",
      "........oxo.oxo.........",
      "........oxo.oxo.........",
      ".......oooo.oooo........",
    ],
  },
  astronaut: {
    head: [5, 13],
    rows: [
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      ".......oooooooo.........",
      ".....ooyxxxxxxyoo.......",
      "....oyxxxxxxxxxxyo......",
      "....oxxxxxxxxxxxxo......",
      "....oxoooooooooxo.......",
      "....oxoyyyyyyyoxo.......",
      "....oxoooooooooxo.......",
      "....oyxxxxxxxxxxyo......",
      ".....ooxxxxxxxxoo.......",
      "...oooxxxxxxxxxxooo.....",
      "..oxxxxxxxxxxxxxxxxxo...",
      "..oxxxxxxxxxxxxxxxxxo...",
      "..oxxxxxxxxxxxxxxxxxo...",
      "..oxxxxxxxxxxxxxxxxxo...",
      "...oxxxxxxxxxxxxxxxo....",
      "...oxxxxxxxxxxxxxxxo....",
      "...oxxxxxxxxxxxxxxxo....",
      "....oxxxxxxxxxxxxxo.....",
      "....oxxxxxxxxxxxxxo.....",
      "....oxxxxxxxxxxxxxo.....",
      ".....oxxxxxxxxxxxo......",
      ".....ooxxxxxxxxoo.......",
      "......ooxxxxxxoo........",
      ".......ooxxxxoo.........",
      "........ooooo...........",
    ],
  },
  microbe: {
    head: [16, 27],
    rows: [
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      ".........ooooo..........",
      ".......ooyxxxxyoo.......",
      "......oyxxxxxxxxyo......",
      ".....oyxxxxxxxxxxo......",
      ".....oxxxxoooxxxxo......",
      ".....oxxxoeeooxxxo......",
      ".....oxxxoeeooxxxo......",
      ".....oxxxxxxxxxxxo......",
      ".....oyxxxxxxxxxyo......",
      "......oyxxxxxxxxyo......",
      ".......ooyxxxxyoo.......",
      ".........ooooo..........",
      ".....o.....o.....o......",
      "......o....o....o.......",
    ],
  },
  survivor: {
    head: [9, 16],
    rows: [
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      ".........ooooooo........",
      ".......ooyxxxxxyoo......",
      "......oyxxxxxxxxxyo.....",
      "......oxxxxxxxxxxxo.....",
      "......oxooooooooxo......",
      "......oxoyyyyyooxo......",
      "......oxoooooxxoxo......",
      ".......oxxxxxxxxxo......",
      ".....oooxxxxxxxoooo.....",
      "....ooxxxxxxxxxxxxxo....",
      "....oxxxxxxxxxxxxxxo....",
      "....oxxxxxxxxxxxxxxo....",
      "....oxxxxxxxxxxxxxxo....",
      ".....ooxxxxxxxxxxxoo....",
      "......oxxxxxxxxxxxo.....",
      "......oxxxxxxxxxxxo.....",
      "......ooxxxxxxxxxoo.....",
      ".......oxxxxxxxxo.......",
      ".......oxo....oxo.......",
      ".......oxo....oxo.......",
      "......ooo......ooo......",
    ],
  },
};

export const WITNESS_CANVAS = { width: 24, height: 30 } as const;

export interface WitnessSprite {
  /** 两帧：静息 -> 点头 */
  frames: readonly (readonly string[])[];
  palette: Record<string, string>;
  label: string;
  width: number;
  height: number;
}

/** 把头部区间整体下移一格：顶行原样保留，其余各取上一行。读起来是一个点头 */
function nod(frame: readonly string[], head: readonly [number, number]): string[] {
  const [top, bottom] = head;
  return frame.map((row, y) => {
    if (y <= top || y > bottom) return row;
    return frame[y - 1];
  });
}

/**
 * 取某个原型的像素帧。
 * 色板直接吃皮肤的 pixel 四色，所以同一套造型在十套皮肤下都不会串味。
 */
export function witnessSprite(
  archetype: WitnessArchetype,
  skin: ScenarioSkin,
  label: string,
): WitnessSprite {
  const art = ART[archetype];
  return {
    frames: [art.rows, nod(art.rows, art.head)],
    palette: { o: skin.pixel.o, x: skin.pixel.x, y: skin.pixel.y, e: skin.pixel.e },
    label,
    width: WITNESS_CANVAS.width,
    height: WITNESS_CANVAS.height,
  };
}

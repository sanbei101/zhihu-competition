import type { CSSProperties } from "react";

/**
 * 一套皮肤 = 一个世界的视觉身份。
 * 通过覆盖 shadcn 的语义色变量实现整体换肤,组件内部无需感知主题。
 */
export interface ScenarioSkin {
  id: string;
  name: string;
  /** 氛围标签,如'白垩纪黄昏' */
  mood: string;
  bg: string;
  surface: string;
  raised: string;
  ink: string;
  inkSoft: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  border: string;
  /** 像素动图色板:o 暗部轮廓 / x 主色 / y 高光 / e 点睛色 */
  pixel: { o: string; x: string; y: string; e: string };
}

export const SCENARIO_SKINS: ScenarioSkin[] = [
  {
    id: "dino",
    name: "史前巨兽",
    mood: "白垩纪黄昏",
    bg: "#20160f",
    surface: "#31231a",
    raised: "#3d2c1f",
    ink: "#f5e8d0",
    inkSoft: "#bda484",
    accent: "#e8a33d",
    accentInk: "#2b1a08",
    accentSoft: "#4a3222",
    border: "#4a3423",
    pixel: { o: "#2f4a2a", x: "#6f9a4a", y: "#a8c76a", e: "#f7e7c6" },
  },
  {
    id: "three-kingdoms",
    name: "三国鼎立",
    mood: "水墨青灰",
    bg: "#e9e4d8",
    surface: "#f7f4ec",
    raised: "#e0d9c8",
    ink: "#2b2a26",
    inkSoft: "#6b6659",
    accent: "#9c3a2e",
    accentInk: "#fdf6ee",
    accentSoft: "#e2d4c4",
    border: "#cfc7b3",
    pixel: { o: "#3b3a33", x: "#9c3a2e", y: "#c8a07a", e: "#4a6b7c" },
  },
  {
    id: "qin-han",
    name: "秦汉帝国",
    mood: "玄黑青铜",
    bg: "#14161a",
    surface: "#1e2127",
    raised: "#282c34",
    ink: "#e6e8ea",
    inkSoft: "#9aa0a8",
    accent: "#c9a227",
    accentInk: "#1a1505",
    accentSoft: "#2f2a1c",
    border: "#33383f",
    pixel: { o: "#3a3020", x: "#c9a227", y: "#e7cf7a", e: "#4e7a6b" },
  },
  {
    id: "tang-song-ming",
    name: "唐宋明变局",
    mood: "青绿山水",
    bg: "#eff4ee",
    surface: "#fbfdf9",
    raised: "#dde9dd",
    ink: "#22301f",
    inkSoft: "#5c6b57",
    accent: "#2f7d5c",
    accentInk: "#f4fbf6",
    accentSoft: "#d5e8dc",
    border: "#c7d8c8",
    pixel: { o: "#22402f", x: "#2f7d5c", y: "#7fc09b", e: "#b1703a" },
  },
  {
    id: "apocalypse",
    name: "末日灾变",
    mood: "灰烬警报",
    bg: "#1a1614",
    surface: "#26201d",
    raised: "#332a26",
    ink: "#f0e7de",
    inkSoft: "#a3968c",
    accent: "#e2622c",
    accentInk: "#200c02",
    accentSoft: "#3a2519",
    border: "#3d322c",
    pixel: { o: "#4a3a30", x: "#e2622c", y: "#f3a45f", e: "#8a8f7a" },
  },
  {
    id: "cosmic",
    name: "天体异变",
    mood: "深空轨道",
    bg: "#0d1b2a",
    surface: "#14293d",
    raised: "#1d3850",
    ink: "#dce9f5",
    inkSoft: "#8fa9c4",
    accent: "#4cc9f0",
    accentInk: "#06202b",
    accentSoft: "#1b344e",
    border: "#26455e",
    pixel: { o: "#1b3a52", x: "#4cc9f0", y: "#a5e8fb", e: "#7b6cf6" },
  },
  {
    id: "after-human",
    name: "人类消失之后",
    mood: "锈绿废墟",
    bg: "#191d18",
    surface: "#232a22",
    raised: "#2f3830",
    ink: "#dfe6d8",
    inkSoft: "#98a394",
    accent: "#7fa653",
    accentInk: "#131c0a",
    accentSoft: "#2b3527",
    border: "#39443a",
    pixel: { o: "#2c3a2b", x: "#7fa653", y: "#b6d189", e: "#a8703f" },
  },
  {
    id: "evolution",
    name: "演化脑洞",
    mood: "培养皿荧光",
    bg: "#101a18",
    surface: "#16241f",
    raised: "#1f332c",
    ink: "#dff5ec",
    inkSoft: "#8fb3a6",
    accent: "#35e0a1",
    accentInk: "#04231a",
    accentSoft: "#1c3a30",
    border: "#294a3e",
    pixel: { o: "#1c4a3a", x: "#35e0a1", y: "#8ff5cf", e: "#b06cf0" },
  },
  {
    id: "future-tech",
    name: "未来科技",
    mood: "霓虹数据流",
    bg: "#130f1f",
    surface: "#1c1730",
    raised: "#272042",
    ink: "#e8e2f5",
    inkSoft: "#a49cc0",
    accent: "#8b5cf6",
    accentInk: "#0e0620",
    accentSoft: "#2a2150",
    border: "#352b57",
    pixel: { o: "#2b2350", x: "#8b5cf6", y: "#c4b1fd", e: "#22d3ee" },
  },
  {
    id: "alien",
    name: "外星接触",
    mood: "极光信号",
    bg: "#0a1a14",
    surface: "#122b21",
    raised: "#1a3d2e",
    ink: "#dcf5e7",
    inkSoft: "#7fa694",
    accent: "#34d399",
    accentInk: "#04231a",
    accentSoft: "#173a2c",
    border: "#24503d",
    pixel: { o: "#17402f", x: "#34d399", y: "#93f2cd", e: "#a3e635" },
  },
];

const FALLBACK_SKIN: ScenarioSkin = {
  id: "default",
  name: "未归档世界线",
  mood: "空白档案",
  bg: "#1b1b1f",
  surface: "#24242a",
  raised: "#2f2f37",
  ink: "#ececf0",
  inkSoft: "#a0a0ab",
  accent: "#8b8bff",
  accentInk: "#0d0d14",
  accentSoft: "#2c2c46",
  border: "#3a3a45",
  pixel: { o: "#2f2f37", x: "#8b8bff", y: "#c3c3ff", e: "#ffd166" },
};

export function getSkin(themeId: string | undefined): ScenarioSkin {
  if (!themeId) return FALLBACK_SKIN;
  return SCENARIO_SKINS.find((skin) => skin.id === themeId) ?? FALLBACK_SKIN;
}

/** 把皮肤转成可直接挂到容器上的 shadcn 语义变量覆盖 */
export function skinStyleVars(skin: ScenarioSkin): CSSProperties {
  return {
    "--background": skin.bg,
    "--foreground": skin.ink,
    "--card": skin.surface,
    "--card-foreground": skin.ink,
    "--popover": skin.raised,
    "--popover-foreground": skin.ink,
    "--primary": skin.accent,
    "--primary-foreground": skin.accentInk,
    "--secondary": skin.raised,
    "--secondary-foreground": skin.ink,
    "--muted": skin.raised,
    "--muted-foreground": skin.inkSoft,
    "--accent": skin.accentSoft,
    "--accent-foreground": skin.ink,
    "--destructive": skin.accent,
    "--destructive-foreground": skin.accentInk,
    "--border": skin.border,
    "--input": skin.border,
    "--ring": skin.accent,
    "--chart-1": skin.pixel.x,
    "--chart-2": skin.accent,
    "--chart-3": skin.pixel.y,
    "--chart-4": skin.pixel.e,
    "--chart-5": skin.raised,
    "--radius": "0.25rem",
  } as CSSProperties;
}

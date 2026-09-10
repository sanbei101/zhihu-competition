// 首页静态文字 -> pixel.woff2 子集: pnpm font:subset
import { execFileSync, execSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

// Ark Pixel 12px zh_cn 缺 18 个常用字(如然/势/恐),改用 Fusion Pixel 12px(36558 字形,首页 898 字全覆盖)
const SRC_ZIP_URL =
  "https://github.com/TakWolf/fusion-pixel-font/releases/download/2026.09.01/fusion-pixel-font-12px-proportional-ttf-v2026.09.01.zip";
const SRC_ZIP = join(tmpdir(), "fusion-pixel-12px-proportional-ttf.zip");
const SRC_FONT = join(tmpdir(), "fusion-pixel-12px-proportional-zh_hans.ttf");
const SRC_ENTRY = "fusion-pixel-12px-proportional-zh_hans.ttf";

if (!existsSync(SRC_FONT)) {
  const res = await fetch(SRC_ZIP_URL);
  if (!res.ok) throw new Error(`下载字体失败: ${res.status}`);
  await pipeline(res.body, createWriteStream(SRC_ZIP));
  execFileSync("unzip", ["-o", "-j", "-d", tmpdir(), SRC_ZIP, SRC_ENTRY], { stdio: "inherit" });
}

// 首页实际渲染的静态文案来源,加文件只改这里
const SOURCES = [
  "app/layout.tsx",
  "app/page.tsx",
  "components/landing/worldline-deck.tsx",
  "components/landing/cover-panels.tsx",
  "components/landing/theme-panel.tsx",
  "lib/scenario-library.ts",
  "lib/scenario-skin.ts",
];
const OUT_FONT = "public/pixel.woff2";
// ASCII + 常用全角标点,保证数字/英文/排版不断字
const ALWAYS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,/:;!?-+*()[]{}<>\"'`#%&@_—–…·，。、；：？！「」『』（）【】《》〈〉—…·";

const raw = SOURCES.map((f) => readFileSync(f, "utf8")).join("\n");
const chars = new Set([...ALWAYS, ...raw].filter((c) => c.trim() !== ""));
const text = [...chars].sort().join("");

mkdirSync(tmpdir(), { recursive: true });
const textFile = join(tmpdir(), "pixel-subset.txt");
writeFileSync(textFile, text);

execFileSync(
  "uvx",
  [
    "--from",
    "fonttools[woff]",
    "pyftsubset",
    SRC_FONT,
    `--text-file=${textFile}`,
    `--output-file=${OUT_FONT}`,
    "--flavor=woff2",
  ],
  { stdio: "inherit" },
);
console.log(`done: ${OUT_FONT} (${chars.size} glyphs)`);
try {
  console.log(execSync(`ls -lh ${OUT_FONT} ${SRC_FONT}`).toString());
} catch {}

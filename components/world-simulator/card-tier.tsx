"use client";

import { cardTierGrades, cardTierLabels } from "@/lib/world-cards";
import type { CardTier } from "@/lib/world-sim";

/**
 * 稀有度的视觉定义。
 *
 * 六档颜色刻意**不**走皮肤语义变量 —— 抽卡的颜色是玩家已经内化的通用语言
 * (白=普通、金=稀有、彩=万中无一),它应该在任何一套皮肤下都长一个样。
 * 彩卡用真彩虹渐变,这是它"万中无一"的全部说服力。
 */
export const TIER_RIBBON: Record<CardTier, string> = {
  white: "bg-slate-400",
  green: "bg-emerald-500",
  blue: "bg-sky-500",
  red: "bg-red-500",
  gold: "bg-amber-400",
  prism:
    "bg-[linear-gradient(90deg,#f87171,#fbbf24,#34d399,#60a5fa,#c084fc,#f87171)] bg-[length:200%_100%]",
};

export const TIER_TEXT: Record<CardTier, string> = {
  white: "text-slate-400",
  green: "text-emerald-500",
  blue: "text-sky-500",
  red: "text-red-500",
  gold: "text-amber-500",
  prism: "text-fuchsia-500",
};

/** 高稀有度才有的那一圈辉光。白与绿不配发光 */
export const TIER_GLOW: Record<CardTier, string> = {
  white: "",
  green: "",
  blue: "shadow-[0_0_20px_-6px_#0ea5e9]",
  red: "shadow-[0_0_24px_-6px_#ef4444]",
  gold: "shadow-[0_0_28px_-6px_#f59e0b]",
  prism: "shadow-[0_0_32px_-6px_#d946ef]",
};

export function TierBadge({ tier, className }: { tier: CardTier; className?: string }) {
  return (
    <span
      className={`animate-tier-reveal inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[10px] leading-none text-white ${TIER_RIBBON[tier]} ${
        className ?? ""
      }`}
    >
      {cardTierGrades[tier]}
      <span className="opacity-80">·</span>
      {cardTierLabels[tier]}
    </span>
  );
}

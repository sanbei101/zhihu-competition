"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { ScenarioSkin } from "@/lib/scenario-skin";

export interface ProclamationData {
  id: string;
  tag: string;
  icon: string;
  quote: string;
  subtext: string;
  color: string;
  durationMs?: number;
}

export function EpicProclamationBanner({
  proclamation,
  skin,
  onDismiss,
}: {
  proclamation: ProclamationData | null;
  skin: ScenarioSkin;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!proclamation) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const duration = proclamation.durationMs ?? 7000;
    const timer = window.setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, duration);

    return () => window.clearTimeout(timer);
  }, [proclamation, onDismiss]);

  if (!proclamation || !visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[68px] z-[100] flex [animation:proclamationFadeIn_0.4s_cubic-bezier(0.16,1,0.3,1)_forwards] items-start justify-center px-4 max-sm:top-[54px] max-sm:px-2"
      role="alert"
      aria-live="assertive"
      onClick={onDismiss}
      title="点击关闭史诗宣言"
    >
      <div
        className="pointer-events-auto relative w-full max-w-[680px] overflow-hidden rounded-lg border border-t-[1.5px] border-white/10 border-t-[var(--epic-accent,#f59e0b)] bg-[rgba(12,10,16,0.94)] px-5 pt-4 pb-3.5 shadow-[0_12px_36px_-4px_rgba(0,0,0,0.75),0_0_24px_-6px_var(--epic-accent,rgba(245,158,11,0.35))] backdrop-blur-[16px] transition-all duration-300 max-sm:px-3.5 max-sm:pt-3 max-sm:pb-2.5"
        style={
          {
            "--epic-accent": proclamation.color || skin.accent || "#f59e0b",
          } as React.CSSProperties
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* 背景光晕与粒子装饰 */}
        <div
          className="pointer-events-none absolute -top-[50px] left-1/2 h-[100px] w-[320px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,var(--epic-accent,#f59e0b)_0%,transparent_70%)] opacity-[0.18]"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--epic-accent,#f59e0b)_50%,transparent)] opacity-85"
          aria-hidden="true"
        />

        <div className="mb-2.5 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 py-0.5 pr-2.5 pl-1.5 font-mono text-[11px] font-semibold tracking-[0.04em] text-[var(--epic-accent,#f59e0b)]">
            <span className="text-[13px] leading-none">{proclamation.icon}</span>
            <span className="text-[var(--epic-accent,#f59e0b)] uppercase">{proclamation.tag}</span>
            <Sparkles className="size-3 text-amber-400 opacity-80" />
          </div>

          <button
            type="button"
            className="text-muted-foreground inline-flex items-center justify-center rounded-[4px] border-0 bg-transparent p-1 transition-all duration-150 hover:bg-white/10 hover:text-white"
            onClick={onDismiss}
            aria-label="关闭通告"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* 史诗金句主文本 */}
        <div className="mt-1.5 mb-2.5">
          <h2 className="m-0 text-base leading-[1.5] font-bold tracking-[0.02em] text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.8)] max-sm:text-sm max-sm:leading-[1.45]">
            “{proclamation.quote}”
          </h2>
          <p className="text-muted-foreground m-0 text-xs tracking-[0.02em] italic">
            —— {proclamation.subtext}
          </p>
        </div>

        {/* 自动消逝进度计时条 */}
        <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full w-full origin-left [animation:epicProgressLinear_linear_forwards] bg-[var(--epic-accent,#f59e0b)]"
            style={{
              animationDuration: `${proclamation.durationMs ?? 7000}ms`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

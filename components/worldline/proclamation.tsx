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
      className="epic-proclamation-wrapper"
      role="alert"
      aria-live="assertive"
      onClick={onDismiss}
      title="点击关闭史诗宣言"
    >
      <div
        className="epic-proclamation-card"
        style={
          {
            "--epic-accent": proclamation.color || skin.accent || "#f59e0b",
          } as React.CSSProperties
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* 背景光晕与粒子装饰 */}
        <div className="epic-glow-layer" aria-hidden="true" />
        <div className="epic-border-flare" aria-hidden="true" />

        <div className="epic-header">
          <div className="epic-badge">
            <span className="epic-icon">{proclamation.icon}</span>
            <span className="epic-tag">{proclamation.tag}</span>
            <Sparkles className="size-3 text-amber-400 opacity-80" />
          </div>

          <button
            type="button"
            className="epic-close-btn"
            onClick={onDismiss}
            aria-label="关闭通告"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* 史诗金句主文本 */}
        <div className="epic-content">
          <h2 className="epic-quote">“{proclamation.quote}”</h2>
          <p className="epic-subtext">—— {proclamation.subtext}</p>
        </div>

        {/* 自动消逝进度计时条 */}
        <div className="epic-progress-track">
          <div
            className="epic-progress-bar"
            style={{
              animationDuration: `${proclamation.durationMs ?? 7000}ms`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

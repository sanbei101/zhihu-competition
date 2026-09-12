"use client";

import {
  Award,
  BookOpen,
  Check,
  Compass,
  Copy,
  RefreshCw,
  RotateCcw,
  ThumbsUp,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { StandSvg } from "@/components/worldline/sprites";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import type { WorldlineSession } from "@/lib/worldline";

interface SettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: WorldlineSession | null;
  skin: ScenarioSkin;
  onReset: () => void;
}

/** 简单的轻量 Markdown 内容渲染器，安全且高保真还原知乎排版 */
function SimpleMarkdownView({ content }: { content: string }) {
  const elements = useMemo(() => {
    if (!content.trim()) return [];

    const lines = content.split("\n");
    const nodes: React.ReactNode[] = [];
    let listBuffer: string[] = [];

    const flushList = (key: string) => {
      if (listBuffer.length > 0) {
        nodes.push(
          <ul key={`list-${key}`} className="zhihu-md-list">
            {listBuffer.map((item, idx) => (
              <li key={idx}>{parseInlineFormatting(item.replace(/^[-*]\s+|\d+\.\s+/, ""))}</li>
            ))}
          </ul>,
        );
        listBuffer = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // 空行
      if (!trimmed) {
        flushList(String(index));
        return;
      }

      // 列表项
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s/.test(trimmed)) {
        listBuffer.push(trimmed);
        return;
      }

      flushList(String(index));

      // 标题
      if (trimmed.startsWith("# ")) {
        nodes.push(
          <h1 key={index} className="zhihu-md-h1">
            {trimmed.slice(2)}
          </h1>,
        );
        return;
      }
      if (trimmed.startsWith("## ")) {
        nodes.push(
          <h2 key={index} className="zhihu-md-h2">
            {trimmed.slice(3)}
          </h2>,
        );
        return;
      }
      if (trimmed.startsWith("### ")) {
        nodes.push(
          <h3 key={index} className="zhihu-md-h3">
            {trimmed.slice(4)}
          </h3>,
        );
        return;
      }

      // 引用块
      if (trimmed.startsWith("> ")) {
        nodes.push(
          <blockquote key={index} className="zhihu-md-quote">
            {parseInlineFormatting(trimmed.slice(2))}
          </blockquote>,
        );
        return;
      }

      // 普通段落
      nodes.push(
        <p key={index} className="zhihu-md-p">
          {parseInlineFormatting(trimmed)}
        </p>,
      );
    });

    flushList("final");
    return nodes;
  }, [content]);

  return <div className="zhihu-article-body">{elements}</div>;
}

/** 解析行内加粗 **bold** */
function parseInlineFormatting(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="zhihu-strong">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export function WorldlineSettlementModal({
  isOpen,
  onClose,
  session,
  skin,
  onReset,
}: SettlementModalProps) {
  const [markdown, setMarkdown] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // 统计数据
  const stats = useMemo(() => {
    if (!session) return null;
    const totalWaves = session.waves.length;
    const totalEras = totalWaves + 1;
    const timelineLen = session.timeline.length;

    let goodCount = 0;
    let badCount = 0;
    let oddCount = 0;

    session.waves.forEach((wave) => {
      wave.forEach((event) => {
        if (event.tone === "good") goodCount++;
        else if (event.tone === "bad") badCount++;
        else if (event.tone === "odd") oddCount++;
      });
    });

    return {
      totalEras,
      timelineLen,
      scaleLabel: session.seed.scaleLabel,
      beingsCount: session.seed.beings.length,
      goodCount,
      badCount,
      oddCount,
      beings: session.seed.beings,
    };
  }, [session]);

  const generateReport = useCallback(async () => {
    if (!session) return;
    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setErrorMsg(null);
    setMarkdown("");

    try {
      const res = await fetch("/api/worldline-settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`生成失败: HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("响应流不可读");
      }

      const decoder = new TextDecoder("utf-8");
      let accum = "";

      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();
        if (done) break;
        accum += decoder.decode(value, { stream: true });
        setMarkdown(accum);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error("生成知乎体长文结算失败:", err);
        setErrorMsg(err instanceof Error ? err.message : "生成知乎长文失败，请重试");
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsGenerating(false);
      }
    }
  }, [session]);

  // Modal 首次打开且未生成过内容时，自动开始生成
  useEffect(() => {
    if (isOpen && session && !markdown && !isGenerating && !errorMsg) {
      void generateReport();
    }
  }, [isOpen, session, markdown, isGenerating, errorMsg, generateReport]);

  const handleCopy = useCallback(() => {
    if (!markdown) return;
    const fullPost = `【知乎硬核推演回答】\n问题：${session?.scenarioTitle ?? ""}\n\n${markdown}\n\n—— 本文由「如果...会怎样」世界线演变沙盘观测台模拟推演生成`;
    void navigator.clipboard.writeText(fullPost);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2500);
  }, [markdown, session?.scenarioTitle]);

  if (!isOpen || !session) return null;

  return (
    <div className="settle-modal-overlay" role="dialog" aria-modal="true">
      <div className="settle-modal-backdrop" onClick={onClose} />

      <div className="settle-modal-container">
        {/* 顶部标题栏 */}
        <div className="settle-modal-header">
          <div className="settle-header-left">
            <div className="zhihu-tag-badge">
              <span className="zhihu-logo-badge">知乎</span>
              <span className="zhihu-topic-badge">硬核推演 · 终局结算</span>
            </div>
            <h2 className="settle-scenario-title">{session.scenarioTitle}</h2>
          </div>

          <button
            type="button"
            className="settle-close-btn"
            onClick={onClose}
            aria-label="关闭结算"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* 弹窗内容主体 */}
        <div className="settle-modal-body">
          {/* 数据全景卡片 */}
          {stats && (
            <div className="settle-stats-overview">
              <div className="settle-stat-card">
                <span className="stat-label">演化历程</span>
                <span className="stat-val">{stats.totalEras} 纪元</span>
                <span className="stat-sub">{stats.scaleLabel} 尺度</span>
              </div>
              <div className="settle-stat-card">
                <span className="stat-label">编年史篇</span>
                <span className="stat-val">{stats.timelineLen} 段</span>
                <span className="stat-sub">重大转折记录</span>
              </div>
              <div className="settle-stat-card">
                <span className="stat-label">博弈阵营</span>
                <span className="stat-val">{stats.beingsCount} 大主体</span>
                <span className="stat-sub">多智能体演变</span>
              </div>
              <div className="settle-stat-card">
                <span className="stat-label">局势倾向</span>
                <div className="stat-tones">
                  <span className="tone-pill tone-good" title="利好事件">
                    利 {stats.goodCount}
                  </span>
                  <span className="tone-pill tone-bad" title="险情事件">
                    险 {stats.badCount}
                  </span>
                  <span className="tone-pill tone-odd" title="变数异象">
                    异 {stats.oddCount}
                  </span>
                </div>
                <span className="stat-sub">好险异平衡律</span>
              </div>
            </div>
          )}

          {/* 势力定格状态条 */}
          {stats && (
            <div className="settle-factions-panel">
              <span className="factions-title">
                <Compass className="size-3.5 text-amber-400" />
                终局势力定格态势:
              </span>
              <div className="factions-chips">
                {stats.beings.map((b) => (
                  <div key={b.id} className="faction-chip">
                    <b>{b.name}</b>: <span>{b.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 知乎答主卡片 */}
          <div className="zhihu-author-card">
            <div className="author-avatar-wrap">
              <StandSvg
                archetype={session.seed.witnessArchetype}
                skin={skin}
                scale={1.8}
                label={session.seed.witnessName}
              />
            </div>
            <div className="author-meta">
              <div className="author-name-row">
                <span className="author-name">{session.seed.witnessName}</span>
                <span className="author-badge">
                  <Award className="size-3" /> 知乎认证 · 观测台首席推演官
                </span>
              </div>
              <p className="author-bio">
                历史与未来无常，沙盘演化见真章。历经 {stats?.totalEras} 个纪元推演撰写。
              </p>
            </div>
            <div className="author-upvotes">
              <div className="upvote-pill">
                <ThumbsUp className="size-3.5 fill-blue-500 text-blue-500" />
                <span>84.2k 赞同</span>
              </div>
              <span className="fav-text">1.2w 收藏</span>
            </div>
          </div>

          {/* 核心文章生成区域 */}
          <div className="zhihu-article-container">
            {errorMsg ? (
              <div className="settle-error-box">
                <p>{errorMsg}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void generateReport()}
                  className="mt-2 gap-1.5"
                >
                  <RefreshCw className="size-3.5" /> 重试生成
                </Button>
              </div>
            ) : markdown ? (
              <>
                <SimpleMarkdownView content={markdown} />
                {isGenerating && (
                  <div className="typing-indicator">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="text-muted-foreground ml-1.5 text-xs">
                      正在深度推演构思文章中…
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="settle-loading-state">
                <div className="settle-spinner" />
                <p className="text-muted-foreground mt-3 text-sm font-medium">
                  AI 正在综合本条世界线全部大事与势力博弈，撰写知乎深度回答…
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 底部操作工具栏 */}
        <div className="settle-modal-footer">
          <div className="footer-left">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void generateReport()}
              disabled={isGenerating}
              className="gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${isGenerating ? "animate-spin" : ""}`} />
              重新生成长文
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onReset();
              }}
              className="text-muted-foreground gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              开启新世界线
            </Button>
          </div>

          <div className="footer-right">
            <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5">
              <BookOpen className="size-3.5" />
              漫游演化树复盘
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleCopy}
              disabled={!markdown || isGenerating}
              className="settle-copy-btn gap-1.5"
            >
              {hasCopied ? (
                <>
                  <Check className="size-4 text-emerald-300" />
                  已复制 Markdown
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  一键复制知乎 Markdown
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

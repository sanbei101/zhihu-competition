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
          <ul
            key={`list-${key}`}
            className="my-2 ml-[18px] list-disc [&_li]:mb-1 [&_li]:leading-[1.6]"
          >
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
          <h1 key={index} className="mt-5 mb-2.5 text-[20px] font-bold text-white">
            {trimmed.slice(2)}
          </h1>,
        );
        return;
      }
      if (trimmed.startsWith("## ")) {
        nodes.push(
          <h2
            key={index}
            className="mt-[18px] mb-2 border-b border-white/10 pb-1.25 text-[16.5px] font-bold text-[#60a5fa]"
          >
            {trimmed.slice(3)}
          </h2>,
        );
        return;
      }
      if (trimmed.startsWith("### ")) {
        nodes.push(
          <h3 key={index} className="mt-[14px] mb-1.5 text-[15px] font-semibold text-[#f3f4f6]">
            {trimmed.slice(4)}
          </h3>,
        );
        return;
      }

      // 引用块
      if (trimmed.startsWith("> ")) {
        nodes.push(
          <blockquote
            key={index}
            className="my-3 rounded-r-[4px] border-l-[3px] border-l-[#0066ff] bg-[rgba(0,102,255,0.06)] px-[14px] py-1.5 text-[#9ca3af] italic"
          >
            {parseInlineFormatting(trimmed.slice(2))}
          </blockquote>,
        );
        return;
      }

      // 普通段落
      nodes.push(
        <p key={index} className="my-2 leading-[1.75]">
          {parseInlineFormatting(trimmed)}
        </p>,
      );
    });

    flushList("final");
    return nodes;
  }, [content]);

  return <div className="text-sm leading-[1.7] text-[#e5e7eb]">{elements}</div>;
}

/** 解析行内加粗 **bold** */
function parseInlineFormatting(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[#fbbf24]">
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
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 max-sm:p-1.5"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-[12px]" onClick={onClose} />

      <div className="relative flex max-h-[90vh] w-full max-w-[960px] [animation:modalPop_0.3s_cubic-bezier(0.16,1,0.3,1)_forwards] flex-col overflow-hidden rounded-xl border border-t-2 border-white/15 border-t-[#0066ff] bg-[rgba(18,15,23,0.97)] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] max-sm:max-h-[96vh]">
        {/* 顶部标题栏 */}
        <div className="flex items-start justify-between border-b border-white/10 bg-white/[0.02] px-[22px] py-[18px] max-sm:px-3.5 max-sm:py-3">
          <div className="flex flex-col gap-1.5">
            <div className="inline-flex items-center gap-1.5">
              <span className="rounded-[3px] bg-[#0066ff] px-1.5 py-px text-[11px] font-extrabold tracking-[0.04em] text-white">
                知乎
              </span>
              <span className="rounded-[3px] border border-[rgba(0,102,255,0.3)] bg-[rgba(0,102,255,0.12)] px-2 py-px font-mono text-[11px] text-[#60a5fa]">
                硬核推演 · 终局结算
              </span>
            </div>
            <h2 className="text-[18px] leading-[1.4] font-bold text-[#f3f4f6] max-sm:text-[15px]">
              {session.scenarioTitle}
            </h2>
          </div>

          <button
            type="button"
            className="text-muted-foreground flex items-center justify-center rounded-md border-0 bg-transparent p-1.5 transition-all duration-150 hover:bg-white/10 hover:text-white"
            onClick={onClose}
            aria-label="关闭结算"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* 弹窗内容主体 */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5 max-sm:gap-3 max-sm:px-3 max-sm:py-3.5">
          {/* 数据全景卡片 */}
          {stats && (
            <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2 max-sm:gap-2">
              <div className="flex flex-col gap-[3px] rounded-lg border border-white/[0.08] bg-white/[0.03] px-[14px] py-3">
                <span className="text-muted-foreground font-mono text-[11px] uppercase">
                  演化历程
                </span>
                <span className="text-[17px] leading-[1.25] font-bold text-[#f3f4f6]">
                  {stats.totalEras} 纪元
                </span>
                <span className="text-muted-foreground text-[10.5px]">{stats.scaleLabel} 尺度</span>
              </div>
              <div className="flex flex-col gap-[3px] rounded-lg border border-white/[0.08] bg-white/[0.03] px-[14px] py-3">
                <span className="text-muted-foreground font-mono text-[11px] uppercase">
                  编年史篇
                </span>
                <span className="text-[17px] leading-[1.25] font-bold text-[#f3f4f6]">
                  {stats.timelineLen} 段
                </span>
                <span className="text-muted-foreground text-[10.5px]">重大转折记录</span>
              </div>
              <div className="flex flex-col gap-[3px] rounded-lg border border-white/[0.08] bg-white/[0.03] px-[14px] py-3">
                <span className="text-muted-foreground font-mono text-[11px] uppercase">
                  博弈阵营
                </span>
                <span className="text-[17px] leading-[1.25] font-bold text-[#f3f4f6]">
                  {stats.beingsCount} 大主体
                </span>
                <span className="text-muted-foreground text-[10.5px]">多智能体演变</span>
              </div>
              <div className="flex flex-col gap-[3px] rounded-lg border border-white/[0.08] bg-white/[0.03] px-[14px] py-3">
                <span className="text-muted-foreground font-mono text-[11px] uppercase">
                  局势倾向
                </span>
                <div className="my-0.5 flex gap-1.25">
                  <span
                    className="rounded-[3px] border border-[rgba(16,185,129,0.4)] bg-[rgba(16,185,129,0.18)] px-1.25 py-px font-mono text-[10px] text-[#34d399]"
                    title="利好事件"
                  >
                    利 {stats.goodCount}
                  </span>
                  <span
                    className="rounded-[3px] border border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.18)] px-1.25 py-px font-mono text-[10px] text-[#f87171]"
                    title="险情事件"
                  >
                    险 {stats.badCount}
                  </span>
                  <span
                    className="rounded-[3px] border border-[rgba(217,70,239,0.4)] bg-[rgba(217,70,239,0.18)] px-1.25 py-px font-mono text-[10px] text-[#e879f9]"
                    title="变数异象"
                  >
                    异 {stats.oddCount}
                  </span>
                </div>
                <span className="text-muted-foreground text-[10.5px]">好险异平衡律</span>
              </div>
            </div>
          )}

          {/* 势力定格状态条 */}
          {stats && (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-[14px] py-3">
              <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] font-semibold text-[#fbbf24]">
                <Compass className="size-3.5 text-amber-400" />
                终局势力定格态势:
              </span>
              <div className="flex flex-wrap gap-2">
                {stats.beings.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-[4px] border border-white/10 bg-black/35 px-2 py-[3px] text-[11.5px] text-[#d1d5db]"
                  >
                    <b className="mr-[3px] text-white">{b.name}</b>: <span>{b.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 知乎答主卡片 */}
          <div className="flex items-center gap-[14px] rounded-lg border border-[rgba(0,102,255,0.2)] bg-[rgba(0,102,255,0.05)] px-4 py-3 max-sm:px-3 max-sm:py-2.5">
            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-[#0066ff] bg-black/40">
              <StandSvg
                archetype={session.seed.witnessArchetype}
                skin={skin}
                scale={1.8}
                label={session.seed.witnessName}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-white">{session.seed.witnessName}</span>
                <span className="inline-flex items-center gap-[3px] rounded-[3px] bg-[rgba(0,102,255,0.12)] px-1.5 py-px text-[11px] text-[#60a5fa]">
                  <Award className="size-3" /> 知乎认证 · 观测台首席推演官
                </span>
              </div>
              <p className="text-muted-foreground mt-0.5 text-[11.5px]">
                历史与未来无常，沙盘演化见真章。历经 {stats?.totalEras} 个纪元推演撰写。
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-[3px] max-sm:hidden">
              <div className="inline-flex items-center gap-1.25 rounded-[4px] border border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.12)] px-2 py-[3px] text-[11.5px] font-semibold text-[#3b82f6]">
                <ThumbsUp className="size-3.5 fill-blue-500 text-blue-500" />
                <span>84.2k 赞同</span>
              </div>
              <span className="text-muted-foreground text-[10.5px]">1.2w 收藏</span>
            </div>
          </div>

          {/* 核心文章生成区域 */}
          <div className="min-h-[220px] rounded-lg border border-white/10 bg-black/35 px-[26px] py-[22px] max-sm:px-3 max-sm:py-3.5">
            {errorMsg ? (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-4 text-center text-[#f87171]">
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
                  <div className="mt-3.5 flex items-center gap-1">
                    <span className="size-[5px] animate-[typingBounce_1.2s_infinite_ease-in-out] rounded-full bg-[#0066ff]" />
                    <span className="size-[5px] animate-[typingBounce_1.2s_infinite_ease-in-out] rounded-full bg-[#0066ff] [animation-delay:0.2s]" />
                    <span className="size-[5px] animate-[typingBounce_1.2s_infinite_ease-in-out] rounded-full bg-[#0066ff] [animation-delay:0.4s]" />
                    <span className="text-muted-foreground ml-1.5 text-xs">
                      正在深度推演构思文章中…
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <div className="size-8 animate-spin rounded-full border-[3px] border-[rgba(0,102,255,0.15)] border-t-[#0066ff]" />
                <p className="text-muted-foreground mt-3 text-sm font-medium">
                  AI 正在综合本条世界线全部大事与势力博弈，撰写知乎深度回答…
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 底部操作工具栏 */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-white/10 bg-[rgba(14,12,18,0.98)] px-[22px] py-3.5 max-sm:flex-col-reverse max-sm:items-stretch max-sm:px-3 max-sm:py-2.5">
          <div className="flex items-center gap-2 max-sm:w-full max-sm:[&_button]:flex-1">
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

          <div className="flex items-center gap-2 max-sm:w-full max-sm:[&_button]:flex-1">
            <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5">
              <BookOpen className="size-3.5" />
              漫游演化树复盘
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleCopy}
              disabled={!markdown || isGenerating}
              className="gap-1.5 border-0! bg-[#0066ff]! font-semibold text-white! hover:bg-[#0052cc]! hover:shadow-[0_0_12px_rgba(0,102,255,0.4)]"
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

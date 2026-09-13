"use client";

import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  GitBranch,
  LoaderCircle,
  PenLine,
  RotateCcw,
  ScrollText,
  ShieldQuestion,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ZodType } from "zod";

import { generateFinaleChapterAction, generateFinalePlanAction } from "@/app/world/actions/finale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { WorldEventPanel } from "@/components/world-event";
import { userErrorMessage } from "@/lib/app-error";
import { worldCouncilStorageKey } from "@/lib/world-cast";
import {
  assembleFinaleArticle,
  attitudeLabels,
  countArticleChars,
  endingLabels,
  finaleProgressSchema,
  finaleSchema,
  metricKeys,
  metricLabels,
  worldGameSessionSchema,
  type FinaleChapter,
  type FinalePlan,
  type WorldFinale,
  type WorldGameSession,
} from "@/lib/world-ending";

function finaleCacheKey(worldId: string) {
  return `world-finale:${worldId}`;
}

/** 逐章写作的断点存档:中途刷新可以接着写,不必从卷目重来。 */
function progressCacheKey(worldId: string) {
  return `world-finale-progress:${worldId}`;
}

interface FinaleProgress {
  plan: FinalePlan;
  chapters: FinaleChapter[];
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function readJson<T>(key: string, schema: ZodType<T>): T | null {
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      sessionStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

/** 极简 markdown 渲染:标题、引用、分隔线、落款与段落。 */
function ArticleBody({ markdown }: { markdown: string }) {
  const blocks = markdown.split(/\n{2,}/);
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (/^-{3,}$/.test(trimmed)) return <Separator key={index} className="my-6" />;
        if (trimmed.startsWith("# ")) {
          return (
            <h2
              key={index}
              className="text-foreground text-xl leading-8 font-bold sm:text-2xl sm:leading-9"
            >
              {trimmed.slice(2)}
            </h2>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={index} className="text-primary pt-2 text-lg font-semibold sm:text-xl">
              {trimmed.slice(3)}
            </h3>
          );
        }
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote
              key={index}
              className="border-primary/60 bg-muted/30 text-muted-foreground my-2 rounded-r border-l-2 py-2 pl-4 text-sm leading-6"
            >
              {trimmed.slice(2)}
            </blockquote>
          );
        }
        if (/^\*[^*]+\*$/.test(trimmed)) {
          return (
            <p key={index} className="text-muted-foreground text-xs italic">
              {trimmed.replaceAll("*", "")}
            </p>
          );
        }
        return (
          <p key={index} className="text-foreground/90 text-[15px] leading-8">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

export function WorldFinaleView({ worldId }: { worldId: string }) {
  const [session, setSession] = useState<WorldGameSession | null>();
  const [plan, setPlan] = useState<FinalePlan | null>(null);
  const [chapters, setChapters] = useState<FinaleChapter[]>([]);
  const [finale, setFinale] = useState<WorldFinale | null>(null);
  const [isWriting, setIsWriting] = useState(false);
  const [writingLabel, setWritingLabel] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"article" | "share" | null>(null);
  // 自动续写只触发一次:dev 下 StrictMode 会把 effect 跑两遍。
  const bootRef = useRef<string | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(worldCouncilStorageKey(worldId));
    if (!stored) {
      setSession(null);
      return;
    }
    try {
      const parsed = worldGameSessionSchema.safeParse(JSON.parse(stored));
      if (!parsed.success || parsed.data.scenarioId !== worldId) {
        setSession(null);
        return;
      }
      setSession(parsed.data);

      const cachedFinale = readJson(finaleCacheKey(worldId), finaleSchema);
      if (cachedFinale) {
        setFinale(cachedFinale);
        setWritingLabel("全文已完成");
        return;
      }

      const cachedProgress = readJson(progressCacheKey(worldId), finaleProgressSchema);
      if (cachedProgress) {
        setPlan(cachedProgress.plan);
        setChapters(cachedProgress.chapters);
      }
    } catch (err) {
      console.error("终章存档恢复失败", err);
      setSession(null);
    }
  }, [worldId]);

  useEffect(() => {
    if (!session || session.status !== "ended" || !session.ending) return;
    if (finale || plan || runningRef.current) return;
    if (bootRef.current === worldId) return;
    bootRef.current = worldId;
    void ensurePlan(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, finale, plan, worldId]);

  function persistProgress(nextPlan: FinalePlan, nextChapters: FinaleChapter[]) {
    try {
      sessionStorage.setItem(
        progressCacheKey(worldId),
        JSON.stringify({ plan: nextPlan, chapters: nextChapters } satisfies FinaleProgress),
      );
    } catch (err) {
      console.error("终章断点写入失败", err);
    }
  }

  /** 终章两次调用共用的结算上下文。字段必须与 Server Action 的入参 schema 对齐 -- 那边入参是 unknown,少传一个只会在运行时炸 */
  function gameRef(game: WorldGameSession) {
    return {
      scenarioId: game.scenarioId,
      scenarioTitle: game.scenarioTitle,
      scenarioUrl: game.scenarioUrl,
      cast: game.cast,
      playerId: game.playerId,
      turns: game.turns,
      metrics: game.metrics,
      relations: game.relations,
      crisis: game.crisis,
      ending: game.ending ?? { type: "open", title: "", reason: "" },
    };
  }

  async function ensurePlan(game: WorldGameSession): Promise<FinalePlan | null> {
    if (plan) return plan;
    if (runningRef.current) return null;
    runningRef.current = true;
    setIsWriting(true);
    setError("");
    setWritingLabel("史官正在以知乎答主身份梳理卷目大纲……");

    try {
      const planned = await generateFinalePlanAction(gameRef(game));
      if (!planned.ok) {
        setError(userErrorMessage(planned.error));
        toast.add({ title: "卷目大纲拟定失败", description: planned.error.message, type: "error" });
        return null;
      }
      const activePlan = planned.data;
      setPlan(activePlan);
      setChapters([]);
      persistProgress(activePlan, []);
      setWritingLabel("卷目大纲与谢邀自述已就绪，等待展开第一片段");
      return activePlan;
    } catch (err) {
      console.error("卷目大纲生成异常", err);
      setError("卷目大纲生成失败，请重试");
      return null;
    } finally {
      runningRef.current = false;
      setIsWriting(false);
    }
  }

  async function writeNextChapter(game: WorldGameSession) {
    if (runningRef.current || isWriting) return;

    let activePlan = plan;
    if (!activePlan) {
      activePlan = await ensurePlan(game);
      if (!activePlan) return;
    }

    const total = activePlan.chapters.length;
    const nextIndex = chapters.length;
    if (nextIndex >= total) return;

    const chapter = activePlan.chapters[nextIndex];
    runningRef.current = true;
    setIsWriting(true);
    setError("");
    setWritingLabel(`正在撰写 第 ${nextIndex + 1} / ${total} 卷 · 《${chapter.title}》……`);

    try {
      const previous = chapters[chapters.length - 1];
      const drafted = await generateFinaleChapterAction({
        ...gameRef(game),
        chapterCount: total,
        chapter,
        outline: activePlan.chapters.map((entry) => ({
          index: entry.index,
          title: entry.title,
        })),
        previousTitle: previous?.title ?? "",
        previousTail: previous ? previous.markdown.slice(-700) : "",
      });

      if (!drafted.ok) {
        setError(userErrorMessage(drafted.error));
        toast.add({
          title: `第 ${nextIndex + 1} 卷生成失败`,
          description: drafted.error.message,
          type: "error",
        });
        return;
      }

      const nextChapters = [...chapters, drafted.data];
      setChapters(nextChapters);
      persistProgress(activePlan, nextChapters);

      if (nextChapters.length === total) {
        const articleMarkdown = assembleFinaleArticle({
          verdictTitle: activePlan.verdictTitle,
          prologue: activePlan.prologue,
          selfIntro: activePlan.selfIntro,
          chapters: nextChapters,
        });
        const assembled = finaleSchema.parse({
          verdictTitle: activePlan.verdictTitle,
          verdictLine: activePlan.verdictLine,
          rating: activePlan.rating,
          privateGoalVerdict: activePlan.privateGoalVerdict,
          privateGoalNote: activePlan.privateGoalNote,
          timeline: activePlan.timeline,
          articleMarkdown,
          charCount: countArticleChars(articleMarkdown),
          shareText: activePlan.shareText,
        });

        setFinale(assembled);
        setWritingLabel(`全文已完结，共 ${assembled.charCount.toLocaleString("zh-CN")} 字`);
        try {
          sessionStorage.setItem(finaleCacheKey(worldId), JSON.stringify(assembled));
        } catch (err) {
          console.error("终章缓存写入失败", err);
        }
        toast.add({
          title: "终章全文完结",
          description: "亲历者自述已全篇撰写完毕，可一键分享至知乎",
          type: "success",
        });
      } else {
        setWritingLabel(`第 ${nextIndex + 1} 卷已撰就，点击下方继续展开下一卷`);
        toast.add({
          title: `第 ${nextIndex + 1} 卷已撰就`,
          description: `《${chapter.title}》已生成，可继续展开下一片段`,
          type: "success",
        });
      }
    } catch (err) {
      console.error("终章片段生成异常", err);
      setError("终章片段生成失败，请重试");
    } finally {
      runningRef.current = false;
      setIsWriting(false);
    }
  }

  if (session === undefined) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!session || !session.ending || session.status !== "ended") {
    return (
      <Card className="mx-auto max-w-lg shadow-none">
        <CardHeader>
          <CardTitle>世界线尚未终局</CardTitle>
          <p className="text-muted-foreground text-sm leading-6">
            请先回到议事厅完成推演:局势自行崩盘、提前定鼎,或者由你在演满 3 回合后主动收束。
          </p>
        </CardHeader>
        <CardContent>
          <Button
            nativeButton={false}
            render={<Link href={`/world/${encodeURIComponent(worldId)}/council`} />}
          >
            返回议事厅
            <ArrowLeft data-icon="inline-end" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  const player = session.cast.playerCharacters.find(
    (character) => character.id === session.playerId,
  );

  const liveMarkdown =
    finale?.articleMarkdown ??
    (plan
      ? assembleFinaleArticle({
          verdictTitle: plan.verdictTitle,
          prologue: plan.prologue,
          selfIntro: plan.selfIntro,
          chapters,
        })
      : "");

  const charCount = countArticleChars(liveMarkdown);
  const totalChapters = plan?.chapters.length ?? 0;
  const writtenChars = chapters.reduce(
    (sum, chapter) => sum + chapter.markdown.replace(/\s/g, "").length,
    0,
  );
  const ratio = totalChapters ? Math.round((chapters.length / totalChapters) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="shadow-none">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>终章结算</Badge>
            <Badge variant="outline">{endingLabels[session.ending.type]}</Badge>
            {plan ? <Badge variant="secondary">评级 {plan.rating}</Badge> : null}
            {charCount > 0 ? (
              <Badge variant="outline">{charCount.toLocaleString("zh-CN")} 字</Badge>
            ) : null}
          </div>
          <CardTitle className="text-2xl leading-snug sm:text-3xl">
            {plan ? plan.verdictTitle : session.ending.title}
          </CardTitle>
          <p className="text-muted-foreground text-sm leading-7">
            {plan ? plan.verdictLine : session.ending.reason}
          </p>
          <p className="text-muted-foreground text-xs">
            {session.scenarioTitle}
            {player ? ` · 你扮演 ${player.name}(${player.identity})` : ""} · 共演{" "}
            {session.turns.length} 回合
          </p>
        </CardHeader>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-lg">世界终局数据卡</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {metricKeys.map((key) => (
            <Progress key={key} value={session.metrics[key]}>
              <ProgressLabel>{metricLabels[key]}</ProgressLabel>
              <ProgressValue>{() => <>{session.metrics[key]}</>}</ProgressValue>
            </Progress>
          ))}
          <Separator />
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-muted-foreground text-xs">推演回合</p>
              <p className="mt-1 font-mono text-xl font-semibold">{session.turns.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">终章评级</p>
              <p className="mt-1 font-mono text-xl font-semibold">{plan ? plan.rating : "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">结局类型</p>
              <p className="mt-1 text-xl font-semibold">{endingLabels[session.ending.type]}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {plan && player ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldQuestion className="size-4" />
              你的私密目标
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-xs leading-5">
              '{player.privateGoal}'--这件事从头到尾没有第二个人知道。
            </p>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  plan.privateGoalVerdict === "达成"
                    ? "default"
                    : plan.privateGoalVerdict === "部分达成"
                      ? "secondary"
                      : "destructive"
                }
              >
                {plan.privateGoalVerdict}
              </Badge>
            </div>
            <p className="text-sm leading-7">{plan.privateGoalNote}</p>
          </CardContent>
        </Card>
      ) : null}

      {session.relations.length ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="size-4" />
              终局人心
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {session.cast.agentCharacters.map((character) => {
              const relation = session.relations.find((item) => item.agentId === character.id);
              const trust = relation?.trust ?? 52;
              const attitude = relation?.attitude ?? "wary";
              return (
                <div key={character.id} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{character.name}</span>
                    <Badge variant="outline" className="ml-auto">
                      {attitudeLabels[attitude]}
                    </Badge>
                  </div>
                  <Progress value={trust}>
                    <ProgressLabel className="text-muted-foreground text-xs font-normal">
                      信任
                    </ProgressLabel>
                    <ProgressValue className="text-xs">{() => trust}</ProgressValue>
                  </Progress>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {plan && plan.timeline.length ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GitBranch className="size-4" />
              世界线时间轴
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-5">
              {plan.timeline.map((entry) => (
                <li key={entry.round} className="flex gap-3">
                  <span className="bg-primary text-primary-foreground grid size-6 shrink-0 place-items-center rounded-full font-mono text-xs">
                    {entry.round}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{entry.title}</p>
                    <p className="text-muted-foreground mt-1 text-xs leading-5">{entry.summary}</p>
                  </div>
                </li>
              ))}
              <Separator />
              {session.turns.map((turn) => (
                <li key={`events-${turn.round}`} className="space-y-3">
                  <p className="text-muted-foreground text-xs font-medium">
                    第 {turn.round} 回合真实发生的事件
                  </p>
                  {turn.events.map((event) => (
                    <WorldEventPanel key={event.id} event={event} />
                  ))}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-primary/20 bg-card/60 shadow-none backdrop-blur-sm">
        <CardHeader className="space-y-4 border-b pb-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-[#0066ff]/10 px-2.5 py-1 font-mono text-[11px] font-medium text-[#0066ff] dark:bg-[#0066ff]/20 dark:text-[#3b82f6]">
                  <img src="/zhihu.svg" alt="知乎" className="size-3.5 rounded-sm" />
                  知乎脑洞推演专栏
                </span>
                <span className="text-muted-foreground text-xs">· 深度亲历回答</span>
              </div>
              {session.scenarioUrl ? (
                <a
                  href={session.scenarioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-primary flex items-center gap-1 text-xs transition-colors"
                >
                  去知乎原帖讨论
                  <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>

            <CardTitle className="text-xl font-bold tracking-tight sm:text-2xl">
              {plan ? plan.verdictTitle : session.scenarioTitle}
            </CardTitle>
          </div>

          {player ? (
            <div className="bg-muted/40 border-border/70 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 sm:px-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0066ff] font-semibold text-white shadow-sm">
                  {player.name.slice(0, 1)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-sm font-semibold">{player.name}</span>
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                      当事亲历者
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {player.identity} · 【{player.faction}】阵营核心掌印人
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {plan ? (
                  <Badge variant="outline" className="border-primary/40 text-primary font-mono">
                    终章评级 {plan.rating}
                  </Badge>
                ) : null}
                <Badge variant={chapters.length >= totalChapters ? "default" : "secondary"}>
                  {chapters.length >= totalChapters
                    ? "全文已完结"
                    : `连载中 (${chapters.length}/${totalChapters} 卷)`}
                </Badge>
              </div>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {totalChapters ? (
            <div className="space-y-2">
              <Progress value={ratio}>
                <ProgressLabel className="text-xs font-normal">
                  {isWriting
                    ? "正在执笔"
                    : chapters.length >= totalChapters
                      ? "全文完成"
                      : "等待续写"}
                </ProgressLabel>
                <ProgressValue className="text-xs">
                  {() => `${chapters.length} / ${totalChapters} 卷`}
                </ProgressValue>
              </Progress>
              <p
                className="text-muted-foreground flex items-center gap-2 text-xs"
                aria-live="polite"
              >
                {isWriting ? <LoaderCircle className="text-primary size-3.5 animate-spin" /> : null}
                {writingLabel}
                {writtenChars > 0 ? ` · 已写正文 ${writtenChars.toLocaleString("zh-CN")} 字` : null}
              </p>
            </div>
          ) : isWriting ? (
            <div className="space-y-3" aria-live="polite">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-40" />
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <LoaderCircle className="text-primary size-3.5 animate-spin" />
                {writingLabel || "史官正在梳理世界线推演卷宗与自述大纲……"}
              </p>
            </div>
          ) : null}

          {!plan && error ? (
            <div className="bg-destructive/10 border-destructive/20 space-y-3 rounded-md border p-4">
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void ensurePlan(session)}
                disabled={isWriting}
              >
                <RotateCcw data-icon="inline-start" />
                重新拟定卷目大纲
              </Button>
            </div>
          ) : null}

          {liveMarkdown ? (
            <div className="border-border max-h-[70vh] overflow-y-auto rounded-md border p-5 sm:p-7">
              <ArticleBody markdown={liveMarkdown} />
              {isWriting ? (
                <p className="text-muted-foreground mt-4 flex items-center gap-2 text-xs">
                  <PenLine className="size-3.5 animate-pulse" />
                  亲历者落笔中……
                </p>
              ) : null}
            </div>
          ) : null}

          {plan && chapters.length < totalChapters ? (
            <div className="bg-muted/40 border-border/80 space-y-4 rounded-xl border p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    待展开 · 第 {plan.chapters[chapters.length].index} / {totalChapters} 卷
                  </Badge>
                  <span className="text-foreground text-sm font-semibold">
                    《{plan.chapters[chapters.length].title}》
                  </span>
                </div>
                <span className="text-muted-foreground font-mono text-xs">
                  进度: {chapters.length} / {totalChapters} 卷 ({ratio}%)
                </span>
              </div>
              <p className="text-muted-foreground text-xs leading-5">
                📖 本卷看点：{plan.chapters[chapters.length].brief}
              </p>

              {error ? (
                <div className="bg-destructive/10 border-destructive/20 rounded-md border p-3">
                  <p className="text-destructive text-xs leading-5" role="alert">
                    {error}
                  </p>
                </div>
              ) : null}

              <div className="flex items-center gap-3 pt-1">
                <Button
                  onClick={() => void writeNextChapter(session)}
                  disabled={isWriting}
                  className="w-full sm:w-auto"
                >
                  {isWriting ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      正在撰写 第 {plan.chapters[chapters.length].index} 卷……
                    </>
                  ) : error ? (
                    <>
                      <RotateCcw className="size-4" />
                      重试生成第 {plan.chapters[chapters.length].index} 卷
                    </>
                  ) : (
                    <>
                      <PenLine className="size-4" />
                      {chapters.length === 0
                        ? `执笔生成第 1 卷 · 《${plan.chapters[0].title}》`
                        : `生成下一片段：第 ${plan.chapters[chapters.length].index} 卷 · 《${plan.chapters[chapters.length].title}》`}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          {finale || (plan && chapters.length >= totalChapters) ? (
            <div className="bg-primary/5 border-primary/20 space-y-3 rounded-xl border p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge>全文完结</Badge>
                  <span className="text-sm font-semibold">知乎深度长回答已完整归档</span>
                </div>
                <span className="text-muted-foreground font-mono text-xs">
                  共 {charCount.toLocaleString("zh-CN")} 字
                </span>
              </div>
              <p className="text-muted-foreground text-xs leading-5">
                亲历者自述已全部撰写完毕，包含开篇谢邀破题、关键博弈交锋与历史终局复盘。可直接一键复制发往知乎社区。
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {plan ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ScrollText className="size-4" />
              分享到知乎
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {finale ? (
              <Button
                size="sm"
                onClick={() =>
                  void copyText(`${finale.articleMarkdown}\n\n--知乎脑洞游乐园 · 世界线推演`).then(
                    (ok) => {
                      if (ok) setCopied("article");
                      else
                        toast.add({
                          title: "复制失败",
                          description: "浏览器未授权剪贴板",
                          type: "error",
                        });
                    },
                  )
                }
              >
                {copied === "article" ? (
                  <Check data-icon="inline-start" />
                ) : (
                  <Copy data-icon="inline-start" />
                )}
                {copied === "article" ? "已复制全文" : "复制全文"}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void copyText(plan.shareText).then((ok) => {
                  if (ok) setCopied("share");
                  else
                    toast.add({
                      title: "复制失败",
                      description: "浏览器未授权剪贴板",
                      type: "error",
                    });
                })
              }
            >
              {copied === "share" ? (
                <Check data-icon="inline-start" />
              ) : (
                <Copy data-icon="inline-start" />
              )}
              {copied === "share" ? "已复制分享卡" : "复制分享卡"}
            </Button>
            {session.scenarioUrl ? (
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<a href={session.scenarioUrl} target="_blank" rel="noreferrer" />}
              >
                去知乎原帖讨论
                <ExternalLink data-icon="inline-end" />
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" nativeButton={false} render={<Link href="/" />}>
              再开一条世界线
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

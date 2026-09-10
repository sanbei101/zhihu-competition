"use client";

import {
  ArrowLeft,
  BookOpenText,
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

import { generateFinaleChapterAction, generateFinalePlanAction } from "@/app/world/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { WorldEventPanel } from "@/components/world-event";
import { worldCouncilStorageKey } from "@/lib/world-cast";
import {
  assembleFinaleArticle,
  attitudeLabels,
  countArticleChars,
  endingLabels,
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

function readJson<T>(key: string): T | null {
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

/** 极简 markdown 渲染:只认标题、分隔线、斜体落款和普通段落。 */
function ArticleBody({ markdown }: { markdown: string }) {
  const blocks = markdown.split(/\n{2,}/);
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (/^-{3,}$/.test(trimmed)) return <Separator key={index} />;
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={index} className="text-2xl leading-9 font-semibold">
              {trimmed.slice(2)}
            </h2>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={index} className="pt-3 text-lg font-semibold">
              {trimmed.slice(3)}
            </h3>
          );
        }
        if (/^\*[^*]+\*$/.test(trimmed)) {
          return (
            <p key={index} className="text-muted-foreground text-xs">
              {trimmed.replaceAll("*", "")}
            </p>
          );
        }
        return (
          <p key={index} className="text-[15px] leading-8">
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

      const cachedFinale = readJson<WorldFinale>(finaleCacheKey(worldId));
      const parsedFinale = cachedFinale ? finaleSchema.safeParse(cachedFinale) : null;
      if (parsedFinale?.success) {
        setFinale(parsedFinale.data);
        setWritingLabel("全文已完成");
        return;
      }

      const cachedProgress = readJson<FinaleProgress>(progressCacheKey(worldId));
      if (cachedProgress?.plan) {
        setPlan(cachedProgress.plan);
        setChapters(cachedProgress.chapters ?? []);
      }
    } catch (err) {
      console.error("终章存档恢复失败", err);
      setSession(null);
    }
  }, [worldId]);

  useEffect(() => {
    if (!session || session.status !== "ended" || !session.ending) return;
    if (finale || runningRef.current) return;
    if (bootRef.current === worldId) return;
    bootRef.current = worldId;
    void run(session);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, finale, worldId]);

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

  function gameRef(game: WorldGameSession) {
    return {
      scenarioId: game.scenarioId,
      scenarioTitle: game.scenarioTitle,
      cast: game.cast,
      playerId: game.playerId,
      turns: game.turns,
      metrics: game.metrics,
      ending: game.ending ?? { type: "open", title: "", reason: "" },
    };
  }

  async function run(game: WorldGameSession) {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsWriting(true);
    setError("");

    let activePlan = plan;
    let written = [...chapters];

    try {
      if (!activePlan) {
        setWritingLabel("史官正在梳理卷目……");
        const planned = await generateFinalePlanAction(gameRef(game));
        if (!planned.ok) {
          setError(`${planned.error}${planned.detail ? `:${planned.detail}` : ""}`);
          toast.add({ title: "卷目生成失败", description: planned.error, type: "error" });
          return;
        }
        activePlan = planned.data;
        written = [];
        setPlan(activePlan);
        setChapters([]);
        persistProgress(activePlan, []);
      }

      const total = activePlan.chapters.length;
      for (let index = written.length; index < total; index += 1) {
        const chapter = activePlan.chapters[index];
        setWritingLabel(`正在撰写 第 ${index + 1} / ${total} 章 · ${chapter.title}`);
        const previous = written[written.length - 1];

        // 必须逐章串行:每一章都要接着上一章的结尾往下写,不能并行。
        // eslint-disable-next-line no-await-in-loop
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
          setError(`${drafted.error}${drafted.detail ? `:${drafted.detail}` : ""}`);
          toast.add({
            title: `第 ${index + 1} 章生成失败`,
            description: drafted.error,
            type: "error",
          });
          return;
        }

        written = [...written, drafted.data];
        setChapters(written);
        persistProgress(activePlan, written);
      }

      const articleMarkdown = assembleFinaleArticle({
        verdictTitle: activePlan.verdictTitle,
        preface: activePlan.preface,
        chapters: written,
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
      setWritingLabel(`全文已完成,共 ${assembled.charCount.toLocaleString("zh-CN")} 字`);
      try {
        sessionStorage.setItem(finaleCacheKey(worldId), JSON.stringify(assembled));
      } catch (err) {
        console.error("终章缓存写入失败", err);
      }
      toast.add({ title: "终章已写完", type: "success" });
    } catch (err) {
      console.error("终章生成异常", err);
      setError(err instanceof Error ? err.message : "终章生成异常");
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
          preface: plan.preface,
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
              「{player.privateGoal}」——这件事从头到尾没有第二个人知道。
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

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpenText className="size-4" />
            亲历者自述
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {totalChapters ? (
            <div className="space-y-2">
              <Progress value={ratio}>
                <ProgressLabel className="text-xs font-normal">
                  {isWriting ? "正在续写" : "写作完成"}
                </ProgressLabel>
                <ProgressValue className="text-xs">
                  {() => `${chapters.length} / ${totalChapters} 章`}
                </ProgressValue>
              </Progress>
              <p
                className="text-muted-foreground flex items-center gap-2 text-xs"
                aria-live="polite"
              >
                {isWriting ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
                {writingLabel}
                {writtenChars > 0 ? ` · 已写正文 ${writtenChars.toLocaleString("zh-CN")} 字` : null}
              </p>
            </div>
          ) : isWriting ? (
            <div className="space-y-3" aria-live="polite">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-40" />
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <LoaderCircle className="size-3.5 animate-spin" />
                {writingLabel || "史官正在整理你的世界线……"}
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="space-y-3">
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void run(session)}
                disabled={isWriting}
              >
                <RotateCcw data-icon="inline-start" />
                {chapters.length ? "从断点继续写" : "重新生成终章"}
              </Button>
            </div>
          ) : null}

          {liveMarkdown ? (
            <div className="border-border max-h-[70vh] overflow-y-auto rounded-md border p-5 sm:p-7">
              <ArticleBody markdown={liveMarkdown} />
              {isWriting ? (
                <p className="text-muted-foreground mt-4 flex items-center gap-2 text-xs">
                  <PenLine className="size-3.5" />
                  下笔中……
                </p>
              ) : null}
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

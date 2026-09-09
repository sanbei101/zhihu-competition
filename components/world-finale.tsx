"use client";

import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  GitBranch,
  LoaderCircle,
  RotateCcw,
  ScrollText,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { generateFinaleAction } from "@/app/world/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { worldCouncilStorageKey } from "@/lib/world-cast";
import {
  endingLabels,
  metricKeys,
  metricLabels,
  worldGameSessionSchema,
  type WorldFinale,
  type WorldGameSession,
} from "@/lib/world-ending";

function finaleCacheKey(worldId: string) {
  return `world-finale:${worldId}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function WorldFinaleView({ worldId }: { worldId: string }) {
  const [session, setSession] = useState<WorldGameSession | null>();
  const [finale, setFinale] = useState<WorldFinale | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState<"article" | "share" | null>(null);
  // 自动结算只触发一次：dev 下 StrictMode 会把 effect 跑两遍，不拦会调两次终章生成。
  const autoFinaleRef = useRef<string | null>(null);

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

      const cached = sessionStorage.getItem(finaleCacheKey(worldId));
      if (cached) {
        try {
          const cachedFinale = JSON.parse(cached) as WorldFinale;
          if (cachedFinale.articleMarkdown) {
            setFinale(cachedFinale);
            return;
          }
        } catch {
          sessionStorage.removeItem(finaleCacheKey(worldId));
        }
      }

      if (parsed.data.status === "ended" && parsed.data.ending) {
        if (autoFinaleRef.current !== worldId) {
          autoFinaleRef.current = worldId;
          void requestFinale(parsed.data);
        }
      }
    } catch (err) {
      console.error("[岔路] 终章存档恢复失败", err);
      setSession(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId]);

  async function requestFinale(game: WorldGameSession) {
    if (!game.ending) return;
    setIsLoading(true);
    setError("");
    const result = await generateFinaleAction({
      scenarioId: game.scenarioId,
      scenarioTitle: game.scenarioTitle,
      scenarioUrl: game.scenarioUrl,
      cast: game.cast,
      playerId: game.playerId,
      turns: game.turns,
      metrics: game.metrics,
      ending: game.ending,
    });
    setIsLoading(false);
    if (!result.ok) {
      const message = `${result.error}${result.detail ? `：${result.detail}` : ""}`;
      setError(message);
      toast.add({ title: "终章生成失败", description: result.error, type: "error" });
      return;
    }
    setFinale(result.data);
    toast.add({ title: "终章已生成", type: "success" });
    try {
      sessionStorage.setItem(finaleCacheKey(worldId), JSON.stringify(result.data));
    } catch (err) {
      console.error("[岔路] 终章缓存写入失败", err);
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
            请先回到议事厅完成推演(跑满 5 回合、触发提前结局,或第 3 回合后主动收束)。
          </p>
        </CardHeader>
        <CardContent>
          <Button render={<Link href={`/world/${encodeURIComponent(worldId)}/council`} />}>
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="shadow-none">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>终章结算</Badge>
            <Badge variant="outline">{endingLabels[session.ending.type]}</Badge>
            {finale ? <Badge variant="secondary">评级 {finale.rating}</Badge> : null}
          </div>
          <CardTitle className="text-2xl leading-snug sm:text-3xl">
            {finale ? finale.verdictTitle : session.ending.title}
          </CardTitle>
          <p className="text-muted-foreground text-sm leading-7">
            {finale ? finale.verdictLine : session.ending.reason}
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
              <p className="mt-1 font-mono text-xl font-semibold">{finale ? finale.rating : "-"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">结局类型</p>
              <p className="mt-1 text-xl font-semibold">{endingLabels[session.ending.type]}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {finale ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GitBranch className="size-4" />
              世界线时间轴
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-5">
              {finale.timeline.map((entry) => (
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
            </ol>
          </CardContent>
        </Card>
      ) : null}

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="size-4" />
            知乎体深度长文
          </CardTitle>
          <p className="text-muted-foreground text-xs leading-5">
            由史官根据你的真实推演记录整理,可一键复制去知乎社区发帖分享。
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3" aria-live="polite">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-40" />
              <p className="text-muted-foreground flex items-center gap-2 text-xs">
                <LoaderCircle className="size-3.5 animate-spin" />
                史官正在整理你的世界线……
              </p>
            </div>
          ) : finale ? (
            <p className="text-sm leading-8 whitespace-pre-wrap">{finale.articleMarkdown}</p>
          ) : (
            <div className="space-y-3">
              <p className="text-destructive text-sm" role="alert">
                {error || "终章尚未生成"}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void requestFinale(session)}
                disabled={isLoading}
              >
                <RotateCcw data-icon="inline-start" />
                重新生成终章
              </Button>
            </div>
          )}
          {error && finale ? (
            <p className="text-destructive mt-3 text-xs" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {finale ? (
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-lg">分享到知乎</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                void copyText(
                  `${finale.verdictTitle}\n\n${finale.articleMarkdown}\n\n——岔路世界线推演`,
                ).then((ok) => {
                  if (ok) setCopied("article");
                  else
                    toast.add({
                      title: "复制失败",
                      description: "浏览器未授权剪贴板",
                      type: "error",
                    });
                })
              }
            >
              {copied === "article" ? (
                <Check data-icon="inline-start" />
              ) : (
                <Copy data-icon="inline-start" />
              )}
              {copied === "article" ? "已复制全文" : "复制全文"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void copyText(finale.shareText).then((ok) => {
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
                render={<a href={session.scenarioUrl} target="_blank" rel="noreferrer" />}
              >
                去知乎原帖讨论
                <ExternalLink data-icon="inline-end" />
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" render={<Link href="/" />}>
              再开一条世界线
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

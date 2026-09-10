"use client";

import { Bot, LoaderCircle, Play, RefreshCw, Sparkles, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast";
import { clearCachedCast, loadCachedCast, saveCachedCast } from "@/lib/world-cache";
import {
  type WorldCast,
  worldCastStreamEventSchema,
  worldCouncilStorageKey,
} from "@/lib/world-cast";
import { createInitialGameSession } from "@/lib/world-ending";

interface WorldCastProps {
  scenario: {
    id: string;
    title: string;
    content: string;
    url?: string;
  };
}

export function WorldCastPanel({ scenario }: WorldCastProps) {
  const router = useRouter();
  const [cast, setCast] = useState<WorldCast | null>(null);
  const [streamingSetting, setStreamingSetting] = useState<WorldCast["setting"] | null>(null);
  const [streamingPlayers, setStreamingPlayers] = useState<WorldCast["playerCharacters"]>([]);
  const [streamingAgents, setStreamingAgents] = useState<WorldCast["agentCharacters"]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cacheNote, setCacheNote] = useState("");
  const [elapsed, setElapsed] = useState("");

  // 刷新页面后从本地缓存恢复阵容,不用重新等模型生成
  useEffect(() => {
    const cached = loadCachedCast(scenario.id);
    if (cached) {
      setCast(cached.cast);
      setStreamingSetting(cached.cast.setting);
      setStreamingPlayers(cached.cast.playerCharacters);
      setStreamingAgents(cached.cast.agentCharacters);
      setCacheNote(
        `已从本地缓存恢复(${new Date(cached.savedAt).toLocaleString("zh-CN", { hour12: false })})`,
      );
    }
  }, [scenario.id]);

  async function generateCast() {
    setError("");
    setIsLoading(true);
    setCast(null);
    setStreamingSetting(null);
    setStreamingPlayers([]);
    setStreamingAgents([]);
    setSelectedCharacterId(null);
    setCacheNote("");
    setElapsed("");
    const startedAt = Date.now();

    try {
      const response = await fetch("/api/world-cast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: scenario.id,
          title: scenario.title,
          content: scenario.content,
        }),
      });

      if (!response.ok) throw new Error(`角色生成请求失败(${response.status})`);
      if (!response.body) throw new Error("浏览器未收到角色生成响应流");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const completedCast: { value: WorldCast | null } = { value: null };

      function applyLine(line: string) {
        if (!line.trim()) return;
        const parsed = worldCastStreamEventSchema.safeParse(JSON.parse(line));
        if (!parsed.success) throw new Error("角色生成事件结构不匹配");
        const event = parsed.data;
        if (event.type === "setting") setStreamingSetting(event.setting);
        if (event.type === "player-character") {
          setStreamingPlayers((current) =>
            current.some((character) => character.id === event.character.id)
              ? current
              : [...current, event.character],
          );
        }
        if (event.type === "agent-character") {
          setStreamingAgents((current) =>
            current.some((character) => character.id === event.character.id)
              ? current
              : [...current, event.character],
          );
        }
        if (event.type === "error") throw new Error(event.error);
        if (event.type === "complete") completedCast.value = event.cast;
      }

      for (;;) {
        // eslint-disable-next-line no-await-in-loop -- 流式读取必须串行等待每个 chunk
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) applyLine(line);
      }
      buffer += decoder.decode();
      if (buffer.trim()) applyLine(buffer);
      const finalCast = completedCast.value;
      if (!finalCast) throw new Error("角色阵容没有完整生成");

      setCast(finalCast);
      setStreamingSetting(finalCast.setting);
      setStreamingPlayers(finalCast.playerCharacters);
      setStreamingAgents(finalCast.agentCharacters);
      saveCachedCast(scenario.id, finalCast);
      setElapsed(`本次生成耗时 ${((Date.now() - startedAt) / 1000).toFixed(1)}s,已存入本地缓存`);
      toast.add({
        title: "角色阵容已生成",
        description: "挑选你的角色进入第一幕",
        type: "success",
      });
    } catch (cause) {
      console.error("角色阵容请求失败", cause);
      const message = cause instanceof Error ? cause.message : "角色生成失败";
      setError(message);
      toast.add({ title: "角色生成失败", description: message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  }

  function clearCache() {
    clearCachedCast(scenario.id);
    setCast(null);
    setStreamingSetting(null);
    setStreamingPlayers([]);
    setStreamingAgents([]);
    setSelectedCharacterId(null);
    setCacheNote("");
    setElapsed("");
    toast.add({ title: "已清除本地缓存", type: "info" });
  }

  const visibleSetting = cast?.setting ?? streamingSetting;
  const visiblePlayers = cast?.playerCharacters ?? streamingPlayers;
  const visibleAgents = cast?.agentCharacters ?? streamingAgents;
  const selectedCharacter = visiblePlayers.find(
    (character) => character.id === selectedCharacterId,
  );

  function enterCouncil() {
    if (!cast || !selectedCharacter) return;

    sessionStorage.setItem(
      worldCouncilStorageKey(scenario.id),
      JSON.stringify(
        createInitialGameSession({
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          scenarioUrl: scenario.url ?? "",
          playerId: selectedCharacter.id,
          cast,
        }),
      ),
    );
    router.push(`/world/${encodeURIComponent(scenario.id)}/council`);
  }

  return (
    <>
      <aside>
        <Card className="border-border/70 shadow-none">
          <CardHeader className="p-6">
            <Badge variant="secondary" className="w-fit">
              WORLDLINE / CAST
            </Badge>
            <CardTitle className="pt-2 text-xl leading-8">召集第一幕角色</CardTitle>
            <CardDescription className="leading-6">
              DeepSeek 将依据副本生成三名玩家候选与四名独立 Agent 角色。
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6">
            <ol className="text-muted-foreground space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="text-primary font-mono">01</span>
                <span>建立危机发生时的时间、地点与局势</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-mono">02</span>
                <span>生成权力来源不同的玩家候选角色</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary font-mono">03</span>
                <span>配置由独立 Agent 扮演的利益相关者</span>
              </li>
            </ol>
            <p
              className="text-destructive mt-5 text-sm break-words whitespace-pre-wrap"
              role="alert"
              aria-live="polite"
            >
              {error}
            </p>
            {cacheNote || elapsed ? (
              <p className="text-muted-foreground mt-3 text-xs leading-5" aria-live="polite">
                {[cacheNote, elapsed].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="bg-muted/30 flex-col items-stretch gap-2 border-t px-6 py-4">
            <Button className="w-full" onClick={generateCast} disabled={isLoading}>
              {isLoading ? (
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
              ) : cast ? (
                <RefreshCw data-icon="inline-start" />
              ) : (
                <Sparkles data-icon="inline-start" />
              )}
              {isLoading
                ? `正在召集角色 (${visiblePlayers.length + visibleAgents.length}/7)`
                : cast
                  ? "重新生成阵容"
                  : "生成角色阵容"}
            </Button>
            {cast && !isLoading ? (
              <Button variant="ghost" size="sm" className="w-full" onClick={clearCache}>
                清除本地缓存
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      </aside>

      {visibleSetting ? (
        <section className="space-y-10 lg:col-span-2" aria-live="polite">
          <div className="border-primary border-l-4 pl-6">
            <p className="text-primary text-sm font-medium">ACT I / OPENING</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">{visibleSetting.crisis}</h2>
            <p className="text-muted-foreground mt-3 text-sm">
              {visibleSetting.time} · {visibleSetting.location}
            </p>
            <p className="mt-5 max-w-4xl text-base leading-8">{visibleSetting.opening}</p>
            <div className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
              {visibleSetting.rules.map((rule) => (
                <div key={rule} className="bg-muted/60 rounded-md px-3 py-2 leading-6">
                  {rule}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-5 flex items-center gap-3">
              <UserRound className="text-primary size-5" />
              <div>
                <h2 className="text-xl font-semibold">选择你的角色</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  选择后才会揭示该角色的秘密动机。
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {visiblePlayers.map((character) => {
                const isSelected = character.id === selectedCharacterId;

                return (
                  <Card
                    key={character.id}
                    className={isSelected ? "border-primary shadow-none" : "shadow-none"}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle>{character.name}</CardTitle>
                          <CardDescription className="mt-1">{character.identity}</CardDescription>
                        </div>
                        <Badge variant="outline">{character.faction}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm leading-6">
                      <p>{character.personality}</p>
                      <Separator />
                      <div>
                        <p className="text-muted-foreground text-xs">公开目标</p>
                        <p className="mt-1">{character.publicGoal}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">可调动资源</p>
                        <p className="mt-1">{character.decisionPower}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">私密目标(只有你知道)</p>
                        <p className="mt-1">{character.privateGoal}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">关系钩子</p>
                        <p className="mt-1">{character.relationship}</p>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        variant={isSelected ? "secondary" : "outline"}
                        className="w-full"
                        onClick={() => setSelectedCharacterId(character.id)}
                      >
                        {isSelected ? "已选择" : `扮演 ${character.name}`}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
            {selectedCharacter && cast ? (
              <div className="bg-muted mt-4 flex flex-col justify-between gap-4 rounded-lg p-5 text-sm leading-6 sm:flex-row sm:items-center">
                <div>
                  <p className="font-medium">{selectedCharacter.name}的秘密</p>
                  <p className="text-muted-foreground mt-1">{selectedCharacter.secret}</p>
                </div>
                <Button className="shrink-0" onClick={enterCouncil}>
                  进入第一幕
                  <Play data-icon="inline-end" />
                </Button>
              </div>
            ) : null}
          </div>

          <div>
            <div className="mb-5 flex items-center gap-3">
              <Bot className="text-primary size-5" />
              <div>
                <h2 className="text-xl font-semibold">Agent 阵营</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  这些人物将在后续回合中独立判断、结盟与施压。
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {visibleAgents.map((character) => (
                <Card key={character.id} className="shadow-none">
                  <CardHeader>
                    <Badge variant="secondary" className="w-fit">
                      AI AGENT
                    </Badge>
                    <CardTitle className="pt-2">{character.name}</CardTitle>
                    <CardDescription>
                      {character.identity} · {character.faction}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm leading-6">
                    <p>{character.personality}</p>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground text-xs">公开诉求</p>
                      <p className="mt-1">{character.publicGoal}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">施压手段</p>
                      <p className="mt-1">{character.pressureMethod}</p>
                    </div>
                    <blockquote className="text-muted-foreground border-l pl-3">
                      "{character.openingLine}"
                    </blockquote>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

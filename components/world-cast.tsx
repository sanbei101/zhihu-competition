"use client";

import { Bot, LoaderCircle, Play, RefreshCw, Sparkles, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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
import TextType from "@/components/ui/TextType";
import { toast } from "@/components/ui/toast";
import { errorEnvelopeSchema, userErrorMessage } from "@/lib/app-error";
import { readNdjsonStream } from "@/lib/ndjson-stream";
import { getCastPreset } from "@/lib/presets";
import { clearCachedCast, loadCachedCast, saveCachedCast } from "@/lib/world-cache";
import {
  type WorldCast,
  type WorldCastStage,
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
  const [currentPresetId, setCurrentPresetId] = useState<string>("");
  const currentPresetIdRef = useRef<string>("");
  currentPresetIdRef.current = currentPresetId;

  const [streamingSetting, setStreamingSetting] = useState<WorldCast["setting"] | null>(null);
  const [streamingPlayers, setStreamingPlayers] = useState<WorldCast["playerCharacters"]>([]);
  const [streamingAgents, setStreamingAgents] = useState<WorldCast["agentCharacters"]>([]);
  const [streamingStage, setStreamingStage] = useState<WorldCastStage | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cacheNote, setCacheNote] = useState("");
  const [elapsed, setElapsed] = useState("");

  const generateCast = useCallback(
    async (overrideExcludePresetId?: string) => {
      const excludeId =
        overrideExcludePresetId !== undefined
          ? overrideExcludePresetId
          : currentPresetIdRef.current;

      setError("");
      setIsLoading(true);
      setCast(null);
      setStreamingSetting(null);
      setStreamingPlayers([]);
      setStreamingAgents([]);
      setStreamingStage("setting");
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
            excludePresetId: excludeId,
          }),
        });

        if (!response.ok) {
          let message = `世界线推演请求失败(${response.status})`;
          try {
            const body: unknown = await response.json();
            const parsedError = errorEnvelopeSchema.safeParse(body);
            if (parsedError.success) message = userErrorMessage(parsedError.data.error);
          } catch {
            // 保留状态码兜底提示
          }
          throw new Error(message);
        }
        const completedCast: { value: WorldCast | null } = { value: null };

        await readNdjsonStream(response, worldCastStreamEventSchema, (event) => {
          if (event.type === "stage") setStreamingStage(event.stage);
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
          if (event.type === "error") throw new Error(userErrorMessage(event.error));
          if (event.type === "complete") completedCast.value = event.cast;
        });
        const finalCast = completedCast.value;
        if (!finalCast) throw new Error("世界线角色阵容未完整生成");

        const nextLookup = getCastPreset({
          scenarioId: scenario.id,
          excludePresetId: excludeId,
        });
        setCurrentPresetId(nextLookup.preset.id);
        currentPresetIdRef.current = nextLookup.preset.id;

        setCast(finalCast);
        setStreamingSetting(finalCast.setting);
        setStreamingPlayers(finalCast.playerCharacters);
        setStreamingAgents(finalCast.agentCharacters);
        setStreamingStage(null);
        saveCachedCast(scenario.id, finalCast);
        const spent = ((Date.now() - startedAt) / 1000).toFixed(2);
        setElapsed(`推演完成 (${spent}s) · 视角:《${nextLookup.preset.title}》`);
        toast.add({
          title: "世界线推演完成",
          description: `当前视角:《${nextLookup.preset.title}》`,
          type: "success",
        });
      } catch (cause) {
        console.error("世界线推演请求失败", cause);
        const message = cause instanceof Error ? cause.message : "推演失败";
        setError(message);
        toast.add({ title: "推演失败", description: message, type: "error" });
      } finally {
        setIsLoading(false);
      }
    },
    [scenario.id, scenario.title, scenario.content],
  );

  // 页面加载后从本地记录恢复；若无本地记录则自动推演初始阵容
  useEffect(() => {
    const cached = loadCachedCast(scenario.id);
    if (cached) {
      setCast(cached.cast);
      setStreamingSetting(cached.cast.setting);
      setStreamingPlayers(cached.cast.playerCharacters);
      setStreamingAgents(cached.cast.agentCharacters);
      setCacheNote(
        `已从本地记录恢复(${new Date(cached.savedAt).toLocaleString("zh-CN", { hour12: false })})`,
      );
      return;
    }

    void generateCast();
  }, [scenario.id, generateCast]);

  function clearCache() {
    clearCachedCast(scenario.id);
    setCast(null);
    setStreamingSetting(null);
    setStreamingPlayers([]);
    setStreamingAgents([]);
    setStreamingStage(null);
    setSelectedCharacterId(null);
    setCacheNote("");
    setElapsed("");
    setCurrentPresetId("");
    toast.add({ title: "已重置本地推演记录", type: "info" });
    void generateCast("");
  }

  const visibleSetting = cast?.setting ?? streamingSetting;
  const visiblePlayers = cast?.playerCharacters ?? streamingPlayers;
  const visibleAgents = cast?.agentCharacters ?? streamingAgents;
  const selectedCharacter = visiblePlayers.find(
    (character) => character.id === selectedCharacterId,
  );
  const stageLabels: Record<WorldCastStage, string> = {
    setting: "正在建立世界背景与推演规则",
    players: "正在推演玩家候选角色",
    agents: "正在配置 Agent 利益集团",
  };

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
            <CardTitle className="pt-2 text-xl leading-8">世界线推演与角色召集</CardTitle>
            <CardDescription className="leading-6">
              推演引擎已就绪，已锁定本世界线推演剧本，支持切换不同推演视角与阵营。
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
            {isLoading && streamingStage ? (
              <p className="text-primary mt-5 text-sm font-medium" aria-live="polite">
                {stageLabels[streamingStage]}...
              </p>
            ) : null}
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
            <Button className="w-full" onClick={() => generateCast()} disabled={isLoading}>
              {isLoading ? (
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
              ) : cast ? (
                <RefreshCw data-icon="inline-start" />
              ) : (
                <Sparkles data-icon="inline-start" />
              )}
              {isLoading
                ? `正在推演角色阵容 (${visiblePlayers.length + visibleAgents.length}/7)`
                : cast
                  ? "推演其他分支世界线"
                  : "推演世界线阵容"}
            </Button>
            {cast && !isLoading ? (
              <Button variant="ghost" size="sm" className="w-full" onClick={clearCache}>
                重置推演进度
              </Button>
            ) : null}
          </CardFooter>
        </Card>
      </aside>

      {visibleSetting ? (
        <section className="space-y-10 lg:col-span-2" aria-live="polite">
          <div className="border-primary animate-in fade-in border-l-4 pl-6 duration-500">
            <p className="text-primary text-sm font-medium">ACT I / OPENING</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              <TextType
                key={`crisis-${currentPresetId || visibleSetting.crisis}`}
                text={visibleSetting.crisis}
                as="span"
                loop={false}
                typingSpeed={25}
                showCursor={false}
              />
            </h2>
            <p className="text-muted-foreground mt-3 text-sm">
              {visibleSetting.time} · {visibleSetting.location}
            </p>
            <div className="text-foreground/90 mt-5 max-w-4xl text-base leading-8 font-normal">
              <TextType
                key={`opening-${currentPresetId || visibleSetting.opening}`}
                text={visibleSetting.opening}
                as="p"
                loop={false}
                typingSpeed={16}
                initialDelay={80}
                showCursor={true}
                cursorCharacter="▎"
                cursorClassName="text-primary font-bold animate-pulse ml-0.5"
                className="block w-full"
              />
            </div>
            <div className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
              {visibleSetting.rules.map((rule, idx) => (
                <div
                  key={rule}
                  className="bg-muted/60 animate-in fade-in slide-in-from-bottom-1 rounded-md px-3 py-2 leading-6 duration-300"
                >
                  <TextType
                    key={`rule-${currentPresetId}-${idx}`}
                    text={rule}
                    as="span"
                    loop={false}
                    typingSpeed={20}
                    initialDelay={250 + idx * 100}
                    showCursor={false}
                  />
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
                    className={`animate-in fade-in slide-in-from-bottom-2 min-w-0 shadow-none duration-300 ${
                      isSelected ? "border-primary" : ""
                    }`}
                  >
                    <CardHeader>
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                        <div className="min-w-0">
                          <CardTitle>{character.name}</CardTitle>
                          <CardDescription className="mt-1">{character.identity}</CardDescription>
                        </div>
                        <Badge
                          variant="outline"
                          className="h-auto max-w-full text-left whitespace-normal"
                        >
                          {character.faction}
                        </Badge>
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
                    <CardFooter className="mt-auto">
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
                <Card
                  key={character.id}
                  className="animate-in fade-in slide-in-from-bottom-2 shadow-none duration-300"
                >
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
                    <blockquote className="text-muted-foreground border-l pl-3 italic">
                      “
                      <TextType
                        key={`quote-${character.id}-${character.openingLine}`}
                        text={character.openingLine}
                        as="span"
                        loop={false}
                        typingSpeed={20}
                        initialDelay={150}
                        showCursor={false}
                      />
                      ”
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

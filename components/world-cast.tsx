"use client";

import { Bot, LoaderCircle, Play, RefreshCw, Sparkles, UserRound } from "lucide-react";
import { useState } from "react";

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
import { WorldCouncil } from "@/components/world-council";
import { type WorldCast, worldCastSchema } from "@/lib/world-cast";

interface WorldCastProps {
  scenario: {
    id: string;
    title: string;
    content: string;
  };
}

export function WorldCastPanel({ scenario }: WorldCastProps) {
  const [cast, setCast] = useState<WorldCast | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function generateCast() {
    setError("");
    setIsLoading(true);

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
      const body: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof body === "object" && body !== null && "error" in body
            ? String(body.error)
            : "角色生成失败";
        const detail =
          typeof body === "object" && body !== null && "detail" in body ? String(body.detail) : "";
        throw new Error(detail ? `${message}\n${detail}` : message);
      }

      setCast(worldCastSchema.parse(body));
      setSelectedCharacterId(null);
      setHasStarted(false);
    } catch (cause) {
      console.error("[岔路] 角色阵容请求失败", cause);
      setError(cause instanceof Error ? cause.message : "角色生成失败");
    } finally {
      setIsLoading(false);
    }
  }

  const selectedCharacter = cast?.playerCharacters.find(
    (character) => character.id === selectedCharacterId,
  );

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
              DeepSeek 将依据母本生成三名玩家候选与四名独立 Agent 角色。
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
          </CardContent>
          <CardFooter className="bg-muted/30 border-t px-6 py-4">
            <Button className="w-full" onClick={generateCast} disabled={isLoading}>
              {isLoading ? (
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
              ) : cast ? (
                <RefreshCw data-icon="inline-start" />
              ) : (
                <Sparkles data-icon="inline-start" />
              )}
              {isLoading ? "正在召集角色" : cast ? "重新生成阵容" : "生成角色阵容"}
            </Button>
          </CardFooter>
        </Card>
      </aside>

      {cast ? (
        <section className="space-y-10 lg:col-span-2" aria-live="polite">
          {hasStarted && selectedCharacter ? (
            <WorldCouncil
              cast={cast}
              player={selectedCharacter}
              onBack={() => setHasStarted(false)}
            />
          ) : (
            <>
              <div className="border-primary border-l-4 pl-6">
                <p className="text-primary text-sm font-medium">ACT I / OPENING</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  {cast.setting.crisis}
                </h2>
                <p className="text-muted-foreground mt-3 text-sm">
                  {cast.setting.time} · {cast.setting.location}
                </p>
                <p className="mt-5 max-w-4xl text-base leading-8">{cast.setting.opening}</p>
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
                  {cast.playerCharacters.map((character) => {
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
                              <CardDescription className="mt-1">
                                {character.identity}
                              </CardDescription>
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
                {selectedCharacter ? (
                  <div className="bg-muted mt-4 flex flex-col justify-between gap-4 rounded-lg p-5 text-sm leading-6 sm:flex-row sm:items-center">
                    <div>
                      <p className="font-medium">{selectedCharacter.name}的秘密</p>
                      <p className="text-muted-foreground mt-1">{selectedCharacter.secret}</p>
                    </div>
                    <Button className="shrink-0" onClick={() => setHasStarted(true)}>
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
                  {cast.agentCharacters.map((character) => (
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
                          “{character.openingLine}”
                        </blockquote>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      ) : null}
    </>
  );
}

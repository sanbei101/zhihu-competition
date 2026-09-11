"use client";

import { ShieldQuestion, Swords, UserRound } from "lucide-react";

import { PixelSprite } from "@/components/pixel/pixel-sprite";
import { portraitFor } from "@/components/pixel/portraits";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import { type WorldCast } from "@/lib/world-cast";
import {
  attitudeHints,
  attitudeLabels,
  relationOf,
  type AgentRelation,
  type WorldUltimatum,
} from "@/lib/world-ending";

export type AgentStatus = "thinking" | "done" | "error";

interface SeatsPanelProps {
  cast: WorldCast;
  activePlayer: WorldCast["playerCharacters"][number];
  agentStatuses: Record<string, AgentStatus>;
  relations: AgentRelation[];
  ultimatum: WorldUltimatum | null;
  /** 台上正在发言的人(玩家的抉择也算):点亮他那一席,其余压暗 */
  speakingId?: string | null;
  /** 交锋时站在他对面的那个人:给一圈红边,和'正在说话'区分开 */
  opposingId?: string | null;
  skin: ScenarioSkin;
}

type SeatState = "idle" | "speaking" | "opposing";

function seatStateOf(
  id: string,
  speakingId?: string | null,
  opposingId?: string | null,
): SeatState {
  if (speakingId === id) return "speaking";
  if (opposingId === id) return "opposing";
  return "idle";
}

/** 台上有人时,没上台的一律压暗,视线才知道往哪看 */
function seatTone(state: SeatState, someoneOnStage: boolean) {
  if (state === "speaking") return "bg-primary/5 ring-1 ring-primary/30";
  if (state === "opposing") return "ring-1 ring-destructive/30";
  return someoneOnStage ? "opacity-55" : "";
}

const attitudeTone: Record<AgentRelation["attitude"], string> = {
  loyal: "border-emerald-500/60 bg-emerald-100 text-emerald-700",
  wary: "border-border bg-muted text-muted-foreground",
  pressuring: "border-amber-500/60 bg-amber-100 text-amber-800",
  defected: "border-red-500/60 bg-red-100 text-red-700",
};

function statusDot(status: AgentStatus | undefined) {
  if (status === "done")
    return { className: "size-2 rounded-full bg-emerald-500", label: "已回应" };
  if (status === "thinking")
    return { className: "size-2 animate-pulse rounded-full bg-amber-500", label: "思考中" };
  if (status === "error")
    return { className: "bg-destructive size-2 rounded-full", label: "回应失败" };
  return { className: "bg-muted-foreground/30 size-2 rounded-full", label: "等待中" };
}

export function SeatsPanel({
  cast,
  activePlayer,
  agentStatuses,
  relations,
  ultimatum,
  speakingId,
  opposingId,
  skin,
}: SeatsPanelProps) {
  const playerPortrait = portraitFor(activePlayer, skin);
  const someoneOnStage = Boolean(speakingId || opposingId);
  const playerState = seatStateOf(activePlayer.id, speakingId, opposingId);
  const playerSpeaking = playerState === "speaking";

  return (
    <Card className="order-2 shadow-none lg:order-1">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <UserRound className="size-4" />
          议事席位
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <HoverCard>
          <HoverCardTrigger
            render={
              <Item
                variant="muted"
                className={`hover:bg-muted transition-opacity ${seatTone(playerState, someoneOnStage)}`}
              />
            }
          >
            <ItemMedia>
              <div
                className={
                  playerSpeaking ? "animate-portrait-talk motion-reduce:animate-none" : undefined
                }
              >
                <PixelSprite
                  frames={playerPortrait.frames}
                  palette={playerPortrait.palette}
                  scale={2}
                  label={playerPortrait.label}
                />
              </div>
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle>{activePlayer.name}</ItemTitle>
              {playerSpeaking ? (
                <p className="text-primary text-xs">正在台上</p>
              ) : (
                <p className="text-muted-foreground truncate text-xs">{activePlayer.identity}</p>
              )}
            </ItemContent>
            <ItemActions>
              <Badge variant="outline" className="px-1.5">
                由你扮演
              </Badge>
            </ItemActions>
          </HoverCardTrigger>
          <HoverCardContent side="right" align="start" className="w-72">
            <div className="space-y-2">
              <div>
                <p className="font-medium">{activePlayer.name}</p>
                <p className="text-muted-foreground text-xs">
                  {activePlayer.identity} · {activePlayer.faction}
                </p>
              </div>
              <p className="text-xs leading-5">{activePlayer.personality}</p>
              <div>
                <p className="text-muted-foreground text-xs">公开目标</p>
                <p className="text-xs leading-5">{activePlayer.publicGoal}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">可调动资源</p>
                <p className="text-xs leading-5">{activePlayer.decisionPower}</p>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>

        <div className="border-primary/30 bg-primary/5 rounded-md border p-3">
          <p className="text-primary flex items-center gap-1.5 text-xs font-medium">
            <ShieldQuestion className="size-3.5" />
            只有你知道的私密目标
          </p>
          <p className="mt-1.5 text-xs leading-5">{activePlayer.privateGoal}</p>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            底线:{activePlayer.redLine}
          </p>
        </div>

        <Separator />

        <ItemGroup className="gap-3">
          {cast.agentCharacters.map((character) => {
            const relation = relationOf(relations, character.id);
            const trust = relation?.trust ?? 52;
            const attitude = relation?.attitude ?? "wary";
            const dot = statusDot(agentStatuses[character.id]);
            const portrait = portraitFor(character, skin);
            const hasUltimatum = ultimatum?.agentId === character.id;
            const state = seatStateOf(character.id, speakingId, opposingId);
            const speaking = state === "speaking";

            return (
              <HoverCard key={character.id}>
                <HoverCardTrigger
                  render={
                    <Item
                      size="xs"
                      className={`flex-col transition-opacity ${seatTone(state, someoneOnStage)}`}
                    />
                  }
                >
                  <div className="flex w-full items-center gap-2">
                    <ItemMedia>
                      <div
                        className={
                          speaking ? "animate-portrait-talk motion-reduce:animate-none" : undefined
                        }
                      >
                        <PixelSprite
                          frames={portrait.frames}
                          palette={portrait.palette}
                          scale={2}
                          label={portrait.label}
                        />
                      </div>
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle>{character.name}</ItemTitle>
                      {speaking ? (
                        <p className="text-primary text-xs">正在台上</p>
                      ) : state === "opposing" ? (
                        <p className="text-destructive text-xs">正被回击</p>
                      ) : (
                        <p className="text-muted-foreground truncate text-xs">
                          {character.faction}
                        </p>
                      )}
                    </ItemContent>
                    <ItemActions className="flex-col items-end gap-1">
                      <span className={dot.className} aria-label={dot.label} />
                      <Badge variant="outline" className={`px-1.5 ${attitudeTone[attitude]}`}>
                        {attitudeLabels[attitude]}
                      </Badge>
                    </ItemActions>
                  </div>
                  <div className="w-full">
                    <Progress value={trust}>
                      <ProgressLabel className="text-muted-foreground text-xs font-normal">
                        对你的信任
                      </ProgressLabel>
                      <ProgressValue className="text-xs">{() => trust}</ProgressValue>
                    </Progress>
                  </div>
                  {hasUltimatum ? (
                    <p className="text-destructive flex items-center gap-1 text-xs">
                      <Swords className="size-3" />
                      已向你下最后通牒
                    </p>
                  ) : null}
                </HoverCardTrigger>
                <HoverCardContent side="right" align="start" className="w-72">
                  <div className="space-y-2">
                    <div>
                      <p className="font-medium">{character.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {character.identity} · {character.faction}
                      </p>
                    </div>
                    <p className="text-xs leading-5">{character.personality}</p>
                    <div>
                      <p className="text-muted-foreground text-xs">公开诉求</p>
                      <p className="text-xs leading-5">{character.publicGoal}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">施压手段</p>
                      <p className="text-xs leading-5">{character.pressureMethod}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">
                        当前态度 · {attitudeLabels[attitude]}(信任 {trust})
                      </p>
                      <p className="text-xs leading-5">{attitudeHints[attitude]}</p>
                    </div>
                    <blockquote className="text-muted-foreground border-l pl-2 text-xs leading-5">
                      "{character.openingLine}"
                    </blockquote>
                  </div>
                </HoverCardContent>
              </HoverCard>
            );
          })}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

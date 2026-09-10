"use client";

import { UserRound } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Separator } from "@/components/ui/separator";
import { type WorldCast } from "@/lib/world-cast";

export type AgentStatus = "thinking" | "done" | "error";

interface SeatsPanelProps {
  cast: WorldCast;
  activePlayer: WorldCast["playerCharacters"][number];
  agentStatuses: Record<string, AgentStatus>;
}

export function SeatsPanel({ cast, activePlayer, agentStatuses }: SeatsPanelProps) {
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
          <HoverCardTrigger render={<Item variant="muted" className="hover:bg-muted" />}>
            <ItemMedia>
              <Avatar>
                <AvatarFallback>{activePlayer.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle>{activePlayer.name}</ItemTitle>
              <p className="text-muted-foreground truncate text-xs">{activePlayer.identity}</p>
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
              <div>
                <p className="text-muted-foreground text-xs">你的秘密</p>
                <p className="text-xs leading-5">{activePlayer.secret}</p>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>

        <Separator />

        <ItemGroup className="gap-1">
          {cast.agentCharacters.map((character) => (
            <HoverCard key={character.id}>
              <HoverCardTrigger render={<Item size="xs" className="hover:bg-muted" />}>
                <ItemMedia>
                  <Avatar size="sm">
                    <AvatarFallback>{character.name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle>{character.name}</ItemTitle>
                  <p className="text-muted-foreground truncate text-xs">{character.faction}</p>
                </ItemContent>
                <ItemActions>
                  <span
                    className={
                      agentStatuses[character.id] === "done"
                        ? "size-2 rounded-full bg-emerald-500"
                        : agentStatuses[character.id] === "thinking"
                          ? "size-2 animate-pulse rounded-full bg-amber-500"
                          : agentStatuses[character.id] === "error"
                            ? "bg-destructive size-2 rounded-full"
                            : "bg-muted-foreground/30 size-2 rounded-full"
                    }
                    aria-label={
                      agentStatuses[character.id] === "done"
                        ? "已回应"
                        : agentStatuses[character.id] === "thinking"
                          ? "思考中"
                          : agentStatuses[character.id] === "error"
                            ? "回应失败"
                            : "等待中"
                    }
                  />
                </ItemActions>
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
                  <blockquote className="text-muted-foreground border-l pl-2 text-xs leading-5">
                    "{character.openingLine}"
                  </blockquote>
                </div>
              </HoverCardContent>
            </HoverCard>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

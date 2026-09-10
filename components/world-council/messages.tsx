"use client";

import { GitBranch } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import { WorldEventPanel } from "@/components/world-event";
import { type WorldCast } from "@/lib/world-cast";
import {
  metricKeys,
  metricLabels,
  type MetricDeltas,
  type WorldGameSession,
} from "@/lib/world-ending";
import { type AgentReaction } from "@/lib/world-turn";

const stanceLabels: Record<AgentReaction["stance"], string> = {
  support: "支持",
  oppose: "反对",
  negotiate: "交涉",
  exploit: "借势",
};

export function useTypewriter(
  text: string,
  durationMs = 6000,
): { typed: string; isTyping: boolean } {
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    if (!text.length) return;
    const frame = Math.max(1, Math.ceil(text.length / (durationMs / 50)));
    const id = setInterval(() => {
      setCount((current) => {
        if (current >= text.length) {
          clearInterval(id);
          return current;
        }
        const next = current + frame;
        if (next >= text.length) {
          clearInterval(id);
          return text.length;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(id);
  }, [durationMs, text]);

  return { typed: text.slice(0, count), isTyping: count < text.length };
}

export function SpeakingAvatar({
  isTyping,
  characterName,
  className,
}: {
  isTyping: boolean;
  characterName: string;
  className?: string;
}) {
  return (
    <MessageAvatar className={`${className ?? "size-8"} ${isTyping ? "animate-pulse" : ""}`}>
      {characterName.slice(0, 1)}
    </MessageAvatar>
  );
}

export function PlayerDecisionMessage({
  playerName,
  decision,
  roundLabel,
}: {
  playerName: string;
  decision: string;
  roundLabel?: string;
}) {
  return (
    <Message align="end">
      <MessageAvatar className="bg-primary text-primary-foreground size-8">
        {playerName.slice(0, 1)}
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>
          {playerName} · 你的抉择{roundLabel ? ` · ${roundLabel}` : null}
        </MessageHeader>
        <div className="bg-primary text-primary-foreground max-w-2xl rounded-lg px-4 py-3 leading-7">
          {decision}
        </div>
      </MessageContent>
    </Message>
  );
}

export function ReactionMessage({
  characterName,
  reaction,
}: {
  characterName: string;
  reaction: AgentReaction;
}) {
  const { typed, isTyping } = useTypewriter(reaction.speech);
  return (
    <Message>
      <SpeakingAvatar isTyping={isTyping} characterName={characterName} />
      <MessageContent>
        <MessageHeader className="gap-2">
          <span>{characterName}</span>
          <Badge variant="outline">{stanceLabels[reaction.stance]}</Badge>
        </MessageHeader>
        <div className="border-border bg-background max-w-2xl rounded-lg border px-4 py-3 leading-7">
          {typed}
        </div>
        <div className="mt-2 grid max-w-2xl gap-2 text-xs leading-5 sm:grid-cols-2">
          <div className="bg-muted/60 rounded-md p-3">
            <p className="text-muted-foreground">立即行动</p>
            <p className="text-foreground mt-1">{reaction.action}</p>
          </div>
          <div className="bg-muted/60 rounded-md p-3">
            <p className="text-muted-foreground">行动目标</p>
            <p className="text-foreground mt-1">{reaction.target}</p>
          </div>
        </div>
        <MessageFooter className="max-w-2xl items-start leading-5">
          公开影响：{reaction.impact}
        </MessageFooter>
      </MessageContent>
    </Message>
  );
}

export function OpeningLineMessage({
  character,
  footer,
}: {
  character: WorldCast["agentCharacters"][number];
  footer: string;
}) {
  const { typed, isTyping } = useTypewriter(character.openingLine);
  return (
    <Message>
      <SpeakingAvatar isTyping={isTyping} characterName={character.name} />
      <MessageContent>
        <MessageHeader className="gap-2">
          <span>{character.name}</span>
          <span className="font-normal">{character.identity}</span>
        </MessageHeader>
        <div className="border-border bg-background max-w-2xl rounded-lg border px-4 py-3 leading-7">
          {typed}
        </div>
        <MessageFooter>{footer}</MessageFooter>
      </MessageContent>
    </Message>
  );
}

export function DirectorNarrationMessage({
  title,
  narration,
  deltas,
  events,
  metricReasons,
  nextSituation,
}: {
  title: string;
  narration: string;
  deltas: MetricDeltas | null;
  events: WorldGameSession["turns"][number]["events"];
  metricReasons: WorldGameSession["turns"][number]["metricReasons"] | null;
  nextSituation: string | null;
}) {
  return (
    <Message>
      <MessageAvatar className="bg-primary text-primary-foreground size-8">
        <GitBranch className="size-4" />
      </MessageAvatar>
      <MessageContent>
        <MessageHeader>{title}</MessageHeader>
        <div className="bg-muted max-w-2xl rounded-lg px-4 py-3 leading-7">{narration}</div>
        {events.length ? (
          <div className="mt-3 max-w-2xl space-y-3">
            {events.map((event) => (
              <WorldEventPanel key={event.id} event={event} />
            ))}
          </div>
        ) : null}
        {deltas ? (
          <MessageFooter className="max-w-2xl items-start leading-5">
            {metricKeys
              .map((key) => {
                const delta = deltas[key];
                if (delta === 0) return null;
                return `${metricLabels[key]}${delta > 0 ? `+${delta}` : delta}`;
              })
              .filter(Boolean)
              .join(" · ") || "四维指标持平"}
          </MessageFooter>
        ) : null}
        {metricReasons ? (
          <div className="text-muted-foreground mt-2 grid max-w-2xl gap-1 text-xs leading-5 sm:grid-cols-2">
            {metricKeys.map((key) => (
              <p key={key}>
                <span className="text-foreground">{metricLabels[key]}：</span>
                {metricReasons[key]}
              </p>
            ))}
          </div>
        ) : null}
        {nextSituation ? (
          <MessageFooter className="max-w-2xl items-start leading-5">
            下一回合逼近：{nextSituation}
          </MessageFooter>
        ) : null}
      </MessageContent>
    </Message>
  );
}

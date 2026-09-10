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

const stanceStyles: Record<AgentReaction["stance"], { bubble: string; badge: string }> = {
  support: {
    bubble: "border-l-emerald-500 bg-emerald-50/70",
    badge: "border-emerald-500/60 bg-emerald-100 text-emerald-700",
  },
  oppose: {
    bubble: "border-l-red-500 bg-red-50/70",
    badge: "border-red-500/60 bg-red-100 text-red-700",
  },
  negotiate: {
    bubble: "border-l-sky-500 bg-sky-50/70",
    badge: "border-sky-500/60 bg-sky-100 text-sky-700",
  },
  exploit: {
    bubble: "border-l-amber-500 bg-amber-50/70",
    badge: "border-amber-500/60 bg-amber-100 text-amber-700",
  },
};

const TYPE_INTERVAL_MS = 55;
const TYPE_PAUSE_MS = 165;
const TYPING_CARET = "▍";

export function useTypewriter(
  text: string,
  animate = true,
): { typed: string; isTyping: boolean; done: boolean } {
  const [count, setCount] = useState(animate ? 0 : text.length);

  useEffect(() => {
    if (!animate) {
      setCount(text.length);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let index = 0;
    let timer = window.setTimeout(function tick() {
      index += 1;
      setCount(index);
      if (index >= text.length) return;
      const pausedAtPunctuation = "。！？…；：,!、?\n".includes(text[index - 1]);
      timer = window.setTimeout(tick, pausedAtPunctuation ? TYPE_PAUSE_MS : TYPE_INTERVAL_MS);
    }, TYPE_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [animate, text]);

  return { typed: text.slice(0, count), isTyping: count < text.length, done: count >= text.length };
}

function TypingCaret({ visible }: { visible: boolean }) {
  return visible ? <span className="animate-pulse">{TYPING_CARET}</span> : null;
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
  animate = true,
}: {
  characterName: string;
  reaction: AgentReaction;
  animate?: boolean;
}) {
  const { typed, isTyping } = useTypewriter(reaction.speech, animate);
  const stanceStyle = stanceStyles[reaction.stance];
  return (
    <Message>
      <SpeakingAvatar isTyping={isTyping} characterName={characterName} />
      <MessageContent>
        <MessageHeader className="gap-2">
          <span>{characterName}</span>
          <Badge variant="outline" className={stanceStyle.badge}>
            {stanceLabels[reaction.stance]}
          </Badge>
        </MessageHeader>
        <div
          className={`border-border max-w-2xl rounded-lg border border-l-4 px-4 py-3 leading-7 ${stanceStyle.bubble} ${isTyping ? "ring-primary/40 ring-1" : ""}`}
        >
          {typed}
          <TypingCaret visible={isTyping} />
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
  animate = true,
}: {
  character: WorldCast["agentCharacters"][number];
  footer: string;
  animate?: boolean;
}) {
  const { typed, isTyping } = useTypewriter(character.openingLine, animate);
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
          <TypingCaret visible={isTyping} />
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

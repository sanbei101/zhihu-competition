"use client";

import { ArrowRight, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { WorldCard } from "@/lib/world-cards";
import {
  eventChoiceToneLabels,
  plausibilityLabels,
  type EventChoice,
  type GlobalMetric,
} from "@/lib/world-sim";

/**
 * 事件卡。
 *
 * 整款游戏的信息载体就是这一张牌:一件事、一句见证者的话、两三个代价明确的选择。
 * 它刻意不显示任何"世界状态" —— 那些在舞台和底部指标条里,牌面上只留决策需要的东西。
 *
 * 卡面状态只有两个:提问态(列出选项)与结果态(显示已做的取舍)。
 * 结果态不写"后来发生了什么",因为真正的后果在下一阶段的裁决里 ——
 * 这一点必须在卡面上讲清楚,否则玩家会以为自己按了什么就立刻发生了什么。
 */

/** 严重度色带。用皮肤语义变量,换皮肤时自动跟着走 */
const RIBBON: Record<WorldCard["severity"], string> = {
  info: "bg-border",
  notable: "bg-chart-3",
  severe: "bg-chart-4",
  critical: "bg-destructive",
};

/**
 * 特殊事件的色带与一句解释。
 *
 * 特殊事件是这套玩法里最值得被认出来的东西,所以它不能只靠一个词区分:
 * 色带要不一样,而且要用一句话告诉玩家"这件事为什么特殊" ——
 * 尤其是 echo,玩家必须知道那件事跟他自己有关,否则这次回收就白做了。
 */
const SPECIAL_STYLE: Record<NonNullable<WorldCard["special"]>, { ribbon: string; hint: string }> = {
  crisis: { ribbon: "bg-destructive", hint: "这条世界线的硬约束被逼到了边缘,没有便宜的解法。" },
  echo: { ribbon: "bg-chart-4", hint: "这是你此前的某次取舍,在远处结出来的果。" },
  anomaly: { ribbon: "bg-chart-2", hint: "规则之外的东西闯了进来,它不在任何人的预期里。" },
};

function EffectChips({
  effects,
  metrics,
}: {
  effects: EventChoice["effects"];
  metrics: GlobalMetric[];
}) {
  if (!effects.length) return null;

  return (
    <span className="flex shrink-0 flex-wrap gap-1">
      {effects.map((effect) => {
        const metric = metrics.find((item) => item.id === effect.metricId);
        const up = effect.delta > 0;
        return (
          <Badge key={effect.metricId} variant="outline" className="gap-1 font-mono text-[10px]">
            {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {metric?.label ?? effect.metricId}
            {up ? "+" : ""}
            {effect.delta}
          </Badge>
        );
      })}
    </span>
  );
}

export function EventCard({
  card,
  metrics,
  resolvedChoiceId,
  onChoose,
  onAction,
  actionLabel,
  onNext,
  nextLabel,
  busy,
}: {
  card: WorldCard;
  metrics: GlobalMetric[];
  /** 已选中的选项 id。非空时卡面进入结果态 */
  resolvedChoiceId: string | null;
  onChoose: (choice: EventChoice) => void;
  /** 原点卡 / 结算卡的单一动作 */
  onAction?: (() => void) | undefined;
  actionLabel?: string | undefined;
  /** 结果态的出口:翻到下一张,或回到空桌。不传则结果态没有出口 */
  onNext?: (() => void) | undefined;
  nextLabel?: string | undefined;
  busy?: boolean | undefined;
}) {
  const resolved = resolvedChoiceId
    ? (card.choices.find((choice) => choice.id === resolvedChoiceId) ??
      card.fork?.alternatives.find((alternative) => alternative.id === resolvedChoiceId) ??
      null)
    : null;

  const isFork = card.kind === "fork" && card.fork !== null;
  const isSingleAction = card.kind === "origin" || card.kind === "settle";
  const special = card.special ? SPECIAL_STYLE[card.special] : null;

  return (
    <Card
      className="animate-in fade-in slide-in-from-bottom-4 zoom-in-[0.97] shadow-none duration-300"
      data-card={card.kind}
    >
      <div className={`h-1 w-full ${special ? special.ribbon : RIBBON[card.severity]}`} />

      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{card.tag}</Badge>
          {card.severity === "critical" ? <Badge variant="destructive">危急</Badge> : null}
          {card.actors.length ? (
            <span className="text-muted-foreground ml-auto flex flex-wrap gap-2 text-xs">
              {card.actors.map((actor) => (
                <span key={actor} className="border-l-2 pl-2">
                  {actor}
                </span>
              ))}
            </span>
          ) : null}
        </div>

        <CardTitle className="text-xl leading-8">{card.title}</CardTitle>
        {special ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
            <Sparkles className="size-3" />
            {special.hint}
          </p>
        ) : null}
        <CardDescription className="text-sm leading-7 whitespace-pre-line">
          {card.body}
        </CardDescription>
      </CardHeader>

      {/* ---------- 已经做出取舍 ---------- */}
      {resolved ? (
        <CardContent className="space-y-4">
          <Separator />
          <div className="space-y-2">
            <p className="text-muted-foreground font-mono text-[11px] tracking-wider">
              {isFork ? "世界线已选定" : "你替世界选了这个"}
            </p>
            <p className="text-sm font-medium">
              {isFork
                ? (card.fork?.alternatives.find((item) => item.id === resolvedChoiceId)?.title ??
                  "")
                : (resolved as EventChoice).label}
            </p>
            {!isFork && (resolved as EventChoice).effects.length ? (
              <EffectChips effects={(resolved as EventChoice).effects} metrics={metrics} />
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs leading-6">
            这不是改写。它已经记进这条世界线,
            <span className="text-foreground">会在下一阶段的裁决里作为条件出现</span> ——
            至于它到底会结出什么,要看那时其他主体同时在做什么。
          </p>

          {/* 结果态必须有出口,否则玩家做完取舍就被钉死在结果页上 */}
          {onNext ? (
            <Button className="w-full" disabled={busy} onClick={onNext}>
              {nextLabel ?? "下一张"}
              <ArrowRight data-icon="inline-end" />
            </Button>
          ) : null}
        </CardContent>
      ) : null}

      {/* ---------- 分叉:两条候选未来 ---------- */}
      {isFork && !resolved ? (
        <CardContent className="space-y-3">
          {card.fork?.alternatives.map((alternative) => (
            <Button
              key={alternative.id}
              variant="outline"
              disabled={busy}
              onClick={() =>
                onChoose({
                  id: alternative.id,
                  label: alternative.title,
                  hint: alternative.premise,
                  tone: "bold",
                  effects: [],
                })
              }
              className="h-auto w-full flex-col items-start gap-2 px-4 py-3 text-left whitespace-normal"
            >
              <span className="flex w-full flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{alternative.title}</span>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {plausibilityLabels[alternative.plausibility]}
                </Badge>
              </span>
              <span className="text-muted-foreground text-xs leading-6">{alternative.premise}</span>
              <span className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                {alternative.expectedEffects.map((effect) => (
                  <span key={effect}>→ {effect}</span>
                ))}
              </span>
            </Button>
          ))}
        </CardContent>
      ) : null}

      {/* ---------- 事件卡:可干预点 ---------- */}
      {!isFork && !resolved && !isSingleAction ? (
        <CardContent className="space-y-2">
          {card.choices.map((choice, index) => (
            <Button
              key={choice.id}
              variant="outline"
              disabled={busy}
              onClick={() => onChoose(choice)}
              className="h-auto w-full items-start gap-3 px-4 py-3 text-left whitespace-normal"
            >
              <span className="bg-muted text-muted-foreground grid size-6 shrink-0 place-items-center rounded-sm font-mono text-xs">
                {String.fromCharCode(65 + index)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{choice.label}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {eventChoiceToneLabels[choice.tone]}
                  </Badge>
                </span>
                <span className="text-muted-foreground mt-1 block text-xs leading-6">
                  {choice.hint}
                </span>
              </span>
              <EffectChips effects={choice.effects} metrics={metrics} />
            </Button>
          ))}
        </CardContent>
      ) : null}

      {/* ---------- 原点卡 / 结算卡:单一动作 ---------- */}
      {isSingleAction && !resolved ? (
        <CardContent className="space-y-3">
          {onAction ? (
            <Button className="w-full" disabled={busy} onClick={onAction}>
              <Sparkles data-icon="inline-start" />
              {actionLabel ?? "继续"}
            </Button>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

"use client";

import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { TierBadge, TIER_RIBBON } from "@/components/world-simulator/card-tier";
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

/**
 * 特殊事件的一句话解释。
 *
 * 色带由稀有度决定,这里只负责告诉玩家"这件事为什么特殊" ——
 * 尤其是 echo,玩家必须知道那件事跟他自己有关,否则这次回收就白做了。
 */
const SPECIAL_HINT: Record<NonNullable<WorldCard["special"]>, string> = {
  crisis: "这条世界线的硬约束被逼到了边缘,没有便宜的解法。",
  echo: "这是你此前的某次取舍,在远处结出来的果。",
  anomaly: "规则之外的东西闯了进来,它不在任何人的预期里。",
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
  action,
  busy,
}: {
  card: WorldCard;
  metrics: GlobalMetric[];
  /** 已选中的选项 id。非空时卡面进入结果态 */
  resolvedChoiceId: string | null;
  onChoose: (choice: EventChoice) => void;
  /**
   * 卡面底部唯一的那个主按钮。
   *
   * 一个状态只允许有一个出口,而且这个出口由调用方决定:
   *   原点卡/结算卡  "拉开这条世界线" / "重新洗一次牌"
   *   翻开但没有选项  "收下这张牌"(白卡不需要取舍,但要有个办法合上它)
   *   做完取舍的结果态 undefined —— 出口是下面的"推进时间",不是这里
   */
  action?: { label: string; onClick: () => void } | undefined;
  busy?: boolean | undefined;
}) {
  const resolved = resolvedChoiceId
    ? (card.choices.find((choice) => choice.id === resolvedChoiceId) ??
      card.fork?.alternatives.find((alternative) => alternative.id === resolvedChoiceId) ??
      null)
    : null;

  const isFork = card.kind === "fork" && card.fork !== null;
  const isSingleAction = card.kind === "origin" || card.kind === "settle";
  const special = card.special ? SPECIAL_HINT[card.special] : null;

  return (
    <Card
      className="animate-in fade-in slide-in-from-bottom-4 zoom-in-[0.97] shadow-none duration-300"
      data-card={card.kind}
    >
      <div className={`h-1 w-full ${TIER_RIBBON[card.tier]}`} />

      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <TierBadge tier={card.tier} />
          <Badge variant="secondary">{card.tag}</Badge>
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
        {card.special ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
            <Sparkles className="size-3" />
            {special}
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
        </CardContent>
      ) : null}

      {/* ---------- 分叉:只读展示两条候选未来 ---------- */}
      {isFork && !resolved ? (
        <CardContent className="space-y-3">
          {action ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs leading-6">
                这条世界线在这里岔开了 —— 两条路都有人会走,历史会自己选。
              </p>
              {card.fork?.alternatives.map((alternative) => (
                <div key={alternative.id} className="bg-muted/40 rounded-sm border px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{alternative.title}</p>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {plausibilityLabels[alternative.plausibility]}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs leading-6">
                    {alternative.premise}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            card.fork?.alternatives.map((alternative) => (
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
                <span className="text-muted-foreground text-xs leading-6">
                  {alternative.premise}
                </span>
                <span className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  {alternative.expectedEffects.map((effect) => (
                    <span key={effect}>→ {effect}</span>
                  ))}
                </span>
              </Button>
            ))
          )}
        </CardContent>
      ) : null}

      {/* ---------- 事件卡:有 action 时只读展示,不给选项按钮 ---------- */}
      {!isFork && !resolved && !isSingleAction && !action ? (
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

      {/* ---------- 主按钮:唯一的出口。牌在 open 阶段都有它,不再要求做取舍 ---------- */}
      {action && !resolved ? (
        <CardContent className="space-y-3">
          <Button className="w-full" disabled={busy} onClick={action.onClick}>
            <Sparkles data-icon="inline-start" />
            {action.label}
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}

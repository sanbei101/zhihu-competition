"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CardHand } from "@/components/world-simulator/card-hand";
import { EventCard } from "@/components/world-simulator/event-card";
import { WitnessDialogue } from "@/components/world-simulator/witness-dialogue";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import type { CardDelta, WorldCard } from "@/lib/world-cards";
import type { EventChoice, GlobalMetric, WitnessArchetype, WitnessLine } from "@/lib/world-sim";

/**
 * 牌桌。
 *
 * 一屏之内只有三样东西:左边那个说话的见证者、中间这一批背面朝上的牌、
 * 以及翻开之后的那张正脸。
 *
 * 阶段状态机:
 *   origin  原点卡正面朝上,它是前提不是赌注
 *   pick    一批背面朝上,玩家挑一张
 *   open    翻开了,正面朝上,带选项就做取舍,不带就"收下"
 *   closed  阶段收束:结果 + 擦肩而过 + 结算
 *   empty   从存档恢复时的空桌,只给上一阶段的结算
 */
export type DeckStage = "origin" | "pick" | "open" | "closed" | "empty";

export interface DeckSummary {
  era: number;
  conclusion: string;
  deltas: CardDelta[];
}

/** 阶段结算。空桌与收束状态共用,不再单独发一张"小结卡" */
function SummaryPanel({ summary }: { summary: DeckSummary }) {
  return (
    <Card className="animate-in fade-in w-full shadow-none duration-500">
      <CardContent className="space-y-4 px-6 py-6 text-center">
        <div className="space-y-1">
          <p className="text-muted-foreground font-mono text-[10px] tracking-widest">
            纪元 {summary.era} · 本阶段结算
          </p>
          <p className="text-muted-foreground text-sm leading-7">{summary.conclusion}</p>
        </div>

        {summary.deltas.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {summary.deltas.map((delta) => (
              <div key={delta.metricId} className="bg-muted/40 rounded-sm border px-3 py-2">
                <p className="text-muted-foreground text-[11px]">{delta.label}</p>
                <p
                  className={`mt-1 font-mono text-base ${
                    delta.delta > 0 ? "text-chart-2" : "text-destructive"
                  }`}
                >
                  {delta.delta > 0 ? "+" : ""}
                  {delta.delta}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function WorldDeck({
  skin,
  archetype,
  witnessLine,
  hand,
  stage,
  pickedIds,
  activeCardId,
  flippingId,
  resolvedChoiceId,
  metrics,
  onPick,
  onChoose,
  cardAction,
  busy,
  played,
  summary,
}: {
  skin: ScenarioSkin;
  archetype: WitnessArchetype;
  witnessLine: WitnessLine | null;
  hand: WorldCard[];
  stage: DeckStage;
  /** 本阶段已翻开的全部牌(可能是 1 张或 2 张) */
  pickedIds: string[];
  /** 当前正面朝上、正在做取舍的那张牌 */
  activeCardId: string | null;
  flippingId: string | null;
  resolvedChoiceId: string | null;
  metrics: GlobalMetric[];
  onPick: (card: WorldCard) => void;
  onChoose: (choice: EventChoice) => void;
  /** 卡面底部那个唯一的主按钮(拉开世界线 / 收下这张牌 / 重新洗牌) */
  cardAction: { label: string; onClick: () => void } | undefined;
  busy: boolean;
  played: { label: string; tier: WorldCard["tier"] }[];
  summary: DeckSummary | null;
}) {
  const picked = hand.find((card) => card.id === activeCardId) ?? null;
  /**
   * 此刻正面朝上的那张牌。
   *
   * 注意判据里必须带上 activeCardId —— 光有 stage 不够:origin 阶段如果它空了,
   * 牌桌上就什么都不出现(曾经就是这个原因让原点卡整个消失)。
   */
  const opened =
    picked && (stage === "origin" || stage === "open" || stage === "closed") ? picked : null;

  const witness = <WitnessDialogue skin={skin} archetype={archetype} line={witnessLine} />;

  const faceUp = opened ? (
    <div className="w-full max-w-xl">
      <EventCard
        card={opened}
        metrics={metrics}
        resolvedChoiceId={resolvedChoiceId}
        onChoose={onChoose}
        action={cardAction}
        busy={busy}
      />
    </div>
  ) : null;

  return (
    <section className="relative space-y-6">
      {/* 盲抽:见证者站在手牌左边督战 —— 这正是最需要他在旁边说话的时候 */}
      {stage === "pick" ? (
        <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-start lg:justify-center lg:gap-8">
          {witness}
          <div className="w-full min-w-0 lg:max-w-2xl">
            <CardHand
              cards={hand}
              pickedIds={pickedIds}
              flipping={flippingId}
              closed={false}
              onPick={onPick}
            />
          </div>
        </div>
      ) : null}

      {/* 翻开之后:手牌定格成一行(其余变"擦肩而过"),见证者与这张牌并排 */}
      {stage === "open" || stage === "closed" ? (
        <div className="space-y-6">
          <CardHand
            cards={hand}
            pickedIds={pickedIds}
            flipping={flippingId}
            closed={stage === "closed"}
            onPick={onPick}
          />
          <div className="flex flex-col items-stretch gap-5 lg:flex-row lg:items-start lg:justify-center">
            {witness}
            {faceUp}
          </div>
        </div>
      ) : null}

      {/* 原点卡 / 空桌:见证者与那张唯一的正面牌 */}
      {stage === "origin" || stage === "empty" ? (
        <div className="flex flex-col items-stretch gap-5 lg:flex-row lg:items-start lg:justify-center">
          {witness}
          {faceUp}
        </div>
      ) : null}

      {/* 收束 / 空桌的结算 */}
      {stage === "closed" || stage === "empty" ? (
        summary ? (
          <SummaryPanel summary={summary} />
        ) : null
      ) : null}

      {/* 已经做过的取舍 */}
      {played.length ? (
        <div className="flex flex-wrap justify-center gap-2">
          {played.slice(-8).map((item, index) => (
            <Badge key={`${item.label}-${index}`} variant="outline" className="font-normal">
              {item.label}
            </Badge>
          ))}
        </div>
      ) : null}

      {stage === "empty" && !summary ? (
        <>
          <Separator />
          <p className="text-muted-foreground text-center text-xs leading-6">
            世界停在这里。推进时间,看它发出什么牌。
          </p>
        </>
      ) : null}
    </section>
  );
}

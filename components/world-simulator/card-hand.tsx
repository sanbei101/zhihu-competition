"use client";

import { TIER_RIBBON, TIER_TEXT } from "@/components/world-simulator/card-tier";
import { cn } from "@/lib/utils";
import { cardTierGrades, cardTierLabels, tierHistogram } from "@/lib/world-cards";
import type { WorldCard } from "@/lib/world-cards";

/**
 * 盲抽手牌:一排背面朝上的牌。
 *
 * 玩家看到的只有背面与本批的稀有度预告 —— 知道里面有一张红卡,但不知道在哪。
 * 这份"知道有、不知道在哪"就是整个抽卡环节的全部张力。
 *
 * 挑中一张后,它原地翻过去,其余的沉下去变成"擦肩而过"的一行字。
 */
export function CardHand({
  cards,
  pickedId,
  flipping,
  closed,
  onPick,
}: {
  cards: WorldCard[];
  /** 已翻开的那张。非空时其余的牌变暗、不可点 */
  pickedId: string | null;
  /** 正在播翻牌动画的那张(此刻还看不到正面) */
  flipping: string | null;
  /** 本阶段已经收束,手牌定格成"擦肩而过" */
  closed: boolean;
  onPick: (card: WorldCard) => void;
}) {
  const histogram = tierHistogram(cards);

  return (
    <div className="w-full">
      {/* 稀有度预告 */}
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        <span className="text-muted-foreground font-mono text-[10px] tracking-widest">
          本批 {cards.length} 张
        </span>
        {histogram.map(({ tier, count }) => (
          <span key={tier} className={cn("font-mono text-[10px]", TIER_TEXT[tier])}>
            {cardTierLabels[tier]}×{count}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-stretch justify-center gap-2 sm:gap-3">
        {cards.map((card, index) => {
          const isPicked = pickedId === card.id;
          const isFlipping = flipping === card.id;
          const dimmed = (pickedId !== null && !isPicked) || closed;

          return (
            <button
              key={card.id}
              type="button"
              disabled={pickedId !== null || closed}
              onClick={() => onPick(card)}
              aria-label={`第 ${index + 1} 张,背面朝上`}
              style={{ animationDelay: `${index * 70}ms` }}
              className={cn(
                "animate-card-deal group relative h-28 w-20 overflow-hidden rounded-md border transition-all duration-300 sm:h-36 sm:w-24",
                // 注意:只能用 shadcn 语义令牌。像 bg-surface / bg-accent-soft 这种
                // 皮肤字段**不是** Tailwind 色令牌 —— Tailwind v4 遇到未定义的 --color-*
                // 既不报错也不产出 CSS,卡背会整块塌成透明。
                "bg-card border-border",
                !dimmed && "hover:-translate-y-1.5 hover:border-primary cursor-pointer",
                dimmed && "opacity-25 saturate-0",
                isFlipping && "animate-card-flip",
              )}
            >
              {/* 卡背花纹 */}
              <span className="absolute inset-1.5 rounded-sm opacity-70 [background:repeating-linear-gradient(45deg,var(--accent)_0_3px,transparent_3px_7px)]" />
              {/* 中央问号 */}
              <span className="absolute inset-0 grid place-items-center">
                <span className="text-primary font-mono text-2xl opacity-45 sm:text-3xl">?</span>
              </span>
              {/* 序号 */}
              <span className="text-muted-foreground absolute bottom-1 left-1/2 -translate-x-1/2 font-mono text-[9px] opacity-60">
                {String.fromCharCode(65 + index)}
              </span>
              {!dimmed && !isFlipping ? (
                <span className="text-primary-foreground bg-primary absolute inset-x-0 bottom-0 py-0.5 text-center text-[9px] opacity-0 transition-opacity group-hover:opacity-100">
                  翻开
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* 擦肩而过:没被翻开的那些,在阶段收束后亮出标题 */}
      {closed && pickedId
        ? (() => {
            const missed = cards.filter((card) => card.id !== pickedId);
            if (!missed.length) return null;
            return (
              <div className="mt-5">
                <p className="text-muted-foreground font-mono text-[10px] tracking-widest">
                  擦肩而过 · 你没能盯住它们,但它们照样发生了
                </p>
                <ul className="mt-2 space-y-1">
                  {missed.map((card) => (
                    <li
                      key={card.id}
                      className="text-muted-foreground flex items-baseline gap-2 text-xs leading-6"
                    >
                      <span
                        className={cn(
                          "inline-block size-1.5 shrink-0 translate-y-[-2px] rounded-full",
                          TIER_RIBBON[card.tier],
                        )}
                        title={`${cardTierGrades[card.tier]} · ${cardTierLabels[card.tier]}`}
                      />
                      <span className="truncate">
                        {card.title}
                        {card.choices.length >= 2 ? (
                          <span className="text-foreground/70"> · 你错过了一次取舍</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()
        : null}
    </div>
  );
}

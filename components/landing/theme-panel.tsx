"use client";

import { ArrowLeft, ArrowRight, MessageCircle, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { ThemeStage } from "@/components/pixel/theme-stage";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import type { ScenarioTheme, ScenarioTopic } from "@/lib/scenario-library";
import { getSkin, skinStyleVars } from "@/lib/scenario-skin";
import { cn } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

interface ThemePanelProps {
  theme: ScenarioTheme;
  index: number;
  total: number;
  /** 当前停留在这一屏 */
  active: boolean;
  /** 距离当前屏足够近,才真正挂载像素演出,避免首屏塞进整库 DOM */
  mounted: boolean;
}

function topicHref(topic: ScenarioTopic) {
  return `/world/${encodeURIComponent(topic.id)}?q=${encodeURIComponent(topic.title)}`;
}

function TopicCard({ topic, order }: { topic: ScenarioTopic; order: number }) {
  return (
    <Link
      href={topicHref(topic)}
      className="focus-visible:ring-ring block h-full rounded-xl focus-visible:ring-2 focus-visible:outline-none"
    >
      <SpotlightCard
        spotlightColor="rgba(255, 255, 255, 0.12)"
        className="bg-card/85 hover:border-primary/50 h-full p-0 gap-0 shadow-lg backdrop-blur-md transition-all"
      >
        <CardHeader className="gap-2 p-4 sm:p-5">
          <div className="text-muted-foreground flex items-center gap-1.5 font-mono text-[10px]">
            <span>{String(order + 1).padStart(2, "0")}</span>
            {topic.author ? <span className="truncate">· {topic.author}</span> : null}
          </div>
          <CardTitle className="line-clamp-3 text-sm leading-6 font-medium sm:text-base sm:leading-7">
            {topic.title}
          </CardTitle>
        </CardHeader>
        <CardFooter className="mt-auto flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <ThumbsUp className="size-3.5" />
              {numberFormatter.format(topic.votes)}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="size-3.5" />
              {numberFormatter.format(topic.comments)}
            </span>
          </div>
          <span className={cn(buttonVariants({ size: "sm" }), "pointer-events-none")}>
            进入副本
            <ArrowRight data-icon="inline-end" />
          </span>
        </CardFooter>
      </SpotlightCard>
    </Link>
  );
}

export function ThemePanel({ theme, index, total, active, mounted }: ThemePanelProps) {
  const skin = getSkin(theme.id);
  const textRight = index % 2 === 0;
  const railRef = useRef<HTMLUListElement>(null);

  const scrollRail = (direction: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector("li");
    const step = card ? card.getBoundingClientRect().width + 16 : rail.clientWidth * 0.8;
    rail.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  return (
    <section
      id={theme.id}
      style={skinStyleVars(skin)}
      aria-label={`${skin.name}副本分区`}
      className="bg-background text-foreground relative h-dvh w-full snap-start snap-always overflow-hidden"
    >
      {/* 底:整屏像素演出 */}
      {mounted ? (
        <ThemeStage
          skin={skin}
          reversed={textRight}
          className={cn(
            "transition-opacity duration-700 ease-out motion-reduce:transition-none",
            active ? "opacity-100" : "opacity-60",
          )}
        />
      ) : null}

      {/* 顶部压深,保证标题在任何皮肤下都读得清 */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to bottom, ${skin.bg}f2, ${skin.bg}80 24%, ${skin.bg}00 48%)`,
        }}
      />

      {/* 前:标题 + 浮动的副本层,两者都压在演出之上 */}
      <div className="relative flex h-full flex-col pt-14 sm:pt-16">
        <div
          className={cn(
            "mx-auto flex w-full max-w-7xl flex-col px-5 pt-3 transition-all duration-700 ease-out motion-reduce:transition-none sm:px-8 sm:pt-4",
            textRight ? "items-end text-right" : "items-start",
            active ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0",
          )}
        >
          <div className={cn("flex items-center gap-2", textRight && "flex-row-reverse")}>
            <Badge variant="outline" className="font-mono text-[10px]">
              {theme.id}
            </Badge>
            <span className="font-mono text-[11px] opacity-70">
              {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-5xl">{skin.name}</h2>
          <p className="mt-1 text-sm opacity-85 sm:text-base">{skin.mood}</p>
        </div>

        {/* 浮动副本层:贴着演出带上方悬停,不再挤在屏幕最底边 */}
        <div className="mt-auto">
          <div
            className={cn(
              "mx-auto w-full max-w-7xl px-5 transition-all delay-100 duration-700 ease-out motion-reduce:transition-none sm:px-8",
              active ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
            )}
          >
            <div className="mb-3 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {theme.scenarios.length} 间副本
                  <span className="opacity-60"> · 选一间开始推演</span>
                </p>
                <p className="text-muted-foreground mt-1 line-clamp-1 text-xs">{theme.hint}</p>
              </div>
              <div className="hidden shrink-0 items-center gap-1 lg:flex">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => scrollRail(-1)}
                  aria-label="上一组副本"
                >
                  <ArrowLeft />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => scrollRail(1)}
                  aria-label="下一组副本"
                >
                  <ArrowRight />
                </Button>
              </div>
            </div>

            <ul
              ref={railRef}
              className="flex snap-x snap-mandatory scrollbar-none gap-3 overflow-x-auto pb-1 sm:gap-4"
            >
              {theme.scenarios.map((topic, order) => (
                <li key={topic.id} className="w-[84%] shrink-0 snap-center sm:w-[56%] lg:w-[29rem]">
                  <TopicCard topic={topic} order={order} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 演出带:给地面精灵留出的高度,不放任何前景内容 */}
        <div className="h-[26dvh] shrink-0 sm:h-[32dvh] lg:h-[38dvh]" aria-hidden="true" />
      </div>
    </section>
  );
}

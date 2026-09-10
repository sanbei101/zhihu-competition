import { ArrowRight, Layers, MessageCircle, ThumbsUp } from "lucide-react";
import Link from "next/link";

import { ThemeStage } from "@/components/pixel/theme-stage";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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

function TopicCard({ topic }: { topic: ScenarioTopic }) {
  return (
    <Link
      href={`/world/${encodeURIComponent(topic.id)}?q=${encodeURIComponent(topic.title)}`}
      className="block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Card size="sm" className="hover:ring-primary/40 h-full gap-0 py-0 transition-all">
        <CardHeader className="gap-1 p-3.5">
          <CardTitle className="line-clamp-2 text-[0.8rem] leading-5 font-medium">
            {topic.title}
          </CardTitle>
        </CardHeader>
        <CardFooter className="mt-auto flex items-center justify-between gap-2 px-3.5 py-2">
          <div className="text-muted-foreground flex items-center gap-3 text-[0.7rem]">
            <span className="flex items-center gap-1">
              <ThumbsUp className="size-3" />
              {numberFormatter.format(topic.votes)}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="size-3" />
              {numberFormatter.format(topic.comments)}
            </span>
          </div>
          <span className={cn(buttonVariants({ variant: "ghost", size: "xs" }), "text-primary")}>
            推演
            <ArrowRight data-icon="inline-end" />
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}

export function ThemePanel({ theme, index, total, active, mounted }: ThemePanelProps) {
  const skin = getSkin(theme.id);
  const textRight = index % 2 === 0;

  return (
    <section
      id={theme.id}
      style={skinStyleVars(skin)}
      aria-label={`${skin.name}世界线分区`}
      className="bg-background text-foreground relative h-dvh w-full snap-start snap-always overflow-hidden"
    >
      <div className="flex h-full flex-col">
        {/* 演出区:一整屏,只有这一屏占据视线 */}
        <div className="relative min-h-0 flex-1">
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

          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(to bottom, ${skin.bg}f2, ${skin.bg}99 30%, ${skin.bg}00 62%)`,
            }}
          />

          <div className="relative flex h-full flex-col pt-16 sm:pt-20">
            <div
              className={cn(
                "mx-auto flex h-full w-full max-w-7xl flex-col p-5 sm:p-8",
                textRight ? "items-end text-right lg:pr-20" : "items-start",
              )}
            >
              <div
                className={cn(
                  "flex max-w-xl flex-col gap-3 transition-all duration-700 ease-out motion-reduce:transition-none",
                  active ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
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
                <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">{skin.name}</h2>
                <p className="text-sm opacity-85 sm:text-base">
                  {skin.mood} · {theme.scenarios.length} 条世界线
                </p>
                <p className="max-w-md text-xs leading-6 opacity-60 sm:text-sm">{theme.hint}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 题库架:整屏里唯一可横向滑动的层 */}
        <div className="bg-background border-border border-t">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 pt-3 sm:px-8">
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <Layers className="size-3.5" />
              母本题库 · {theme.scenarios.length} 条世界线
            </p>
            <span className="text-muted-foreground hidden font-mono text-xs lg:block">
              {theme.visual}
            </span>
          </div>
          <ul className="scrollbar-none mx-auto flex max-w-7xl snap-x gap-3 overflow-x-auto px-5 py-3 sm:px-8 lg:grid lg:grid-cols-3 lg:snap-none lg:overflow-visible">
            {theme.scenarios.map((topic) => (
              <li key={topic.id} className="w-[80%] shrink-0 snap-center sm:w-[46%] lg:w-auto">
                <TopicCard topic={topic} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

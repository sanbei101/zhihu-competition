import { ArrowRight, Layers, MessageCircle, ThumbsUp } from "lucide-react";
import Link from "next/link";

import { ThemeScene } from "@/components/pixel/theme-scene";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SCENARIO_THEMES, type ScenarioTopic } from "@/lib/scenario-library";
import { getSkin, skinStyleVars } from "@/lib/scenario-skin";

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const totalScenarios = SCENARIO_THEMES.reduce((sum, theme) => sum + theme.scenarios.length, 0);

function scenarioHref(topic: ScenarioTopic) {
  return `/world/${encodeURIComponent(topic.id)}?q=${encodeURIComponent(topic.title)}`;
}

function TopicCard({ topic }: { topic: ScenarioTopic }) {
  return (
    <Card className="bg-card text-card-foreground flex h-full flex-col justify-between border">
      <CardHeader className="gap-2 p-4">
        <CardTitle className="text-sm leading-6 font-medium">{topic.title}</CardTitle>
        {topic.author ? <p className="text-muted-foreground text-xs">{topic.author}</p> : null}
      </CardHeader>
      <CardFooter className="border-border flex items-center justify-between border-t px-4 py-2">
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
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          className="h-7 px-2 text-xs"
          render={<Link href={scenarioHref(topic)} />}
        >
          推演
          <ArrowRight data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function ThemeSection({ theme }: { theme: (typeof SCENARIO_THEMES)[number] }) {
  const skin = getSkin(theme.id);

  return (
    <section id={theme.id} style={skinStyleVars(skin)} className="bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <ThemeScene skin={skin} variant="banner" className="border-border rounded-md border" />

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{skin.name}</h2>
              <Badge variant="outline" className="font-mono text-[10px]">
                {theme.id}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
              {skin.mood} · {theme.scenarios.length} 条世界线
            </p>
            <p className="text-muted-foreground mt-1 text-xs">{theme.hint}</p>
          </div>
          <span className="text-muted-foreground font-mono text-xs">{theme.visual}</span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {theme.scenarios.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="bg-muted/20 text-foreground min-h-screen">
      <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="知乎脑洞首页">
            <img src="/zhihu.svg" alt="知乎脑洞" className="size-9 rounded-lg" />
            <span className="text-base font-semibold tracking-tight">知乎脑洞</span>
            <Separator orientation="vertical" className="bg-border/60 hidden h-4 sm:block" />
            <span className="text-muted-foreground hidden text-xs tracking-wider uppercase sm:block">
              Worldline Archives
            </span>
          </Link>
          <div className="text-muted-foreground flex items-center gap-2 font-mono text-xs">
            <Layers className="size-3.5" />
            {SCENARIO_THEMES.length} 个主题 / {totalScenarios} 条世界线
          </div>
        </div>
      </header>

      <section className="border-border/60 bg-background border-b">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl sm:leading-[1.15]">
            一个问题,
            <br />
            一条尚未发生的世界线。
          </h1>
          <p className="text-muted-foreground mt-5 max-w-2xl text-base sm:text-lg">
            从知乎的历史假设与脑洞命题中精选母本,按主题分装成可推演的世界。挑一个分区,进入议事厅做决定。
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {SCENARIO_THEMES.map((theme) => {
              const skin = getSkin(theme.id);
              return (
                <Button
                  key={theme.id}
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`#${theme.id}`} />}
                >
                  <span
                    className="size-2"
                    style={{ backgroundColor: skin.accent }}
                    aria-hidden="true"
                  />
                  {skin.name}
                </Button>
              );
            })}
          </div>
        </div>
      </section>

      {SCENARIO_THEMES.map((theme) => (
        <ThemeSection key={theme.id} theme={theme} />
      ))}

      <footer className="border-border/60 bg-background border-t">
        <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col gap-2 px-5 py-8 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="text-foreground font-semibold">知乎脑洞 / WORLDLINE LAB</span>
          <span>母本来自知乎公开问题,推演内容由 AI 生成</span>
        </div>
      </footer>
    </main>
  );
}

import { ArrowLeft, ExternalLink, MessageCircle, Quote, ThumbsUp } from "lucide-react";
import Link from "next/link";

import { ThemeScene } from "@/components/pixel/theme-scene";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { WorldCastPanel } from "@/components/world-cast";
import { findScenario } from "@/lib/scenario-library";
import { getSkin, skinStyleVars } from "@/lib/scenario-skin";

interface WorldPageProps {
  params: Promise<{ id: string }>;
}

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export default async function WorldPage({ params }: WorldPageProps) {
  const { id } = await params;
  const found = findScenario(id);

  if (!found) {
    const skin = getSkin(undefined);

    return (
      <main style={skinStyleVars(skin)} className="bg-background text-foreground min-h-screen">
        <header className="border-border bg-background border-b">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
            <Link href="/" className="flex items-center gap-3" aria-label="返回知乎脑洞首页">
              <img src="/zhihu.svg" alt="知乎脑洞" className="size-9 rounded-lg" />
              <span className="font-semibold tracking-tight">知乎脑洞</span>
            </Link>
            <Button nativeButton={false} variant="ghost" size="sm" render={<Link href="/" />}>
              <ArrowLeft data-icon="inline-start" />
              返回主题库
            </Button>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <Card className="mx-auto max-w-lg shadow-none">
            <CardHeader className="p-6 sm:p-8">
              <CardTitle className="text-xl">这条世界线不在当前题库里</CardTitle>
              <p className="text-muted-foreground mt-2 text-sm leading-7">
                题库中的世界线由主题索引,请从首页对应分区进入。
              </p>
              <p className="text-muted-foreground mt-1 font-mono text-xs">ID: {id}</p>
            </CardHeader>
            <CardFooter className="bg-muted border-border flex gap-2 border-t px-6 py-4 sm:px-8">
              <Button nativeButton={false} render={<Link href="/" />}>
                <ArrowLeft data-icon="inline-start" />
                回主题库
              </Button>
            </CardFooter>
          </Card>
        </section>
      </main>
    );
  }

  const { theme, topic } = found;
  const skin = getSkin(theme.id);

  return (
    <main style={skinStyleVars(skin)} className="bg-background text-foreground min-h-screen">
      <header className="border-border bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="返回知乎脑洞首页">
            <img src="/zhihu.svg" alt="知乎脑洞" className="size-9 rounded-lg" />
            <span className="font-semibold tracking-tight">知乎脑洞</span>
          </Link>
          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            render={<Link href={`/#${theme.id}`} />}
          >
            <ArrowLeft data-icon="inline-start" />
            返回{skin.name}
          </Button>
        </div>
      </header>

      <section className="border-border border-b">
        <ThemeScene skin={skin} variant="banner" />
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="font-mono text-[10px]">
              {theme.id}
            </Badge>
            <Badge variant="secondary">
              {skin.name} · {skin.mood}
            </Badge>
            <span className="text-muted-foreground font-mono text-xs">{topic.id}</span>
          </div>

          <h1 className="mt-5 max-w-4xl text-3xl leading-tight font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            {topic.title}
          </h1>

          <div className="text-muted-foreground mt-6 flex flex-wrap items-center gap-5 text-sm">
            {topic.author ? (
              <span className="flex items-center gap-2">
                <Avatar className="size-7">
                  <AvatarFallback>{topic.author.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <span className="text-foreground font-medium">{topic.author}</span>
              </span>
            ) : null}
            <span className="flex items-center gap-1.5">
              <ThumbsUp className="size-4" />
              {numberFormatter.format(topic.votes)}
            </span>
            <span className="flex items-center gap-1.5">
              <MessageCircle className="size-4" />
              {numberFormatter.format(topic.comments)}
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
          <div>
            <p className="text-primary text-sm font-medium">SOURCE / ZHIHU</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">问题原文</h2>

            <Card className="border-border mt-5 shadow-none">
              <CardHeader className="p-6 sm:p-8">
                <Quote className="text-primary size-6" />
                <CardTitle className="pt-2 text-xl leading-8">{topic.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground px-6 text-sm leading-7 sm:px-8">
                该母本已收入固化题库,推演时以标题与所属主题的时代背景为准。原始讨论可在知乎查看。
              </CardContent>
              {topic.url ? (
                <CardFooter className="bg-muted border-border border-t px-6 py-4 sm:px-8">
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<a href={topic.url} target="_blank" rel="noreferrer" />}
                  >
                    打开知乎原页
                    <ExternalLink data-icon="inline-end" />
                  </Button>
                </CardFooter>
              ) : null}
            </Card>
          </div>

          <WorldCastPanel
            scenario={{ id: topic.id, title: topic.title, content: "", url: topic.url }}
          />
        </div>
      </section>
    </main>
  );
}

import { ArrowLeft, ExternalLink, GitFork, MessageCircle, Quote, ThumbsUp } from "lucide-react";
import Link from "next/link";

import { ThemeScene } from "@/components/pixel/theme-scene";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
            <Link href="/" className="flex items-center gap-3" aria-label="返回知乎脑洞游乐园首页">
              <img src="/zhihu.svg" alt="知乎脑洞游乐园" className="size-9 rounded-lg" />
              <span className="font-semibold tracking-tight">知乎脑洞游乐园</span>
            </Link>
            <Button nativeButton={false} variant="ghost" size="sm" render={<Link href="/" />}>
              <ArrowLeft data-icon="inline-start" />
              返回主题乐园
            </Button>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <Card className="mx-auto max-w-lg shadow-none">
            <CardHeader className="p-6 sm:p-8">
              <CardTitle className="text-xl">这间副本不在题库里</CardTitle>
              <p className="text-muted-foreground mt-2 text-sm leading-7">
                题库中的副本按主题乐园索引,请从首页对应分区进入。
              </p>
              <p className="text-muted-foreground mt-1 font-mono text-xs">ID: {id}</p>
            </CardHeader>
            <CardFooter className="bg-muted border-border flex gap-2 border-t px-6 py-4 sm:px-8">
              <Button nativeButton={false} render={<Link href="/" />}>
                <ArrowLeft data-icon="inline-start" />
                回主题乐园
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
          <Link href="/" className="flex items-center gap-3" aria-label="返回知乎脑洞游乐园首页">
            <img src="/zhihu.svg" alt="知乎脑洞游乐园" className="size-9 rounded-lg" />
            <span className="font-semibold tracking-tight">知乎脑洞游乐园</span>
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
          <div className="order-last lg:order-first">
            <p className="text-primary text-sm font-medium">SOURCE / ZHIHU</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">问题原文</h2>

            <Card className="border-border mt-5 shadow-none">
              <CardHeader className="p-6 sm:p-8">
                <Quote className="text-primary size-6" />
                <CardTitle className="pt-2 text-xl leading-8">{topic.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground px-6 text-sm leading-7 sm:px-8">
                该副本已收入题库,推演时以标题与所属主题的时代背景为准。原始讨论可在知乎查看。
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

          <div className="order-first space-y-6 lg:order-last">
            {/* 主玩法入口。放在最上面,因为打开反事实开关是这个作品的核心动作 */}
            <Card className="border-primary shadow-none">
              <CardHeader className="p-6">
                <Badge variant="secondary" className="w-fit">
                  MAIN / WORLDLINE
                </Badge>
                <CardTitle className="pt-2 text-xl leading-8">打开反事实开关</CardTitle>
                <CardDescription className="leading-6">
                  以这道题的反事实为前提,让政权、势力、人群、生态各自按自己的目标自主演化。
                  你只负责观测和推进时间,世界会自己长出历史,并在重大冲突处自然分叉。
                </CardDescription>
              </CardHeader>
              <CardFooter className="bg-muted/30 border-t px-6 py-4">
                <Button
                  className="w-full"
                  nativeButton={false}
                  render={<Link href={`/world/${encodeURIComponent(topic.id)}/sim`} />}
                >
                  进入世界线控制台
                  <GitFork data-icon="inline-end" />
                </Button>
              </CardFooter>
            </Card>

            {/* 玩法说明。玩家不需要扮演谁,所以这里要说清"你在这个世界里是什么角色" */}
            <Card className="shadow-none">
              <CardHeader className="p-6">
                <CardTitle className="text-base">你会看到什么</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-6 text-sm leading-6">
                <div>
                  <p className="font-medium">世界主体,不是角色</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                    台上站的是政权、军镇、士族、物种这类力量。它们各自追求不重叠的目标,
                    由独立推演并行盘算,再由世界裁决合并冲突。
                  </p>
                </div>
                <div>
                  <p className="font-medium">时间是变量</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                    每一阶段推进多久由局势决定。危机时刻按天走,制度变迁按年走, 生态演化按千年走。
                  </p>
                </div>
                <div>
                  <p className="font-medium">分叉是自然长出来的</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                    只有出现无法调和的重大冲突时,历史才会岔开。届时由你决定继续观察哪一条。
                  </p>
                </div>
                <div>
                  <p className="font-medium">硬约束不可违背</p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-5">
                    倒伏的后勤、疫病、地理通道与合法性都写成了世界法则, 任何主体违背都会被判定失败。
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}

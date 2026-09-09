import {
  ArrowRight,
  BookOpen,
  ExternalLink,
  GitBranch,
  MessageCircle,
  ThumbsUp,
} from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Separator } from "@/components/ui/separator";
import { getWorldScenarios, requireZhihuAccessSecret, type WorldScenario } from "@/lib/worlds";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function scenarioHref(scenario: WorldScenario) {
  return `/world/${encodeURIComponent(scenario.id)}?q=${encodeURIComponent(scenario.title)}`;
}

function ScenarioCard({ scenario, index }: { scenario: WorldScenario; index: number }) {
  return (
    <Card className="group border-border/70 flex h-full flex-col shadow-none transition duration-200 hover:-translate-y-1 hover:shadow-md">
      <CardHeader className="gap-5 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span className="bg-muted text-foreground grid size-8 place-items-center rounded-md font-mono text-sm">
              {String(index).padStart(2, "0")}
            </span>
            <span className="font-mono">QUESTION</span>
          </div>
          <Badge variant="outline">知乎母本</Badge>
        </div>
        <CardTitle className="group-hover:text-primary line-clamp-3 text-xl leading-8 transition-colors">
          {scenario.title}
        </CardTitle>
        {scenario.author ? (
          <CardDescription className="flex items-center gap-2">
            <Avatar size="sm">
              {scenario.authorAvatar ? <AvatarImage src={scenario.authorAvatar} alt="" /> : null}
              <AvatarFallback>{scenario.author.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{scenario.author}</span>
          </CardDescription>
        ) : null}
      </CardHeader>

      <CardContent className="mt-auto px-6 pb-5">
        <Separator className="mb-4" />
        <div className="text-muted-foreground flex items-center gap-5 text-sm">
          <span className="flex items-center gap-1.5">
            <ThumbsUp className="size-4" />
            {numberFormatter.format(scenario.votes)}
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle className="size-4" />
            {numberFormatter.format(scenario.comments)}
          </span>
        </div>
      </CardContent>

      <CardFooter className="bg-muted/30 justify-between border-t px-6 py-3">
        <span className="text-muted-foreground text-xs">进入后查看母本</span>
        <Button variant="ghost" size="sm" render={<Link href={scenarioHref(scenario)} />}>
          开始
          <ArrowRight data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function FeaturedScenario({ scenario }: { scenario: WorldScenario }) {
  return (
    <Card className="border-border/70 overflow-hidden shadow-none">
      <div className="grid md:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="bg-primary text-primary-foreground flex min-h-36 items-end justify-between p-6 md:min-h-full md:flex-col">
          <span className="font-mono text-xs">FEATURED / 01</span>
          <GitBranch className="size-9 stroke-1" />
        </div>
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge>本期焦点</Badge>
            <span className="text-muted-foreground font-mono text-xs">{scenario.id}</span>
          </div>
          <h3 className="mt-6 max-w-3xl text-2xl leading-9 font-semibold tracking-tight sm:text-3xl">
            {scenario.title}
          </h3>
          {scenario.author ? (
            <div className="text-muted-foreground mt-5 flex items-center gap-3 text-sm">
              <Avatar size="sm">
                {scenario.authorAvatar ? <AvatarImage src={scenario.authorAvatar} alt="" /> : null}
                <AvatarFallback>{scenario.author.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <span>{scenario.author}</span>
            </div>
          ) : null}
          <Separator className="my-6" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-muted-foreground flex items-center gap-5 text-sm">
              <span className="flex items-center gap-2">
                <ThumbsUp className="size-4" />
                {numberFormatter.format(scenario.votes)} 赞同
              </span>
              <span className="flex items-center gap-2">
                <MessageCircle className="size-4" />
                {numberFormatter.format(scenario.comments)} 讨论
              </span>
            </div>
            <Button render={<Link href={scenarioHref(scenario)} />}>
              查看母本
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default async function Home() {
  const scenarios = await getWorldScenarios(requireZhihuAccessSecret());
  const [featured, ...rest] = scenarios;

  return (
    <main className="bg-muted/30 text-foreground min-h-screen">
      <header className="bg-background border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="岔路首页">
            <span className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-lg">
              <GitBranch className="size-5" />
            </span>
            <span className="font-semibold tracking-tight">岔路</span>
            <Separator orientation="vertical" className="hidden h-5 sm:block" />
            <span className="text-muted-foreground hidden text-sm sm:block">世界线档案库</span>
          </Link>
          <span className="text-muted-foreground font-mono text-xs">ZHIHU / LIVE SEARCH</span>
        </div>
      </header>

      <section className="bg-background border-b">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end lg:gap-20">
          <div className="border-primary max-w-3xl border-l-4 pl-6 sm:pl-8">
            <Badge variant="secondary">WHAT IF / WORLDLINE LAB</Badge>
            <h1 className="mt-6 text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
              一个问题，
              <br className="hidden sm:block" />
              一条尚未发生的世界线。
            </h1>
            <p className="text-muted-foreground mt-6 max-w-2xl text-base leading-7 sm:text-lg">
              从知乎的历史假设与科幻脑洞出发，挑选一张母本档案，进入它可能发生的另一种答案。
            </p>
            <Button size="lg" className="mt-8" render={<Link href="#archives" />}>
              浏览副本
              <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-5 border-t pt-5 lg:block lg:border-t-0 lg:border-l lg:pl-6">
            <div>
              <p className="text-muted-foreground text-sm">已载入母本</p>
              <p className="mt-2 text-4xl font-semibold tabular-nums">{scenarios.length}</p>
            </div>
            <div className="lg:mt-8">
              <p className="text-muted-foreground text-sm">数据来源</p>
              <p className="mt-2 font-mono text-sm">知乎搜索 API</p>
            </div>
          </div>
        </div>
      </section>

      <section id="archives" className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="text-primary flex items-center gap-2 text-sm font-medium">
              <BookOpen className="size-4" />
              <span>问题母本 / ARCHIVES</span>
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">选择一个副本</h2>
            <p className="text-muted-foreground mt-3">这里展示的是知乎实时搜索返回的假设题。</p>
          </div>
          <span className="text-muted-foreground text-sm">内容会随搜索结果变化</span>
        </div>

        <FeaturedScenario scenario={featured} />

        {rest.length ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {rest.map((scenario, index) => (
              <ScenarioCard key={scenario.id} scenario={scenario} index={index + 2} />
            ))}
          </div>
        ) : null}
      </section>

      <footer className="bg-background border-t">
        <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="text-foreground font-medium">岔路 / WORLDLINE LAB</span>
          {featured.url ? (
            <Button
              variant="link"
              size="sm"
              render={<a href={featured.url} target="_blank" rel="noreferrer" />}
            >
              查看本期知乎来源
              <ExternalLink data-icon="inline-end" />
            </Button>
          ) : null}
        </div>
      </footer>
    </main>
  );
}

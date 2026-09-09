import {
  ArrowRight,
  BookOpen,
  ExternalLink,
  GitBranch,
  GitCommit,
  MessageCircle,
  Sparkles,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
  const isHighEngagement = scenario.votes > 1000 || scenario.comments > 100;
  const isAltVariant = index % 3 === 0;

  return (
    <div className="mb-5 inline-block w-full break-inside-avoid">
      <Card className="group border-border/60 bg-card/60 hover:border-primary/40 hover:shadow-primary/5 relative overflow-hidden backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
        {/* 顶部微光线 */}
        <div className="via-primary/20 group-hover:via-primary/50 pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent transition-opacity duration-300" />

        {isAltVariant && (
          <div className="bg-primary/5 group-hover:bg-primary/10 pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full blur-2xl transition-all duration-500" />
        )}

        <CardHeader className="gap-3 p-5">
          {/* 元数据与状态条 */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary grid size-6 place-items-center rounded font-mono text-[11px] font-semibold transition-colors">
                {String(index).padStart(2, "0")}
              </span>
              <span className="text-muted-foreground/80 font-mono text-[11px] tracking-wider uppercase">
                BRANCH // {scenario.id.slice(0, 4)}
              </span>
            </div>

            {isHighEngagement ? (
              <Badge
                variant="secondary"
                className="border-primary/20 bg-primary/10 text-primary gap-1 text-[10px]"
              >
                <TrendingUp className="size-3" />
                高热分支
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-border/60 text-muted-foreground text-[10px] font-normal"
              >
                知乎母本
              </Badge>
            )}
          </div>

          {/* 标题：不固定高度，让字数自然撑开卡片，形成视觉上的波浪落差 */}
          <CardTitle className="text-foreground group-hover:text-primary text-base leading-relaxed font-semibold tracking-tight transition-colors duration-200 sm:text-lg">
            {scenario.title}
          </CardTitle>

          {/* 作者信息与时间线节点 */}
          {scenario.author ? (
            <div className="border-border/40 mt-1 flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-2 overflow-hidden">
                <Avatar className="border-border/50 size-5 border">
                  {scenario.authorAvatar ? (
                    <AvatarImage src={scenario.authorAvatar} alt="" />
                  ) : null}
                  <AvatarFallback className="text-[10px]">
                    {scenario.author.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground truncate text-xs">{scenario.author}</span>
              </div>
              <div className="text-muted-foreground/60 flex items-center gap-1 font-mono text-[10px]">
                <GitCommit className="size-3" />
                <span>OBSERVER</span>
              </div>
            </div>
          ) : null}
        </CardHeader>

        {/* 底部数据与呼应 */}
        <CardFooter className="bg-muted/20 border-border/40 flex items-center justify-between border-t px-5 py-2.5">
          <div className="text-muted-foreground/80 flex items-center gap-3.5 text-xs">
            <span className="group-hover:text-foreground flex items-center gap-1 transition-colors">
              <ThumbsUp className="size-3.5" />
              {numberFormatter.format(scenario.votes)}
            </span>
            <span className="group-hover:text-foreground flex items-center gap-1 transition-colors">
              <MessageCircle className="size-3.5" />
              {numberFormatter.format(scenario.comments)}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground group-hover:text-primary hover:bg-primary/10 h-7 px-2 text-xs font-medium transition-colors"
            render={<Link href={scenarioHref(scenario)} />}
          >
            推演
            <ArrowRight className="ml-1 size-3 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

/**
 * 焦点母本卡片 (Featured Hero Card)
 */
function FeaturedScenario({ scenario }: { scenario: WorldScenario }) {
  return (
    <Card className="group border-border/70 from-card to-card/60 shadow-primary/5 hover:border-primary/40 relative overflow-hidden bg-gradient-to-b shadow-lg transition-all duration-300">
      {/* 顶部微高光 */}
      <div className="via-primary/40 pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent" />

      <div className="grid md:grid-cols-[11rem_minmax(0,1fr)]">
        {/* 左侧侧标区块 */}
        <div className="bg-primary/10 text-foreground relative flex min-h-36 flex-col justify-between overflow-hidden p-6 md:min-h-full">
          <div className="bg-primary/20 pointer-events-none absolute -top-8 -left-8 size-28 rounded-full blur-xl" />
          <div className="relative flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-75" />
              <span className="bg-primary relative inline-flex size-2 rounded-full" />
            </span>
            <span className="text-primary font-mono text-xs font-semibold tracking-wider">
              LIVE // 01
            </span>
          </div>
          <GitBranch className="text-primary/80 relative size-10 stroke-[1.25] transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12" />
        </div>

        {/* 右侧核心内容 */}
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground gap-1 shadow-none">
                <Sparkles className="size-3" />
                本期主焦点
              </Badge>
              <Badge variant="outline" className="border-border/60 font-mono text-xs">
                PARALLEL_CORE
              </Badge>
            </div>
            <span className="text-muted-foreground/80 font-mono text-xs">ID: {scenario.id}</span>
          </div>

          <h3 className="text-card-foreground mt-5 max-w-3xl text-2xl leading-snug font-semibold tracking-tight sm:text-3xl">
            {scenario.title}
          </h3>

          {scenario.author ? (
            <div className="text-muted-foreground mt-4 flex items-center gap-2 text-sm">
              <Avatar className="border-border size-6 border">
                {scenario.authorAvatar ? <AvatarImage src={scenario.authorAvatar} alt="" /> : null}
                <AvatarFallback>{scenario.author.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <span className="text-foreground font-medium">{scenario.author}</span>
              <span className="text-muted-foreground/60 text-xs">发起设想</span>
            </div>
          ) : null}

          <Separator className="bg-border/60 my-6" />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-muted-foreground flex items-center gap-6 text-sm">
              <span className="flex items-center gap-2">
                <ThumbsUp className="text-primary size-4" />
                <strong className="text-foreground">
                  {numberFormatter.format(scenario.votes)}
                </strong>{" "}
                赞同
              </span>
              <span className="flex items-center gap-2">
                <MessageCircle className="text-primary size-4" />
                <strong className="text-foreground">
                  {numberFormatter.format(scenario.comments)}
                </strong>{" "}
                深度讨论
              </span>
            </div>
            <Button
              className="group/btn shadow-primary/20 gap-2 shadow-sm"
              render={<Link href={scenarioHref(scenario)} />}
            >
              载入母本推演
              <ArrowRight className="size-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
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
    <main className="bg-muted/20 text-foreground min-h-screen">
      {/* 顶部导航 */}
      <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-3 transition-opacity hover:opacity-90"
            aria-label="岔路首页"
          >
            <span className="bg-primary text-primary-foreground shadow-primary/20 grid size-9 place-items-center rounded-lg shadow-sm">
              <GitBranch className="size-5" />
            </span>
            <span className="text-base font-semibold tracking-tight">岔路</span>
            <Separator orientation="vertical" className="bg-border/60 hidden h-4 sm:block" />
            <span className="text-muted-foreground hidden text-xs tracking-wider uppercase sm:block">
              Worldline Archives
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
              LIVE SEARCH API
            </span>
          </div>
        </div>
      </header>

      {/* Hero 区域 */}
      <section className="border-border/60 bg-background relative overflow-hidden border-b py-16 sm:py-24">
        {/* 背景微光扩散 */}
        <div className="bg-primary/5 pointer-events-none absolute -top-24 left-1/2 size-96 -translate-x-1/2 rounded-full blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end lg:gap-20">
          <div className="border-primary max-w-3xl border-l-2 pl-6 sm:pl-8">
            <Badge
              variant="secondary"
              className="border-primary/20 bg-primary/10 text-primary font-mono text-xs"
            >
              WHAT IF // WORLDLINE LAB
            </Badge>
            <h1 className="mt-6 text-4xl leading-tight font-bold tracking-tight sm:text-6xl">
              一个问题，
              <br className="hidden sm:block" />
              一条尚未发生的世界线。
            </h1>
            <p className="text-muted-foreground mt-6 max-w-2xl text-base leading-relaxed sm:text-lg">
              从知乎的历史假设与科幻脑洞出发，挑选一张母本档案，进入它可能发生的另一种推演结局。
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button size="lg" className="gap-2 shadow-sm" render={<Link href="#archives" />}>
                探索副本流
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="border-border/60 grid grid-cols-2 gap-5 border-t pt-6 lg:block lg:border-t-0 lg:border-l lg:pl-8">
            <div>
              <p className="text-muted-foreground text-xs tracking-wider uppercase">已载入母本</p>
              <p className="text-foreground mt-2 font-mono text-4xl font-bold tabular-nums">
                {scenarios.length}
              </p>
            </div>
            <div className="lg:mt-8">
              <p className="text-muted-foreground text-xs tracking-wider uppercase">数据源状态</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="bg-primary size-1.5 rounded-full" />
                <p className="text-foreground font-mono text-xs">知乎实时搜索</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 瀑布流档案列表 */}
      <section id="archives" className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="text-primary flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
              <BookOpen className="size-4" />
              <span>档案流 / ARCHIVES FEED</span>
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">选择世界线切片</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              错落排列的假设题目，卡片随思考深度自然延展。
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-border/60 bg-background/50 w-fit font-mono text-xs"
          >
            LIVE DYNAMIC FEED
          </Badge>
        </div>

        {/* 置顶焦点母本 */}
        <div className="mb-8">
          <FeaturedScenario scenario={featured} />
        </div>

        {/* 小红书风格的错落瀑布流 (CSS Columns Masonry) */}
        {rest.length ? (
          <div className="columns-1 gap-5 [column-fill:_balance] sm:columns-2 lg:columns-3">
            {rest.map((scenario, index) => (
              <ScenarioCard key={scenario.id} scenario={scenario} index={index + 2} />
            ))}
          </div>
        ) : null}
      </section>

      {/* 页脚 */}
      <footer className="border-border/60 bg-background border-t">
        <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2 font-mono">
            <span className="bg-primary size-2 rounded-full" />
            <span className="text-foreground font-semibold">岔路 / WORLDLINE LAB</span>
          </div>
          {featured.url ? (
            <Button
              variant="link"
              size="sm"
              className="text-muted-foreground hover:text-primary h-auto p-0 text-xs"
              render={<a href={featured.url} target="_blank" rel="noreferrer" />}
            >
              查看本期知乎来源
              <ExternalLink className="ml-1 size-3" />
            </Button>
          ) : null}
        </div>
      </footer>
    </main>
  );
}

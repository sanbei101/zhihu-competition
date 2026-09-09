import {
  ArrowRight,
  BookOpen,
  ExternalLink,
  GitBranch,
  GitCommit,
  MessageCircle,
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
            nativeButton={false}
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
    <Card className="group border-border/80 from-card via-card/90 to-muted/20 hover:border-primary/50 hover:shadow-primary/5 relative overflow-hidden rounded-2xl border bg-gradient-to-b p-6 shadow-sm transition-all duration-300 hover:shadow-xl sm:p-8">
      {/* 顶部环境微光丝带 */}
      <div className="via-primary pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent to-transparent opacity-75" />

      {/* 右上角背景隐约的网格徽标装饰（增强科技探索感） */}
      <div className="text-primary/5 group-hover:text-primary/10 pointer-events-none absolute -top-6 -right-6 transition-transform duration-700 group-hover:scale-110">
        <GitBranch className="size-48 stroke-1" />
      </div>

      <div className="relative space-y-6">
        {/* 卡片顶部 HUD 状态栏 */}
        <div className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-2.5">
            <span className="relative flex size-2">
              <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-75" />
              <span className="bg-primary relative inline-flex size-2 rounded-full" />
            </span>
            <Badge className="bg-primary text-primary-foreground font-mono text-xs tracking-wider uppercase">
              FEATURED // 01 观测核心
            </Badge>
            <Badge
              variant="outline"
              className="border-border/60 text-muted-foreground font-mono text-[11px]"
            >
              ID: {scenario.id.slice(0, 10)}
            </Badge>
          </div>

          <span className="text-muted-foreground font-mono text-xs tracking-wider">
            DIVERGENCE // ACTIVE
          </span>
        </div>

        {/* 核心问题标题：排版强化 */}
        <div className="space-y-3">
          <CardTitle className="text-foreground group-hover:text-primary text-xl leading-relaxed font-bold tracking-tight transition-colors sm:text-2xl lg:text-3xl">
            {scenario.title}
          </CardTitle>

          {scenario.author && (
            <div className="flex items-center gap-2.5 pt-1">
              <Avatar className="border-border size-6 border">
                {scenario.authorAvatar ? <AvatarImage src={scenario.authorAvatar} alt="" /> : null}
                <AvatarFallback className="text-xs">{scenario.author.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <span className="text-foreground text-xs font-medium">{scenario.author}</span>
              <span className="text-muted-foreground text-xs">· 知乎母本发起人</span>
            </div>
          )}
        </div>

        {/* 底部交互与数据槽 */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2 text-xs">
            <div className="border-border/60 bg-background/80 text-muted-foreground flex items-center gap-1.5 rounded-full border px-3 py-1">
              <ThumbsUp className="text-primary size-3.5" />
              <span>赞同</span>
              <strong className="text-foreground font-mono">
                {numberFormatter.format(scenario.votes)}
              </strong>
            </div>
            <div className="border-border/60 bg-background/80 text-muted-foreground flex items-center gap-1.5 rounded-full border px-3 py-1">
              <MessageCircle className="text-primary size-3.5" />
              <span>讨论</span>
              <strong className="text-foreground font-mono">
                {numberFormatter.format(scenario.comments)}
              </strong>
            </div>
          </div>

          <Button
            size="sm"
            nativeButton={false}
            className="group-hover:shadow-primary/20 gap-2 shadow-sm transition-all duration-200 group-hover:shadow-md"
            render={<Link href={scenarioHref(scenario)} />}
          >
            载入世界线推演
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
          </Button>
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
      <section className="border-border/60 from-background via-muted/10 to-background relative overflow-hidden border-b bg-gradient-to-b py-16 sm:py-20">
        {/* 背景质感微网格（纯 Tailwind 类实现） */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
            {/* 左侧主要文案 */}
            <div className="max-w-2xl space-y-5">
              <h1 className="text-foreground text-3xl font-extrabold tracking-tight sm:text-5xl sm:leading-[1.15]">
                一个问题，
                <span className="text-muted-foreground"> 衍生出</span>
                <br />
                一条尚未发生的世界线。
              </h1>

              <p className="text-muted-foreground text-base sm:text-lg">
                从知乎的历史假设与脑洞命题出发，提取母本切片，探索平行历史的另一种解答。
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  size="default"
                  nativeButton={false}
                  className="gap-2"
                  render={<Link href="#archives" />}
                >
                  挑选副本探索
                  <ArrowRight className="size-4" />
                </Button>
                <div className="text-muted-foreground flex items-center gap-2 text-xs sm:ml-2">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  <span>实时数据流同步中</span>
                </div>
              </div>
            </div>

            {/* 右侧紧凑数据仪表舱 */}
            <div className="flex flex-row gap-4 lg:flex-col">
              <div className="border-border/60 bg-card/60 flex-1 rounded-xl border p-4 shadow-sm backdrop-blur-sm sm:p-5 lg:w-56">
                <span className="text-muted-foreground font-mono text-[11px] tracking-wider uppercase">
                  母本载入量
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-foreground font-mono text-3xl font-bold tracking-tight sm:text-4xl">
                    {scenarios.length}
                  </span>
                  <span className="text-muted-foreground text-xs">PARALLELS</span>
                </div>
              </div>

              <div className="border-border/60 bg-card/60 flex-1 rounded-xl border p-4 shadow-sm backdrop-blur-sm sm:p-5 lg:w-56">
                <span className="text-muted-foreground font-mono text-[11px] tracking-wider uppercase">
                  数据信源
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="bg-primary size-2 rounded-full" />
                  <span className="text-foreground text-sm font-medium">知乎实时搜索 API</span>
                </div>
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
              nativeButton={false}
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

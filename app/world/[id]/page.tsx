import { ArrowLeft, ExternalLink, MessageCircle, Quote, ThumbsUp } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WorldCastPanel } from "@/components/world-cast";
import { getWorldScenario, requireZhihuAccessSecret } from "@/lib/worlds";
import { ZhihuApiError } from "@/lib/zhihu";

export const dynamic = "force-dynamic";

interface WorldPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function editDate(editTime: number) {
  if (!editTime) return null;

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(editTime * 1000));
}

export default async function WorldPage({ params, searchParams }: WorldPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  let scenario: Awaited<ReturnType<typeof getWorldScenario>> | null = null;
  let loadError = "";
  try {
    scenario = await getWorldScenario(requireZhihuAccessSecret(), id, query.q);
  } catch (error) {
    console.error("世界线母本加载失败", error);
    loadError =
      error instanceof ZhihuApiError
        ? `该知乎母本暂时无法载入(${error.message}),可能是内容已删除或搜索暂时搜不到它。`
        : "世界线母本加载失败,请稍后重试。";
  }

  if (!scenario) {
    return (
      <main className="bg-muted/30 text-foreground min-h-screen">
        <header className="bg-background border-b">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
            <Link href="/" className="flex items-center gap-3" aria-label="返回知乎脑洞首页">
              <img src="/zhihu.svg" alt="知乎脑洞" className="size-9 rounded-lg" />
              <span className="font-semibold tracking-tight">知乎脑洞</span>
            </Link>
            <Button
              nativeButton={false}
              variant="ghost"
              size="sm"
              render={<Link href="/#archives" />}
            >
              <ArrowLeft data-icon="inline-start" />
              返回副本库
            </Button>
          </div>
        </header>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <Card className="mx-auto max-w-lg shadow-none">
            <CardHeader className="p-6 sm:p-8">
              <CardTitle className="text-xl">这条世界线暂时打不开了</CardTitle>
              <p className="text-muted-foreground mt-2 text-sm leading-7">{loadError}</p>
              <p className="text-muted-foreground mt-1 font-mono text-xs">ID: {id}</p>
            </CardHeader>
            <CardFooter className="bg-muted/30 flex gap-2 border-t px-6 py-4 sm:px-8">
              <Button nativeButton={false} render={<Link href="/#archives" />}>
                <ArrowLeft data-icon="inline-start" />
                回副本库换一条
              </Button>
              <Button
                variant="outline"
                render={
                  <Link
                    href={
                      query.q
                        ? `/world/${encodeURIComponent(id)}?q=${encodeURIComponent(query.q)}`
                        : `/world/${encodeURIComponent(id)}`
                    }
                  />
                }
              >
                重试
              </Button>
            </CardFooter>
          </Card>
        </section>
      </main>
    );
  }

  const updatedAt = editDate(scenario.editTime);

  return (
    <main className="bg-muted/30 text-foreground min-h-screen">
      <header className="bg-background border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="返回知乎脑洞首页">
            <img src="/zhihu.svg" alt="知乎脑洞" className="size-9 rounded-lg" />
            <span className="font-semibold tracking-tight">知乎脑洞</span>
          </Link>
          <Button
            nativeButton={false}
            variant="ghost"
            size="sm"
            render={<Link href="/#archives" />}
          >
            <ArrowLeft data-icon="inline-start" />
            返回副本库
          </Button>
        </div>
      </header>

      <section className="bg-background border-b">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-20">
          <div className="border-primary max-w-4xl border-l-4 pl-6 sm:pl-8">
            <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="outline">知乎母本</Badge>
              <span className="font-mono text-xs">{scenario.id}</span>
            </div>
            <h1 className="mt-6 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              {scenario.title}
            </h1>
            {scenario.author ? (
              <div className="text-muted-foreground mt-7 flex items-center gap-3 text-sm">
                <Avatar>
                  {scenario.authorAvatar ? (
                    <AvatarImage src={scenario.authorAvatar} alt="" />
                  ) : null}
                  <AvatarFallback>{scenario.author.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-foreground font-medium">{scenario.author}</p>
                  {updatedAt ? <p className="text-xs">编辑于 {updatedAt}</p> : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
          <div>
            <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-primary text-sm font-medium">SOURCE / ZHIHU</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">问题原文</h2>
              </div>
              <div className="text-muted-foreground flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <ThumbsUp className="size-4" />
                  {numberFormatter.format(scenario.votes)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MessageCircle className="size-4" />
                  {numberFormatter.format(scenario.comments)}
                </span>
              </div>
            </div>

            <Card className="border-border/70 shadow-none">
              <CardHeader className="p-6 sm:p-8">
                <Quote className="text-primary size-6" />
                <CardTitle className="pt-2 text-xl leading-8">{scenario.title}</CardTitle>
              </CardHeader>
              {scenario.content ? (
                <CardContent className="px-6 sm:px-8">
                  <Separator className="mb-6" />
                  <p className="text-muted-foreground text-base leading-8 whitespace-pre-wrap">
                    {scenario.content}
                  </p>
                </CardContent>
              ) : null}
              {scenario.url ? (
                <CardFooter className="bg-muted/30 border-t px-6 py-4 sm:px-8">
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<a href={scenario.url} target="_blank" rel="noreferrer" />}
                  >
                    打开知乎原页
                    <ExternalLink data-icon="inline-end" />
                  </Button>
                </CardFooter>
              ) : null}
            </Card>
          </div>

          <WorldCastPanel scenario={scenario} />
        </div>
      </section>
    </main>
  );
}

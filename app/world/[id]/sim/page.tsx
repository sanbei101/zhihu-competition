import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { WorldlineRunner } from "@/components/worldline/runner";
import { findScenario } from "@/lib/scenario-library";
import { getSkin, skinStyleVars } from "@/lib/scenario-skin";

interface WorldSimPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 世界线观测台。
 *
 * 这是玩法的正式入口:数据全部来自真实模型链路
 * (/api/worldline-seed 铺开世界,/api/worldline-wave 发下一波事件并演世界的反应)。
 *
 * 页面本身只做三件事:按题目 id 拿到副本、套上这个主题的皮肤、把整屏交给 WorldlineRunner。
 * 注意这里**不给任何内边距与最大宽度** —— 观测台是整屏的,
 * .shell 自己负责居中与留白,多一层容器就会把它挤变形。
 */
export default async function WorldSimPage({ params }: WorldSimPageProps) {
  const { id } = await params;
  const found = findScenario(id);

  if (!found) {
    const skin = getSkin(undefined);

    return (
      <main style={skinStyleVars(skin)} className="bg-background text-foreground min-h-screen">
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-8">
          <Card className="mx-auto max-w-lg shadow-none">
            <CardHeader className="p-6 sm:p-8">
              <CardTitle className="text-xl">这间副本不在题库里</CardTitle>
              <p className="text-muted-foreground mt-2 text-sm leading-7">
                世界线观测台需要一道真实的假设题作为起点,请从首页对应分区进入。
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
    <main style={skinStyleVars(skin)}>
      <WorldlineRunner
        scenarioId={topic.id}
        scenarioTitle={topic.title}
        themeId={theme.id}
        skin={skin}
      />
    </main>
  );
}

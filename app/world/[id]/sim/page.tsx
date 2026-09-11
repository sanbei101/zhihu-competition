import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { WorldRunner } from "@/components/world-simulator/world-runner";
import { findScenario } from "@/lib/scenario-library";
import { getSkin, skinStyleVars } from "@/lib/scenario-skin";

interface WorldSimPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 世界线牌局。
 *
 * 这是 v3 玩法的正式入口:数据全部来自真实模型链路
 * (/api/world-seed 构建世界, /api/world-simulate 推进一个阶段并发牌)。
 * 页面本身只做两件事:按题目 id 找到副本、决定用哪套皮肤,剩下的交给 WorldRunner。
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
                世界线控制台需要一道真实的假设题作为起点,请从首页对应分区进入。
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
      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-7">
        <WorldRunner
          scenarioId={topic.id}
          scenarioTitle={topic.title}
          themeId={theme.id}
          themeName={theme.name}
          skin={skin}
        />
      </section>
    </main>
  );
}

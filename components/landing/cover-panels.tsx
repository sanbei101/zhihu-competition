import { ArrowUp, ChevronDown } from "lucide-react";
import Link from "next/link";

import { StageBackdrop, GROUND_LINE, StageSprite, ThemeStage } from "@/components/pixel/theme-stage";
import { spritesForSkin } from "@/components/pixel/sprites";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SCENARIO_THEMES } from "@/lib/scenario-library";
import { getSkin, skinStyleVars } from "@/lib/scenario-skin";
import { cn } from "@/lib/utils";

/** 封面巡游:每个主题派一位招牌精灵,带着自己的皮肤配色站成一排 */
const PARADE: Array<{ id: string; height: number }> = [
  { id: "dino", height: 208 },
  { id: "three-kingdoms", height: 176 },
  { id: "cosmic", height: 190 },
  { id: "apocalypse", height: 164 },
  { id: "alien", height: 182 },
];

function WorldParade() {
  return (
    <div
      className={`absolute inset-x-0 ${GROUND_LINE} flex items-end justify-between gap-3 px-[6%] sm:px-[9%]`}
      aria-hidden="true"
    >
      {PARADE.map((entry) => {
        const skin = getSkin(entry.id);
        const sprite = spritesForSkin(skin)[0];
        if (!sprite) return null;
        return <StageSprite key={entry.id} sprite={sprite} targetHeight={entry.height} />;
      })}
    </div>
  );
}

export function CoverPanel({ onJump }: { onJump: (index: number) => void }) {
  const skin = getSkin(undefined);
  const topicCount = SCENARIO_THEMES.reduce((sum, theme) => sum + theme.scenarios.length, 0);

  return (
    <section
      id="top"
      style={skinStyleVars(skin)}
      aria-label="世界线档案库入口"
      className="bg-background text-foreground relative h-dvh w-full snap-start snap-always overflow-hidden"
    >
      <div className="absolute inset-0">
        <StageBackdrop skin={skin} />
        <WorldParade />
      </div>

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to bottom, ${skin.bg}f5, ${skin.bg}c0 40%, ${skin.bg}00 70%)`,
        }}
      />

      <div className="relative flex h-full flex-col items-center px-5 pt-20 text-center sm:pt-24">
        <Badge variant="outline" className="font-mono text-[10px] tracking-widest">
          WORLDLINE ARCHIVES
        </Badge>

        <h1 className="mt-4 max-w-3xl text-3xl leading-tight font-semibold tracking-tight sm:text-5xl sm:leading-[1.15]">
          一个问题,
          <br />
          一条尚未发生的世界线。
        </h1>

        <p className="text-muted-foreground mt-4 max-w-xl text-sm leading-7 sm:text-base">
          从知乎的历史假设与脑洞命题中精选母本,按主题分装成可推演的世界。挑一个分区,进入议事厅做决定。
        </p>

        <div className="scrollbar-none -mx-5 mt-6 flex w-[calc(100%+2.5rem)] snap-x gap-2 overflow-x-auto px-5 sm:mx-0 sm:w-auto sm:max-w-3xl sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
          {SCENARIO_THEMES.map((theme, index) => {
            const themeSkin = getSkin(theme.id);
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onJump(index + 1)}
                className={cn(buttonVariants({ variant: "outline", size: "xs" }), "shrink-0 snap-center")}
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: themeSkin.accent }}
                  aria-hidden="true"
                />
                {themeSkin.name}
              </button>
            );
          })}
        </div>

        <div className="text-muted-foreground mt-5 flex items-center gap-3 font-mono text-[11px]">
          <span>{SCENARIO_THEMES.length} 个主题</span>
          <Separator orientation="vertical" className="h-3 self-center" />
          <span>{topicCount} 条世界线</span>
        </div>

        <div className="text-muted-foreground mt-6 flex flex-col items-center gap-1">
          <span className="font-mono text-[10px] tracking-widest">SCROLL / 向下滑</span>
          <ChevronDown className="size-4 animate-bounce motion-reduce:animate-none" />
        </div>
      </div>
    </section>
  );
}

export function OutroPanel({
  onJump,
  mounted,
}: {
  onJump: (index: number) => void;
  mounted: boolean;
}) {
  const skin = getSkin(undefined);

  return (
    <section
      id="end"
      style={skinStyleVars(skin)}
      aria-label="世界线档案库结语"
      className="bg-background text-foreground relative h-dvh w-full snap-start snap-always overflow-hidden"
    >
      {mounted ? <ThemeStage skin={skin} /> : null}

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to bottom, ${skin.bg}f5, ${skin.bg}c0 42%, ${skin.bg}00 76%)`,
        }}
      />

      <div className="relative flex h-full flex-col items-center justify-center px-5 text-center">
        <Badge variant="outline" className="font-mono text-[10px] tracking-widest">
          END OF ARCHIVE
        </Badge>
        <h2 className="mt-4 max-w-2xl text-2xl leading-snug font-semibold tracking-tight sm:text-4xl">
          每一条世界线,
          <br />
          都从一个「如果」开始。
        </h2>
        <p className="text-muted-foreground mt-4 max-w-xl text-sm leading-7">
          挑一个母本,把决定权交给你,剩下的交给议事厅。
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => onJump(0)}>
            回到入口
            <ArrowUp data-icon="inline-end" />
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`#${SCENARIO_THEMES[0]?.id ?? "top"}`} />}
          >
            从第一条世界线开始
          </Button>
        </div>
      </div>

      <footer className="border-border bg-background/70 absolute inset-x-0 bottom-0 border-t backdrop-blur-md">
        <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4 text-[11px] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="text-foreground font-semibold">知乎脑洞 / WORLDLINE LAB</span>
          <span>母本来自知乎公开问题,推演内容由 AI 生成</span>
        </div>
      </footer>
    </section>
  );
}

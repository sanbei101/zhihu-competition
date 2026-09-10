"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CoverPanel, OutroPanel } from "@/components/landing/cover-panels";
import { ThemePanel } from "@/components/landing/theme-panel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SCENARIO_THEMES } from "@/lib/scenario-library";
import { getSkin, skinStyleVars } from "@/lib/scenario-skin";
import { cn } from "@/lib/utils";

const THEME_COUNT = SCENARIO_THEMES.length;
/** 入口屏 + 各主题屏 + 结语屏 */
const PANEL_COUNT = THEME_COUNT + 2;
/** 只有当前屏前后一屏真正挂载像素演出,首屏 HTML 不会塞进整个精灵库 */
const MOUNT_WINDOW = 1;

interface NavItem {
  id: string;
  label: string;
  skin: string | null;
}

const NAV_ITEMS: NavItem[] = [
  { id: "top", label: "入口", skin: null },
  ...SCENARIO_THEMES.map((theme) => ({
    id: theme.id,
    label: getSkin(theme.id).name,
    skin: theme.id,
  })),
  { id: "end", label: "结语", skin: null },
];

function TopBar({
  activeIndex,
  onJump,
}: {
  activeIndex: number;
  onJump: (index: number) => void;
}) {
  return (
    <header className="border-border bg-background/75 absolute inset-x-0 top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <a
          href="#top"
          onClick={(event) => {
            event.preventDefault();
            onJump(0);
          }}
          className="flex shrink-0 items-center gap-2.5"
          aria-label="回到知乎脑洞游乐园入口"
        >
          <img src="/zhihu.svg" alt="知乎脑洞游乐园" className="size-8 rounded-md" />
          <span className="text-sm font-semibold tracking-tight whitespace-nowrap">
            知乎脑洞游乐园
          </span>
          <Separator
            orientation="vertical"
            className="mx-1 hidden h-4 self-center 2xl:block"
          />
          <span className="text-muted-foreground hidden text-[11px] tracking-wider uppercase 2xl:block">
            Worldline Arcade
          </span>
        </a>

        <nav className="hidden items-center gap-0.5 xl:flex" aria-label="主题乐园">
          {SCENARIO_THEMES.map((theme, index) => {
            const current = activeIndex === index + 1;
            return (
              <Button
                key={theme.id}
                variant="ghost"
                size="xs"
                onClick={() => onJump(index + 1)}
                aria-current={current ? "true" : undefined}
                className={cn("text-[11px]", current && "bg-muted")}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: getSkin(theme.id).accent }}
                  aria-hidden="true"
                />
                {getSkin(theme.id).name}
              </Button>
            );
          })}
        </nav>
      </div>

      {/* 整屏进度:滚动到第几屏一眼可见 */}
      <div className="bg-border/60 absolute inset-x-0 bottom-0 h-0.5">
        <div
          className="bg-primary h-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${((activeIndex + 1) / PANEL_COUNT) * 100}%` }}
        />
      </div>
    </header>
  );
}

function DotRail({
  activeIndex,
  onJump,
}: {
  activeIndex: number;
  onJump: (index: number) => void;
}) {
  return (
    <nav
      aria-label="全部屏导航"
      className="absolute top-1/2 right-3 z-40 hidden -translate-y-1/2 flex-col items-end gap-1.5 lg:flex"
    >
      {NAV_ITEMS.map((item, index) => {
        const skin = getSkin(item.skin ?? undefined);
        const current = activeIndex === index;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onJump(index)}
            aria-label={`前往${item.label}`}
            aria-current={current ? "true" : undefined}
            className="group flex items-center gap-2 py-0.5"
          >
            <span className="bg-background/85 rounded px-2 py-0.5 font-mono text-[10px] whitespace-nowrap opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
              {item.label}
            </span>
            <span
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: current ? "1.75rem" : "0.5rem",
                backgroundColor: current ? skin.accent : skin.border,
              }}
            />
          </button>
        );
      })}
    </nav>
  );
}

export function WorldlineDeck() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  /** 点击跳转时先把目标屏的演出挂上,避免滚动落屏时长出来 */
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  // 滚轮回调只注册一次,当前屏与翻页锁都必须走 ref
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const wheelLockRef = useRef(false);

  const jumpTo = useCallback((index: number) => {
    const target = Math.min(PANEL_COUNT - 1, Math.max(0, index));
    setFocusIndex(target);
    const node = scrollerRef.current?.children[target];
    if (node instanceof HTMLElement) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // 整屏吸附:滚动位置直接换算当前屏序号
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const sync = () => {
      const step = scroller.clientHeight || 1;
      const index = Math.min(PANEL_COUNT - 1, Math.max(0, Math.round(scroller.scrollTop / step)));
      setActiveIndex((current) => (current === index ? current : index));
    };
    scroller.addEventListener("scroll", sync, { passive: true });
    sync();
    return () => scroller.removeEventListener("scroll", sync);
  }, []);

  // 从世界线详情页带 # 回来时,直接落到对应分区
  useEffect(() => {
    const locate = () => {
      const id = window.location.hash.replace("#", "");
      const index = NAV_ITEMS.findIndex((item) => item.id === id);
      if (index <= 0) return;
      setFocusIndex(index);
      const node = scrollerRef.current?.children[index];
      if (node instanceof HTMLElement) {
        node.scrollIntoView({ behavior: "auto", block: "start" });
      }
    };
    locate();
    window.addEventListener("hashchange", locate);
    return () => window.removeEventListener("hashchange", locate);
  }, []);

  useEffect(() => {
    if (focusIndex !== null && focusIndex === activeIndex) setFocusIndex(null);
  }, [activeIndex, focusIndex]);

  // 滚轮一次手势 = 翻一屏,避免停在两屏之间
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onWheel = (event: WheelEvent) => {
      // 横向滚动交给题库架自己处理
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (Math.abs(event.deltaY) < 3) return;
      event.preventDefault();
      if (wheelLockRef.current) return;
      wheelLockRef.current = true;
      jumpTo(activeIndexRef.current + (event.deltaY > 0 ? 1 : -1));
      window.setTimeout(() => {
        wheelLockRef.current = false;
      }, 650);
    };

    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [jumpTo]);

  // 上下键 / PageUp PageDown / Home End 逐屏切换
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        jumpTo(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        jumpTo(PANEL_COUNT - 1);
        return;
      }
      const step =
        event.key === "ArrowDown" || event.key === "PageDown"
          ? 1
          : event.key === "ArrowUp" || event.key === "PageUp"
            ? -1
            : 0;
      if (!step) return;
      event.preventDefault();
      jumpTo(activeIndex + step);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, jumpTo]);

  // 顶栏与导航轨跟着当前世界换肤
  const activeSkin = useMemo(() => {
    const insideWorld = activeIndex > 0 && activeIndex < PANEL_COUNT - 1;
    return getSkin(insideWorld ? (NAV_ITEMS[activeIndex]?.skin ?? undefined) : undefined);
  }, [activeIndex]);

  const isMounted = (index: number) =>
    Math.abs(index - activeIndex) <= MOUNT_WINDOW || index === focusIndex;

  return (
    <div
      style={skinStyleVars(activeSkin)}
      className="bg-background text-foreground font-pixel relative h-dvh w-full overflow-hidden"
    >
      <div
        ref={scrollerRef}
        className="scrollbar-none h-dvh snap-y snap-mandatory overflow-y-auto overscroll-y-contain"
      >
        <CoverPanel onJump={jumpTo} />

        {SCENARIO_THEMES.map((theme, index) => (
          <ThemePanel
            key={theme.id}
            theme={theme}
            index={index}
            total={THEME_COUNT}
            active={activeIndex === index + 1}
            mounted={isMounted(index + 1)}
          />
        ))}

        <OutroPanel onJump={jumpTo} mounted={isMounted(PANEL_COUNT - 1)} />
      </div>

      <TopBar activeIndex={activeIndex} onJump={jumpTo} />
      <DotRail activeIndex={activeIndex} onJump={jumpTo} />
    </div>
  );
}

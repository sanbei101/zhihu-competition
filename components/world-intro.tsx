"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

const TYPE_INTERVAL_MS = 65;
const HOLD_AFTER_DONE_MS = 1200;

function useTypewriter(text: string, active: boolean) {
  const [length, setLength] = useState(active ? 0 : text.length);

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLength(text.length);
      return;
    }
    setLength(0);
    const timer = window.setInterval(() => {
      setLength((current) => {
        if (current >= text.length) {
          window.clearInterval(timer);
          return current;
        }
        return current + 1;
      });
    }, TYPE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [active, text]);

  return { shown: text.slice(0, length), done: length >= text.length };
}

export function WorldIntro({
  crisis,
  opening,
  onDone,
}: {
  crisis: string;
  opening: string;
  onDone: () => void;
}) {
  // 先挂到 body 再渲染：祖先链上任何 transform/filter 都会劫持 fixed 定位，
  // portal 能保证黑幕相对视口铺满。
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [leaving, setLeaving] = useState(false);
  const title = useTypewriter(crisis, mounted && !leaving);
  const body = useTypewriter(opening, title.done && !leaving);
  const done = title.done && body.done;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setLeaving(true), HOLD_AFTER_DONE_MS);
    return () => window.clearTimeout(timer);
  }, [done]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => doneRef.current(), 500);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-500 ${leaving ? "pointer-events-none opacity-0" : "opacity-100"}`}
      role="dialog"
      aria-label="世界线开场"
    >
      <div className="w-full max-w-2xl space-y-6 px-6">
        <p className="font-mono text-xs tracking-widest text-zinc-500">WORLDLINE // OPENING</p>
        <h2 className="min-h-9 text-2xl leading-snug font-bold text-zinc-100 sm:text-3xl">
          {title.shown}
          {!title.done ? <span className="animate-pulse text-zinc-200">▍</span> : null}
        </h2>
        <p className="min-h-24 text-sm leading-8 text-zinc-400 sm:text-base" aria-live="polite">
          {body.shown}
          {title.done && !body.done ? <span className="animate-pulse text-zinc-200">▍</span> : null}
        </p>
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLeaving(true)}
            className="text-zinc-400"
          >
            跳过
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

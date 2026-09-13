"use client";

import type { CSSProperties } from "react";

import { EmblemSvg, VoiceSvg } from "@/components/worldline/sprites";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import type { WorldlineBeing, WorldlineVoice } from "@/lib/worldline";

/** 舞台上正在说的一句话。key 只用于 React 的挂载/卸载 */
export interface ActiveVoice {
  id: string;
  voice: WorldlineVoice;
  leaving: boolean;
}

/**
 * 舞台上的四股力量。
 *
 * 每枚徽记下面挂一个状态词 —— 玩家不需要读一长串属性,
 * 一眼扫过去就知道这个世界现在谁在熄灯、谁在往上走。
 * 悬停编年史里的某一段时,当年在场的那几枚会被点亮。
 */
function Cast({
  beings,
  litIds,
  skin,
}: {
  beings: readonly WorldlineBeing[];
  litIds: readonly string[];
  skin: ScenarioSkin;
}) {
  return (
    <div className="flex items-end justify-around gap-2.5 px-0.5 max-md:gap-1.5 max-md:px-1">
      {beings.map((being) => {
        const touched = being.touched;
        const lit = litIds.includes(being.id);
        return (
          <button
            key={being.id}
            type="button"
            className={`flex cursor-pointer flex-col items-center gap-[7px] border-0 bg-transparent p-0 text-inherit transition-[translate,filter] duration-[350ms] [transition-timing-function:cubic-bezier(0.2,0.9,0.3,1.1)] max-md:gap-1 ${
              lit ? "-translate-y-[9px] hover:-translate-y-[9px]" : "hover:-translate-y-1.5"
            }`}
            title={being.name}
          >
            <span
              className={`bg-primary -mb-0.5 size-[5px] rotate-45 opacity-0 transition-opacity duration-300 ${touched ? "animate-[blink_1.6s_ease-in-out_infinite] opacity-100" : ""}`}
            />
            <span
              className={`block [filter:drop-shadow(0_7px_0_rgba(0,0,0,0.42))] transition-[filter] duration-[350ms] [&_svg]:max-md:size-11 ${
                lit
                  ? "[filter:drop-shadow(0_7px_0_rgba(0,0,0,0.42))_drop-shadow(0_0_14px_rgba(232,163,61,0.85))_brightness(1.16)]"
                  : ""
              }`}
            >
              <EmblemSvg id={being.id} name={being.name} kind={being.kind} skin={skin} scale={6} />
            </span>
            <span
              className={`border-border text-muted-foreground rounded-[2px] border bg-[rgba(32,22,15,0.72)] px-[7px] py-0.5 text-[11px] leading-[1.5] whitespace-nowrap backdrop-blur-[3px] max-md:px-1 max-md:py-px max-md:text-[9.5px] max-md:leading-[1.25] ${
                lit ? "border-primary text-foreground" : ""
              }`}
            >
              <b className="text-foreground text-[11px] font-semibold max-md:text-[9.5px]">
                {being.name}
              </b>{" "}
              <i className="not-italic opacity-80 max-md:text-[9px] max-md:opacity-85">
                {being.status}
              </i>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * 世界之声。
 *
 * 新事件出现时,舞台上冒出来几个小人和他们的气泡 —— 这是整屏里唯一"有人味"的地方。
 * 站位(at)由 reducer 算好,气泡宽度在 CSS 里限死,两者一起保证气泡永远压不到主体铭牌。
 */
function Voices({ voices, skin }: { voices: readonly ActiveVoice[]; skin: ScenarioSkin }) {
  if (!voices.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      {voices.map((entry, index) => {
        const { voice } = entry;
        const style = {
          left: `${voice.at}%`,
          "--in": `${index * 0.36}s`,
          "--lift": `${voice.lift}px`,
          zIndex: 30 - index,
        } as CSSProperties;

        return (
          <div
            key={entry.id}
            className={`voice flex flex-col items-center gap-1.25 [&>*]:flex-none${
              entry.leaving ? " leaving" : ""
            }`}
            style={style}
          >
            <span className="border-border after:border-border relative max-w-[156px] rounded-[3px] border bg-[rgba(32,22,15,0.9)] px-[9px] py-1.5 text-[11px] leading-[1.7] shadow-[0_10px_22px_-14px_rgba(0,0,0,0.95)] backdrop-blur-[4px] after:absolute after:-bottom-[5px] after:left-1/2 after:-ml-1 after:size-2 after:rotate-45 after:border-r after:border-b after:bg-inherit max-md:max-w-[min(180px,52vw)] max-md:px-2 max-md:py-1">
              <b className="text-primary mb-0.5 block font-mono text-[9px] font-normal tracking-[0.12em]">
                {voice.name}
              </b>
              {voice.line}
            </span>
            <span className="block [filter:drop-shadow(0_5px_0_rgba(0,0,0,0.42))]">
              <VoiceSvg
                archetype={voice.key}
                skin={skin}
                shift={voice.shift}
                scale={voice.scale}
                label={voice.name}
              />
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 左半屏:世界本身。
 *
 * 三层从下往上叠:天幕(由 StageBackdrop 负责) → 世界区(前提 + 四股力量) → 世界之声。
 * .world 必须铺满整个舞台,否则主体落不到地平线上 —— 这一条在原型里踩过。
 */
export function WorldArea({
  statement,
  domains,
  beings,
  litIds,
  eraNo,
  eraAt,
  voices,
  skin,
  loading,
}: {
  statement: string;
  domains: readonly string[];
  beings: readonly WorldlineBeing[];
  litIds: readonly string[];
  eraNo: number;
  eraAt: string;
  voices: readonly ActiveVoice[];
  skin: ScenarioSkin;
  loading: boolean;
}) {
  return (
    <>
      <Voices voices={voices} skin={skin} />

      <div className="absolute inset-0 z-[3] flex min-h-0 min-w-0 flex-col justify-between px-[18px] pt-4 pb-(--ground) max-md:px-3 max-md:pt-3">
        <div>
          <p className="text-primary font-mono text-[10px] tracking-[0.2em] uppercase opacity-[0.85] max-md:text-[9px]">
            反事实世界线
          </p>
          <p className="mt-1.5 max-w-[34ch] text-[17px] leading-[1.5] font-semibold [text-shadow:0_2px_14px_rgba(0,0,0,0.8)] max-md:line-clamp-2 max-md:max-w-[62%] max-md:text-[13px] max-md:leading-[1.4] min-[769px]:max-[1000px]:max-w-[58%] min-[769px]:max-[1000px]:text-[15px]">
            {statement}
          </p>
          <div className="mt-[9px] flex flex-wrap gap-2 max-md:mt-1.5 max-md:gap-1 [&_.chip]:max-md:px-1.5 [&_.chip]:max-md:py-0.5 [&_.chip]:max-md:text-[9.5px]">
            {domains.map((domain) => (
              <span key={domain} className="chip">
                {domain}
              </span>
            ))}
            {loading ? (
              <span className="chip">世界正在铺开…</span>
            ) : (
              <span className="chip">主线 · 未曾分叉</span>
            )}
          </div>
        </div>

        <Cast beings={beings} litIds={litIds} skin={skin} />
      </div>

      <div className="absolute top-4 right-[18px] text-right [text-shadow:0_2px_12px_rgba(0,0,0,0.85)] max-md:top-2.5 max-md:right-3 min-[769px]:max-[1000px]:top-3 min-[769px]:max-[1000px]:right-3.5">
        <p className="text-primary font-mono text-[30px] leading-none tracking-[0.02em] max-md:text-[18px] min-[769px]:max-[1000px]:text-[22px]">
          纪元 {eraNo}
        </p>
        <p className="text-muted-foreground mt-1.5 font-mono text-[11px] max-md:mt-0.5 max-md:text-[10px]">
          {eraAt}
        </p>
      </div>
    </>
  );
}

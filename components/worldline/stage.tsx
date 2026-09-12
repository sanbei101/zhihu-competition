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
    <div className="cast">
      {beings.map((being) => {
        const classes = ["being"];
        if (being.touched) classes.push("touched");
        if (litIds.includes(being.id)) classes.push("lit");
        return (
          <button key={being.id} type="button" className={classes.join(" ")} title={being.name}>
            <span className="spark" />
            <span className="emblem">
              <EmblemSvg id={being.id} name={being.name} kind={being.kind} skin={skin} scale={6} />
            </span>
            <span className="plate">
              <b>{being.name}</b> <i>{being.status}</i>
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
    <div className="voices">
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
            className={`voice talking${entry.leaving ? " leaving" : ""}`}
            style={style}
          >
            <span className="say">
              <b>{voice.name}</b>
              {voice.line}
            </span>
            <span className="fig">
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

      <div className="world">
        <div className="premise">
          <p className="kicker">反事实世界线</p>
          <p className="statement">{statement}</p>
          <div className="meta">
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

      <div className="clock">
        <p className="clk-era">纪元 {eraNo}</p>
        <p className="at">{eraAt}</p>
      </div>
    </>
  );
}

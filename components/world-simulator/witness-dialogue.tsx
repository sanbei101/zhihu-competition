"use client";

import { useEffect, useState } from "react";

import { WitnessFigure } from "@/components/pixel/witness-figure";
import { Card, CardContent } from "@/components/ui/card";
import TextType from "@/components/ui/TextType";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import type { WitnessArchetype, WitnessLine } from "@/lib/world-sim";

/**
 * 卡牌旁边那个人,和他头顶的那句气泡。
 *
 * 它是整个界面里唯一的"温度来源":世界模型与裁决器都必须冷静,
 * 只有它可以有立场、有情绪、说人话。
 *
 * 说话时会点头(动画切到更快的节奏),说完恢复静息 ——
 * 这比一个常驻循环动画更能让人感觉到"他是在对我说话"。
 */
export function WitnessDialogue({
  skin,
  archetype,
  line,
}: {
  skin: ScenarioSkin;
  archetype: WitnessArchetype;
  line: WitnessLine | null;
}) {
  const speaker = line?.speaker ?? "";
  const text = line?.line ?? "";
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!text) return;
    setSpeaking(true);
    // 打完这句话大约需要 text.length * 45ms,再留一点余量
    const timer = setTimeout(() => setSpeaking(false), Math.min(4200, 700 + text.length * 48));
    return () => clearTimeout(timer);
  }, [text]);

  return (
    <aside className="flex w-full shrink-0 flex-col items-center gap-3 lg:w-52">
      <Card className="w-full shadow-none">
        <CardContent className="p-3">
          <p className="text-muted-foreground font-mono text-[10px] tracking-wider">
            {speaker || "见证者"}
          </p>
          <div className="mt-1.5 min-h-14 text-xs leading-6">
            {text ? (
              <TextType
                key={text}
                text={text}
                as="p"
                loop={false}
                typingSpeed={45}
                initialDelay={220}
                showCursor
                cursorCharacter="▌"
                className="text-xs leading-6"
              />
            ) : (
              <span className="text-muted-foreground">……</span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-end justify-center pb-1">
        <WitnessFigure
          archetype={archetype}
          skin={skin}
          label={speaker || "见证者"}
          speaking={speaking}
          scale={5}
          className="hidden sm:block"
        />
      </div>
    </aside>
  );
}

"use client";

import { FastForward, Gavel, Swords } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { PixelSprite } from "@/components/pixel/pixel-sprite";
import { directorEmblem, portraitFor, type PortraitSubject } from "@/components/pixel/portraits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TypingCaret,
  stanceLabels,
  stanceStyles,
  useTypewriter,
} from "@/components/world-council/messages";
import type { ScenarioSkin } from "@/lib/scenario-skin";
import { type AgentReaction } from "@/lib/world-turn";

/** 台词说完到换人之间的停顿,留一口气,不然像在赶场 */
const HANDOVER_PAUSE_MS = 520;

export type StagePhase = "idle" | "performing" | "waiting" | "judging";

export interface StageBeat {
  /** 每一拍唯一:换了这一拍,立绘与气泡都要重来 */
  key: string;
  /** 说话的角色。导演不是人,他那一拍没有 speaker —— 只有 directorName */
  speaker?: PortraitSubject;
  /** 导演登场:舞台上出徽记,标题用这个称呼 */
  directorName?: string;
  /** 他当场说的话 */
  speech: string;
  variant: "opening" | "decision" | "reaction" | "retort";
  /** 开场那几条的由头,如「公开表态」 */
  label?: string;
  stance?: AgentReaction["stance"];
  /** 第二轮交锋:站在他对面的人。有值就是两人同框 */
  against?: PortraitSubject;
  /** 行动的三个要素,在这里拼成一句旁白,不再当成三个字段摆出来 */
  action?: string;
  target?: string;
  impact?: string;
}

/**
 * 把「做了什么 / 冲着谁 / 后果」拼成一句旁白。
 * 这三个字段是数据,不是文案;直接摆成带标签的三行会像表单、把人从戏里拽出来,
 * 合成「他做了什么,冲着谁;结果如何」才像史笔。
 */
export function actionNoteOf(beat: StageBeat): string {
  const clean = (value?: string) => value?.trim().replace(/[。;；、,]+$/, "") ?? "";
  const parts = [
    clean(beat.action),
    beat.target ? `冲着${clean(beat.target)}` : "",
    clean(beat.impact),
  ].filter(Boolean);
  return parts.length ? `${parts.join("。")}。` : "";
}

/** 台上的一张立绘(或导演的徽记)。闲置缓慢呼吸,说话时加快;对面那个人压暗一档把视线让出来。 */
function StageFigure({
  skin,
  subject,
  talking,
  dimmed,
  scale,
}: {
  skin: ScenarioSkin;
  /** null = 导演:他不是人,出徽记 */
  subject: PortraitSubject | null;
  talking: boolean;
  dimmed?: boolean;
  scale: number;
}) {
  const art = useMemo(
    () => (subject ? portraitFor(subject, skin) : directorEmblem(skin)),
    [subject, skin],
  );

  return (
    <div className={dimmed ? "opacity-45" : undefined}>
      <div
        className={
          talking
            ? "animate-portrait-talk motion-reduce:animate-none"
            : "animate-portrait-idle motion-reduce:animate-none"
        }
      >
        <div className="origin-bottom scale-[0.72] sm:scale-100">
          <PixelSprite frames={art.frames} palette={art.palette} scale={scale} label={art.label} />
        </div>
      </div>
    </div>
  );
}

interface SpeechStageProps {
  skin: ScenarioSkin;
  /** 这一拍在演的;null 表示台上没人 */
  beat: StageBeat | null;
  /** 空场时站在台上的玩家,免得舞台空着 */
  player: PortraitSubject;
  phase: StagePhase;
  /** 空场时气泡里说什么 */
  idleHint?: string;
  onBeatDone: () => void;
  onSkip: () => void;
}

export function SpeechStage({
  skin,
  beat,
  player,
  phase,
  idleHint,
  onBeatDone,
  onSkip,
}: SpeechStageProps) {
  const speaking = phase === "performing" && Boolean(beat);
  const { typed, isTyping, done } = useTypewriter(beat?.speech ?? "", speaking);

  // 说完自动换人。回调用 ref 兜住,免得父组件重渲染时把计时器清掉后不再补上。
  const doneRef = useRef<string | null>(null);
  const onBeatDoneRef = useRef(onBeatDone);
  onBeatDoneRef.current = onBeatDone;

  useEffect(() => {
    if (!beat || !done) return;
    if (doneRef.current === beat.key) return;
    doneRef.current = beat.key;
    const timer = window.setTimeout(() => onBeatDoneRef.current(), HANDOVER_PAUSE_MS);
    return () => {
      window.clearTimeout(timer);
      // StrictMode 会把 effect 跑两遍:清理时撤回标记,第二次才重新计时
      if (doneRef.current === beat.key) doneRef.current = null;
    };
  }, [beat, done]);

  const figureName = beat ? (beat.speaker?.name ?? beat.directorName ?? "") : player.name;
  const figureIdentity = beat?.speaker?.identity;
  const stance = beat?.stance ? stanceStyles[beat.stance] : null;
  const note = beat ? actionNoteOf(beat) : "";
  /** beat 有 speaker 就是角色,没有就是导演 */
  const figureSubject = beat ? (beat.speaker ?? null) : player;

  const bubbleTone =
    beat?.variant === "decision"
      ? "border-l-primary bg-muted/60"
      : stance
        ? `${stance.bubble} border-border`
        : "border-l-border bg-muted/50";

  return (
    <section className="bg-card relative overflow-hidden rounded-lg border" aria-label="议事舞台">
      <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
        <span className="text-sm font-medium">{figureName}</span>
        {beat && figureIdentity ? (
          <span className="text-muted-foreground text-xs">{figureIdentity}</span>
        ) : null}
        {beat?.variant === "opening" && beat.label ? (
          <Badge variant="outline">{beat.label}</Badge>
        ) : null}
        {beat?.variant === "decision" ? <Badge variant="secondary">你的抉择</Badge> : null}
        {beat?.stance && stance ? (
          <Badge variant="outline" className={stance.badge}>
            {stanceLabels[beat.stance]}
          </Badge>
        ) : null}
        {beat?.against ? (
          <span className="text-destructive/90 flex items-center gap-1 text-xs">
            <Swords className="size-3" />
            当场回击 {beat.against.name}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {phase === "judging" ? (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <Gavel className="size-3.5" />
              史官正在裁决
            </span>
          ) : null}
          {phase === "waiting" ? (
            <span className="text-muted-foreground animate-pulse text-xs">下一位…</span>
          ) : null}
          {phase === "performing" || phase === "waiting" ? (
            <Button variant="ghost" size="sm" onClick={onSkip}>
              <FastForward data-icon="inline-start" />
              跳过演出
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 px-5 py-5">
        <div
          className={`min-h-18 w-full max-w-2xl rounded-lg border border-l-4 px-4 py-3 leading-7 ${bubbleTone}`}
          aria-hidden="true"
        >
          {beat ? (
            <>
              {typed}
              <TypingCaret visible={isTyping} />
            </>
          ) : (
            <span className="text-muted-foreground">{idleHint ?? "该你下令了。"}</span>
          )}
        </div>
        {beat ? <span className="sr-only">{beat.speech}</span> : null}

        <div
          key={beat?.key ?? "idle"}
          className="animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
        >
          {beat?.against && beat.speaker ? (
            <div className="flex items-end justify-center gap-3 sm:gap-10">
              <div className="flex flex-col items-center gap-2">
                <StageFigure skin={skin} subject={beat.speaker} talking={isTyping} scale={5} />
                <span className="text-primary text-xs font-medium">{beat.speaker.name}</span>
              </div>
              <span className="text-destructive/80 flex flex-col items-center gap-1 self-center text-xs">
                <Swords className="size-4" />
                对峙
              </span>
              <div className="flex flex-col items-center gap-2">
                <StageFigure skin={skin} subject={beat.against} talking={false} dimmed scale={5} />
                <span className="text-muted-foreground text-xs">{beat.against.name}</span>
              </div>
            </div>
          ) : (
            <StageFigure skin={skin} subject={figureSubject} talking={isTyping} scale={6} />
          )}
        </div>

        {note ? (
          <p className="text-muted-foreground w-full border-t pt-3 text-center text-xs leading-6">
            {note}
          </p>
        ) : null}
      </div>
    </section>
  );
}

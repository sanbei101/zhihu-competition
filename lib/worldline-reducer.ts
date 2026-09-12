import type { ScenarioProfile } from "@/lib/scenario-profiles";
import {
  witnessArchetypeFor,
  type WorldlineBeing,
  type WorldlineEvent,
  type WorldlineReaction,
  type WorldlineSeed,
  type WorldlineSegment,
  type WorldlineSession,
  type WorldlineVoice,
} from "@/lib/worldline";
import type {
  ReactionGeneration,
  SeedGeneration,
  VoiceDraft,
  WaveGeneration,
} from "@/lib/worldline-events";

/**
 * 确定性限制的唯一落点。
 *
 * 一条纪律:凡是模型可能"写歪"的东西 —— 数值范围、列表长度、站位坐标 ——
 * 一律在这里钳制,而不是在 zod 里报错。校验层只保证形状,范围由这里保证。
 * 这样做的好处是同一份模型输出永远得到同一个世界,且一份好推演不会被
 * "多写了一条"这种小事毁掉。
 */

/** 展示预算。原型一屏正好四股力量、一组最多三个小人、一件事最多三条反应 */
export const DISPLAY = {
  beings: 4,
  voices: 3,
  reactions: 3,
} as const;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function take<T>(items: readonly T[], limit: number): T[] {
  return items.slice(0, limit);
}

/** 只保留存在于主体清单里的 id,顺带去重 */
function keepKnownIds(ids: readonly string[], known: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (known.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * 舞台台词的站位。
 *
 * 交给模型一定会有两个小人叠在一起、气泡压住主体铭牌 —— 原型期真实踩过。
 * 所以站位是算出来的:一组 n 个人,均匀落在主体徽记之间的空档上
 * (徽记中心约在 13.7% / 37.9% / 62.1% / 86.3%,空档就在 26% / 50% / 74%)。
 */
function voiceSlots(index: number, total: number): { at: number; lift: number; scale: number } {
  const at = total <= 1 ? 50 : 26 + (index * 48) / (total - 1);
  const lifts = [0, 8, 14, 18];
  return { at, lift: lifts[index] ?? 18, scale: 2 };
}

function normalizeVoices(drafts: readonly VoiceDraft[]): WorldlineVoice[] {
  const kept = take(drafts, DISPLAY.voices);
  return kept.map((voice, index) => {
    const slot = voiceSlots(index, kept.length);
    const scale = clamp(voice.scale ?? slot.scale, 2, 3);
    return {
      key: voice.key,
      // shift 只用 0/1/2 —— 超出的话色板会退化成同一个人
      shift: clamp((voice.shift ?? index) as number, 0, 2),
      // at 以算出来的站位为准;模型给了也只当作参考,不采用
      at: slot.at,
      scale,
      lift: clamp(voice.lift ?? slot.lift, 0, 24),
      name: voice.name.trim(),
      line: voice.line.trim(),
    };
  });
}

// ==================== 种子 ====================

/**
 * 种子的落库形态。
 *
 * 主体数量裁到四股力量 —— 舞台高度是固定的,第五枚徽记会让这一排挤成一团。
 * 裁掉的不是"不存在",只是不站上台;它们仍然可能出现在编年史与反应里。
 */
export function normalizeSeed(input: {
  generation: SeedGeneration;
  scenarioId: string;
  scenarioTitle: string;
  scenarioUrl: string;
  themeId: string;
  profile: ScenarioProfile;
}): WorldlineSeed {
  const { generation } = input;

  const beings: WorldlineBeing[] = take(generation.beings, DISPLAY.beings).map((being, index) => ({
    id: being.id,
    name: being.name.trim(),
    kind: being.kind,
    status: being.status.trim(),
    // 开局所有主体都算"被卷入过":这张牌桌一上来就是活的
    touched: index < DISPLAY.beings,
  }));

  const known = new Set(beings.map((being) => being.id));

  const opening: WorldlineSegment[] = generation.opening.map((segment) => ({
    kind: "event" as const,
    at: segment.at.trim(),
    headline: segment.headline.trim(),
    aftermath: segment.aftermath.trim(),
    involves: keepKnownIds(segment.involves, known),
    voices: normalizeVoices(segment.voices),
    ...(segment.mark ? { mark: segment.mark } : {}),
  }));

  return {
    scenarioId: input.scenarioId,
    scenarioTitle: input.scenarioTitle,
    scenarioUrl: input.scenarioUrl,
    themeId: input.themeId,
    premise: {
      statement: generation.premise.statement.trim(),
      divergencePoint: generation.premise.divergencePoint.trim(),
      domains: take(generation.premise.domains, 2),
    },
    scaleLabel: generation.scaleLabel.trim(),
    witnessName: generation.witnessName.trim(),
    witnessRole: generation.witnessRole.trim(),
    witnessArchetype: witnessArchetypeFor(input.themeId),
    beings,
    opening,
  };
}

/** 开局那一波事件:种子只负责把世界摆好,第一波仍然要单独生成 */
export function createSession(seed: WorldlineSeed): WorldlineSession {
  return {
    version: 1,
    scenarioId: seed.scenarioId,
    scenarioTitle: seed.scenarioTitle,
    scenarioUrl: seed.scenarioUrl,
    themeId: seed.themeId,
    seed,
    // 编年史从开局那几段开始 —— 世界不是从零起步的
    timeline: seed.opening.map((segment) => ({ ...segment })),
    waves: [],
    played: [],
  };
}

// ==================== 波次 ====================

export function normalizeWave(input: {
  generation: WaveGeneration;
  index: number;
  known: ReadonlySet<string>;
}): WorldlineEvent[] {
  return take(input.generation.events, 5).map((event, index) => ({
    id: `w${input.index}-e${index}`,
    tone: event.tone,
    at: event.at.trim(),
    involves: keepKnownIds(event.involves, input.known),
    title: event.title.trim(),
    reactions: [],
  }));
}

/**
 * 世界对一件事的反应。
 *
 * 主体由模型自己挑 —— "哪个力量会为这件事动"正是这里最要紧的判断。
 * 但服务端只认清单里存在的 id:模型发明出来的主体就地丢掉,
 * 让它整份作废是过度的,让它凭空多出一个主体更糟。
 */
export function normalizeReactions(input: {
  generation: ReactionGeneration;
  known: ReadonlySet<string>;
}): WorldlineReaction[] {
  const out: WorldlineReaction[] = [];
  for (const reaction of input.generation.reactions) {
    if (!input.known.has(reaction.byEntityId)) continue;
    if (out.length >= DISPLAY.reactions) break;
    out.push({
      by: reaction.byEntityId,
      delay: reaction.delay.trim(),
      text: reaction.text.trim(),
      voices: normalizeVoices(reaction.voices),
    });
  }
  return out;
}

// ==================== 编年史 ====================

/** 事件段:世界线上记下"发生了这件事" */
export function eventSegment(event: WorldlineEvent): WorldlineSegment {
  return {
    kind: "event",
    at: event.at,
    headline: event.title,
    aftermath: "",
    involves: event.involves,
    voices: [],
  };
}

/** 反应段:某个主体对某件事的回应,可以滞后很多年 */
export function reactionSegment(
  event: WorldlineEvent,
  reaction: WorldlineReaction,
): WorldlineSegment {
  return {
    kind: "react",
    at: reaction.delay,
    headline: reaction.text,
    aftermath: `回应「${event.title}」`,
    involves: [reaction.by],
    voices: reaction.voices,
  };
}

/**
 * 把新发的一波接在会话末尾。
 *
 * 波次下标永远等于接之前的 waves.length —— 不存 waveIndex,就没有对不上的可能。
 * replaceIndex 用于"上一波中途失败,原地重发"的情况。
 */
export function applyWave(input: {
  session: WorldlineSession;
  wave: WorldlineEvent[];
  replaceIndex?: number;
}): { session: WorldlineSession; wave: WorldlineEvent[] } {
  const waves = [...input.session.waves];
  if (input.replaceIndex !== undefined && input.replaceIndex < waves.length) {
    waves[input.replaceIndex] = input.wave;
  } else {
    waves.push(input.wave);
  }
  return { wave: input.wave, session: { ...input.session, waves } };
}

/** 把反应挂到事件上。并行调用回来一个挂一个 */
export function attachReactions(
  wave: readonly WorldlineEvent[],
  eventId: string,
  reactions: readonly WorldlineReaction[],
): WorldlineEvent[] {
  return wave.map((event) =>
    event.id === eventId ? { ...event, reactions: [...reactions] } : event,
  );
}

export function playedKey(waveIndex: number, eventIndex: number) {
  return `${waveIndex}:${eventIndex}`;
}

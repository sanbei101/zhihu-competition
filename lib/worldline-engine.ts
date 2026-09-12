import { generateStructured } from "@/lib/deepseek";
import {
  REACTION_INSTRUCTIONS,
  SEED_INSTRUCTIONS,
  WAVE_INSTRUCTIONS,
  buildReactionPrompt,
  buildSeedPrompt,
  buildWavePrompt,
} from "@/lib/prompts";
import { getScenarioProfile } from "@/lib/scenario-profiles";
import type {
  WorldlineEvent,
  WorldlineReaction,
  WorldlineSeed,
  WorldlineSession,
} from "@/lib/worldline";
import {
  reactionGenerationSchema,
  seedGenerationSchema,
  waveGenerationSchema,
  type WorldlineSeedEvent,
  type WorldlineWaveEvent,
} from "@/lib/worldline-events";
import {
  applyWave,
  normalizeReactions,
  normalizeSeed,
  normalizeWave,
} from "@/lib/worldline-reducer";

/**
 * 世界线推演的引擎。
 *
 * 这一层不关心传输方式:API 路由 for await 把事件推给客户端,别的调用方
 * 也可以只取最终结果。它只负责三件事:
 *
 *   1. generateSeedStream  一次调用把世界摆好 —— 前提、四股力量、开局编年
 *   2. generateWaveStream  一次调用摆出五件大事,再为**每一件事**并行开一次调用
 *                          演世界的反应。并行的那一步是整局里唯一真正的多智能体:
 *                          五件事各有各的分支,彼此不可见,冲突由此自然产生。
 *
 * 一条贯穿始终的纪律:部分失败不该毁掉整波。某件事的反应生成失败,
 * 就当作"世界还没为它动" —— 真实世界里也确实有大事落下之后很久没有回音。
 */

// ==================== 世界种子 ====================

export interface SeedContext {
  scenarioId: string;
  scenarioTitle: string;
  scenarioUrl: string;
  themeId: string;
}

export async function generateSeed(
  context: SeedContext,
  signal?: AbortSignal,
): Promise<WorldlineSeed> {
  const profile = getScenarioProfile(context.themeId);

  const result = await generateStructured({
    instructions: SEED_INSTRUCTIONS,
    prompt: buildSeedPrompt({
      scenarioId: context.scenarioId,
      title: context.scenarioTitle,
      profile,
    }),
    schema: seedGenerationSchema,
    // 种子要稳:这里不要创意,要的是合乎条件的世界
    temperature: 0.7,
    // 一次要吐 4 股力量 + 4 段开局编年,每段还带台词。
    // 预算卡太紧会截断成不合法 JSON,而截断的代价是整次调用白烧。
    maxOutputTokens: 7000,
    abortSignal: signal,
  });

  return normalizeSeed({
    generation: seedGenerationSchema.parse(result),
    scenarioId: context.scenarioId,
    scenarioTitle: context.scenarioTitle,
    scenarioUrl: context.scenarioUrl,
    themeId: context.themeId,
    profile,
  });
}

/** 种子的流式版本:逐块长出来,客户端据此让世界一段一段亮起 */
export async function* generateSeedStream(
  context: SeedContext,
  signal?: AbortSignal,
): AsyncGenerator<WorldlineSeedEvent> {
  yield { type: "seed-start", themeId: context.themeId };

  let seed: WorldlineSeed;
  try {
    seed = await generateSeed(context, signal);
  } catch (error) {
    console.error("世界线种子生成失败", error);
    yield {
      type: "error",
      error: {
        code: "UPSTREAM_FAILURE",
        message: "世界构建失败,请重试",
        retryable: true,
      },
    };
    return;
  }

  yield { type: "seed-premise", premise: seed.premise, scaleLabel: seed.scaleLabel };
  yield { type: "seed-witness", witnessName: seed.witnessName, witnessRole: seed.witnessRole };
  for (const being of seed.beings) yield { type: "seed-being", being };
  for (const segment of seed.opening) yield { type: "seed-segment", segment };
  yield { type: "seed-complete", seed };
}

// ==================== 事件波次 ====================

/** 按完成先后吐出一个 promise 数组的结果。用来让"谁先想完谁先上场"成立 */
async function* asCompleted<T>(tasks: readonly Promise<T>[]): AsyncGenerator<T> {
  const settled = tasks.map((task) =>
    task.then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const }),
    ),
  );
  const inflight = new Set(settled.map((_, index) => index));

  while (inflight.size > 0) {
    // 这几个 await 是串行等待,但任务本身是并行的 —— 要的正是"谁先想完谁先上场"
    // eslint-disable-next-line no-await-in-loop -- 竞速取先完成的那个,不能合并成 Promise.all
    const index = await Promise.race([...inflight].map((i) => settled[i].then(() => i)));
    inflight.delete(index);
    // eslint-disable-next-line no-await-in-loop -- 上面已经确定它完成了,这一 await 立即返回
    const result = await settled[index];
    if (result.ok) yield result.value;
  }
}

/**
 * 世界对一件事的反应。一次独立调用。
 *
 * 只喂给这次调用"这件事 + 力量清单 + 世界前提",不喂别的事件的反应 ——
 * 彼此看不见,才谈得上各自盘算。
 */
async function generateReactions(input: {
  session: WorldlineSession;
  event: WorldlineEvent;
  signal?: AbortSignal;
}): Promise<WorldlineReaction[]> {
  const { session, event } = input;

  try {
    const result = await generateStructured({
      instructions: REACTION_INSTRUCTIONS,
      prompt: buildReactionPrompt({
        seed: session.seed,
        beings: session.seed.beings,
        event,
      }),
      schema: reactionGenerationSchema,
      temperature: 0.9,
      maxOutputTokens: 1800,
      abortSignal: input.signal,
    });

    return normalizeReactions({
      generation: reactionGenerationSchema.parse(result),
      known: new Set(session.seed.beings.map((being) => being.id)),
    });
  } catch (error) {
    if (input.signal?.aborted) return [];
    console.error(`事件「${event.title}」的反应生成失败`, error);
    return [];
  }
}

/**
 * 发一波。
 *
 * 事件顺序:
 *   wave-start → wave-event ×N → wave-reactions ×N → wave-complete
 *
 * 五件事先一次性摆出来(它们必须出自同一次调用,才谈得上彼此不重复),
 * 随后世界对每一件的反应**并行开跑**,谁先想完谁先回来。
 */
export async function* generateWaveStream(input: {
  session: WorldlineSession;
  replaceIndex?: number;
  signal?: AbortSignal;
}): AsyncGenerator<WorldlineWaveEvent> {
  const { session } = input;
  const index = input.replaceIndex ?? session.waves.length;

  yield { type: "wave-start", index };

  let events: WorldlineEvent[];
  try {
    const result = await generateStructured({
      instructions: WAVE_INSTRUCTIONS,
      prompt: buildWavePrompt({ session, index }),
      schema: waveGenerationSchema,
      temperature: 0.85,
      // 五件大事,每件都要有具体的规模与后果 —— 给到 3500 才不会写一半被截断
      maxOutputTokens: 3500,
      abortSignal: input.signal,
    });

    events = normalizeWave({
      generation: waveGenerationSchema.parse(result),
      index,
      known: new Set(session.seed.beings.map((being) => being.id)),
    });
  } catch (error) {
    if (input.signal?.aborted) return;
    console.error("事件波次生成失败", error);
    yield {
      type: "error",
      error: { code: "UPSTREAM_FAILURE", message: "这一波事件没能生成,请重试", retryable: true },
    };
    return;
  }

  if (!events.length) {
    yield {
      type: "error",
      error: {
        code: "UPSTREAM_FAILURE",
        message: "这一波没有产出任何事件,请重试",
        retryable: true,
      },
    };
    return;
  }

  for (const event of events) {
    if (input.signal?.aborted) return;
    yield { type: "wave-event", event };
  }

  const tasks = events.map(async (event): Promise<WorldlineWaveEvent> => ({
    type: "wave-reactions",
    eventId: event.id,
    reactions: await generateReactions({
      session,
      event,
      ...(input.signal ? { signal: input.signal } : {}),
    }),
  }));

  for await (const payload of asCompleted(tasks)) {
    if (input.signal?.aborted) return;
    yield payload;
  }

  yield { type: "wave-complete", waveIndex: index };
}

/**
 * 把一波推到底,返回新的会话 + 这一波。
 * 给 Server Action / 测试用 —— 路由走的是流式那一版。
 */
export async function generateWaveOnce(input: {
  session: WorldlineSession;
  replaceIndex?: number;
  signal?: AbortSignal;
}): Promise<{ session: WorldlineSession; wave: WorldlineEvent[] }> {
  const wave: WorldlineEvent[] = [];
  let lastError = "";

  for await (const payload of generateWaveStream(input)) {
    switch (payload.type) {
      case "wave-event":
        wave.push(payload.event);
        break;
      case "wave-reactions":
        wave.forEach((event, index) => {
          if (event.id === payload.eventId) {
            wave[index] = { ...event, reactions: payload.reactions };
          }
        });
        break;
      case "error":
        lastError = payload.error.message;
        break;
      default:
        break;
    }
  }

  if (!wave.length) throw new Error(lastError || "这一波推演没能完成");

  return applyWave({
    session: input.session,
    wave,
    ...(input.replaceIndex !== undefined ? { replaceIndex: input.replaceIndex } : {}),
  });
}

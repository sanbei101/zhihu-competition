import { worldSimStorageKey, type WorldSimSession } from "@/lib/world-sim";
import { worldSimSessionSchema } from "@/lib/world-sim-events";

/**
 * 世界线存档,key 是 `world-sim:${scenarioId}`,只存在于浏览器本地。
 *
 * 读到存档后要做一次完整 schema 校验才认它 —— 字段增删或模型换代之后,
 * 旧存档会自然失效并触发重建世界,而不是让页面在半截数据上崩掉。
 */

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export interface StoredSession {
  session: WorldSimSession;
  savedAt: number;
}

export function loadWorldSimSession(scenarioId: string): StoredSession | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(worldSimStorageKey(scenarioId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { savedAt, session } = parsed as { savedAt?: unknown; session?: unknown };
    const result = worldSimSessionSchema.safeParse(session);
    if (!result.success || typeof savedAt !== "number") return null;
    return { session: result.data, savedAt };
  } catch {
    return null;
  }
}

export function saveWorldSimSession(scenarioId: string, session: WorldSimSession): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(worldSimStorageKey(scenarioId), JSON.stringify({ savedAt: Date.now(), session }));
  } catch {
    // 配额不足时静默忽略:下一次推进还会再写一次
  }
}

export function clearWorldSimSession(scenarioId: string): void {
  try {
    storage()?.removeItem(worldSimStorageKey(scenarioId));
  } catch {
    // 静默忽略
  }
}

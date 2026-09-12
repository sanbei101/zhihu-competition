import { worldlineStorageKey, type WorldlineSession } from "@/lib/worldline";
import { worldlineSessionSchema } from "@/lib/worldline-events";

/**
 * 世界线存档,key 是 `worldline:${scenarioId}`,只存在于浏览器本地。
 *
 * 读到存档后要做完整 schema 校验才认它 —— 字段增删或模型换代之后,
 * 旧存档会自然失效并触发重建世界,而不是让页面在半截数据上崩掉。
 */

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export interface StoredWorldline {
  session: WorldlineSession;
  savedAt: number;
}

export function loadWorldline(scenarioId: string): StoredWorldline | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(worldlineStorageKey(scenarioId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { savedAt, session } = parsed as { savedAt?: unknown; session?: unknown };
    const result = worldlineSessionSchema.safeParse(session);
    if (!result.success || typeof savedAt !== "number") return null;
    return { session: result.data as WorldlineSession, savedAt };
  } catch {
    return null;
  }
}

export function saveWorldline(scenarioId: string, session: WorldlineSession): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(
      worldlineStorageKey(scenarioId),
      JSON.stringify({ savedAt: Date.now(), session }),
    );
  } catch {
    // 配额不足时静默忽略:下一次推进还会再写一次
  }
}

export function clearWorldline(scenarioId: string): void {
  try {
    storage()?.removeItem(worldlineStorageKey(scenarioId));
  } catch {
    // 静默忽略
  }
}

import { worldCastSchema, type WorldCast } from "@/lib/world-cast";

function storage(): Storage | null {
  // ponytail: 单次特性检测即可，三处 canUseStorage 重复分支合并于此
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** 读取本地缓存的阵容（刷新页面不丢）。 */
export function loadCachedCast(scenarioId: string): { cast: WorldCast; savedAt: number } | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(`world-cast-cache:${scenarioId}`);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { savedAt, cast } = parsed as { savedAt?: unknown; cast?: unknown };
    const castResult = worldCastSchema.safeParse(cast);
    if (!castResult.success || typeof savedAt !== "number") return null;
    return { cast: castResult.data, savedAt };
  } catch {
    return null;
  }
}

/** 生成成功后写入本地缓存。 */
export function saveCachedCast(scenarioId: string, cast: WorldCast): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(`world-cast-cache:${scenarioId}`, JSON.stringify({ savedAt: Date.now(), cast }));
  } catch {
    // 配额不足等情况静默忽略
  }
}

/** 清除本地缓存的阵容。 */
export function clearCachedCast(scenarioId: string): void {
  try {
    storage()?.removeItem(`world-cast-cache:${scenarioId}`);
  } catch {
    // 静默忽略
  }
}

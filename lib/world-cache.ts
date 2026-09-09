import { worldCastSchema, type WorldCast } from "@/lib/world-cast";

const CAST_CACHE_PREFIX = "world-cast-cache:";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** 读取本地缓存的阵容（刷新页面不丢）。 */
export function loadCachedCast(scenarioId: string): { cast: WorldCast; savedAt: number } | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(`${CAST_CACHE_PREFIX}${scenarioId}`);
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
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(
      `${CAST_CACHE_PREFIX}${scenarioId}`,
      JSON.stringify({ savedAt: Date.now(), cast }),
    );
  } catch {
    // 配额不足等情况静默忽略
  }
}

/** 清除本地缓存的阵容。 */
export function clearCachedCast(scenarioId: string): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(`${CAST_CACHE_PREFIX}${scenarioId}`);
  } catch {
    // 静默忽略
  }
}

/**
 * Safe web-storage primitives.
 *
 * localStorage when available (browser), otherwise an in-memory fallback so the
 * same code paths work in private-mode browsers, Node smoke tests and SSR.
 * Writes that exceed quota never throw — they report false and the caller
 * simply keeps relying on the in-memory cache.
 */

const PREFIX = 'anilist-discovery:v1:';

/** In-memory stand-in used when localStorage is unavailable. */
const memoryStore = new Map<string, string>();

function getLocalStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

const local: Storage | null = getLocalStorage();

export function lsGet<T>(key: string): T | null {
  try {
    const raw = local ? local.getItem(PREFIX + key) : (memoryStore.get(PREFIX + key) ?? null);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function lsSet(key: string, value: unknown): boolean {
  const raw = JSON.stringify(value);
  try {
    if (local) {
      local.setItem(PREFIX + key, raw);
    } else {
      memoryStore.set(PREFIX + key, raw);
    }
    return true;
  } catch {
    // QuotaExceededError (or security error) — degrade to memory-only.
    try {
      memoryStore.set(PREFIX + key, raw);
    } catch {
      /* give up silently; in-memory session cache still works */
    }
    return false;
  }
}

export function lsRemove(key: string): void {
  try {
    if (local) local.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
  memoryStore.delete(PREFIX + key);
}

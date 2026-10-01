/**
 * Long-lived per-title cache for MyAnimeList relation/detail lookups.
 *
 * Unlike the user-scoped discovery cache (24 h TTL), title data (relations,
 * details) is user-independent and changes rarely — cached for 30 days in a
 * separate IndexedDB database, shared across every username and scan. This is
 * what amortizes MAL's no-batch, one-request-per-title API.
 */
import { lsGet, lsSet } from '../../lib/storage';

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DB_NAME = 'anilist-discovery-titles';
const DB_STORE = 'entries';

interface CachedEntry {
  savedAt: number;
  value: unknown;
}

const memory = new Map<string, CachedEntry>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DB_STORE)) {
          request.result.createObjectStore(DB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function fresh(entry: CachedEntry | null | undefined): entry is CachedEntry {
  return Boolean(entry && Date.now() - entry.savedAt <= TTL_MS);
}

export async function titleCacheGet<T>(key: string): Promise<T | null> {
  // localStorage mirror (also the Node/private-mode fallback)
  const mirrored = lsGet<CachedEntry>(`mal:title:${key}`);
  if (fresh(mirrored)) return mirrored.value as T;

  const db = await openDb();
  const stored = db
    ? await new Promise<CachedEntry | null>((resolve) => {
        try {
          const request = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
          request.onsuccess = () => resolve((request.result as CachedEntry | undefined) ?? null);
          request.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
    : (memory.get(key) ?? null);

  if (!fresh(stored)) return null;
  // Re-mirror for next time (cheap read path).
  lsSet(`mal:title:${key}`, stored);
  return stored.value as T;
}

export async function titleCacheSet<T>(key: string, value: T): Promise<void> {
  const entry: CachedEntry = { savedAt: Date.now(), value };
  memory.set(key, entry);
  lsSet(`mal:title:${key}`, entry); // best effort — quota may evict, IDB is primary
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(entry, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

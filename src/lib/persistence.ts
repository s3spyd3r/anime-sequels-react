/**
 * Persistent (reload-surviving) discovery cache — no server, no SQL.
 *
 * - Small data (profile, completed ids, watched lookups) → localStorage
 * - The large relations graph (can be multiple MB)        → IndexedDB
 * - Anything else / failures                              → in-memory fallback
 *
 * Keys are passed in already provider-namespaced by the orchestrator
 * (`anilist:{user}` / `mal:{user}`), so the two services never collide.
 * Every slice carries its own timestamp and expires after CACHE_TTL_MS.
 * Hidden results live in lib/hidden.ts and are never touched by the TTL.
 *
 * Schema v2: domain-shaped user/edges (provider-neutral). v1 (AniList-shaped)
 * data is discarded on load — a one-time cache warm-up after the refactor.
 */

import { lsGet, lsRemove, lsSet } from './storage';
import type { DomainUser, SourceRelations } from '../types/domain';

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const PERSIST_VERSION = 2;

const DB_NAME = 'anilist-discovery';
const DB_STORE = 'cache';
const RELATIONS_KEY = 'relations:';

interface PersistedMeta {
  v: number;
  savedAt: number;
  user?: DomainUser;
  completed?: number[];
  interacted?: number[];
  notInteracted?: number[];
}

interface PersistedRelations {
  v: number;
  savedAt: number;
  entries: [number, SourceRelations][];
}

export interface PersistedState {
  meta: PersistedMeta;
  relations: Map<number, SourceRelations> | null;
  relationsSavedAt: number | null;
}

interface SaveArgs {
  meta: PersistedMeta;
  relations?: { savedAt: number; map: Map<number, SourceRelations> } | null;
}

const isFresh = (savedAt: number | undefined): boolean =>
  typeof savedAt === 'number' && savedAt > 0 && Date.now() - savedAt <= CACHE_TTL_MS;

const isStale = (savedAt: number | undefined): boolean =>
  typeof savedAt === 'number' && savedAt > 0 && Date.now() - savedAt > CACHE_TTL_MS;

/* ------------------------------------------------------------------ */
/* IndexedDB helpers (fall back to memory when unavailable/unsupported) */
/* ------------------------------------------------------------------ */

const memoryBlobs = new Map<string, unknown>();
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

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  if (!db) return (memoryBlobs.get(key) as T | undefined) ?? null;
  return new Promise<T | null>((resolve) => {
    try {
      const request = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  memoryBlobs.set(key, value);
  const db = await openDb();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(key: string): Promise<void> {
  memoryBlobs.delete(key);
  const db = await openDb();
  if (!db) return;
  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export async function loadPersistedState(usernameKey: string): Promise<PersistedState | null> {
  const meta = lsGet<PersistedMeta>(`meta:${usernameKey}`);
  if (!meta || meta.v !== PERSIST_VERSION || isStale(meta.savedAt)) {
    if (meta) await clearPersistedState(usernameKey);
    return null;
  }
  if (!isFresh(meta.savedAt)) return null;

  const relKey = `${RELATIONS_KEY}${usernameKey}`;
  const blob = await idbGet<PersistedRelations>(relKey);
  if (blob && (blob.v !== PERSIST_VERSION || isStale(blob.savedAt))) {
    await idbDelete(relKey);
    return null;
  }

  return {
    meta,
    relations: blob && isFresh(blob.savedAt) ? new Map(blob.entries) : null,
    relationsSavedAt: blob && isFresh(blob.savedAt) ? blob.savedAt : null,
  };
}

export async function savePersistedState(usernameKey: string, args: SaveArgs): Promise<void> {
  lsSet(`meta:${usernameKey}`, args.meta);
  const relKey = `${RELATIONS_KEY}${usernameKey}`;
  if (args.relations) {
    await idbSet(relKey, {
      v: PERSIST_VERSION,
      savedAt: args.relations.savedAt,
      entries: [...args.relations.map],
    } satisfies PersistedRelations);
  } else if (args.meta.completed !== undefined) {
    // Fresh run with no relations to keep — drop any stale blob.
    await idbDelete(relKey);
  }
}

export async function clearPersistedState(usernameKey: string): Promise<void> {
  lsRemove(`meta:${usernameKey}`);
  await idbDelete(`${RELATIONS_KEY}${usernameKey}`);
}

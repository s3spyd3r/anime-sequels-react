/**
 * Per-username hidden ("ignore this result") list, persisted in localStorage.
 * Keys are scoped per provider because AniList and MyAnimeList media ids are
 * different id spaces. Hidden ids are user intent — they are never expired by
 * the cache TTL and are never sent anywhere: everything stays in this browser.
 *
 * Legacy (pre-provider) `hidden:{username}` keys are read as AniList keys and
 * migrated on the next write.
 */

import type { ProviderId } from '../providers/types';
import { lsGet, lsSet } from './storage';

const keyFor = (provider: ProviderId, username: string) =>
  `hidden:${provider}:${username.trim().toLowerCase()}`;

const legacyKeyFor = (username: string) => `hidden:${username.trim().toLowerCase()}`;

function readIds(provider: ProviderId, username: string): number[] | null {
  const scoped = lsGet<number[]>(keyFor(provider, username));
  if (scoped != null) return scoped;
  if (provider === 'anilist') return lsGet<number[]>(legacyKeyFor(username));
  return null;
}

export function getHidden(provider: ProviderId, username: string): Set<number> {
  const ids = readIds(provider, username);
  return new Set(Array.isArray(ids) ? ids : []);
}

export function addHidden(provider: ProviderId, username: string, mediaId: number): void {
  const next = getHidden(provider, username);
  next.add(mediaId);
  lsSet(keyFor(provider, username), [...next]);
}

export function removeHidden(provider: ProviderId, username: string, mediaId: number): void {
  const next = getHidden(provider, username);
  next.delete(mediaId);
  lsSet(keyFor(provider, username), [...next]);
}

export function clearHidden(provider: ProviderId, username: string): void {
  lsSet(keyFor(provider, username), []);
}

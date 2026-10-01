/**
 * MyAnimeList client authentication — **X-MAL-CLIENT-ID only** (classic
 * client auth; the user never connects or logs in).
 *
 * Verified against the live API (scripts/probe-mal.ts):
 * - `grant_type=client_credentials` → 400 `unsupported_grant_type` (the
 *   token endpoint also lacks CORS), so there is no Bearer path from a
 *   browser — it is never attempted.
 * - `X-MAL-CLIENT-ID: {client_id}` on api.myanimelist.net/v2 → 200 for
 *   anime, profiles and other users' public lists (403 / `Invalid client id`
 *   otherwise).
 *
 * Note: api.myanimelist.net sends no CORS headers at all, so a browser must
 * reach it same-origin through a proxy (vite.config server.proxy, base set
 * via `VITE_MAL_API_BASE`); Node scripts call it directly.
 */

import { env } from '../../lib/env';
import { MalAuthError, MalError } from './errors';

export function malClientId(): string {
  const id = env('VITE_MAL_CLIENT_ID');
  if (!id) throw new MalError('config', 'VITE_MAL_CLIENT_ID is not configured.');
  return id;
}

/** Headers for one API request (client auth). */
export function malAuthHeaders(): Record<string, string> {
  return { 'X-MAL-CLIENT-ID': malClientId() };
}

export { MalAuthError };

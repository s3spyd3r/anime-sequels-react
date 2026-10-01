/**
 * MyAnimeList REST client: rate limiting, 429/5xx backoff and error mapping.
 * Every request carries app-level client authentication (X-MAL-CLIENT-ID
 * header — never a user login; see providers/mal/auth.ts).
 *
 * Base URL resolution:
 * - `VITE_MAL_API_BASE` if set (e.g. a deployed reverse proxy that adds
 *   nothing but forwards — the browser still sends X-MAL-CLIENT-ID itself);
 * - otherwise in the browser: same-origin `/mal-api/v2`, forwarded by the
 *   dev/preview proxy in vite.config.ts (api.myanimelist.net sends no CORS
 *   headers, so a browser cannot call the official origin directly);
 * - otherwise in Node (scripts): the direct origin.
 * Absolute `paging.next` URLs from MAL are remapped onto the same base.
 *
 * MAL does not publicly document its rate limit — we pace at a conservative
 * 55 requests/minute (rolling window) with small concurrency in the provider,
 * honor Retry-After on 429, and calibrate with scripts/probe-mal.ts.
 */

import { env } from '../../lib/env';
import { MalAuthError, MalError } from './errors';
import { malAuthHeaders } from './auth';

const DIRECT_BASE = 'https://api.myanimelist.net/v2';
/** Same-origin proxy prefix (see vite.config.ts). */
const PROXY_PREFIX = '/mal-api';
const RATE_LIMIT_PER_MINUTE = 55;
const MAX_429_RETRIES = 3;

function resolveBase(): string {
  const explicit = env('VITE_MAL_API_BASE');
  if (explicit) return explicit.replace(/\/+$/, '');
  if (typeof window !== 'undefined') return `${PROXY_PREFIX}/v2`;
  return DIRECT_BASE;
}

const BASE = resolveBase();

function toUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http')) {
    if (BASE !== DIRECT_BASE && pathOrUrl.startsWith(`${DIRECT_BASE}/`)) {
      return `${BASE}${pathOrUrl.slice(DIRECT_BASE.length)}`;
    }
    return pathOrUrl;
  }
  return `${BASE}${pathOrUrl}`;
}

const requestTimestamps: number[] = [];
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function acquireSlot(): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (requestTimestamps.length > 0 && now - requestTimestamps[0] >= 60_000) {
      requestTimestamps.shift();
    }
    if (requestTimestamps.length < RATE_LIMIT_PER_MINUTE) break;
    await sleep(requestTimestamps[0] + 60_000 - now + 50);
  }
  requestTimestamps.push(Date.now());
}

function mapError(status: number, bodyText: string): MalError {
  const message = bodyText.slice(0, 300);
  // `Invalid client id` surfaces as 400/403 — it is a credentials problem,
  // not a private list or a bad page limit.
  if ((status === 400 || status === 403) && /client/i.test(bodyText)) {
    return new MalAuthError(message);
  }
  if (status === 401) return new MalAuthError(message);
  if (status === 404) return new MalError('not_found', message, status);
  if (status === 403) return new MalError('private', message, status);
  if (status === 429) return new MalError('rate_limit', 'Too Many Requests', status);
  if (status >= 500) return new MalError('server', message, status);
  return new MalError('unknown', message, status);
}

/**
 * GET a MAL v2 path (or absolute URL from `paging.next`).
 * Resolves with the parsed JSON body or throws MalError.
 */
export async function malGet<T>(pathOrUrl: string, options: { auth?: boolean } = {}): Promise<T> {
  const auth = options.auth !== false;
  await acquireSlot();

  let attempt = 0;

  for (;;) {
    const url = toUrl(pathOrUrl);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (auth) Object.assign(headers, malAuthHeaders());

    let response: Response;
    try {
      response = await fetch(url, { headers });
    } catch {
      if (attempt < 2) {
        attempt += 1;
        await sleep(750 * attempt);
        continue;
      }
      throw new MalError('network');
    }

    if (response.status === 429) {
      if (attempt >= MAX_429_RETRIES) throw new MalError('rate_limit', 'Too Many Requests', 429);
      attempt += 1;
      const retryAfter = Number(response.headers.get('Retry-After'));
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000 * attempt;
      await sleep(waitMs);
      continue;
    }

    const bodyText = await response.text();

    if (response.status >= 500) {
      if (attempt < 2) {
        attempt += 1;
        await sleep(1000 * attempt);
        continue;
      }
      throw mapError(response.status, bodyText);
    }

    if (!response.ok) throw mapError(response.status, bodyText);

    try {
      return JSON.parse(bodyText) as T;
    } catch {
      throw new MalError('server', 'Malformed response from MyAnimeList');
    }
  }
}

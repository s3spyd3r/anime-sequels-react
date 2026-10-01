import type { GraphQLResponse } from '../../types/anilist';

const ENDPOINT = 'https://graphql.anilist.co';

/**
 * AniList advertises 30 requests per minute (verified via X-RateLimit-Limit).
 * We keep a rolling one-minute window slightly below the cap so a single
 * browser session never trips the limit; 429s are still handled with backoff.
 */
const RATE_LIMIT_PER_MINUTE = 28;
const MAX_429_RETRIES = 3;

export type AniListErrorCode =
  | 'not_found'
  | 'private'
  | 'rate_limit'
  | 'server'
  | 'network'
  | 'graphql'
  | 'unknown';

export class AniListError extends Error {
  readonly code: AniListErrorCode;
  readonly status?: number;
  readonly serverMessage?: string;

  constructor(code: AniListErrorCode, serverMessage?: string, status?: number) {
    super(serverMessage ?? code);
    this.name = 'AniListError';
    this.code = code;
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const requestTimestamps: number[] = [];

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

function extractServerMessage(bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as GraphQLResponse<unknown>;
    return parsed.errors?.[0]?.message ?? bodyText;
  } catch {
    return bodyText;
  }
}

function classifyMessage(message: string, status?: number): AniListError {
  if (message.includes('Private')) return new AniListError('private', message, status);
  if (message.includes('Not Found') || status === 404) {
    return new AniListError('not_found', message, status);
  }
  return new AniListError('graphql', message, status);
}

function mapHttpError(status: number, bodyText: string): AniListError {
  const message = extractServerMessage(bodyText).slice(0, 300);
  if (status === 404) return classifyMessage(message, status);
  if (status >= 500) return new AniListError('server', message, status);
  return classifyMessage(message, status);
}

/**
 * Executes a GraphQL request against the AniList API with rate limiting,
 * 429 backoff and network retries. Resolves with `data` or throws AniListError.
 */
export async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  await acquireSlot();

  let attempt = 0;
  for (;;) {
    let response: Response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch {
      if (attempt < 2) {
        attempt += 1;
        await sleep(750 * attempt);
        continue;
      }
      throw new AniListError('network');
    }

    if (response.status === 429) {
      if (attempt >= MAX_429_RETRIES) {
        throw new AniListError('rate_limit', 'Too Many Requests', 429);
      }
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
      throw new AniListError('server', bodyText.slice(0, 300), response.status);
    }

    if (!response.ok) throw mapHttpError(response.status, bodyText);

    let payload: GraphQLResponse<T>;
    try {
      payload = JSON.parse(bodyText) as GraphQLResponse<T>;
    } catch {
      throw new AniListError('graphql', 'Malformed response from AniList');
    }

    if (payload.errors && payload.errors.length > 0) {
      const first = payload.errors[0];
      throw classifyMessage(first.message, first.status ?? response.status);
    }

    if (payload.data == null) {
      throw new AniListError('graphql', 'Empty response from AniList');
    }

    return payload.data;
  }
}

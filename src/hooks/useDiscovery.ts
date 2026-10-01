import { useCallback, useRef, useState } from 'react';
import { AniListError } from '../providers/anilist/client';
import { MalError } from '../providers/mal/errors';
import {
  CancelledError,
  runDiscovery,
  type DiscoveryData,
  type DiscoveryProgress,
} from '../providers/discovery';
import type { ProviderId } from '../providers/types';
import type { SelectedRelationType } from '../types/domain';

export type DiscoveryStatus = 'idle' | 'loading' | 'error' | 'none' | 'results';

export type NoneReason = 'no-completed' | 'nothing-new';

export interface DiscoveryErrorInfo {
  message: string;
  detail?: string;
}

export interface DiscoveryState {
  status: DiscoveryStatus;
  provider: ProviderId;
  username: string;
  progress: DiscoveryProgress;
  data: DiscoveryData | null;
  error: DiscoveryErrorInfo | null;
  noneReason: NoneReason | null;
}

const INITIAL_STATE: DiscoveryState = {
  status: 'idle',
  provider: 'anilist',
  username: '',
  progress: { step: 0, detail: '', fraction: 0 },
  data: null,
  error: null,
  noneReason: null,
};

function describeError(
  error: unknown,
  username: string,
  provider: ProviderId,
): DiscoveryErrorInfo {
  if (error instanceof MalError && provider === 'mal') {
    switch (error.code) {
      case 'not_found':
        return {
          message: `MyAnimeList user “${username}” was not found.`,
          detail: 'Check the spelling and try again.',
        };
      case 'private':
        return {
          message: `“${username}” keeps their anime list private.`,
          detail: 'Their list must be public before it can be scanned.',
        };
      case 'auth':
        return {
          message: error.message,
          detail: 'Check VITE_MAL_CLIENT_ID / VITE_MAL_CLIENT_SECRET in .env (see README).',
        };
      case 'config':
        return {
          message: 'MyAnimeList isn’t configured for this app.',
          detail: error.message,
        };
      case 'rate_limit':
        return {
          message: 'MyAnimeList’s rate limit kicked in after several retries.',
          detail: 'Wait about a minute, then try again.',
        };
      case 'network':
        return {
          message: 'Couldn’t reach MyAnimeList.',
          detail: 'Check your internet connection and try again.',
        };
      case 'server':
        return {
          message: 'MyAnimeList is having trouble right now.',
          detail: 'Try again in a moment.',
        };
      case 'unsupported':
        return {
          message: error.message,
          detail: 'Try a different public user — their list couldn’t be read reliably.',
        };
      default:
        return {
          message: 'Something went wrong while talking to MyAnimeList.',
          detail: error.message && error.message !== error.code ? error.message : undefined,
        };
    }
  }
  if (error instanceof AniListError) {
    switch (error.code) {
      case 'not_found':
        return {
          message: `AniList user “${username}” was not found.`,
          detail: 'Check the spelling and try again.',
        };
      case 'private':
        return {
          message: `“${username}” keeps their anime list private.`,
          detail: 'Their completed titles can’t be read until their list is public.',
        };
      case 'rate_limit':
        return {
          message: 'AniList’s rate limit kicked in after several retries.',
          detail: 'Wait about a minute, then try again.',
        };
      case 'network':
        return {
          message: 'Couldn’t reach AniList.',
          detail: 'Check your internet connection and try again.',
        };
      case 'server':
        return {
          message: 'AniList is having trouble right now.',
          detail: 'Try again in a moment.',
        };
      default:
        return {
          message: 'Something went wrong while talking to AniList.',
          detail: error.message && error.message !== error.code ? error.message : undefined,
        };
    }
  }
  return { message: 'Something went wrong. Please try again.' };
}

export interface RunOptions {
  /** Bypass both cache layers and re-fetch from the provider. */
  force?: boolean;
}

export interface UseDiscoveryResult {
  state: DiscoveryState;
  busy: boolean;
  run: (
    provider: ProviderId,
    username: string,
    relationTypes: SelectedRelationType[],
    options?: RunOptions,
  ) => Promise<void>;
  /** Re-runs the last search with force=true (fresh data from the provider). */
  refresh: () => Promise<void>;
}

export function useDiscovery(): UseDiscoveryResult {
  const [state, setState] = useState<DiscoveryState>(INITIAL_STATE);
  const runIdRef = useRef(0);
  const lastArgsRef = useRef<{
    provider: ProviderId;
    username: string;
    relationTypes: SelectedRelationType[];
  } | null>(null);

  const run = useCallback(
    async (
      provider: ProviderId,
      rawUsername: string,
      relationTypes: SelectedRelationType[],
      options?: RunOptions,
    ) => {
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      const username = rawUsername.trim();
      lastArgsRef.current = { provider, username, relationTypes };

      const isCurrent = () => runIdRef.current === runId;

      setState({
        status: 'loading',
        provider,
        username,
        progress: { step: 0, detail: '', fraction: 0 },
        data: null,
        error: null,
        noneReason: null,
      });

      try {
        const data = await runDiscovery({
          provider,
          username,
          relationTypes,
          forceRefresh: options?.force === true,
          onProgress: (progress) => {
            if (isCurrent()) setState((prev) => ({ ...prev, progress }));
          },
          isCancelled: () => !isCurrent(),
        });

        if (!isCurrent()) return;

        if (data.items.length === 0) {
          setState((prev) => ({
            ...prev,
            status: 'none',
            data,
            noneReason: data.completedCount === 0 ? 'no-completed' : 'nothing-new',
          }));
        } else {
          setState((prev) => ({ ...prev, status: 'results', data, noneReason: null }));
        }
      } catch (error) {
        if (!isCurrent()) return;
        if (error instanceof CancelledError) return;
        setState((prev) => ({
          ...prev,
          status: 'error',
          data: null,
          noneReason: null,
          error: describeError(error, username, provider),
        }));
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    const last = lastArgsRef.current;
    if (!last) return;
    await run(last.provider, last.username, last.relationTypes, { force: true });
  }, [run]);

  return { state, busy: state.status === 'loading', run, refresh };
}

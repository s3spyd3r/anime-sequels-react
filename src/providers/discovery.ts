import { clearPersistedState, loadPersistedState, savePersistedState } from '../lib/persistence';
import { getProvider } from './registry';
import { buildCandidates, compareByScore } from './shared';
import type {
  DiscoveryData,
  DiscoveryProgress,
  IsCancelled,
  ProviderId,
  SessionState,
} from './types';
import type { SelectedRelationType } from '../types/domain';
import { CancelledError } from './types';

export { CancelledError };
export type { DiscoveryData, DiscoveryItem, DiscoveryProgress, DiscoverySource } from './types';

/**
 * L1 cache: in-memory, lives until page reload (instant re-runs within a tab).
 * L2 cache: localStorage + IndexedDB via lib/persistence (survives reloads,
 * 24 h TTL). Keys are namespaced per provider — AniList and MyAnimeList ids
 * are different id spaces and must never mix.
 */
const sessionCache = new Map<string, SessionState>();

export function clearSessionCache(): void {
  sessionCache.clear();
}

export interface RunDiscoveryArgs {
  provider: ProviderId;
  username: string;
  relationTypes: SelectedRelationType[];
  onProgress: (progress: DiscoveryProgress) => void;
  isCancelled: IsCancelled;
  /** Skip both cache layers and re-fetch everything ("Refresh data"). */
  forceRefresh?: boolean;
}

function freshSession(): SessionState {
  return { interacted: new Set(), notInteracted: new Set() };
}

function fromPersisted(persisted: NonNullable<Awaited<ReturnType<typeof loadPersistedState>>>): SessionState {
  return {
    user: persisted.meta.user,
    completed: persisted.meta.completed,
    relations: persisted.relations ?? undefined,
    interacted: new Set(persisted.meta.interacted ?? []),
    notInteracted: new Set(persisted.meta.notInteracted ?? []),
    metaSavedAt: persisted.meta.savedAt,
    relationsSavedAt: persisted.relationsSavedAt ?? undefined,
  };
}

/**
 * Provider-agnostic discovery pipeline:
 *   profile → list → relation graph → candidates → interaction filter
 *   → (optional detail enrich) → rank.
 *
 * Providers implement the fetching stages; this orchestrator owns caching
 * (L1/L2, 24 h TTL), progress reporting, dedup/filter/sort and cancellation.
 * Hidden results are filtered in the UI layer (lib/hidden.ts) so hiding/
 * un-hiding is instant and never costs an API call.
 */
export async function runDiscovery({
  provider: providerId,
  username: rawUsername,
  relationTypes,
  onProgress,
  isCancelled,
  forceRefresh = false,
}: RunDiscoveryArgs): Promise<DiscoveryData> {
  const provider = getProvider(providerId);
  const username = rawUsername.trim();
  const cacheKey = `${provider.id}:${username.toLowerCase()}`;

  let session: SessionState;
  if (forceRefresh) {
    // Bypass BOTH cache layers: drop persisted data and start memory fresh.
    await clearPersistedState(cacheKey);
    session = freshSession();
    sessionCache.set(cacheKey, session);
  } else {
    const inMemory = sessionCache.get(cacheKey);
    if (inMemory) {
      session = inMemory;
    } else {
      const persisted = await loadPersistedState(cacheKey);
      session = persisted ? fromPersisted(persisted) : freshSession();
      sessionCache.set(cacheKey, session);
    }
  }
  const state = session;

  let servedFromCache = false;

  const checkCancelled = () => {
    if (isCancelled()) throw new CancelledError();
  };
  const at = (phase: number) => (detail: string, fraction = 0) =>
    onProgress({ step: phase, detail, fraction });
  const markFresh = () => {
    state.metaSavedAt = Date.now();
  };
  const persist = () =>
    savePersistedState(cacheKey, {
      meta: {
        v: 2,
        savedAt: state.metaSavedAt ?? 0,
        user: state.user,
        completed: state.completed,
        interacted: [...state.interacted],
        notInteracted: [...state.notInteracted],
      },
      relations:
        state.relations && state.relationsSavedAt
          ? { savedAt: state.relationsSavedAt, map: state.relations }
          : null,
    });

  const phases = provider.phases;

  // 1 — profile -------------------------------------------------------------
  const reportProfile = at(phases.profile);
  reportProfile('', 0);
  if (state.user) {
    servedFromCache = true;
    reportProfile(`${state.user.name} (cached)`, 1);
  } else {
    state.user = await provider.fetchProfile(username);
    markFresh();
    await persist();
    reportProfile(state.user.name, 1);
  }
  checkCancelled();
  const user = state.user;

  // 2 — completed list (+ interacted snapshot where the provider has one) ---
  const reportList = at(phases.list);
  if (state.completed) {
    servedFromCache = true;
    reportList(`${state.completed.length} completed titles (cached)`, 1);
  } else {
    const result = await provider.fetchList(user.name, reportList, isCancelled);
    state.completed = result.completed;
    for (const id of result.interacted) state.interacted.add(id);
    markFresh();
    await persist();
  }
  checkCancelled();

  const completedIds = state.completed ?? [];

  // 3 — relations -----------------------------------------------------------
  const reportRelations = at(phases.relations);
  if (!state.relations) state.relations = new Map();
  const relationMap = state.relations;
  const missingSourceIds = completedIds.filter((id) => !relationMap.has(id));
  if (missingSourceIds.length === 0 && completedIds.length > 0) servedFromCache = true;
  const relationResult = await provider.fetchRelations({
    missingIds: missingSourceIds,
    totalSources: completedIds.length,
    relationMap,
    report: reportRelations,
    isCancelled,
    force: forceRefresh,
  });
  if (missingSourceIds.length > 0 && relationResult.networkRequests === 0) {
    servedFromCache = true; // everything came from the per-title cache
  }
  if (relationResult.networkRequests > 0) {
    state.relationsSavedAt = Date.now();
    await persist();
  }
  checkCancelled();

  // Candidates: selected relation types, ANIME only, never completed.
  const candidateList = buildCandidates(completedIds, relationMap, relationTypes);

  // 4 — interaction filter --------------------------------------------------
  const reportInteractions = at(phases.interactions);
  const interactionResult = await provider.interactions({
    candidates: candidateList,
    state,
    report: reportInteractions,
    isCancelled,
  });
  if (interactionResult.networkRequests > 0) {
    markFresh();
    await persist();
  }
  if (
    interactionResult.networkRequests === 0 &&
    interactionResult.cacheEligible &&
    candidateList.length > 0
  ) {
    servedFromCache = true;
  }
  checkCancelled();

  // Keep only titles confirmed to have NO list entry (any status) — this is
  // what drops Planned / Watching / Paused / Dropped entries.
  const items = candidateList.filter((item) => state.notInteracted.has(item.media.id));

  // 5 — detail enrich (MAL only; runs after filtering so we only pay for
  // survivors that are actually shown).
  if (phases.enrich !== null && provider.enrich) {
    const reportEnrich = at(phases.enrich);
    if (items.length === 0) {
      reportEnrich('No results to enrich', 1);
    } else {
      const enrichResult = await provider.enrich({
        items,
        report: reportEnrich,
        isCancelled,
        force: forceRefresh,
      });
      if (
        enrichResult.networkRequests === 0 &&
        enrichResult.cacheEligible &&
        items.length > 0
      ) {
        servedFromCache = true;
      }
    }
    checkCancelled();
  }

  // 6 — rank ----------------------------------------------------------------
  const reportRank = at(phases.rank);
  reportRank(`Sorting by ${provider.scoreLabel}`, 0);
  items.sort(compareByScore);
  reportRank(`${items.length} matches`, 1);

  return {
    user,
    completedCount: completedIds.length,
    items,
    fromCache: servedFromCache,
    provider: provider.id,
    steps: provider.steps,
  };
}

import type { Provider, RelationsArgs, InteractionArgs, ListResult } from '../types';
import { throwIfCancelled } from '../types';
import { chunk } from '../shared';
import { fetchCompletedPage, fetchInteractedIds, fetchRelationsBatch, fetchUser, PAGE_SIZE } from './queries';
import { toDomainUser, toSourceRelations } from './mapping';

/**
 * AniList provider: GraphQL, batched relation lookups (50 ids/request) and
 * per-candidate interaction checks. Behaviour is identical to the original
 * single-service pipeline.
 */
export const anilistProvider: Provider = {
  id: 'anilist',
  label: 'AniList',
  scoreLabel: 'AniList score',
  usernameLabel: 'AniList Username',
  usernamePlaceholder: 'e.g. anime_lover_99',
  usernameRequired: true,
  requiresAuth: false,
  steps: [
    'Fetching profile',
    'Loading completed list',
    'Scanning relations',
    'Checking your AniList entries',
    'Ranking results',
  ],
  phases: { profile: 0, list: 1, relations: 2, interactions: 3, enrich: null, rank: 4 },

  async fetchProfile(username: string) {
    return toDomainUser(await fetchUser(username.trim()));
  },

  async fetchList(username, report, isCancelled): Promise<ListResult> {
    const completed: number[] = [];
    let page = 1;
    let hasNextPage = true;
    report('Fetching…', 0);
    while (hasNextPage) {
      throwIfCancelled(isCancelled);
      const result = await fetchCompletedPage(username, page);
      completed.push(...result.ids);
      hasNextPage = result.hasNextPage;
      page += 1;
      report(`${completed.length} completed titles`, 0);
      if (page > 1000) break; // safety valve: 50k entries
    }
    report(`${completed.length} completed titles`, 1);
    return { completed, interacted: [] };
  },

  async fetchRelations({ missingIds, totalSources, relationMap, report, isCancelled }: RelationsArgs) {
    const total = totalSources;
    const scanned0 = total - missingIds.length;
    report(
      missingIds.length === 0
        ? `${total}/${total} titles (cached)`
        : `${scanned0}/${total} titles`,
      total > 0 ? scanned0 / total : 1,
    );

    const batches = chunk(missingIds, PAGE_SIZE);
    let scanned = scanned0;
    for (let i = 0; i < batches.length; i += 1) {
      throwIfCancelled(isCancelled);
      const batch = batches[i];
      const media = await fetchRelationsBatch(batch);
      for (const entry of media) relationMap.set(entry.id, toSourceRelations(entry));
      for (const id of batch) {
        if (!relationMap.has(id)) relationMap.set(id, { title: '', edges: [] });
      }
      scanned += batch.length;
      report(
        `batch ${i + 1}/${batches.length} · ${scanned}/${total} titles`,
        total > 0 ? scanned / total : 1,
      );
    }
    return { networkRequests: batches.length };
  },

  async interactions({ candidates, state, report, isCancelled }: InteractionArgs) {
    const username = state.user?.name ?? '';
    const unchecked = candidates.filter(
      (item) => !state.interacted.has(item.media.id) && !state.notInteracted.has(item.media.id),
    );
    const batches = chunk(unchecked.map((item) => item.media.id), PAGE_SIZE);
    report(
      batches.length > 0 ? `batch 0/${batches.length}` : 'Everything already checked',
      batches.length > 0 ? 0 : 1,
    );

    for (let i = 0; i < batches.length; i += 1) {
      throwIfCancelled(isCancelled);
      const ids = batches[i];
      const found = new Set(await fetchInteractedIds(username, ids));
      for (const id of ids) {
        if (found.has(id)) state.interacted.add(id);
        else state.notInteracted.add(id);
      }
      report(`batch ${i + 1}/${batches.length}`, (i + 1) / batches.length);
    }
    return { networkRequests: batches.length, cacheEligible: true };
  },
};

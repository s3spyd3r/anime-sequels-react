import type {
  InteractionArgs,
  InteractionResult,
  IsCancelled,
  ListResult,
  Provider,
  RelationsArgs,
  StageReport,
} from '../types';
import { throwIfCancelled } from '../types';
import { mapPool } from '../shared';
import { malGet } from './api';
import { MalError } from './errors';
import {
  ANIME_DETAIL_FIELDS,
  isCompleteNode,
  mapMalRelation,
  readListStatus,
  toDomainMediaMal,
  type MalAnimeNode,
  type MalListStatus,
} from './mapping';
import { titleCacheGet, titleCacheSet } from './titleCache';
import type { DomainEdge, DomainUser, SourceRelations } from '../../types/domain';

/** Per-title fetch concurrency — the rolling window in api.ts caps overall rpm. */
const CONCURRENCY = 4;

const PLAIN_RELATION_FIELDS = 'title,related_anime';
const EXPANDED_RELATION_FIELDS = `title,related_anime{node{${ANIME_DETAIL_FIELDS}},relation_type}`;

const LIST_STATUSES: readonly MalListStatus[] = [
  'watching',
  'completed',
  'on_hold',
  'dropped',
  'plan_to_watch',
];

/** Server capability for the relation sub-field expansion (learned once). */
let relationFieldsMode: 'unknown' | 'expanded' | 'plain' = 'unknown';
/** Validated /users/{name}/animelist limit (endpoint max is undocumented). */
let listLimit: number | null = null;

interface MalListEntry {
  node: MalAnimeNode;
  /** Entry-level sibling of `node` (not nested inside it). */
  list_status?: MalAnimeNode['list_status'];
}

interface MalListPage {
  data?: MalListEntry[];
  paging?: { next?: string };
}

/** Keeps the entry-level list_status attached to its node. */
function entryToNode(entry: MalListEntry): MalAnimeNode {
  return { ...entry.node, list_status: entry.list_status };
}

const listPath = (username: string) =>
  `/users/${encodeURIComponent(username)}/animelist`;

function parseRelated(node: MalAnimeNode): SourceRelations {
  const edges: DomainEdge[] = (node.related_anime ?? []).map((entry) => {
    const inner = (entry.node ?? entry) as MalAnimeNode;
    const relationType = mapMalRelation(entry.relation_type ?? (entry as { relation_type?: string }).relation_type);
    if (!inner || typeof inner.id !== 'number') {
      return { relationType, node: null };
    }
    return { relationType, node: toDomainMediaMal(inner, !isCompleteNode(inner)) };
  });
  return { title: node.title ?? '', edges };
}

async function fetchRelationsFor(
  id: number,
  isCancelled: IsCancelled,
): Promise<SourceRelations | null> {
  for (;;) {
    throwIfCancelled(isCancelled);
    const fields = relationFieldsMode === 'plain' ? PLAIN_RELATION_FIELDS : EXPANDED_RELATION_FIELDS;
    try {
      const node = await malGet<MalAnimeNode>(`/anime/${id}?fields=${encodeURIComponent(fields)}`);
      if (relationFieldsMode === 'unknown') relationFieldsMode = 'expanded';
      return parseRelated(node);
    } catch (error) {
      if (error instanceof MalError && error.status === 400 && relationFieldsMode !== 'plain') {
        // Expansion rejected — fall back to plain related_anime + enrich pass.
        relationFieldsMode = 'plain';
        continue;
      }
      if (error instanceof MalError && error.status === 404) {
        return null; // title removed from MAL → treat as having no relations
      }
      throw error;
    }
  }
}

async function pickListLimit(username: string): Promise<number> {
  if (listLimit != null) return listLimit;
  for (const limit of [1000, 500, 100]) {
    try {
      await malGet(`${listPath(username)}?fields=id&limit=${limit}`);
      listLimit = limit;
      return limit;
    } catch (error) {
      if (error instanceof MalError && error.status === 400) continue;
      throw error;
    }
  }
  throw new MalError('unknown', 'Could not determine MyAnimeList list page size.');
}

async function fetchListPages(
  username: string,
  fields: string,
  status: MalListStatus | undefined,
  isCancelled: IsCancelled,
): Promise<MalAnimeNode[]> {
  const limit = await pickListLimit(username);
  const statusParam = status ? `&status=${status}` : '';
  let path = `${listPath(username)}?fields=${fields}&limit=${limit}${statusParam}`;
  const nodes: MalAnimeNode[] = [];

  for (;;) {
    throwIfCancelled(isCancelled);
    const page = await malGet<MalListPage>(path);
    nodes.push(...(page.data ?? []).map(entryToNode));
    if (!page.paging?.next) break;
    path = page.paging.next;
    if (nodes.length > 100_000) break; // safety valve
  }
  return nodes;
}

/**
 * Fallback: five status-bucket passes (fields=id + &status=…). Used when the
 * per-entry status field isn't exposed — notably other users' lists. Detects
 * a server that ignores the `status` filter (every bucket identical) instead
 * of silently reporting the whole list as "completed".
 */
async function readViaStatusBuckets(
  username: string,
  report: StageReport,
  isCancelled: IsCancelled,
): Promise<ListResult> {
  const union = new Set<number>();
  const buckets = new Map<MalListStatus, Set<number>>();
  for (let i = 0; i < LIST_STATUSES.length; i += 1) {
    const status = LIST_STATUSES[i];
    const nodes = await fetchListPages(username, 'id', status, isCancelled);
    const ids = new Set(nodes.map((node) => node.id));
    buckets.set(status, ids);
    for (const id of ids) union.add(id);
    report(
      `status ${i + 1}/${LIST_STATUSES.length} · ${union.size} entries`,
      (i + 1) / LIST_STATUSES.length,
    );
  }
  const completed = buckets.get('completed') ?? new Set<number>();
  if (union.size > 0 && completed.size === union.size) {
    throw new MalError(
      'unsupported',
      `MyAnimeList didn’t apply the status filter for “${username}” — their list can’t be scanned.`,
    );
  }
  report(`${completed.size} completed titles`, 1);
  return { completed: [...completed], interacted: [...union] };
}

/**
 * Reads the user's anime list. Strategy 1: one pass with per-entry status
 * (`fields=list_status`). Fallback: status buckets — see
 * readViaStatusBuckets.
 */
async function readAnimeList(
  username: string,
  report: StageReport,
  isCancelled: IsCancelled,
): Promise<ListResult> {
  let entries: MalAnimeNode[] | null = null;

  for (const limit of [1000, 500, 100]) {
    try {
      const nodes: MalAnimeNode[] = [];
      let path = `${listPath(username)}?fields=list_status&limit=${limit}`;
      for (;;) {
        throwIfCancelled(isCancelled);
        const page = await malGet<MalListPage>(path);
        nodes.push(...(page.data ?? []).map(entryToNode));
        report(`${nodes.length} list entries`, 0);
        if (!page.paging?.next) break;
        path = page.paging.next;
        if (nodes.length > 100_000) break;
      }
      listLimit = limit;
      entries = nodes;
      break;
    } catch (error) {
      const isBadLimitOrField = error instanceof MalError && error.status === 400;
      if (!isBadLimitOrField) throw error;
      if (limit === 100) {
        // Even the smallest page size was rejected → fields=list_status itself
        // is unsupported here; buckets below use plain `fields=id`.
        entries = null;
        break;
      }
      // 400 at this limit — try the next one down.
    }
  }

  if (entries == null) return readViaStatusBuckets(username, report, isCancelled);

  if (entries.some((node) => !readListStatus(node))) {
    // Entries came back without status → re-read via buckets.
    return readViaStatusBuckets(username, report, isCancelled);
  }

  const interacted = entries.map((node) => node.id);
  const completed = entries
    .filter((node) => readListStatus(node) === 'completed')
    .map((node) => node.id);
  report(`${completed.length} completed titles`, 1);
  return { completed, interacted };
}

export const malProvider: Provider = {
  id: 'mal',
  label: 'MyAnimeList',
  scoreLabel: 'MyAnimeList score',
  usernameLabel: 'MAL Username',
  usernamePlaceholder: 'e.g. madpierrot',
  usernameRequired: true,
  requiresAuth: true,
  steps: [
    'Fetching profile',
    'Loading anime list',
    'Scanning relations',
    'Checking list entries',
    'Fetching details',
    'Ranking results',
  ],
  phases: { profile: 0, list: 1, relations: 2, interactions: 3, enrich: 4, rank: 5 },

  /**
   * MAL's `GET /users/{name}` lookup returns 404 for every user and field
   * combination under client auth (verified live — even MAL staff accounts),
   * so existence is validated through the list endpoint instead. The profile
   * is minimal (typed name; the UI falls back to an initials avatar).
   */
  async fetchProfile(username: string): Promise<DomainUser> {
    const name = username.trim();
    try {
      await malGet(`${listPath(name)}?fields=id&limit=1`);
    } catch (error) {
      if (error instanceof MalError && error.status === 404) {
        throw new MalError('not_found', `No MyAnimeList account named “${name}”.`);
      }
      throw error;
    }
    return {
      id: name,
      name,
      url: `https://myanimelist.net/profile/${encodeURIComponent(name)}`,
      avatarUrl: null,
    };
  },

  async fetchList(username, report, isCancelled): Promise<ListResult> {
    return readAnimeList(username, report, isCancelled);
  },

  async fetchRelations({ missingIds, totalSources, relationMap, report, isCancelled, force }: RelationsArgs) {
    const total = totalSources;
    const scanned0 = total - missingIds.length;
    report(
      missingIds.length === 0
        ? `${total}/${total} titles (cached)`
        : `${scanned0}/${total} titles`,
      total > 0 ? scanned0 / total : 1,
    );
    if (missingIds.length === 0) return { networkRequests: 0 };

    let networkRequests = 0;
    let scanned = scanned0;

    await mapPool(missingIds, CONCURRENCY, async (id) => {
      throwIfCancelled(isCancelled);
      const cached = force ? null : await titleCacheGet<SourceRelations>(`rel:${id}`);
      if (cached) {
        relationMap.set(id, cached);
      } else {
        networkRequests += 1;
        const relations = await fetchRelationsFor(id, isCancelled);
        const value: SourceRelations = relations ?? { title: '', edges: [] };
        relationMap.set(id, value);
        await titleCacheSet(`rel:${id}`, value);
      }
      scanned += 1;
      report(`${scanned}/${total} titles`, total > 0 ? scanned / total : 1);
    });

    return { networkRequests };
  },

  async interactions({ candidates, state, report }: InteractionArgs): Promise<InteractionResult> {
    if (candidates.length === 0) {
      report('Nothing to check', 1);
      return { networkRequests: 0, cacheEligible: false };
    }
    for (const item of candidates) {
      if (!state.interacted.has(item.media.id)) state.notInteracted.add(item.media.id);
    }
    report(
      `Checked ${candidates.length} titles against ${state.interacted.size} list entries`,
      1,
    );
    return { networkRequests: 0, cacheEligible: false };
  },

  async enrich({ items, report, isCancelled, force }): Promise<InteractionResult> {
    const pending = items.filter((item) => item.media.partial === true);
    if (pending.length === 0) {
      report('Details ready', 1);
      return { networkRequests: 0, cacheEligible: false };
    }

    let networkRequests = 0;
    let done = 0;

    await mapPool(pending, CONCURRENCY, async (item) => {
      throwIfCancelled(isCancelled);
      try {
        let node = force ? null : await titleCacheGet<MalAnimeNode>(`det:${item.media.id}`);
        if (!node) {
          networkRequests += 1;
          node = await malGet<MalAnimeNode>(
            `/anime/${item.media.id}?fields=${encodeURIComponent(ANIME_DETAIL_FIELDS)}`,
          );
          await titleCacheSet(`det:${item.media.id}`, node);
        }
        item.media = toDomainMediaMal(node, false);
      } catch (error) {
        if (error instanceof MalError && error.status === 404) {
          item.media = { ...item.media, partial: false };
        } else {
          throw error;
        }
      }
      done += 1;
      report(`${done}/${pending.length} titles`, done / pending.length);
    });

    return { networkRequests, cacheEligible: true };
  },
};

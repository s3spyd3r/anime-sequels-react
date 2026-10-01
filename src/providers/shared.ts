import type {
  DomainMedia,
  SelectedRelationType,
  SourceRelations,
} from '../types/domain';
import type { DiscoveryItem } from './types';

export function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

/** Runs `fn` over `items` with at most `limit` concurrent executions. */
export async function mapPool<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await fn(items[index], index);
    }
  });
  await Promise.all(workers);
}

export function preferredTitle(media: Pick<DomainMedia, 'title'>): string {
  return media.title.english || media.title.romaji || '';
}

export function compareByScore(a: DiscoveryItem, b: DiscoveryItem): number {
  const scoreA = a.media.score ?? -1;
  const scoreB = b.media.score ?? -1;
  if (scoreA !== scoreB) return scoreB - scoreA;
  const popularityA = a.media.popularity ?? -1;
  const popularityB = b.media.popularity ?? -1;
  if (popularityA !== popularityB) return popularityB - popularityA;
  return (a.media.title.romaji ?? '').localeCompare(b.media.title.romaji ?? '');
}

/**
 * Builds the deduplicated candidate list from the source relation graph:
 * selected relation types only, ANIME only, never a title already completed.
 * Shared by every provider — the graph itself is provider-neutral.
 */
export function buildCandidates(
  completedIds: number[],
  relationMap: Map<number, SourceRelations>,
  relationTypes: readonly SelectedRelationType[],
): DiscoveryItem[] {
  const selectedTypes = new Set<string>(relationTypes);
  const completedSet = new Set(completedIds);
  const candidates = new Map<number, DiscoveryItem>();

  for (const sourceId of completedIds) {
    const source = relationMap.get(sourceId);
    if (!source) continue;
    for (const edge of source.edges) {
      const node = edge.node;
      if (!node || node.type !== 'ANIME') continue;
      if (!selectedTypes.has(edge.relationType)) continue;
      if (completedSet.has(node.id)) continue;

      const relation = edge.relationType as SelectedRelationType;
      const sourceInfo = { id: sourceId, title: source.title };
      const existing = candidates.get(node.id);
      if (existing) {
        if (!existing.relations.includes(relation)) existing.relations.push(relation);
        if (!existing.sources.some((s) => s.id === sourceId)) existing.sources.push(sourceInfo);
      } else {
        candidates.set(node.id, {
          media: node,
          relations: [relation],
          sources: [sourceInfo],
        });
      }
    }
  }

  for (const item of candidates.values()) {
    item.sources.sort((a, b) => a.title.localeCompare(b.title));
  }
  return [...candidates.values()];
}

/** MyAnimeList API response → provider-neutral domain conversion. */

import type { DomainMedia, KnownRelationType } from '../../types/domain';

export type MalListStatus =
  | 'watching'
  | 'completed'
  | 'on_hold'
  | 'dropped'
  | 'plan_to_watch';

export interface MalListStatusObject {
  status?: MalListStatus;
}

export interface MalAnimeNode {
  id: number;
  title?: string;
  alternative_titles?: { en?: string; ja?: string; synonyms?: string[] };
  main_picture?: { large?: string; medium?: string };
  media_type?: string;
  mean?: number;
  num_episodes?: number;
  num_list_users?: number;
  start_season?: { year?: number; season?: string };
  genres?: { id?: number; name: string }[];
  nsfw?: string;
  related_anime?: MalRelatedEntry[];
  my_list_status?: MalListStatusObject;
  list_status?: MalListStatusObject;
}

export interface MalRelatedEntry {
  node?: MalAnimeNode;
  relation_type?: string;
  relation_format?: string;
}

/** Fields for a full anime record (enrich pass / expanded relation nodes). */
export const ANIME_DETAIL_FIELDS = [
  'id',
  'title',
  'main_picture',
  'alternative_titles',
  'media_type',
  'mean',
  'num_episodes',
  'start_season',
  'genres',
  'num_list_users',
].join(',');

/**
 * MAL relation_type → shared vocabulary. Only the five selectable types plus
 * the known non-selectable ones matter; everything else collapses to OTHER.
 */
const RELATION_MAP: Record<string, KnownRelationType> = {
  prequel: 'PREQUEL',
  sequel: 'SEQUEL',
  side_story: 'SIDE_STORY',
  spin_off: 'SPIN_OFF',
  alternative: 'ALTERNATIVE',
  alternative_version: 'ALTERNATIVE',
  adaptation: 'ADAPTATION',
  summary: 'SUMMARY',
  character: 'CHARACTER',
  source: 'SOURCE',
  compilation: 'COMPILATION',
  other: 'OTHER',
  staff: 'OTHER',
};

export function mapMalRelation(relationType: string | undefined): KnownRelationType {
  if (!relationType) return 'OTHER';
  return RELATION_MAP[relationType.toLowerCase()] ?? 'OTHER';
}

const MEDIA_TYPE_MAP: Record<string, string> = {
  tv: 'TV',
  tv_short: 'TV_SHORT',
  movie: 'MOVIE',
  ova: 'OVA',
  ona: 'ONA',
  music: 'MUSIC',
  special: 'SPECIAL',
  tv_special: 'TV_SPECIAL',
  cm: 'CM',
  pv: 'PV',
};

export function mapMalMediaType(mediaType: string | undefined): string | null {
  if (!mediaType) return null;
  return MEDIA_TYPE_MAP[mediaType.toLowerCase()] ?? mediaType.toUpperCase();
}

/**
 * A node is considered "complete" when at least one detail field beyond the
 * default id/title/picture came back — otherwise the enrich pass must fetch it.
 */
export function isCompleteNode(node: MalAnimeNode): boolean {
  return (
    'mean' in node || 'num_episodes' in node || 'media_type' in node || 'genres' in node
  );
}

export function malNodeTitle(node: Pick<MalAnimeNode, 'title' | 'alternative_titles'>): string {
  // `||`, not `??`: MAL returns "" for titles without an English name.
  return node.alternative_titles?.en || node.title || node.alternative_titles?.synonyms?.[0] || '';
}

/** MAL sends "" (not null) for missing alternate titles — normalize to null. */
function textOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function toDomainMediaMal(node: MalAnimeNode, partial: boolean): DomainMedia {
  const mean = typeof node.mean === 'number' && node.mean > 0 ? node.mean : null;
  return {
    id: node.id,
    type: 'ANIME',
    url: `https://myanimelist.net/anime/${node.id}`,
    title: {
      english: textOrNull(node.alternative_titles?.en),
      romaji: textOrNull(node.title),
      native: textOrNull(node.alternative_titles?.ja),
    },
    format: mapMalMediaType(node.media_type),
    episodes: typeof node.num_episodes === 'number' && node.num_episodes > 0 ? node.num_episodes : null,
    score: mean != null ? Math.round(mean * 10) : null,
    popularity: typeof node.num_list_users === 'number' ? node.num_list_users : null,
    genres: (node.genres ?? []).map((genre) => genre.name),
    year: node.start_season?.year ?? null,
    cover: {
      large: node.main_picture?.large ?? node.main_picture?.medium ?? null,
      color: null, // MAL provides no accent color
    },
    partial: partial || undefined,
  };
}

export function readListStatus(node: MalAnimeNode): MalListStatus | undefined {
  return node.my_list_status?.status ?? node.list_status?.status;
}

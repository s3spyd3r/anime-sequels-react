/**
 * Provider-neutral domain model.
 *
 * Both the AniList and MyAnimeList providers adapt their API responses into
 * these shapes; the pipeline, caches and UI only ever see domain objects.
 */

/** The relation types the user can select in the UI. */
export type SelectedRelationType =
  | 'PREQUEL'
  | 'SEQUEL'
  | 'SIDE_STORY'
  | 'SPIN_OFF'
  | 'ALTERNATIVE';

/**
 * Normalized relation vocabulary across providers: AniList's full enum plus
 * MAL's `staff` collapsed into OTHER. Unknown values from either side map to
 * OTHER — they are never selectable, only filtered out.
 */
export type KnownRelationType =
  | 'ADAPTATION'
  | 'PREQUEL'
  | 'SEQUEL'
  | 'PARENT'
  | 'SIDE_STORY'
  | 'CHARACTER'
  | 'SUMMARY'
  | 'ALTERNATIVE'
  | 'SPIN_OFF'
  | 'OTHER'
  | 'SOURCE'
  | 'COMPILATION'
  | 'CONTAINS'
  | 'SAME_UNIVERSE';

export type MediaType = 'ANIME' | 'MANGA';

export interface DomainTitle {
  english: string | null;
  romaji: string | null;
  native: string | null;
}

export interface DomainCover {
  /** Best available cover URL (extra-large preferred). */
  large: string | null;
  /** Provider accent color, when available (AniList only). */
  color: string | null;
}

export interface DomainMedia {
  id: number;
  type: MediaType;
  /** Link to the title on its own service. */
  url: string;
  title: DomainTitle;
  /** Display format: TV, OVA, MOVIE… */
  format: string | null;
  episodes: number | null;
  /** Score normalized to 0–100 (MAL mean × 10). Null = unrated. */
  score: number | null;
  /** Popularity proxy: AniList popularity / MAL num_list_users. */
  popularity: number | null;
  genres: string[];
  year: number | null;
  cover: DomainCover;
  /**
   * True when the provider returned only summary fields (id/title/picture)
   * and the enrich stage still has to fetch details. AniList never sets this.
   */
  partial?: boolean;
}

export interface DomainEdge {
  relationType: KnownRelationType;
  node: DomainMedia | null;
}

/** A completed source title together with its relation edges (cache unit). */
export interface SourceRelations {
  title: string;
  edges: DomainEdge[];
}

export interface DomainUser {
  id: string;
  name: string;
  url: string;
  avatarUrl: string | null;
}

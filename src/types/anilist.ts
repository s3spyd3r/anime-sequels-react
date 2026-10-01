/**
 * Interfaces for the AniList GraphQL API responses used by this app.
 * Every field below was verified against the live schema at https://graphql.anilist.co.
 */

export type MediaType = 'ANIME' | 'MANGA';

export type MediaFormat =
  | 'TV'
  | 'TV_SHORT'
  | 'MOVIE'
  | 'SPECIAL'
  | 'OVA'
  | 'ONA'
  | 'MUSIC'
  | 'MANGA'
  | 'NOVEL'
  | 'ONE_SHOT';

/** Full MediaRelation enum (verified via schema introspection). */
export type MediaRelationType =
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

export interface MediaTitle {
  romaji: string | null;
  english: string | null;
}

export interface CoverImage {
  extraLarge: string | null;
  large: string | null;
  color: string | null;
}

export interface FuzzyDate {
  year: number | null;
}

/** Display fields selected on related media (and on the relation `node`). */
export interface RelatedMedia {
  id: number;
  type: MediaType;
  siteUrl: string;
  title: MediaTitle;
  format: MediaFormat | null;
  episodes: number | null;
  averageScore: number | null;
  popularity: number | null;
  genres: string[];
  startDate: FuzzyDate;
  coverImage: CoverImage;
}

export interface MediaEdge {
  relationType: MediaRelationType;
  node: RelatedMedia | null;
}

/** A completed source title together with its relation edges. */
export interface MediaWithRelations extends RelatedMedia {
  relations: { edges: MediaEdge[] } | null;
}

export interface PageInfo {
  hasNextPage: boolean;
  currentPage: number | null;
}

export interface User {
  id: number;
  name: string;
  siteUrl: string;
  avatar: { large: string | null } | null;
  statistics: { anime: { count: number } };
}

/** Generic GraphQL response envelope. */
export interface GraphQLResponse<T> {
  data?: T | null;
  errors?: { message: string; status?: number }[];
}

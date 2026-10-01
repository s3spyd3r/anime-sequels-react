import { AniListError, gql } from './client';
import type { MediaWithRelations, User } from '../../types/anilist';

/** Page.perPage caps at 50 (verified live: requests for 100/500 return 50). */
export const PAGE_SIZE = 50;

const USER_QUERY = /* GraphQL */ `
  query DiscoveryUser($name: String!) {
    User(name: $name) {
      id
      name
      siteUrl
      avatar {
        large
      }
      statistics {
        anime {
          count
        }
      }
    }
  }
`;

const COMPLETED_QUERY = /* GraphQL */ `
  query DiscoveryCompleted($userName: String!, $page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        hasNextPage
        currentPage
      }
      mediaList(userName: $userName, type: ANIME, status: COMPLETED) {
        mediaId
      }
    }
  }
`;

const MEDIA_FIELDS = /* GraphQL */ `
  id
  type
  siteUrl
  title {
    romaji
    english
  }
  format
  episodes
  averageScore
  popularity
  genres
  startDate {
    year
  }
  coverImage {
    extraLarge
    large
    color
  }
`;

const RELATIONS_QUERY = /* GraphQL */ `
  query DiscoveryRelations($ids: [Int]!, $page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
      media(id_in: $ids) {
        ${MEDIA_FIELDS}
        relations {
          edges {
            relationType
            node {
              ${MEDIA_FIELDS}
            }
          }
        }
      }
    }
  }
`;

/**
 * Checks which of the given media ids already have a list entry for this user.
 * With no `status` argument the API returns entries in ANY status, which is
 * exactly what "never interacted with" requires.
 */
const INTERACTED_QUERY = /* GraphQL */ `
  query DiscoveryInteracted($userName: String!, $ids: [Int]!, $page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
      mediaList(userName: $userName, type: ANIME, mediaId_in: $ids) {
        mediaId
      }
    }
  }
`;

export async function fetchUser(name: string): Promise<User> {
  const data = await gql<{ User: User | null }>(USER_QUERY, { name });
  if (!data.User) throw new AniListError('not_found', 'Not Found.');
  return data.User;
}

export interface CompletedPage {
  ids: number[];
  hasNextPage: boolean;
}

export async function fetchCompletedPage(userName: string, page: number): Promise<CompletedPage> {
  const data = await gql<{
    Page: {
      pageInfo: { hasNextPage: boolean; currentPage: number | null };
      mediaList: { mediaId: number }[];
    };
  }>(COMPLETED_QUERY, { userName, page, perPage: PAGE_SIZE });

  return {
    ids: data.Page.mediaList.map((entry) => entry.mediaId),
    hasNextPage: data.Page.pageInfo.hasNextPage,
  };
}

/** Fetches up to 50 source titles at once, each with its full relation graph. */
export async function fetchRelationsBatch(ids: number[]): Promise<MediaWithRelations[]> {
  const data = await gql<{
    Page: { media: MediaWithRelations[] | null };
  }>(RELATIONS_QUERY, { ids, page: 1, perPage: PAGE_SIZE });

  return data.Page.media ?? [];
}

/** Returns the subset of `ids` that exist on the user's anime list (any status). */
export async function fetchInteractedIds(userName: string, ids: number[]): Promise<number[]> {
  const data = await gql<{
    Page: { mediaList: { mediaId: number }[] };
  }>(INTERACTED_QUERY, { userName, ids, page: 1, perPage: PAGE_SIZE });

  return data.Page.mediaList.map((entry) => entry.mediaId);
}

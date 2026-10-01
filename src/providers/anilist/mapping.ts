/** AniList API response → provider-neutral domain conversion. */

import type { MediaEdge, MediaWithRelations, RelatedMedia, User } from '../../types/anilist';
import type { DomainEdge, DomainMedia, DomainUser, SourceRelations } from '../../types/domain';

export function toDomainUser(user: User): DomainUser {
  return {
    id: String(user.id),
    name: user.name,
    url: user.siteUrl,
    avatarUrl: user.avatar?.large ?? null,
  };
}

export function toDomainMedia(media: RelatedMedia): DomainMedia {
  return {
    id: media.id,
    type: media.type,
    url: media.siteUrl,
    title: {
      english: media.title.english,
      romaji: media.title.romaji,
      native: null,
    },
    format: media.format,
    episodes: media.episodes,
    score: media.averageScore,
    popularity: media.popularity,
    genres: media.genres,
    year: media.startDate.year,
    cover: {
      large: media.coverImage.extraLarge ?? media.coverImage.large,
      color: media.coverImage.color,
    },
  };
}

export function toDomainEdge(edge: MediaEdge): DomainEdge {
  return {
    relationType: edge.relationType,
    node: edge.node ? toDomainMedia(edge.node) : null,
  };
}

export function toSourceRelations(media: MediaWithRelations): SourceRelations {
  return {
    title: media.title.english || media.title.romaji || '',
    edges: (media.relations?.edges ?? []).map(toDomainEdge),
  };
}

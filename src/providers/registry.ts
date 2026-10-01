import { anilistProvider } from './anilist/provider';
import { malProvider } from './mal/provider';
import type { Provider, ProviderId } from './types';

const providers: Record<ProviderId, Provider> = {
  anilist: anilistProvider,
  mal: malProvider,
};

export function getProvider(id: ProviderId): Provider {
  return providers[id] ?? anilistProvider;
}

export const PROVIDER_IDS: readonly ProviderId[] = ['anilist', 'mal'];

export function isProviderId(value: string): value is ProviderId {
  return value === 'anilist' || value === 'mal';
}

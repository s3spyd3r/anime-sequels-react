import type {
  DomainMedia,
  DomainUser,
  KnownRelationType,
  SelectedRelationType,
  SourceRelations,
} from '../types/domain';

export type ProviderId = 'anilist' | 'mal';

export interface DiscoverySource {
  id: number;
  title: string;
}

export interface DiscoveryItem {
  media: DomainMedia;
  /** Selected relation types that matched (deduplicated). */
  relations: SelectedRelationType[];
  /** Completed titles this result was discovered from (deduplicated, sorted). */
  sources: DiscoverySource[];
}

export interface DiscoveryProgress {
  /** Index into the active provider's `steps`. */
  step: number;
  detail: string;
  /** 0–1 progress within the current step, for the progress bar. */
  fraction: number;
}

export interface DiscoveryData {
  user: DomainUser;
  completedCount: number;
  items: DiscoveryItem[];
  /** True when any stage was served from the persistent cache (24 h TTL). */
  fromCache: boolean;
  provider: ProviderId;
  steps: readonly string[];
}

/** Callback for within-stage progress (pagination, batches, per-title work). */
export type StageReport = (detail: string, fraction: number) => void;

export type IsCancelled = () => boolean;

export class CancelledError extends Error {
  constructor() {
    super('Discovery run cancelled');
    this.name = 'CancelledError';
  }
}

/** Providers call this inside their own pagination/concurrency loops. */
export function throwIfCancelled(isCancelled: IsCancelled): void {
  if (isCancelled()) throw new CancelledError();
}

/** Maps abstract pipeline phases onto the provider's step list. */
export interface Phases {
  profile: number;
  list: number;
  relations: number;
  interactions: number;
  /** null = provider needs no post-filter detail pass (AniList). */
  enrich: number | null;
  rank: number;
}

export interface ListResult {
  completed: number[];
  /** Ids with ANY list entry — seeded into the session's interacted set. */
  interacted: number[];
}

/**
 * Everything the orchestrator caches between stages (L1 memory + L2
 * persistence). Provider-neutral by construction.
 */
export interface SessionState {
  user?: DomainUser;
  completed?: number[];
  relations?: Map<number, SourceRelations>;
  /** Media ids known to have ANY list entry for this user. */
  interacted: Set<number>;
  /** Media ids known to have NO list entry for this user. */
  notInteracted: Set<number>;
  metaSavedAt?: number;
  relationsSavedAt?: number;
}

export interface RelationsArgs {
  missingIds: number[];
  /** All completed source ids (missing + cached) — for progress fractions. */
  totalSources: number;
  relationMap: Map<number, SourceRelations>;
  report: StageReport;
  isCancelled: IsCancelled;
  /** True = ignore long-lived per-title caches and refetch. */
  force?: boolean;
}

export interface InteractionArgs {
  candidates: DiscoveryItem[];
  state: SessionState;
  report: StageReport;
  isCancelled: IsCancelled;
}

export interface EnrichArgs {
  items: DiscoveryItem[];
  report: StageReport;
  isCancelled: IsCancelled;
  /** True = ignore long-lived per-title caches and refetch. */
  force?: boolean;
}

export interface StageResult {
  /** How many requests actually hit the network during this stage. */
  networkRequests: number;
}

export interface InteractionResult extends StageResult {
  /**
   * Whether "0 network requests" is meaningful evidence that everything was
   * served from cache (true for AniList's per-id checks; MAL always answers
   * interactions from its list snapshot without asking the API again).
   */
  cacheEligible: boolean;
}

/**
 * A discovery data source. The orchestrator (providers/discovery.ts) owns
 * caching, candidate building, filtering and sorting; providers implement the
 * data-fetching stages for their service.
 */
export interface Provider {
  readonly id: ProviderId;
  /** Display name: "AniList" / "MyAnimeList". */
  readonly label: string;
  /** "AniList score" / "MyAnimeList score" — used in progress + sidebar copy. */
  readonly scoreLabel: string;
  readonly usernameLabel: string;
  readonly usernamePlaceholder: string;
  readonly usernameRequired: boolean;
  /** True when the service needs app credentials (MAL VITE_MAL_CLIENT_ID — client auth, no user login). */
  readonly requiresAuth: boolean;
  readonly steps: readonly string[];
  readonly phases: Phases;

  fetchProfile(username: string): Promise<DomainUser>;

  fetchList(
    username: string,
    report: StageReport,
    isCancelled: IsCancelled,
  ): Promise<ListResult>;

  fetchRelations(args: RelationsArgs): Promise<StageResult>;

  interactions(args: InteractionArgs): Promise<InteractionResult>;

  /** Post-filter detail pass (MAL). Absent = not needed. */
  enrich?(args: EnrichArgs): Promise<InteractionResult>;
}

/** Narrow type guard for relation edge filtering. */
export function isSelectedRelation(value: KnownRelationType): value is SelectedRelationType {
  return (
    value === 'PREQUEL' ||
    value === 'SEQUEL' ||
    value === 'SIDE_STORY' ||
    value === 'SPIN_OFF' ||
    value === 'ALTERNATIVE'
  );
}

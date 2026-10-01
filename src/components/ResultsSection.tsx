import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, EyeOff, Ghost, Inbox, RefreshCw, RotateCcw, SearchX } from 'lucide-react';
import type { DiscoveryData, DiscoveryItem } from '../providers/types';
import type { DiscoveryState } from '../hooks/useDiscovery';
import { getProvider } from '../providers/registry';
import { ProgressCard } from './ProgressCard';
import { AnimeCard } from './AnimeCard';
import { scrollBehavior } from '../lib/scroll';
import { btn, container, glassCard, sectionPadding } from '../lib/ui';

const RESULTS_PAGE = 24;

interface ResultsSectionProps {
  state: DiscoveryState;
  onRetry: () => void;
  onRefresh: () => void;
  hidden: Set<number>;
  onHide: (item: DiscoveryItem) => void;
  onShowAllHidden: () => void;
}

export function ResultsSection({
  state,
  onRetry,
  onRefresh,
  hidden,
  onHide,
  onShowAllHidden,
}: ResultsSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const prevStatusRef = useRef(state.status);
  const [shown, setShown] = useState(RESULTS_PAGE);

  // Whenever a run starts (idle/error/none/results → loading), scroll the
  // section into view so the user sees the progress card. Re-runs re-scroll
  // too; while loading is already on screen nothing moves.
  useEffect(() => {
    const previous = prevStatusRef.current;
    prevStatusRef.current = state.status;
    if (state.status !== 'loading' || previous === 'loading') return;
    sectionRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  }, [state.status]);

  useEffect(() => {
    setShown(RESULTS_PAGE);
  }, [state.data]);

  if (state.status === 'idle') return null;

  return (
    <section
      id="results"
      ref={sectionRef}
      className={`relative scroll-mt-16 ${sectionPadding}`}
    >
      <div className={container}>
        {state.status === 'loading' && (
          <div className="max-w-[720px]">
            <ProgressCard
              username={state.username}
              steps={getProvider(state.provider).steps}
              progress={state.progress}
            />
          </div>
        )}

        {state.status === 'error' && state.error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${glassCard} max-w-[720px] relative overflow-hidden`}
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-red-500" />
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-red-700">
              <AlertTriangle className="size-3.5" />
              Error
            </p>
            <h3 className="mb-2 font-display text-[22px] font-bold text-[#16233a]">{state.error.message}</h3>
            {state.error.detail && <p className="mb-6 font-mono text-[13px] text-slate-500">{state.error.detail}</p>}
            <button type="button" onClick={onRetry} className={btn('secondary')}>
              <RotateCcw className="size-4" />
              Try again
            </button>
          </motion.div>
        )}

        {state.status === 'none' && state.data && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${glassCard} max-w-[720px] relative overflow-hidden text-center sm:text-left`}
          >
            <div className="mx-auto mb-5 grid size-14 place-items-center rounded-xl border border-[#d3dce8] bg-[#eef1f6] sm:mx-0">
              {state.noneReason === 'no-completed' ? (
                <Inbox className="size-6 text-[#2e51a2]" />
              ) : (
                <Ghost className="size-6 text-[#2e51a2]" />
              )}
            </div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[#2e51a2]">
              {state.noneReason === 'no-completed' ? 'Nothing to scan' : 'No results'}
            </p>
            <h3 className="mb-2 font-display text-[24px] font-bold text-[#16233a]">
              {state.noneReason === 'no-completed'
                ? 'No completed anime yet.'
                : 'Nothing left to discover.'}
            </h3>
            <p className="mb-1 font-mono text-[13px] text-slate-500">
              {state.noneReason === 'no-completed'
                ? `${state.username} hasn’t completed any anime on ${getProvider(state.provider).label} yet.`
                : `Every title matching your selected relations is already on ${state.username}’s list.`}
            </p>
            <p className="mb-6 font-mono text-[13px] text-slate-500">
              {state.noneReason === 'no-completed'
                ? 'Complete a few titles, then run discovery again.'
                : 'Try selecting more relation types, or search a different user.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
              <button type="button" onClick={onRetry} className={btn('secondary')}>
                Back to settings
              </button>
              {state.data.fromCache && (
                <button type="button" onClick={onRefresh} className={btn('secondary')}>
                  <RefreshCw className="size-4" />
                  Refresh data
                </button>
              )}
            </div>
          </motion.div>
        )}

        {state.status === 'results' && state.data && (
          <Results
            data={state.data}
            hidden={hidden}
            onHide={onHide}
            onShowAllHidden={onShowAllHidden}
            onRefresh={onRefresh}
            shown={shown}
            onShowMore={() => setShown((prev) => prev + RESULTS_PAGE)}
          />
        )}
      </div>
    </section>
  );
}

interface ResultsProps {
  data: DiscoveryData;
  hidden: Set<number>;
  onHide: (item: DiscoveryItem) => void;
  onShowAllHidden: () => void;
  onRefresh: () => void;
  shown: number;
  onShowMore: () => void;
}

function Results({
  data,
  hidden,
  onHide,
  onShowAllHidden,
  onRefresh,
  shown,
  onShowMore,
}: ResultsProps) {
  const { user, completedCount, items, fromCache } = data;
  const visible = items.filter((item) => !hidden.has(item.media.id));
  const hiddenCount = items.length - visible.length;
  const page = visible.slice(0, shown);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-card border border-[#d3dce8] bg-white p-4 shadow-[0_2px_10px_rgb(46_81_162/0.08)] sm:p-5"
      >
        <div className="flex items-center gap-3.5">
          <div className="relative">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="size-12 rounded-lg border border-[#d3dce8] object-cover"
              />
            ) : (
              <span className="grid size-12 place-items-center rounded-lg bg-[#2e51a2] font-display text-lg font-bold text-white">
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="absolute -bottom-1 -right-1 size-3.5 rounded-full border-2 border-white bg-emerald-500" />
          </div>
          <div>
            <a
              href={user.url}
              target="_blank"
              rel="noreferrer"
              className="font-display text-[17px] font-bold text-[#2e51a2] transition-colors hover:text-[#223f82] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2e51a2]"
            >
              {user.name}
            </a>
            <p className="font-mono text-[12px] text-slate-500">
              {completedCount} completed · {items.length} unwatched{' '}
              {items.length === 1 ? 'match' : 'matches'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2e51a2]/25 bg-[#2e51a2]/10 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[#2e51a2]">
            {hiddenCount > 0 ? `${visible.length} shown` : `${items.length} results`}
          </span>
          {fromCache && (
            <button type="button" onClick={onRefresh} className={btn('secondary', 'xs')}>
              <RefreshCw className="size-3.5" />
              Refresh data
            </button>
          )}
        </div>
      </motion.div>

      {hiddenCount > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3"
        >
          <p className="flex items-center gap-2 font-mono text-[13px] text-amber-800">
            <EyeOff className="size-4" />
            {hiddenCount} {hiddenCount === 1 ? 'title' : 'titles'} hidden for {user.name}
          </p>
          <button type="button" onClick={onShowAllHidden} className={btn('ghost', 'xs')}>
            Show them
          </button>
        </motion.div>
      )}

      {page.length > 0 ? (
        <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {page.map((item) => (
              <AnimeCard key={item.media.id} item={item} onHide={onHide} />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="rounded-card border border-dashed border-[#9fb0cc] bg-white px-6 py-14 text-center">
          <SearchX className="mx-auto mb-3 size-8 text-slate-300" />
          <p className="font-mono text-[13px] text-slate-500">
            Everything here is hidden — use “Show them” above to bring titles back.
          </p>
        </div>
      )}

      {visible.length > RESULTS_PAGE && (
        <div className="mt-10 flex flex-col items-center gap-3">
          {shown < visible.length && (
            <button type="button" onClick={onShowMore} className={btn('secondary')}>
              Load more · {visible.length - shown} left
            </button>
          )}
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-[#2e51a2]/10">
            <div
              className="h-full rounded-full bg-[#2e51a2] transition-all duration-500"
              style={{ width: `${(Math.min(shown, visible.length) / visible.length) * 100}%` }}
            />
          </div>
          <p className="font-mono text-[12px] text-slate-500">
            Showing {Math.min(shown, visible.length)} of {visible.length}
          </p>
        </div>
      )}
    </>
  );
}

import { RELATION_LABELS } from '../lib/relations';
import { pill } from '../lib/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { EyeOff, Star } from 'lucide-react';
import type { DiscoveryItem } from '../providers/types';

interface AnimeCardProps {
  item: DiscoveryItem;
  onHide: (item: DiscoveryItem) => void;
}

export function AnimeCard({ item, onHide }: AnimeCardProps) {
  const { media, relations, sources } = item;
  const title = media.title.english || media.title.romaji || 'Untitled';

  const metaParts = [
    media.format ?? undefined,
    media.episodes != null ? `${media.episodes} ep` : undefined,
    media.year != null ? String(media.year) : undefined,
  ].filter((part): part is string => Boolean(part));

  const score = media.score;
  const cover = media.cover.large;
  const viaTitle = sources[0]?.title;
  const extraSources = sources.length - 1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="group relative flex flex-col overflow-hidden rounded-card border border-[#d3dce8] bg-white shadow-[0_2px_10px_rgb(46_81_162/0.08)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[#2e51a2]/50 hover:shadow-[0_16px_40px_-12px_rgb(46_81_162/0.35)] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-[#2e51a2]"
    >
      <div
        className="relative aspect-[2/3] overflow-hidden bg-[#eef1f6]"
        style={media.cover.color ? { backgroundColor: media.cover.color } : undefined}
      >
        {cover && (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.07]"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent opacity-80" />

        {score != null && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-md bg-[#2e51a2] px-2.5 py-1 font-display text-xs font-bold text-white shadow">
            <Star className="size-3 fill-white" />
            {(score / 10).toFixed(1)}
          </span>
        )}

        <button
          type="button"
          onClick={() => onHide(item)}
          aria-label={`Hide ${title} from results`}
          className="absolute right-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-md border border-[#d3dce8] bg-white/95 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500 opacity-100 transition-all duration-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2e51a2] md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100"
        >
          <EyeOff className="size-3" />
          Hide
        </button>

        <div className="absolute inset-x-2.5 bottom-2.5 flex flex-wrap gap-1.5">
          <AnimatePresence>
            {relations.map((relation) => (
              <span key={relation} className={pill}>
                {RELATION_LABELS[relation]}
              </span>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 border-t border-[#d3dce8] p-3.5 sm:p-4">
        <h3 className="line-clamp-2 min-h-[2.6em] text-sm font-semibold leading-snug text-[#16233a] sm:text-[15px]">
          <a
            href={media.url}
            target="_blank"
            rel="noreferrer"
            className="transition-colors after:absolute after:inset-0 after:content-[''] hover:text-[#2e51a2] focus-visible:outline-none"
            title={title}
          >
            {title}
          </a>
        </h3>

        <p className="font-mono text-[11px] tabular-nums text-slate-500 sm:text-xs">
          {metaParts.join(' · ')}
        </p>

        <div className="hidden flex-wrap gap-1.5 sm:flex">
          {media.genres.slice(0, 3).map((genre) => (
            <span
              key={genre}
              className="inline-flex items-center rounded-full border border-[#d3dce8] bg-[#f1f5fa] px-2 py-0.5 text-[11px] text-slate-600"
            >
              {genre}
            </span>
          ))}
        </div>

        {viaTitle && (
          <p
            className="mt-auto truncate pt-1 font-mono text-[11px] text-slate-400"
            title={
              extraSources > 0
                ? `via ${sources.map((source) => source.title).join(', ')}`
                : `via ${viaTitle}`
            }
          >
            <span className="text-[#2e51a2]">via</span> {viaTitle}
            {extraSources > 0 ? ` +${extraSources}` : ''}
          </p>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-[#2e51a2] transition-transform duration-300 group-hover:scale-x-100" />
    </motion.div>
  );
}

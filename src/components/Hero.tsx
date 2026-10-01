import { motion } from 'framer-motion';
import { ArrowDown, Clapperboard, GitBranch, Sparkles, Wand2 } from 'lucide-react';
import { btn, container } from '../lib/ui';
import { StatChip } from './Backdrop';

interface HeroProps {
  onStart: () => void;
}

const HERO_ART = [
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1613376023733-0a73315d9b06?w=400&q=80&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1611457194403-d3aca4cf9d11?w=400&q=80&auto=format&fit=crop',
];

export function Hero({ onStart }: HeroProps) {
  return (
    <section className="relative overflow-hidden pt-[clamp(56px,8vw,110px)] pb-[clamp(40px,6vw,72px)]">
      <div className={`${container} relative grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]`}>
        {/* Copy */}
        <div className="text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2e51a2]/25 bg-[#2e51a2]/10 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#2e51a2]"
          >
            <Sparkles className="size-3.5" />
            Discover your next binge
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2e51a2] opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-[#2e51a2]" />
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="font-display text-[clamp(42px,6.5vw,76px)] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#16233a]"
          >
            Find the <span className="text-gradient">sequels</span> and spin-offs you missed.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16 }}
            className="mx-auto mt-6 max-w-[52ch] text-[17px] leading-[1.65] text-slate-600 lg:mx-0"
          >
            Drop in your anime username, pick your favourite relations, and we scan your
            completed list to surface unwatched gems — nothing you&apos;ve already touched.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24 }}
            className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start"
          >
            <button type="button" onClick={onStart} className={btn('primary', 'md')}>
              <Wand2 className="size-4" />
              Start Discovery
            </button>
            <a href="#process" className={btn('secondary', 'md')}>
              How it works
              <ArrowDown className="size-4 transition-transform duration-200 group-hover:translate-y-0.5" />
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start"
          >
            <StatChip value="5" label="relation types" />
            <StatChip value="0" label="spoilers · unwatched only" />
            <StatChip value="2" label="sources · AL + MAL" />
          </motion.div>
        </div>

        {/* Art collage */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="relative mx-auto hidden w-full max-w-[480px] sm:block"
        >
          <div className="absolute -inset-8 rounded-[32px] bg-[radial-gradient(closest-side,rgba(46,81,162,0.16),transparent)] blur-2xl" />
          <div className="relative grid grid-cols-2 gap-4 [perspective:1200px]">
            {HERO_ART.map((src, i) => (
              <motion.div
                key={src}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
                className={`group relative overflow-hidden rounded-xl border border-[#d3dce8] bg-white shadow-[0_8px_30px_-12px_rgb(46_81_162/0.35)] ${
                  i % 2 === 1 ? 'mt-8' : ''
                } ${i > 1 ? '-mt-4' : ''}`}
              >
                <img
                  src={src}
                  alt=""
                  loading="eager"
                  className="aspect-[3/4] w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#16233a]/70 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg bg-white/90">
                    {i % 2 === 0 ? (
                      <GitBranch className="size-3.5 text-[#2e51a2]" />
                    ) : (
                      <Clapperboard className="size-3.5 text-[#2e51a2]" />
                    )}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-white">
                    {['Sequel found', 'Spin-off', 'Side story', 'Alternative'][i]}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* floating badge */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -left-4 top-6 flex items-center gap-2 rounded-xl border border-[#d3dce8] bg-white px-4 py-3 shadow-[0_8px_24px_rgb(46_81_162/0.2)]"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-[#2e51a2] font-display text-sm font-bold text-white">
              98
            </span>
            <span className="text-left">
              <span className="block font-display text-[13px] font-bold leading-none text-[#16233a]">Top rated</span>
              <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500">avg score</span>
            </span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

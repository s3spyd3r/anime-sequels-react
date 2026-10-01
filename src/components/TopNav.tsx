import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { container } from '../lib/ui';

export function TopNav() {
  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="sticky top-0 z-40 bg-[#2e51a2] shadow-[0_2px_8px_rgb(20_40_90/0.35)]"
    >
      <div className={`${container} flex items-center justify-between gap-4 py-3`}>
        <a href="#content" className="group flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-white/15 ring-1 ring-white/25 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105">
            <Sparkles className="size-4 text-white" strokeWidth={2.2} />
          </span>
          <span className="font-display text-[18px] font-bold tracking-tight text-white">
            Anime Sequels
          </span>
        </a>
        <nav className="hidden items-center gap-1 md:flex">
          {[
            { href: '#process', label: 'How it works' },
            { href: 'https://anilist.co', label: 'AniList', external: true },
            { href: 'https://myanimelist.net', label: 'MyAnimeList', external: true },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              {...(link.external ? { target: '_blank', rel: 'noreferrer' } : {})}
              className="rounded-md px-4 py-2 text-sm text-white/80 transition-all duration-200 hover:bg-white/15 hover:text-white"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#discovery"
            className="ml-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-[#2e51a2] transition-all hover:bg-blue-50"
          >
            Start scanning
          </a>
        </nav>
        <a
          href="#discovery"
          className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-[#2e51a2] md:hidden"
        >
          Scan
        </a>
      </div>
    </motion.header>
  );
}

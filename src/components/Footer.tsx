import { Sparkles } from 'lucide-react';
import { container } from '../lib/ui';

export function Footer() {
  return (
    <footer className="relative border-t border-[#d3dce8] bg-white py-8 text-[13px]">
      <div className={`${container} flex flex-col items-center justify-between gap-4 sm:flex-row`}>
        <span className="flex items-center gap-2 font-display font-semibold text-[#16233a]">
          <span className="grid size-7 place-items-center rounded-md bg-[#2e51a2]">
            <Sparkles className="size-3.5 text-white" />
          </span>
          © Anime Sequels · 2026
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-slate-500">
          Powered by AniList GraphQL API · MyAnimeList API
        </span>
      </div>
    </footer>
  );
}

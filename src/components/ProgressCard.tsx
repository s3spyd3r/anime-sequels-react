import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import type { DiscoveryProgress } from '../providers/types';
import { glassCard } from '../lib/ui';

interface ProgressCardProps {
  username: string;
  steps: readonly string[];
  progress: DiscoveryProgress;
}

export function ProgressCard({ username, steps, progress }: ProgressCardProps) {
  const step = Math.min(progress.step, steps.length - 1);
  const percent = Math.round(
    ((step + Math.min(Math.max(progress.fraction, 0), 1)) / steps.length) * 100,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45 }}
      className={`${glassCard} relative overflow-hidden p-6 sm:p-8`}
      role="status"
      aria-live="polite"
    >
      <div className="absolute inset-x-0 top-0 h-[3px] overflow-hidden bg-[#2e51a2]/10">
        <div
          className="h-full bg-[#2e51a2] transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="relative">
        <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#2e51a2]/25 bg-[#2e51a2]/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-[#2e51a2]">
          <Loader2 className="size-3 animate-spin" />
          Discovering · {percent}%
        </p>
        <h3 className="font-display text-[22px] font-bold text-[#16233a]">{steps[step]}</h3>
        <p className="mt-1 font-mono text-[13px] text-slate-500">
          {username ? `${username} · ` : ''}
          {progress.detail || 'Working…'}
        </p>

        <div
          className="my-6 h-2 overflow-hidden rounded-full bg-[#2e51a2]/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Discovery progress"
        >
          <motion.div
            className="h-full rounded-full bg-[#2e51a2]"
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{ width: `${percent}%` }}
          />
        </div>

        <ol className="flex flex-col gap-2">
          {steps.map((label, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <li
                key={label}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-all duration-300 ${
                  active
                    ? 'border-[#2e51a2]/30 bg-[#2e51a2]/[.07]'
                    : done
                      ? 'border-transparent'
                      : 'border-transparent opacity-50'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-xs ${
                    done
                      ? 'bg-emerald-100 text-emerald-700'
                      : active
                        ? 'bg-[#2e51a2] text-white'
                        : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {done ? (
                    <Check className="size-3.5" strokeWidth={3} />
                  ) : active ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-current" />
                  )}
                </span>
                <span className={active ? 'font-semibold text-[#16233a]' : done ? 'text-slate-700' : 'text-slate-400'}>
                  {label}
                </span>
                {active && (
                  <span className="ml-auto flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <motion.span
                        key={d}
                        className="size-1 rounded-full bg-[#2e51a2]"
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.2 }}
                      />
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </motion.div>
  );
}

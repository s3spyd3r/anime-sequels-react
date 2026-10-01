import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Check, Database, ListFilter, Loader2, Search, SlidersHorizontal, Sparkles, Trophy } from 'lucide-react';
import { DEFAULT_RELATIONS, RELATION_OPTIONS } from '../lib/relations';
import { env } from '../lib/env';
import { btn, container, fieldLabel, glassCard, sectionPadding } from '../lib/ui';
import { getProvider } from '../providers/registry';
import type { ProviderId } from '../providers/types';
import type { SelectedRelationType } from '../types/domain';

interface DiscoverySectionProps {
  busy: boolean;
  onSubmit: (
    provider: ProviderId,
    username: string,
    relationTypes: SelectedRelationType[],
  ) => void;
}

interface FormErrors {
  auth?: string;
  username?: string;
  relations?: string;
}

export function DiscoverySection({ busy, onSubmit }: DiscoverySectionProps) {
  const [provider, setProvider] = useState<ProviderId>('anilist');
  const [username, setUsername] = useState('');
  const [relationTypes, setRelationTypes] = useState<SelectedRelationType[]>(DEFAULT_RELATIONS);
  const [errors, setErrors] = useState<FormErrors>({});
  const cfg = getProvider(provider);

  const clearError = (key: keyof FormErrors) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const toggleRelation = (value: SelectedRelationType) => {
    setRelationTypes((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value],
    );
    clearError('relations');
  };

  const switchProvider = (next: ProviderId) => {
    if (busy || next === provider) return;
    setProvider(next);
    setErrors({});
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const trimmed = username.trim();
    const nextErrors: FormErrors = {};

    if (cfg.requiresAuth && !env('VITE_MAL_CLIENT_ID')) {
      nextErrors.auth =
        'MyAnimeList isn’t configured — set VITE_MAL_CLIENT_ID in .env (see README).';
    }
    if (cfg.usernameRequired && !trimmed) {
      nextErrors.username = `Enter ${cfg.label} username.`;
    }
    if (relationTypes.length === 0) {
      nextErrors.relations = 'Select at least one relation type.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit(provider, trimmed, relationTypes);
  };

  return (
    <section id="discovery" className={`relative scroll-mt-20 ${sectionPadding}`}>
      <div className={container}>
        <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
          <motion.form
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55 }}
            className={`${glassCard} relative overflow-hidden p-6 sm:p-8`}
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-[#2e51a2]" />
            <div className="mb-7 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-[#2e51a2]">
                  <SlidersHorizontal className="size-5 text-white" />
                </span>
                <div>
                  <h2 className="font-display text-[22px] font-bold tracking-tight text-[#16233a]">
                    Discovery Settings
                  </h2>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Tune your scan
                  </p>
                </div>
              </div>
              {busy && (
                <span className="inline-flex items-center gap-2 rounded-full border border-[#2e51a2]/25 bg-[#2e51a2]/10 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-[#2e51a2]">
                  <Loader2 className="size-3.5 animate-spin" />
                  Live
                </span>
              )}
            </div>

            <div className="flex flex-col gap-7">
              <div className="flex flex-col gap-2.5">
                <span className={fieldLabel}>
                  <Database className="mr-1.5 inline size-3.5 -mt-0.5 text-[#2e51a2]" />
                  Data Source
                </span>
                <div
                  role="radiogroup"
                  aria-label="Data source"
                  className="grid grid-cols-2 gap-2 rounded-xl border border-[#d3dce8] bg-[#eef1f6] p-1.5"
                >
                  {(['anilist', 'mal'] as const).map((id) => {
                    const active = provider === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={busy}
                        onClick={() => switchProvider(id)}
                        className={`relative rounded-lg px-4 py-3 font-display text-sm font-semibold transition-all duration-200 disabled:opacity-50 ${
                          active
                            ? 'bg-[#2e51a2] text-white shadow-[0_2px_8px_rgb(46_81_162/0.4)]'
                            : 'text-slate-500 hover:bg-white hover:text-[#2e51a2]'
                        }`}
                      >
                        {getProvider(id).label}
                      </button>
                    );
                  })}
                </div>
                {errors.auth && (
                  <p role="alert" className="mt-1 flex items-start gap-1.5 text-[13px] text-red-600">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    {errors.auth}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                <label htmlFor="username" className={fieldLabel}>
                  <Search className="mr-1.5 inline size-3.5 -mt-0.5 text-[#2e51a2]" />
                  {cfg.usernameLabel}
                </label>
                <div className="relative">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-btn border border-[#d3dce8] bg-white px-4 py-3.5 pl-11 text-[15px] text-[#16233a] placeholder:text-slate-400 transition-all duration-200 focus:border-[#2e51a2] focus:outline-none focus:ring-4 focus:ring-[#2e51a2]/15 hover:border-[#9fb0cc]"
                    placeholder={cfg.usernamePlaceholder}
                    value={username}
                    aria-invalid={Boolean(errors.username)}
                    aria-describedby={errors.username ? 'username-error' : undefined}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      clearError('username');
                    }}
                  />
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                </div>
                {errors.username && (
                  <p id="username-error" role="alert" className="flex items-center gap-1.5 text-[13px] text-red-600">
                    <AlertCircle className="size-4 shrink-0" />
                    {errors.username}
                  </p>
                )}
              </div>

              <fieldset className="flex flex-col gap-2.5">
                <legend className={fieldLabel}>
                  <ListFilter className="mr-1.5 inline size-3.5 -mt-0.5 text-[#2e51a2]" />
                  Relation Types
                </legend>
                <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                  {RELATION_OPTIONS.map((option) => {
                    const checked = relationTypes.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className={`group flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-medium transition-all duration-200 ${
                          checked
                            ? 'border-[#2e51a2] bg-[#2e51a2]/10 text-[#16233a]'
                            : 'border-[#d3dce8] bg-white text-slate-500 hover:border-[#2e51a2]/50 hover:text-[#2e51a2]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={checked}
                          onChange={() => toggleRelation(option.value)}
                        />
                        <span
                          className={`grid size-5 shrink-0 place-items-center rounded-md border transition-all ${
                            checked
                              ? 'border-transparent bg-[#2e51a2]'
                              : 'border-[#c3cede] bg-white group-hover:border-[#2e51a2]'
                          }`}
                        >
                          {checked && <Check className="size-3.5 text-white" strokeWidth={3} />}
                        </span>
                        {option.label}
                      </label>
                    );
                  })}
                </div>
                {errors.relations && (
                  <p role="alert" className="mt-1 flex items-center gap-1.5 text-[13px] text-red-600">
                    <AlertCircle className="size-4 shrink-0" />
                    {errors.relations}
                  </p>
                )}
              </fieldset>

              <button type="submit" disabled={busy} className={`${btn('primary', 'md')} w-full py-4 text-base`}>
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Discovering…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Generate Recommendations
                  </>
                )}
              </button>
            </div>
          </motion.form>

          <aside className="flex flex-col gap-4">
            {[
              {
                id: 'process',
                icon: Search,
                eyebrow: 'Process',
                title: 'How we find them',
                body: `We fetch your 'Completed' list, query related media for each title, and filter out anything you've already started.`,
              },
              {
                id: 'ordering',
                icon: Trophy,
                eyebrow: 'Ordering',
                title: 'Quality first',
                body: `Results are grouped by the source anime and sorted by their ${cfg.scoreLabel} to ensure you see the best content first.`,
              },
            ].map((block, i) => (
              <motion.div
                key={block.id}
                id={block.id}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`${glassCard} scroll-mt-24 relative overflow-hidden p-6`}
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-[#2e51a2]/80" />
                <span className="mb-4 grid size-10 place-items-center rounded-lg bg-[#2e51a2]">
                  <block.icon className="size-5 text-white" />
                </span>
                <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-[#2e51a2]">{block.eyebrow}</p>
                <h3 className="mb-2 font-display text-[19px] font-bold text-[#16233a]">{block.title}</h3>
                <p className="font-mono text-[13px] leading-relaxed text-slate-500">{block.body}</p>
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative overflow-hidden rounded-card border border-[#2e51a2]/25 bg-[#2e51a2]/[.07] p-6"
            >
              <Sparkles className="absolute -right-3 -top-3 size-20 text-[#2e51a2]/10" />
              <p className="font-display text-[15px] font-semibold text-[#16233a]">Pro tip</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Keep Prequel + Sequel on for the cleanest canon path. Add Side Story later for extras.
              </p>
            </motion.div>
          </aside>
        </div>
      </div>
    </section>
  );
}

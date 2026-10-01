/** Shared Tailwind class strings — MyAnimeList-inspired light design system. */

export const container = 'mx-auto w-full max-w-[1160px] px-5 sm:px-8';

export const sectionPadding = 'py-[clamp(48px,7vw,88px)]';

export const card =
  'rounded-card border border-[#d3dce8] bg-white p-6 sm:p-8 shadow-[0_2px_12px_rgb(46_81_162/0.08)]';

export const glassCard =
  'rounded-card border border-[#d3dce8] bg-white shadow-[0_2px_12px_rgb(46_81_162/0.08)]';

export const eyebrow =
  'mb-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[#2e51a2]';

export const meta = 'font-mono text-[13px] leading-relaxed text-slate-500';

export const h1 =
  'font-display text-[clamp(42px,6.5vw,78px)] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#16233a]';

export const h2 =
  'font-display text-[clamp(28px,4vw,44px)] font-bold leading-[1.08] tracking-[-0.02em] text-[#16233a]';

export const h3 = 'font-display text-[21px] font-semibold leading-[1.3] tracking-[-0.01em] text-[#16233a]';

export const lead = 'text-[17px] sm:text-[19px] leading-[1.65] text-slate-600 max-w-[60ch]';

export type BtnVariant = 'primary' | 'secondary' | 'ghost';
export type BtnSize = 'md' | 'sm' | 'xs';

const BTN_CORE =
  'group relative inline-flex w-fit cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-btn border font-display font-semibold tracking-[-0.005em] transition-all duration-200 active:translate-y-px active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2e51a2] disabled:cursor-not-allowed disabled:opacity-50';

const BTN_SIZES: Record<BtnSize, string> = {
  md: 'px-6 py-3 text-[15px]',
  sm: 'px-4 py-2.5 text-sm',
  xs: 'px-3 py-1.5 text-[13px] font-medium',
};

const BTN_VARIANTS: Record<BtnVariant, string> = {
  primary:
    'border-transparent bg-[#2e51a2] text-white shadow-[0_2px_8px_rgb(46_81_162/0.35)] hover:bg-[#223f82]',
  secondary:
    'border-[#d3dce8] bg-white text-[#2e51a2] hover:border-[#2e51a2] hover:bg-[#eef2f9]',
  ghost: 'border-transparent bg-transparent font-body font-normal text-slate-500 hover:text-[#2e51a2] hover:bg-[#2e51a2]/5',
};

/** Button class builder: btn(variant, size) — never compose conflicting sizes. */
export function btn(variant: BtnVariant = 'primary', size: BtnSize = 'md'): string {
  return `${BTN_CORE} ${BTN_SIZES[size]} ${BTN_VARIANTS[variant]}`;
}

export const btnPrimary = btn('primary');
export const btnSecondary = btn('secondary');

export const btnArrow = (
  <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
    →
  </span>
);

export const input =
  'w-full rounded-btn border border-[#d3dce8] bg-white px-4 py-3 text-[15px] text-[#16233a] placeholder:text-slate-400 transition-all duration-200 focus:border-[#2e51a2] focus:outline-none focus:ring-4 focus:ring-[#2e51a2]/15 hover:border-[#9fb0cc]';

export const pill =
  'inline-flex items-center gap-1 rounded-full border border-[#2e51a2]/25 bg-[#2e51a2]/10 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[#2e51a2]';

export const tag =
  'inline-flex items-center rounded-full border border-[#d3dce8] bg-[#f1f5fa] px-2.5 py-1 text-xs text-slate-600';

export const dangerText = 'text-[13px] text-red-600';

export const fieldLabel = 'font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-500';

export const linkMuted =
  'text-sm text-slate-500 transition-colors hover:text-[#2e51a2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2e51a2]';

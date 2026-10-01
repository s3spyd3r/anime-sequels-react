/** Fixed backdrop: subtle MAL-style light blue-gray wash. Visual only, no animation. */
export function BackgroundFX() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* base */}
      <div className="absolute inset-0 bg-[#e6ebf3]" />
      {/* soft blue washes */}
      <div className="absolute -top-[20%] left-1/2 h-[60vh] w-[90vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(46,81,162,0.10),transparent)] blur-3xl" />
      <div className="absolute top-[20%] -left-[10%] h-[50vh] w-[40vw] rounded-full bg-[radial-gradient(closest-side,rgba(59,130,196,0.10),transparent)] blur-3xl" />
      <div className="absolute top-[40%] -right-[10%] h-[50vh] w-[40vw] rounded-full bg-[radial-gradient(closest-side,rgba(46,81,162,0.07),transparent)] blur-3xl" />
      {/* faint grid */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'linear-gradient(rgba(46,81,162,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(46,81,162,0.05) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 75%)',
        }}
      />
    </div>
  );
}

/** Small stat chip used in hero + results. Visual only. */
export function StatChip({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#d3dce8] bg-white px-4 py-3 shadow-[0_1px_4px_rgb(46_81_162/0.08)]">
      <span className="font-display text-lg font-bold text-[#2e51a2]">{value}</span>
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">{label}</span>
    </div>
  );
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

export function scrollToId(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
}

/** Scrolls to the discovery form and focuses the username input. */
export function scrollToDiscovery(): void {
  scrollToId('discovery');
  window.setTimeout(
    () => document.getElementById('username')?.focus({ preventScroll: true }),
    prefersReducedMotion() ? 0 : 450,
  );
}

/**
 * Environment access that works in both Vite (import.meta.env) and Node
 * scripts (process.env, populated by scripts/_env.ts).
 */
export function env(name: string): string {
  const meta = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const fromVite = meta?.[name];
  if (fromVite) return fromVite;
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[name] ?? '';
}

/**
 * Minimal .env loader for Node scripts (vite loads .env for the app itself).
 * Values already present in process.env win.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadEnv(file = '.env'): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const text = readFileSync(resolve(process.cwd(), file), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
      // Also expose to process.env so app code (src/lib/env.ts) sees them under tsx.
      if (process.env[key] == null) process.env[key] = value;
    }
  } catch {
    /* no .env file */
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string' && value.length > 0) out[key] = value;
  }
  return out;
}

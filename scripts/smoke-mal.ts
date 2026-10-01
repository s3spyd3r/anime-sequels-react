/**
 * MyAnimeList pipeline smoke test — mirrors scripts/smoke.ts but through the
 * MAL provider (app-level client auth, list statuses, per-title relation/
 * detail cache, enrich pass).
 *
 * Usage:
 *   npx tsx scripts/smoke-mal.ts <mal-username>
 *
 * Requires VITE_MAL_CLIENT_ID in .env — the client authenticates itself with
 * the X-MAL-CLIENT-ID header (no user login, no token flow). Skips cleanly
 * (exit 0) when not configured.
 *
 * First run fetches relations one title per request at a polite rate: a few
 * minutes for a mid-sized list. The 30-day title cache keeps later runs fast.
 */
import { loadEnv } from './_env';
import { clearSessionCache, runDiscovery } from '../src/providers/discovery';
import { addHidden, clearHidden, getHidden, removeHidden } from '../src/lib/hidden';
import { malProvider } from '../src/providers/mal/provider';

const ALL_TYPES = ['PREQUEL', 'SEQUEL', 'SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE'] as const;
const noop = () => {};

const log =
  (label: string) =>
  (p: { step: number; detail: string; fraction: number }): void =>
    console.log(`${label} [step ${p.step}] ${p.detail || '…'} (${Math.round(p.fraction * 100)}%)`);

async function main() {
  const env = loadEnv();
  if (!env.VITE_MAL_CLIENT_ID) {
    console.log(
      'SKIPPED — MyAnimeList not configured. Set VITE_MAL_CLIENT_ID/VITE_MAL_CLIENT_SECRET in .env.',
    );
    process.exit(0);
  }

  const username = process.argv[2];
  if (!username) {
    console.log('SKIPPED — pass a MyAnimeList username: npx tsx scripts/smoke-mal.ts <username>');
    process.exit(0);
  }
  console.log(`--- MAL smoke for ${username} ---`);

  // --- run 1: fresh process, nothing cached -------------------------------
  console.log('--- run 1: all relation types (expect fromCache=false) ---');
  const t0 = Date.now();
  const run1 = await runDiscovery({
    provider: 'mal',
    username,
    relationTypes: [...ALL_TYPES],
    onProgress: log('R1'),
    isCancelled: () => false,
  });
  console.log(
    `completed=${run1.completedCount} results=${run1.items.length} fromCache=${run1.fromCache} in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
  if (run1.fromCache) throw new Error('run 1 should not be served from cache');
  if (run1.completedCount === 0) throw new Error('expected completed titles');
  if (run1.items.length === 0) throw new Error('expected at least one result');

  for (const item of run1.items.slice(0, 5)) {
    const title = item.media.title.english ?? item.media.title.romaji;
    console.log(
      `  - ${title} [${item.relations.join('+')}] score=${item.media.score} via ${item.sources[0]?.title}`,
    );
  }
  const scores = run1.items.map((i) => i.media.score ?? -1);
  for (let i = 1; i < scores.length; i += 1) {
    if (scores[i] > scores[i - 1]) throw new Error('results not sorted by score desc');
  }
  if (run1.items.some((i) => i.relations.length === 0)) throw new Error('item missing relation');
  if (run1.items.some((i) => i.media.type !== 'ANIME')) throw new Error('non-anime result');
  if (run1.items.some((i) => i.media.partial)) throw new Error('enrich left a partial item');

  // No result may exist on the user's list in ANY status — re-read the live
  // list through the provider (fresh network, independent of the session).
  const { interacted } = await malProvider.fetchList(username, noop, () => false);
  const onList = new Set(interacted);
  const leaked = run1.items.filter((i) => onList.has(i.media.id));
  if (leaked.length > 0) {
    throw new Error(`${leaked.length} results already on ${username}'s list (planned/watching/…)`);
  }
  console.log(`interaction filter OK (checked ${run1.items.length} results, 0 on the list)`);

  // --- hidden list (per provider + username) ------------------------------
  console.log('--- hidden list roundtrip ---');
  const probeId = run1.items[0].media.id;
  clearHidden('mal', username);
  clearHidden('anilist', username);
  if (getHidden('mal', username).size !== 0) throw new Error('hidden list should start empty');
  addHidden('mal', username, probeId);
  if (!getHidden('mal', username).has(probeId)) throw new Error('addHidden failed');
  if (getHidden('anilist', username).size !== 0) {
    throw new Error('hidden list not provider-scoped');
  }
  removeHidden('mal', username, probeId);
  if (getHidden('mal', username).has(probeId)) throw new Error('removeHidden failed');
  clearHidden('mal', username);
  console.log('hidden list OK (add/remove/scoped/clear)');

  // --- run 2: L1 cleared, must come from the persistent cache -------------
  console.log('--- run 2: simulate reload (memory cleared, expect fromCache=true) ---');
  clearSessionCache();
  const t2 = Date.now();
  const run2 = await runDiscovery({
    provider: 'mal',
    username,
    relationTypes: [...ALL_TYPES],
    onProgress: log('R2'),
    isCancelled: () => false,
  });
  console.log(
    `results=${run2.items.length} fromCache=${run2.fromCache} in ${Date.now() - t2}ms`,
  );
  if (!run2.fromCache) throw new Error('run 2 should be served from the persistent cache');
  if (run2.items.length !== run1.items.length) throw new Error('cached run returned different results');

  // --- run 3: force refresh bypasses every cache layer (incl. title cache)
  console.log('--- run 3: forceRefresh (expect fromCache=false) ---');
  const t3 = Date.now();
  const run3 = await runDiscovery({
    provider: 'mal',
    username,
    relationTypes: ['SEQUEL'],
    forceRefresh: true,
    onProgress: log('R3'),
    isCancelled: () => false,
  });
  console.log(
    `results=${run3.items.length} fromCache=${run3.fromCache} in ${((Date.now() - t3) / 1000).toFixed(1)}s`,
  );
  if (run3.fromCache) throw new Error('forceRefresh must bypass the cache');
  if (run3.items.some((i) => i.relations.some((r) => r !== 'SEQUEL'))) {
    throw new Error('relation type filter failed');
  }
  if (run3.items.length > run1.items.length) throw new Error('filtered run larger than full run');

  // --- run 4: invalid username -------------------------------------------
  console.log('--- run 4: invalid username ---');
  try {
    await runDiscovery({
      provider: 'mal',
      username: 'zzz_no_such_user_zzz_999',
      relationTypes: ['SEQUEL'],
      onProgress: noop,
      isCancelled: () => false,
    });
    throw new Error('expected not_found error');
  } catch (error) {
    const name = (error as Error).name;
    const code = (error as { code?: string }).code;
    if (name !== 'MalError' || code !== 'not_found') throw error;
    console.log(`expected error: ${(error as Error).message}`);
  }

  console.log('SMOKE MAL OK');
}

main().catch((error) => {
  console.error('SMOKE MAL FAILED', error);
  process.exit(1);
});

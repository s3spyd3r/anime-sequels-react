import { clearSessionCache, runDiscovery } from '../src/providers/discovery';
import { fetchInteractedIds } from '../src/providers/anilist/queries';
import { addHidden, clearHidden, getHidden, removeHidden } from '../src/lib/hidden';

const username = process.argv[2] ?? 'JesterOW';
const ALL_TYPES = ['PREQUEL', 'SEQUEL', 'SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE'] as const;
const noop = () => {};

const log =
  (label: string) =>
  (p: { step: number; detail: string; fraction: number }): void =>
    console.log(`${label} [step ${p.step}] ${p.detail || '…'} (${Math.round(p.fraction * 100)}%)`);

async function main() {
  // --- run 1: fresh process, nothing cached -------------------------------
  console.log(`--- run 1: ${username}, all relation types (expect fromCache=false) ---`);
  const t0 = Date.now();
  const run1 = await runDiscovery({
    provider: 'anilist',
    username,
    relationTypes: [...ALL_TYPES],
    onProgress: log('R1'),
    isCancelled: () => false,
  });
  const run1Ms = Date.now() - t0;
  console.log(
    `completed=${run1.completedCount} results=${run1.items.length} fromCache=${run1.fromCache} in ${run1Ms}ms`,
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

  // No result may exist on the user's list in ANY status (Planned, Watching,
  // Paused, Dropped…). Re-checks every result id through the real API.
  const resultIds = run1.items.map((i) => i.media.id);
  let leaked = 0;
  for (let i = 0; i < resultIds.length; i += 50) {
    leaked += (await fetchInteractedIds(username, resultIds.slice(i, i + 50))).length;
  }
  if (leaked > 0) {
    throw new Error(`${leaked} results already on ${username}'s list (planned/watching/…)`);
  }
  console.log(`interaction filter OK (checked ${resultIds.length} results, 0 on the list)`);

  // --- hidden list (per provider + username, localStorage-backed) ----------
  console.log('--- hidden list roundtrip ---');
  const probeId = run1.items[0].media.id;
  clearHidden('anilist', username);
  clearHidden('mal', username);
  if (getHidden('anilist', username).size !== 0) throw new Error('hidden list should start empty');
  addHidden('anilist', username, probeId);
  if (!getHidden('anilist', username).has(probeId)) throw new Error('addHidden failed');
  addHidden('anilist', username, 999999999);
  if (getHidden('anilist', username).size !== 2) throw new Error('expected 2 hidden ids');
  if (getHidden('anilist', `${username}_other`).size !== 0) {
    throw new Error('hidden list not username-scoped');
  }
  if (getHidden('mal', username).size !== 0) {
    throw new Error('hidden list not provider-scoped');
  }
  removeHidden('anilist', username, probeId);
  if (getHidden('anilist', username).has(probeId)) throw new Error('removeHidden failed');
  clearHidden('anilist', username);
  console.log('hidden list OK (add/remove/scoped/clear)');

  // --- run 2: L1 cleared, must come from the persistent cache -------------
  console.log('--- run 2: simulate reload (memory cleared, expect fromCache=true) ---');
  clearSessionCache();
  const t2 = Date.now();
  const run2 = await runDiscovery({
    provider: 'anilist',
    username,
    relationTypes: [...ALL_TYPES],
    onProgress: log('R2'),
    isCancelled: () => false,
  });
  const run2Ms = Date.now() - t2;
  console.log(`results=${run2.items.length} fromCache=${run2.fromCache} in ${run2Ms}ms`);
  if (!run2.fromCache) throw new Error('run 2 should be served from the persistent cache');
  if (run2.items.length !== run1.items.length) throw new Error('cached run returned different results');
  if (run2Ms > 5000) throw new Error('cached run was unexpectedly slow');

  // --- run 3: force refresh bypasses every cache layer --------------------
  console.log('--- run 3: forceRefresh (expect fromCache=false) ---');
  const t3 = Date.now();
  const run3 = await runDiscovery({
    provider: 'anilist',
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
  if (run3.items.length === 0) throw new Error('expected sequel results');
  if (run3.items.some((i) => i.relations.some((r) => r !== 'SEQUEL'))) {
    throw new Error('relation type filter failed');
  }
  if (run3.items.length > run1.items.length) throw new Error('filtered run larger than full run');

  // --- run 4: invalid username -------------------------------------------
  console.log('--- run 4: invalid username ---');
  try {
    await runDiscovery({
      provider: 'anilist',
      username: 'zzz_no_such_user_zzz_999',
      relationTypes: ['SEQUEL'],
      onProgress: noop,
      isCancelled: () => false,
    });
    throw new Error('expected not_found error');
  } catch (error) {
    if ((error as Error).name !== 'AniListError') throw error;
    console.log(`expected error: ${(error as Error).message}`);
  }

  console.log('SMOKE OK');
}

main().catch((error) => {
  console.error('SMOKE FAILED', error);
  process.exit(1);
});

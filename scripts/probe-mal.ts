/**
 * Read-only MyAnimeList API probe — verifies the assumptions the MAL provider
 * is built on before any app code depends on them. **No user login anywhere**:
 * everything runs with the bundled client credentials.
 *
 *   1. Client auth: confirm `grant_type=client_credentials` stays rejected
 *      (the app is header-only by design) and that the classic
 *      `X-MAL-CLIENT-ID` header works directly.
 *   2. Which auth scheme do the anime and list endpoints actually accept?
 *   3. Does the related_anime sub-field expansion return detail fields, and
 *      what is the entry shape (wrapped {node, relation_type} vs flat)?
 *   4. List limits, per-entry status field, status= filter (for a public
 *      username — @me does not exist without a user token).
 *   5. Rate-limit signals (headers / 429 behaviour).
 *
 * Usage:
 *   VITE_MAL_CLIENT_ID=... VITE_MAL_CLIENT_SECRET=... \
 *     npx tsx scripts/probe-mal.ts <public_mal_username>
 *   (credentials are read from .env if not in the environment)
 */
import { loadEnv } from './_env';

const API = 'https://api.myanimelist.net/v2';
const TOKEN_URL = 'https://myanimelist.net/v1/oauth2/token';
const findings: string[] = [];

type Auth = { clientId?: string };

function note(finding: string): void {
  findings.push(finding);
  console.log(`  ✓ ${finding}`);
}

function miss(finding: string): void {
  findings.push(`MISSING: ${finding}`);
  console.log(`  ? ${finding}`);
}

async function get(
  path: string,
  opts: Auth = {},
): Promise<{ status: number; headers: Headers; body: unknown }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.clientId) headers['X-MAL-CLIENT-ID'] = opts.clientId;
  const res = await fetch(`${API}${path}`, { headers });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { status: res.status, headers: res.headers, body };
}

async function postForm(
  url: string,
  form: Record<string, string>,
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(form),
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { status: res.status, body };
}

function describeRateHeaders(headers: Headers): void {
  const interesting = [...headers.keys()].filter(
    (h) => h.startsWith('x-rate') || h === 'retry-after' || h === 'x-request',
  );
  if (interesting.length > 0) {
    for (const h of interesting) console.log(`    header ${h}: ${headers.get(h)}`);
  } else {
    console.log('    no rate-limit headers exposed');
  }
}

async function main() {
  const env = loadEnv();
  const clientId = env.VITE_MAL_CLIENT_ID;
  const clientSecret = env.VITE_MAL_CLIENT_SECRET;
  const username = process.argv[2];

  if (!clientId) {
    console.error('Missing VITE_MAL_CLIENT_ID (set it in .env or the environment).');
    process.exit(1);
  }

  /* ------------------------------------------------------------------ */
  console.log('\n== 0. client auth (no user login) ==');
  // Known dead end — the app never attempts it; probe documents that the
  // rejection still holds so nobody re-adds a token flow by accident.
  const grant = await postForm(TOKEN_URL, {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret ?? '',
  });
  const grantBody = grant.body as { access_token?: string; expires_in?: number; error?: string };
  if (grant.status === 200 && typeof grantBody.access_token === 'string') {
    note(
      `client-credentials grant works (expires_in=${grantBody.expires_in ?? '?'}) — unused: app is header-only`,
    );
  } else {
    note(
      `client-credentials grant rejected: HTTP ${grant.status} ${JSON.stringify(grant.body).slice(0, 200)} — header-only auth confirmed`,
    );
  }

  const animeNoAuth = await get('/anime/30230?fields=id');
  const animeHeader = await get('/anime/30230?fields=id', { clientId });
  console.log(`    anime endpoint: no-auth=${animeNoAuth.status} header=${animeHeader.status}`);
  if (animeNoAuth.status === 200) note('anime endpoint works without any auth');
  if (animeHeader.status === 200) note('anime endpoint accepts X-MAL-CLIENT-ID');
  if (animeHeader.status !== 200) {
    miss('anime endpoint rejected the client id — check VITE_MAL_CLIENT_ID');
  }

  // Header mode is the only scheme the app uses.
  let auth: Auth = { clientId };

  if (username) {
    const u = encodeURIComponent(username);
    const listNoAuth = await get(`/users/${u}/animelist?fields=id&limit=1`);
    const listHeader = await get(`/users/${u}/animelist?fields=id&limit=1`, { clientId });
    console.log(`    list endpoint: no-auth=${listNoAuth.status} header=${listHeader.status}`);
    if (listHeader.status === 200) {
      note('list endpoint accepts X-MAL-CLIENT-ID');
    } else {
      miss(
        `list endpoint rejected the header: header=${listHeader.status} ` +
          `${JSON.stringify(listHeader.body).slice(0, 200)}`,
      );
    }
  } else {
    miss('pass a public username to probe list access — lists are the critical path');
  }

  /* ------------------------------------------------------------------ */
  console.log('\n== 1+2. related_anime shape and sub-field expansion ==');
  // Steins;Gate (30230) has known prequel+sequel relations.
  const basic = await get('/anime/30230?fields=related_anime', auth);
  if (basic.status === 200) {
    const node = (basic.body as { related_anime?: unknown }).related_anime;
    console.log(`    related_anime entry: ${JSON.stringify(node?.[0] ?? null).slice(0, 300)}`);
    const first = (node as Record<string, unknown>[])?.[0];
    if (first && 'node' in first && 'relation_type' in first) {
      note('related_anime entries are { node, relation_type }');
    } else if (first && 'id' in first && 'relation_type' in first) {
      note('related_anime entries are flat { ...anime, relation_type }');
    } else {
      miss(`related_anime entry shape unknown: ${JSON.stringify(first).slice(0, 200)}`);
    }
    const relationTypes = (Array.isArray(node) ? node : []).map((e: Record<string, unknown>) => {
      const inner = (e.node ?? e) as Record<string, unknown>;
      return `${String(e.relation_type ?? '?')}→${String(inner.title ?? inner.id ?? '?')}`;
    });
    console.log(`    relations: ${relationTypes.join(', ')}`);
  } else {
    miss(`related_anime request failed: HTTP ${basic.status} ${JSON.stringify(basic.body).slice(0, 200)}`);
  }

  const expanded = await get(
    '/anime/30230?fields=' +
      encodeURIComponent(
        'related_anime{node{id,title,main_picture,alternative_titles,media_type,mean,num_episodes,start_season,genres,num_list_users,nsfw},relation_type}',
      ),
    auth,
  );
  if (expanded.status === 200) {
    const entry = ((expanded.body as { related_anime?: Record<string, unknown>[] })
      .related_anime ?? [])[0];
    const inner = (entry?.node ?? entry) as Record<string, unknown>;
    const hasMean = 'mean' in inner;
    const hasEpisodes = 'num_episodes' in inner;
    if (hasMean && hasEpisodes) {
      note('sub-field expansion works: related nodes include mean/num_episodes/… (no detail pass needed)');
    } else if (inner && Object.keys(inner).length > 0) {
      miss(
        `sub-field expansion returned only: ${Object.keys(inner).join(',')} — detail pass required`,
      );
    } else {
      miss('sub-field expansion rejected or empty');
    }
    console.log(`    expanded node sample: ${JSON.stringify(inner).slice(0, 300)}`);
  } else {
    miss(`expansion request failed: HTTP ${expanded.status} ${JSON.stringify(expanded.body).slice(0, 200)}`);
  }

  /* ------------------------------------------------------------------ */
  if (username) {
    const u = encodeURIComponent(username);
    console.log(`\n== 3+4+5. list probes for "${username}" ==`);

    const profile = await get(`/users/${u}?fields=id,name,picture`, auth);
    if (profile.status === 200) {
      const user = profile.body as { id: number; name: string; picture?: string };
      note(`profile: id=${user.id} name=${user.name} picture=${user.picture ?? '(none)'}`);
    } else {
      // Known dead end: /users/{name} 404s under client auth; the app
      // validates existence through the list endpoint instead.
      if (profile.status === 404) {
        note(`GET /users/${u} → 404 (endpoint unavailable with client auth; app uses the list endpoint)`);
      } else {
        miss(`profile failed: HTTP ${profile.status} ${JSON.stringify(profile.body).slice(0, 200)}`);
      }
    }
    describeRateHeaders(profile.headers);

    // max limit
    for (const limit of [1000, 500, 100]) {
      const res = await get(`/users/${u}/animelist?fields=id&limit=${limit}`, auth);
      if (res.status === 200) {
        const n = ((res.body as { data?: unknown[] }).data ?? []).length;
        note(`limit=${limit} accepted (returned ${n} entries)`);
        break;
      }
      miss(`limit=${limit} rejected: HTTP ${res.status}`);
    }

    // list_status field shape — MAL returns it as an entry-level sibling of
    // `node` (data[].list_status), never inside data[].node.
    const withStatus = await get(`/users/${u}/animelist?fields=list_status&limit=5`, auth);
    if (withStatus.status === 200) {
      const first = (
        (withStatus.body as { data?: { node: Record<string, unknown>; list_status?: { status?: string } }[] })
          .data ?? []
      )[0];
      if (first?.list_status?.status) {
        note(`entry-level list_status (sibling of node), sample status=${first.list_status.status}`);
      } else if (first?.node && ('my_list_status' in first.node || 'list_status' in first.node)) {
        const st = (first.node.my_list_status ?? first.node.list_status) as { status?: string };
        note(`node-level status field (sample status=${st.status ?? '?'})`);
      } else {
        miss(`list_status not present anywhere in: ${JSON.stringify(first).slice(0, 200)}`);
      }
    } else {
      miss(`list_status request failed: HTTP ${withStatus.status}`);
    }

    // status filter
    const completed = await get(`/users/${u}/animelist?fields=id&status=completed&limit=5`, auth);
    if (completed.status === 200) {
      const n = ((completed.body as { data?: unknown[] }).data ?? []).length;
      note(`status=completed filter works (returned ${n} of ≤5)`);
    } else {
      miss(`status=completed rejected: HTTP ${completed.status} ${JSON.stringify(completed.body).slice(0, 200)}`);
    }

    // private / missing list
    if (profile.status !== 200 && withStatus.status !== 200) {
      miss('could not read this user — check the username is public and exists');
    }
  } else {
    console.log('\n== 3+4+5. list probes skipped (pass a username argument) ==');
  }

  /* ------------------------------------------------------------------ */
  console.log('\n== 6. gentle rate-limit observation (5 requests) ==');
  const t0 = Date.now();
  for (let i = 0; i < 5; i += 1) {
    const res = await get('/anime/30230?fields=id', auth);
    if (res.status === 429) {
      miss(`429 after ${i + 1} requests; Retry-After=${res.headers.get('retry-after')}`);
      break;
    }
    if (i === 4) note(`5 rapid requests OK in ${Date.now() - t0}ms`);
  }

  console.log('\n== summary ==');
  for (const f of findings) console.log(`  - ${f}`);
}

main().catch((error) => {
  console.error('PROBE FAILED', error);
  process.exit(1);
});

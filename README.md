# Anime Sequels — Related Anime Finder

Find the sequels, prequels, side stories, spin-offs, and alternatives you haven't watched yet — based on your completed anime list.

Enter a username, pick a data source (**AniList** or **MyAnimeList**), select relation types, and the app scans the user's Completed list, gathers relations, and filters out everything already on their list (any status).

## Features

- Two data sources behind one pipeline: AniList (works with zero setup) and MyAnimeList (client auth, no user login)
- Relation filtering: Prequel, Sequel, Side Story, Spin Off, Alternative
- "Never interacted with" rule — excludes Planned / Watching / Paused / Dropped too
- Results sorted by score, then popularity, then title
- 24h persistent cache (memory + localStorage/IndexedDB) + Refresh button
- Hide titles with 5-second Undo, scoped per provider + username
- Responsive light UI in MyAnimeList blue style

## Stack

- React 19 + TypeScript (strict)
- Tailwind CSS v4, Vite 8
- Framer Motion + Lucide icons

## Prerequisites

- Node.js 20.19+ / 22.12+ / 24+
- Internet access at runtime (calls the live APIs)
- AniList needs no configuration. MyAnimeList needs a client id (below).

## Install

```bash
npm install
```

## Run

```bash
npm run dev      # dev server → http://localhost:5173
npm run build    # typecheck + production build → dist/
npm run preview  # serve the production build → http://localhost:4173
npm run typecheck
```

## MyAnimeList setup (optional)

AniList works out of the box. For MyAnimeList:

1. Create an application at `https://myanimelist.net/apiconfig`
2. Copy `.env.example` to `.env` and fill in `VITE_MAL_CLIENT_ID`
3. Pick **MyAnimeList** as the data source and enter any public MAL username

No login or "Connect" step — the app authenticates itself with the `X-MAL-CLIENT-ID` header and only reads public lists. Private lists stay private.

> Note: MAL's API has no CORS support, so the browser calls `/mal-api/...`, proxied by Vite in dev (`vite.config.ts`) and by `public/mal-api/` (PHP) in the static build.

## Use

1. Start the dev server (`npm run dev`)
2. Open `http://localhost:5173`
3. Choose **AniList** or **MyAnimeList**
4. Enter a username (e.g. `JesterOW` for AniList)
5. Select relation types (default: Prequel + Sequel)
6. Click **Generate Recommendations**
7. Browse results, **Hide** anything uninteresting (Undo within 5s), **Load more** for the full list, **Refresh data** to bypass the cache

## Scripts (optional live-API tests)

```bash
npx tsx scripts/smoke.ts <anilist-username>   # AniList pipeline test (defaults to "JesterOW")
npx tsx scripts/smoke-mal.ts <mal-username>   # MyAnimeList pipeline test (skips when not configured)
npx tsx scripts/probe-mal.ts <mal-username>   # MAL capability/auth probe
```

## Project structure

```
├── src/
│   ├── components/   # TopNav, Hero, DiscoverySection, ResultsSection, AnimeCard, ...
│   ├── providers/    # anilist + mal adapters behind a shared discovery pipeline
│   ├── hooks/        # useDiscovery (loading/error/none/results), useHidden (+ undo toast)
│   └── lib/          # cache, storage, ui classes, relations, scroll
├── scripts/          # smoke + probe tests (not part of the bundle)
├── public/mal-api/   # PHP proxy for static hosting (copied into dist/)
├── vite.config.ts    # dev/preview MAL proxy
└── .env.example      # VITE_MAL_CLIENT_ID template
```

## How it works

1. Fetch the user's **Completed** list
2. Fetch relations for each completed title (AniList batches 50/request; MAL fetches one/request with caching)
3. Filter client-side by selected relation types (anime only)
4. Exclude anything on the user's list in **any** status
5. Deduplicate, sort by score, paginate (24 per page)

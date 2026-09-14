# Steam Performance Profile

**Measurement date:** 2026-09-14  
**Branch:** `BIG-Score-3`  
**Baseline:** `c64f1c6`  
**Implementation commit:** `a911d4a`  
**Platform:** Ubuntu 24.04, Node.js 22, Vite 7, Chromium-compatible browser target.

## Commands and build result

The production bundle was generated with `npm ci` followed by `./node_modules/.bin/tsc --noEmit` and `./node_modules/.bin/vite build`. Whitespace validation used `git diff --check`. The TypeScript check, Vite build, and whitespace check passed. Build artifacts under `dist/` are validation outputs and are not committed.

The chunk measurement used Node.js `zlib.gzipSync(..., { level: 9 })` against the generated JavaScript assets. Raw sizes are bytes; gzip sizes are compressed bytes.

| Asset | Raw bytes | Gzip bytes | Role |
|---|---:|---:|---|
| `SteamIdlerPage-CKT7oQf5.js` | 21,849 | 6,451 | Steam Idler route chunk |
| `SteamSamPage-BlRUZ-0G.js` | 33,366 | 8,134 | Steam SAM route chunk |
| `steamApi-CcJHtL7G.js` | 3,756 | 1,556 | Shared Steam API/cache chunk |
| `index-DKuZZCSR.js` | 338,825 | 103,993 | Main application entry chunk |
| `router-BrKo1rcP.js` | 50,226 | 17,849 | Router and route registration |
| `World3DPage-DktYlTxc.js` | 574,695 | 145,167 | Pre-existing large non-Steam route chunk |
| `MarkdownContent-9V8xBumz.js` | 327,368 | 103,621 | Other large non-Steam chunk |

The `World3DPage` chunk remains above Vite's 500 kB warning threshold; it is unrelated to the Steam changes and was not altered. The Steam pages are separate route chunks, confirming that existing route-level code splitting is present and preserved.

## Runtime profiling checklist

The following checklist is the repeatable manual runtime profile for Chrome DevTools and React DevTools Performance. A real Steam account with a 600+ game library, or the largest available test library, should be used when executing it.

| Scenario | Expected observation | Result |
|---|---|---|
| Fresh cache load | IndexedDB cache renders immediately and no Steam games network request is issued. | Implemented; verify in Network panel |
| Stale cache render | Expired list is painted immediately, remains visible during revalidation, then is replaced by the sorted response. | Implemented; verify in Performance panel |
| Manual refresh | Existing list remains visible; button shows `Refreshing Library...`; cooldown resets after success. | Implemented; verify in UI |
| Debounced search | 220 ms debounce limits filtering updates while typing. | Existing behavior retained |
| Pagination | Idler and SAM render only the current page's game cards. | Existing behavior retained |
| Achievement selection | Selected action reports processed, success, and failed counts live; progress reaches `processed === total`. | Implemented; verify with selected achievements |
| Image loading | Game and achievement images use lazy loading/async decoding where rendered. | Existing behavior retained |
| Route loading | Steam Idler and SAM load through Suspense-backed lazy route imports. | Confirmed in `src/app/routes.config.ts` and build assets |

## Implementation findings

The shared cache now stores one normalized `{ steamId, games, timestamp }` record per Steam ID in IndexedDB. A malformed record, wrong Steam ID, unavailable IndexedDB, or failed transaction is ignored safely; the legacy `yolnoma_steam_games_cache` localStorage record is migrated once when valid, with localStorage retained only as a compatibility fallback. Expired entries use stale-while-revalidate behavior. The shared API layer deduplicates simultaneous requests for the same Steam ID with a single-flight Promise map.

The Rust `get_steam_games` command deserializes typed outer, response, and raw game structures. It filters invalid app IDs and blank names, trims names, defaults missing playtime to zero, sorts by descending playtime, and returns only the normalized `SteamGame` fields. A missing `game_count` produces the existing privacy message, while `game_count: 0` is a valid empty library.

Selected SAM actions use six bounded workers at most. Progress is reported after every success or failure, and the achievement state is updated only for IDs that actually succeeded. Bulk Unlock All and Lock All intentionally report only a 0-to-total command-level transition because the backend exposes no per-achievement progress.

## Validation limitations

`cargo fmt --check` and `cargo check` could not run because `cargo` is not installed in this sandbox. The final report must not interpret the successful frontend checks as Rust compilation success. No build artifacts or temporary profiling logs are tracked.

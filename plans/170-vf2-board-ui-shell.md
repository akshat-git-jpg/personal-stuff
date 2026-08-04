<!-- boss frontmatter -->
---
executor: agy
model:                   # blank = agy default (Gemini 3.1 Pro High)
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
                         # check.sh gains the board-ui block in this plan (vitest + build +
                         # rendered-app smoke), so the gate fails on a header that moves,
                         # a missing picker, or a broken build — not just on unit tests.
ui: true                 # user-facing — crew must attach screenshots of the SPA's four tabs
deploy:                  # no deploy — localhost tool
needs: ["169"]           # consumes GET /api/board-data
---

# Plan 170: board-ui shell — Vite+React SPA, ONE shared sticky header, hash router, Run tab

## Summary

- **Problem statement**: Each of the board's four tabs renders its own `.topbar`, so switching tabs replaces the entire chrome — buttons visibly teleport (Run has 3 controls, Card Plan 5, Storyboard 11, Final Cut 1, and Final Cut has no video picker at all). The owner has decided to rebuild the board as a React/Vite SPA like `apps/tutorial-tracker-app`.
- **Goals**:
  - New `board-ui/` Vite + React + TS app (own package.json; `node_modules/` and `dist/` gitignored) — components one-per-file like tutorial-tracker's `src/client/`.
  - **One** `AppHeader` rendered once, outside all tab content: sticky, fixed min-height, containing tabs + a single video picker + video name + a right-aligned action slot; a second row for per-tab secondary controls that is allowed to differ.
  - Hash routing (`#card-plan` / `#storyboard` / `#final-cut`, no hash = Run) where switching tabs preserves `?video=` and switching video preserves the hash.
  - Run tab fully working in the SPA (read-only port).
  - SPA served by the existing Node server at `/app` (legacy board at `/` untouched until plan 174's cutover).
  - A rendered-app smoke gate (`scripts/board-ui-smoke.mjs`, headless Chrome) that PROVES the tab strip and action slot sit at identical y-positions on all four tabs.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — configs, components, router, and smoke script are fully inlined.
- **Done criteria** (terse): `bash scripts/check.sh` exits 0 including vitest, `npm run build`, and the smoke gate; smoke asserts exactly one `.app-header` and y-stable chrome across all four hash URLs.
- **Stop conditions** (terse): no CDN/external assets; no tailwind/shadcn; no new palette (existing CSS vars only); don't touch the legacy `/` pages; stop if npm install fails after one retry.
- **Test / verification for success**: vitest unit tests on the router + headless-Chrome smoke over the BUILT app + screenshots of all four tabs attached to the PR.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat adda9be..HEAD -- pipelines/video/visuals-flow/`
> Plan 169 must already be merged (lib/board-data.mjs exists). If it is not, STOP.

## Status

- **Priority**: high
- **Effort**: large
- **Risk**: medium — new toolchain in the workspace
- **Depends on**: plan 169
- **Category**: feature (UI shell)
- **Planned-at SHA**: `adda9be`

## Why this matters

This plan is the fix for the owner's #1 complaint: chrome that teleports between tabs. In the SPA the header is ONE persistent component and tab switches swap only the content below it — the stability is structural, and the smoke gate makes it a machine-checkable fact rather than a hope. Everything later (Card Plan, Storyboard, Final Cut) mounts into this shell, so its contracts (router, action slot, API client) must be exact.

## Current state (facts, verified at adda9be)

All paths relative to `pipelines/video/visuals-flow/` unless noted.

- Tab routing today (`lib/board.mjs` lines ~1532–1554, emitted client JS): `HASH_TAB` maps `#card-plan/#storyboard/#final-cut` to tab divs; **no hash = Run** (owner decision 2026-07-24: Run is the landing tab). `applyTab` uses `history.pushState(null, '', location.pathname + location.search + wantHash)` — `?video=` survives tab switch. The video pickers navigate with `location.href = location.pathname + '?video=' + encodeURIComponent(v) + location.hash` — hash survives video switch. **Both behaviors are owner-reported regressions when broken; the SPA must keep both.**
- The server 302s bare `/` (no `?video=`) to `/?video=<launch-slug>` (lines ~2759–2764) — the URL must always name the video.
- Video picker guard: switching video with unsaved feedback asks `confirm('You have unsaved feedback. Switch video and lose it?')` (lines ~524–531).
- CSS vars (BOARD_CSS line ~284): `--bg:#0f0b07; --panel:#181210; --line:rgba(255,255,255,0.10); --text:#f5ede2; --dim:rgba(245,237,226,0.55); --accent:#fb923c; --accent-light:#fdba74; --ok:#34d399; --err:#ff6b6b; --shot:#a78bfa; --overlay-seg:#38bdf8; --font:"Inter",-apple-system,system-ui,sans-serif`. **These are the palette. Do not add colors.**
- Run tab data: `GET /run-log?video=` → `{ video, steps: [{ id, number, kind, status, did, issues, output, derived }], summary: { done, total, running, blocked, derived }, next }`; `GET /run-videos` → `{ current, videos }`. Status emoji map (line ~1561): done ✅ / running 🔄(spin) / blocked ❌ / skipped ⏭️ / todo ⚪, right-aligned one column. Row markup + `RUN_CSS` (lines ~241–281) are the look to port.
- `GET /api/board-data` (plan 169) → schema in `plans/169-vf2-board-data-api.md`.
- Exemplar app: `apps/tutorial-tracker-app` (React 19, Vite 8, vitest 4, TS ~6, components one-per-file in `src/client/`). We copy the discipline, NOT tailwind/shadcn/playwright — the board keeps its bespoke CSS vars and stays dependency-light.
- Workspace rule (`pipelines/CLAUDE.md`): Node subprojects keep their own `package.json` + `node_modules/` — `board-ui/` follows `youtube/yt-research/`'s precedent.
- `pipelines/.npmrc` and `pipelines/video/visuals-flow/.npmrc` force the public npm registry (avoids CodeArtifact 401s).
- Headless Chrome is available at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (used by card-library's overflow probe; env override `CHROME_BIN`).
- Fixtures for the smoke: `lib/fixtures/board/{cues,resolved,transcript}.json`; `vo.mp3` generated via `ffmpeg -y -f lavfi -i sine=frequency=440:duration=30 -c:a libmp3lame <out>` (board.test.mjs lines 14–21).

## Commands you will need

```bash
cd pipelines/video/visuals-flow
(cd board-ui && npm ci)                        # after package-lock.json exists: npm install first time
(cd board-ui && npx vitest run)                # unit tests
(cd board-ui && npm run build)                 # tsc + vite build → dist/
node scripts/board-ui-smoke.mjs                # rendered-app smoke (needs dist/)
bash scripts/check.sh                          # full gate
node lib/board.mjs test-01                     # manual: open http://localhost:4322/app/?video=test-01
```

## Scope

**In scope:**
- `pipelines/video/visuals-flow/board-ui/**` (new app: package.json, package-lock.json, vite.config.ts, tsconfig.json, index.html, src/**, test/**)
- `pipelines/video/visuals-flow/lib/board.mjs` (add `/app` static serving + extend the bare-URL redirect; nothing else)
- `pipelines/video/visuals-flow/scripts/board-ui-smoke.mjs` (new)
- `pipelines/video/visuals-flow/scripts/check.sh` (append the board-ui block)
- `pipelines/video/visuals-flow/.gitignore` (add `board-ui/node_modules/`, `board-ui/dist/`)

**Out of scope (do NOT touch):** legacy render functions and their emitted JS/CSS; `lib/board.test.mjs`; `lib/board-data.mjs`; `videos/**`; `card-library/**`; `steps/**`; `run.sh`.

## Decisions already made (obey, don't re-decide)

- React 19 + Vite 8 + TS, **no** tailwind/shadcn/router libs/state libs. Hand-rolled hash router (it's 20 lines and the behavior is regression-tested).
- `base: './'` in vite config so the same bundle serves at `/app/` now and `/` after the plan-174 cutover.
- Plain CSS in `src/theme.css` + per-component co-located CSS files, using ONLY the existing vars.
- Video switch = full page navigation (`location.href`), exactly like today — keeps URL-as-source-of-truth and the unsaved-work confirm.
- Tab switch = client-side (`history.pushState`), content swap under the persistent header.
- The action slot holds the active tab's **gate actions** (owner decision 2026-07-30: all approves in the slot); Run's slot is empty. Secondary row exists on every tab (fixed min-height) so row 1 never moves.

## Steps

1. **Scaffold `board-ui/`.** Write these files exactly:

   `board-ui/package.json`:
   ```json
   {
     "name": "visuals-flow-board-ui",
     "private": true,
     "version": "0.0.0",
     "type": "module",
     "scripts": {
       "dev": "vite",
       "build": "tsc && vite build",
       "typecheck": "tsc",
       "test": "vitest run",
       "preview": "vite preview"
     },
     "dependencies": {
       "react": "^19.2.6",
       "react-dom": "^19.2.6"
     },
     "devDependencies": {
       "@types/node": "^24.12.3",
       "@types/react": "^19.2.14",
       "@types/react-dom": "^19.2.3",
       "@vitejs/plugin-react": "^6.0.1",
       "typescript": "~6.0.2",
       "vite": "^8.0.12",
       "vitest": "^4.1.7"
     }
   }
   ```

   `board-ui/vite.config.ts`:
   ```ts
   import path from 'node:path';
   import { defineConfig } from 'vitest/config';
   import react from '@vitejs/plugin-react';

   export default defineConfig({
     plugins: [react()],
     base: './', // same bundle works under /app/ (migration) and / (post-cutover)
     resolve: { alias: { '@': path.resolve(__dirname, './src') } },
     server: {
       port: Number(process.env.WEB_PORT) || 5173,
       // dev only: the built app is served by lib/board.mjs itself
       proxy: Object.fromEntries(
         ['/api', '/card', '/calibrate-card', '/slice', '/vo.mp3', '/run-log', '/run-videos',
          '/save', '/approve', '/card-feedback', '/versions', '/video', '/status',
          '/feedback-final', '/feedback-image']
           .map((p) => [p, 'http://localhost:4322']),
       ),
     },
     test: { environment: 'node' },
   });
   ```

   `board-ui/tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "lib": ["ES2022", "DOM", "DOM.Iterable"],
       "module": "ESNext",
       "moduleResolution": "bundler",
       "jsx": "react-jsx",
       "strict": true,
       "noEmit": true,
       "skipLibCheck": true,
       "isolatedModules": true,
       "types": ["vite/client"],
       "baseUrl": ".",
       "paths": { "@/*": ["src/*"] }
     },
     "include": ["src", "test", "vite.config.ts"]
   }
   ```

   `board-ui/index.html`: minimal Vite entry — `<!doctype html><html lang="en"><head><meta charset="UTF-8"/><title>visuals-flow board</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>` (the SPA sets the real title to `<video> — visuals-flow board` once data loads — the legacy page-title contract, board.test.mjs line ~1445).

   Then `cd board-ui && npm install` (writes `package-lock.json` — COMMIT it; `npm ci` is what the gate uses from then on).

   **Verify:** `cd board-ui && npm run build` → `dist/index.html` exists.

2. **Router module `board-ui/src/lib/router.ts`** (pure, unit-tested):

   ```ts
   export type Tab = 'run' | 'card-plan' | 'storyboard' | 'final-cut';
   export const TABS: { id: Tab; label: string }[] = [
     { id: 'run', label: 'Run' },
     { id: 'card-plan', label: 'Card Plan' },
     { id: 'storyboard', label: 'Storyboard' },
     { id: 'final-cut', label: 'Final Cut' },
   ];
   const HASH_TAB: Record<string, Tab> = {
     '#card-plan': 'card-plan', '#storyboard': 'storyboard', '#final-cut': 'final-cut',
   };
   export const TAB_HASH: Record<Tab, string> = {
     run: '', 'card-plan': '#card-plan', storyboard: '#storyboard', 'final-cut': '#final-cut',
   };
   // No hash lands on Run — owner decision 2026-07-24; the Run tab exists so
   // someone who has not watched the terminal can open one URL and see status.
   export function tabForHash(hash: string): Tab { return HASH_TAB[hash] ?? 'run'; }
   // Tab switch preserves ?video= (owner-reported regression when broken).
   export function urlForTab(tab: Tab, loc: { pathname: string; search: string }): string {
     return loc.pathname + loc.search + TAB_HASH[tab];
   }
   // Video switch preserves the tab hash (same).
   export function urlForVideo(slug: string, loc: { pathname: string; hash: string }): string {
     return loc.pathname + '?video=' + encodeURIComponent(slug) + loc.hash;
   }
   export function videoFromSearch(search: string): string | null {
     return new URLSearchParams(search).get('video');
   }
   ```

   Vitest `board-ui/test/router.test.ts`: tabForHash for all 4 + unknown hash → run; urlForTab keeps `?video=x`; urlForVideo keeps `#storyboard` and encodes slugs; videoFromSearch.

   **Verify:** `npx vitest run` → green.

3. **API client `board-ui/src/lib/api.ts`**: typed wrappers `fetchBoardData(video: string | null): Promise<BoardData>`, `fetchRunLog(video)`, `fetchRunVideos()` with a `BoardData` interface transcribed 1:1 from plan 169's schema block. No caching, no retries — localhost.

4. **App shell.** `src/main.tsx` mounts `<App/>`; `src/App.tsx`:
   - State: `tab` (from `tabForHash(location.hash)`), synced via `popstate`/`hashchange` listeners; `boardData` (fetched once on mount, `?video=` read from URL); `dirty` (context, wired by later plans — default false).
   - Tab switch: `history.pushState(null, '', urlForTab(tab, location))` then set state — content swaps, header persists.
   - Renders: `<AppHeader …/>` ONCE, then `{tab === 'run' && <RunTab/>}` etc. Placeholder panels for card-plan/storyboard/final-cut: `<div className="tab-placeholder">Card Plan — ships in plan 171</div>` (etc. — plans 171–174 replace them).
   - Layout probe (verification hook, kept in prod — it is inert without the query param):
   ```tsx
   useEffect(() => {
     if (new URLSearchParams(location.search).get('probe') !== 'layout') return;
     requestAnimationFrame(() => requestAnimationFrame(() => {
       const r = (sel: string) => {
         const b = document.querySelector(sel)?.getBoundingClientRect();
         return b ? { y: Math.round(b.y), h: Math.round(b.height) } : null;
       };
       const meta = document.createElement('meta');
       meta.name = 'layout-probe';
       meta.content = JSON.stringify({
         hash: location.hash, header: r('.app-header'), tabs: r('.app-tabs'),
         slot: r('.action-slot'), row2: r('.app-header-row2'),
         headerCount: document.querySelectorAll('.app-header').length,
       });
       document.head.appendChild(meta);
     }));
   }, []);
   ```

5. **`src/components/AppHeader.tsx` + `AppHeader.css`** — the one header:

   ```tsx
   export function AppHeader(props: {
     video: string; videos: string[]; tab: Tab; dirty: boolean;
     meta?: ReactNode;            // tab-scoped info text (duration, counts…)
     actions?: ReactNode;         // right-aligned gate actions for the active tab
     secondary?: ReactNode;       // row 2 — allowed to differ per tab
     onTab: (t: Tab) => void;
   }) {
     const switchVideo = (slug: string) => {
       if (props.dirty && !confirm('You have unsaved feedback. Switch video and lose it?')) return;
       location.href = urlForVideo(slug, location);   // full navigation, like today
     };
     return (
       <header className="app-header">
         <div className="app-header-row1">
           <nav className="app-tabs">
             {TABS.map((t) => (
               <button key={t.id} className={'tab-btn' + (t.id === props.tab ? ' active' : '')}
                       onClick={() => props.onTab(t.id)}>{t.label}</button>
             ))}
           </nav>
           <label className="app-video">video:
             <select id="videoPicker" value={props.video}
                     onChange={(e) => switchVideo(e.target.value)}>
               {props.videos.map((v) => <option key={v} value={v}>{v}</option>)}
             </select>
           </label>
           <span className="app-meta">{props.meta}</span>
           <div className="action-slot">{props.actions}</div>
         </div>
         <div className="app-header-row2">{props.secondary}</div>
       </header>
     );
   }
   ```

   `AppHeader.css` (co-located, imported by the component — vars only, tab-strip look ported from `.view-toggle`/`.tab-btn` at board.mjs lines ~292–295):
   ```css
   .app-header { position: sticky; top: 0; z-index: 100; background: var(--bg);
     border-bottom: 1px solid var(--line); padding: 10px 24px 8px; }
   .app-header-row1 { display: flex; align-items: center; gap: 16px; min-height: 46px; }
   .app-header-row2 { display: flex; align-items: center; gap: 10px; min-height: 34px;
     font-size: 12px; color: var(--dim); }
   .app-tabs { display: flex; gap: 2px; border: 1px solid var(--line); border-radius: 8px; padding: 2px; }
   .app-tabs .tab-btn { padding: 5px 12px; border-radius: 6px; font-size: 13px; font-weight: 600;
     color: var(--dim); background: none; border: 0; font-family: inherit; cursor: pointer;
     white-space: nowrap; line-height: 1.4; }
   .app-tabs .tab-btn.active { color: var(--accent); background: rgba(251,146,60,0.12); }
   .app-video { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--dim); }
   .app-video select { font: inherit; font-size: 13px; font-weight: 600; padding: 4px 8px;
     background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 6px; }
   .app-meta { font-size: 13px; color: var(--dim); }
   .action-slot { margin-left: auto; display: flex; align-items: center; gap: 8px; }
   .action-slot button { font: inherit; font-weight: 700; border-radius: 9px; padding: 8px 14px;
     cursor: pointer; border: 1px solid var(--line); background: var(--panel); color: var(--text); }
   .action-slot button.approve { border-color: var(--ok); color: var(--ok); }
   .action-slot button:disabled { cursor: not-allowed; opacity: .38;
     border-color: var(--line) !important; color: var(--dim) !important; background: transparent; }
   ```

   `src/theme.css`: the `:root` var block copied verbatim from BOARD_CSS line ~284, plus `* { box-sizing:border-box; margin:0; padding:0; }` and `body { font-family:var(--font); background:var(--bg); color:var(--text); }`.

6. **`src/tabs/RunTab.tsx`** — port of the legacy Run tab (board.mjs lines ~1556–1642 client JS + RUN_CSS rows, lines ~241–281): fetch `/run-log?video=<url video>`, render summary chips into the header `meta`, banner (`next: <code>…</code>` / "every step is done"), one `.run-row` per step with the number/name/kind columns and the right-aligned status emoji (spin animation on running), the `derived` italics note, and `did/issues/output` field rows. The URL wins over the server's `current` (board.test.mjs line ~1688 contract). Action slot: empty. Secondary row: empty.

7. **Serve the SPA from `lib/board.mjs`.** Above the 404 fallthrough in `handleRequest`:

   ```js
   if (req.method === 'GET' && (url.pathname === '/app' || url.pathname.startsWith('/app/'))) {
     return serveUi(res, url.pathname);
   }
   ```
   And the helper (module level):
   ```js
   const UI_DIST = path.resolve(import.meta.dirname, '..', 'board-ui', 'dist');
   const UI_MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript',
     '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.map': 'application/json' };
   function serveUi(res, pathname) {
     if (!fs.existsSync(path.join(UI_DIST, 'index.html'))) {
       res.statusCode = 503;
       return res.end('board-ui not built — run: cd board-ui && npm ci && npm run build');
     }
     const rel = pathname === '/app' || pathname === '/app/' ? 'index.html'
       : decodeURIComponent(pathname.slice('/app/'.length));
     const file = path.join(UI_DIST, rel);
     if (!file.startsWith(UI_DIST + path.sep) && file !== path.join(UI_DIST, 'index.html')) {
       res.statusCode = 403; return res.end('forbidden');
     }
     if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.statusCode = 404; return res.end('not found'); }
     res.setHeader('content-type', UI_MIME[path.extname(file)] ?? 'application/octet-stream');
     res.setHeader('cache-control', 'no-store');
     return res.end(fs.readFileSync(file));
   }
   ```
   Extend the bare-URL redirect (lines ~2759–2764) so `'/app'` and `'/app/'` are redirected to `?video=<slug>` exactly like `/` — the URL must always name the video.

   **Verify:** `node lib/board.mjs test-01` then `curl -s http://localhost:4322/app/ -o /dev/null -w '%{http_code}'` → `302`; with `?video=test-01` → `200`.

8. **Smoke gate `scripts/board-ui-smoke.mjs`** (node, no deps). Skeleton:

   ```js
   // Rendered-app smoke: boots the real server on the board fixtures, drives
   // headless Chrome over every tab URL, and asserts the chrome DOES NOT MOVE.
   // A green vitest run is not evidence the layout is fixed — this looks at the
   // laid-out page (plan 170; extended by plans 171-174).
   import { spawnSync } from 'node:child_process';
   import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
   const CHROME = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
   const HASHES = ['', '#card-plan', '#storyboard', '#final-cut'];

   // 1. fixture workdir: copy lib/fixtures/board/{cues,resolved,transcript}.json
   //    into .test-tmp/board-ui-smoke/<slug>, ffmpeg-generate vo.mp3 (same
   //    command as board.test.mjs ensureFixtureAudio), write a minimal
   //    card-plan.json: { video: 'smoke', approved: false, sections: [
   //      { part: 'body', items: [{ id: 'c01', card: 'a/b', status: 'existing' }] } ] }
   // 2. const { createServer } = await import('../lib/board.mjs');
   //    server.listen(0) → port.
   // 3. for each hash: dumpDom(`http://localhost:${port}/app/?video=<slug>&probe=layout${hash}`)
   //    using: spawnSync(CHROME, ['--headless', '--disable-gpu', '--hide-scrollbars',
   //      '--virtual-time-budget=8000', '--dump-dom', url], { encoding: 'utf8', maxBuffer: 64e6 })
   //    parse the <meta name="layout-probe" content="..."> JSON out of stdout.
   // 4. assertions (throw with a named reason on failure):
   //    - probe.headerCount === 1 on every tab           (ONE header, rendered once)
   //    - probe.tabs.y, probe.tabs.h, probe.slot.y identical across all 4 tabs
   //    - probe.header.y === 0                            (sticky at top)
   //    - dom contains id="videoPicker" on every tab      (Final Cut included — the old gap)
   // 5. screenshots for the reviewer: same URLs with --screenshot=<file> into
   //    .test-tmp/board-ui-smoke/tab-<name>.png, --window-size=1400,1000.
   // exit 0 + 'board-ui smoke OK' / exit 1 with the failed assertion.
   ```
   If Chrome is missing at the path and `CHROME_BIN` is unset, print `SKIP board-ui smoke: no Chrome` and exit 0 (keeps check.sh runnable on a bare box) — but note the skip loudly.

   **Verify:** `node scripts/board-ui-smoke.mjs` → `board-ui smoke OK`.

9. **Wire `scripts/check.sh` + `.gitignore`.** Append to check.sh (before the final echo):
   ```bash
   # board-ui (React SPA) — unit tests, type-checked build, rendered-app smoke (plan 170)
   ( cd board-ui && { [ -d node_modules ] || npm ci; } && npx vitest run && npm run build )
   node scripts/board-ui-smoke.mjs
   ```
   `.gitignore` gains `board-ui/node_modules/` and `board-ui/dist/`.

   **Verify:** `bash scripts/check.sh` → exit 0, `visuals-flow check OK`.

10. **Screenshots for the PR** (crew obligation, `ui: true`): run the four screenshot commands from step 8's URLs against a real video (`node lib/board.mjs test-01`), attach `.test-tmp/board-ui-smoke/tab-*.png` to the PR. The reviewer must SEE the header pinned in the same place on all four.

## Test plan

- `board-ui/test/router.test.ts` — the four routing contracts (vitest).
- `scripts/board-ui-smoke.mjs` — rendered-app assertions listed in step 8 (in check.sh, so it is also boss's merge gate).
- Legacy `lib/board.test.mjs` and `lib/board-api.test.mjs` untouched and green.

## Done criteria (machine-checkable)

```bash
cd pipelines/video/visuals-flow
bash scripts/check.sh                          # exit 0 — includes vitest + build + smoke
node scripts/board-ui-smoke.mjs                # 'board-ui smoke OK'
git status --short board-ui | grep -v '^??'    # package-lock.json committed; node_modules/, dist/ ignored
```
Plus: 4 PR screenshots showing the header at the same position on every tab.

## STOP conditions

- npm install fails after one retry → STOP, report the registry error (do NOT switch registries; `.npmrc` already pins the public one).
- Any legacy test in `board.test.mjs` fails → STOP; this plan must not change legacy behavior.
- The smoke's y-stability assertion cannot be made to pass without hacks (e.g. hardcoding heights per tab) → STOP and report; the design intent is one persistent header, not per-tab tuning.
- No CDN/external fetches in the SPA (offline board). No tailwind/shadcn. No new colors.
- Never write outside the repo.

## Maintenance notes

- The action-slot/secondary-row contract is what plans 171–174 mount into: `actions` = gate buttons only; `secondary` = everything else. A future control belongs in row 2 unless it approves a gate.
- `base: './'` is what makes the plan-174 cutover a 2-line server change — don't "fix" it to `/app/`.
- The smoke script is deliberately structured as per-tab assertion functions so plans 171–174 append assertions without touching check.sh again (avoids the check.sh rebase-collision hotspot — memory 2026-07).

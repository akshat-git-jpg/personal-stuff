# closet-app operating notes

- **Stack**: Vite + React 19 + Tailwind v4 SPA, Hono on a Cloudflare Worker, D1 `closet-db` (binding `DB`), R2 `closet-photos` (binding `PHOTOS`).
- **Auth guardrail**: stateless HMAC signed cookie. Do NOT replace with OAuth/KV/a DB check (`decisions.md` 2026-07-01).
- **Design guardrails**: no wash limit / no threshold colour; looks are a plain gallery with no link to clothes. Both were owner decisions on 2026-08-17.
- **Gotchas**: `bash scripts/smoke.sh` is the merge gate and unit tests cannot replace it; `c.req.param()` is undefined in wildcard middleware; tags are normalised lowercase and pruned when orphaned; `--var` beats the dev vars file.

## UI guardrails (SPA, plan 204)

- **No wash limit and no threshold colour** — a cloth tile shows a bare wear
  count, sorted highest-first. Do not add a "needs wash" badge or a colour
  ramp; the owner rejected both on 2026-08-17.
- **Looks never link to clothes** — no clothes list inside a look, no "I wore
  this look" button. If a look seems to need it, that's a stop-and-report, not
  a quick addition.
- **`selectedTagIds` resets on every tab switch** (`Closet.tsx`) — a lifecycle
  contract, not a nicety. Clothes and Looks share one tag vocabulary, but a tag
  that matches clothes may match no looks; carrying the selection across tabs
  leaves the user on a mysteriously empty grid.
- **Every interactive control carries an explicit class** — `.btn*` / `.field`
  / `.chip` / `.tab-btn`, never a bare `<button>`/`<input>`. UA-default
  (unstyled) controls are a repeat defect in this repo (LESSONS 2026-07-31).
- **`btn` is a Tailwind v4 `@utility`** (`globals.css`) — `.btn-primary` etc.
  `@apply btn`, which only works because `btn` is registered via `@utility`,
  not a plain component class. A plain `.btn { @apply ... }` class cannot be
  `@apply`'d from another rule in Tailwind v4.
- **No service worker.** The app is useless offline (every photo and count
  comes from the Worker); a stale SW cache is a classic way to ship an app
  showing yesterday's data.

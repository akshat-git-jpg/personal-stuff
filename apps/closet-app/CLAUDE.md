# closet-app operating notes

- **Stack**: Vite + React 19 + Tailwind v4 SPA, Hono on a Cloudflare Worker, D1 `closet-db` (binding `DB`), R2 `closet-photos` (binding `PHOTOS`).
- **Auth guardrail**: stateless HMAC signed cookie. Do NOT replace with OAuth/KV/a DB check (`decisions.md` 2026-07-01).
- **Design guardrails**: no wash limit / no threshold colour; looks are a plain gallery with no link to clothes. Both were owner decisions on 2026-08-17.
- **Gotchas**: `bash scripts/smoke.sh` is the merge gate and unit tests cannot replace it; `c.req.param()` is undefined in wildcard middleware; tags are normalised lowercase and pruned when orphaned; `--var` beats the dev vars file.

## Catalogue model (2026-08-17)

- **Photos live in the `photos` table, never a column.** `photos(item_type, item_id, r2_key, position)`; `position 0` **is** the cover, so there is no separate cover flag to fall out of sync. The old `clothes.photo_key` / `looks.photo_key` columns were dropped — see `migrations/2026-08-17-photos.sql`.
- **`photo_keys` in a request is the WHOLE ordered set.** Add / remove / reorder / change-cover are all that one field. Do NOT add per-photo endpoints; the Worker diffs the list.
- **`src/worker/db.ts` never touches R2.** Functions that stop referencing a key RETURN the now-unreferenced keys and `src/worker/index.ts` deletes those objects. Keep bucket writes in that one place.
- **Only delete an R2 object when NO photo row references the key** (`unreferenced()` in `db.ts`). The same object could be attached twice; deleting on the first removal would blank the other item.
- **Uploads happen on pick, before Save.** An abandoned sheet can leak an orphan object. That is the deliberate trade: holding blobs until Save loses the photo if the tab dies, which is worse on a phone.
- **A look must have ≥1 photo (server-enforced on create AND patch); a cloth may have 0** and falls back to its initial letter.
- **Reordering is drag-and-drop** (`PhotoGrid.tsx`, `@dnd-kit` — the same library `lists-app` uses). The thumbnail itself is the drag handle and needs `touch-none`, or the browser claims the gesture for scrolling and the drag silently never starts. Touch drag activates after a 180ms hold so a plain tap still reaches the `×`.
- **Sorting is client-side only** (`sort.ts`). The server still returns clothes wears-DESC / looks created_at-DESC; the client re-orders. Sort functions must COPY before `.sort()` — the arrays come from component state.
- **Sort preference is per tab in `localStorage`** (`closet.sort.clothes` / `closet.sort.looks`), read via a lazy `useState` initialiser. Reading storage during render trips `react-hooks/purity`; every access is try/caught because private mode throws.

## UI guardrails (SPA, plan 204 + the 2026-08-17 catalogue rework)

- **Tapping a tile's photo OPENS the item. It must never log a wear.** Logging
  is the labelled `+ wear` button. This was reversed on 2026-08-17 at the
  owner's request: a stray tap on a picture silently inflating a count is the
  exact failure the counter exists to avoid. Guarded by
  `test/ui.test.tsx` → "tapping the photo opens the catalogue and does NOT log
  a wear" — do not delete that test.
- **The catalogue viewer is identical for clothes and looks** (`ItemViewer`),
  and carries **no wear action**, so browsing can never change a count.
- **`ItemViewer` is z-30, `EditSheet` is z-40.** The viewer deliberately stays
  open behind the sheet so saving returns you to the catalogue. Raising the
  viewer's z-index hides the sheet entirely.
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

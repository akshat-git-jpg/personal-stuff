---
executor: claude-p
model: sonnet
test_cmd: cd apps/closet-app && npm ci && npm run build && npm test && bash scripts/smoke.sh
ui: true
deploy:
needs: ["Plan 203 (closet-app backend, PR #162) must land first — this plan consumes its API surface."]
needs_prs: [162]
touches: [apps/closet-app/package.json, apps/closet-app/index.html, apps/closet-app/src/main.tsx, apps/closet-app/src/App.tsx, apps/closet-app/src/client/globals.css, apps/closet-app/src/client/api.ts, apps/closet-app/src/client/types.ts, apps/closet-app/src/client/photo.ts, apps/closet-app/src/client/filter.ts, apps/closet-app/src/client/Login.tsx, apps/closet-app/src/client/Closet.tsx, apps/closet-app/src/client/ClothesTab.tsx, apps/closet-app/src/client/ClothTile.tsx, apps/closet-app/src/client/LooksTab.tsx, apps/closet-app/src/client/LookViewer.tsx, apps/closet-app/src/client/EditSheet.tsx, apps/closet-app/src/client/TagInput.tsx, apps/closet-app/src/client/UndoBar.tsx, apps/closet-app/src/client/PhotoPicker.tsx, apps/closet-app/scripts/make-icons.mjs, apps/closet-app/scripts/shoot.mjs, apps/closet-app/public/manifest.webmanifest, apps/closet-app/README.md, apps/closet-app/CLAUDE.md, plans/README.md]

mutation_apply: node -e "const f='apps/closet-app/src/client/filter.ts';const fs=require('fs');let s=fs.readFileSync(f,'utf8');const a='selected.every((t) => owned.has(t))';if(!s.includes(a))throw new Error('mutation anchor missing');s=s.replace(a,'selected.some((t) => owned.has(t))');fs.writeFileSync(f,s)"
mutation_command: npm test
mutation_expect: "AND filter narrows, never widens"
mutation_cwd: apps/closet-app
mutation_timeout: 600
---

# Plan 204: closet-app SPA — Clothes tab, Looks tab, tags, undo, PWA

## Summary

- **Problem statement**: Plan 203 ships the closet-app API and a placeholder
  `<h1>`. There is no way for the owner to actually use it from their phone.
- **Goals**:
  - Two-tab mobile SPA: **Clothes** (photo grid, tap to add a wear) and **Looks**
    (tagged outfit gallery).
  - Every tile has three separate targets: photo → +1 wear, name → edit sheet,
    `↺ washed` → confirm then reset to 0.
  - A 10-second **Undo** bar after every wear/wash, so a one-handed mis-tap costs
    one tap to fix.
  - Multi-tag on every photo, one shared autocompleting vocabulary, chip filtering
    with **AND** semantics on both tabs.
  - Camera capture that downscales on the phone before upload.
  - PWA manifest + icons so it opens from the home screen like an app.
  - Commit a real screenshot (this plan is `ui: true`).
- **Executor proposed**: `claude-p` / Claude Sonnet — the output is judged by the
  owner's eye, which is `tooling/boss/data/rules.md`'s sonnet row (quality-setting
  visual work). LESSONS 2026-07-31 records agy re-introducing UA-default controls
  on exactly this kind of UI build, so the cheap row does not apply here.
- **Done criteria** (terse — full list below): `npm ci && npm run build && npm test
  && bash scripts/smoke.sh` exits 0 from `apps/closet-app`; the mutation recipe
  makes `npm test` fail; icons + a real screenshot are committed; every
  interactive control is styled (no UA defaults).
- **Stop conditions** (terse — full list below): adding a wash limit, a threshold
  colour, or a look→clothes link; changing plan 203's API surface; weakening a test
  assertion; faking the screenshot.
- **Test / verification for success**: vitest — pure-logic units over the AND
  filter, the thumbnail box maths and the day labels, plus jsdom component tests
  over the tile's three targets, the undo bar and every empty state. Then a real
  puppeteer screenshot the owner can look at.
- **Open points for plan readiness**: none. (`needs_prs` was filled with `162`
  once plan 203 was raised, so boss will not dispatch this until that PR closes.)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Before writing any component, invoke the `ui-craft` skill.** Its discovery
> phase is already answered by the "Visual contract" section below — use it for
> the anti-slop rules and control-styling checklist, not to re-open layout or
> palette decisions the owner has already made.
>
> **Drift check (run first)**: `git diff --stat cfa259f7..HEAD -- apps/closet-app`
> Expected: plan 203's files (schema, worker, smoke, docs, config) present, and
> `src/main.tsx` still the one-line placeholder. If `src/worker/index.ts` differs
> from the endpoint table below, re-read it and STOP if the contract changed.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED — the SPA is the whole product surface; a wrong tap target is a
  daily annoyance and a wrong filter makes the Looks tab useless
- **Depends on**: 203
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `cfa259f7`, 2026-08-17

## Why this matters

The owner re-wears jeans, hoodies, shirts and jackets several times before
washing. The counting is not the hard part — remembering to log is. So the whole
UI is shaped around one interaction: **tap the photo of what you wore, at night,
one-handed, in about five seconds.** Everything else is secondary to that tap
being big, obvious and reversible.

Three design decisions were made by the owner on 2026-08-17. **Do not
re-litigate them:**

1. **No wash limit and no threshold colour.** A tile shows a raw count. Sorting
   highest-count-first is what surfaces "wash me" — not red text, not a badge, not
   a limit the owner has to set per garment. The owner said the limit is
   subjective and they will judge on the go.
2. **Looks are a plain gallery.** A look is a photo plus tags. There is **no**
   link to the clothes in it and **no** "I wore this look" button. The owner was
   offered that feature and turned it down.
3. **Multi-tag everywhere.** Every photo, on both tabs, carries any number of
   tags from one shared vocabulary.

## Current state

Plan 203 landed `apps/closet-app/` with the Worker, schema, R2 photo store,
`scripts/smoke.sh` and docs. `src/main.tsx` is a placeholder:

```tsx
// src/main.tsx — placeholder. Plan 204 replaces this with the real SPA.
import { createRoot } from 'react-dom/client'
import './client/globals.css'

createRoot(document.getElementById('root')!).render(<h1>closet-app API online</h1>)
```

**The API contract you are building against** (from plan 203, Step 6 — do not
change any path or payload):

| Method | Path | Body → Response |
|---|---|---|
| GET | `/api/me` | → `{authenticated:boolean}` |
| POST | `/auth/login` | `{password}` → `{ok:true}` or `401 {error}` |
| POST | `/auth/logout` | → `{ok:true}` |
| GET | `/api/state` | → `{clothes,looks,tags,item_tags}` |
| POST | `/api/photos` | raw JPEG bytes, `Content-Type: image/jpeg` → `201 {key}` |
| GET | `/api/photos/:key` | → image bytes (cookie auth; `<img src>` works same-origin) |
| POST | `/api/clothes` | `{name,tags?,photo_key?}` → `201` Cloth |
| PATCH | `/api/clothes/:id` | `{name?,tags?,photo_key?}` → Cloth |
| DELETE | `/api/clothes/:id` | → `{ok:true}` |
| POST | `/api/clothes/:id/wear` | → `{cloth,event_id}` |
| POST | `/api/clothes/:id/wash` | → `{cloth,event_id}` |
| POST | `/api/events/:id/undo` | → `{cloth}` |
| POST | `/api/looks` | `{name?,tags?,photo_key}` → `201` Look |
| PATCH | `/api/looks/:id` | `{name?,tags?,photo_key?}` → Look |
| DELETE | `/api/looks/:id` | → `{ok:true}` |

Row shapes returned by `/api/state`:

```ts
type Cloth = { id: string; name: string; photo_key: string | null; wears: number
               last_worn_at: number | null; last_washed_at: number | null; created_at: number }
type Look  = { id: string; name: string | null; photo_key: string | null; created_at: number }
type Tag   = { id: string; name: string; created_at: number }
type ItemTag = { item_type: 'cloth' | 'look'; item_id: string; tag_id: string }
```

Notes that shape the client:

- `tags` in a **request** body is an array of **raw strings**, never ids. The
  Worker normalises (trim, lowercase, collapse whitespace) and de-duplicates them.
  `/api/state` returns ids, for reading and filtering only.
- `/api/state` already sorts `clothes` highest-`wears`-first. Preserve that order;
  do not re-sort in the client.
- Uploads are capped at **400 KB** server-side (`413` above that), which is why
  Step 3's downscale exists.
- Tags with no remaining item are pruned server-side, so the chip row never shows
  a tag that filters to nothing.

**Exemplars to imitate**:

- `apps/lists-app/src/App.tsx` — the three-state auth gate (`loading | in | out`).
  Copy this shape exactly.
- `apps/lists-app/src/client/Login.tsx` — the password screen.
- `apps/lists-app/src/client/api.ts` — the `req<T>()` fetch wrapper that throws
  `Unauthorized` on 401 so the app can bounce to login. Copy and extend.

**Browser-UI standard** (`decisions.md` 2026-07-31): a UI with more than one view
and saved state is a Vite + React + TS component app — which is what this already
is. Do not hand-roll HTML template strings anywhere.

**Known UI defect class in this repo** (LESSONS 2026-07-31 boss-verify):
UA-default (white-on-dark, unstyled) `<select>`, `<button>` and `<input>` controls
have shipped twice because scoped CSS missed a reused class name. Every
interactive element in this plan gets explicit classes. Step 10 greps for it.

## Commands you will need

Run from `apps/closet-app`.

| Purpose | Command | Expected |
|---|---|---|
| Install | `npm install` | exit 0 (updates the lockfile after Step 1's new deps) |
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Build | `npm run build` | exit 0, writes `dist/` |
| Tests | `npm test` | exit 0 |
| API smoke | `bash scripts/smoke.sh` | exit 0, prints `SMOKE OK` |
| Dev loop | `npm run dev:local` then open `http://localhost:5173` | Vite :5173 + wrangler :8787 |
| Local DB | `npm run db:local` | `"success": true` |
| Make icons | `node scripts/make-icons.mjs` | writes 3 PNGs into `public/` |
| Screenshot | `npm run shoot` | writes `.shots/*.png`, exits non-zero on a page error |
| Merge gate (repo root) | `cd apps/closet-app && npm ci && npm run build && npm test && bash scripts/smoke.sh` | exit 0 |

## Scope

**In scope**:

```
apps/closet-app/
  package.json                      + 4 devDeps (Step 1)
  index.html                        + PWA meta tags
  src/main.tsx                      replace placeholder with <App/>
  src/App.tsx                       auth gate
  src/client/globals.css            palette tokens + control base classes
  src/client/types.ts               Cloth, Look, Tag, ItemTag, AppState
  src/client/api.ts                 typed fetch wrappers
  src/client/photo.ts               fitBox + downscale
  src/client/filter.ts              filterByTags + lastWornLabel + tagIndex
  src/client/Login.tsx
  src/client/Closet.tsx             shell: tabs, chip row, undo bar, add button
  src/client/ClothesTab.tsx
  src/client/ClothTile.tsx
  src/client/LooksTab.tsx
  src/client/LookViewer.tsx
  src/client/EditSheet.tsx
  src/client/TagInput.tsx
  src/client/PhotoPicker.tsx
  src/client/UndoBar.tsx
  public/manifest.webmanifest
  public/icon-192.png  public/icon-512.png  public/icon-512-maskable.png
  scripts/make-icons.mjs            SVG → PNG via headless Chrome, run once
  scripts/shoot.mjs                 copied from apps/gym-app
  test/filter.test.ts  test/photo.test.ts  test/ui.test.tsx
  .shots/clothes.png  .shots/looks.png     committed screenshots (ui: true gate)
  README.md  CLAUDE.md              + a "Screens" section
plans/README.md                     flip 204 to DONE
```

**Out of scope** — looks related, do not touch:

- `src/worker/**`, `schema.sql`, `wrangler.toml`, `scripts/smoke.sh` — plan 203's
  API is the contract. If the SPA seems to need a new endpoint, that is a STOP,
  not a quick addition.
- `apps/lists-app/**` and `apps/gym-app/**` — read-only exemplars. Copying a file
  is fine; editing one is a STOP.
- Any look→clothes relationship, in the schema, the API or the UI.
- `INFRA.md`, `my-hosted-sites.md`, `decisions.md` — the owner updates these after
  the first real deploy.
- Deploying. `deploy:` is blank on purpose; the owner gates it per
  `personal-stuff-change-control`.

## Git workflow

- Branch: `advisor/204-closet-app-spa`
- Commit per step, message `feat(closet-app): <step>` — no AI footers. Do NOT push.

## Visual contract

Mobile-first, dark, one thumb. Tailwind v4 utility classes; the palette lives as
CSS custom properties in `globals.css` so nothing hard-codes a hex twice.

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#0b0b0c` | page background |
| `--surface` | `#17171a` | tiles, sheet, chips |
| `--surface-2` | `#1f1f24` | pressed / hover |
| `--border` | `#2a2a31` | hairlines, chip outline |
| `--text` | `#f4f4f5` | names, counts |
| `--muted` | `#8b8b93` | sub-lines, placeholder |
| `--accent` | `#4f8cff` | active chip, primary button, tab underline |
| `--danger` | `#ef4444` | delete confirm |

Layout rules:

- Grid: `grid-cols-2` under 480 px, `grid-cols-3` at `sm:` and up. Square photos
  via `aspect-square object-cover`.
- The **count is the visual hero** of a cloth tile: large, `tabular-nums`, no unit
  label, no "/". It is a bare number.
- Minimum touch target **44 px** on every tappable element.
- Tab bar sticks to the top; the undo bar sticks to the bottom
  (`pb-[env(safe-area-inset-bottom)]`).
- No animation beyond a 150 ms opacity/transform on the sheet and undo bar.

**Every interactive control carries explicit classes** — `<button>`, `<input>`,
`<textarea>`. No element may rely on user-agent defaults. This is the repo's
recurring UI defect (LESSONS 2026-07-31) and Step 10 greps for it.

## Steps

### Step 1: Add the four dev dependencies

Add to `devDependencies` in `apps/closet-app/package.json`:

```json
"@testing-library/dom": "^11.0.0",
"@testing-library/react": "^17.0.0",
"jsdom": "^28.0.0",
"puppeteer-core": "^25.1.0"
```

Add two scripts:

```json
"shoot": "node scripts/shoot.mjs",
"icons": "node scripts/make-icons.mjs"
```

Then `npm install` and commit the updated `package-lock.json`.

Component tests select the jsdom environment with a per-file docblock
(`// @vitest-environment jsdom`) rather than a config file, so the Worker tests
from plan 203 keep running in the default node environment.

**Verify**: `cd apps/closet-app && npm run typecheck && npm test` → exit 0 (plan
203's tests still pass).

### Step 2: Write the pure logic — `src/client/filter.ts`

This is the plan's load-bearing snippet. **Use it as written.** The AND semantics
are the whole point of stacking chips; an `OR` here silently makes the Looks tab
useless as the gallery grows.

```ts
/**
 * filter.ts — pure helpers for the tag chip row and the tile sub-lines.
 * Kept free of React and of `fetch` so vitest can pin the behaviour directly.
 */

import type { ItemTag } from './types'

/** item id → the set of tag ids it carries, for one tab's item type. */
export function tagIndex(itemTags: ItemTag[], itemType: 'cloth' | 'look'): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>()
  for (const row of itemTags) {
    if (row.item_type !== itemType) continue
    const set = index.get(row.item_id) ?? new Set<string>()
    set.add(row.tag_id)
    index.set(row.item_id, set)
  }
  return index
}

/**
 * Items carrying EVERY selected tag — AND, not OR.
 *
 * Stacking `office` + `winter` must NARROW the grid. If this ever becomes
 * `.some()`, adding a chip widens the result set, which is the opposite of what
 * a filter is for and is invisible until the gallery is big.
 */
export function filterByTags<T extends { id: string }>(
  items: T[],
  index: Map<string, Set<string>>,
  selected: string[],
): T[] {
  if (selected.length === 0) return items
  return items.filter((item) => {
    const owned = index.get(item.id)
    if (!owned) return false
    return selected.every((t) => owned.has(t))
  })
}

/** Midnight of the day `ms` falls in, so "yesterday 11pm" is not "today". */
function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * The small grey line under a cloth's count. Calendar days, not elapsed hours —
 * the owner thinks in nights, not in 24-hour windows.
 */
export function lastWornLabel(lastWornAt: number | null, now: number): string {
  if (lastWornAt === null) return 'never worn'
  const days = Math.round((startOfDay(now) - startOfDay(lastWornAt)) / 86_400_000)
  if (days <= 0) return 'worn today'
  if (days === 1) return 'worn yesterday'
  return `worn ${days} days ago`
}
```

Write `test/filter.test.ts`. The AND test **must be named exactly**
`AND filter narrows, never widens` — the mutation gate matches that string:

```ts
import { describe, it, expect } from 'vitest'
import { tagIndex, filterByTags, lastWornLabel } from '../src/client/filter'
import type { ItemTag } from '../src/client/types'

const ROWS: ItemTag[] = [
  { item_type: 'look', item_id: 'L1', tag_id: 'office' },
  { item_type: 'look', item_id: 'L1', tag_id: 'winter' },
  { item_type: 'look', item_id: 'L2', tag_id: 'office' },
  { item_type: 'look', item_id: 'L3', tag_id: 'winter' },
  { item_type: 'cloth', item_id: 'C1', tag_id: 'office' },
]
const LOOKS = [{ id: 'L1' }, { id: 'L2' }, { id: 'L3' }, { id: 'L4' }]

describe('tagIndex', () => {
  it('indexes only the requested item type', () => {
    const idx = tagIndex(ROWS, 'look')
    expect([...(idx.get('L1') ?? [])].sort()).toEqual(['office', 'winter'])
    expect(idx.has('C1')).toBe(false)
  })
})

describe('filterByTags', () => {
  it('returns everything when nothing is selected', () => {
    expect(filterByTags(LOOKS, tagIndex(ROWS, 'look'), [])).toHaveLength(4)
  })

  it('AND filter narrows, never widens', () => {
    const idx = tagIndex(ROWS, 'look')
    const one = filterByTags(LOOKS, idx, ['office']).map((l) => l.id)
    const two = filterByTags(LOOKS, idx, ['office', 'winter']).map((l) => l.id)
    expect(one).toEqual(['L1', 'L2'])
    expect(two).toEqual(['L1'])
    expect(two.length).toBeLessThanOrEqual(one.length)
  })

  it('excludes items with no tags at all once a chip is active', () => {
    expect(filterByTags(LOOKS, tagIndex(ROWS, 'look'), ['office']).map((l) => l.id)).not.toContain('L4')
  })

  it('returns nothing when no item carries the whole set', () => {
    expect(filterByTags(LOOKS, tagIndex(ROWS, 'look'), ['office', 'winter', 'summer'])).toEqual([])
  })
})

describe('lastWornLabel', () => {
  const now = new Date('2026-08-17T21:00:00').getTime()
  it('names never, today, yesterday and N days', () => {
    expect(lastWornLabel(null, now)).toBe('never worn')
    expect(lastWornLabel(new Date('2026-08-17T07:00:00').getTime(), now)).toBe('worn today')
    expect(lastWornLabel(new Date('2026-08-16T23:30:00').getTime(), now)).toBe('worn yesterday')
    expect(lastWornLabel(new Date('2026-08-14T10:00:00').getTime(), now)).toBe('worn 3 days ago')
  })
})
```

**Verify**: `cd apps/closet-app && npm test` → exit 0, the 8 new cases pass.

**Then prove the mutation fires**:

```bash
cd apps/closet-app
node -e "const f='src/client/filter.ts';const fs=require('fs');let s=fs.readFileSync(f,'utf8');s=s.replace('selected.every((t) => owned.has(t))','selected.some((t) => owned.has(t))');fs.writeFileSync(f,s)"
npm test; echo "exit=$?"     # MUST fail, naming "AND filter narrows, never widens"
git checkout -- src/client/filter.ts
npm test                     # MUST pass again
```

### Step 3: Write the photo pipeline — `src/client/photo.ts`

Phone cameras emit 3–8 MB JPEGs; the Worker rejects anything over 400 KB. The
box maths is split out as a pure function because `createImageBitmap` does not
exist in jsdom, so only `fitBox` is unit-testable.

```ts
/**
 * photo.ts — shrink a camera photo on the phone before upload.
 *
 * The grid never shows more than a small tile, and the Worker caps uploads at
 * 400 KB, so a full-resolution capture is pure waste on mobile data. Longest
 * edge is clamped, then JPEG quality steps down until the blob fits — a busy
 * photo degrades instead of being rejected.
 */

const MAX_EDGE = 640
const MAX_BYTES = 380 * 1024 // under the Worker's 400 KB cap, with headroom
const QUALITIES = [0.82, 0.7, 0.6, 0.5, 0.4]

/** Target pixel box for an image, never upscaling. */
export function fitBox(width: number, height: number, maxEdge: number = MAX_EDGE): { w: number; h: number } {
  const longest = Math.max(width, height)
  const scale = longest > maxEdge ? maxEdge / longest : 1
  return { w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) }
}

/** Re-encode `file` as a small JPEG blob. Throws with a user-showable message. */
export async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { w, h } = fitBox(bitmap.width, bitmap.height)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('This browser could not resize the photo')
  }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  let last: Blob | null = null
  for (const quality of QUALITIES) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) continue
    last = blob
    if (blob.size <= MAX_BYTES) return blob
  }
  // Lowest quality still over the cap: send it and let the Worker's 413 surface
  // in the sheet, rather than failing silently on the client.
  if (last) return last
  throw new Error('Could not save the photo')
}
```

Write `test/photo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { fitBox } from '../src/client/photo'

describe('fitBox', () => {
  it('clamps the longest edge to 640 and keeps the aspect ratio', () => {
    expect(fitBox(4032, 3024)).toEqual({ w: 640, h: 480 })
    expect(fitBox(3024, 4032)).toEqual({ w: 480, h: 640 })
  })

  it('never upscales a photo that is already small', () => {
    expect(fitBox(200, 150)).toEqual({ w: 200, h: 150 })
  })

  it('never returns a zero dimension for an extreme ratio', () => {
    const { w, h } = fitBox(5000, 1)
    expect(w).toBe(640)
    expect(h).toBeGreaterThanOrEqual(1)
  })
})
```

**Verify**: `cd apps/closet-app && npm test` → exit 0.

### Step 4: Write `types.ts` and `api.ts`

`src/client/types.ts` mirrors plan 203's row shapes exactly (quoted in "Current
state"), plus `export type AppState = { clothes: Cloth[]; looks: Look[]; tags: Tag[]; item_tags: ItemTag[] }`
and `export type TabKey = 'clothes' | 'looks'`.

`src/client/api.ts` — copy `apps/lists-app/src/client/api.ts`'s `req<T>()` wrapper
verbatim (it throws `Unauthorized` on 401 so `App.tsx` can bounce to login), then
replace the endpoint methods with:

```ts
export const api = {
  me: () => req<{ authenticated: boolean }>('/api/me'),
  login: (password: string) =>
    req<{ ok: true }>('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => req<{ ok: true }>('/auth/logout', { method: 'POST' }),
  state: () => req<AppState>('/api/state'),

  /** Upload raw JPEG bytes. `req` must NOT set a JSON content-type here. */
  uploadPhoto: async (blob: Blob): Promise<{ key: string }> => {
    const res = await fetch('/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
    })
    if (res.status === 401) throw new Error('Unauthorized')
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(data?.error || `Upload failed (${res.status})`)
    }
    return (await res.json()) as { key: string }
  },

  createCloth: (body: { name: string; tags: string[]; photo_key: string | null }) =>
    req<Cloth>('/api/clothes', { method: 'POST', body: JSON.stringify(body) }),
  updateCloth: (id: string, body: { name?: string; tags?: string[]; photo_key?: string | null }) =>
    req<Cloth>(`/api/clothes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteCloth: (id: string) => req<{ ok: true }>(`/api/clothes/${id}`, { method: 'DELETE' }),

  wear: (id: string) => req<{ cloth: Cloth; event_id: string }>(`/api/clothes/${id}/wear`, { method: 'POST' }),
  wash: (id: string) => req<{ cloth: Cloth; event_id: string }>(`/api/clothes/${id}/wash`, { method: 'POST' }),
  undo: (eventId: string) => req<{ cloth: Cloth }>(`/api/events/${eventId}/undo`, { method: 'POST' }),

  createLook: (body: { name: string | null; tags: string[]; photo_key: string }) =>
    req<Look>('/api/looks', { method: 'POST', body: JSON.stringify(body) }),
  updateLook: (id: string, body: { name?: string | null; tags?: string[]; photo_key?: string }) =>
    req<Look>(`/api/looks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteLook: (id: string) => req<{ ok: true }>(`/api/looks/${id}`, { method: 'DELETE' }),
}
```

**Verify**: `cd apps/closet-app && npm run typecheck` → exit 0.

### Step 5: Write the shell — `App.tsx`, `Login.tsx`, `Closet.tsx`, `globals.css`

`src/App.tsx` — copy `apps/lists-app/src/App.tsx`'s three-state gate exactly,
rendering `<Login/>` or `<Closet/>`.

`src/client/Login.tsx` — copy `apps/lists-app/src/client/Login.tsx`, retitle to
`Closet`, keep the same shape (password input, error line, submit button).

`src/client/globals.css` — `@import 'tailwindcss';` then the palette from the
Visual contract as `:root` custom properties, plus base classes every control
uses so nothing falls back to a UA default:

```css
@import 'tailwindcss';

:root {
  --bg: #0b0b0c;
  --surface: #17171a;
  --surface-2: #1f1f24;
  --border: #2a2a31;
  --text: #f4f4f5;
  --muted: #8b8b93;
  --accent: #4f8cff;
  --danger: #ef4444;
}

html, body { background: var(--bg); color: var(--text); }
body { -webkit-tap-highlight-color: transparent; }

/* Base classes for interactive controls. Every button/input in this app uses
   one of these — nothing relies on user-agent styling (LESSONS 2026-07-31). */
.btn { @apply min-h-11 rounded-xl px-4 text-sm font-medium transition-opacity active:opacity-70; }
.btn-primary { @apply btn; background: var(--accent); color: #06122b; }
.btn-ghost { @apply btn; background: var(--surface-2); color: var(--text); }
.btn-danger { @apply btn; background: var(--danger); color: #fff; }
.field {
  @apply min-h-11 w-full rounded-xl px-3 text-base outline-none;
  background: var(--surface-2); color: var(--text); border: 1px solid var(--border);
}
.field:focus { border-color: var(--accent); }
.field::placeholder { color: var(--muted); }
```

`src/client/Closet.tsx` — the shell. It owns all app state and is the only
component that calls the API for mutations; the tabs and tiles receive callbacks.

State it holds: `state: AppState | null`, `error: string | null`,
`tab: TabKey`, `selectedTagIds: string[]`, `sheet` (closed / add-cloth /
add-look / edit-cloth:id / edit-look:id), `viewingLookId: string | null`,
`undo: { label: string; eventId: string } | null`.

Behaviour it must encode:

- Load `/api/state` on mount. On `Unauthorized`, call the `onLogout` prop.
- **`selectedTagIds` resets to `[]` on every tab switch.** The two tabs draw from
  one vocabulary but a tag that exists on clothes may match no looks, so carrying
  the selection across leaves the user on a mysteriously empty grid. This is a
  lifecycle requirement, not a nicety — Step 9 tests it.
- The chip row shows only tags that appear on the **current tab's** item type,
  ordered by name. If that set is empty, **the whole row is not rendered** — no
  empty rail.
- Tapping a chip toggles it in `selectedTagIds`.
- After a wear or wash, replace that cloth in `state.clothes` from the response
  and set `undo`. **Do not re-sort** — a tile jumping under the thumb mid-tap is
  worse than a stale position. The order refreshes on the next `/api/state` load.
- Setting `undo` starts a 10-second timer that clears it. A new wear/wash replaces
  the previous `undo` and restarts the timer. **Clear the timer on unmount** and
  before replacing it, or a stale timeout wipes the new bar early.
- Tapping Undo posts `/api/events/:id/undo`, replaces the cloth from the response,
  and clears the bar immediately.

**Verify**: `cd apps/closet-app && npm run build` → exit 0, and
`npm run dev:local` then `http://localhost:5173` shows the login screen with a
styled password field (not a UA-default box).

### Step 6: Write the Clothes tab — `ClothesTab.tsx`, `ClothTile.tsx`

Tile anatomy, top to bottom. **Three separate hit targets**, because one tile that
does three things via long-press is undiscoverable:

```
┌─────────────────┐
│                 │  ← button #1: the photo. aspect-square, object-cover.
│     [photo]     │    Tap = +1 wear. aria-label "Add a wear to <name>"
│                 │
├─────────────────┤
│ Blue jeans      │  ← button #2: the name. Tap = open the edit sheet.
│ 4               │    aria-label "Edit <name>"
│ worn 3 days ago │    The count is the hero: text-3xl, tabular-nums.
│ ↺ washed        │  ← button #3. Tap = confirm, then reset to 0.
└─────────────────┘    aria-label "Mark <name> as washed"
```

Rules:

- `↺ washed` asks for confirmation once via `window.confirm('Washed <name>? The count goes back to 0.')`.
  A wash is the one action Undo makes awkward to notice, so it gets a gate.
  (Undo still covers it — both are true.)
- Photo rendering, in order: `photo_key` present → `<img src={`/api/photos/${photo_key}`} loading="lazy" alt="">`.
  `photo_key` null **or** the `<img>` fires `onError` → a placeholder: the
  `--surface-2` square with the garment's first letter, uppercase, `text-4xl`,
  `--muted`. The photo button stays **enabled** in the placeholder case — a
  missing picture must never block logging a wear.
- The count renders as a bare number. No `/`, no limit, no colour change at any
  value. (See "Why this matters".)
- `ClothesTab` renders the grid from the already-filtered list its parent passes.

Empty states, per surface — **enumerate all of them**:

| Situation | What renders |
|---|---|
| No clothes at all | Centred: “No clothes yet.” + a `.btn-primary` “Add your first cloth” that opens the add sheet |
| Clothes exist, filter matches none | Centred: “Nothing carries all of those tags.” + a `.btn-ghost` “Clear tags” that empties `selectedTagIds` |
| A cloth has no photo, or its photo 404s | Letter placeholder (above). All three buttons stay enabled |
| `/api/state` failed | Full-screen: the error message + a `.btn-primary` “Retry”. Neither tab renders half-loaded |

**Verify**: `npm run dev:local`, add a cloth via the sheet, tap its photo three
times → the count reads `3`; tap `↺ washed`, confirm → it reads `0`.

### Step 7: Write the Looks tab — `LooksTab.tsx`, `LookViewer.tsx`

- `LooksTab` is a photo-only grid — no names on the tiles, no counts. Tapping a
  tile opens `LookViewer`.
- `LookViewer` is a full-screen overlay: the photo at `object-contain`, the
  optional name, its tag chips (read-only), and two controls — `.btn-ghost`
  “Edit” (opens the edit sheet) and `.btn-danger` “Delete” (confirms, then
  deletes and closes). A `.btn-ghost` “Close” dismisses it.
- **There is no “I wore this look” button and no list of clothes in the look.**
  The owner rejected linking looks to clothes. If a look seems to need it, that is
  a STOP.

Empty states:

| Situation | What renders |
|---|---|
| No looks at all | Centred: “No looks yet.” + `.btn-primary` “Add your first look” |
| Looks exist, filter matches none | Centred: “No looks carry all of those tags.” + `.btn-ghost` “Clear tags” |
| A look's photo 404s | Neutral `--surface-2` square with a small “photo missing” label in `--muted`. Tapping still opens the viewer so it can be deleted |

**Verify**: `npm run dev:local`, add two looks — one tagged `office winter`, one
tagged `office`. Tap `office` → both show. Also tap `winter` → only the first.

### Step 8: Write `EditSheet.tsx`, `TagInput.tsx`, `PhotoPicker.tsx`

**`PhotoPicker`** — the camera path:

```tsx
<input
  type="file"
  accept="image/*"
  capture="environment"
  className="hidden"
  ref={inputRef}
  onChange={onPick}
/>
```

`onPick` → `downscale(file)` → `api.uploadPhoto(blob)` → hand the returned `key`
to the parent. While in flight, show a spinner over the thumbnail and disable
Save. On failure, surface the message inside the sheet — **the sheet must not
close and the typed name must survive**, so a retry costs one tap, not retyping.
Show a local `URL.createObjectURL` preview once a file is picked, and revoke it on
unmount.

**`TagInput`** — chips plus autocomplete over the shared vocabulary:

- Current tags render as removable chips (chip + an `×` button, both styled).
- A `.field` text input adds a tag on `Enter` or `,`.
- Below it, up to 6 suggestions from the existing `tags` list whose name contains
  the typed text and which are not already on this item. Tapping one adds it.
- Input is normalised client-side the same way the Worker does — trim, lowercase,
  collapse inner whitespace — so the chip the user sees matches the row that gets
  stored. Duplicate adds are ignored silently.
- The suggestion list is the whole reason the vocabulary stays clean; without it
  the owner types `officewear` once and gets a second near-duplicate tag forever.

**`EditSheet`** — one bottom sheet serving four cases: add-cloth, edit-cloth,
add-look, edit-look.

| Field | Cloth | Look |
|---|---|---|
| Photo (`PhotoPicker`) | optional | **required** — Save disabled until a key exists |
| Name (`.field`) | **required** — Save disabled while blank | optional |
| Tags (`TagInput`) | optional, unlimited | optional, unlimited |
| Delete (`.btn-danger`) | edit mode only, confirms first | edit mode only, confirms first |

Save posts create or patch, then closes and refreshes state from the response.
Cancel closes without saving. Pressing Save twice must not double-create —
disable it while the request is in flight.

**Verify**: `cd apps/closet-app && npm run typecheck && npm run lint` → exit 0;
in `dev:local`, adding a cloth with tags `Jeans` and ` CASUAL ` produces chips
reading `jeans` and `casual`.

### Step 9: Write the component tests — `test/ui.test.tsx`

jsdom + Testing Library, with `// @vitest-environment jsdom` as the first line.
Stub `fetch` per test; do not hit a real server here (`scripts/smoke.sh` covers
the wire).

These behaviours each need their own assertion, because a UI behaviour with no
machine check silently degrades into a lookalike stub (LESSONS 2026-07-24):

1. A cloth tile renders its name, its bare count and its `worn N days ago` line.
2. Tapping the **photo** calls `POST /api/clothes/:id/wear` exactly once and the
   rendered count goes up by one.
3. Tapping the **name** opens the edit sheet with the name pre-filled — and does
   **not** post a wear.
4. Tapping `↺ washed` with `window.confirm` stubbed `true` posts `/wash` and the
   count renders `0`; stubbed `false` posts nothing.
5. The undo bar appears after a wear, and tapping Undo posts
   `/api/events/:id/undo` and restores the previous count.
6. The undo bar disappears on its own after 10 s (`vi.useFakeTimers()`).
7. Switching tabs **clears** `selectedTagIds` — after selecting a chip on
   Clothes and switching to Looks, no chip is active and the full look grid shows.
8. Selecting two chips shows only items carrying both (the AND path, through the
   real component).
9. Each empty state from the Step 6 and 7 tables renders its stated copy and its
   stated button, and the “Clear tags” button empties the selection.
10. A cloth with `photo_key: null` renders the letter placeholder **and its photo
    button is still enabled** (`expect(btn).not.toBeDisabled()`).
11. `/api/state` rejecting renders the Retry screen and neither tab's grid.

**Verify**: `cd apps/closet-app && npm test` → exit 0, all cases pass.

### Step 10: PWA manifest, icons, and the control-styling sweep

`index.html` — add the PWA head tags, following `apps/gym-app/index.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#0b0b0c" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Closet" />
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

`public/manifest.webmanifest` — same shape as `apps/gym-app/public/manifest.webmanifest`:

```json
{
  "name": "Closet",
  "short_name": "Closet",
  "description": "Wear counter and tagged outfit gallery",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0b0b0c",
  "theme_color": "#0b0b0c",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Do **not** add a service worker. The app is useless offline (every photo and
count comes from the Worker), and a stale SW cache is a classic way to ship an
app that shows yesterday's data.

`scripts/make-icons.mjs` — no image library is installed, so render an inline SVG
in headless Chrome and screenshot it. Run it **once** and commit the PNGs; nothing
at test time depends on it.

```js
// scripts/make-icons.mjs — render the app icon to PNG with the system Chrome.
// Run once: `node scripts/make-icons.mjs`. The PNGs are committed; the merge
// gate never runs this, so puppeteer is not a gate dependency.
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'

const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// A hanger over a dark tile. `pad` leaves the safe area a maskable icon needs.
const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0b0b0c"/>
  <g transform="translate(256 256) scale(${1 - pad}) translate(-256 -256)"
     fill="none" stroke="#4f8cff" stroke-width="26"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M256 150a34 34 0 1 1 34 34c0 18-16 26-34 34"/>
    <path d="M256 218 96 330a16 16 0 0 0 9 29h302a16 16 0 0 0 9-29L256 218z"/>
  </g>
</svg>`

const targets = [
  { file: 'public/icon-192.png', size: 192, pad: 0.12 },
  { file: 'public/icon-512.png', size: 512, pad: 0.12 },
  { file: 'public/icon-512-maskable.png', size: 512, pad: 0.3 },
]

mkdirSync('public', { recursive: true })
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
try {
  for (const { file, size, pad } of targets) {
    const page = await browser.newPage()
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 })
    await page.setContent(
      `<style>html,body{margin:0;padding:0;background:#0b0b0c}svg{width:${size}px;height:${size}px;display:block}</style>${svg(pad)}`,
    )
    await page.screenshot({ path: file, omitBackground: false })
    await page.close()
    console.log(`wrote ${file}`)
  }
} finally {
  await browser.close()
}
```

Copy `apps/gym-app/scripts/shoot.mjs` to `apps/closet-app/scripts/shoot.mjs`
unchanged (it drives the system Chrome via puppeteer-core, prints page console
errors, and exits non-zero on an uncaught page error).

**Control-styling sweep.** Every interactive element must carry an explicit class.
Run this and read the output — it lists every control and the classes on it:

```bash
cd apps/closet-app
grep -rnE '<(button|input|textarea|select)\b' src/ | grep -v 'className=' \
  && echo "UNSTYLED CONTROL FOUND" || echo "all controls carry className"
```

**Verify**: the grep prints `all controls carry className`; `node scripts/make-icons.mjs`
writes three PNGs; `ls -la public/icon-*.png` shows three non-zero files.

### Step 11: Screenshots and docs

With `npm run dev:local` running and a few real clothes + looks added by hand
(the owner will see this image, so it must show actual content, not an empty grid):

```bash
cd apps/closet-app
mkdir -p .shots
node scripts/shoot.mjs http://localhost:5173 .shots/clothes.png --width=430 --height=932
# switch to the Looks tab in the browser, then:
node scripts/shoot.mjs http://localhost:5173 .shots/looks.png --width=430 --height=932
```

Both PNGs must be **committed** — `ui: true` means boss rejects the branch
without an image. Do not synthesise, mock up or hand-draw them; a fabricated
screenshot is a STOP condition.

Then update the docs:

- `README.md` — add a **Screens** section describing both tabs, the three tap
  targets on a cloth tile, the 10-second undo, and AND-semantics chip filtering.
  Embed the two screenshots.
- `CLAUDE.md` — add a **UI guardrails** block: no wash limit and no threshold
  colour; looks never link to clothes; `selectedTagIds` resets on tab switch;
  every control carries an explicit class (`.btn*` / `.field`) because UA-default
  controls are a repeat defect here; no service worker.

**Verify**: `cd apps/closet-app && ls .shots/*.png && grep -q "Screens" README.md && grep -q "UI guardrails" CLAUDE.md && echo docs-ok`
→ `docs-ok`.

### Step 12: Full gate on a fresh checkout

```bash
cd "$(git rev-parse --show-toplevel)"
git status --porcelain apps/closet-app     # expect: empty
T="$(mktemp -d)"
git clone --no-hardlinks -q . "$T/fresh"
cd "$T/fresh" && git checkout -q advisor/204-closet-app-spa
cd apps/closet-app && npm ci && npm run build && npm test && bash scripts/smoke.sh
```

**Verify**: exits 0 and prints `SMOKE OK`.

## Test plan

| Layer | File | Catches |
|---|---|---|
| Pure logic | `test/filter.test.ts` | AND-vs-OR filtering, tag indexing, day labels |
| Pure logic | `test/photo.test.ts` | thumbnail box maths, no upscaling, no zero dimension |
| Components | `test/ui.test.tsx` | the tile's three targets not collapsing into one, undo appear/expire/apply, tab switch clearing the filter, every empty state, placeholder-photo button staying enabled, the state-load error screen |
| Backend (kept) | `test/auth.test.ts`, `test/logic.test.ts`, `scripts/smoke.sh` | plan 203's API still intact |
| Gate integrity | Step 2's mutation drill | that the AND test can actually fail |
| Static sweep | Step 10's grep | UA-default controls |
| Human | `.shots/*.png` | what the owner actually sees |
| Fresh tree | Step 12 | build-order dependencies |

## Done criteria

- [ ] `cd apps/closet-app && npm ci && npm run build && npm test && bash scripts/smoke.sh` exits 0 and prints `SMOKE OK`.
- [ ] `npm run typecheck && npm run lint` both exit 0.
- [ ] Step 2's mutation drill makes `npm test` fail naming `AND filter narrows, never widens`; reverting makes it pass.
- [ ] Step 10's grep prints `all controls carry className`.
- [ ] `public/icon-192.png`, `public/icon-512.png`, `public/icon-512-maskable.png` and `public/manifest.webmanifest` are committed and non-empty.
- [ ] `.shots/clothes.png` and `.shots/looks.png` are committed, non-empty, and show real content (not an empty grid).
- [ ] `grep -rn "wash_limit\|needs_wash\|wore this look\|look_clothes" apps/closet-app/src/` returns nothing.
- [ ] `grep -rn "serviceWorker\|sw.js" apps/closet-app/src apps/closet-app/public` returns nothing.
- [ ] `git diff --name-only <203 merge SHA>..HEAD` lists only paths from the "In scope" list — no `src/worker/**`, no `schema.sql`.
- [ ] Step 12's fresh-clone run exits 0.
- [ ] `git status --porcelain` is clean, no stray scratch files.
- [ ] `plans/README.md` row for 204 says `DONE`.

## STOP conditions

- **The SPA appears to need a new or changed endpoint.** Plan 203's table is the
  contract. Stop and report rather than editing `src/worker/**`.
- **A test assertion fails and the honest fix is unclear.** Fix the component or
  the fixture. Weakening, swapping or deleting an assertion to reach green is a
  STOP (LESSONS 2026-07-31, 2026-07-24).
- **The mutation drill in Step 2 still passes.** A gate that cannot fire reads as
  coverage it does not have. Stop and report.
- **You are about to add a wash limit, a threshold colour, a “needs wash” badge,
  an “I wore this look” button, or any look→clothes association.** All were
  explicitly rejected by the owner on 2026-08-17. Stop and report.
- **A screenshot cannot be captured** (no Chrome, dev server won't start). Stop and
  report. Do **not** commit a mocked, drawn, or empty-state image in its place —
  the point of `ui: true` is that the owner sees the real thing.
- **`window.confirm` feels wrong for the wash gate and you want a custom modal.**
  Out of scope; the tests assert on `confirm`. Stop and report if you disagree.
- **Any edit to `apps/lists-app/**` or `apps/gym-app/**`.** Read-only exemplars.
- **The control-styling grep finds an unstyled control you cannot fix without
  restructuring.** Report it rather than deleting the check.

## Maintenance notes

- **`selectedTagIds` resetting on tab switch is a lifecycle contract, not a
  detail.** A fresh page load cannot observe it, so only the in-session component
  test in Step 9 guards it. Do not delete that test when refactoring the shell.
- **The tile's three hit targets are the core interaction.** Collapsing them into
  one element with a long-press menu would pass a naive render test and ruin the
  app. Step 9 case 3 is what stops that.
- **Undo depends on `event_id` coming back from wear/wash.** If a future
  optimistic-update refactor drops the response body, undo dies silently. The
  `event_id` round trip is load-bearing.
- **The photo placeholder must never disable the wear button.** A cloth whose
  photo failed to upload is exactly the one the owner still wants to log.
- **Filtering is client-side on purpose.** `/api/state` returns everything, which
  is right at tens of items. Revisit only if the wardrobe reaches thousands.
- **A reviewer should scrutinise**: whether the AND test still fails under
  mutation, whether every control has a class, whether the screenshots show real
  data, and whether anything under `src/worker/**` was touched.

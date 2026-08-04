<!-- boss frontmatter -->
---
executor: agy
model:                   # blank = agy default (Gemini 3.1 Pro High)
test_cmd: cd pipelines/video/visuals-flow && bash scripts/check.sh
                         # the smoke gate gains card-plan assertions in this plan (attach
                         # affordance markup, approve button inside the action slot), so the
                         # gate can fail on this plan's own deliverable.
ui: true                 # user-facing — crew must attach screenshots (card plan tab; attach affordance before/after states)
deploy:                  # no deploy — localhost tool
needs: ["170"]
---

# Plan 171: FeedbackBox component (attach affordance rework) + Card Plan tab

## Summary

- **Problem statement**: (1) The screenshot-attach control is defined three times in the legacy board (`fbBox` in `buildDetailBlocks`, `renderBoardPage`, `renderTimelinePage` — drifted twice already), its styles live in `RUN_CSS` which the `/list` page doesn't include (so it renders as a default white UA button on the dark theme there), the remove-× only appears after attaching and is easy to miss, and the thumbnail injects mid-tile and pushes content around. (2) The Card Plan tab (Gate 1, step 037) doesn't exist in the SPA yet.
- **Goals**:
  - ONE `FeedbackBox` React component (textarea + attach affordance) used by every feedback surface from now on; attach affordance reworked to the spec inlined below (styled chip, fixed-height slot so attaching never shifts layout, always-visible remove on the thumb).
  - A `FeedbackProvider` context owning dirty-tracking and pending images — the SPA equivalent of the legacy `FB_DIRTY`/`FB_IMAGES` page-local consts, in exactly one place.
  - Card Plan tab in the SPA: sections, EXISTING/NEW chips, proposal specs, why-boxes posting to `/card-feedback`, reviewed ticks, prior-comment history, and **Approve card plan in the shared action slot**.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — component code, CSS, and store are fully inlined; the tab is a port of inlined legacy markup.
- **Done criteria** (terse): `bash scripts/check.sh` exit 0 with new smoke assertions (one styled attach control per feedback box on #card-plan, approve inside `.action-slot`); vitest green on the feedback store.
- **Stop conditions** (terse): don't change the server's `/save` / `/card-feedback` contracts; don't touch legacy pages; keep the CSS-var palette; folded feedback stays read-only.
- **Test / verification for success**: vitest on the store + smoke assertions on the rendered tab + PR screenshots.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat adda9be..HEAD -- pipelines/video/visuals-flow/board-ui/ pipelines/video/visuals-flow/scripts/board-ui-smoke.mjs`
> Plans 169 and 170 must be merged (`board-ui/src/App.tsx` exists). If not, STOP.

## Status

- **Priority**: high
- **Effort**: medium
- **Risk**: low-medium
- **Depends on**: plan 170
- **Category**: feature (UI)
- **Planned-at SHA**: `adda9be`

## Why this matters

Feedback is the board's product — every comment and screenshot the owner leaves is read by the next fixing session out of `feedback.json`. The legacy triple-definition of the attach control is the single most-bitten trap in this file (bitten twice; a regression test exists only because of it). In the SPA there is exactly one component, so the whole failure class dies here. The attach rework is the owner's priority #3 verbatim.

## Current state (facts, verified at adda9be)

All paths relative to `pipelines/video/visuals-flow/`.

- Legacy `fbBox` (one of the 3 copies, board.mjs lines ~1070–1085): a `textarea.feedback[data-ref]` + `.fb-shot` row with `.fb-attach` button (`&#128206; screenshot`, title `attach a screenshot — or just paste one into the box above`), hidden `.fb-file` input, `.fb-thumb` span that gains an `<img>` + `.fb-clear` × only when an image exists. Folded items render `✓ folded <step> — "<text>"` and are immutable.
- Legacy client behaviors to preserve (SAVE_ACTIONS_JS, lines ~596–671): attach via button OR paste into the textarea; images >6MB rejected with `alert('image too large (max 6MB)')`; non-image files ignored; attaching sets dirty; `FB_IMAGES[ref] = null` marks "remove on next save"; existing saved images render from `/feedback-image/<ref>` and clear the same way; `beforeunload` guards dirty state.
- Save wire format (`POST /save`, handleSave lines ~2303–2361): `feedback` = `{ [ref]: text }` for every box, `feedbackImages` = only refs touched this session (dataURL to set, `null` to clear). **The server contract does not change in this plan.**
- `/card-feedback` (lines ~2874–2888): POST `{ part, cue, card, text }`, `part` must be in `PLAN_PARTS`; feedback keys become `zone-<part>:<n>` / `card-body:<n>`.
- Card Plan legacy markup to port (renderTimelinePage lines ~1397–1524): summary `N cues · N existing · N to build`; per-section `<h2>` with optional timecode span; per-item row: `#id`, card slug, placement chip, EXISTING (ok-colored) / `NEW — to build` (err-colored) badge, flagged chip, anchor line, proposal box (`does` text + `kind/beats/placement/vars` spec bits), prior comments with `added`/`folded` annotations, why-box + Save posting to `/card-feedback` then refetching; section-level note box (`a note about the <part> as a whole`); approved banner names the next step (`build the NEW cards (step 038), then run.sh <slug> resolve` when `toBuild > 0`).
- Reviewed ticks: rid `cp:<item.id>`, localStorage key `board:reviewed:<video>` — a Set of rids, view-preference ONLY (never in cues.json: handleSave un-approves on cue change, so review state there would revoke approvals — the reason for the localStorage design).
- API data (plan 169): `cardPlan.sections`, `cardPlan.comments[part]`, `cardPlan.approved`, `feedback` map.
- Card Plan approve: `POST /approve-card-plan` (no body) then refetch board data (legacy reloads the page; the SPA refetches).

## Commands you will need

```bash
cd pipelines/video/visuals-flow
(cd board-ui && npx vitest run)
(cd board-ui && npm run build)
node scripts/board-ui-smoke.mjs
bash scripts/check.sh
node lib/board.mjs test-01     # manual check: http://localhost:4322/app/?video=test-01#card-plan
```

## Scope

**In scope:**
- `board-ui/src/components/FeedbackBox.tsx` + `FeedbackBox.css` (new)
- `board-ui/src/lib/feedback.tsx` (new — provider + hook + pure helpers)
- `board-ui/src/components/ReviewTick.tsx` + `board-ui/src/lib/reviewed.ts` (new)
- `board-ui/src/tabs/CardPlanTab.tsx` + `CardPlanTab.css` (new; replaces the plan-170 placeholder)
- `board-ui/src/App.tsx` (mount FeedbackProvider; wire card-plan actions/meta into the header)
- `board-ui/test/feedback.test.ts`, `board-ui/test/reviewed.test.ts` (new)
- `scripts/board-ui-smoke.mjs` (append card-plan assertions)

**Out of scope (do NOT touch):** `lib/board.mjs`, `lib/board-data.mjs`, `lib/board.test.mjs`, `scripts/check.sh` (the smoke script is already wired), legacy pages, `videos/**`.

## The attach affordance spec (the rework — obey exactly)

Layout: the attach row is ALWAYS rendered under the textarea at a fixed height, so attaching/removing never shifts surrounding content.

```
[ textarea.feedback                                   ]
[ (📎 screenshot)  ·row is 44px tall, always·         ]   ← no image
[ [thumb 34px][×]  ·same 44px row·                    ]   ← image attached
```

`FeedbackBox.css`:

```css
.fb-shot { height: 44px; display: flex; align-items: center; gap: 8px; }
.fb-attach { font: inherit; font-size: 12px; color: var(--dim); background: var(--panel);
  border: 1px solid var(--line); border-radius: 6px; padding: 5px 10px; cursor: pointer;
  line-height: 1; white-space: nowrap; }
.fb-attach:hover { color: var(--text); border-color: var(--accent); }
.fb-thumb-chip { display: inline-flex; align-items: center; gap: 2px;
  border: 1px solid var(--ok); border-radius: 6px; padding: 2px; }
.fb-thumb-chip img { height: 34px; border-radius: 4px; display: block; }
.fb-clear { background: none; border: none; color: var(--dim); cursor: pointer;
  font-size: 15px; padding: 0 6px; }
.fb-clear:hover { color: var(--err); }
.feedback { width: 100%; min-height: 34px; font: inherit; font-size: 12px; margin: 8px 0 4px;
  background: rgba(251,146,60,0.05); color: var(--text);
  border: 1px dashed rgba(251,146,60,0.4); border-radius: 6px; padding: 6px 8px; }
.feedback:focus { border-style: solid; outline: none; }
.feedback-folded { font-size: 12px; color: var(--dim); margin-bottom: 8px; }
```

Rules: when an image is present the chip REPLACES the attach button (one affordance at a time); the × is always visible on the chip; button title stays `attach a screenshot — or just paste one into the box above` (paste-first is the intended flow); paste into the textarea attaches; >6MB alert text unchanged.

## Steps

1. **`board-ui/src/lib/feedback.tsx`** — provider + pure core:

   ```tsx
   export type FeedbackItem = { text?: string; added?: string; folded?: string; image?: string; context?: unknown };
   type State = {
     texts: Record<string, string>;               // current box contents, seeded from BoardData.feedback
     images: Record<string, string | null>;       // ONLY refs touched this session (dataURL | null=clear)
     dirty: boolean;
   };
   // pure — vitest these:
   export function validateImageFile(f: { type: string; size: number }): string | null {
     if (!f.type.startsWith('image/')) return 'not an image';
     if (f.size > 6 * 1024 * 1024) return 'image too large (max 6MB)';
     return null;
   }
   export function savePayloadFeedback(state: State): { feedback: Record<string, string>; feedbackImages?: State['images'] } {
     const out: { feedback: Record<string, string>; feedbackImages?: State['images'] } = { feedback: { ...state.texts } };
     if (Object.keys(state.images).length) out.feedbackImages = state.images;  // untouched refs never re-sent
     return out;
   }
   ```
   `FeedbackProvider` seeds `texts` from `BoardData.feedback` (skipping folded), exposes `{ items, texts, images, dirty, setText(ref, v), attach(ref, file), clearImage(ref), markSaved() }`; `attach` uses `FileReader.readAsDataURL`, alerts on `validateImageFile` failure; any mutation sets `dirty`. A `useEffect` in the provider registers the `beforeunload` guard while dirty. `App.tsx` passes `dirty` to `AppHeader` (the video-switch confirm from plan 170 now has a real signal).

2. **`FeedbackBox.tsx`**:

   ```tsx
   export function FeedbackBox({ refKey, placeholder }: { refKey: string; placeholder: string }) {
     const fb = useFeedback();
     const item = fb.items[refKey];
     const fileRef = useRef<HTMLInputElement>(null);
     if (item?.folded) {
       return <div className="feedback-folded">✓ folded {item.folded} — “{item.text}”</div>;
     }
     const pending = fb.images[refKey];                     // dataURL | null | undefined
     const src = pending != null ? pending
       : (pending === null ? null
       : item?.image ? `/feedback-image/${encodeURIComponent(refKey)}` : null);
     const onPaste = (e: React.ClipboardEvent) => {
       for (const it of e.clipboardData?.items ?? []) {
         if (it.kind === 'file' && it.type.startsWith('image/')) {
           e.preventDefault(); fb.attach(refKey, it.getAsFile()!); return;
         }
       }
     };
     return (
       <div className="fb">
         <textarea className="feedback" data-ref={refKey} placeholder={placeholder}
           value={fb.texts[refKey] ?? ''} onChange={(e) => fb.setText(refKey, e.target.value)}
           onPaste={onPaste} />
         <div className="fb-shot" data-ref={refKey}>
           {src ? (
             <span className="fb-thumb-chip">
               <img src={src} alt="attached screenshot" />
               <button type="button" className="fb-clear" title="remove screenshot"
                       onClick={() => fb.clearImage(refKey)}>×</button>
             </span>
           ) : (
             <button type="button" className="fb-attach"
                     title="attach a screenshot — or just paste one into the box above"
                     onClick={() => fileRef.current?.click()}>📎 screenshot</button>
           )}
           <input ref={fileRef} type="file" className="fb-file" accept="image/*" hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) fb.attach(refKey, f); e.target.value = ''; }} />
         </div>
       </div>
     );
   }
   ```
   (`clearImage` on a previously-saved image sets `images[refKey] = null` — the server drops it on next save, same as legacy.)

3. **Reviewed ticks.** `board-ui/src/lib/reviewed.ts`: pure `loadReviewed(video): Set<string>` / `saveReviewed(video, set)` over localStorage key `board:reviewed:<video>` (JSON array — exact legacy format so existing state survives the migration), plus a `useReviewed(video)` hook returning `{ has(rid), toggle(rid), count, setAll(rids, on) }`. `ReviewTick.tsx`: the `reviewed` checkbox label (legacy `.rev` look — inline-flex, 11px, `--dim`, turns `--ok` when reviewed). Collapse behavior on card-plan rows: a reviewed row hides everything but its header line (CSS class `is-reviewed`, port of `.reviewable.is-reviewed` rules at board.mjs lines ~244–251).

4. **`CardPlanTab.tsx`** — port the legacy markup enumerated in Current state, consuming `BoardData.cardPlan` + `FeedbackBox` is NOT used here (card-plan why-boxes are the one-shot `/card-feedback` input+Save pattern, not the save-collector — keep that distinction). Wire into `App.tsx`:
   - header `meta`: `{items} cues · {existing} existing · {toBuild} to build`;
   - header `actions`: `<button className="approve" onClick={approveCardPlan}>Approve card plan</button>` → `POST /approve-card-plan`, then refetch board data (no page reload);
   - approved banner (dismissable, ok-styled) with the next-step wording from Current state;
   - `secondary`: reviewed count (`n / m reviewed`).
   Why-box submit: POST `/card-feedback` with `{ part, cue, card, text }`, disable the button while in flight, refetch on 200 (prior comments update).

5. **Vitest**: `feedback.test.ts` — `validateImageFile` (ok / not-image / >6MB), `savePayloadFeedback` (untouched images omitted; touched included incl. `null`), provider reducer transitions if extracted as a pure reducer (setText marks dirty; markSaved clears). `reviewed.test.ts` — round-trips a Set through the exact legacy JSON format; `setAll` on/off.

   **Verify:** `cd board-ui && npx vitest run` → green.

6. **Smoke additions** (`scripts/board-ui-smoke.mjs`, new assertion function for `#card-plan`, using the smoke workdir's card-plan.json from plan 170):
   - dump-dom of `…&probe=layout#card-plan` contains `class="fb-attach"` OR `class="fb-thumb-chip"` — wait: card-plan has why-boxes, not FeedbackBoxes. Assert instead: `Approve card plan` appears INSIDE the `.action-slot` element (parse the dump: the action-slot div's innerHTML contains the button text), `data-rid="cp:c01"` present, `plan-note` input present.
   - `#storyboard` placeholder still renders the FeedbackBox for `_global` **only if App already mounts one** — to make the attach affordance smoke-checkable NOW, mount `<FeedbackBox refKey="_global" …/>` in the storyboard placeholder panel (plan 172 keeps it). Assert: exactly one `.fb-shot` on `#storyboard`, and the attach button carries the `fb-attach` class (the styled chip — the unstyled-UA-button bug cannot recur silently).
   - re-assert header y-stability still passes (no-op — it runs for all tabs already).

   **Verify:** `node scripts/board-ui-smoke.mjs` → `board-ui smoke OK`.

7. **Screenshots for the PR**: `#card-plan` on test-01; the `_global` FeedbackBox in its three states (empty / image attached / folded — folded exists on test-01's feedback.json; if not, screenshot empty+attached only and say so).

## Test plan

Vitest (step 5) + smoke assertions (step 6). Legacy suites untouched and green via check.sh.

## Done criteria (machine-checkable)

```bash
cd pipelines/video/visuals-flow
bash scripts/check.sh                          # exit 0 (vitest + build + extended smoke)
node scripts/board-ui-smoke.mjs                # 'board-ui smoke OK' — includes card-plan assertions
```
Plus PR screenshots (card plan tab; attach affordance states).

## STOP conditions

- Any change to the `/save`, `/card-feedback`, `/approve-card-plan` request/response shapes → STOP (server contracts are frozen until plan 174).
- A folded item becoming editable in the UI → STOP; folded is read-only history by design.
- Don't restyle beyond the spec block — no new colors, no icon libraries (the 📎 emoji is the icon).
- Never write outside the repo.

## Maintenance notes

- Every future feedback surface must use `FeedbackBox` + `useFeedback` — never a second textarea+attach implementation. The legacy fbBox×3 story ("bitten twice") is why.
- `images` holding only touched refs is a wire-format guarantee (untouched images must not be re-encoded server-side on every save) — keep `savePayloadFeedback` the single payload builder; plan 172's save collector composes it.

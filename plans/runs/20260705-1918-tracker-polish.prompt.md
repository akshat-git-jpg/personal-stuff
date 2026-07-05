# Tracker polish round — cursors, section colors, activity-loading fix

Repo `/Users/kbtg/codebase/personal-stuff`. Work on branch **main** → create
`git checkout -b advisor/021-tracker-polish` from current HEAD first.
App: `apps/tracker-app`. Do exactly these four items, nothing else. Do not push.

## 1. Pointer cursors on everything clickable

Tailwind v4 preflight sets `cursor: default` on buttons — that's why nothing
shows a pointer. Global fix in `src/client/globals.css` (after the imports):

```css
button:not(:disabled),
[role="button"]:not(:disabled),
select:not(:disabled),
summary {
  cursor: pointer;
}
```

Then sweep the client for clickable non-button elements missing
`cursor-pointer` (MyWork item cards, journey-rail nodes if clickable, table
rows in PipelineBoard already have it — verify, attention-panel item rows,
DONE disclosure header). Editable text inputs keep their native text cursor —
don't touch them.

**Verify**: dev:local — hovering tabs, action buttons, cards, selects,
disclosure headers all show a pointer.

## 2. Color-code the My Work section headings

In `src/client/MyWork.tsx`, the section headers (NEEDS YOUR REVIEW / NEEDS
YOUR ACTION / WAITING ON REVIEW / UP NEXT / DONE) are all the same muted
gray. Give each heading a tone: a small colored dot before the label plus the
label text in the tone color. Use exactly:

| Section | Text classes | Dot |
|---|---|---|
| Needs your review | `text-amber-700 dark:text-amber-400` | `bg-amber-500` |
| Needs your action | `text-orange-700 dark:text-orange-400` | `bg-orange-500` |
| Waiting on review | `text-blue-700 dark:text-blue-400` | `bg-blue-500` |
| Up next | keep `text-muted-foreground` | `bg-muted-foreground/40` |
| Done | `text-emerald-700 dark:text-emerald-400` | `bg-emerald-500` |

Keep the existing size/tracking/uppercase styling and count badges; only add
dot + text color. Check both light and dark themes.

**Verify**: dev:local as sam — five sections visibly color-distinct in both
themes (toggle via the moon button).

## 3. Fix: Activity section stuck on "Loading..."

Two layers:

a) **Client hardening (do regardless of root cause).**
   `src/client/api.ts` `getCardEvents` (line ~255): the `return res.json()`
   escapes the try/catch (the promise isn't awaited), so a JSON parse
   rejection propagates to a caller with no `.catch` and the loading flag
   never clears. Change to `const data = await res.json(); return data;`
   inside the try. In `src/client/CardDetail.tsx` (~lines 188-197) add
   `.catch(() => { setEvents([]); setEventsLoaded(true); })` and clear
   `eventsLoading` in a `.finally`. When loading failed AND events are empty,
   render "Couldn't load activity" with a small Retry button that resets
   `eventsLoaded` to false (re-triggers the effect).

b) **Root cause on prod.** Reproduce: open a card on
   https://tutorials-tracker.agrolloo.com, expand Activity, watch the network
   tab for `/api/card-events?row_id=…` — record status + response body. If
   the response is HTML (SPA fallback swallowed the route) or a 500, fix the
   worker route accordingly (`src/worker/index.ts:718` area) and note what
   you found in the run log. If prod can't be reproduced from your side,
   verify the route locally (`npm run seed:local`, dev:local, expand Activity
   on a `test-` card after a sendback) and note that the client hardening
   covers the prod symptom.

**Verify**: locally — sendback a card, expand Activity → thread renders; kill
the network (devtools offline) and expand on another card → error + Retry
appears, no infinite "Loading...".

## 4. No-code item: local vs prod parity

The owner saw a different UI on :5173 (Overview/stat cards) — that was a
stale browser tab from a transient dev state; the source is identical to
prod. After your changes: restart `npm run dev:local` fresh, hard-refresh,
and confirm :5173 shows the same layout as prod (My work / Board / Team).
Note the confirmation in the run log. No code change.

## Verification gate

```bash
cd apps/tracker-app
npm test                              # all pass
npm run build                         # exit 0
npm run seed:local && npm run e2e     # all pass
```

## Commit (one), then stop — do NOT push, do NOT deploy

`fix(tracker-app): pointer cursors, tinted My Work sections, activity-load hardening`
No AI footers.

## Run-log: `plans/runs/20260705-1918-tracker-polish.md` (header exists)

Append: `RUN START`, a HEARTBEAT at least every 3 minutes, one `PLAN polish
DONE  verify: <results>  files: <files>` line (include the card-events root
cause you found), then `RUN DONE` as the final line.

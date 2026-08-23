---
executor: claude-p
model: sonnet
test_cmd: cd apps/founders-tracker && npm run typecheck && npm test && npm run shot
ui: true
deploy:
needs: ["236 lands habit_logs, the habits API and the pure habit module"]
needs_prs: [197]
touches: [apps/founders-tracker/src/client/grouping.ts, apps/founders-tracker/src/client/HabitStrip.tsx, apps/founders-tracker/src/client/TaskList.tsx, apps/founders-tracker/src/client/TaskCard.tsx, apps/founders-tracker/src/client/App.tsx, apps/founders-tracker/src/client/api.ts, apps/founders-tracker/src/client/RecurringScreen.tsx, apps/founders-tracker/src/client/index.css, apps/founders-tracker/test/grouping.test.ts, apps/founders-tracker/scripts/shot.mjs, apps/founders-tracker/package.json, apps/founders-tracker/README.md]

mutation_apply: perl -0pi -e 's/if \(d <= 7\) return "week";/if (d <= 7) return "later";/' apps/founders-tracker/src/client/grouping.ts
mutation_command: cd apps/founders-tracker && npm test
mutation_expect: BUCKET_WEEK_IS_SEVEN_DAYS
mutation_cwd:
mutation_timeout: 900
---

# Plan 237: founders-tracker — the Today strip and a tracker you can read

## Summary

- **Problem statement**: The tracker renders every open item as an identical full-width card with a red progress bar, in one flat list. With 73 items the four that mattered were invisible, and every card screamed "40D OVERDUE" so nothing did. Owner's verdict: *"Need a better flow, better UI for this. This is a bad product."*
- **Goals**:
  - A **Today strip** at the top: each active daily/weekly habit as one tickable line with its streak and best. Ticking calls the habit API — it never creates a task.
  - The task list **grouped** into Overdue / Today / This week / Later / No date, with a counted header per group and empty groups dropped.
  - **Dense single-line rows** replace the tall cards. The per-row progress bar and shouting `40D OVERDUE` chip are deleted; the group header is the only place colour lives.
  - Drag-reorder survives, scoped inside a group.
  - The Repeats screen labels each template as a **Habit** or a **Monthly task** so the two concepts are never confused again.
- **Executor proposed**: `claude-p` / Claude Sonnet — `tooling/boss/data/rules.md` row "plan can't be fully inlined": this is a UI re-expression where the executor continuously re-reads the existing components and re-shapes them, which the honesty rider of the readiness gate calls judgment work, not placement. Compensated with a Playwright behaviour gate, a mutation gate, and pure-function unit tests.
- **Done criteria** (terse): `npm run typecheck && npm test && npm run shot` exit 0; `test/grouping.test.ts` ≥ 14 passing tests; `docs/shots/tracker.png` and `docs/shots/habit-ticked.png` committed.
- **Stop conditions** (terse): a habit tick creates a task; a `.bar` progress element survives in a task row; an assertion is weakened to go green.
- **Test / verification for success**: Vitest unit tests over the pure bucketing/label functions, plus a Playwright pass that seeds a local D1, ticks a habit and asserts the streak increments and the group headers render in order — the same script produces the `ui:` gate screenshots.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e2fa1815..HEAD -- apps/founders-tracker/`
> Plan 236's commits **are expected** in that diff. What must NOT appear is any
> prior change under `apps/founders-tracker/src/client/`.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (rewrites the app's main surface; the Playwright gate is new to this app)
- **Depends on**: Plan 236 (`habit_logs`, `GET /api/bootstrap` returning `habits`, `POST /api/habits/:id/toggle`, `src/habits.ts`)
- **Category**: feature
- **Difficulty**: tricky
- **Planned at**: commit `e2fa1815`, 2026-08-23

## Why this matters

Plan 236 fixed the data model so the list cannot grow on its own. This plan makes the list readable.

Three specific design failures are being corrected, and the intent behind each matters more than the exact pixels:

1. **Every row shouts equally.** A red bar plus `40D OVERDUE` on all 73 rows carries zero information. Urgency must be encoded **once**, at the group boundary, so the eye finds the overdue block instantly and then reads calm rows inside it.
2. **No altitude.** A flat list forces the reader to compute "what is actually due" from 73 dates. Grouping does that computation once, up front.
3. **Habits and tasks looked identical.** They are different kinds of thing and now they live in different parts of the screen — a strip you tick, and a list you clear.

If a detail below is ambiguous, choose whatever keeps those three sentences true.

## Current state

### What Plan 236 has already landed (do not re-implement)

- `src/habits.ts` — pure module exporting `addDaysYmd`, `daysBetweenYmd`, `isoWeek`, `periodKey`, `periodStart`, `periodStep`, `currentStreak`, `bestStreak`, `isHabitCadence`, `HABIT_CADENCES`.
- `src/shared.ts` — adds:
  ```ts
  export interface HabitToday {
    templateId: number;
    title: string;
    owner: Owner;
    cadence: "daily" | "weekly";
    anchorYmd: string;
    keptNow: boolean;
    streak: number;
    best: number;
    total: number;
  }
  ```
- `GET /api/bootstrap` → `{ tasks, templates, habits, scoreboard }`.
- `GET /api/habits` → `HabitToday[]`.
- `POST /api/habits/:templateId/toggle` → the updated `HabitToday`.
- `habit_logs(id, template_id, anchor_ymd, done_at)` with a unique index on `(template_id, anchor_ymd)`.
- Daily/weekly templates no longer generate tasks; monthly ones still do.

**If any of the above is missing when you run the drift check, STOP** — Plan 236 has not landed and this plan cannot be executed.

### Client files as they stand

| File | Role | What happens to it |
|---|---|---|
| `src/client/App.tsx` | Root: bootstrap fetch, screen + owner tab state, all mutation handlers | edited — add habits state + toggle, render the strip |
| `src/client/TaskList.tsx` | Renders QuickAdd, one flat `SortableContext` over open tasks, collapsible Done section | rewritten — grouped buckets |
| `src/client/TaskCard.tsx` | A tall card: drag handle, round checkbox, repeat chip, title, `Deadline` sub-component (date + progress bar + `N DAYS LEFT`), edit/delete | edited — read view becomes one dense line; the `Deadline` component is deleted; the editing branch is kept verbatim |
| `src/client/api.ts` | typed fetch wrapper + `BootstrapData` | edited — `habits` field, `toggleHabit` |
| `src/client/RecurringScreen.tsx` | template CRUD list + modal form | edited — habit/task labelling only |
| `src/client/dates.ts` | `todayIST`, `addDaysIST`, `tomorrowIST`, `daysLeft`, `etaUrgency`, `fmtEta`, `fmtEtaShort`, `DOW` | edited — `etaUrgency` is deleted (its only consumer was the bar) |
| `src/client/index.css` | the whole warm-editorial theme, ~17 KB | edited — new blocks, several deleted |
| `src/client/QuickAdd.tsx`, `DatePick.tsx`, `AutoTextarea.tsx` | inline add form, chip date picker, growing textarea | **untouched** |

### The exact code being replaced

`src/client/TaskCard.tsx` read view (lines 89–100) and the `Deadline` component (lines 110–131):

```tsx
          <>
            {repeat && (
              <div className="repeat-chip" title="generated from a repeat">
                <span className="ic">↻</span>{repeat}
              </div>
            )}
            <div className={`title ${open ? "tappable" : ""}`}
              onClick={open ? startEdit : undefined}>{task.title}</div>
            {deadline}
          </>
```

```tsx
function Deadline({ eta, editable, onEdit, onClear }: {
  eta: string; editable: boolean; onEdit: () => void; onClear: () => void;
}) {
  const d = daysLeft(eta);
  const u = etaUrgency(d);
  // bar fills as the deadline approaches: ~full 14+ days out, empty at the wire.
  const fill = d < 0 ? 100 : Math.max(6, Math.min(100, Math.round((d / 14) * 100)));
  const label = d < 0 ? `${-d}d overdue` : d === 0 ? "due today" : `${d} day${d === 1 ? "" : "s"} left`;

  return (
    <div className="deadline">
      <button className="date" onClick={editable ? onEdit : undefined} disabled={!editable}>
        <span className="ic">◷</span>{fmtEta(eta)}
      </button>
      <span className={`bar ${u}`}><span style={{ width: `${fill}%` }} /></span>
      <span className={`days ${u}`}>{label}</span>
      {editable && (
        <button className="clear-eta" onClick={onClear} aria-label="clear deadline" title="clear deadline">✕</button>
      )}
    </div>
  );
}
```

`src/client/TaskList.tsx` open-list body (lines 51–62) — one flat `SortableContext`:

```tsx
    <div>
      <QuickAdd owner={owner} onAdd={onAdd} />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {open.map((t) => (
            <SortableRow key={t.id} task={t} repeat={cadenceOf(t)}
              onToggleDone={onToggleDone} onSetEta={onSetEta} onSaveEdit={onSaveEdit} onDelete={onDelete} />
          ))}
        </SortableContext>
      </DndContext>
      {open.length === 0 && <p className="empty">Nothing open here — a clear slate.</p>}
```

`src/client/api.ts` bootstrap type (lines 12–16):

```ts
export interface BootstrapData {
  tasks: Task[];
  templates: Template[];
  scoreboard: Scoreboard;
}
```

`src/client/dates.ts` (lines 34–41) — deleted by this plan:

```ts
export type Urgency = "safe" | "soon" | "over";

/** Calm 3-tier deadline mood: comfortable / approaching / due-now-or-past. */
export function etaUrgency(d: number): Urgency {
  if (d <= 2) return "over"; // overdue, due today, or within 2 days
  if (d <= 7) return "soon";
  return "safe";
}
```

CSS rules to delete from `src/client/index.css` (they exist verbatim, in the "Deadline row" block):

```css
.bar { flex: 1; height: 5px; border-radius: 999px; background: var(--paper-2); overflow: hidden; min-width: 30px; }
.bar > span { display: block; height: 100%; border-radius: 999px; }
.bar.safe > span { background: var(--safe); }
.bar.soon > span { background: var(--soon); }
.bar.over > span { background: var(--over); }
.days { font-weight: 700; font-size: 11px; white-space: nowrap; letter-spacing: .04em;
  text-transform: uppercase; font-variant-numeric: tabular-nums; }
.days.safe { color: var(--safe); } .days.soon { color: var(--soon); }
.days.over { color: var(--over); }
```

### Design tokens already in `index.css` `:root` — use these, invent no new colours

```
--paper #f3ede1   --paper-2 #ece3d2   --surface #fbf7ef
--ink #211b14     --ink-soft #4b4338  --muted #8c8275   --faint #b3a892
--line #e0d6c3    --line-2 #d4c8b1
--navy #1f3a5f    --navy-ink #16293f
--safe #3f7d57    --soon #bd8420      --over #b23a2e
--shadow, --shadow-lg
```

Fonts: `"Fraunces", Georgia, serif` for display; `"Hanken Grotesk", system-ui, …` for UI. `.app` is `max-width: 660px`.

### Conventions to follow

- **UI architecture**: this app is already the repo's sanctioned shape — Vite + React + TS components. Keep it. One component per file, named export, props typed by an `interface Props` above the component. Exemplar: `src/client/TaskList.tsx`.
- **Pure logic out of components.** Anything computable from `(task, today)` goes in `src/client/grouping.ts` and gets a unit test. This is what makes the UI verifiable at all — see LESSONS 2026-07-24 ("UI behaviours need a machine-checkable verify each or they silently downgrade to lookalike stubs").
- **`src/` files**: double quotes, semicolons, 2-space indent. **`test/` files**: single quotes, no semicolons (match `test/auth.test.ts`).
- **`noUnusedLocals` / `noUnusedParameters` are on** in `tsconfig.app.json`. Any import
  left behind after a deletion (`daysLeft`, `etaUrgency`, `fmtEta` in `TaskCard.tsx`) is a
  hard typecheck failure.
- **`src/habits.ts` must already be listed in `tsconfig.app.json`'s `include`** — Plan 236
  adds it. `grep -c "src/habits.ts" tsconfig.app.json` returning `0` means 236 did not
  finish; that is a STOP, not something to patch here.
- **Every interactive control must be styled.** LESSONS 2026-07-31: UA-default white-on-dark `<select>`/`<button>` is a recurring port defect in this repo. Any control you add gets an explicit `font-family: inherit`, colour, background, and border.

### Design decisions already made — do not re-litigate

1. **Bucket boundaries**: `overdue` = eta before today; `today` = eta is today; `week` = 1–7 days out inclusive; `later` = 8+ days out; `undated` = no eta. Fixed. The `<= 7` boundary is the mutation gate.
2. **Colour lives on the group header only.** `overdue` header text uses `--over`, `today` uses `--soon`, the rest use `--muted`. Rows are neutral regardless of bucket. This is the whole point of the redesign — do not add per-row urgency colour "for clarity".
3. **Row meta text** is exactly `metaLabel()` from Step 1. No progress bar, no uppercase countdown.
4. **Empty groups are not rendered.** No header for a bucket with zero tasks.
5. **Drag is scoped per group**, and on drop the client rebuilds the *full* open-lane order (groups in `BUCKET_ORDER`, the dragged group in its new internal order) and posts that single array — the existing `PATCH /api/tasks/reorder` contract is unchanged.
6. **The Today strip shows habits for BOTH owners**, not just the selected tab. It is one shared rhythm board and sits above the owner tabs. Each row carries the owner's initial.
7. **Paused habits do not appear in the strip** (Plan 236's `listHabitsToday` already filters them). They are managed from the Repeats screen.
8. **Tab labels stay "Tracker" / "Repeats".** Only the per-template *labelling inside* the Repeats screen changes.

## Commands you will need

All from `apps/founders-tracker` unless stated.

| Purpose | Command | Expected |
|---|---|---|
| Install deps | `npm install` | exit 0 |
| Add the Playwright devDep | `npm install -D @playwright/test@^1.61.1` | exit 0 |
| Install the browser binary | `npx playwright install chromium` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Unit tests | `npm test` | exit 0, `Tests  <N> passed`, N ≥ 36 (22 from Plan 236 + ≥ 14 here) |
| Build | `npm run build` | exit 0 |
| Local D1 schema | `npm run db:local` | exit 0 |
| Screenshots + behaviour gate | `npm run shot` | exit 0, writes 2 PNGs under `docs/shots/` |
| Merge gate (repo root) | `cd apps/founders-tracker && npm run typecheck && npm test && npm run shot` | exit 0 |

**Do NOT run** `npm run db:remote`, `npm run deploy`, or any `--remote` wrangler command.

**Do NOT change** the pinned versions of `wrangler` (`4.111.0`) or `@cloudflare/vite-plugin` (`1.45.0`). They are an exact-pinned matched pair (`decisions.md` 2026-07-16) and bumping either alone breaks the deploy. Adding `@playwright/test` as a devDep is fine.

## Scope

**In scope** (the only files you may create or edit):

- `apps/founders-tracker/src/client/grouping.ts` (new)
- `apps/founders-tracker/src/client/HabitStrip.tsx` (new)
- `apps/founders-tracker/src/client/App.tsx`
- `apps/founders-tracker/src/client/TaskList.tsx`
- `apps/founders-tracker/src/client/TaskCard.tsx`
- `apps/founders-tracker/src/client/RecurringScreen.tsx`
- `apps/founders-tracker/src/client/api.ts`
- `apps/founders-tracker/src/client/dates.ts`
- `apps/founders-tracker/src/client/index.css`
- `apps/founders-tracker/test/grouping.test.ts` (new)
- `apps/founders-tracker/scripts/shot.mjs` (new)
- `apps/founders-tracker/package.json` (the `shot` script + the `@playwright/test` devDep only)
- `apps/founders-tracker/docs/shots/*.png` (new, committed)
- `apps/founders-tracker/README.md`
- `plans/README.md` (your status row only)
- `plans/237-founders-today-strip-and-dense-tracker.md` (`git add` this plan file itself)

**Out of scope — looks related, do not touch**:

- Everything under `src/worker/` and `src/habits.ts`, `src/shared.ts` — Plan 236 owns them and they are already correct. Needing to change one means this plan mis-specified something: STOP and report.
- `schema.sql`, `migrations/` — 236's.
- `src/client/QuickAdd.tsx`, `DatePick.tsx`, `AutoTextarea.tsx` — the add form and date chips are fine as they are, and the redesign does not need them.
- `test/auth.test.ts`, `src/worker/auth.ts` — unrelated; the token shape is explicitly frozen.
- `computeScoreboard` and any scoreboard rendering — there is no scoreboard surface in the current UI and this plan does not add one.
- `package.json` dependency versions other than adding `@playwright/test`.
- Any other app under `apps/`.

## Git workflow

- Branch: `advisor/237-founders-today-strip-and-dense-tracker`
- Commit per step. Messages: `feat(founders-tracker): <what>` — no AI footers.
- Do **NOT** push.

## Steps

### Step 1: The pure grouping module

Create `apps/founders-tracker/src/client/grouping.ts` with **exactly** this content:

```ts
// Pure task-shaping logic for the tracker view. No React, no fetch — every
// function is (data, today) -> value, so the whole reading experience is
// unit-testable without a DOM.

import type { Task } from "../shared";
import { daysBetweenYmd } from "../habits";
import { fmtEtaShort } from "./dates";

export type Bucket = "overdue" | "today" | "week" | "later" | "undated";

/** Top-to-bottom order of the groups on screen. */
export const BUCKET_ORDER: readonly Bucket[] = ["overdue", "today", "week", "later", "undated"];

export const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  later: "Later",
  undated: "No date",
};

/** Urgency is encoded ONCE, on the group header. Rows stay neutral — that is
 *  the entire point of the redesign: when every row is red, none of them is. */
export const BUCKET_TONE: Record<Bucket, "over" | "soon" | "calm"> = {
  overdue: "over",
  today: "soon",
  week: "calm",
  later: "calm",
  undated: "calm",
};

/** Which group a task belongs to. BUCKET_WEEK_IS_SEVEN_DAYS: "This week" is
 *  1..7 days out INCLUSIVE; day 8 is already "Later". */
export function bucketOf(eta: string | null, todayYmd: string): Bucket {
  if (!eta) return "undated";
  const d = daysBetweenYmd(todayYmd, eta);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d <= 7) return "week";
  return "later";
}

/** The single line of meta a row shows to the right of its title. Overdue rows
 *  earn a lateness count because that is genuinely new information; everything
 *  else just states its date. No bar, no shouting. */
export function metaLabel(eta: string | null, todayYmd: string): string {
  if (!eta) return "no date";
  const d = daysBetweenYmd(todayYmd, eta);
  if (d < 0) return `${fmtEtaShort(eta)} · ${-d}d late`;
  if (d === 0) return "today";
  return fmtEtaShort(eta);
}

export interface BucketGroup {
  bucket: Bucket;
  label: string;
  tone: "over" | "soon" | "calm";
  tasks: Task[];
}

/** Group OPEN tasks for one owner. Groups follow BUCKET_ORDER; empty groups are
 *  dropped (an empty header is noise). Inside a group, manual drag order wins
 *  (sortOrder asc), with id as a stable tiebreak. */
export function groupOpen(tasks: Task[], todayYmd: string): BucketGroup[] {
  const byBucket = new Map<Bucket, Task[]>();
  for (const t of tasks) {
    if (t.status !== "open") continue;
    const b = bucketOf(t.eta, todayYmd);
    const list = byBucket.get(b);
    if (list) list.push(t);
    else byBucket.set(b, [t]);
  }
  const out: BucketGroup[] = [];
  for (const bucket of BUCKET_ORDER) {
    const list = byBucket.get(bucket);
    if (!list || list.length === 0) continue;
    list.sort((a, b) => (a.sortOrder - b.sortOrder) || (a.id - b.id));
    out.push({ bucket, label: BUCKET_LABEL[bucket], tone: BUCKET_TONE[bucket], tasks: list });
  }
  return out;
}

/** The full open-lane order after a drag inside one group. The reorder API takes
 *  one flat array for the whole (owner, 'open') lane, so a within-group move has
 *  to be re-flattened against the other groups in BUCKET_ORDER. */
export function flattenOrder(groups: BucketGroup[]): number[] {
  return groups.flatMap((g) => g.tasks.map((t) => t.id));
}
```

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Delete `etaUrgency`

In `src/client/dates.ts`, delete the `Urgency` type and the `etaUrgency` function (the block quoted in Current state). Leave everything else in the file untouched — `daysLeft`, `fmtEta` and `fmtEtaShort` are all still used.

**Verify**: `grep -c "etaUrgency" src/client/dates.ts src/client/TaskCard.tsx` → `0` for both files.
**Verify**: `npm run typecheck` → exit 0.

### Step 3: The dense task row

Rewrite `src/client/TaskCard.tsx`. Keep the whole `editing` branch, `startEdit`, `save`, `onEditKey`, and the imports it needs, **byte-identical**. Replace only the read view and delete the `Deadline` function.

The component's props gain `todayYmd: string`. The read branch becomes:

```tsx
          <>
            <div className="row-line">
              <button
                className="row-title"
                onClick={open ? startEdit : undefined}
                disabled={!open}
                title={task.title}
              >
                {task.title}
              </button>
              <span className="row-meta">{metaLabel(task.eta, todayYmd)}</span>
            </div>
            {repeat && (
              <div className="repeat-chip" title="generated from a repeat">
                <span className="ic">↻</span>{repeat}
              </div>
            )}
          </>
```

and the wrapper `div` becomes:

```tsx
    <div className={`card row ${task.status === "done" ? "done" : ""} ${editing ? "editing" : ""}`}>
```

Notes that are requirements, not suggestions:

- Import `metaLabel` from `./grouping`. Remove the now-unused `daysLeft`, `etaUrgency`, `fmtEta` imports; keep `tomorrowIST`.
- The `+ Add deadline` affordance moves **into the edit panel only**. In the read view an undated task simply reads `no date` in `.row-meta`; tapping the title opens the editor, which already contains `<DatePick>`. Delete the `deadline` const and the `.add-deadline` read-view button. Leave the `.add-deadline` CSS rule in place — the edit panel does not use it, but removing a rule nothing references is churn; deleting it is also acceptable, do not spend time on the choice.
- The row keeps its drag handle, round `.check`, `.edit` and `.del` buttons exactly as today.

**Verify**: `npm run typecheck` → exit 0.
**Verify**: `grep -c "function Deadline" src/client/TaskCard.tsx` → `0`.
**Verify**: `grep -c 'className={\`bar' src/client/TaskCard.tsx` → `0`.

### Step 4: Grouped task list

Rewrite the body of `src/client/TaskList.tsx`. `Props` gains `todayYmd: string`. Replace the flat list with one `DndContext` and one `SortableContext` **per group**:

```tsx
  const groups = useMemo(() => groupOpen(tasks, todayYmd), [tasks, todayYmd]);
  const openCount = groups.reduce((n, g) => n + g.tasks.length, 0);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const group = groups.find((g) => g.tasks.some((t) => t.id === Number(active.id)));
    if (!group) return;
    const from = group.tasks.findIndex((t) => t.id === Number(active.id));
    const to = group.tasks.findIndex((t) => t.id === Number(over.id));
    if (from < 0 || to < 0) return; // dropped outside its own group — ignore
    const moved = groups.map((g) =>
      g === group ? { ...g, tasks: arrayMove(g.tasks, from, to) } : g,
    );
    onReorder(owner, flattenOrder(moved));
  }
```

and the render:

```tsx
    <div>
      <QuickAdd owner={owner} onAdd={onAdd} />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        {groups.map((g) => (
          <section className="bucket" key={g.bucket} data-bucket={g.bucket}>
            <h2 className={`bucket-head ${g.tone}`}>
              {g.label}
              <span className="bucket-count">{g.tasks.length}</span>
            </h2>
            <SortableContext items={g.tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {g.tasks.map((t) => (
                <SortableRow key={t.id} task={t} repeat={cadenceOf(t)} todayYmd={todayYmd}
                  onToggleDone={onToggleDone} onSetEta={onSetEta} onSaveEdit={onSaveEdit} onDelete={onDelete} />
              ))}
            </SortableContext>
          </section>
        ))}
      </DndContext>
      {openCount === 0 && <p className="empty">Nothing open here — a clear slate.</p>}
```

The Done section below stays as it is, except each `<TaskCard>` also receives `todayYmd={todayYmd}`. `SortableRow` forwards the new prop.

**Verify**: `npm run typecheck` → exit 0.
**Verify**: `npm run build` → exit 0.

### Step 5: The Today strip

Create `apps/founders-tracker/src/client/HabitStrip.tsx`:

```tsx
import type { HabitToday } from "../shared";

interface Props {
  habits: HabitToday[];
  todayLabel: string;
  /** Fired on tick/untick; the parent calls the API and reloads. */
  onToggle: (h: HabitToday) => void;
  /** Template ids with a toggle in flight — their rows are disabled. */
  busy: ReadonlySet<number>;
}

/** The rhythm board: one line per active habit, both owners together, above the
 *  task list. A habit is never a task — this strip is the only place they live,
 *  and a missed day shows as a reset streak, not as an overdue item. */
export function HabitStrip({ habits, todayLabel, onToggle, busy }: Props) {
  if (habits.length === 0) return null;

  return (
    <section className="habit-strip" aria-label="Today's habits">
      <div className="habit-strip-head">
        <span className="kicker">Today</span>
        <span className="habit-date">{todayLabel}</span>
      </div>
      {habits.map((h) => (
        <div className={`habit-row ${h.keptNow ? "kept" : ""}`} key={h.templateId}>
          <input
            className="check"
            type="checkbox"
            checked={h.keptNow}
            disabled={busy.has(h.templateId)}
            onChange={() => onToggle(h)}
            aria-label={h.keptNow ? `un-tick ${h.title}` : `tick ${h.title}`}
          />
          <span className="habit-title" title={h.title}>{h.title}</span>
          <span className="habit-who">{h.owner[0].toUpperCase()}</span>
          <span className={`streak ${h.streak > 0 ? "live" : "cold"}`}>
            {h.streak > 0 ? `${h.streak}${h.cadence === "weekly" ? "w" : "d"}` : "—"}
          </span>
          <span className="habit-best">best {h.best}</span>
        </div>
      ))}
    </section>
  );
}
```

**Verify**: `npm run typecheck` → exit 0.

### Step 6: API client

In `src/client/api.ts`:

```ts
export interface BootstrapData {
  tasks: Task[];
  templates: Template[];
  habits: HabitToday[];
  scoreboard: Scoreboard;
}
```

(add `HabitToday` to the type import) and inside the `api` object:

```ts
  toggleHabit: (templateId: number) =>
    req<HabitToday>("POST", `/habits/${templateId}/toggle`),
```

**Verify**: `npm run typecheck` → exit 0.

### Step 7: Wire it in `App.tsx`

Three additions:

1. Compute today once, at the top of the component, and pass it down:
   ```ts
   const todayYmd = todayIST();
   const todayLabel = new Date(`${todayYmd}T12:00:00Z`).toLocaleDateString("en-GB", {
     timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short",
   });
   ```
   (import `todayIST` from `./dates`.)

2. Habit toggling with an in-flight guard, so a double tap cannot double-toggle:
   ```ts
   const [habitBusy, setHabitBusy] = useState<Set<number>>(new Set());

   async function toggleHabit(h: HabitToday) {
     if (habitBusy.has(h.templateId)) return;
     setHabitBusy((s) => new Set(s).add(h.templateId));
     try {
       await api.toggleHabit(h.templateId);
       await reload();
     } catch (e) {
       alert(String(e));
     } finally {
       setHabitBusy((s) => {
         const next = new Set(s);
         next.delete(h.templateId);
         return next;
       });
     }
   }
   ```

3. Inside the tracker branch, render the strip **above** the `.ownerbar`, and pass `todayYmd` to `TaskList`:
   ```tsx
        <>
          <HabitStrip habits={data.habits} todayLabel={todayLabel}
            onToggle={toggleHabit} busy={habitBusy} />
          <div className="ownerbar">
            …unchanged…
          </div>
          <TaskList owner={tab} tasks={ownTasks} templates={data.templates} todayYmd={todayYmd}
            onReorder={reorder} onAdd={addTask} onToggleDone={toggleDone} onSetEta={setEta}
            onSaveEdit={saveEdit} onDelete={del} />
        </>
   ```

`data.habits` may be `undefined` if the client is served against an older Worker; guard with `data.habits ?? []` at the call site so a stale deploy renders an empty strip rather than crashing. (Degraded state, enumerated: **no habits / missing field → the strip does not render at all**, `HabitStrip` returns `null`, and the task list is unaffected.)

**Verify**: `npm run typecheck` → exit 0.
**Verify**: `npm run build` → exit 0.

### Step 8: Label habits vs tasks on the Repeats screen

In `src/client/RecurringScreen.tsx`, replace the `.meta` block (lines 42–46) with:

```tsx
            <div className="meta">
              <span className={`cadence-chip ${t.cadence === "monthly" ? "" : "habit"}`}>
                {t.cadence === "monthly" ? "monthly task" : `${t.cadence} habit`}
              </span>
              {!t.active && <span className="paused-chip">paused</span>}
              <span>{t.owner[0].toUpperCase() + t.owner.slice(1)} · {dueLabel(t)}</span>
            </div>
```

and change `dueLabel`'s monthly branch to return `` `due the ${n}${suff}` `` so the sentence still reads correctly without the removed literal `due `. Keep the daily/weekly branches returning `"every day"` / `` `every ${DOW[...]}` ``.

Also change the kicker on line 30 from `Auto-generated tasks` to `Habits & repeats`, and the empty-state text on line 36 to `No habits or repeats yet — add one to start a streak.`

**Verify**: `npm run typecheck` → exit 0.
**Verify**: `grep -c "monthly task" src/client/RecurringScreen.tsx` → `1`.

### Step 9: CSS

In `src/client/index.css`:

**(a) Delete** the `.bar*` and `.days*` rules quoted in Current state.

**(b) Append** this block at the end of the file:

```css
/* ---- Today strip (habits) ------------------------------------------------ */
.habit-strip {
  background: var(--paper-2); border: 1px solid var(--line);
  border-radius: 14px; padding: 11px 13px 8px; margin-bottom: 16px;
}
.habit-strip-head {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 8px;
}
.habit-strip-head .kicker {
  font-size: 10px; letter-spacing: .24em; text-transform: uppercase;
  color: var(--muted); font-weight: 700;
}
.habit-date {
  font-family: "Fraunces", Georgia, serif; font-size: 12.5px; font-style: italic;
  color: var(--muted);
}
.habit-row {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 2px; border-top: 1px solid var(--line);
}
.habit-row:first-of-type { border-top: 0; }
.habit-row .check { width: 19px; height: 19px; margin-top: 0; }
.habit-title {
  flex: 1; min-width: 0; font-size: 14px; font-weight: 600; color: var(--ink);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.habit-row.kept .habit-title { color: var(--muted); }
.habit-who {
  flex: none; font-size: 10px; font-weight: 700; letter-spacing: .06em;
  color: var(--muted); background: var(--surface); border: 1px solid var(--line);
  width: 19px; height: 19px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
}
.streak {
  flex: none; font-size: 11.5px; font-weight: 700; letter-spacing: .02em;
  font-variant-numeric: tabular-nums; padding: 2px 9px; border-radius: 999px;
  min-width: 40px; text-align: center;
}
.streak.live { color: var(--safe); background: rgba(63,125,87,.11); }
.streak.cold { color: var(--faint); background: var(--surface); }
.habit-best {
  flex: none; font-size: 10.5px; font-weight: 600; color: var(--faint);
  font-variant-numeric: tabular-nums; min-width: 48px; text-align: right;
}

/* ---- Grouped tracker ---------------------------------------------------- */
.bucket { margin-bottom: 18px; }
.bucket-head {
  display: flex; align-items: center; gap: 8px; margin: 0 0 8px 2px;
  font-family: inherit; font-size: 10.5px; font-weight: 700;
  letter-spacing: .13em; text-transform: uppercase; color: var(--muted);
}
.bucket-head.over { color: var(--over); }
.bucket-head.soon { color: var(--soon); }
.bucket-count {
  font-size: 10px; font-weight: 700; letter-spacing: 0;
  font-variant-numeric: tabular-nums; padding: 1px 7px; border-radius: 999px;
  background: var(--paper-2); color: var(--muted);
}
.bucket-head.over .bucket-count { background: rgba(178,58,46,.11); color: var(--over); }
.bucket-head.soon .bucket-count { background: rgba(189,132,32,.13); color: var(--soon); }

/* Dense single-line row. Overrides the tall .card geometry; .card.editing
   still wins for the expanded editor because it comes later in the file. */
.card.row {
  padding: 9px 10px 9px 8px; margin-bottom: 6px; border-radius: 11px;
  gap: 9px; align-items: center;
}
.card.row .handle { padding: 0; font-size: 14px; }
.card.row .check { width: 19px; height: 19px; margin-top: 0; }
.row-line { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.row-title {
  appearance: none; border: 0; background: transparent; padding: 0;
  font-family: inherit; font-size: 14.5px; font-weight: 600; color: var(--ink);
  letter-spacing: -.005em; text-align: left; cursor: text;
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.row-title:disabled { cursor: default; }
.card.row.done .row-title {
  text-decoration: line-through; text-decoration-color: var(--faint); color: var(--muted);
}
.row-meta {
  flex: none; font-size: 11px; font-weight: 600; color: var(--muted);
  font-variant-numeric: tabular-nums; white-space: nowrap;
}
.card.row .repeat-chip { margin: 4px 0 0; }

/* The editor still needs room to breathe when a dense row expands. */
.card.row.editing { align-items: stretch; padding: 13px 13px 13px 11px; }
.card.row.editing .row-line { display: none; }

/* ---- Habit vs task chip on the Repeats screen -------------------------- */
.cadence-chip.habit { color: var(--safe); background: rgba(63,125,87,.1); }
```

**(c)** In the existing `.card .title` rules, nothing changes — they now only apply to `.rec-card` on the Repeats screen, which is correct.

**Verify**: `npm run build` → exit 0.
**Verify**: `grep -c "^\.bar" src/client/index.css` → `0`.
**Verify**: `grep -c "habit-strip" src/client/index.css` → ≥ `2`.

### Step 10: Unit tests

Create `apps/founders-tracker/test/grouping.test.ts` — single quotes, no semicolons.

```ts
import { describe, it, expect } from 'vitest'
import {
  BUCKET_LABEL, BUCKET_ORDER, BUCKET_TONE, bucketOf, flattenOrder, groupOpen, metaLabel,
} from '../src/client/grouping'
import type { Task } from '../src/shared'

const TODAY = '2026-08-23'

const task = (over: Partial<Task>): Task => ({
  id: 1, title: 't', owner: 'khushi', eta: null, notes: null, status: 'open',
  sortOrder: 0, templateId: null, periodKey: null,
  createdAt: '2026-08-01T00:00:00.000Z', completedAt: null, ...over,
})

describe('bucketOf', () => {
  it('puts a past date in overdue', () => {
    expect(bucketOf('2026-07-14', TODAY)).toBe('overdue')
    expect(bucketOf('2026-08-22', TODAY)).toBe('overdue')
  })

  it('puts today in today', () => {
    expect(bucketOf(TODAY, TODAY)).toBe('today')
  })

  it('puts 1..7 days out in this week', () => {
    // BUCKET_WEEK_IS_SEVEN_DAYS — the boundary is inclusive at 7. Both assertions
    // carry the marker on purpose: vitest aborts a test at its FIRST failure, so a
    // marker only on the second one would never reach the mutation gate's output.
    expect(bucketOf('2026-08-24', TODAY), 'BUCKET_WEEK_IS_SEVEN_DAYS: day 1 is This week').toBe('week')
    expect(bucketOf('2026-08-30', TODAY), 'BUCKET_WEEK_IS_SEVEN_DAYS: day 7 is still This week').toBe('week')
  })

  it('puts day 8 and beyond in later', () => {
    expect(bucketOf('2026-08-31', TODAY), 'BUCKET_WEEK_IS_SEVEN_DAYS: day 8 has left This week').toBe('later')
    expect(bucketOf('2026-12-01', TODAY)).toBe('later')
  })

  it('puts a null eta in undated', () => {
    expect(bucketOf(null, TODAY)).toBe('undated')
  })
})

describe('metaLabel', () => {
  it('counts lateness for an overdue task', () => {
    expect(metaLabel('2026-07-14', TODAY)).toBe('14 Jul · 40d late')
  })

  it('says today for a task due today', () => {
    expect(metaLabel(TODAY, TODAY)).toBe('today')
  })

  it('states the bare date for a future task', () => {
    expect(metaLabel('2026-08-30', TODAY)).toBe('30 Aug')
  })

  it('says no date when there is none', () => {
    expect(metaLabel(null, TODAY)).toBe('no date')
  })
})

describe('tone', () => {
  it('colours only overdue and today', () => {
    expect(BUCKET_TONE.overdue).toBe('over')
    expect(BUCKET_TONE.today).toBe('soon')
    expect(BUCKET_TONE.week).toBe('calm')
    expect(BUCKET_TONE.later).toBe('calm')
    expect(BUCKET_TONE.undated).toBe('calm')
  })

  it('orders and labels the groups', () => {
    expect([...BUCKET_ORDER]).toEqual(['overdue', 'today', 'week', 'later', 'undated'])
    expect(BUCKET_LABEL.week).toBe('This week')
  })
})

describe('groupOpen', () => {
  it('drops empty groups and keeps BUCKET_ORDER', () => {
    const groups = groupOpen([
      task({ id: 1, eta: '2026-12-01' }),
      task({ id: 2, eta: '2026-07-14' }),
    ], TODAY)
    expect(groups.map((g) => g.bucket)).toEqual(['overdue', 'later'])
    expect(groups[0].tasks.map((t) => t.id)).toEqual([2])
  })

  it('ignores done tasks', () => {
    const groups = groupOpen([
      task({ id: 1, eta: '2026-07-14', status: 'done' }),
      task({ id: 2, eta: '2026-07-14' }),
    ], TODAY)
    expect(groups).toHaveLength(1)
    expect(groups[0].tasks.map((t) => t.id)).toEqual([2])
  })

  it('sorts inside a group by sortOrder then id', () => {
    const groups = groupOpen([
      task({ id: 7, eta: '2026-07-14', sortOrder: 5 }),
      task({ id: 3, eta: '2026-07-15', sortOrder: 5 }),
      task({ id: 9, eta: '2026-07-16', sortOrder: 1 }),
    ], TODAY)
    expect(groups[0].tasks.map((t) => t.id)).toEqual([9, 3, 7])
  })

  it('returns nothing for an empty list', () => {
    expect(groupOpen([], TODAY)).toEqual([])
  })
})

describe('flattenOrder', () => {
  it('flattens every group in order into one id list', () => {
    const groups = groupOpen([
      task({ id: 1, eta: '2026-07-14' }),
      task({ id: 2, eta: TODAY }),
      task({ id: 3, eta: null }),
    ], TODAY)
    expect(flattenOrder(groups)).toEqual([1, 2, 3])
  })
})
```

**Verify**: `npm test` → exit 0, summary reports **at least 36 passing tests** across 3 files.
**Verify**: `test -f test/grouping.test.ts && echo present` → `present`.

### Step 11: The Playwright behaviour + screenshot gate

Add to `package.json` `scripts`: `"shot": "node scripts/shot.mjs"`. Add `"@playwright/test": "^1.61.1"` to `devDependencies` (via `npm install -D @playwright/test@^1.61.1`, which writes it for you).

Create `apps/founders-tracker/scripts/shot.mjs`:

```js
#!/usr/bin/env node
// The ui:true merge gate AND the behaviour gate for Plan 237.
//
// Seeds the LOCAL D1 with a deterministic fixture (one task per bucket, two
// daily habits, a 6-day streak ending yesterday), starts the vite dev server
// — which the @cloudflare/vite-plugin backs with the real Worker + local D1 —
// logs in through the PIN gate, then asserts the redesign's actual behaviour
// before writing the screenshots.
//
// Every write stays inside this app directory. Teardown is guaranteed in
// `finally` so a failed assertion never leaves the dev server running.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP_ROOT = join(HERE, '..')
const WEB_PORT = 4174
const PIN = '424242'
const SECRET = 'shot-secret-0123456789-0123456789'

/** A leased worktree has no .dev.vars (it is gitignored), which is exactly how
 *  this gate used to fail: the PIN gate could not be passed and every shot came
 *  back blank. Write a local-only one when it is absent. */
function ensureDevVars() {
  const p = join(APP_ROOT, '.dev.vars')
  if (existsSync(p)) return
  writeFileSync(p, `APP_PIN=${PIN}\nSESSION_SECRET=${SECRET}\n`)
  console.log('shot: wrote a local .dev.vars (was absent)')
}

function readPin() {
  // Respect an existing .dev.vars so a developer's own PIN keeps working.
  const p = join(APP_ROOT, '.dev.vars')
  const txt = existsSync(p) ? String(spawnSync('cat', [p]).stdout) : ''
  const m = txt.match(/^APP_PIN=(.*)$/m)
  return m ? m[1].trim() : PIN
}

function d1(sql) {
  const r = spawnSync('npx', ['wrangler', 'd1', 'execute', 'founders-db', '--local', '--command', sql], {
    cwd: APP_ROOT, stdio: ['ignore', 'pipe', 'inherit'],
  })
  if (r.status !== 0) throw new Error(`d1 failed: ${sql.slice(0, 80)}`)
}

function ymd(offsetDays) {
  const t = new Date()
  t.setUTCHours(12, 0, 0, 0)
  t.setUTCDate(t.getUTCDate() + offsetDays)
  return t.toISOString().slice(0, 10)
}

function seed() {
  console.log('shot: applying schema…')
  const schema = spawnSync('npm', ['run', 'db:local'], { cwd: APP_ROOT, stdio: 'inherit' })
  if (schema.status !== 0) throw new Error('db:local failed')

  console.log('shot: seeding fixture…')
  d1('DELETE FROM habit_logs')
  d1('DELETE FROM tasks')
  d1('DELETE FROM recurring_templates')

  const now = new Date().toISOString()
  d1(`INSERT INTO recurring_templates (id, title, owner, notes, cadence, due_day, active, created_at) VALUES
      (1, 'Knowledge gain', 'khushi', NULL, 'daily', 1, 1, '${now}'),
      (2, 'Video editing skill improvement', 'khushi', NULL, 'daily', 1, 1, '${now}'),
      (3, 'Revenue and cost sheet', 'khushi', NULL, 'monthly', 1, 1, '${now}')`)

  // Template 1: kept the six days ending YESTERDAY, today still open -> the
  // grace rule means the strip shows 6 and a tick must take it to 7.
  const days = [6, 5, 4, 3, 2, 1].map((n) => `(1, '${ymd(-n)}', '${now}')`).join(',')
  d1(`INSERT INTO habit_logs (template_id, anchor_ymd, done_at) VALUES ${days}`)

  const rows = [
    ['Video Editor - hiring closure and work started', 'khushi', ymd(-40), 1],
    ['3 tools money pending payment - action plan', 'khushi', ymd(-37), 2],
    ['Ship the founders ledger redesign', 'khushi', ymd(0), 3],
    ['Recordly - used by tutorial makers', 'khushi', ymd(3), 4],
    ['Quarterly hiring plan', 'khushi', ymd(20), 5],
    ['Revenue/pricing automation', 'kushal', ymd(-5), 6],
  ]
  const values = rows
    .map(([t, o, e, s]) => `('${t}', '${o}', '${e}', 'open', ${s}, '${now}')`)
    .join(',')
  d1(`INSERT INTO tasks (title, owner, eta, status, sort_order, created_at) VALUES ${values}`)
  // One undated task, and one done task so the Done section renders.
  d1(`INSERT INTO tasks (title, owner, eta, status, sort_order, created_at) VALUES
      ('Decide the pricing tiers', 'khushi', NULL, 'open', 9999999, '${now}')`)
  d1(`INSERT INTO tasks (title, owner, eta, status, sort_order, created_at, completed_at) VALUES
      ('Set up the shared inbox', 'khushi', '${ymd(-9)}', 'done', 1, '${now}', '${now}')`)
}

function waitForPort(port, path = '/') {
  const deadline = Date.now() + 60_000
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      fetch(`http://localhost:${port}${path}`)
        .then(() => resolve())
        .catch((err) => {
          if (Date.now() > deadline) return reject(err)
          setTimeout(tryOnce, 400)
        })
    }
    tryOnce()
  })
}

async function main() {
  mkdirSync(join(APP_ROOT, 'docs', 'shots'), { recursive: true })
  ensureDevVars()
  seed()

  const dev = spawn('npx', ['vite'], {
    cwd: APP_ROOT, stdio: 'inherit',
    env: { ...process.env, WEB_PORT: String(WEB_PORT) },
  })

  let browser
  try {
    await waitForPort(WEB_PORT, '/login')

    browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 900, height: 1500 } })

    // ---- PIN gate
    await page.goto(`http://localhost:${WEB_PORT}/login`)
    await page.fill('input[name="pin"]', readPin())
    await page.click('button[type="submit"]')
    await page.waitForSelector('.habit-strip', { timeout: 20_000 })

    // ---- Behaviour: the Today strip lists both active habits, not the monthly one
    const habitRows = page.locator('.habit-strip .habit-row')
    const habitCount = await habitRows.count()
    if (habitCount !== 2) throw new Error(`expected 2 habit rows, got ${habitCount}`)

    // ---- Behaviour: groups render in BUCKET_ORDER, empty ones dropped
    const heads = await page.locator('.bucket-head').allTextContents()
    const labels = heads.map((h) => h.replace(/\s*\d+\s*$/, '').trim())
    const expected = ['Overdue', 'Today', 'This week', 'Later', 'No date']
    if (JSON.stringify(labels) !== JSON.stringify(expected)) {
      throw new Error(`bucket order wrong: ${JSON.stringify(labels)}`)
    }
    const overdueCount = await page.locator('[data-bucket="overdue"] .card.row').count()
    if (overdueCount !== 2) throw new Error(`expected 2 overdue rows, got ${overdueCount}`)

    // ---- Behaviour: the old progress bar is gone for good
    const bars = await page.locator('.card.row .bar').count()
    if (bars !== 0) throw new Error(`the deadline progress bar is still rendering (${bars} found)`)

    await page.screenshot({ path: join(APP_ROOT, 'docs', 'shots', 'tracker.png'), fullPage: true })
    console.log('shot: wrote docs/shots/tracker.png')

    // ---- Behaviour: ticking a habit advances the streak and creates NO task
    const before = await page.locator('.card.row').count()
    const first = habitRows.first()
    const streakBefore = (await first.locator('.streak').textContent())?.trim()
    if (streakBefore !== '6d') throw new Error(`expected a 6d streak before the tick, got ${streakBefore}`)

    await first.locator('.check').click()
    await page.waitForFunction(
      () => document.querySelector('.habit-strip .habit-row .streak')?.textContent?.trim() === '7d',
      undefined, { timeout: 20_000 },
    )
    const kept = await page.locator('.habit-strip .habit-row').first().getAttribute('class')
    if (!kept?.includes('kept')) throw new Error('the ticked habit row did not get the .kept class')

    const after = await page.locator('.card.row').count()
    if (after !== before) {
      throw new Error(`ticking a habit changed the task count ${before} -> ${after}; habits must never create tasks`)
    }

    await page.screenshot({ path: join(APP_ROOT, 'docs', 'shots', 'habit-ticked.png'), fullPage: true })
    console.log('shot: wrote docs/shots/habit-ticked.png')
  } finally {
    if (browser) await browser.close()
    dev.kill('SIGTERM')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

**Verify**: `npx playwright install chromium` → exit 0.
**Verify**: `npm run shot` → exit 0, and both `docs/shots/tracker.png` and `docs/shots/habit-ticked.png` exist and are non-empty.
**Verify**: open `docs/shots/tracker.png` and **look at it**. It must show: the Today strip with two habit lines and a `6d` streak chip; the owner tabs; the quick-add box; and five uppercase group headers in the order Overdue / Today / This week / Later / No date, with only the Overdue and Today headers coloured. If any of that is missing or a control renders with browser-default styling (white-on-blue buttons, an unstyled select), fix the CSS before continuing — a green script with an ugly screenshot is a failed gate here.

### Step 12: Prove the mutation gate fires

From the repo root:

```bash
cd apps/founders-tracker && npm test                       # must PASS
cd /Users/kbtg/codebase/personal-stuff
perl -0pi -e 's/if \(d <= 7\) return "week";/if (d <= 7) return "later";/' apps/founders-tracker/src/client/grouping.ts
cd apps/founders-tracker && npm test                       # must FAIL, printing BUCKET_WEEK_IS_SEVEN_DAYS
cd /Users/kbtg/codebase/personal-stuff && git checkout -- apps/founders-tracker/src/client/grouping.ts
cd apps/founders-tracker && npm test                       # must PASS again
```

**Verify**: the middle run exits non-zero and its output contains `BUCKET_WEEK_IS_SEVEN_DAYS`.

If the mutated run passes, the gate is inert: STOP and report. Do not loosen the test.

### Step 13: Docs and landing

In `apps/founders-tracker/README.md`, replace the `## Surfaces` section with:

```markdown
## Surfaces

- **Tracker** — the Today habit strip (tick a habit, see the streak), Khushi/Kushal
  tabs, quick-add, then open tasks grouped **Overdue / Today / This week / Later /
  No date** as dense single-line rows. Urgency is coloured once, on the group
  header — never per row. Drag reorders inside a group.
- **Repeats** — CRUD for habits (`daily`/`weekly`, ticked and streaked) and monthly
  task templates (which generate a real task per month).
- **Login** — shared-PIN page.

### The ui: gate

`npm run shot` seeds the local D1 with a deterministic fixture, drives the app
with Playwright, asserts the group order, the streak increment and that ticking a
habit creates no task, then writes `docs/shots/tracker.png` and
`docs/shots/habit-ticked.png`. It writes a local `.dev.vars` if none exists, so it
works in a fresh worktree.
```

Then:

1. `git add` every in-scope file **including both screenshots and this plan file**.
2. Flip this plan's row in `plans/README.md` to `DONE`.
3. Commit. Do not push.

**Verify**: `git status --short` → nothing untracked under `apps/founders-tracker/` or `plans/`.
**Verify**: `git ls-files apps/founders-tracker/docs/shots/ | wc -l` → `2`.

## Test plan

| What | Where | Following |
|---|---|---|
| `bucketOf` at every boundary, including day 7 vs day 8 | `test/grouping.test.ts` | `test/auth.test.ts` style |
| `metaLabel` for overdue / today / future / undated | `test/grouping.test.ts` | same |
| `BUCKET_TONE` — only overdue and today are coloured | `test/grouping.test.ts` | same |
| `groupOpen` — order, empty-group dropping, done-filtering, intra-group sort | `test/grouping.test.ts` | same |
| `flattenOrder` round-trip | `test/grouping.test.ts` | same |
| **Behaviour**: 2 habit rows render, group headers in order, 2 overdue rows, zero `.bar` elements | `scripts/shot.mjs` | `apps/yt-script-desk/scripts/shot.mjs` |
| **Behaviour**: ticking a habit moves the streak 6d → 7d, marks the row `.kept`, and leaves the task count unchanged | `scripts/shot.mjs` | same |
| Visual: two committed screenshots, inspected by eye | `docs/shots/` | `apps/yt-script-desk/docs/shots/` |

Rendering is not unit-tested with jsdom on purpose: this app has no jsdom/testing-library setup, and adding one buys less than the Playwright pass, which exercises the real Worker, the real D1 and the real toggle round-trip.

## Done criteria

- [ ] `cd apps/founders-tracker && npm run typecheck` → exit 0
- [ ] `cd apps/founders-tracker && npm test` → exit 0, summary reports ≥ 36 passing tests
- [ ] `test -f apps/founders-tracker/test/grouping.test.ts` → exit 0
- [ ] `test -f apps/founders-tracker/src/client/grouping.ts` → exit 0
- [ ] `test -f apps/founders-tracker/src/client/HabitStrip.tsx` → exit 0
- [ ] `cd apps/founders-tracker && npm run build` → exit 0
- [ ] `cd apps/founders-tracker && npm run shot` → exit 0
- [ ] `apps/founders-tracker/docs/shots/tracker.png` and `habit-ticked.png` exist, are non-empty, and are tracked by git
- [ ] `grep -c "function Deadline" apps/founders-tracker/src/client/TaskCard.tsx` → `0`
- [ ] `grep -c "etaUrgency" apps/founders-tracker/src/client/dates.ts` → `0`
- [ ] `grep -c "^\.bar" apps/founders-tracker/src/client/index.css` → `0`
- [ ] The mutation recipe in Step 12 fails on the mutated tree printing `BUCKET_WEEK_IS_SEVEN_DAYS`, and passes again after revert
- [ ] `git diff --name-only` for this branch contains no path under `apps/founders-tracker/src/worker/`
- [ ] `git status --short` is clean for `apps/founders-tracker/` and `plans/`
- [ ] **Fresh-checkout gate** (this is the last plan of the batch, so build-order and
      gitignored-artifact dependencies must be proven on a pristine tree):
      ```bash
      cd /Users/kbtg/codebase/personal-stuff
      git clone --branch advisor/237-founders-today-strip-and-dense-tracker \
        --single-branch . /tmp/ft-fresh
      cd /tmp/ft-fresh/apps/founders-tracker
      npm install && npx playwright install chromium
      npm run typecheck && npm test && npm run shot
      ```
      → exit 0. This is the run that proves `scripts/shot.mjs` really does create its
      own `.dev.vars` and seed its own D1, rather than depending on state your working
      copy happened to have. Report the exit code; delete `/tmp/ft-fresh` afterwards.

## STOP conditions

- **Plan 236's work is absent** (`src/habits.ts` missing, `bootstrap` has no `habits`, no `/api/habits/:id/toggle`). This plan builds on it. Stop and report — do not implement 236's half here.
- **Ticking a habit changes the task count.** The shot script asserts this. If it fires, something in the worker is minting a task from a habit; that is 236's contract broken. Stop and report.
- **A `.bar` progress element still renders inside a task row.** The shot script asserts zero. Stop rather than deleting the assertion.
- **The mutated tree in Step 12 still passes `npm test`.** The gate is inert. Stop and report.
- **Gate integrity**: if any assertion fails, fix the code or the fixture. Weakening, swapping, skipping, or deleting an assertion is a STOP.
- **The PIN gate loops** (Playwright never reaches `.habit-strip` and keeps landing back on `/login`). The session cookie is set with `secure: true`; Chromium accepts Secure cookies on `http://localhost`, so a loop means something else — most likely `.dev.vars` was not read. Report what `ensureDevVars` did; do **not** change `src/worker/auth.ts` (out of scope, and the token shape is frozen).
- **`npm run shot` hangs with no output for more than 3 minutes.** Kill it and report. A dev server that never binds, or a `waitForSelector` on a selector you renamed, both look like this. Do not raise timeouts to paper over it.
- **You need to touch a file under `src/worker/` or `src/habits.ts`.** Out of scope; it means this plan mis-specified the contract. Stop and report what you needed.
- **A dependency change beyond adding `@playwright/test` looks necessary** — especially `wrangler` or `@cloudflare/vite-plugin`, which are exact-pinned as a matched pair. Stop and report.
- **Any `--remote` D1 command or `npm run deploy` looks necessary.** It is not. Stop and report.
- **`grep -c "src/habits.ts" tsconfig.app.json` returns `0`.** Plan 236 did not add it and
  `tsc -b` cannot see the module. Stop and report — do not edit the tsconfig here.
- **The fresh-checkout gate fails while your working copy passes.** That is the real
  result: something depends on local state. Report the failing command and its output.
- **Self-fix cap: 5 attempts per step.** If the Done criteria are still failing after 5, write `BLOCKED: done criteria unreachable after 5 attempts` with the last failing output and stop.

## Maintenance notes

- **Owner follow-up after this merges**: `cd apps/founders-tracker && npm run deploy`. Plan 236's schema + migration must already be applied to the remote D1, or the bootstrap route will 500 on a missing `habit_logs`.
- `scripts/shot.mjs` writes a local `.dev.vars` when absent. That is deliberate — the known failure mode for e2e in this repo is a leased worktree without it, which produced blank screenshots and "gate unprovable" reports. The file is gitignored; it must never be committed.
- The shot fixture pins a **6-day** streak ending yesterday specifically so the grace rule in `currentStreak` is exercised: an unticked today shows 6, and the tick makes it 7. If someone changes the fixture to include today, that assertion stops testing the grace rule and starts testing nothing.
- **What a reviewer should scrutinise**: (1) that `.card.row.editing` still gives the inline editor room — a dense row that stays 38 px tall while expanded makes editing unusable, and no unit test can see it, so check `habit-ticked.png` or open the app; (2) that drag-and-drop still persists across a reload, since `flattenOrder` posts the whole lane and an off-by-one there silently reshuffles other groups; (3) that no per-row urgency colour crept back in — it is the exact thing this plan removes.
- Future work deliberately **not** in this plan: a habit history heatmap, a scoreboard surface, and per-owner filtering of the Today strip. Each is a separate plan.

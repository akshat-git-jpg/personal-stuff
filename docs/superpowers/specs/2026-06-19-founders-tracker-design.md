# Founders Tracker — Design Spec

**Date:** 2026-06-19
**Status:** Approved (pending written-spec review)

## Purpose

A shared action-item tracker for two founders (Khushi and Kushal). It surfaces
high-level pending items with a clearly visible deadline and a days-remaining
countdown, makes a *missing* deadline impossible to ignore, scores each person
on how punctually they close their items, and auto-generates recurring
(monthly/weekly) tasks without manual re-entry.

The emotional core: a task with no ETA must feel **daunting** — it earns nothing
toward your score and is rendered as a hazard card until you set a date.

## Scope

In scope:

- Two-tab shared tracker (Khushi / Kushal) with manual drag-ordering.
- Tasks with title, owner, optional ETA, notes, status, completion timestamp.
- Days-remaining countdown with color thresholds; hazard treatment for no-ETA.
- Per-person on-time scoreboard.
- Recurring task templates (monthly/weekly) managed fully from the UI, auto-
  materialized by a Cloudflare Cron Trigger.
- Shared-password gate.

Out of scope (YAGNI):

- Priority field (explicitly dropped).
- Per-user accounts / name selection — it is one shared view.
- Sub-tasks, comments, attachments, notifications.
- Cadences other than monthly/weekly.

## Stack & deployment

Same family as the repo's other apps (gym-app, tracker-app, analytics-app):

- **Frontend:** Vite + React 18 + TypeScript.
- **Backend:** Hono on a Cloudflare Worker.
- **Storage:** Cloudflare **D1** (SQLite).
- **Drag-and-drop:** `@dnd-kit` (already used by gym-app).
- **Auth:** shared-password gate. Hono renders the login page itself and sets an
  HMAC-signed cookie (pattern from kushal-tools). Password stored as a Worker
  secret.
- **Suggested URL:** `founders.agrolloo.com` (final name TBD by user — not
  blocking).
- **Timezone:** all date math in **Asia/Kolkata**, date-only (time ignored).

## App surfaces

1. **Tracker** — two-tab Khushi/Kushal view + scoreboard + task list + add form.
2. **Recurring** — list and full CRUD of repeat-job templates.
3. **Login** — shared-password gate.

## Data model (D1)

### `tasks`

```
tasks(
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  owner        TEXT NOT NULL,            -- 'khushi' | 'kushal'
  eta          TEXT,                     -- 'YYYY-MM-DD', nullable (no ETA)
  notes        TEXT,                     -- nullable
  status       TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'done'
  sort_order   INTEGER NOT NULL,         -- manual ordering within owner+status
  template_id  INTEGER,                  -- nullable FK -> recurring_templates.id
  period_key   TEXT,                     -- nullable, e.g. '2026-06' or '2026-W25'
  created_at   TEXT NOT NULL,            -- ISO timestamp
  completed_at TEXT                      -- ISO timestamp, set when marked done
)
```

- A manual task has `template_id` and `period_key` NULL.
- A generated task carries its source `template_id` and the `period_key` it was
  created for. `(template_id, period_key)` is unique — this is what makes the
  generator idempotent. Enforce with a unique index:
  `CREATE UNIQUE INDEX ux_tasks_template_period ON tasks(template_id, period_key)
  WHERE template_id IS NOT NULL;`

### `recurring_templates`

```
recurring_templates(
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  owner      TEXT NOT NULL,              -- 'khushi' | 'kushal'
  notes      TEXT,                       -- nullable
  cadence    TEXT NOT NULL,              -- 'monthly' | 'weekly'
  due_day    INTEGER NOT NULL,           -- monthly: 1-31 (clamped) ; weekly: 0-6 (Mon-Sun)
  active     INTEGER NOT NULL DEFAULT 1, -- 1 = active, 0 = paused
  created_at TEXT NOT NULL
)
```

The scoreboard is a **live query** over `tasks` — no separate table.

## Behavior

### Tracker tabs

- Two tabs, `KHUSHI` and `KUSHAL`, filtered by `owner`. Each tab header shows its
  open-task count.
- Within a tab, open tasks render in `sort_order`; the user drags cards to
  reorder, which persists `sort_order`. No-ETA cards are *not* auto-pinned (the
  hazard styling + global counter carry the weight).
- Done tasks collapse into a `▸ Done (N)` section at the bottom of the tab.

### Add task form

Single form (modal or inline): title, owner toggle (Khushi/Kushal), ETA
(optional date picker), notes. Creates a manual task (`status='open'`,
`sort_order` = end of that owner's open list).

### Deadline / countdown

For a task with an ETA, show the date plus a countdown: a progress bar and a bold
`N DAYS LEFT`. `days_left = eta - today` (date-only, Asia/Kolkata).

Color thresholds:

| days_left | treatment |
|-----------|-----------|
| `> 7`     | green |
| `3–7`     | amber |
| `0–2`     | red |
| `< 0`     | dark red, label **OVERDUE** |

### No-ETA hazard card

A task with `eta IS NULL` renders as a hazard card:

- Diagonal red/black striped border.
- Pulsing `⚠ NO DEADLINE SET` banner.
- Slightly desaturated card body.
- A bright `SET AN ETA` button (opens the date picker for that task).
- Copy reinforcing that nothing is tracked until an ETA is set.

A **global header counter** (`⚠ N tasks have NO ETA`) tallies no-ETA open tasks
across *both* owners, so the pressure is visible from either tab.

### Mark done

A checkbox sets `status='done'` and `completed_at = now`. The card moves to the
tab's Done section. Un-checking reopens it (clears `completed_at`).

### Scoreboard

Sits above the tabs. For each person, computed over their `status='done'` tasks:

- **Scored tasks** = done tasks that *had* an ETA at completion.
- **On time** = `completed_at` date `≤ eta`.
- **Late** = `completed_at` date `> eta`; record days late = `completed_date - eta`.
- **Headline = on-time %** = `on_time / scored * 100` (0 scored → show `—`).
- Also show: `✅ on time` count, `⏰ late` count, `avg Nd late` (mean over late
  tasks), `⚠ no-ETA` count (done tasks completed with no ETA — untracked, earns
  nothing).
- A "leading" marker on the higher on-time %.

### Recurring screen (UI-managed repeat jobs)

- **Lists every template**: title, owner, cadence, due-day (rendered human-
  readably, e.g. "the 10th" or "every Friday"), and an Active/Paused toggle.
- **CRUD from the UI**: "+ New repeat job" form (title, owner, cadence, due-day,
  notes), edit, pause/resume (`active` toggle), delete.
- Adding a repeat job is just an INSERT into `recurring_templates`; no Cloudflare
  changes are ever needed after the one-time cron setup.
- Pausing stops future generation but leaves already-generated tasks untouched.
- Deleting a template removes the template only; its already-generated tasks
  remain as normal tasks.

### Recurring generator

A single Cloudflare **Cron Trigger** runs daily at ~00:05 Asia/Kolkata. The same
logic also runs as a **catch-up on app load** (backstop if the cron misses).

Algorithm (idempotent):

```
for each template where active = 1:
    period_key = current period for the template's cadence
        monthly -> 'YYYY-MM' of today
        weekly  -> 'YYYY-Www' (ISO year + ISO week) of today
    if no task exists with (template_id = template.id, period_key = period_key):
        eta = resolve_due_day(template, period_key)
            monthly -> day = min(due_day, days_in_month); date in that month
            weekly  -> the date of weekday `due_day` within that ISO week
        insert task(
            title, owner, notes from template,
            eta, status='open',
            sort_order = end of owner's open list,
            template_id = template.id, period_key = period_key,
            created_at = now
        )
```

The unique index on `(template_id, period_key)` guarantees no duplicates even if
the cron and the on-load catch-up race.

## API (Hono routes, all behind the password cookie)

- `GET  /api/tasks` — all tasks (client splits by owner/status).
- `POST /api/tasks` — create manual task.
- `PATCH /api/tasks/:id` — update (eta, notes, title, status, owner).
- `PATCH /api/tasks/reorder` — persist new `sort_order` for a set of ids.
- `DELETE /api/tasks/:id` — delete task.
- `GET  /api/templates` — list recurring templates.
- `POST /api/templates` — create template.
- `PATCH /api/templates/:id` — update / pause / resume.
- `DELETE /api/templates/:id` — delete template.
- `GET  /api/scoreboard` — computed per-person stats (or derive client-side from
  `/api/tasks`; decide at implementation time — leaning server-side for one clean
  query).
- Auth: `POST /login` (form), signed cookie; middleware guards `/api/*` and the
  app shell.
- `scheduled` handler — runs the generator (shared with on-load catch-up).

## Components (frontend)

- `LoginGate` — password page (server-rendered) / client guard.
- `App` — tab state, data fetch, layout.
- `Scoreboard` — two `ScoreCard`s.
- `TaskList` — per-tab, dnd-kit sortable context, Done section.
- `TaskCard` — normal vs hazard variant; countdown bar; done checkbox; inline
  edit / SET AN ETA.
- `AddTaskForm` — manual task creation.
- `RecurringScreen` — template list + `TemplateForm` (CRUD).

## Error handling

- D1 write failures → surface a toast, keep local state, allow retry; don't lose
  the user's input.
- Optimistic UI for reorder / mark-done with rollback on failure.
- Generator is idempotent and tolerant: a failed insert for one template must not
  block the others; log and continue.
- Invalid `due_day` rejected at the form layer (monthly 1–31, weekly 0–6).

## Testing

Per repo convention (personal tooling: no TDD, manual testing). Manual checks:

- Create a manual task with and without an ETA; confirm hazard card + global
  counter for the no-ETA case.
- Countdown color at each threshold (>7, 3–7, 0–2, overdue).
- Drag-reorder persists across reload.
- Mark done → moves to Done, scoreboard updates (on-time vs late vs no-ETA).
- Create a monthly template (due 10th) and a weekly template (due Friday);
  trigger the generator (cron or on-load) and confirm exactly one task per
  period appears under the right owner with the right ETA; re-run and confirm no
  duplicate.
- Pause a template → no new generation; delete → existing generated tasks remain.

## Open / deferred

- Final subdomain name (`founders.agrolloo.com` proposed).
- Scoreboard server-side vs client-side computation — decided at build time.

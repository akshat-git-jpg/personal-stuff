# Personal Dashboard — Design Spec

**Date:** 2026-06-08
**Owner:** Kushal (single user)
**Status:** Approved design, pending spec review → implementation plan

---

## 1. Purpose

A single, mobile-first personal dashboard that holds the everyday-life essentials in one place, optimized so that **getting things in has zero friction**. Inspired by Jerad Hill's custom Claude Code app, but scoped down to a lean, personal v1.

The system owns three core things — **to-dos**, **habits/streaks**, and **remembers** (mindset lines) — and *displays* the user's Google Calendar as the fixed time-block layer. A cheap LLM turns messy typed/spoken input into structured to-dos.

### Design principles
1. **Mobile-first.** Designed for one-handed, on-the-go use on the phone. Big tap targets, bottom-reachable controls, fast load. Desktop is a bonus, not the primary target.
2. **Frictionless capture.** Adding a to-do is: open → type/speak one line → done. No required fields beyond the text.
3. **Free except hosting + pennies.** Runs on the existing Hostinger VPS. Only cost is OpenRouter usage (fractions of a cent per capture).
4. **Single user.** No multi-tenant complexity.
5. **Extensible.** Layout and data model leave room for future sections (people, library, projects, notifications) without a rewrite.

---

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Backend | Node + Express | Light, familiar, easy to host |
| Storage | SQLite (`better-sqlite3`) | Single file, trivial backup, perfect for one user |
| Frontend | Server-served pages + vanilla JS | No heavy framework; fast on mobile |
| Charts | Chart.js | Free streak graphs |
| App shell | PWA (manifest + service worker) | Add to iPhone home screen, fullscreen, app-like |
| Auth | Single-user password + cookie session | Private, simple |
| Calendar | Google Calendar API, OAuth2 **read-only** | Show time blocks from `kushalbakliwal25` calendar |
| LLM | OpenRouter, cheap model (default `google/gemini-2.5-flash-lite`), configurable | Parse capture text into structured to-dos |
| Deploy | **Docker container behind the existing Traefik** reverse proxy on Hostinger VPS `srv1377177` (72.61.241.170), on a subdomain, TLS via Traefik's Let's Encrypt ACME | Matches the established pattern (n8n already runs this way); firewall already allows 80/443 |

All free except the VPS (already owned) and OpenRouter usage.

---

## 3. Pages

### 3.1 Today (home / default)
The on-the-go glance screen. Top to bottom (mobile order):
- **Remember panel** — one random line from the collection, **reshuffles every time the app opens**.
- **Top 3 today** — up to 3 to-dos starred as the day's priorities, pinned at the top.
- **Schedule (timeline)** — today's Google Calendar events (lunch, gym, meetings) as the fixed time-block layer. Read-only.
- **To-dos due** — today's + overdue to-dos, **sorted by deadline**, tap to tick off. Overdue items carry a **"slipping" flag** (visual highlight).
- **Habits checklist** — only the habits scheduled for today's weekday; tap to check; shows current streak per habit.
- **Done-today count** — small tally of what was completed today (light dopamine hit).

### 3.2 To-dos
- **Frictionless quick-add** (see §4) — always visible at top; floating **+** button on mobile.
- Full list, add / edit / delete.
- Fields: `title` (required), `notes`, `deadline`, optional `time block` (start/end), `area/tag`, `priority`, `done`.
- Sorted by deadline. Filters: open / done / all; filter by area/tag.
- **Auto carry-over** — incomplete to-dos roll forward to the next day automatically (nothing silently disappears).
- **Recurring to-dos** — repeat rules (e.g. monthly "pay rent", every-3-days "water plants"). Distinct from habits (which are streak-based).
- **Search** — across to-dos.

### 3.3 Habits / Streaks
- Add / edit / delete. Fields: `name`, `description`, **weekdays** (Mon–Sun checkboxes), optional `time_of_day`, `mode` (forever | fixed), `start_date`, `end_date` (fixed only).
- Per-day-of-week scheduling: each day's checklist shows only that day's habits; streaks only count scheduled days.
- **Soft streak** — missing a scheduled day creates a **gap in the graph, no reset**.
- **Streak graph per habit** (Chart.js) — completions over time.
- **Fixed-duration habits archive** when their end date passes, with a final completed/missed summary. Archived streaks viewable below the active list.
- Search across habits.

### 3.4 Remembers
- Simple list: add / edit / delete mindset lines ("be social", "you are the best", etc.).
- This is the pool the Today panel pulls from.
- Search across remembers.

### 3.5 Settings
- **Google Calendar** — connection status, "sync now", last-synced time.
- **Capture Rules** — editable markdown (see §4), stored in DB, editable from any device.
- **LLM** — OpenRouter model + API key config.
- **Account** — change password.
- **Preferences** — timezone, dark mode toggle.
- **Data** — one-click JSON export; automatic SQLite backups run on a schedule.

---

## 4. Frictionless LLM capture

The core friction-killer.

### Flow
1. User taps the quick-add box (visible on every page; floating **+** on mobile).
2. User types **or speaks** one line. Voice in v1 = the **phone keyboard's built-in dictation mic** into the same text field — free, zero infra, works inside the PWA. (Dedicated record button / Whisper transcription is a v2 upgrade.)
3. On submit, the text + the user's **Capture Rules** are sent to a cheap OpenRouter model.
4. The model returns structured fields: `{title, deadline, time_start, time_end, area/tag, priority}`.
5. A new to-do is created from those fields. User can edit later but never has to.

Example: `"remind me to email the Zluri team tomorrow morning about the audit"` →
`title: "Email Zluri team about the audit"`, `deadline: <tomorrow>`, `time: morning`, `area: zluri`, `priority: high`.

### Capture Rules (user-maintained guidance)
- An editable markdown document stored in the DB (Settings → Capture Rules), reachable from the phone.
- Injected into every parse call as context so categorization/prioritization follows the user's evolving guidelines.
- Examples the user might add over time:
  - "Anything Zluri/work-related → area `zluri`, priority high, rank above personal to-dos."
  - "Mentions of gym/water/sleep → tag `health`."
  - "Default personal errands → area `home`."

### Fallback
If the LLM call fails or the key is missing, capture still works: the raw text becomes the to-do title with no deadline, so the app is never blocked on the LLM.

---

## 5. Data model (SQLite)

```
todos
  id, title, notes, deadline (datetime, nullable),
  time_start (nullable), time_end (nullable),
  area (nullable), priority (nullable),
  is_top3 (bool), done (bool), completed_at (nullable),
  recur_rule (nullable), carried_from (nullable date),
  created_at

habits
  id, name, description (nullable),
  weekdays (e.g. "1,3,5" for Mon/Wed/Fri),
  time_of_day (nullable),
  mode ("forever" | "fixed"),
  start_date, end_date (nullable for forever),
  archived (bool), created_at

habit_logs
  id, habit_id, date, done
  -- one row per scheduled day checked off; drives streaks + graphs

remembers
  id, text, active (bool), created_at

app  (single-row config)
  password_hash,
  google_oauth_tokens,
  openrouter_model, openrouter_key,
  capture_rules_md,
  timezone, dark_mode
```

### Streak calculation
- For a habit, the **current streak** = consecutive scheduled days (per its weekdays) completed up to today.
- **Soft model:** the *current* run naturally restarts after a missed scheduled day (a streak is by definition consecutive), but nothing is punished or wiped — the full completion history stays plotted on the graph and a gap is simply shown. No "you broke your streak" hard reset of data; previous best runs remain visible.
- Graph: per-habit completion history rendered with Chart.js (bar/heatmap of completions over time).

---

## 6. Out of scope for v1 (future, structured to add later)

- Push notifications (Pushover or web push)
- Dedicated voice recorder / Whisper transcription
- Universal capture router (LLM routing to-do vs remember vs note)
- People / personal CRM
- Library (notes, journal, book highlights, quotes)
- Projects / retainers
- Content pipeline
- AI chat over your data

The Today layout and data model leave room so these slot in without a rewrite.

---

## 7. Hosting & repo (decided)

- **Repo:** lives in the existing private monorepo **`personal-stuff`** (`akshat-git-jpg/personal-stuff`, local at `/Users/kbtg/codebase/personal stuff/`) as a new top-level folder, e.g. `personal-dashboard/`. Not in the TY (YouTube) repo.
- **VPS:** `srv1377177.hstgr.cloud` / `72.61.241.170`, Ubuntu 24.04, SSH key-only (`ssh -i ~/.ssh/hostinger_vps root@72.61.241.170`). Firewall `kb-vps-default` already allows inbound 22/80/443.
- **Reverse proxy:** existing **Traefik v3** (Docker), which routes only to containers labeled `traefik.enable=true` with a `Host(...)` router rule and TLS via the `mytlschallenge` ACME resolver. The app ships as its own Docker service (own `docker-compose.yml` under `/docker/<app>/` on the VPS, or added alongside) with those labels + a `Host(...)` rule for its subdomain.
- **Subdomain:** TBD at deploy — default candidate `dash.srv1377177.hstgr.cloud` (or a custom domain if preferred). Traefik issues the cert automatically.
- **Secrets:** OpenRouter key + Google OAuth client/refresh token stored in the repo-root `secrets/` (gitignored), vendored to the VPS at deploy — same pattern as the daily-digest tool. Never committed.
- **SQLite persistence:** the DB file lives on a Docker volume / bind-mount so it survives container rebuilds; covered by Hostinger's weekly VPS backups plus the app's own JSON export.

### Existing overlap to note
- `personal-stuff/my-planner/` already does lightweight task triage via the **Google Tasks** MCP (account `akshatpatidar17@gmail.com`) with a preferences file. This new app is a **separate, standalone web app** with its own SQLite store — it does **not** depend on or replace the Google Tasks setup for v1. Possible future integration (import Google Tasks) is out of scope for v1.

## 8. Remaining build-time setup

- Choose final subdomain + add the Traefik router labels.
- Google OAuth client setup (one-time consent, store refresh token in `secrets/`).
- OpenRouter API key wiring (env/`secrets/`).

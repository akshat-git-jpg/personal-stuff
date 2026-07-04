# Personal Dashboard — Implementation Plan

**Goal:** A mobile-first personal dashboard (to-dos + habits/streaks + remembers + Google Calendar view) with frictionless LLM-assisted capture, hosted on the existing Hostinger VPS behind Traefik.

**Spec:** `docs/superpowers/specs/2026-06-08-personal-dashboard-design.md`

**Repo / location:** `apps/personal-dashboard/` (in this repo).

**Tech stack:** Node + Express (ESM), `better-sqlite3`, vanilla JS frontend + Chart.js, PWA, OpenRouter (cheap model) for capture parsing, Google Calendar API (read-only), Docker + Traefik for deploy.

**Testing:** no TDD — build first, then test the whole app at the end (local run-through + a deploy smoke test).

---

## File structure

```
personal-dashboard/
├── package.json
├── .gitignore
├── .env.example            # documents required env; real secrets in repo-root secrets/
├── Dockerfile
├── docker-compose.yml      # Traefik-labeled service for the VPS
├── README.md
├── data/                   # sqlite db file (gitignored, bind-mounted volume)
├── src/
│   ├── server.js           # entry: starts express
│   ├── app.js              # express app wiring (middleware, routes, static)
│   ├── db.js               # sqlite connection + schema migration + seed config row
│   ├── config.js           # reads env + app config row
│   ├── auth.js             # single-user password + session middleware
│   ├── lib/
│   │   ├── dates.js        # timezone-aware date helpers (IST default)
│   │   ├── capture.js      # OpenRouter parse: text -> structured todo
│   │   ├── streaks.js      # streak calculation + graph series
│   │   ├── recurrence.js   # recurring-todo next-instance generation
│   │   ├── carryover.js    # roll incomplete todos forward
│   │   └── googleCalendar.js # OAuth + read today's events
│   └── routes/
│       ├── auth.routes.js
│       ├── todos.routes.js
│       ├── habits.routes.js
│       ├── remembers.routes.js
│       ├── today.routes.js
│       ├── settings.routes.js
│       └── capture.routes.js
└── public/
    ├── index.html          # app shell (SPA-ish, tabbed)
    ├── css/styles.css      # mobile-first + dark mode
    ├── js/app.js           # frontend controller (fetch + render)
    ├── js/views/*.js       # per-tab render functions
    ├── manifest.webmanifest
    ├── sw.js               # service worker (cache shell)
    └── icons/              # PWA icons
```

---

## Phase 0 — Scaffold

- [ ] Create `personal-dashboard/` in the personal-stuff repo.
- [ ] `npm init -y`; set `"type":"module"`. Install deps: `express`, `better-sqlite3`, `cookie-session`, `bcryptjs`, `node-fetch` (or use built-in fetch on Node 18+), `googleapis`, `chrono-node` (fallback parser), `dotenv`.
- [ ] Add `.gitignore` (`node_modules/`, `data/`, `.env`, `*.sqlite`).
- [ ] `.env.example` documenting: `PORT`, `SESSION_SECRET`, `APP_PASSWORD` (initial), `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `TZ` (default `Asia/Kolkata`).
- [ ] `src/server.js` + `src/app.js`: minimal Express serving `public/` and a `/healthz` route. Verify `npm start` serves a page locally.

## Phase 1 — DB + config

- [ ] `src/db.js`: open SQLite at `data/app.sqlite`, run schema migration on boot:
  - `todos`, `habits`, `habit_logs`, `remembers`, `app` (single-row config) per spec §5.
  - Insert the single `app` row on first boot (password hash from `APP_PASSWORD`, default timezone, default model, empty capture_rules_md).
- [ ] `src/config.js`: helper to read/update the `app` row (model, key, capture rules, timezone, dark_mode, google tokens).

## Phase 2 — Auth

- [ ] `src/auth.js`: `cookie-session` middleware; `POST /api/login` (compare bcrypt against `app.password_hash`), `POST /api/logout`, `requireAuth` guard for all `/api/*` except login.
- [ ] Login screen in `public/` (simple password field) shown when unauthenticated.

## Phase 3 — To-dos

- [ ] `src/lib/dates.js`: timezone helpers — `todayISO(tz)`, parse/format, "is overdue", "start/end of day".
- [ ] `src/routes/todos.routes.js`: REST — `GET /api/todos` (filters: status, area, search; sorted by deadline), `POST`, `PATCH /:id` (edit, toggle done, set top3), `DELETE /:id`.
- [ ] `src/lib/recurrence.js`: when a recurring todo is completed, generate the next instance from its `recur_rule` (support: daily, weekly, monthly, every-N-days).
- [ ] `src/lib/carryover.js`: on first request each day (or a lightweight boot/daily check), roll incomplete past-due todos forward to today (set `carried_from`). Idempotent per day.

## Phase 4 — LLM capture

- [ ] `src/lib/capture.js`: `parseCapture(text, captureRulesMd, {model, key, tz})` → calls OpenRouter chat completions with a JSON-output system prompt that includes the capture rules; returns `{title, deadline, time_start, time_end, area, priority}`. On any failure, fall back to `chrono-node` for the date and use raw text as title (never block capture).
- [ ] `src/routes/capture.routes.js`: `POST /api/capture` `{text}` → parse → create todo → return it.
- [ ] Frontend quick-add bar (always visible) + floating `+` on mobile posts to `/api/capture`. Voice = rely on the phone keyboard dictation mic into the same field (no extra code).

## Phase 5 — Habits + streaks

- [ ] `src/routes/habits.routes.js`: CRUD for habits; `GET /api/habits?day=<weekday>` returns habits scheduled for a day; `POST /api/habits/:id/log` `{date, done}` upserts `habit_logs`.
- [ ] `src/lib/streaks.js`: `currentStreak(habit, logs, tz)` (soft model — consecutive scheduled completed days up to today; restarts after a miss, history preserved) and `graphSeries(habit, logs, range)` for Chart.js.
- [ ] Fixed-duration habits auto-`archived` when `end_date` passed (compute on read; show archived list with completed/missed summary).

## Phase 6 — Remembers

- [ ] `src/routes/remembers.routes.js`: CRUD; `GET /api/remembers/random` returns one random active line (used by Today, reshuffles each call).

## Phase 7 — Google Calendar

- [ ] `src/lib/googleCalendar.js`: OAuth2 with `googleapis`; `GET /api/google/auth` + `/api/google/callback` to do one-time consent and store refresh token in `app` row; `getTodayEvents(tz)` reads today's events (read-only scope `calendar.readonly`).
- [ ] Settings shows connection status + "sync now" + last-synced.

## Phase 8 — Today aggregation

- [ ] `src/routes/today.routes.js`: `GET /api/today` returns `{ remember, top3, calendarEvents, todosDue (with slipping flag), habitsToday (with current streak), doneTodayCount }`.

## Phase 9 — Frontend (mobile-first PWA)

- [ ] `public/index.html` app shell with bottom tab bar: Today / To-dos / Habits / Remembers / Settings. Large tap targets, thumb-reachable.
- [ ] `public/css/styles.css`: mobile-first, dark-mode via `prefers-color-scheme` + manual toggle stored in config.
- [ ] `public/js/app.js` + `js/views/*`: render each tab from the API; quick-add bar; Chart.js streak graphs; tick/check interactions; Top-3 starring; slipping highlight; done-today count.
- [ ] PWA: `manifest.webmanifest` + `sw.js` (cache shell for fast load / installability) + icons.

## Phase 10 — Settings, backup/export

- [ ] `src/routes/settings.routes.js`: get/update config (model, key, capture rules markdown, timezone, dark mode, password change). JSON export endpoint (`GET /api/export` → full DB as JSON). Scheduled SQLite file backup (copy on a timer / cron in container).

## Phase 11 — Deploy (Hostinger VPS, Traefik)

- [ ] `Dockerfile` (node:20-slim, install deps, copy src+public, expose port, `node src/server.js`). `better-sqlite3` builds native — ensure build tools in image or use prebuilt.
- [ ] `docker-compose.yml` with Traefik labels: `traefik.enable=true`, router `Host(\`dash.srv1377177.hstgr.cloud\`)` (or chosen domain), TLS resolver `mytlschallenge`, service port; bind-mount `./data` for the SQLite file; attach to Traefik's network.
- [ ] Vendor secrets from repo-root `secrets/` (OpenRouter key, Google OAuth, session secret, app password) into the VPS deploy (env file, not committed).
- [ ] Deploy to `/docker/personal-dashboard/` on the VPS via scp/SSH (`ssh -i ~/.ssh/hostinger_vps root@72.61.241.170`), `docker compose up -d`. Confirm Traefik issues the cert and the subdomain serves.

## Phase 12 — Final testing (all at once)

- [ ] Local run-through: login, capture (typed + dictation), todos CRUD/filters/carry-over/recurring, habits scheduling + streak graph + archive, remembers reshuffle, Google Calendar events on Today, dark mode, PWA install on phone.
- [ ] Deployed smoke test on the subdomain from the phone home screen.

---

## Decisions locked
- Single user; SQLite; free except VPS + OpenRouter pennies.
- Time blocks live in Google Calendar (read-only); app owns todos/habits/remembers.
- Soft streaks; fixed-duration habits archive with summary.
- Capture: LLM parser (default `google/gemini-2.5-flash-lite`, swappable) + capture-rules markdown injected as context; `chrono-node` fallback.
- Mobile-first; bottom tab nav; PWA installable.

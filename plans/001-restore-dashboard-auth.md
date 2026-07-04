# Plan 001: Restore the auth gate on personal-dashboard

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 630ca99..HEAD -- apps/personal-dashboard/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `630ca99`, 2026-07-04

## Why this matters

`apps/personal-dashboard` is a Node/Express app running in Docker on a Hostinger
VPS, publicly reachable at `https://my-dashboard.agrolloo.com` (Traefik does TLS +
host routing only — no auth middleware, confirmed in `docker-compose.yml`). The
`requireAuth` middleware was gutted to a no-op, so **every API route — todos,
notes, habits, capture, settings, tags — is readable and writable by anyone who
hits the URL**. The owner has confirmed nothing else (no Cloudflare Access)
protects it, and wants the gate restored. The app's own `CLAUDE.md` still
documents an `APP_PASSWORD` gate, so this also re-aligns code with docs.

## Current state

Relevant files:

- `apps/personal-dashboard/src/auth.js` — session middleware + the gutted gate (52 lines)
- `apps/personal-dashboard/src/app.js` — Express app; mounts all routes
- `apps/personal-dashboard/src/config.js` — reads/writes the single `app` config row in SQLite (holds `password_hash`)
- `apps/personal-dashboard/src/routes/*.routes.js` — 9 route files; per audit each calls `router.use(requireAuth)` already (verify in Step 1)
- `apps/personal-dashboard/public/js/app.js` — client SPA entry (~8KB); currently has **no login view** (only `settings.js` references passwords)
- `apps/personal-dashboard/public/index.html` — SPA shell
- `apps/personal-dashboard/CLAUDE.md` — documents the (currently false) password gate
- `/decisions.md` (repo root) — append-only decision log, format `YYYY-MM-DD — <decision> — <why>`

`src/auth.js` as it exists today (excerpt, lines 5–29):

```js
export function sessionMiddleware() {
  return cookieSession({
    name: 'pd_session',
    secret: process.env.SESSION_SECRET || 'dev-insecure-secret-change-me',
    maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
    httpOnly: true,
    sameSite: 'lax',
  });
}

// Auth removed — this is a single-user dashboard with no password gate.
// Kept as a no-op so existing route mounts don't need to change.
export function requireAuth(req, res, next) {
  return next();
}

export function login(req, res) {
  const { password } = req.body || {};
  const cfg = getConfig();
  if (!password || !cfg.password_hash || !bcrypt.compareSync(password, cfg.password_hash)) {
    return res.status(401).json({ error: 'invalid password' });
  }
  req.session.authed = true;
  res.json({ ok: true });
}
```

Note: `login`, `logout`, `me`, and `changePassword` all still exist and work —
only `requireAuth` was gutted. The login endpoint is mounted at
`/api/auth` (see `src/app.js`: `app.use('/api/auth', authRoutes);`).

`src/app.js` mounts (excerpt):

```js
app.use(express.json());
app.use(sessionMiddleware());
app.use(express.static(join(__dirname, '..', 'public')));
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/todos', todosRoutes);
// ... habits, remembers, notes, today, settings, capture, tags
```

`.env.example` documents: `APP_PASSWORD` seeds the password hash **on first boot
only**; after that it's ignored and the hash lives in the SQLite `app` table
(`config.js` → `password_hash`). `SESSION_SECRET` is expected in `.env`.

Repo conventions: plain-JS Express app (no TypeScript), ESM imports. Match the
existing terse comment style in `auth.js`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd apps/personal-dashboard && npm install` | exit 0 |
| Run locally | `npm run dev` | "Personal Dashboard running at http://localhost:8787" |
| Syntax check | `node --check src/auth.js && node --check src/app.js` | exit 0, silence |
| Probe unauth | `curl -s -o /dev/null -w '%{http_code}' http://localhost:8787/api/todos` | `401` after fix |

There is no test suite or linter in this app.

## Scope

**In scope** (the only files you should modify):
- `apps/personal-dashboard/src/auth.js`
- `apps/personal-dashboard/public/index.html`
- `apps/personal-dashboard/public/js/app.js`
- `apps/personal-dashboard/public/css/styles.css` (login overlay styles only)
- `apps/personal-dashboard/src/db.js` — ONLY if Step 4 finds first-boot seeding was removed
- `apps/personal-dashboard/CLAUDE.md` (reconcile docs)
- `/decisions.md` (append one line)

**Out of scope** (do NOT touch, even though they look related):
- `docker-compose.yml` / Traefik labels — no proxy-level auth in this plan.
- `src/routes/*.routes.js` — they already call `requireAuth`; do not restructure them.
- Google Calendar token handling, capture rules, any other feature code.
- Rate limiting / lockout — known gap, deliberately deferred (see plans/README.md backlog).

## Git workflow

- Branch: `advisor/001-restore-dashboard-auth`
- Commit style: conventional commits matching the repo, e.g. `fix(dashboard): restore session auth gate`. Do NOT add any AI-attribution footer.
- Do NOT push or open a PR — the owner reviews and merges locally.

## Steps

### Step 1: Confirm every data route mounts requireAuth

```bash
grep -c "requireAuth" apps/personal-dashboard/src/routes/*.routes.js
```

**Verify**: every file except `auth.routes.js` shows count ≥ 1. If any data
route file (todos, notes, habits, today, capture, settings, tags, remembers)
has zero, add `router.use(requireAuth);` right after the router is created,
matching how the other route files do it.

### Step 2: Restore the gate in `src/auth.js`

Replace the no-op:

```js
// Session gate — every data route mounts this. /api/auth/* and /healthz stay open.
export function requireAuth(req, res, next) {
  if (req.session && req.session.authed) return next();
  return res.status(401).json({ error: 'unauthorized' });
}
```

Also harden the session secret fallback in `sessionMiddleware()`: replace
`process.env.SESSION_SECRET || 'dev-insecure-secret-change-me'` with a
fail-closed read:

```js
const secret = process.env.SESSION_SECRET;
if (!secret) throw new Error('SESSION_SECRET is required (see .env.example)');
```

(Throwing at startup is correct: the VPS `.env` already sets it per
`.env.example`, and a forgeable session cookie would defeat the gate.)

**Verify**: `node --check src/auth.js` → exit 0. Then `npm run dev` with a
`.env` containing `SESSION_SECRET` → server starts; without it → startup error.

### Step 3: Add a login overlay to the client

The SPA has no login view. Add a minimal one:

1. In `public/index.html`: add a hidden full-screen overlay div (id
   `login-overlay`) containing a password `<input>` and a submit button.
2. In `public/js/app.js` (client): on boot, `fetch('/api/auth/me')`; if the
   response JSON is not `{authed: true}`, show the overlay and halt normal view
   rendering until login succeeds. Wire the form to
   `POST /api/auth/login` with `{password}` (JSON body); on `{ok:true}` hide the
   overlay and boot the app; on 401 show "wrong password" inline.
3. Add a global fetch response check: any API response with status 401 →
   show the overlay (session expiry mid-use).
4. Style the overlay in `styles.css` matching the app's existing look (dark
   mode aware if the CSS has a dark scheme — check `styles.css` for existing
   custom properties and reuse them).

**Verify**: `npm run dev`, open `http://localhost:8787` in a browser (or
`curl -s http://localhost:8787/api/todos` → 401 JSON). With the correct
password (see Step 4), login succeeds and todos load.

### Step 4: Ensure a password hash exists

Check how `password_hash` is seeded:

```bash
grep -rn "password_hash" apps/personal-dashboard/src/db.js apps/personal-dashboard/src/*.js
```

- If first-boot seeding from `APP_PASSWORD` still exists (look for
  `bcrypt.hashSync` outside `changePassword`): nothing to do.
- If seeding was removed along with the gate: re-add it where the `app` row is
  first created in `db.js` — if `password_hash` is NULL/empty and
  `process.env.APP_PASSWORD` is set, store `bcrypt.hashSync(process.env.APP_PASSWORD, 10)`.
  Run this check at startup so an existing deployed DB (hash likely NULL) heals itself.

**Verify**: delete any local dev DB, start with `APP_PASSWORD=test1234` in
`.env`, then `curl -s -X POST localhost:8787/api/auth/login -H 'content-type: application/json' -d '{"password":"test1234"}'` → `{"ok":true}`.

### Step 5: Reconcile docs

- `apps/personal-dashboard/CLAUDE.md`: it already documents the
  `APP_PASSWORD`-hashed-into-DB behavior — confirm the text matches what you
  implemented (first-boot seed + startup self-heal), adjust if needed.
- Append to `/decisions.md` under `## Decisions` (newest at top):
  `2026-07-04 — personal-dashboard auth gate restored (session check in requireAuth + client login overlay + startup password-hash self-heal) — the gate had been removed as a no-op while the app was publicly reachable; docs always described it as gated.`

**Verify**: `git diff --stat` shows only in-scope files.

## Test plan

No test framework exists in this app; verification is the curl matrix:

| Request | Expected |
|---|---|
| `GET /healthz` unauthenticated | 200 `{ok:true}` |
| `GET /api/todos` unauthenticated | 401 |
| `POST /api/auth/login` wrong password | 401 |
| `POST /api/auth/login` right password | 200 `{ok:true}` |
| `GET /api/todos` with the session cookie from login | 200 |
| `POST /api/auth/logout` then `GET /api/todos` | 401 |

Run all six against `npm run dev` and record the results in your report.

## Done criteria

- [ ] All six curl-matrix rows pass locally
- [ ] `node --check` passes on every modified JS file
- [ ] Startup fails loudly when `SESSION_SECRET` is unset
- [ ] `grep -n "return next();" apps/personal-dashboard/src/auth.js` shows the call only inside the session check, not unconditionally
- [ ] `/decisions.md` has the new line; `CLAUDE.md` matches behavior
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/auth.js` no longer matches the "Current state" excerpt (drift).
- `auth.routes.js` does not actually expose `login`/`me`/`logout` (the plan assumes it does).
- The client `public/js/app.js` has a structure that makes a boot-time gate
  infeasible without larger refactoring (e.g. views self-execute on import) —
  report the structure you found instead of refactoring.
- Step 4 reveals password seeding never existed in this app's history (then the
  deployed DB has no hash and the owner must set one — report, don't invent a flow).

## Maintenance notes

- **Deploy is manual and owner-driven**: on the VPS, `docker compose up -d --build`
  in the deploy dir. The deployed SQLite DB likely has `password_hash` NULL (auth
  was removed) — the Step 4 self-heal plus `APP_PASSWORD` in the VPS `.env` fixes
  that on first restart. The owner should confirm login works after deploy.
- Deferred (in the unplanned backlog): rate limiting on the login endpoint, and
  the PWA service-worker cache possibly serving stale JS after deploy (hard-refresh if the overlay doesn't appear).
- If a future change adds new route files, they must mount `requireAuth` — the
  gate is per-router, not global.

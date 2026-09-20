# apps/gym-app — operating notes

Mobile gym PWA. Vite + React + Hono on a Cloudflare Worker. Full detail: `README.md`.

## Guardrails

- The plan lives in the `plan` table, `gym` is a column on `exercise`, and Sets/Reps is deliberately shared with the catalogue.

- **`starred` is a column on `plan`, NOT on `exercise`.** A star belongs to one
  (day, exercise) pair: Bench can be starred on Monday and plain on Thursday. It shows
  only in the week plan — no star button in the catalogue list or on the exercise page,
  both by the owner's call. `migrations/213-plan-starred-column.sql` moves the column
  and must be run on the remote DB before a deploy carrying it, or every read fails with
  "no such column". (`212` put it on `exercise`; `213` supersedes it.)

- **Every row action needs a clickable twin.** The swipe gesture is touch-only, so a
  desktop browser cannot reach it — each row also carries a `.rowdel` button (trash in
  the catalogue, minus-circle in the week plan). Deletes are not confirmed; they show an
  Undo toast instead, and undoing a catalogue delete calls `POST
  /api/groups/:tab/exercises/:id/restore`, which re-inserts under the ORIGINAL id (a new
  `addExercise` would mint a new id and orphan the log).

- **The A-Z toggle on a muscle group is a VIEW, not a sort.** It never writes an order
  back, resets to "My order" every time the screen opens, and hides the drag handles while
  on. Owner's call: his hand-made order must survive.

- **A weekday's one-liner lives in `day_note`, its own table.** A day can carry a note
  while holding no exercises, which a column on `plan` could not express. It is a NEW
  table, so `npm run db:remote` creates it — no hand-run migration.

- **kg/lbs is a LABEL, never a conversion.** `exercise.unit` picks what new sets are
  logged in; `log.unit` stamps each set with the unit it was recorded in, so history
  stays readable after a switch. Flipping the unit never rewrites a number — the owner
  re-enters the weight by hand, and that is his explicit call. Nothing in the app
  converts between the two, so the progression chart can mix units if an exercise
  switches. `migrations/214-weight-unit.sql` must be run on the remote DB before a
  deploy carrying it.

- **Writes hit a Cloudflare D1 database** (`gym-db`). The original Google Sheet is now a frozen rollback copy, plus `Mirror: *` tabs updated weekly by a cron. Use `DB` binding, `schema.sql`, and `npm run db:local`/`npm run seed:local` to test locally.
- **No auth** — single user, security is just the obscure URL. Don't add a login flow without asking.
- The client store (`src/client/store.tsx`) is the session source of truth: hydrate from localStorage, one batched `GET /api/bootstrap`, optimistic writes. **Don't add per-navigation refetch** — it breaks the snappy/consistent model on purpose.

## Run / deploy

```bash
npm run dev                 # vite (local UI + Worker in-process) on :5173, or WEB_PORT=<n> npm run dev
npm run deploy              # build + scripts/patch-routes.mjs + wrangler deploy
```

Always deploy via `npm run deploy`, **not** bare `wrangler deploy` — `patch-routes.mjs` re-injects the route config that the build strips. Deploys on the `akshatpatidar17@gmail.com` Cloudflare account. Secrets: `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REFRESH_TOKEN` (Sheets scope), `SHEET_ID`.

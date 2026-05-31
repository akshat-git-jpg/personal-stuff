# Gym — on-the-go workout PWA

Mobile-first PWA over the **"Exercises - AppSheet"** Google Sheet. Browse exercises by
muscle group, edit settings/notes/working-sets inline, drag to reorder, swipe to delete,
and log sets per session with progression history. The sheet stays the source of truth, so
the existing AppSheet app keeps working.

**Live:** https://kushal-gym.agrolloo.com (no auth — single user, obscure URL)

## Stack

- **Frontend:** Vite + React + TS, dark "Performance Terminal" design, `@dnd-kit` for touch
  drag-reorder. Installable PWA (manifest + service worker).
- **Backend:** Hono on a Cloudflare Worker. Reads/writes the sheet via the Google Sheets
  REST API, authenticating with the `akshatpatidar17` OAuth **refresh token** (Sheets scope).
- **Local-first:** the client store (`src/client/store.tsx`) is the session source of truth.
  It hydrates from localStorage instantly, then loads everything via one batched
  `GET /api/bootstrap`. Screens render from the store; writes are optimistic (instant UI,
  background sync to the sheet, rollback on failure). No per-navigation refetch — so the UI
  is snappy and read-after-write is always consistent.

## Data model

- **Library** = the existing muscle-group tabs, untouched (`ID, Name, Setting, Sets/Reps,
  Notes`; the `Anu Gym` tab adds a `Muscle Group` column). Every mutation reads the tab,
  edits the list, writes it back — row order = exercise order.
- **Workout Log** = a tab this app created. One row per logged set:
  `Date, ExerciseID, Exercise, MuscleGroup, SetNo, Weight, Reps, Notes`. Powers history/charts.

## Develop

```bash
npm install
npm run dev             # vite + worker together, http://127.0.0.1:5173
npm run dev -- --host   # also expose on the LAN for phone testing
```

Local secrets live in `.dev.vars` (gitignored). Production secrets are Cloudflare Worker secrets.
Note: use `127.0.0.1` not `localhost` if another vite app is running (IPv6/IPv4 port clash).

## Deploy

```bash
npm run build        # tsc + vite (client -> dist/client, worker bundled by wrangler)
npx wrangler deploy
```

### Secrets (Cloudflare)

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `SHEET_ID`. Set with:

```bash
printf '%s' "<value>" | npx wrangler secret put GOOGLE_REFRESH_TOKEN
```

## Add to iPhone

Open the live URL in Safari → Share → **Add to Home Screen** → launch fullscreen.

## Dev scripts

`scripts/shots.mjs`, `drive.mjs`, `swipe.mjs`, `prodcheck.mjs` drive the app in headless
Chrome at iPhone viewport to screenshot/verify the UI. `scripts/icon*.svg` + `rsvg-convert`
generate the PWA icons (`public/icon-*.png`).

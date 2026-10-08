# apps/video-review: operating notes

Freelancer video review (frame.io-style). Worker (Hono) + D1 + R2 + Vite/React. Human detail: `README.md`.

## Guardrails

- **Shares `tracker-db`** with the tutorial tracker (the account is at the 10 free D1 databases).
  Every table is prefixed `vr_` and migrations use `migrations_table = "vr_migrations"`.
  Never touch a non-`vr_` table from here.
- **Two kinds of caller.** The owner: PIN cookie (`isOwner`). The editor: the 22-letter project
  token in `/api/p/:token`. Writes that only the owner may do (notes, Final, delete) check
  `owner` inside the token routes. `scripts/e2e.mjs` asserts the editor gets 401 on each.
- **Free-plan limits drive the upload.** A Worker request body caps at 100 MB, so the page
  sends R2 multipart parts of `DEFAULT_PART_MB` (20 MB). `PART_MB` in `.dev.vars` shrinks it
  for local tests only.
- **Limits live in one place: `src/shared/rules.ts`.** The page pre-checks with it and the
  Worker enforces it. The server cannot read a video's length, so it trusts the page's duration
  but enforces the 400 MB cap, the 9 GB stop and exact part sizes.
- **No transcoding, by owner choice (2026-10-08).** The editor exports a 720p review file.
  A "shrink in the browser" button (WebCodecs) is the planned add-on if editors find it hard.
- `.dot.pin` / `.dot.draft` are the frame markers. Do not name a class `note` on the frame:
  `.note` is the notes-list card style and once turned the dot black.
- `package-lock.json` was seeded from kushal-salary's (fresh `npm install` hits an arborist bug).

## Run / deploy

Local: see `README.md`. `scripts/e2e.mjs` writes data and refuses a non-localhost URL.

First deploy (owner):

```
npx wrangler r2 bucket create video-review
npm run db:remote                                  # vr_ tables into tracker-db
npx wrangler secret put APP_PASSWORD
npx wrangler secret put SESSION_SECRET
npm run deploy                                     # review.agrolloo.com
```

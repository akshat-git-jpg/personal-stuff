# closet-app

Track how many times a garment has been worn since its last wash, plus a tagged gallery of outfit photos.

## Setup
- `npm install`
- Copy the dev vars example file to the dev vars file (with a dot) and fill in secrets
- `npm run db:local`
- `npm run dev:local`
- use **:5173** for UI work

## Screens

Two tabs, mobile-first, one thumb.

| Clothes | Looks |
|---|---|
| ![Clothes tab](docs/screenshots/clothes.png) | ![Looks tab](docs/screenshots/looks.png) |

- **Clothes** — a photo grid, sorted highest-wear-first. Each tile has three
  separate tap targets: the **photo** logs a wear (+1), the **name** opens the
  edit sheet, and **↺ washed** confirms then resets the count to 0. A missing
  or failed photo falls back to a letter placeholder, and the photo button
  stays enabled either way — a missing picture must never block logging a wear.
- **Looks** — a plain tagged gallery of outfit photos. Tapping a tile opens a
  full-screen viewer with its tags, Edit and Delete. Looks never link to
  clothes and there is no "I wore this look" action (owner decision,
  2026-08-17).
- **Undo** — every wear or wash shows a 10-second Undo bar so a one-handed
  mis-tap costs one tap to fix.
- **Tags** — one shared, autocompleting vocabulary across both tabs. The chip
  row filters with **AND** semantics: stacking chips narrows the grid, never
  widens it. The tag selection clears whenever you switch tabs.

## Endpoints

| Method | Path | Auth | Body → Response |
|---|---|---|---|
| POST | `/auth/login` | no | `{password}` → `{ok:true}` + cookie, or `401 {error}` |
| POST | `/auth/logout` | no | → `{ok:true}` |
| GET | `/api/me` | no | → `{authenticated:boolean}` |
| GET | `/api/state` | yes | → `{clothes,looks,tags,item_tags}` |
| POST | `/api/photos` | yes | raw image bytes → `201 {key}` |
| GET | `/api/photos/:key` | yes | → image bytes, or `404` |
| POST | `/api/clothes` | yes | `{name,tags?,photo_key?}` → `201` Cloth |
| PATCH | `/api/clothes/:id` | yes | `{name?,tags?,photo_key?}` → Cloth, or `404` |
| DELETE | `/api/clothes/:id` | yes | → `{ok:true}` |
| POST | `/api/clothes/:id/wear` | yes | → `{cloth,event_id}`, or `404` |
| POST | `/api/clothes/:id/wash` | yes | → `{cloth,event_id}`, or `404` |
| POST | `/api/events/:id/undo` | yes | → `{cloth}`, or `404` |
| POST | `/api/looks` | yes | `{name?,tags?,photo_key?}` → `201` Look |
| PATCH | `/api/looks/:id` | yes | `{name?,tags?,photo_key?}` → Look, or `404` |
| DELETE | `/api/looks/:id` | yes | → `{ok:true}` |
| GET | `*` | no | SPA via `ASSETS` |

## Schema Design Decisions
- **No wash limit**: There is no wash limit or threshold flag; a garment carries a raw wear count and the owner decides when to wash it.
- **Looks do not link to clothes**: `looks` is a plain tagged gallery — it deliberately has NO link to `clothes`.

## First remote deploy (owner only)
1. `npx wrangler d1 create closet-db` → paste the real `database_id` into `wrangler.toml`
2. `npx wrangler r2 bucket create closet-photos`
3. `npm run db:remote`
4. `npx wrangler secret put APP_PASSWORD` and `npx wrangler secret put SESSION_SECRET`
5. `npm run deploy` → Cloudflare auto-provisions DNS + SSL for `closet.agrolloo.com`
6. Add the app to `INFRA.md` and `my-hosted-sites.md`

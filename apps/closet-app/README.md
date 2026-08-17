# closet-app

Track how many times a garment has been worn since its last wash, plus a tagged gallery of outfit photos.

## Setup
- `npm install`
- Copy the dev vars example file to the dev vars file (with a dot) and fill in secrets
- `npm run db:local`
- `npm run dev:local`
- use **:5173** for UI work

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

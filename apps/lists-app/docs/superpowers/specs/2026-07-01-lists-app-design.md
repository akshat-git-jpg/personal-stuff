# lists-app — design spec

**Date:** 2026-07-01
**Status:** Built + deployed (lists.agrolloo.com)

## Purpose

A personal web app for keeping plain-text lists grouped by category — e.g.
"YouTube channel ideas", "Skills to learn", "Books to read". Single user
(me only), password-gated.

## Stack

Mirrors `apps/tracker-app`, leaner:

- Vite + React 19 + TypeScript + Tailwind v4 (SPA)
- Hono on a Cloudflare Worker (API + static asset serving)
- Cloudflare D1 (SQLite) for storage
- Single-password gate via a stateless signed cookie (no KV, no OAuth)
- Deployed to `lists.agrolloo.com` (custom domain on the agrolloo.com zone)

## Data model (D1)

```
categories(id TEXT pk, name TEXT, position INT, created_at INT)
items(id TEXT pk, category_id TEXT, text TEXT, position INT, created_at INT)
index idx_items_category on items(category_id, position)
```

Category delete cascades to its items in application code (not FK-enforced).
`position` columns back drag-and-drop ordering.

## Auth

Single password held as the `APP_PASSWORD` Worker secret. `POST /auth/login`
compares (constant-time, both sides HMAC'd) and, on success, sets an
HttpOnly+SameSite=Lax cookie `lists_session` = `${exp}.${HMAC-SHA256(exp)}`
signed with `SESSION_SECRET`. The cookie is self-verifying — no datastore
lookup. 30-day expiry. `requireAuth` middleware gates everything under `/api/*`
except `/api/me`.

## API (Hono)

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{ password }` → set cookie / 401 |
| POST | `/auth/logout` | clear cookie |
| GET | `/api/me` | `{ authenticated }` (no auth required) |
| GET | `/api/state` | `{ categories, items }` |
| POST | `/api/categories` | `{ name }` → Category |
| PATCH | `/api/categories/:id` | `{ name }` rename |
| DELETE | `/api/categories/:id` | cascade-deletes items |
| POST | `/api/items` | `{ category_id, text }` → Item |
| PATCH | `/api/items/:id` | `{ text }` edit |
| DELETE | `/api/items/:id` | |
| POST | `/api/reorder` | `{ type: "category"\|"item", orderedIds, categoryId? }` |
| GET | `*` | serve SPA via ASSETS |

Search runs client-side over the single `/api/state` payload — no server
search endpoint.

## UI (ui-craft — Soft Modern)

- Rounded cards, soft layered shadows, gently green-tinted neutral ramp, varied
  radius (inputs 8px / cards 14px / modal 18px via the token scale).
- One accent: **emerald** (`oklch(0.696 0.17 162)`), ≤5 placements per viewport
  (active category, primary Add, focus ring, count badge).
- Inter (self-hosted via `@fontsource-variable/inter`), sentence case,
  `tracking-tight` headings. Lucide icons. No emoji.
- Light default + intentional dark mode following the OS preference;
  `color-scheme` + `theme-color` synced. No manual toggle.
- Minimal motion: ~150–200ms fades, hover states, `prefers-reduced-motion`
  honored.
- Layout: two-pane on desktop (categories aside + items main); on mobile the
  categories collapse into a dropdown above the items. Written empty states.

## Features

- CRUD categories and items.
- Drag-reorder items within a category and categories themselves (dnd-kit),
  persisted to `position`. Optimistic on the client.
- Search box filtering items across all categories; each hit shows its category
  and jumps to it.

## Out of scope (v1)

Due dates, multi-user/accounts, sharing, tags, reminders. `position` columns
already exist so reordering needed no migration; the rest are clean future adds.

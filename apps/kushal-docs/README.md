# Kushal Docs — personal document vault

Mobile-first PWA for storing personal documents: upload PDFs and images, give each
a name and tags, search and filter by tag, view inline, download, or delete. Built for
quick phone access to things like ID cards, bank statements, and medical reports.

**Live:** https://kushal-docs.agrolloo.com (Google sign-in, locked to a single email)

## Stack

- **Frontend:** Vite + React + TS, dark mobile theme. Installable PWA (manifest + service
  worker + icons). State is held in memory; the metadata index is loaded once on unlock and
  all search/tag-filtering happens client-side.
- **Backend:** Hono on a Cloudflare Worker.
- **Storage:** Cloudflare R2 bucket `kushal-docs` (binding `DOCS`). Files are stored as-is
  (not encrypted) — the Google-gated session is the lock. The door is guarded, not the bytes.

## Auth

"Sign in with Google" (OAuth 2.0 authorization-code flow), allow-listed to one email via the
`ALLOWED_EMAIL` secret. The ID token comes straight from Google's token endpoint over TLS, so
its claims are trusted without re-verifying the JWT signature (OIDC §3.1.3.7); the Worker
checks `email_verified` + the allow-list, then issues an HMAC-signed session cookie (`kdsess`,
30-day). All `/api/*` data routes are gated on that cookie. See `src/worker/auth.ts`.

The Web OAuth client lives in the Google project `n8n-workflows-454504`, with redirect URI
`https://kushal-docs.agrolloo.com/api/auth/callback` (and `http://localhost:5173/...` for dev).
Scopes are `openid email profile` (non-sensitive — no Google verification needed).

## Data model

One library = a single `index.json` object in R2:

```jsonc
{ "items": [ { "id", "name", "tags": [], "mime", "filename", "size", "hasThumb", "createdAt" } ] }
```

R2 keys: `blob/<id>` (the file), `thumb/<id>` (a client-made ~480px JPEG preview, images only),
`index.json` (the metadata above). The client is the source of truth: on add it uploads the
blob (+ thumb), then PUTs the whole updated index.

## API

| Route | Purpose |
|---|---|
| `GET /api/auth/login` → Google | start sign-in |
| `GET /api/auth/callback` | exchange code, set session, redirect to `/` |
| `POST /api/auth/logout` | clear session |
| `GET /api/me` | `{ email }` or 401 |
| `GET/PUT /api/index` | read/write the metadata index |
| `PUT/GET/DELETE /api/blob/:id` | upload / stream / delete a file (DELETE also drops the thumb) |
| `PUT/GET /api/thumb/:id` | upload / stream a thumbnail |

`GET /api/blob/:id?download=1&name=…` sets `Content-Disposition` for downloads.

## Develop

```bash
npm install
npm run dev          # vite + worker together, http://localhost:5173
```

Local secrets live in `.dev.vars` (gitignored, dummy values — real sign-in needs the prod URL
or a localhost redirect registered on the OAuth client).

## Deploy

```bash
npm run deploy       # build → patch-routes (re-inject custom domain + R2 binding) → wrangler deploy
npm run icons        # regenerate PWA icons from the inline SVG (needs `rsvg-convert`)
```

### Secrets (Cloudflare)

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `ALLOWED_EMAIL`. Set with:

```bash
printf '%s' "<value>" | npx wrangler secret put SESSION_SECRET
```

**Gotcha:** the `@cloudflare/vite-plugin` sanitizes the Worker name, so the build output lands
in `dist/kushal_docs/` (underscore) and it strips `routes` + R2 binding from the generated
config on every build — `scripts/patch-routes.mjs` re-injects both, which is why deploy runs it.

## Add to phone

Open the live URL → iPhone: Safari Share → **Add to Home Screen**. Android: Chrome menu →
**Install app**. Launches fullscreen with its own icon.

## Possible upgrades

- Zero-knowledge client-side encryption (AES-GCM, passphrase-derived key) so even Cloudflare
  can't read the files — without changing the UI.
- PDF first-page thumbnails; multi-file batch upload.

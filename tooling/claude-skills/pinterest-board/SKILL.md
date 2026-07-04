---
name: pinterest-board
description: Open the local Pinterest "posting cockpit" — an intuitive web board (localhost) that shows every generated pin with a big image preview and one-tap Copy buttons for each field (title, description, hashtags, board, link), plus a "Mark posted" toggle that records posted status + optional live pin URL + date to disk. Use when posting pins to Pinterest one by one. Triggers on "open my pinterest board", "open the pinterest board", "show my pins", "pinterest posting cockpit", "pinterest-board", "I want to post my pins", "let me post pins".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# pinterest-board

A zero-dependency local server (`serve.mjs`, Node built-ins only — no install) that turns
your generated pins into an intuitive posting board. Use it while manually posting to
Pinterest: copy each field one tap at a time, then tick "Posted".

## What it does

- Scans the project root (default `~/codebase/personal-stuff/ty/pinterest`) for niches (any subfolder with
  a `config.json`) and their `posts/<slug>/` folders.
- Serves a board at `http://localhost:4000`:
  - **Niche switcher** (dropdown) + filters: **To post / All / Posted** + a progress count.
  - Each pin = a card: image preview (click → full size) and per-field **Copy** buttons for
    title, description, hashtags, board, link. Plus best-time.
  - **Mark posted** checkbox → writes status to `<niche>/posts.json` instantly (with an
    optional live pin-URL box and an auto date stamp). Survives refresh; readable by Claude.

It reads each post's `post.json` (preferred) or falls back to parsing `post.md`.

## How to launch

Run the server in the background and give the user the URL:

```bash
node "<SKILL_DIR>/serve.mjs"
```
(`<SKILL_DIR>` = this skill's folder.) Optional flags: `--root <path>` `--port <n>`, or env
`PINTEREST_ROOT` / `PORT`. Start it in the background so the session stays free, then tell
the user to open **http://localhost:4000**.

Stop it when the user is done (kill the background process).

## Notes

- No `npm install` needed — pure Node, so it's portable as-is.
- Posted status lives in `<niche>/posts.json` (NOT config.json), e.g.
  `{ "<slug>": { "posted": true, "pinUrl": "...", "postedDate": "2026-06-02" } }`.
  This is the same file Phase 1.5 tracking will read.
- The board never posts anything to Pinterest — it's a copy-paste + checklist aid only.

# video-registry

One key per video, minted once, shared by every pipeline that touches it.

A video passes through `youtube/yt-script/` (outline + script) and
`video/visuals-flow/` (the edit). Each used to invent its own folder name from
whatever wording of the title it happened to get, so the same video existed twice
under two names with nothing connecting them. This is the single place a video's
name is decided.

The key **is** the folder name — same readable kebab slug as always
(`videos/<key>/`, `Output/<key>-final.mp4`). Only its origin changed.

## Use it

```bash
cd pipelines/video-registry

# The verb both pipelines call. Mints if new, returns the existing key if not.
KEY=$(node bin/vreg.mjs ensure best-ai-video-tools --title "Best AI Video Tools 2026")

# Who already has a folder for this video?
node bin/vreg.mjs where "$KEY"

node bin/vreg.mjs list        # every registered video
node bin/vreg.mjs check       # fail on any videos/ dir the registry doesn't know
```

`ensure` is idempotent: whichever pipeline reaches a video first mints the key,
the other looks it up. Neither owns naming.

## Files

- `videos.json` — the registry (tracked, sorted by key, safe to hand-edit)
- `lib/registry.mjs` — the module both pipelines import
- `bin/vreg.mjs` — the CLI
- `registry.test.mjs` — `node --test registry.test.mjs`

No dependencies.

Operating rules, the alias policy, and why a content-hash key was rejected:
[CLAUDE.md](CLAUDE.md).

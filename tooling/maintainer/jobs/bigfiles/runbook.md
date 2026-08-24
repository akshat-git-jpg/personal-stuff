# runbook: bigfiles

## Measuring commands

```bash
git count-objects -vH | grep size-pack
git ls-tree -r -l HEAD | awk '{s+=$4} END {printf "%.1f MB across %d files\n", s/1048576, NR}'
git rev-list --objects --all \
  | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
  | awk '$1=="blob"' | sort -k3 -n -r | head -15
```

## The Allowlist

Not everything large is wrong. These are deliberate and must **not** be flagged as defects:

- `pipelines/video/heygen/characters/*/source.jpeg` — the character registry's source images
- `pipelines/video/tts/references/*.wav` — reference voices
- `pipelines/.agents/skills/**` — vendor skill packs (their `.gitignore` already excludes `*.mp4|mov|wav|mp3`)
- `apps/*/public/**` and `apps/*/docs/shots/*.png` — shipped assets and UI screenshots
- `plans/runs/evidence/*.png` — the `ui: true` gate's committed screenshots

## Archiving rule

A local removal of a gitignored file is a move to `~/pp-maintainer-archive/`, never an `rm`.
A gitignored file has NO copy in git.

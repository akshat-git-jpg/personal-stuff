# Plan 010: VPS migration runbook — repoint render2's card mount, retire the orphaned TY clone

> **Executor instructions**: This runs on the **VPS over SSH**, AFTER Plans 008
> and 009 are merged to `main` and **pushed** to GitHub. It is an ops runbook,
> not a code change — most steps are SSH commands with a verification after each.
> Do every **Verify**. Honor STOP conditions. This plan makes **no repo commits**
> except the final status update to `plans/README.md`.
>
> **Preconditions (check first)**:
> - `git -C <repo> log --oneline -3` shows the 008 + 009 commits, and they are
>   **pushed** (`git status -sb` shows `main` not ahead of `origin/main`, or you
>   have pushed them). If not pushed, STOP — the VPS pulls from GitHub; unpushed
>   code will not reach it.
> - You can `ssh hostinger-vps` (alias in `~/.ssh/config` → `72.61.241.170`).

## Status

- **Priority**: P3
- **Effort**: S-M (few steps, but on live infra)
- **Risk**: MED (touches a live container serving `render2.agrolloo.com`; mitigated — the only stateful change is one bind-mount path)
- **Depends on**: 008 + 009 merged AND pushed
- **Category**: migration / dx
- **Planned at**: commit `e88931b` (or later), 2026-07-04

## Why this matters

After Plans 008/009, the Pinterest business + video content live at new repo
paths. The VPS pulls `personal-stuff` on every cron tick, so **all Python cron
code updates itself automatically** — the crons (`my-planner`, `gmail-digest`)
reference `apps/telegram-*`, never `ty/`, so they need nothing. The one VPS thing
that breaks is the **hyperframes-render** container: its `docker-compose.yml`
bind-mounts the Hyperframes card library from `/srv/projects/TY/yt-visuals-hyperframe`
— a **pre-merge path**. That points at a standalone `TY` clone that a prior
one-time step put on the VPS (`docs/kb-routing-audit-handoff.md` documents cloning
TY to `/srv/projects/TY/`). Post-merge, the card library lives inside the
`personal-stuff` clone, and after Plan 009 it's at `WS/video/card-library`. This
runbook repoints the mount, retires the now-orphaned standalone `TY` clone (dead
weight + a second thing to keep pulled), and verifies render2 still serves its
Templates tab.

## Current state (verified from the repo)

- `apps/hyperframes-render/docker-compose.yml` — deploy dir on VPS is
  `/docker/hyperframes-render/`; the volume line is (pre-009):
  `- /srv/projects/TY/yt-visuals-hyperframe:/cards:ro`. Plan 009 updates the
  in-repo compose's repo-side segment to `WS/video/card-library` and leaves a
  pointer comment; this runbook sets the full VPS path.
- VPS filesystem (from INFRA.md / VPS-CRONS.md):
  - `/srv/projects/personal-stuff/` — the code clone (read-only deploy key), pulled on cron ticks.
  - `/srv/projects/TY/` — the **orphaned** standalone TY clone (candidate for removal; confirm it exists).
  - `/docker/{n8n,minio,personal-dashboard}` — compose projects. `hyperframes-render` deploy dir is `/docker/hyperframes-render/`.
  - Traefik (`n8n-traefik-1`) fronts everything; `render2.agrolloo.com` → hyperframes-render container `:8080`.
- SSH aliases on the VPS (`/root/.ssh/config`): `github-personal-stuff`
  (read-only, for the personal-stuff clone) and possibly a `github-ty` block
  (added for the standalone TY clone per the handoff doc) — retire the latter if present.
- No cron references `ty/`/`WS/`: crontab jobs are `my-planner` (`apps/telegram-my-planner`) and stock system jobs. So **no crontab edit, no venv reinstall** is needed for this migration.

## Commands you will need (run via `ssh hostinger-vps`)

| Purpose | Command | Expected |
|---|---|---|
| Confirm code arrived | `git -C /srv/projects/personal-stuff pull && ls /srv/projects/personal-stuff/WS/video/card-library` | HTML card dirs listed |
| Inspect compose | `cat /docker/hyperframes-render/docker-compose.yml` | shows the volume line |
| Container state | `docker ps --filter name=hyperframes-render` | Up |
| Recreate container | `cd /docker/hyperframes-render && docker compose up -d` | recreated, Up |
| Verify site | `curl -sS -o /dev/null -w '%{http_code}' https://render2.agrolloo.com/` | 200/302 (auth redirect ok) |

(`WS` = the workspace name chosen in Plan 008, default `pipelines`. Use the real
name everywhere below.)

## Scope

**In scope** (all on the VPS, over SSH): pulling the code clone; editing
`/docker/hyperframes-render/docker-compose.yml`'s bind-mount to the new path;
recreating that one container; retiring the orphaned `/srv/projects/TY/` clone
and its SSH/deploy-key wiring; verifying render2. Plus one repo doc fix
(`docs/kb-routing-audit-handoff.md`'s now-moot "clone TY to the VPS" step) and
the `plans/README.md` status row.

**Out of scope**:
- Any other container (`n8n`, `minio`, `personal-dashboard`, `traefik`) — untouched.
- Cron/crontab changes — none are needed (no cron references the workspace).
- Cloudflare Workers (redirector, landing-pages) — they're deployed at the edge;
  moving their source folders in 008 doesn't affect the running Workers. (A future
  `wrangler deploy` just runs from `apps/redirector` now — not part of this runbook.)
- Rotating deploy keys / secrets — unless Step 4 finds the `github-ty` key, which
  gets removed as cleanup.

## Steps

### Step 1 — Confirm the new code is on the VPS

```bash
ssh hostinger-vps
git -C /srv/projects/personal-stuff pull
ls /srv/projects/personal-stuff/WS/video/card-library
```

**Verify**: the pull succeeds and the card-library directory lists the HTML card
folders. If the path is missing, the push/merge didn't include 009 — **STOP**,
fix on the Mac, don't hand-edit the VPS.

### Step 2 — Repoint the render2 card mount

Back up and edit the deploy compose:

```bash
cp /docker/hyperframes-render/docker-compose.yml /docker/hyperframes-render/docker-compose.yml.bak
```

Change the volume line from the stale path to:

```
      - /srv/projects/personal-stuff/WS/video/card-library:/cards:ro
```

(Match whatever the in-repo `apps/hyperframes-render/docker-compose.yml` says
after Plan 009 — the repo file is the source of truth; the VPS deploy copy should
equal it except any VPS-only `.env`.)

**Verify**: `grep cards /docker/hyperframes-render/docker-compose.yml` shows the
new `/srv/projects/personal-stuff/WS/video/card-library` path and no `/srv/projects/TY`.

### Step 3 — Recreate the container and verify render2

```bash
cd /docker/hyperframes-render && docker compose up -d
docker ps --filter name=hyperframes-render
curl -sS -o /dev/null -w '%{http_code}\n' https://render2.agrolloo.com/
```

Then open `https://render2.agrolloo.com/`, log in (shared password), and confirm
the **Templates tab lists cards** (proves the new mount resolves inside the
container). If it's empty, exec in and check the mount:
`docker exec hyperframes-render ls /cards` should list card-type dirs.

**Verify**: container Up; site returns 200 (or 302 to login); `/cards` inside the
container lists cards.

**STOP if**: the container fails to start or `/cards` is empty after the mount
change — restore the backup (`cp …docker-compose.yml.bak …docker-compose.yml && docker compose up -d`) and report; do not leave render2 down.

### Step 4 — Retire the orphaned standalone TY clone

Confirm it exists and is no longer needed (the card library now comes from the
personal-stuff clone):

```bash
ls -la /srv/projects/TY 2>/dev/null && git -C /srv/projects/TY remote -v 2>/dev/null
grep -rn "projects/TY\|github-ty" /srv/crons /root/.ssh/config /etc/cron* 2>/dev/null
```

- If **nothing** now references `/srv/projects/TY` (Step 2 removed the only mount,
  and the grep shows no cron/config use), remove it:
  ```bash
  rm -rf /srv/projects/TY
  ```
  and, if a `Host github-ty` block exists in `/root/.ssh/config` solely for this
  clone, delete that block and its deploy key file (`/root/.ssh/github_ty*` or
  similar). Remove the corresponding deploy key from the GitHub TY repo settings
  later (note it in your report — that's a web-console action).
- If the grep shows **any** remaining reference, **STOP** — something still uses
  it; report before deleting.

**Verify**: `ls /srv/projects/TY` → "No such file"; `grep -rn "projects/TY" /srv/crons /root/.ssh/config` → empty.

### Step 5 — Fix the now-moot repo doc + record

On the **Mac** (repo side, a small commit):
- Edit `docs/kb-routing-audit-handoff.md` — the "Add TY to the VPS / clone TY to
  `/srv/projects/TY/`" step (~line 71) is obsolete (TY is merged; the card
  library comes from the personal-stuff clone). Replace it with a one-line note
  that TY is merged into `personal-stuff` and the standalone VPS clone was retired
  by plans/010.
- Append to root `decisions.md`:
  `2026-07-04 — VPS: repointed hyperframes-render card mount from the stale /srv/projects/TY/yt-visuals-hyperframe to /srv/projects/personal-stuff/WS/video/card-library and retired the orphaned standalone TY clone + its github-ty deploy key — the TY subtree merge left a second VPS clone the render2 mount still pointed at.`
- Update `VPS-CRONS.md` (root copy) if it references the old mount; note the two
  other copies (`vps-crons` repo, `/root/VPS-CRONS.md`) should be synced by hand.
- `plans/README.md`: 010 → DONE.

**Verify**: `grep -rn "srv/projects/TY" .` (repo) → only historical/dated mentions;
`git status` shows only these doc edits.

**Commit** (Mac): `docs(vps): retire standalone TY clone; repoint render2 card mount (plan 010)`. Do NOT push automatically — let the owner push.

## Test plan

- render2.agrolloo.com loads and its Templates tab lists cards (the end-to-end proof the mount works).
- `docker exec hyperframes-render ls /cards` lists card dirs.
- No VPS path or cron still references `/srv/projects/TY`.
- The my-planner cron is unaffected: `tail -5 /srv/crons/kb-daily-planner/logs/*.log` (or wait for the next 06:00 IST tick) shows it still runs — it was never coupled to `ty/`, this just confirms no collateral damage.

## Done criteria

- [ ] `/docker/hyperframes-render/docker-compose.yml` mounts `/srv/projects/personal-stuff/WS/video/card-library`; container Up
- [ ] render2 Templates tab lists cards; `/cards` populated inside the container
- [ ] `/srv/projects/TY` removed; no cron/ssh-config reference remains; `github-ty` key/block removed (GitHub-side key removal noted for the owner)
- [ ] `docs/kb-routing-audit-handoff.md` de-obsoleted; decisions.md + VPS-CRONS.md updated
- [ ] `plans/README.md` 010 → DONE; the doc commit is made but not pushed by you

## STOP conditions

- 008/009 not pushed / not on the VPS after `git pull` — fix on the Mac first.
- The render2 container won't start or `/cards` is empty after the mount change —
  restore the `.bak` compose, bring it back up, report.
- `/srv/projects/TY` is still referenced anywhere — do not delete it.
- You find a cron or service you didn't expect that references the old paths —
  report before touching it; the crontab is supposed to be `ty`-free.

## Maintenance notes

- After this, the VPS has a single source clone (`/srv/projects/personal-stuff`)
  and render2's cards come from inside it — no second repo to keep pulled.
- If the workspace is renamed again, only this one compose mount + this runbook's
  path need updating (plus the in-repo compose). Keep the two in sync.
- The three copies of `VPS-CRONS.md` (repo root, `vps-crons` repo, `/root/`) drift
  easily — when you touch one, sync the others (a pre-existing chore, not caused here).
- Cloudflare Workers moved to `apps/` in 008 deploy fine from their new paths with
  `wrangler deploy`; no VPS involvement — noted here only so nobody looks for it on the VPS.

# Plan 005: Fix the skill-sync scripts and draw a hard line through the MCP graveyard

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. This
> plan **deletes code** in Step 4 — the pre-deletion verification there is
> mandatory, not optional. If anything in the "STOP conditions" section occurs,
> stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 630ca99..HEAD -- scripts/ tooling/mcp/ tooling/README.md`
> On drift in these paths, re-read the affected file before editing; on a
> mismatch with the excerpts below, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (Step 4 deletes servers; the boundary between dead and load-bearing is the whole point)
- **Depends on**: none
- **Category**: tech-debt / dx
- **Planned at**: commit `630ca99`, 2026-07-04

## Why this matters

The skill store (`tooling/claude-skills/`, 42-entry manifests) is synced by two
scripts with duplicated, subtly buggy logic: a renamed/removed store skill
leaves a **dangling symlink that is never pruned** as long as its name stays in
the manifest, and `scripts/vps-sync.sh` — which runs every 15 minutes from a
VPS cron and does `rm -rf` on the live skills dir — **silently swallows `git
pull` failures** (VPS serves stale skills indefinitely) and has **no run lock**
(overlapping runs can race the teardown/rebuild). Meanwhile `tooling/mcp/`
holds ~2,000 LOC of retired MCP servers next to live ones, and the dead/alive
boundary exists only as prose scattered across four READMEs — one wrong "clean
this up" by a future agent breaks Google CLI auth or the VPS gmail digest.

## Current state

### The sync scripts

- `scripts/relink.sh` (60 lines) — Mac: manifests → `~/.claude-work/skills` + `~/.claude-personal/skills`.
- `scripts/vps-sync.sh` (75 lines) — VPS: `git pull` + manifest → `~/.claude/skills`, cron every 15 min.

Both define byte-identical `resolve_src()` / `is_managed()`:

```bash
resolve_src() {                       # echo the source folder for a skill name
  local name="$1"
  if   [ -d "$STORE/$name" ];      then echo "$STORE/$name"
  elif [ -d "$AGENTS_DIR/$name" ]; then echo "$AGENTS_DIR/$name"
  else return 1; fi
}
is_managed() {                        # true if symlink target is under store or agents
  case "$(readlink "$1")" in "$STORE"/*|"$AGENTS_DIR"/*) return 0 ;; *) return 1 ;; esac
}
```

**The prune bug** (relink.sh:47-51; vps-sync.sh:61-71): the prune loop removes a
managed link only when its basename is absent from the manifest. If skill `foo`
is renamed to `bar` in the store but the manifest still says `foo`: the link
step WARNs and skips (`resolve_src` fails), and the prune step keeps the now-
dangling `foo` symlink (it points under `$STORE/`, so `is_managed` passes; its
name IS in the manifest, so it survives). vps-sync.sh's extra
`elif [ ! -e "$e" ]` branch (line 68) only fires for *unmanaged* dangling links,
so it never catches this case either.

**The silent pull** (vps-sync.sh:27-31):

```bash
if git -C "$REPO" pull --quiet; then echo "git pull: ok"; else echo "git pull: failed (network?); using existing checkout"; fi
```

Soft-fail is deliberate (offline resilience) but there is no alert, no state
file, no lock. The VPS has an ntfy server (`infra/docker/ntfy/`) and a CLI at
`tooling/cli/ntfy` for notifications.

### The MCP directory (`tooling/mcp/`)

Contents at `630ca99`: `cloudflare-mcp-server/`, `elevenlabs/`,
`gmail-mcp-server/`, `google-calendar-mcp-server/`, `google-docs-mcp-server/`,
`google-drive-mcp-server/`, `google-shared/`, `google-sheets-mcp-server/`,
`google-task-mcp-server/`, `hostinger/`, `youtube-mcp-server/`, plus
`.mcp.json.template` and `README.md`.

Prose facts scattered across READMEs (verify each in Step 4 before acting):
- Only **`google-drive-mcp-server`** and **`cloudflare-mcp-server`** are wired into `.mcp.json` (root README: "only `drive` and `cloudflare` still used").
- **`gmail-mcp-server/server.py` is still invoked by the VPS `gmail-digest` cron** (per `tooling/mcp/README.md`; cross-check `VPS-CRONS.md` and `apps/telegram-email-assistant/digest.sh`).
- **`google-shared/`** is the OAuth layer that ALL Google CLIs under `tooling/cli/` shim into (e.g. `tooling/cli/gmail/auth.py` imports from it). Load-bearing, must stay, and must stay at a path where `../mcp/google-shared` resolves from `tooling/cli/*` (root README: "kept a sibling of `cli/` so that relative path resolves").
- Candidates believed dead: `google-calendar-mcp-server`, `google-docs-mcp-server`, `google-task-mcp-server`, `google-sheets-mcp-server`, `youtube-mcp-server` (~2,500 LOC total). Status of `elevenlabs/` and `hostinger/` is **unknown** — investigate, don't assume.

### skills-lock.json (repo root)

Pins 15 hyperframes/GSAP skills to `github:heygen-com/hyperframes` with content
hashes. **Nothing in the repo references it** (verified: zero grep hits in
scripts/, tooling/, root docs) — it belongs to the separate `npx skills`
plugin mechanism, not the manifest/symlink system. This plan only *documents*
that split; do not build a reconciler.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Bash syntax | `bash -n scripts/relink.sh scripts/vps-sync.sh scripts/lib/skill-link.sh` | exit 0 |
| Relink dry run | `./scripts/relink.sh` | `work: N linked… / personal: N linked…`, no errors |
| Reference sweep | `grep -rn "<server-dir-name>" --include='*.py' --include='*.sh' --include='*.md' --include='*.json' --include='*.template' . \| grep -v node_modules \| grep -v '^./plans/'` | decides Step 4 |

## Scope

**In scope**:
- `scripts/relink.sh`, `scripts/vps-sync.sh`, create `scripts/lib/skill-link.sh`
- Delete: MCP server dirs **proven dead** in Step 4 (candidates listed above)
- `tooling/mcp/README.md`, `tooling/README.md`, `tooling/mcp/.mcp.json.template` (remove deleted servers)
- Add a `# STATUS:` banner line to surviving MCP servers' entry files
- `scripts/README.md`, `/decisions.md`

**Out of scope** (do NOT touch):
- `tooling/mcp/google-shared/` and `tooling/mcp/gmail-mcp-server/` — load-bearing, never delete or move in this plan.
- `tooling/mcp/google-drive-mcp-server/`, `cloudflare-mcp-server/` — live.
- `tooling/cli/**` (except reading), `tooling/claude-skills/**`, both manifest files.
- `skills-lock.json` — document it, don't modify it.
- `scripts/regen-mcp-json.sh` EXCEPT the minimal edit if it hardcodes a deleted server (check it).
- Anything on the VPS itself — script changes reach it via its own git pull.

## Git workflow

- Branch: `advisor/005-tooling-consolidation`
- Commits: `fix(scripts): …`, `chore(mcp): …` — one commit for the script fixes, one for the deletions (easy revert). No AI footers. Do NOT push.

## Steps

### Step 1: Extract the shared library

Create `scripts/lib/skill-link.sh` containing `resolve_src()`, `is_managed()`,
and a new `link_and_prune <account-label> <skills-dir> <manifest>` that both
entry scripts call. It must use only variables the callers export (`STORE`,
`AGENTS_DIR`). Source it from both scripts
(`. "$(dirname "${BASH_SOURCE[0]}")/lib/skill-link.sh"` — note vps-sync.sh
resolves `STORE` from `$REPO`, keep that).

**Verify**: `bash -n` all three files → exit 0. `diff <(grep -A4 'resolve_src()' scripts/relink.sh) <(true)` → resolve_src no longer defined in the entry scripts.

### Step 2: Fix the prune logic in the shared lib

In `link_and_prune`'s prune loop, prune a symlink when **either**:
1. it's managed AND its basename is not in the manifest (existing behavior), or
2. its target no longer exists (`[ -L "$e" ] && [ ! -e "$e" ]`) — dangling,
   regardless of manifest membership (covers the rename case).

Also: when one or more manifest entries had no source (`resolve_src` failed),
print a **summary line at the end** (`WARN: N manifest entries unresolved: foo bar`)
and exit with code 2 (distinct from hard failure 1) so cron/log grep can spot it.

**Verify**: simulate — `mkdir -p /tmp/skl-test/{store/real-skill,links}`, create
a manifest with `real-skill` + `ghost-skill`, link once, then rename
`store/real-skill` to `store/renamed`; re-run; the stale `real-skill` link must
be pruned and exit code must be 2. Clean up `/tmp/skl-test`.

### Step 3: Harden vps-sync.sh

1. Wrap the whole body in `flock`: `exec 9>/tmp/vps-sync.lock; flock -n 9 || { echo "another run in progress"; exit 0; }` near the top.
2. On `git pull` failure: keep the soft-fail, but send a notification via the
   local ntfy server and write a marker file:
   `date > /tmp/vps-sync-pull-failed` on failure, `rm -f` it on success; on
   failure also `curl -fsS -d "vps-sync: git pull failed on $(hostname)" http://localhost:<ntfy-port>/<topic> || true`.
   Get the port/topic from `infra/docker/ntfy/` config or `VPS-CRONS.md`; if
   neither documents a topic, use the marker file only and note it in your report.

**Verify**: `bash -n scripts/vps-sync.sh` → 0. Run `./scripts/relink.sh` on
this machine → completes with the same linked counts as before your change
(compare against a pre-change run you record in Step 1).

### Step 4: Prove each MCP candidate dead, then delete

For EACH of `google-calendar-mcp-server`, `google-docs-mcp-server`,
`google-task-mcp-server`, `google-sheets-mcp-server`, `youtube-mcp-server`,
`elevenlabs`, `hostinger` — run the reference sweep (see commands table) plus:

```bash
grep -n "<name>" tooling/mcp/.mcp.json.template scripts/regen-mcp-json.sh VPS-CRONS.md 2>/dev/null
cat .mcp.json 2>/dev/null | grep -n "<name>"   # local machine-generated config
```

Decision rule: delete ONLY if all sweeps are clean (no hits outside the
server's own dir, `tooling/mcp/README.md` prose, and this plans/ dir). Any hit
in `VPS-CRONS.md`, `apps/`, `tooling/cli/`, `scripts/`, or a `.mcp.json*` = NOT dead → keep, add
`# STATUS: retired? referenced by <what> — investigate` banner instead.
`git rm -r` the proven-dead dirs.

**Verify**: after deletion — `ls tooling/mcp/` shows survivors only;
`python3 -c "import sys; sys.path.insert(0,'tooling/cli/gmail'); import auth"`
(or the equivalent import-smoke the CLI README documents) still resolves
`google-shared`; re-run the full sweep for each deleted name → no dangling references
except historical mentions in `decisions.md`/`plans/`.

### Step 5: Make the boundary structural for survivors

Add as line 1-3 of each surviving server's entry file (`server.py` or equivalent):

```python
# STATUS: LIVE — wired into .mcp.json (regen-mcp-json.sh)            # drive, cloudflare
# STATUS: LEGACY-LOAD-BEARING — used by VPS gmail-digest cron; NOT in .mcp.json  # gmail
# STATUS: SHARED-AUTH — imported by all tooling/cli google CLIs; do not move     # google-shared (README or __init__)
```

Rewrite `tooling/mcp/README.md` to a short table: server / status / used-by /
"delete blocked by". Update `tooling/README.md`'s mcp line and
`.mcp.json.template` (drop deleted servers).

**Verify**: `grep -rln "STATUS:" tooling/mcp/*/ | wc -l` → equals the number of surviving servers.

### Step 6: Document skills-lock.json + record decisions

- In `tooling/README.md` (or `tooling/claude-skills/CLAUDE.md` if more apt —
  read both, pick the one that already discusses skill management): add 3
  lines explaining the two mechanisms: manifest+relink (repo-owned skills) vs
  `skills-lock.json` + `npx skills` (github-sourced hyperframes/GSAP skills);
  neither reads the other.
- `/decisions.md`: append
  `2026-07-04 — MCP graveyard cleaned: <deleted list> removed; gmail-mcp-server + google-shared kept (load-bearing: VPS digest cron + CLI OAuth) with STATUS banners; skill-sync logic extracted to scripts/lib/skill-link.sh with dangling-link pruning + vps-sync flock/pull-failure alert.`
  (Fill in the actual deleted list.)

**Verify**: `head -8 decisions.md` shows the line with the real names.

## Test plan

- Step 2's /tmp simulation is the regression test for the prune fix — include its transcript in the report.
- `./scripts/relink.sh` before/after: identical linked counts (record both).
- Step 4's per-server sweep results: paste the decision table (server → hits → verdict) into the report.

## Done criteria

- [ ] `bash -n` passes on all three scripts; shared functions exist only in the lib
- [ ] Rename simulation prunes the dangling link and exits 2
- [ ] `relink.sh` linked counts unchanged from baseline
- [ ] Proven-dead servers deleted; every survivor has a STATUS banner; README table matches reality
- [ ] `.mcp.json.template` contains no deleted server
- [ ] gmail CLI import-smoke still passes
- [ ] decisions.md appended; `plans/README.md` row updated

## STOP conditions

- The sweep finds `google-sheets-mcp-server` or `youtube-mcp-server` referenced
  from a cron or CLI — the audit believed them dead; report the reference.
- `VPS-CRONS.md` describes gmail-digest invoking a *different* path than
  `tooling/mcp/gmail-mcp-server/` — the load-bearing map is wrong; report.
- `relink.sh` linked counts change after your refactor — behavior regression; revert and report.
- You cannot determine ntfy's topic/port — skip the curl (marker file only) and note it; do NOT invent a topic.

## Maintenance notes

- The VPS picks these script changes up via its own 15-min sync — but the
  *running* vps-sync.sh is the old copy during the first tick after merge;
  harmless (old logic, one more run).
- Future skill renames: rename the store folder AND the manifest line in the
  same commit; the new dangling-prune is the backstop, not the process.
- Deferred: migrating gmail-digest off the legacy MCP server onto
  `tooling/cli/gmail` (would let gmail-mcp-server retire fully) — worth its own
  small plan later.

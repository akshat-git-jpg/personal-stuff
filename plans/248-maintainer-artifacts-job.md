---
executor: agy
model:
test_cmd: bash tooling/maintainer/test-maintainer.sh
ui:
deploy:
needs: ["242 (the frame) and video-identity 240 (card_id on registry entries) must land first"]
needs_prs: [203, 201]
touches: [tooling/maintainer/jobs/artifacts/README.md, tooling/maintainer/jobs/artifacts/runbook.md, tooling/maintainer/jobs/artifacts/check.sh, tooling/maintainer/CLAUDE.md, tooling/maintainer/test-maintainer.sh]

mutation_apply: python3 -c "import io;p='tooling/maintainer/jobs/artifacts/check.sh';s=io.open(p,encoding='utf-8').read();s=s.replace('PUBLISHED','PUBLISHT',1);io.open(p,'w',encoding='utf-8').write(s)"
mutation_command: bash tooling/maintainer/test-maintainer.sh
mutation_expect: artifacts check did not report the seeded published video
mutation_timeout: 300
---

# Plan 248: the artifacts job — a published video's leftovers

## Summary

- **Problem statement**: once a video is published, its script and edit folders sit in the
  repo forever, and its renders sit on disk forever. Nothing knows a video shipped, so
  nothing ever proposes clearing it.
- **Goals**: add `jobs/artifacts/`, which joins the video registry to the tracker to find
  published videos, then lists their tracked folders and their untracked local renders as
  **archive candidates**.
- **Executor proposed**: `agy` / Gemini 3.1 Pro (High) — this proposes removing real work
  products, so it goes to the executor with the landed track record.
- **Done criteria** (terse): `test-maintainer.sh` exit 0; `discover_jobs` finds `artifacts`;
  the check reports a seeded published video and does not report an unpublished one.
- **Stop conditions** (terse): **never delete or move anything** — this job only reports;
  never treat "no tracker data" as published; never `rm` a render.
- **Test / verification for success**: the check runs against a **fixture** registry and a
  fixture tracker response; no network call in any test.
- **Open points for plan readiness**: none.

> **Executor instructions**: Follow this plan step by step. Run every verification command
> and confirm the expected result before moving on. If anything in the "STOP conditions"
> section occurs, stop and report. When done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 36b2519..HEAD -- tooling/maintainer/ pipelines/video-registry/`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: 242, and video-identity 240 (PR#201)
- **Category**: feature
- **Difficulty**: standard
- **Planned at**: commit `36b2519`, 2026-08-25

## Why this matters

Measured 2026-08-25: `pipelines/video/visuals-flow/videos/*` holds 6 folders at 0.5–1.5 MB
each; `pipelines/youtube/yt-script/videos/*` holds 5 at 14–77 KB. So the tracked win is a few
MB — this job reclaims **noise, not disk**. The number it improves is 5,863 tracked files.

The larger win is **local**: visuals-flow workdirs carry render caches and assembly caches
that are gitignored and never cleaned.

## Current state

### How "published" is known — only after plan 240

`pipelines/video-registry/videos.json` entries carry `card_id` after video-identity plan 240.
The tracker card holds the upload stage's state: `yt_upload_status` and `yt_link` (see
`apps/tutorial-tracker-app/src/shared/columns.ts`). A card with an upload link and a done
upload status is published.

`pipelines/video-registry/lib/tracker.mjs` (also from plan 240) already knows how to read
`tracker-db` over the Cloudflare D1 HTTP API using `CF_ACCOUNT_ID` and `CF_API_TOKEN` from
`pipelines/.env`. **Reuse it. Do not write a second D1 client.**

### Where a video's folders are

`lib/registry.mjs`'s `whereIs(key)` already answers "which pipelines have a folder for this
video, and what is each named on disk" — and it looks under the canonical key **and every
alias**, because a folder genuinely may still sit under an old name (`decisions.md`
2026-08-09). Use it; do not glob the directories yourself.

### The rule that governs everything here

`commit-now`'s rule 9: *"Renders are gitignored on purpose and cannot be recovered from git.
Folder persistence is what protects them."*

So a local removal is a **move** to `$ARCHIVE_ROOT/<date>-artifacts/<original relative path>`,
never an `rm`. And this job does not even move — it reports. The move happens in the session
after approval.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Test suite (merge gate) | `bash tooling/maintainer/test-maintainer.sh` | exit 0, `ALL PASS` |
| Run the job | `bash tooling/maintainer/bin/run-job.sh artifacts` | exit 0 or 1, never 2 |
| Registry keys | `cd pipelines/video-registry && node bin/vreg.mjs list` | one line per video |
| Where a video lives | `cd pipelines/video-registry && node bin/vreg.mjs where <key>` | its folders |

## Scope

**In scope**:
- `tooling/maintainer/jobs/artifacts/{README.md,runbook.md,check.sh}` (new)
- `tooling/maintainer/CLAUDE.md` — flip the artifacts row to live
- `tooling/maintainer/test-maintainer.sh` — artifacts assertions

**Out of scope**:
- **Deleting or moving anything.** This job reports only. No `rm`, no `mv`, not even to the
  archive.
- `pipelines/video-registry/` — reuse `lib/registry.mjs` and `lib/tracker.mjs` unchanged.
  If you think you need to change them, plan 240 owns them; stop and report.
- The tracker app.
- Any `videos/` directory — never created, renamed, moved or deleted (`decisions.md`
  2026-08-09).
- `test-01` — a pipeline test fixture with no tracker card. Never a candidate.
- No `fix.sh`: there is no zero-judgement repair when the action is removing someone's work.

## Git workflow

- Branch: `advisor/248-maintainer-artifacts-job`
- Commit: `feat(maintainer): the artifacts job` — no AI footers. Do NOT push.

## Steps

### Step 1: `jobs/artifacts/check.sh`

```bash
#!/bin/bash
# artifacts — which published videos still have leftovers.
# Reports ONLY. Deletes nothing, moves nothing.
# Exit 0 = nothing found, 1 = findings, 2 = a check itself broke.
#
# ARTIFACTS_REGISTRY and ARTIFACTS_CARDS point at fixtures (JSON files), so the
# test never touches the network.
set -uo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")/../../bin" && pwd)/lib.sh"

REG="${ARTIFACTS_REGISTRY:-$REPO_ROOT/pipelines/video-registry/videos.json}"
CARDS="${ARTIFACTS_CARDS:-}"          # a JSON file of tracker cards; empty = fetch live

found=0
note() { echo "- $1"; found=1; }

echo "# artifacts findings — $(today)"
echo

[ -f "$REG" ] || die "no registry at $REG"

if [ -z "$CARDS" ]; then
  CARDS="$FINDINGS_DIR/$(today)-artifacts-cards.json"
  ( cd "$REPO_ROOT/pipelines/video-registry" \
    && node -e "import('./lib/tracker.mjs').then(async m=>{const r=await m.fetchCards();process.stdout.write(JSON.stringify(r))})" ) \
    > "$CARDS" 2>/dev/null || {
      echo "## could not read tracker-db"
      echo "- NOT CHECKED. Needs CF_ACCOUNT_ID and CF_API_TOKEN (pipelines/.env)."
      echo "  No tracker data means NOTHING is published as far as this job is concerned."
      exit 0
    }
fi

echo "## published videos with leftovers still in the repo"
python3 - "$REG" "$CARDS" <<'PY'
import json, io, sys, os
reg = json.load(io.open(sys.argv[1]))
cards = json.load(io.open(sys.argv[2]))
by_id = {str(c.get("id")): c for c in cards}

def published(c):
    # BOTH must hold. A link with no done status is a draft; a done status with no
    # link is a bookkeeping slip. Either alone is NOT proof a video shipped.
    link = (c.get("yt_link") or "").strip()
    status = (c.get("yt_upload_status") or "").strip().lower()
    return bool(link) and status in ("done", "published", "complete")

for key, e in sorted((reg.get("videos") or {}).items()):
    if key == "test-01":
        continue                      # a pipeline fixture, never a candidate
    cid = str(e.get("card_id") or "")
    if not cid or cid not in by_id:
        print("- NO-CARD %s (registry entry has no tracker card — cannot tell, not a candidate)" % key)
        continue
    if published(by_id[cid]):
        print("- PUBLISHED %s (%s)" % (key, (by_id[cid].get("yt_link") or "").strip()))
PY
echo

echo "## where each published video's folders are"
echo "(from vreg where — it looks under the canonical key AND every alias, because a"
echo " folder may still sit under an old name.)"
echo

echo "## untracked local renders (archive candidates, NEVER rm)"
git -C "$REPO_ROOT" status --porcelain --ignored 2>/dev/null \
  | "$AWK" '$1=="!!"{print $2}' \
  | "$GREP" -E 'videos/|renders?/|Output/' || true
echo
echo "  A gitignored render has NO copy in git. Removing one is a MOVE to"
echo "  $ARCHIVE_ROOT/<date>-artifacts/, never an rm, and only after approval."

exit $found
```

Three properties that must not be relaxed:

- **`published()` requires BOTH a link and a done status.** A link alone is a draft upload; a
  done status alone is a bookkeeping slip. Either alone would propose deleting a live video's
  working files.
- **No tracker data means nothing is published.** The failure mode must be "cannot tell", not
  "assume shipped". A `NO-CARD` entry prints but is not a candidate.
- **`test-01` is skipped by name.** It is a pipeline fixture with no card, and every run would
  otherwise flag it forever.

**Verify**: `bash tooling/maintainer/bin/run-job.sh artifacts` -> exit 0 or 1, never 2.

### Step 2: README and runbook

`README.md` — one screen: what makes a video published, that this job only reports, and that
local renders are archived rather than deleted.

`runbook.md` — the procedure, plus the three standing rules above, plus the measured sizes
(0.5–1.5 MB per visuals-flow video, 14–77 KB per yt-script video) so nobody expects this to
reclaim disk from git. And the reminder that the archive path is
`~/pp-maintainer-archive/<date>-artifacts/`, outside the repo, so it can never affect a clone
or a land.

Flip the artifacts row in `tooling/maintainer/CLAUDE.md` to live.

### Step 3: Tests, against fixtures

```bash
# --- artifacts job: fixture registry + fixture cards, no network ------------
AFIX="$TMP/artfix"; mkdir -p "$AFIX"
cat > "$AFIX/registry.json" <<'EOF'
{"version":1,"videos":{
  "shipped-video":{"title":"Shipped","minted":"2026-07-01","aliases":[],"card_id":"row_1"},
  "still-editing":{"title":"WIP","minted":"2026-08-01","aliases":[],"card_id":"row_2"},
  "no-card-video":{"title":"Orphan","minted":"2026-08-01","aliases":[]},
  "test-01":{"title":"fixture","minted":"2026-07-18","aliases":[],"card_id":"row_3"}
}}
EOF
cat > "$AFIX/cards.json" <<'EOF'
[ {"id":"row_1","yt_link":"https://youtu.be/abc","yt_upload_status":"Done"},
  {"id":"row_2","yt_link":"","yt_upload_status":"In Progress"},
  {"id":"row_3","yt_link":"https://youtu.be/zzz","yt_upload_status":"Done"} ]
EOF

out="$(ARTIFACTS_REGISTRY="$AFIX/registry.json" ARTIFACTS_CARDS="$AFIX/cards.json" \
       bash "$MAINTDIR/jobs/artifacts/check.sh" 2>&1)"
echo "$out" | grep -q 'PUBLISHED shipped-video' || fail "artifacts check did not report the seeded published video"
echo "$out" | grep -q 'PUBLISHED still-editing' && fail "artifacts check flagged an unpublished video"
echo "$out" | grep -q 'PUBLISHED test-01'       && fail "artifacts check flagged the test fixture"
echo "$out" | grep -q 'NO-CARD no-card-video'   || fail "artifacts check did not report the card-less entry"

# a link with no done status must NOT count as published
cat > "$AFIX/cards2.json" <<'EOF'
[ {"id":"row_1","yt_link":"https://youtu.be/abc","yt_upload_status":"In Review"} ]
EOF
out2="$(ARTIFACTS_REGISTRY="$AFIX/registry.json" ARTIFACTS_CARDS="$AFIX/cards2.json" \
        bash "$MAINTDIR/jobs/artifacts/check.sh" 2>&1)"
echo "$out2" | grep -q 'PUBLISHED shipped-video' && fail "a draft upload was treated as published"
```

The `artifacts check did not report the seeded published video` string is what the mutation
gate asserts on. Do not reword it.

**Verify**: `bash tooling/maintainer/test-maintainer.sh` -> exit 0, `ALL PASS`.

### Step 4: Commit

```bash
git add tooling/maintainer/jobs/artifacts tooling/maintainer/CLAUDE.md tooling/maintainer/test-maintainer.sh
git commit -m "feat(maintainer): the artifacts job"
```

Do not push.

## Test plan

Everything runs against **fixture** JSON — a fixture registry and a fixture card list — so no
test touches `tracker-db` and the assertions do not change meaning as real videos ship.

Four assertions run in both directions: published is flagged, unpublished is not, the fixture
is skipped, and a card-less entry reports as "cannot tell".

The fifth is the one that matters most: **a link with no done status must not count as
published.** That is the assertion standing between this job and a proposal to delete a live
video's working files.

## Done criteria

- [ ] `bash tooling/maintainer/test-maintainer.sh` -> exit 0, `ALL PASS`
- [ ] `discover_jobs` includes `artifacts`
- [ ] `bash tooling/maintainer/bin/run-job.sh artifacts` -> exit 0 or 1, never 2
- [ ] `grep -rcE '\brm\b|\bmv\b' tooling/maintainer/jobs/artifacts/check.sh` -> `0`
- [ ] `grep -c 'test-01' tooling/maintainer/jobs/artifacts/check.sh` -> at least `1`
- [ ] `grep -c 'pp-maintainer-archive\|ARCHIVE_ROOT' tooling/maintainer/jobs/artifacts/check.sh` -> at least `1`
- [ ] The job writes no second D1 client:
      `grep -c 'api.cloudflare.com' tooling/maintainer/jobs/artifacts/check.sh` -> `0`
- [ ] Running the job modifies no `videos/` directory: `git status --porcelain` clean
- [ ] `ls tooling/maintainer/jobs/artifacts/fix.sh` -> does not exist

## STOP conditions

- **You are about to delete or move any file.** This job reports. The move happens in a
  session after approval, and it is always a move to `$ARCHIVE_ROOT`, never an `rm`.
- **You are about to treat a missing tracker card as "published".** The failure mode must be
  "cannot tell". Getting this backwards proposes deleting live work.
- **You are about to accept a `yt_link` alone as proof of publication.** A draft upload has a
  link. Both the link and a done status are required.
- **You are about to rename or delete a `videos/` directory.** Forbidden — `decisions.md`
  2026-08-09: workdirs embed the slug in render caches, assembly caches and ledger keys.
- **You are about to write a second Cloudflare D1 client.** `lib/tracker.mjs` from plan 240
  already exists. Two clients drift.
- **`card_id` is missing from every registry entry.** Plan 240 has not landed. Stop and
  report; do not add the field yourself.
- **A gate assertion fails and you want to change it.** Fix the code (LESSONS 2026-07-31).
- **`check.sh` exits 2.** The check broke. Never report it clean.

## Maintenance notes

- This job is the sharp end of the whole agent: it proposes removing real work products.
  Every safety property above exists because the cost of a wrong proposal is someone's
  renders, which have no copy in git.
- Tracked artifacts are a few MB. The real win is untracked renders and 5,863 → fewer tracked
  files. Do not oversell it as disk reclamation.
- If a future plan wants this scheduled, it must stay report-only on a schedule — the
  approval step is not optional here more than anywhere else.

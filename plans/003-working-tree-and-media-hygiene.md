# Plan 003: Get generated artifacts out of the working tree and stop media accretion in git

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. This plan is **investigation-first**: Steps 1 and 4 decide what
> Steps 2–3 and 5 may touch. If anything in the "STOP conditions" section
> occurs, stop and report — do not improvise. When done, update the status row
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 630ca99..HEAD -- .gitignore ty/video-voice ty/hyperframes-vs-remotion docs/`
> On any in-scope drift, re-verify the "Current state" facts before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (moving dirs that local pipelines reference)
- **Depends on**: none (but do it before any big new video/voice work)
- **Category**: tech-debt / dx
- **Planned at**: commit `630ca99`, 2026-07-04

## Why this matters

The git repo is lean (`.git` = 52MB, 1,673 tracked files) but the **working
tree is ~18GB**: `ty/` = 12GB (almost all `ty/video-voice/tts-flow/` model
weights, venvs, and render outputs), `docs/voice-pipeline-test/` = 3.3GB
(3,894 untracked files), `apps/` = 2.7GB (mostly node_modules). All of it is
correctly gitignored — the problem is that every `find`/`grep`/glob an agent or
editor runs walks these trees, which is one of the two confirmed causes of the
owner's "Claude is slow to navigate" complaint. Separately, 108 binaries ARE
tracked in git and accrete monotonically (every rendered MP4 variant, every
Pinterest pin image, every voiceover MP3 committed forever); the worst cluster
is ~20 MP4s inside `ty/hyperframes-vs-remotion/` — a project `ty/CLAUDE.md`
itself marks "superseded".

## Current state

Verified facts (2026-07-04):

- `du -sh`: `ty/` 12G · `docs/voice-pipeline-test/` 3.3G · `apps/` 2.7G · `tooling/` 120M.
- `ty/video-voice/` holds 590 files: 222 `.py`, 145 `.wav`, 24 `.mp3`, 16 `.mp4` (plus gitignored `engines/`, `.venv/`, model weights).
- `docs/voice-pipeline-test/` has only **4 tracked files**; the other ~3,890 are untracked experiment artifacts (`models/`, `.venv/`, `work/` per the gitignore).
- Largest **tracked** files (`git ls-files | xargs du -k | sort -rn`):
  - `ty/pinterest/keto/posts/2026-06-02-7-day-keto-pathway/image.png` (4.7MB)
  - `ty/video-voice/RVC-flow/output/egirl_voiceover_pitch+7.mp3` and `+12.mp3` (3.7MB each)
  - `ty/hyperframes-vs-remotion/yt-visuals/cutaways/n8n-hosting/**` — ~20 MP4s, 0.5–2.7MB each (`title-variants/`, `comparison-variants/`, `verdict-variants/`, `00-preview-all.mp4`)
  - `ty/youtube/kushal-tutorial-pipeline-v2/shared/ref/jamila-30s.wav` (1.3MB)
- Root `.gitignore` already covers: `secrets/`, `**/.env`, `.venv/`, `__pycache__/`, `build/`, `dist/`, `*.bak`. It has **no rule for render outputs or media**.
- Policy decided by the advisor (owner delegated):
  - **Inputs/reference assets stay tracked** (e.g. `jamila-30s.wav` is a reference voice sample; Pinterest `posts/*/image.png` are product artifacts read by the posting workflow on other machines — keep).
  - **Outputs/renders get untracked + ignored** going forward (`git rm --cached`, keep on disk). **No history rewrite** — 52MB is fine; the goal is stopping accretion.
  - **Heavy untracked artifact dirs move out of the repo** to `~/kb-scratch/<project>/` with an env-var/config indirection ONLY where code references them; unreferenced ones just move.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Size audit | `du -sh ty/video-voice docs/voice-pipeline-test` | see baseline above |
| Tracked-binary count | `git ls-files \| grep -cE '\.(png\|mp4\|mp3\|wav\|jpg\|gif\|pdf)$'` | 108 baseline, lower after |
| Reference sweep | `grep -rn "<dirname>" --include='*.py' --include='*.mjs' --include='*.json' --include='*.md' --include='*.sh' ty/ docs/ \| grep -v node_modules` | informs each move |

## Scope

**In scope**:
- `/.gitignore` (add rules)
- `git rm --cached` on the specific tracked files listed in Step 2 (files stay on disk)
- Moving **untracked** artifact dirs under `docs/voice-pipeline-test/` and `ty/video-voice/` to `~/kb-scratch/…`
- Small path-indirection edits in `ty/video-voice/**` scripts *only where Step 4's sweep proves a moved dir is referenced* (env var with the old path as documented default)
- `ty/video-voice/README.md` + `docs/README.md` one-line notes about the new artifact location
- `/decisions.md` (append)

**Out of scope** (do NOT touch):
- Anything under `apps/` (node_modules are normal), `tooling/`, `infra/`, `learning/`.
- Pinterest `posts/*/image.png` — tracked on purpose (product artifacts).
- Reference/input media (`shared/ref/`, sample files under `ty/video-voice/**/samples/` or similar).
- Git history — NO rebase/filter-repo/BFG.
- Deleting anything. This plan moves and untracks; it never deletes.

## Git workflow

- Branch: `advisor/003-working-tree-hygiene`
- Commit style: `chore(repo): …` (matches history). No AI footers. Do NOT push.

## Steps

### Step 1: Inventory the heavy untracked dirs

```bash
du -sh docs/voice-pipeline-test/* | sort -rh | head -15
du -sh ty/video-voice/*/ ty/video-voice/*/*/ 2>/dev/null | sort -rh | head -20
git status --porcelain docs/voice-pipeline-test ty/video-voice | head   # confirm untracked (??) or clean
```

Record the list of dirs ≥ 100MB. For each, note whether `git check-ignore -v <dir>` says it's ignored (expected for models/venvs/outputs).

**Verify**: you have a written list of candidate dirs, each tagged ignored/untracked, none tracked.

### Step 2: Untrack render outputs (files stay on disk)

```bash
git rm --cached ty/video-voice/RVC-flow/output/egirl_voiceover_pitch+7.mp3 \
                ty/video-voice/RVC-flow/output/egirl_voiceover_pitch+12.mp3
git rm -r --cached ty/hyperframes-vs-remotion/yt-visuals/cutaways/n8n-hosting/title-variants \
                   ty/hyperframes-vs-remotion/yt-visuals/cutaways/n8n-hosting/comparison-variants \
                   ty/hyperframes-vs-remotion/yt-visuals/cutaways/n8n-hosting/verdict-variants
git rm --cached "ty/hyperframes-vs-remotion/yt-visuals/cutaways/n8n-hosting/00-preview-all.mp4"
```

Before running, list what each command will hit with `git ls-files <path>` —
if a path contains a non-MP4 source file (e.g. `.html`), untrack only the media
files, not the folder. Also sweep for other pure-output tracked media:
`git ls-files | grep -E '/output/.*\.(mp3|wav|mp4)$'` — untrack those too.

**Verify**: `git ls-files | grep -cE '\.(png|mp4|mp3|wav|jpg|gif|pdf)$'` → noticeably below 108; `ls ty/video-voice/RVC-flow/output/` still shows the files on disk.

### Step 3: Add gitignore rules for future outputs

Append to `/.gitignore` under a new comment block `# Rendered/generated media — outputs are rebuildable, never commit`:

```
ty/video-voice/**/output/
ty/hyperframes-vs-remotion/yt-visuals/cutaways/**/*.mp4
docs/voice-pipeline-test/
```

Deliberately narrow — a global `**/*.mp4` would swallow future *input* assets.

**Verify**: `git check-ignore -q ty/video-voice/RVC-flow/output/egirl_voiceover_pitch+7.mp3 && echo IGNORED` → IGNORED. `git status` shows no `ty/hyperframes-vs-remotion` media as untracked.

### Step 4: Reference sweep before any move

For each ≥100MB dir from Step 1 (expect: model/engine dirs and `.venv`s under
`ty/video-voice/tts-flow/`, and `docs/voice-pipeline-test/{models,work,.venv}`):

```bash
grep -rn "$(basename <dir>)" --include='*.py' --include='*.mjs' --include='*.sh' --include='*.json' --include='*.md' ty/video-voice docs/voice-pipeline-test | grep -v node_modules
```

Classify each dir: **UNREFERENCED** (no code path mentions it — safe to move),
**RELATIVE-REF** (a script builds the path relative to itself — needs env-var
indirection), or **VENV** (leave in place OR move+note; a venv is rebuildable —
prefer: leave `.venv` dirs where they are, they're already ignored, and moving
them breaks their internal shebangs).

**Verify**: every candidate dir has a classification written down.

### Step 5: Move UNREFERENCED and RELATIVE-REF dirs

```bash
mkdir -p ~/kb-scratch/voice-pipeline-test ~/kb-scratch/video-voice
```

- UNREFERENCED: `mv <dir> ~/kb-scratch/<project>/<dirname>` — done.
- RELATIVE-REF: move it, then edit the referencing script(s) to read the
  location from an env var with a sensible default, e.g. in Python:
  `MODELS_DIR = os.environ.get("VV_MODELS_DIR", os.path.expanduser("~/kb-scratch/video-voice/models"))`
  — one variable per script, minimal diff, keep the script's existing style.
- VENV dirs: leave in place (rebuildable, ignored, and shebang-fragile).
- Add one line to `ty/video-voice/README.md` and `docs/README.md`:
  "Heavy generated artifacts (models, render outputs) live outside the repo in `~/kb-scratch/<project>/` — see plans/003."

**Verify**: `du -sh docs/voice-pipeline-test ty/video-voice` → docs one drops
to MBs; video-voice drops substantially (venvs may keep it in the GB range —
report the numbers). If a RELATIVE-REF script has a cheap smoke command (e.g.
`python3 <script> --help`), run it from `ty/` with the venv active to prove the
import/path still resolves.

### Step 6: Record the policy

Append to `/decisions.md`:
`2026-07-04 — media policy: inputs/reference assets are tracked; render outputs are gitignored+untracked (git rm --cached, no history rewrite); heavy generated artifacts (models, work dirs) live outside the repo in ~/kb-scratch/ — the working tree was 18GB and every agent search walked it.`

**Verify**: `head -8 decisions.md` shows the line.

## Test plan

No test suite applies. The verification matrix:
- `git ls-files | grep -E '/output/'` → no media hits
- `git status` → clean except intended changes
- baseline vs post `du -sh` numbers recorded in your report
- any edited script smoke-run passes (Step 5)

## Done criteria

- [ ] Tracked-binary count reduced; zero tracked files under any `output/` dir
- [ ] `.gitignore` has the three new rules; check-ignore verifies
- [ ] `docs/voice-pipeline-test` ≤ 50MB on disk
- [ ] Every moved dir classified in the report; no RELATIVE-REF script left pointing at a moved path
- [ ] Nothing deleted (moved files exist under `~/kb-scratch/`)
- [ ] decisions.md line appended; `plans/README.md` row updated

## STOP conditions

- A candidate dir turns out to be **tracked** in git (Step 1 shows it in `git ls-files`) — the plan assumed untracked; report it.
- The Step 4 sweep shows a dir referenced from **outside** `ty/video-voice/` or `docs/voice-pipeline-test/` (e.g. from `apps/hyperframes-render` or a VPS cron doc) — cross-boundary coupling, report before moving.
- More than ~5 scripts need the env-var indirection for one dir — that's a config-file refactor, not this plan.
- You're tempted to add a global `*.mp4`-style ignore — rejected; keep rules narrow.

## Maintenance notes

- Future video/voice projects should write outputs under an `output/` dir (now
  ignored by pattern) and keep models in `~/kb-scratch/` from day one.
- The VPS clone never had the untracked artifacts, so nothing changes there.
- If `ty/hyperframes-vs-remotion` (marked superseded in `ty/CLAUDE.md`) is ever
  archived wholesale, its remaining tracked media can go with it — deferred.
- Reviewer: check the `git rm --cached` diff carefully — it must contain ONLY
  media files, no source.

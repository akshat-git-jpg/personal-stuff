# runbook: diskspace

## Procedure

```bash
bash tooling/maintainer/bin/run-job.sh diskspace
```

Then the four beats as usual: propose, approve, apply. Apply is one path at a time.

```bash
bash tooling/maintainer/jobs/diskspace/fix.sh <path>            # dry run
bash tooling/maintainer/jobs/diskspace/fix.sh <path> --commit   # act
```

## Knobs

| Variable | Default | What it does |
|---|---|---|
| `DISKSPACE_ROOT` | this repo | scan somewhere else — read by BOTH scripts, so they never disagree on the target |
| `DISKSPACE_MIN_MB` | `50` | anything smaller is counted but not listed |
| `DISKSPACE_STALE_DAYS` | `30` | a DERIVED path younger than this is HELD, not proposed |

## Standing rules

1. **The classifier is an allowlist.** An unrecognised path is `UNCLASSIFIED`, and `fix.sh` refuses it. Teach `classify.sh` before acting; never act on a guess.
2. **`classify.sh` is the single copy.** `check.sh` sources it to report and `fix.sh` sources it to refuse. Do not inline either function into either script.
3. **`fix.sh` re-checks `git check-ignore` at the moment of acting.** A `.gitignore` edit between the check and the apply would otherwise let this delete tracked work.
4. **DERIVED is a move, never an `rm`.** It goes to `~/pp-maintainer-archive/<date>-diskspace/`, which is outside the repo and cannot affect a clone or a land.
5. **CACHE and REBUILD are the only classes that get deleted**, and REBUILD only with its command quoted in the proposal. A `rebuild_cmd` reading `UNKNOWN` is a blocker, not a footnote.
6. **A big number is not an argument.** The 2026-09-01 pass found 17 GB of video cache and 11 GB of unused model weights sitting next to 3.3 GB of screen recordings that exist nowhere else. Size ranked them; class decided them.

## The trap this job exists for

`git status --ignored` is not a list of junk. On 2026-09-01 the same list held:

- `apps/*/.dev.vars` — live Worker secrets
- `.mcp.json` — machine-local MCP config
- `apps/gym-app/seed.sql` and `apps/amul-watch/config.json`
- `pipelines/video/visuals-flow/videos/*/src/` — the owner's raw intro/body/conclusion recordings
- `videos/*/screen.mp4` — the VO-aligned screen capture each video is built on

None of those has a copy in git. `PIPELINE.md` says `screen.mp4` is *owner-provided*, which means the only way back is to record it again. They are all `KEEP` and they are never proposed.

## Why `bigfiles` does not already do this

`bigfiles` walks `git status --ignored` too, but its loop is `[ -f "$p" ] || continue` — files only. Directories are skipped, so the largest single item in the repo (`assembly-cache/`, 4.8 GB across thousands of small files) never appears in its report and no individual file inside it clears the 4 MB bar either. `bigfiles` guards the push limit and the pack; this job guards the laptop.

## Measured baseline (2026-09-01)

The pass that motivated this job, run by hand before the job existed:

| | before | after |
|---|---|---|
| working tree | 39 GB | 11 GB |
| gitignored | ~35 GB | 10 GB |

28 GB reclaimed. Where it went:

| what | size | class |
|---|---|---|
| `tts/engines/indextts2/checkpoints` | 11 GB | REBUILD — synth runs on Modal GPU; local was measured at RTF 32.7 and is unusable |
| `visuals-flow/videos/*/assembly-cache` | 7.6 GB | CACHE |
| `visuals-flow/videos/*/render-cache` | 4.0 GB | CACHE |
| `renders/` + mixed audio, 3 idle videos | 5.7 GB | DERIVED |

What survives at 10 GB: 4.1 GB of `node_modules` (REBUILD, kept — every app still gets worked on) and 3.2 GB of KEEP.

## First run, and the bug it found

The first real run printed every REBUILD row with its size and class and a **blank path**. Cause: the row file is tab-separated and the reader sets `IFS=$'\t'`, but tab is IFS *whitespace*, so bash collapses two adjacent tabs into one delimiter. Non-DERIVED rows wrote an empty age field, the two tabs around it collapsed, and the path shifted into `age`. The fix is a literal `-` for a missing age, never `""`.

The run also left `pipelines/video/tts/engines/indextts2/` (68 MB, the engine clone minus its weights) and `pipelines/video/intro-studio/videos/poc-01/qc/` (54 MB) as UNCLASSIFIED. That is the design working: both are real judgement calls, and the script declined to guess at either.

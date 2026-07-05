# Plan 034: `greenlight` — validation pipeline that lands green work on main

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fd8e0df..HEAD -- tooling/cli/greenlight/`
> (Changes under `tooling/cli/wt/` are expected — plan 033 ran first. Anything
> else outside this plan's scope: STOP.)

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH (it merges and pushes main)
- **Depends on**: 033 (`wt`)
- **Category**: dx
- **Executor**: antigravity
- **Difficulty**: tricky
- **Planned at**: commit `fd8e0df`, 2026-07-06

## Why this matters

Today "the agent says it's done" is where the owner becomes the bottleneck:
reading diffs, manually testing, deciding whether to merge. `greenlight` is a
pipeline that takes a finished change on a branch and takes it to main
hands-free when it deserves it: rebase → adversarial review (fresh context) →
test with evidence → docs pass → lint → merge to local main → **push origin
main** (owner decision 2026-07-06: "push on green") → phone notification.
Anything questionable parks for the owner instead.

Design adapted from `kunchenguid/no-mistakes` (studied 2026-07-06). We keep:
fresh one-shot agent per stage, the `auto-fix`/`ask-user`/`no-op` finding
triage, reviewer-assigned risk with "high never lands without a human",
empty-diff-after-rebase short-circuit, evidence artifacts. We drop: the git
remote proxy, daemon, SQLite, PR machinery (we merge locally — no PRs in this
repo), CI babysitting (no CI here; `check-apps.sh` is the gate).

## Current state

- Plan 033 delivered `tooling/cli/wt/wt` — `wt get --holder <label>` prints a
  worktree path on stdout; `wt return <path>` releases it. Read
  `tooling/cli/wt/README.md` before starting.
- Phone notify: `pp-ntfy send "<msg>"` (exit 0 = acked; exit 3 timeout and 2
  config error are non-fatal for us — log and continue).
- Repo checks: `./scripts/check-apps.sh` (exit 0 = pass;
  KNOWN_FAILING lint skips are expected), `bash -n` for scripts.
- Headless Claude: `claude -p "<prompt>" --output-format json` prints a JSON
  envelope; the assistant's text is in the `result` field. Exact usage-field
  names are discovered in Step 1.
- Default branch: `main`. The main checkout may be on a feature branch with
  the owner's uncommitted work at any time — greenlight must never assume it
  is clean or on main.
- Bash conventions: mirror `.claude/skills/orchestrate/scripts/watch-run.sh`
  (strict mode, small functions, stderr for narration).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Syntax check | `bash -n tooling/cli/greenlight/greenlight` | exit 0 |
| Headless probe | `claude -p 'Reply with exactly: {"ok":true}' --output-format json` | JSON envelope containing the text |
| Self-test | `bash tooling/cli/greenlight/test-greenlight.sh` | `ALL TESTS PASSED`, exit 0 |
| Notify probe | `pp-ntfy test` | exit 0 |

## Scope

**In scope**:
- `tooling/cli/greenlight/greenlight` (new — driver)
- `tooling/cli/greenlight/prompts/{review,test,docs,lint}.md` (new — stage prompts)
- `tooling/cli/greenlight/test-greenlight.sh` (new)
- `tooling/cli/greenlight/README.md` (new)

**Out of scope**:
- `tooling/cli/wt/` (consume only), `scripts/*` (call only), any app/pipeline
  code. Never edit the repo's product code — greenlight operates ON branches,
  its own source is all this plan touches.

## Git workflow

- Branch: `advisor/034-greenlight`
- Commit per step: `feat(greenlight): <step>` — no AI footers. Do NOT push.
  (Greenlight itself pushes main at runtime; the executor building it never
  pushes.)

## Steps

### Step 1: Discover the `claude -p` JSON envelope shape

Run `claude -p 'Reply with exactly: {"ok":true}' --output-format json` and
record (in a comment block at the top of `greenlight`): the JSON path to the
assistant text (expected: `.result`) and the JSON paths holding input/output
token usage. Parse with `python3 -c 'import json,sys;...'` (jq is not a
guaranteed dependency; python3 is).

**Verify**: the probe command exits 0 and your documented paths extract
non-empty values via python3.

### Step 2: The driver skeleton and run state

`tooling/cli/greenlight/greenlight` implementing:

```
greenlight run --branch <name> [--repo <path>] [--intent "<text>"] [--skip <stage,stage>] [--no-land] [--reviewer-model sonnet]
greenlight status <run-id>
```

Token-economy rules (owner decision 2026-07-06): agent stages pass
`--model "$REVIEWER_MODEL"` to `claude -p`, defaulting to `sonnet` — review
must stay cheap. `--skip review` is a first-class path: plan-executed work
whose done criteria already passed orchestrate verification lands through
greenlight for merge+push only; the full review is for un-planned work
(captain crewmates, overnight branches) that has no authored done criteria.

- Run id: `<YYYYMMDD-HHMM>-<branch-slug>`. State dir:
  `~/kb-scratch/greenlight/<run-id>/` containing `state` (one word:
  `running|parked|landed|failed`), `log` (append-only, timestamped),
  `findings-<stage>.json`, `evidence/`, `intent.md`.
- Acquire an isolated worktree: `path=$(wt get --holder greenlight-<run-id>)`,
  `git -C "$path" checkout <branch>` — worktrees share the repo's refs, so the
  branch is visible. On any terminal exit path (`trap`), `wt return "$path"`.
  (Branch refs and commits survive the worktree reset — they live in the
  shared object store.)
- Intent: `--intent` verbatim if given, else use the branch's commit subjects:
  `git log --format='%s%n%b' origin/main..<branch>` written to `intent.md`.
  (No transcript mining in v1 — our callers, the captain and orchestrate,
  always know the intent and pass it.)
- Stage runner: a function `run_agent_stage <stage>` that invokes
  `claude -p "$(cat <prompts/stage.md with substitutions>)" --output-format json
  --dangerously-skip-permissions` with cwd = the worktree, extracts the text,
  validates it parses as JSON with the stage's required keys (python3), and
  retries ONCE with an appended "Your previous reply was not valid JSON
  matching the schema. Reply with ONLY the JSON object." on failure. Two
  invalid replies → the stage fails → run state `failed`, ntfy, stop.

**Verify**: `bash -n tooling/cli/greenlight/greenlight` → exit 0

### Step 3: Stages rebase → review → test → docs → lint

Implement in this fixed order (each appends to `log`; `--skip` omits agent
stages, never rebase or land):

1. **rebase** (pure git, no agent): `git fetch origin`, rebase the branch onto
   `origin/main`. Conflict → write conflicting files to
   `findings-rebase.json`, park (see Step 4). **If
   `git diff --quiet origin/main..HEAD` after rebase (empty diff), the run
   ends immediately as `landed` with log line `empty diff — nothing to do`**
   (no-mistakes' short-circuit).
2. **review** — prompt `prompts/review.md`. Author it with exactly these
   rules (adapted verbatim from no-mistakes): do a full pass, don't stop at
   the first finding; do NOT run tests; do NOT report styling/formatting/
   type-checking; no generic advice; anchor every finding to file + 1-indexed
   line. Required reply schema:
   ```json
   {"findings": [{"id": "r1", "severity": "error|warning|info",
     "file": "path", "line": 1, "description": "...",
     "action": "auto-fix|ask-user|no-op"}],
    "risk_level": "low|medium|high", "risk_rationale": "one sentence"}
   ```
   Action semantics to embed in the prompt: `auto-fix` = mechanical
   correctness/safety issue fixable without questioning the author's intent;
   `ask-user` = challenges intent or product behavior — **when in doubt,
   ask-user**. Fix loop: findings with `action: auto-fix` and severity
   error|warning are sent to a fix invocation (`prompts` reuse with a
   `FINDINGS_JSON` substitution; fix prompt rules: first double-check each
   finding is legitimate; root-cause over line-patch; never revert the
   author's intentional changes — fix forward). Commit fixes as
   `greenlight(review): <summary>`. Re-review. Cap 3 rounds; still-unresolved
   error findings after 3 → park.
3. **test** — prompt `prompts/test.md`: run the repo's relevant checks
   (`./scripts/check-apps.sh` always; app-specific test commands if the diff
   touches an app — the prompt tells the agent to read the touched app's
   CLAUDE.md for its test command), then exercise the change end-to-end per
   the intent, saving evidence (screenshots via a headless render, log
   excerpts, command transcripts) into `$EVIDENCE_DIR` (substituted; equals
   the run's `evidence/`). Reply schema:
   `{"passed": true|false, "tested": ["..."], "evidence": ["file", ...], "notes": "..."}`.
   `passed: false` → one fix round via the same fix mechanism, then park if
   still failing.
4. **docs** — prompt `prompts/docs.md`: find docs the diff makes stale
   (README/CLAUDE.md of touched folders, `my-hosted-sites.md`, `INFRA.md`),
   fix what is mechanical, commit as `greenlight(docs): ...`; reply
   `{"updated": [...], "unresolved": [...]}`; non-empty `unresolved` → park.
5. **lint** (pure commands, no agent): `bash -n` every changed `*.sh`;
   `python3 -m py_compile` every changed `*.py`; if changed files sit in an
   app with a lint script, run it (KNOWN_FAILING apps in `check-apps.sh` are
   exempt). Failures → one agent fix round, then park.

**Verify**: all four prompt files exist and each states its JSON reply schema:
`grep -l '"findings"' tooling/cli/greenlight/prompts/review.md` → the file

### Step 4: Land or park

- **Land** iff ALL: review left no unresolved error/ask-user findings; risk is
  `low` or `medium`; test `passed: true`; docs `unresolved` empty; lint green;
  `--no-land` not set. Landing procedure (the only part that touches the main
  checkout): `git -C <main-checkout> status --porcelain` must be empty AND
  current branch must be `main` — otherwise park with reason
  `main checkout busy` (never stash, never switch the owner's branch). Then:
  `git -C <main> merge --no-ff <branch> -m "greenlight: land <branch> (<run-id>)"`,
  `git -C <main> push origin main`, state `landed`,
  `pp-ntfy send "greenlight: <branch> landed on main (risk <level>)"`.
- **Park**: state `parked`, write `parked-reason` file listing the blocking
  findings verbatim, `pp-ntfy send "greenlight: <branch> parked — <n> findings need you"`.
  `risk_level: high` ALWAYS parks regardless of findings (hard rule).

**Verify**: `grep -n "push origin main" tooling/cli/greenlight/greenlight` →
exactly one occurrence, inside the land function.

### Step 5: Self-test

`test-greenlight.sh`: throwaway git repo with a `main` and a feature branch
(one clean commit), a stub `wt` and stub `claude` and stub `pp-ntfy` earlier
on `PATH` (the stub `claude` replays canned JSON envelopes from fixture files;
this tests the DRIVER, not the model). Assert: (a) empty-diff branch →
`landed` without invoking review; (b) canned review with an `ask-user`
finding → `parked` and ntfy stub called with "parked"; (c) canned all-green
run → merge commit present on stub main AND stub push invoked; (d) canned
`risk_level: high` all-green → `parked`; (e) `--no-land` green → state stays
`running`→ final `parked` with reason `--no-land`. Print `ALL TESTS PASSED`.

**Verify**: `bash tooling/cli/greenlight/test-greenlight.sh` →
`ALL TESTS PASSED`, exit 0

### Step 6: README

Contract, stage table, the land conditions verbatim, park semantics, evidence
location, provenance (adapted from kunchenguid/no-mistakes; dropped: remote
proxy/daemon/SQLite/PR+CI machinery; changed: local merge + push instead of
PR, intent from commits not transcripts).

**Verify**: `test -s tooling/cli/greenlight/README.md` → exit 0

## Test plan

Step 5's stub-driven self-test covers the state machine. A live end-to-end
run (real claude, trivial branch) is deliberately deferred to the
orchestrator's verification — the executor must NOT create test branches in
the real repo.

## Done criteria

- [ ] `bash -n` clean; self-test `ALL TESTS PASSED`
- [ ] Prompts contain the triage vocabulary: `grep -c "ask-user" tooling/cli/greenlight/prompts/review.md` ≥ 2
- [ ] High-risk-always-parks is enforced in code (test d passes)
- [ ] Land path checks main-checkout clean+on-main before merging (grep the
      status check adjacent to the merge call)
- [ ] `./scripts/check-apps.sh` exit 0

## STOP conditions

- You find yourself wanting greenlight to stash/checkout the owner's main
  checkout when it is busy — STOP; parking is the specified behavior.
- The `claude -p` envelope has no extractable usage/text fields — STOP and
  report the actual envelope.
- Any real branch in personal-stuff gets created/merged during your work —
  STOP (only the throwaway test repo may see merges).

## Maintenance notes

- The captain (plan 037) invokes `greenlight run --branch <b> --intent
  "$(cat brief)"` — the CLI contract above is load-bearing.
- The review-fix cap (3) and the land conditions are the safety envelope for
  auto-push; loosen only with a decisions.md entry.
- If pushes start failing (auth), greenlight parks with `push failed` — it
  never retries with force.

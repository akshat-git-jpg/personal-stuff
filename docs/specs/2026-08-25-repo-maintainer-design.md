# Repo maintainer — design

**Date:** 2026-08-25
**Status:** design approved, plans 242–249
**Sibling:** `2026-08-25-video-identity-design.md` (plan 248 depends on it)

An agent whose only job is keeping what already exists in good shape. It builds nothing.
It finds rot, reports it, and clears it once the owner says go.

---

## 1. Why an agent and not a cron

Two runbooks were written on 2026-08-25 and both end with the same request.

`memory-maintenance.md` §8: *"The promote habit is unenforced. Nothing reminds anyone to
move a month-old fact into the repo. That lapsing is exactly how 22 notes piled up in one
store. A repo-maintainer agent running this runbook on a schedule is the intended fix."*

But a cron cannot do the part that matters. `memory-maintenance.md` §9: *"Do **not** try to
automate step 4 of the audit. Deciding whether a fact still earns its place needs code
verification and judgement, and the false-positive rate on any description-matching
heuristic was 7 in 8."*

So the work splits in two, and that split is the whole design:

| Half | Who | Output |
|---|---|---|
| **mechanical** — run the checks, list candidates | `jobs/<name>/check.sh` | a findings file |
| **judgement** — is this still true, does it still earn its place | the session | verdicts on that report |

---

## 2. Shape: a folder you start a session in

`tooling/maintainer/`. `cd tooling/maintainer && claude` and that session **is** the
maintainer, because the folder's `CLAUDE.md` becomes its project instructions.

Boss's pattern (`tooling/boss/`), for the same four reasons:

1. **State on disk.** Report-then-approve means findings must survive between the turn that
   reports and the turn that acts. A skill has nowhere to put them.
2. **Its own scripts.** One per job.
3. **It loops.** On-demand now, scheduled later — a launchd run needs `claude -p` plus a
   report file.
4. **Context hygiene.** Reading 26 memory notes and verifying each against code is a lot of
   context, and it must not land in the session where you were doing real work.

Not a skill (this repo's 77 skills are the right shape for a procedure inside your current
session, which this is not). Not a `.claude/agents/` subagent (zero in use here; cannot be
driven from launchd; invisible to Codex).

---

## 3. Layout — one folder per job

**This is the load-bearing structural decision** (owner, 2026-08-25). Everything belonging
to a job lives in that job's folder, so adding a responsibility means adding a folder.

```
tooling/maintainer/
  CLAUDE.md              the job table + the rules every job shares
  README.md              human orientation
  .gitignore             state/
  bin/
    lib.sh               shared helpers; the rtk-safe absolute binary paths
    session-start.sh     LISTS jobs + each one's last run and open proposal. Runs nothing.
    run-job.sh           run ONE job's check.sh and write its findings
    propose.sh           turn findings into the owner-facing proposal
    apply.sh             act on an APPROVED proposal, then append to the ledger
  jobs/
    skills/
      README.md          what this job checks, one screen
      runbook.md         the deep procedure
      check.sh           the mechanical half — writes a report
      fix.sh             the repairs that need no judgement (optional)
    memory/ routing/ mcp/ bigfiles/ uptime/ crons/ artifacts/
    claude-health/ token-budget/
  state/
    findings/            gitignored — raw check.sh output, machine-facing
    proposals/           gitignored — the short summary you read, plus your decision
    ledger.md            TRACKED — one line per job run: what was proposed, what you approved
```

### The four-file contract

Every job folder has the same shape, and that uniformity is what makes the agent extensible:

| File | Required | Contract |
|---|---|---|
| `README.md` | yes | what this job checks and why, in one screen |
| `runbook.md` | yes | the full procedure, traps, and history |
| `check.sh` | yes | mechanical only. Writes `state/findings/<date>-<job>.md`. Never judges, never acts. **Exit 0 = no findings, 1 = findings, 2 = the check itself broke** |
| `fix.sh` | no | only repairs needing zero judgement |

`session-start.sh` discovers jobs by globbing `jobs/*/check.sh`. **Adding a job requires no
change to any runner** — only a new folder, plus one row in `CLAUDE.md`'s table for humans.

Distinguishing exit 1 from exit 2 matters: "found problems" and "I am broken" must never
look alike. That is the failure shape LESSONS 2026-08-02 records — *"the gate announced a
failure loudly while silently testing nothing."*

---

## 4. One job at a time. Propose, approve, then act.

**Nothing happens autonomously** (owner, 2026-08-25). The agent never sweeps every job and
never acts on its own conclusion. It works **one job folder at a time**, and each job runs
the same four beats:

```
1. CHECK    jobs/<name>/check.sh          -> state/findings/<date>-<name>.md   (machine)
2. PROPOSE  the session reads findings,    -> state/proposals/<date>-<name>.md  (you read this)
            applies judgement, and writes
            a short plain-language proposal
3. APPROVE  you say which items to do      -> recorded on the proposal
4. APPLY    bin/apply.sh acts on approved  -> appends one line to state/ledger.md
            items only, in a pp-work workspace
```

Then, and only then, the next job.

`session-start.sh` **runs nothing.** It prints each job, when it last ran, and whether a
proposal is still open. You pick the job. That is what stops the agent doing ten jobs' worth
of work you did not ask for.

### The proposal format — this is the interface you live in

Short, scannable, plain words. One line per action. Grouped so approving is fast. No raw
tool output; that stays in `findings/`.

```markdown
# skills — 2026-08-25

Checked 77 skills. Found 6 things. 2 need your call.

## Fix (mechanical, no judgement — say "fix all" and they're done)
1. `printing-press-amend` description is 661 chars, budget is 500. Trim to ~480.
2. 3 dead symlinks in ~/.codex/skills point at folders that were deleted. Remove them.

## Archive (recoverable — moves to a dated folder, nothing is deleted)
3. `roast` has zero references anywhere in the repo and no runbook. Archive it?

## Improve (not broken, would be better)
4. `pp-skool` and `tweet-lookup` both fetch social posts. One skill would trigger better.

## Ask (I will not guess)
5. `hyperframes-media` exists in two places with different content. 14 KB vs 66 KB.
   Which is the real one?

## Not touching
- 8 skills have zero repo references but ARE used interactively. Reference count is a
  candidate list, never a verdict.

Approve: all / fix only / by number / none
```

Rules for the proposal:

- **One line per item.** If it needs a paragraph, it belongs in `findings/`, linked.
- **Say the consequence, not the mechanism.** "Archive it?" not "run `mv` on the folder".
- **Group by verdict**, so "fix all" is a safe single word and the risky items stand alone.
- **Always carry a "Not touching" section.** It shows what was considered and rejected, which
  is what makes a short list trustworthy rather than suspicious.
- **Never mix `fix` with `archive`.** A mechanical repair and a removal must not be approved
  by the same word.

### Verdicts

| Verdict | Means | Approval |
|---|---|---|
| `fix` | mechanical defect, obvious repair, no judgement | bulk-approvable |
| `archive` | no longer earns its place — moves, never deleted | per item |
| `promote` | real knowledge in the wrong place — move to its repo home, then remove | per item |
| `improve` | not a defect; would be better if changed | per item |
| `ask` | needs the owner; the session must not guess | answer required |
| `keep` | considered and rejected — appears only under "Not touching" | none |

### The ledger

`state/ledger.md` is **tracked**, unlike `findings/` and `proposals/`. One line per job run:

```
2026-08-25  skills   proposed 6  approved 3 (fix 2, archive 1)  applied ok
```

So you can see at a glance what this agent has ever done, and what it proposed that you
declined. A declined item is a fact worth keeping — it stops the next run proposing it again.

## 5. The 10 jobs

| # | Job | The question |
|---|---|---|
| 1 | **skills** | is every skill still used, singly homed, and inside its description budget |
| 2 | **memory** | is each note still true, still useful, and not already in the repo |
| 3 | **routing** | does the map match the tree — **and what routes should exist that don't** |
| 4 | **mcp** | is every configured server reachable and still used |
| 5 | **bigfiles** | is anything committed that shouldn't be — **in git and on disk** |
| 6 | **uptime** | is every deployed surface up, do the inventories match |
| 7 | **crons** | did every VPS cron and launchd agent fire and succeed |
| 8 | **artifacts** | can a published video's leftovers go — **from git and from disk** |
| 9 | **claude-health** | is the Claude Code install healthy |
| 10 | **token-budget** | where are tokens being wasted |

### What each job reuses vs builds

| Job | Reuses | New |
|---|---|---|
| skills | `scripts/skills-status.sh` (exit 1 on a real problem), `check-skill-descriptions.sh`, `sync-shared-skills.sh --check`, `check-repo-hygiene.sh` | prune foreign links, account-dir gate, duplicate detector, a usage signal |
| memory | `scripts/relink.sh`, `scripts/test-memory-link.sh` | **all four** of `memory-maintenance.md` §9 |
| routing | the four checks in `.claude/skills/audit-repo-route/` | the propose-new-routes half |
| mcp | `claude mcp` (CLI) | reachability + a used/unused signal |
| bigfiles | `pp-push`'s 4 MB per-path refusal | HEAD scan, local scan, rewrite-plan generator |
| uptime | `scripts/probe-sites.sh` (parses `my-hosted-sites.md`, exit 1 + `DOWN_SITES:`), `check-apps.sh` | a schedule; reconcile `my-hosted-sites.md` vs `INFRA.md` |
| crons | — | everything. `VPS-CRONS.md`, `MAC-LAUNCHD.md` say what *should* run |
| artifacts | Project A's canonical slug | the published check, plus git and local removal |
| claude-health | `claude doctor` (CLI, verified), `/doctor` in-session, `claude plugin` | collation into a report |
| token-budget | `rtk discover`, `rtk gain`, `ccusage` — all verified present | `/context` capture (session-only) |

### Routing now proposes, not just detects

Two different kinds of finding, and the report keeps them apart:

- **defects** — unmapped folder, dead link, false structural claim, missing operate-doc,
  stale `decisions.md` entry. Verdict `fix`.
- **improvements** — a route that *should* exist: a question you'd plausibly ask that the
  "Find it fast" table cannot answer, a folder whose row is too vague to route on, an entry
  pointing at a file when it should point at a folder. Verdict `improve`.

Mixing them would bury "this link is dead" under "this could be phrased better".

### `audit-repo-route` is absorbed, then deleted

Owner decision. Keeping both would leave two homes for one check — the exact drift the skill
existed to catch. Removal must also drop it from `.claude/codex-skills.txt` if listed, and
prune dangling links by hand: `relink.sh` **cannot** prune a link resolving outside the repo,
which stranded links twice (`skill-maintenance.md` §7).

### Big files: two different problems

Measured 2026-08-25:

| | Size |
|---|---|
| `.git` pack | **610 MB** |
| tracked at HEAD | **157 MB** across 5,863 files |
| history-only | **~450 MB** |

Deleting from HEAD does **not** shrink a clone. So:

- **every run** — report files at HEAD that shouldn't be tracked, untracked local junk, and
  the history bloat with exact numbers. Never rewrite.
- **on request, once** — emit a complete reviewed `git-filter-repo` plan plus an impact
  checklist. Owner-triggered, never scheduled. A rewrite changes every commit SHA: it breaks
  every open boss PR, every `wt` lease, and every existing clone — and `personal-stuff` is
  public, so forks too.

### Local removal archives; it never deletes

Owner decision, 2026-08-25. Gitignored files — renders, `.mp4`, `.wav`, caches — **cannot be
recovered from git.** The `commit-now` skill states it: *"Renders are gitignored on purpose
and cannot be recovered from git. Folder persistence is what protects them."*

So a local removal is a **move**, to:

```
~/pp-maintainer-archive/<YYYY-MM-DD>-<job>/<original relative path>
```

Outside the repo, so it can never affect a clone, a land, or `pp-work reap`. Emptying it is
the owner's job and the owner's alone. **No job may ever call `rm` on a gitignored media
file.** This is the one irreversible operation in the agent and the archive is what makes it
reversible.

### Artifacts is last

It needs Project A's canonical slug to know which folder belongs to which published video.
Measured today: `visuals-flow/videos/*` is 0.5–1.5 MB across 6 folders, `yt-script/videos/*`
is 14–77 KB across 5. It reclaims **noise, not disk** — 5,863 tracked files is the number it
improves. Local renders are the larger win, and they go to the archive.

---

## 6. What it does NOT do

| Not doing | Why |
|---|---|
| route fixes through `boss` | archiving a note is a direct edit in a `pp-work` workspace; orchestrate → secretary → boss is three hops for a 5-line diff |
| notify | owner ruled notifications out for the boss land-sweep; same call here |
| act unattended on a schedule | a scheduled run writes a report and stops |
| automate the judgement half | both runbooks forbid it, at a measured 7-in-8 false-positive rate |
| `rm` a gitignored media file | unrecoverable. Move to the archive |
| rewrite git history on a schedule | one-time, owner-triggered, fully reviewed |
| keep `audit-repo-route` beside job 3 | two homes for one check is what drifts |
| wire `vreg check` into a merge gate | `decisions.md` 2026-08-09: a scratch workdir turns the gate red |

---

## 7. Rules every job shares

In `tooling/maintainer/CLAUDE.md` once, not repeated per runbook.

1. **Archive, never delete.** Tracked files to a dated repo archive; gitignored files to
   `~/pp-maintainer-archive/`.
2. **A grep is a candidate list, never a verdict.** 7 of 8 stale-flags in the first memory
   audit were false positives — matches on words like *unresolved* and *fixed interval*.
3. **Promoting beats deleting.** 16 boss notes were real knowledge in the wrong place.
4. **Verify every claim against the code**, including "this is fixed" and "fix is pending".
5. **Repo edits claim a `pp-work` workspace first.** The main checkout refuses to record git
   history (`.claude/hooks/no-history-in-main.sh`).
6. **Record the audit in `decisions.md`.**
7. **`rtk` fakes command output.** A `grep` through the hook returned `23 matches in 0
   files`; `prettier` always reports success. Every script calls binaries by absolute path
   (`/usr/bin/grep`) or via `rtk proxy`. This bit the first memory audit, and it bit the
   session that wrote this document — twice.
8. **Exit 1 means findings; exit 2 means the check broke.** Never conflate them.
9. **One job per cycle, and never act without approval.** No job may run another job's
   `check.sh`, and no `apply.sh` may act on an item the owner did not approve by name or by
   group. A proposal with no recorded decision is not approval.
10. **A proposal is prose for the owner, so it obeys the `i-have-adhd` shape**: the action
    first, one idea per line, five items maximum per group, no preamble, no closer.

---

## 8. A live finding, already

`.mcp.json`'s Cloudflare server reads `CF_API_TOKEN` from `ty/.env` or `TY/.env`. **`ty/` was
dissolved** (root `CLAUDE.md`; plan 008). So every Cloudflare MCP tool fails with
`CF_API_TOKEN is not set. Add it to one of .../ty/.env, .../TY/.env or the .mcp.json env
block.`

Found while trying to read `tracker-db` for the video-identity design. Job 4's first report
should contain it; plan 245 fixes it as its own worked example.

---

## 9. Plan sequence

Eight plans. **No plan is routed to `claude-p`** (owner decision 2026-08-25), so every one
must clear the fully-inlined bar — schemas, snippets and exact commands in the plan body.

| Plan | Scope | Executor | Model | Depends on |
|---|---|---|---|---|
| 242 | the folder, `CLAUDE.md`, the four-file contract, `bin/`, the runbook moves, **and job 1 (skills) end to end** | `agy` | Gemini 3.1 Pro (High) | — |
| 243 | job 2 — memory | `codex` | gpt-5.6-sol | 242 |
| 244 | job 3 — routing; absorb and delete `audit-repo-route` | `agy` | Gemini 3.1 Pro (High) | 242 |
| 245 | job 4 — MCP; fixes the dead Cloudflare config | `codex` | gpt-5.6-sol | 242 |
| 246 | job 5 — big files, git and local, + the rewrite-plan generator | `agy` | Gemini 3.1 Pro (High) | 242 |
| 247 | jobs 6 and 7 — uptime and crons | `codex` | gpt-5.6-sol | 242 |
| 248 | job 8 — pipeline artifacts, git and local | `agy` | Gemini 3.1 Pro (High) | 242, video-identity 240 |
| 249 | jobs 9 and 10 — claude-health and token-budget | `codex` | gpt-5.6-sol | 242 |

**Why 242 carries a job.** A frame with no job proves nothing. Wiring skills end to end
forces the report format to survive a real check on the first plan rather than the eighth.
Skills is chosen because it has the most existing scripts, so it is the cheapest proof.

**Routing rationale.** `tooling/boss/data/rules.md:21` places codex at *"owner asks for
codex, or a fully-inlined plan you want off the agy queue"*, noting no landed-PR track record
yet. codex takes the four plans with the smallest blast radius and clearest exit-code
verification (243, 245, 247, 249 — new files under `tooling/maintainer/`, plus one config
fix). agy keeps the foundational plan and the three that delete or move things others
depend on.

**No `tricky` plan exists in this batch**, which is what makes avoiding `claude-p` safe. The
one genuinely dangerous operation — the history rewrite — is executed by no plan; 246 only
generates its reviewed instructions.

---

## 10. Open points for plan readiness

1. **The unused-skill signal.** `skill-maintenance.md` §8: usage data does not exist — the
   audit could only count *references in the repo*, and 8 skills had zero references and
   were kept anyway. Plan 242 reports reference counts as a candidate list **explicitly
   labelled not-a-verdict**, never as "unused". Whether Claude Code exposes a real last-used
   date per repo skill is one check inside 242; the job works without it.
2. **Cron success evidence.** Whether each VPS cron and launchd agent leaves a
   script-readable log decides how much job 7 can assert. Plan 247's first step is to find
   out and report per job, rather than assume one mechanism.
3. **`/context` has no CLI form.** So token-budget's context breakdown is a session step, not
   a `check.sh` step. Plan 249 must spec it as human-assisted and not pretend otherwise.

None blocks authoring; each is a first step inside its own plan.

---

## Related

- `docs/runbooks/memory-maintenance.md` → moves to `tooling/maintainer/jobs/memory/runbook.md`
- `docs/runbooks/skill-maintenance.md` → moves to `tooling/maintainer/jobs/skills/runbook.md`
- `.claude/skills/audit-repo-route/` — absorbed by job 3, then deleted
- `tooling/boss/` — the folder-agent pattern this copies
- `docs/specs/2026-08-25-video-identity-design.md` — plan 248's dependency
- `tooling/boss/data/rules.md` — the executor routing this batch follows

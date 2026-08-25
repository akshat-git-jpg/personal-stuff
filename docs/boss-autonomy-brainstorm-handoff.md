# boss autonomy — brainstorm handoff (2026-08-22)

**Status: OPEN. No design chosen. Owner is thinking about it.**

Nothing here is decided except the Tier 1 bug fixes, which shipped (see the bottom
section and `decisions.md`). If you are picking this up cold, read "The objective"
and "Where it landed" first; the rest is the evidence trail.

---

## The ask

Today's flow is three roles: `orchestrate` (skill) writes a self-contained plan →
`secretary` (skill) raises a `boss:ready` PR → **boss** (a whole separate Claude Code
session, started with `cd tooling/boss && claude`) routes, dispatches, verifies, merges.

The owner's complaint, verbatim:

> "this two terminal two session thing I don't like"

You have to open a second terminal and manually tell boss to go. The owner's first
instinct was Claude Code sub-agents, so that the planning session could hand execution
off without a window switch — and ideally so executors could be Antigravity or Codex.

## The objective (this is the part that kept getting mis-stated)

Two constraints, both verbatim, and both load-bearing:

> "there have been times when my PR had issues and since boss is AI, it fixed itself
> and continued the execution without wasting my time. whole point is i want to waste
> my time less — once I brainstorm and the PR is raised, its entire execution to merge
> with testing should be done automatically without my input unless absolutely required."

> "my goal is to reduce my time waste but obviously it should not come from too much
> token consumption. otherwise I could have executed in the same session I planned."

So: **minimise owner-minutes, subject to a token ceiling.** Not minimise tokens. Not
maximise determinism. A design that parks a PR where today's boss would have self-healed
it is a REGRESSION, no matter how cheap or how clean it is.

The second constraint gives a hard yardstick: **"just implement the plan inline in the
planning session" is the null hypothesis.** Any orchestration layer that costs more than
that is pointless.

---

## Measured evidence

All of this was counted from `tooling/boss/state/*.meta`, `state/*.out`, and the 31
boss session transcripts. It is not estimated.

| Fact | Value |
|---|---|
| PRs dispatched (2026-07-07 → 08-21) | 165 (3.6/day) |
| Executor split | 133 agy (81%) / 31 claude-p (19%) |
| claude-p crew cost | median $3.97, **sum $204.07** |
| agy crew cost | $0 (Antigravity subscription) |
| Fix-up rate | 10.9% all-time; **23.1% in August** |
| PRs needing >1 fix-up round | exactly one (#134, three rounds — and it landed) |
| boss-state polls | ≥1,619 (mean 9.8/PR, max 63 on #128) |
| Owner turns in boss sessions | 149 total = 0.90/PR |
| …of those, under 60 chars ("ok", "go", "continue") | **65 of 149 = 44%** |
| boss session wall-clock | 119 hours across 31 sessions |

### The number that reframed the whole discussion

**The boss orchestration layer burned 1,048,790,030 cache-read tokens, 16.2M cache-write,
and 4.09M output across 6,710 API calls in 31 sessions.** At Opus 5 rates that is about
**$728** — versus **$204** for all the crew work it orchestrated.

**The orchestrator cost ~3.6× the implementation work it managed.**

Average context per boss API call: **156,000 tokens**. `tooling/boss/CLAUDE.md:10-12`
claims boss stays cheap because it "holds routing state only… reads frontmatter, routes,
and forgets". **That claim is measurably false as implemented.** ~85% of boss's spend is
an Opus session polling a `sleep`.

Honest bound: those 31 transcripts include sessions where boss's own scripts were being
built and debugged, so $728 is an upper bound. Lower bound: ≥1,619 of 3,011 tool calls
(54%) were `boss-state.sh` polls → ≥$390, i.e. **$2.36–$4.41 of pure orchestration
overhead per PR.**

### Cost scoreboard (per plan)

| Design | orchestration | crew | total | vs null hypothesis |
|---|---|---|---|---|
| (i) today's long-lived AI boss | $4.41 | $0.75 | **$5.16** | **0.9× — a TIE** |
| (ii) dumb bash daemon, owner judges | $0.00 | $0.75 | **$0.75** | 7.6× cheaper |
| (iii) script + ephemeral AI judges | $0.24 | $0.92 | **$1.16** | 4.9× cheaper |
| (iv) null: implement inline while planning | — | — | **$5.70** | 1.0× |

**The owner's suspicion is arithmetically correct about the system as it exists today.**
Boss does not currently save tokens versus doing the work inline. What it actually buys
is parallelism (2–3 concurrent crews) and unattended wall-clock — real value, but not
the value its own docs claim.

On a Max subscription the dollars are shadow prices; the binding constraint is the weekly
rate limit, and cache-read tokens count against it. **1.049B cache-read tokens in 46 days
is the real cost.** Deleting the poll loop is buying back capacity, not saving money.

---

## Options considered, and why each was ruled out or kept

### A. Claude Code sub-agents replace boss — RULED OUT, but for the right reason

The first stated reason was wrong and is corrected here: *"a sub-agent can never BE
`agy`"* is a misdiagnosis. **Boss never IS an executor — it shells out.**
`boss-dispatch.sh:262` invokes `executors/<e>.sh dispatch`, and `executors/agy.sh:18`
execs the `agy` binary as a disowned subprocess. A Claude sub-agent running that script
spawns `agy` exactly as a Claude session does. The `model` enum constrains the
sub-agent's own reasoning model, not what binaries it launches. **Free Antigravity tokens
were never at risk.**

The real objections are weaker but still real: a sub-agent has no visible window (the
owner wants to watch progress), and its lifetime is tied to the parent.

### B. Cross-session `SendMessage` — RULED OUT unanimously

Round 1 proposed: keep boss as a long-lived session started with `claude --name boss`,
and have the planning session message it (`SendMessage`, with `notify_when_idle` for the
report-back). All three reviewers rejected it. Reasons that survived scrutiny:

- **It violates its own governing principle.** The design declared "labels + Telegram are
  the truth, messages are a convenience", then stored its single piece of genuinely new
  state — *"the owner amended the plan, please re-dispatch"* — ONLY in the message
  channel: not durable, not idempotent, not reconstructible by `boss-session-start.sh`.
- **`notify_when_idle` fires at the wrong time.** "Idle" means *finished its turn with
  nothing queued*. `boss-dispatch.sh` backgrounds the executor and returns in seconds, so
  boss goes idle ~60s after dispatch while the crew still has 20–90 minutes to run. The
  subscription trains you to read a meaningless signal.
- **Head-of-line blocking.** `boss-merge.sh:105-111` can `sleep 60` up to
  `BOSS_CHROME_WAIT_MIN` (default 45) times waiting for crews to release Chrome. A
  single-threaded boss draining a message queue stalls every other PR behind one merge.
- **It doesn't even remove the second terminal** — you still open one to run
  `claude --name boss`. It converts a per-batch terminal into a permanent one, which is a
  strictly worse steady state (compaction).
- **The proposed blocked-fix loop destroys crew work.** See "Landmines" below.

### C. Off-the-shelf orchestration — RULED OUT, unanimously and for a structural reason

Named and considered: Temporal, Windmill, Prefect, Dagster, Celery/BullMQ, GitHub Actions
on a self-hosted runner, `anthropics/claude-code-action`, OpenHands, SWE-agent, Sweep,
Codegen, Cursor background agents, Devin, Anthropic Managed Agents.

**Every candidate replaces the cheap part (transport, queueing, liveness) and forces a
rewrite of the expensive part (the gates).** What is actually accumulated in
`boss-lib.sh` / `boss-merge.sh` is not process — it is a bug database written in shell:
the mutation gate's five-stage sequence with the no-op-recipe and crash-shaped-failure
checks; the fence-leak gate; bucketed-CPU stall detection (a deadlocked Chrome tree
trickled 1s CPU per 7min and ran 87 minutes undetected); the pid-reuse guard that cost
PR#148 a 36-minute phantom wait; two separate YAML frontmatter parser bugs that each
misdiagnosed a correct plan as a bad recipe. No off-the-shelf tool contains any of it.

Also: every agent-on-PR product is single-vendor, so adopting one ends the agy free-token
lane — which `data/rules.md` deliberately made the default on 2026-07-18.

The one idea worth stealing conceptually: **concurrency groups** (a declarative "one merge
at a time, keyed on repo") are cleaner than `boss_chrome_lock_acquire`'s hand-rolled
mkdir lock plus stale-pid reaper. Not worth a migration; worth remembering.

### D. Dumb bash daemon, owner handles all judgement — RULED OUT by the owner

Round 1's headline recommendation from all three reviewers. **The owner rejected it, and
was right to.** At August's 23% fix-up rate it parks roughly one PR in four for a human,
plus every `ratelimited` (which `CLAUDE.md` explicitly says is not a failure), every dead
crew with uncommitted work, and every gate block. It optimises tokens and determinism —
neither of which is the objective.

### E. Script owns the loop + ephemeral AI judges own decisions — SUPERSEDED

Round 2's proposal. Reviewed by all three. Verdict: **right shape, priced backwards.**

- The script is worth **$4.17/PR and ~44% of owner turns**. The judge is worth
  **$0.24/PR and maybe 10–20% of what's left**, while introducing the one genuinely new
  risk: confident misdiagnosis on exactly the failure class this repo has historically
  misdiagnosed.
- **Most "judgement points" are `case` statements, not judgement.** `ratelimited` → sleep
  and re-dispatch. `max-turns` → re-dispatch with a raised cap (**15 of 31 claude-p runs
  used ≥58 turns against a default cap of 60** — that is a resource ceiling, not a plan
  defect). `blocked … WORK UNCOMMITTED` → direct executor dispatch, and `CLAUDE.md`
  already prints the exact command. `STALLED-KILLED` → same brief, fresh process.
- **A judge given only "that PR's evidence" is WORSE than today's boss.** Real evidence
  from the fix-up corpus: `state/163.fixup.brief.md` carries
  `npm_config_cache=/Users/kbtg/.npm-boss` (root-owned files in `~/.npm/_cacache` make
  `npm ci` fail EACCES) and *"Do NOT edit `src/worker/**`. Plan 203 owns the backend and
  it has landed."* Neither fact is in the PR. A starved judge writes a brief that fails.
- **Several gate messages have historically been LIES.** `mutation_apply changed NOTHING`
  was boss's own bug three separate times (wrong tree, trailing-quote parser, block-scalar
  parser). A fresh judge handed that string will blame the plan.
- `state/113.fixup.brief.md` is the archetype of a *real* fix-up and is definitionally
  the owner's: the crew correctly honoured a STOP condition, and the resolution was an
  owner ruling overriding the plan. If a judge can make that call, the STOP-condition
  mechanism is deleted.

### F. Give the CREW a self-fix budget — PARTLY RIGHT, already policy elsewhere

`.claude/skills/personal-stuff-change-control/SKILL.md:18` already sets *"executor
self-fix cap = 5 per plan; orchestrator fix-up rounds cap = 2"*. Boss's crew brief
(`boss-dispatch.sh:155-169`) implements **neither**. That is a genuine gap.

But "strictly cheaper" is false: median claude-p run is **57 turns against a
`--max-turns` default of 60** — there is no headroom, so in-crew self-healing means
raising the cap, and you pay it on **every** plan including the 77–89% that never needed
a fix-up. A boss-side lane is pay-per-incident.

Quality hazard too: an unbounded self-healing crew is how you get `LESSONS.md`
2026-07-31 (requirements punted with thinking-out-loud comments left in the code),
2026-07-24 (specced behaviours shipped as inert lookalike stubs, all gates green), and
2026-08-17 (11 specced test cases shipped as zero test files, `npm test` still exit 0).
**A crew allowed to keep going until green will make green happen.** Any budget must be
on *attempts*, never permission to touch the test.

---

## Where it landed: the "pager" idea (LEADING CANDIDATE, NOT DECIDED)

The reframe that came out of the owner's pushback: **the problem is not that boss is an
AI. The problem is that boss is awake while it waits.**

A 40-minute job today:

```
minute 0      dispatch                  <- needs a brain
minutes 1-40  "done yet? no." x10       <- needs NO brain, costs ~156k tokens EACH
minute 40     crew done, decide, merge  <- needs a brain
```

So keep boss exactly as smart as it is, and delete only the waiting.

**Boss "asleep" means no boss process exists at all.** "Wake boss" means a watcher script
runs `claude -p "<boss instructions + what just happened>"` — headless, no terminal, no
window. It works for ~60s and exits. This is precisely the mechanism boss already uses on
its crews (`executors/claude-p.sh:18`), proven over 31 sessions.

```
09:00  pager   scan: 216 boss:ready -> WAKE boss
09:01  BOSS    reads frontmatter, dispatches crew, says "wake me when 216 stops", EXITS
09:01  pager   waiting... (40 min of kill -0 checks. free. no AI.)
09:41  pager   216 stopped, collect: done -> WAKE boss
09:41  BOSS    runs gates, reads output, thinks:
                 all good      -> merge + notify
                 small problem -> fixes it itself (shell access, unchanged)
                 real problem  -> writes fix-up brief, direct executor dispatch
                 hopeless      -> boss:blocked + notify owner
               EXITS
```

Boss is awake 2–3 times per PR instead of 10–12, and each wake is smaller because it is
not dragging a poll log. Rough estimate **~10× fewer tokens**; unverified.

### Why quality should not drop

Boss's knowledge was never in the conversation. It is on disk:

| What boss needs | Where it already lives |
|---|---|
| how to be boss | `tooling/boss/CLAUDE.md` (~15k tokens) |
| everything about this PR | `state/<pr>.meta` (branch, worktree, executor, test_cmd, pid, fixups) |
| what the crew did | `state/<pr>.out` |
| the queue | GitHub labels |
| in-flight reconciliation | `boss-session-start.sh` already rebuilds this from labels + worktrees |
| what boss decided last wake | **one new small notes file** — the only new artifact |

Boss's manual is ~15k of the 156k it re-reads per call. **The other ~140k is
conversation history, and most of it is "checking 216… still working / ok".** That is a
log of nothing happening, not knowledge. And `CLAUDE.md:9` already specifies boss should
*"read frontmatter, route, and forget"* — a fresh boss per event is CLOSER to the original
design than today's long chat.

### Honest cost of the pager

- Boss must be able to say "wake me when X" and stop. That handoff is the new mechanism.
- **The real loss:** a fresh boss cannot have a hunch like *"agy has been flaky all
  afternoon"*. Mitigation is the notes file carrying a short running log. Partial, not
  perfect.
- Unmeasured. The ~10× is an estimate; the first week should confirm or kill it.

### Comparison

| | Boss stays smart | Starts itself | Tokens | Owner work |
|---|---|---|---|---|
| Today | yes | no — you tell it | very high | ~4 nudges/session |
| Dumb daemon (D) | **no** | yes | lowest | **more** |
| Script + judges (E) | partly | yes | low | less |
| **Pager (F)** | **yes** | **yes** | **low** | **least** |

---

## Landmines — verified against the code, do not re-derive

These were found while reviewing, and each was confirmed by reading the file. Any future
design must respect them.

1. **A re-dispatch DESTROYS crew work.** `boss-dispatch.sh:121` does
   `git checkout -B "$branch" "origin/$branch"` — a force reset. **Nothing in boss or
   either executor ever pushes a crew branch**; the only `git push` in the codebase is
   `boss-merge.sh:155` for `plans/README.md` on main. Crew commits exist only as a local
   ref. `CLAUDE.md:185-186` already says this: *"salvage with a DIRECT executor dispatch —
   never `boss-dispatch`, which force-resets the branch and destroys it."*
   Round 1's "amend the plan, then re-dispatch" happy path was the exact operation the
   manual forbids.

2. **You cannot fix a plan under a live crew.** The crew reads the plan **from its
   worktree** (`boss-dispatch.sh:156`: *"Implement exactly the plan at $planpath in THIS
   worktree"*). Amending it on `origin/<branch>` has zero effect on a running crew, and
   the planning session physically cannot check that branch out because the leased
   worktree holds the ref. To change what a live crew is doing you must stop it first.

3. **`collect` reports `dead` when there is merely no output yet**
   (`claude-p.sh:28`). A human polls a minute later and never sees it; a script polling
   at 5s would tear down a healthy newborn crew. Any loop needs a grace window keyed on
   `dispatched_at`.

4. **`boss_notify` is best-effort** (`boss-lib.sh:113`, `|| true`), and the guaranteed
   backstop is *"boss session-start always prints the full merged/blocked ledger"*. With
   no session, that guarantee is gone. A durable `state/ESCALATIONS` file is needed.

5. **`state/*.meta` grows unboundedly under machine-paced polling.**
   `boss_stall_check` appends two lines per poll; `110.meta` already carries 53
   `progress_at` lines from *human-paced* polling. A 60s loop over a 3-hour crew appends
   ~360 lines, and every `meta_get` is a `grep` over the whole file.

6. **A hard one-fix-up bound is wrong.** PR#134 took three rounds
   (`134.fixup{,2,3}.brief.md`) and landed. Better: bound **per-cause** — hash the
   failure signature (first failing assertion, or the `collect` detail string); a NEW
   signature earns a round, a REPEATED signature parks immediately regardless of count,
   and `ratelimited`/`APIERROR` never count. Same shape as `boss_stall_check`'s
   fingerprint, which the repo already trusts.

7. **agy-specific hazards that break for a judge but not a crew:** at 0% Antigravity
   quota agy returns `status:SUCCESS` with 0 tokens; a crew is falsified by
   `boss_head_advanced` (a real commit or nothing), but **a judge produces no commit**, so
   there is nothing to check. Also agy print mode reads `AGENTS.md`, never `CLAUDE.md`,
   and `tooling/boss/` has no `AGENTS.md`. Also `agy.sh` passes no turn cap, only
   `--print-timeout 180m`. If judges/wakes ever run on agy, reuse
   `tooling/cli/greenlight/greenlight`'s `run_agent_stage` (fence recovery, required-key
   validation, bounded attempts) rather than writing a second one — but fix its 429 hole
   first: it treats any invocation failure as bad JSON and burns a retry.

8. **`ui: true` must never gain an automated PASS.** The gate only asserts an image
   exists. Owner call 2026-08-04 was explicitly *"do not harden the gate — the human eye
   stays the defense"*. Any screening lane must be restricted to
   `{SUSPICIOUS, INCONCLUSIVE}`; a PASS verdict deletes the only defence. The mechanical
   check that actually caught PR#149 is worth wiring in though: extract proper nouns from
   the image and `grep -ri` each against the repo (`grep -ri ReviewHub board-ui/src/`
   returned nothing).

9. **`docs/specs/2026-07-07-boss-design.md` has drifted from the code** in at least three
   places: it documents a 4-arg executor contract (`:118`) where the real one is 3-arg
   (`claude-p.sh:10`); it says `ui: true` requires an inline PR comment screenshot
   (`:65-69`), removed 2026-07-18 and re-added differently as a merge gate; it calls
   `state/` "a throwaway PID cache only" (`:155`) while the real `state/` holds 680 files
   including the plan snapshots the mutation gate reads. **Do not write a second spec** —
   amend that one in place and record decisions in `decisions.md`.

---

## What actually shipped

Three real bugs, independent of whichever design wins — they bite today. Full detail in
`decisions.md`.

**Provenance note (2026-08-25).** These were written on 2026-08-22 on branch
`feature/boss-tier1-fixes` (commit `326c65e5`) and that branch was **never merged**. It sat
371 commits behind `main` while this document and `decisions.md` both described the fixes as
shipped — so for three days the docs asserted a fix that was not in the code, which is the
same class of stale claim this file warns about elsewhere. All three were re-applied to
`main` directly on 2026-08-25 rather than cherry-picked, each with tests, and the branch's
own test-boss.sh changes were dropped as superseded. Do not resurrect that branch for these;
the only thing left on it is this document.

1. **The fix-up bound is now persisted and enforced.** `boss_fixup_claim` in the
   executor's `dispatch` verb writes `fixups=N` to `state/<pr>.meta`.
   `BOSS_MAX_FIXUPS` defaults to 1. **Note landmine 6 — a hard 1 would have wrongly
   parked PR#134. Per-cause bounding is the better design and is not built.**
2. **Duplicate dispatch is refused.** `boss-dispatch.sh` now reads live labels and a live
   pid; the abort path no longer flips a PR with a live crew back to `boss:ready`.
   `--force` overrides.
3. **boss gives the `gh` account back.** `boss_assert_gh` records the previous account and
   every entry script traps `boss_gh_restore` on EXIT (`boss-merge` chains it after the
   chrome-lock release, which used to clear the trap). `BOSS_GH_KEEP=1` opts out. This was
   almost certainly the cause of the owner's recurring "my gh account flipped to
   akshat-git-jpg" annoyance.

**Test-suite status, corrected 2026-08-25.** The 2026-08-22 note here said the suite was
`9 pass / 1 fail` with test (6) `boss-merge` a known-red `parked by greenlight (unknown)`.
That is no longer true and should not be quoted: `main`'s `test-boss.sh` has since been
rewritten well past that state — its `gh` stub implements `api user` and `auth switch`, and
the whole suite is green. Each of the three fixes above now carries its own mutation-tested
case. Read the suite, not this paragraph.

---

## Open questions for whenever this is picked up again

1. **Is the pager's ~10× token estimate real?** Unverified. Cheapest test: instrument one
   week of the existing flow, then one week of pager, and compare cache-read tokens.
2. **Persistent boss session woken by messages, or a fresh `claude -p` per wake?** Fresh
   is cheaper and kills compaction but loses cross-PR feel. The notes file is the proposed
   mitigation and its sufficiency is untested.
3. **What actually goes in the notes file**, and how does it not become the same
   unbounded log problem as `progress_at`?
4. **Should the deterministic `case` rungs land first, independently?** They are pure
   wins under every design — `ratelimited`, `max-turns`, `STALLED-KILLED`, and
   `WORK UNCOMMITTED` all have documented mechanical responses, and handling them costs no
   tokens at all. This is the smallest useful step and does not commit to any architecture.
5. **Give the crew brief a self-fix budget** (landmine F) — a gap versus the repo's own
   change-control policy, and independent of everything else here.
6. **Per-cause fix-up bounding** (landmine 6) — supersedes the hard `BOSS_MAX_FIXUPS=1`
   that just shipped.
7. **Does the owner want a visible progress window at all**, once nothing needs typing in
   it? If Telegram is sufficient, the watcher can be a launchd agent and there is no
   second window in any sense.

## Review artifacts

Four full reviews were produced (Opus 4.5, Opus 5, and Gemini 3.1 Pro via `agy`, two
rounds each for Opus 4.5/Gemini and Opus 5). They lived in a scratch job directory and are
**not durable**. The load-bearing content — every number, every landmine, every ruled-out
option — has been transcribed into this document deliberately, because the originals will
be garbage-collected.

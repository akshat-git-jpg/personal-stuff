# Runbook — Claude memory maintenance

Written 2026-08-25, after the first full audit of Claude Code's file-based memory
(72 files → 26). This is the **memory chapter of the repo-maintainer brief**: what
memory is, what shape it should be in, how to audit it, and the traps that make an
audit go wrong.

Read it end to end before touching a memory store. It is short on narrative and long
on the parts that bite.

---

## 1. What memory actually is

Claude Code writes small Markdown notes to itself and reloads them in later sessions.

```
<config dir>/projects/<cwd with / replaced by ->/memory/
├── MEMORY.md          the index — one line per note
├── some-fact.md       one note = one fact
└── another-fact.md
```

- `MEMORY.md` is loaded at session start. The individual notes are **not** — Claude
  opens one only when its index line looks relevant.
- Each note has frontmatter with `name`, `description` and `metadata.type`.
- There are exactly three types: **feedback** (a rule the owner gave), **project**
  (findings on a piece of work), **reference** (where something lives / how to reach it).
- A good note body states the fact, then **Why**, then **How to apply**. `[[wiki-links]]`
  cross-reference other notes by their `name:` slug.

### The thing that causes every structural problem

**The store is keyed by the exact directory the session was launched in — not by repo.**

So one repo silently gets a separate store per account, per subfolder, and per worktree:

```
~/.claude-work/projects/-Users-kbtg-codebase-personal-stuff/
~/.claude-work/projects/-Users-kbtg-codebase-personal-stuff-tooling-boss/
~/.claude-personal/projects/-Users-kbtg-codebase-personal-stuff/
~/.claude-work/projects/-Users-kbtg-kb-scratch-worktrees-...-personal-stuff/
```

That was **16 possible stores** for personal-stuff. Nothing syncs them, and nothing
warns you. This is solved (§4) — do not let it regress.

---

## 2. Current state (2026-08-25)

**2 real stores, 26 notes.**

| Store | Notes | Holds |
|---|---|---|
| `~/.claude-work/projects/-Users-kbtg-codebase-personal-stuff/memory` | 1 + 6 | Machine-local facts only |
| `~/.claude-work/projects/-Users-kbtg-codebase-dashboard-api/memory` | 1 + 18 | ZluriHQ work knowledge |

15 other paths are **symlinks** into the personal-stuff store — both accounts, every
repo subfolder, every worktree slot. dashboard-api is deliberately separate: it is a
different repo, only ever opened from the work account.

Archive of everything ever removed: `~/claude-memory-archive-2026-08-24/` (47 files).
Full inventory with a one-liner per note: `~/memory-audit-2026-08-24.md`.

---

## 3. The policy — what memory is FOR

Owner-approved, and written into every `MEMORY.md`:

> **The store is a scratch cache, not a second brain.** Any fact still true after about
> a month gets promoted to its repo home and deleted from memory. A memory duplicating
> a repo doc is deleted on sight.

Memory is the right home for exactly two kinds of fact:

1. **About this machine** — the Bluetooth guard, where Cursor lives, the npm cache trap.
   True of this laptop, not of the code, so it cannot go in a repo others read.
2. **Live work that expires on its own** — a feature branch's revert-before-merge list,
   this week's rolling PR. Delete each when its work lands.

**Everything else belongs in the repo**, where a fresh session actually reads it:

| Kind of fact | Repo home |
|---|---|
| A tool's operating knowledge | that tool's `CLAUDE.md` (e.g. `tooling/boss/CLAUDE.md`) |
| A decision or a load-bearing "why" | `decisions.md` |
| A standing owner preference | `context/profile.md`, or the global `~/.claude-work/CLAUDE.md` |
| A rule needed in more than one repo | the global `CLAUDE.md`, once |
| An app's local gotcha | that app's `CLAUDE.md` |

### The four-question test

A note earns its place only if **all four** hold. Apply it to every file:

1. **Still true today?** (Verify against the code. Do not trust the note.)
2. **Will it change what I DO in a future session?** (A record of a finished event will not.)
3. **Not already written in the repo?**
4. **Not findable in 10 seconds** by reading code or running one command?

A one-time event fails #2. A fixed bug usually fails #1. Three copies of one rule fail #3.

---

## 4. The structural fix — one store per repo

`link_shared_memory()` in `scripts/relink.sh` walks both accounts' `projects/`
directories and symlinks every directory belonging to this repo to **one canonical
store** (the work account's repo-root store).

A directory belongs to the repo if its name: equals the repo slug, starts with
`<slug>-` (a subfolder), or ends with `-<repo basename>` (another checkout — a `wt`
slot or a pp-work lease).

Run it with `bash scripts/relink.sh`. Idempotent.

**Its refusals are the important part**, all pinned by `scripts/test-memory-link.sh`
(11 tests — run it after any change):

- an unrelated repo is never matched — dashboard-api keeps its own store
- a **non-empty real** store is refused with a merge instruction and left untouched,
  and one refusal does not abort the remaining links
- an empty real store is replaced; a link pointing elsewhere is repaired
- a second run is a no-op

Known gap, accepted: only directories that **already exist** are linked, so a
brand-new worktree has its own store until the next `relink.sh`. Worktrees are
short-lived and reaped.

> The slug comes from `git worktree list`, which reports the **resolved** path. That
> is what makes it correct when relink runs from a lease. It also means a test using
> `mktemp -d` on macOS must resolve `/var` → `/private/var` or every assertion looks
> at a directory nobody created.

---

## 5. The recurring audit — run this

Roughly quarterly, or when a store passes ~15 notes.

### Step 1 — inventory

```bash
for d in $(find ~/.claude-work ~/.claude-personal -maxdepth 4 -type d -name memory | sort); do
  echo "### $d"
  for f in "$d"/*.md; do
    [ "$(basename "$f")" = MEMORY.md ] && continue
    printf '  %s  %s :: %s\n' "$(stat -f '%Sm' -t '%Y-%m-%d' "$f")" "$(basename "$f")" \
      "$(grep -m1 '^description:' "$f" | sed 's/^description: *//')"
  done
done
```

### Step 2 — index sync

Every note must appear in its `MEMORY.md`, and every pointer must resolve:

```bash
for d in $(find ~/.claude-work ~/.claude-personal -maxdepth 4 -type d -name memory); do
  for f in "$d"/*.md; do b=$(basename "$f"); [ "$b" = MEMORY.md ] && continue
    grep -q "$b" "$d/MEMORY.md" || echo "ORPHAN $d/$b"; done
  grep -oE '\(([a-zA-Z0-9_.-]+\.md)\)' "$d/MEMORY.md" | tr -d '()' | sort -u | while read -r p; do
    [ -f "$d/$p" ] || echo "DEAD POINTER $d/$p"; done
done
```

### Step 3 — dead-repo check

A memory naming a repo path dies silently when the repo does. Ten notes for two
deleted repos were found this way.

```bash
ls ~/.claude-work/projects ~/.claude-personal/projects
# for each: does the path it is derived from still exist on disk?
```

Also check session history — a store with **zero** `*.jsonl` files was only ever
written to, never read. That is how the backend-scripts store was found and merged away.

### Step 4 — read every note and apply the four-question test

No shortcut here. **Verify each "this is fixed" and "fix is pending" claim against the
actual code**, then sort into: keep / promote to repo / delete.

### Step 5 — act, then reconcile

- **Archive, never delete.** `mv` into a dated archive folder.
- Rewrite each `MEMORY.md` to match, including a short "moved out — do not re-add here"
  section so the next session does not recreate what you just promoted.
- Re-run Step 2. It must come back clean.

---

## 6. Rules that must not be broken

1. **Never delete a memory. Archive it.** Every removal this audit made is recoverable.
2. **Verify before trusting a note.** Of 8 notes flagged "FIXED / stale" by a description
   grep, **7 were false positives** — matches on words like *unresolved* and *fixed
   interval*, or notes that still carried live diagnostic steps. Reading them was the
   only way to know. A grep over descriptions is a candidate list, never a verdict.
3. **Promoting is usually better than deleting.** 16 boss notes were real knowledge in
   the wrong place. Moved into `tooling/boss/CLAUDE.md`, a boss session reads them every
   time; as memory files it never did.
4. **When promoting, re-verify against code and mark what is still open.** Promoting the
   boss notes corrected a stale claim in `tooling/boss/CLAUDE.md` ("Boss auto-commits a
   dirty main" — no longer true) and confirmed two "pending fix" notes were still pending.
5. **Fix the pointer, do not break it.** If a note references a file you are moving,
   update the note in the same pass. Two work artifacts moved to `~/.claude-work/docs/`
   this way.
6. **Repo edits need a `pp-work` workspace.** `cd "$(pp-work claim --kind code --slug <task>)"`.
   The main checkout refuses to record git history.
7. **Record the audit in `decisions.md`.** Otherwise the next maintainer re-derives it.

---

## 7. Traps hit during the first audit

| Trap | What happened |
|---|---|
| `rtk` fakes command output | `grep` returned `23 matches in 0 files` and `prettier` always reports success. Bypass with `rtk proxy <cmd>` or the direct binary. There is a memory note for this. |
| dcg guard blocks dynamic paths | `mv "$VAR/..."`, `rm -rf "$T"`, and heredoc-plus-redirect combinations are refused. Write literal paths, or put the logic in a script file and run that. |
| macOS ships bash 3.2 | `mapfile` does not exist, and an empty array is "unset" under `set -u`. launchd calls `/bin/bash` directly, so test with `/bin/bash`, not Homebrew's. |
| `mktemp -d` resolves symlinks | `/var` → `/private/var`. A test computing a slug from the unresolved path asserts against directories nobody created. |
| The main checkout does not fast-forward | After a land, `origin/main` moves and local `HEAD` does not. Read files with `git show origin/main:<path>`, not from `HEAD`. |
| A parallel session may fix your bug | The gh account-flip fix landed from another session mid-audit, making a just-written section wrong. Re-check before finalising a report. |

---

## 8. Still open

- **`personal-stuff` store, 6 notes.** All machine-local. Nothing to promote.
- **`dashboard-api` store, 18 notes.** Four are live-work notes that should be deleted
  when their work lands: `project_appgov_sod_feature_env` (branch open, holds a
  revert-before-merge list), `project_beta_flag_cleanup_rolling_pr`,
  `project_zv2_4342_parentid_corruption` (fix query written, not run),
  `project_dbt_empty_array_tombstone_bug` (audit done, fixes not applied).
  **Check these first at the next audit.**
- **The promote habit is unenforced.** Nothing reminds anyone to move a month-old fact
  into the repo. That lapsing is exactly how 22 notes piled up in one store. A
  repo-maintainer agent running this runbook on a schedule is the intended fix.

## 9. Possible automation

Worth building into the maintainer agent, roughly in value order:

1. **Age report** — list notes older than 30 days with their descriptions, so the promote
   decision is a review rather than a hunt.
2. **Index-sync check as a gate** — Step 2 is fully mechanical; it belongs in
   `scripts/check.sh`.
3. **Store-count alarm** — warn when a repo has more than one real store, or a store has
   no session history (`*.jsonl`), which means nothing ever reads it.
4. **Dead-path check** — warn when a `projects/` entry's source directory no longer exists.

Do **not** try to automate step 4 of the audit. Deciding whether a fact still earns its
place needs code verification and judgement, and the false-positive rate on any
description-matching heuristic was 7 in 8.

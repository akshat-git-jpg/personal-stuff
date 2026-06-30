---
name: audit-repo-route
description: Audit and auto-fix routing/navigation drift in a repo that uses the "Find it fast" CLAUDE.md convention (personal-stuff, TY). Detects folders missing from the intent table, dead links in the map, sub-folders with no CLAUDE.md/README, and stale decisions.md entries — then fixes the mechanical drift in place and flags the judgment calls. Read it as the repo's "dream sequence" self-audit. Triggers on "/audit-repo-route", "audit repo routing", "audit the repo route", "check routing drift", "is the routing stale", "check the find-it-fast table", "keep the map fresh", "run the routing audit".
user-invocable: true
metadata:
  author: kbtg
  version: 1.0.0
---

# audit-repo-route

A scheduled-feeling, on-demand self-audit that keeps a repo's **navigation layer** in sync with its actual structure. The routing fixes only pay off if they stay accurate — folders get added, things move, links rot, and nobody updates the map. This skill catches that drift and repairs the mechanical parts itself.

It is **not** a code reviewer. It only inspects the *navigation* artifacts (the `CLAUDE.md` "Find it fast" table, sub-folder `CLAUDE.md`/`README.md` files, and `decisions.md`) against the real folder tree.

## Target repos

By default, audit the repos that use this convention and are present locally:

- `/Users/kbtg/codebase/personal-stuff`
- `/Users/kbtg/codebase/TY`

Rules:
- If invoked from inside one of those repos with no other instruction, audit **both** (they share the convention).
- If the user names one repo, audit only that one.
- If invoked from a different repo that has a root `CLAUDE.md` with a "Find it fast"-style intent table, audit *that* repo instead.
- If a target path doesn't exist locally, skip it and say so — don't error.

## What "the map" means in these repos

Each repo's root `CLAUDE.md` contains a **"Find it fast" intent table**: a markdown table mapping an intent ("If the ask is about…") to a link (a folder or file). That table plus the imported `README.md` map is the routing surface. `decisions.md` is the append-only decision log. Sub-folders are expected to carry a `CLAUDE.md` (how Claude operates there) and/or a `README.md` (what it is).

## The four checks

| # | Check | Action |
|---|---|---|
| 1 | **Unmapped folder** — a top-level folder (or a notable project sub-folder) that has no row in the intent table and isn't covered by the README map | **Auto-fix:** add a row |
| 2 | **Dead link** — an intent-table / map link whose target path no longer exists | **Auto-fix if relocated; flag if deleted** |
| 3 | **Missing operate-doc** — a project sub-folder that has neither `CLAUDE.md` nor `README.md` while its siblings do | **Auto-fix:** scaffold a minimal `README.md` stub |
| 4 | **Stale `decisions.md`** — an entry contradicted by the current code/structure, or describing something that no longer exists | **Flag only — never auto-edit the log** |

### The fix / flag rule

Fix the structural & navigation drift; **never rewrite the decisions log**. Auto-edits are reversible (`git diff` → discard), so favour fixing — but a decisions log is history, and silently editing history is wrong. Checks 1–3 get repaired; check 4 (and any genuinely ambiguous case) is reported for a human call.

## Procedure

Work one repo at a time.

1. **Parse the map.** Read the repo's root `CLAUDE.md`. Extract every link in the "Find it fast" table and any map/intent links in the imported `README.md`. Build the set of `(intent, target-path)` pairs.

2. **Enumerate reality.** List the actual top-level folders. For repos grouped into buckets (`apps/`, `tooling/`, `infra/`, …), also list the project sub-folders one level down inside each bucket. Note which carry a `CLAUDE.md` and/or `README.md`.

3. **Run the four checks** by diffing the map against reality.

4. **Auto-fix (checks 1–3):**
   - **Unmapped folder →** read that folder's `README.md`/`CLAUDE.md` (first heading + intro) to write an accurate one-line description, then insert a new intent-table row in the right place (preserve table column alignment and the existing row ordering/grouping). Don't invent a purpose — derive it from the folder's own docs; if it has none, write a terse factual description from its contents and *also* flag it under check 3.
   - **Dead link, relocated →** find the target by basename elsewhere in the tree; if there's exactly one unambiguous match, repoint the link to the new path. If multiple candidates, flag instead.
   - **Dead link, deleted (no relocation found) →** flag it (don't delete the row blind — the intent may still matter).
   - **Missing operate-doc →** create a minimal `README.md` in that folder: an `# <folder-name>` title and a one-line factual description of what it contains, derived from its files. Mark in the report that it's a stub to flesh out.

5. **Verify your own edits.** After editing a `CLAUDE.md`, re-read the table region to confirm it's still valid, aligned markdown and you didn't break adjacent rows.

6. **Collect flags (check 4 + ambiguous cases):** scan `decisions.md` for entries that contradict current structure (e.g. a decision referencing a moved/removed path, or two entries that conflict). List them with the reason — do not edit.

7. **Report** (see format). 

8. **Never** `git add`, `git commit`, or `git push`. Leave all changes in the working tree for the user to review and commit themselves (e.g. via `commit-now`).

## Output format

Print to the terminal. Lead with a status line per repo.

**Clean repo:**
```
✅ personal-stuff — routing healthy, no drift.
```

**Drift found:**
```
⚠️ personal-stuff — 3 fixed, 1 flagged

FIXED (review with `git diff`):
  • [unmapped] apps/spending-tracker/ — added intent-table row → apps/spending-tracker/
  • [dead link] moved tooling/mcp/README → tooling/mcp/ (relocated)
  • [missing doc] scaffolded README.md stub in tooling/cli/drive/  (flesh out the one-liner)

FLAGGED (your call — not changed):
  • [decisions.md] line 42 "tracker uses MongoDB" contradicts current D1/Cloudflare setup — stale?
```

End the whole run with one line:
```
Nothing committed. Review with `git diff`, then commit what you want (e.g. /commit-now).
```

Keep it scannable — one line per item, path-first, no prose padding. If a repo was skipped because its path is missing, say so explicitly.

## Guardrails

- Read-only on `decisions.md` — flag, never edit.
- Don't touch code, config, or anything outside the navigation artifacts.
- Don't reformat a whole `CLAUDE.md`/`README.md` — make the minimal targeted edit for each fix.
- Never commit or push. The user reviews the diff.
- When a fix would require guessing intent (ambiguous relocation, a folder with no docs to describe it), flag it instead of guessing.

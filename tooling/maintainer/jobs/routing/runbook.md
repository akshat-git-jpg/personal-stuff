# Routing Job Runbook

## What the map is
Each repo's root `CLAUDE.md` contains a "Find it fast" intent table: a markdown table mapping an intent ("If the ask is about…") to a link (a folder or file). That table plus the imported `README.md` map is the routing surface. `decisions.md` is the append-only decision log. Sub-folders are expected to carry a `CLAUDE.md` (how Claude operates there) and/or a `README.md` (what it is).

## The four checks

| # | Check | Action |
|---|---|---|
| 1 | **Unmapped folder** — a top-level or notable project folder with no row in the intent table and not covered by the README map | auto-fix: add a row |
| 2 | **Dead link or false structural claim** — a link whose target no longer exists, or prose asserting structure that is not there | auto-fix if relocated; flag if deleted |
| 3 | **Missing operate-doc** — a project sub-folder with neither `CLAUDE.md` nor `README.md` while its siblings have one | auto-fix: scaffold a `README.md` stub |
| 4 | **Stale `decisions.md`** — an entry contradicted by the current structure | **flag only, never auto-edit** |

## Exemptions
Exemptions (not projects, never audited): `plans/runs/`, any `fixtures/`, `venv/`, `node_modules/`, `archive/`, and dot-folders.

## superseded ≠ stale
`superseded ≠ stale` (an entry overridden by a LATER entry is settled history, not drift).

## 5. Missing routes
A question someone would plausibly ask that the intent table cannot answer. Three shapes, and only these three:

- **an unanswerable question** — a folder is mapped, but no row phrases the intent someone would actually search for
- **a row too vague to route on** — the destination is right but the "If the ask is about…" text would not match a real question
- **a row pointing at a file where a folder is the real home**, or the reverse

A missing route is an **improvement, never a defect.** It is reported under `improve` and is never auto-fixed. Do not propose a row for anything on the exemptions list.

## Report-only mode
This is a **report-only** run: no edits, no git writes, no waiting for input, output is a plain-text report on stdout.

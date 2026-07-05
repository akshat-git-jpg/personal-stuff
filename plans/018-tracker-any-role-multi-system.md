# Plan 018: Tracker — let any role be held in multiple systems

> **Executor instructions**: Follow this plan step by step. Run every
> verification command. Stop and report on any STOP condition. Update the
> status row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat fe324e0..HEAD -- apps/tracker-app/src/worker/index.ts apps/tracker-app/src/shared/engine/memberships.ts apps/tracker-app/src/client/TeamPanel.tsx`
> (index.ts will show heavy drift from plans 015–017 — expected; the section
> this plan touches is the `/api/team` role guard.)

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 015–017 committed
- **Category**: feature
- **Executor**: antigravity
- **Difficulty**: mechanical
- **Planned at**: commit `fe324e0` (+ tracker-revamp batch), 2026-07-05

## Why this matters

The owner wants any person to hold any combination of roles across multiple
systems (e.g. Scriptwriter in both Standard and Tut 2) — the tracker will run
several channels with overlapping freelancers. The engine ALREADY supports
this: authority is resolved per card via `effectiveRoles(m, systemId)`
(`src/shared/engine/memberships.ts:25-27`), the My Work inbox spans systems,
and seed persona John holds doer roles in two systems and works correctly.
The ONLY blocker is a write-path guard on the Team API that rejects the same
doer role in two systems, plus UI copy stating that rule.

## Current state

1. `src/worker/index.ts` `/api/team` (~lines 218-226):

```ts
  // A doer role belongs to exactly ONE system (Reviewer may span systems).
  ...
        return c.json({ error: `${r} can only belong to one system — it's set in both ${...} and ${...}.` }, 400);
```

2. `src/shared/engine/memberships.ts` — header comment lists the rule
   ("a doer role is held in exactly ONE system", lines 10-12), and
   `homeSystem()` (lines 55-64) exists solely on that assumption. It has
   **zero call sites** (`grep -rn "homeSystem" src/` matches only the
   definition).

3. `src/client/TeamPanel.tsx` copy: line ~165 ("Doer roles belong to one
   system. To let a reviewer cover several systems…") and ~261 ("Manage these
   per system in the tabs above…" — this one is fine, keep it).

4. `apps/tracker-app/CLAUDE.md`, "System-scoped team" bullet: "A doer role
   lives in exactly one system; **Reviewer** may be held in several".

## Scope

**In scope**: `src/worker/index.ts` (only the /api/team guard), `src/shared/engine/memberships.ts`, `src/client/TeamPanel.tsx` (copy only), `apps/tracker-app/CLAUDE.md` (one sentence), `test/engine.test.ts`.
**Out of scope**: everything else — RBAC, My Work, assignment dropdowns (already system-scoped via `holdsRoleInSystem`), the seed.

## Steps

1. **Remove the guard** in `/api/team`: delete the same-role-in-two-systems
   400 rejection and its comment. KEEP the "assign at least one role in one
   system" 400 (line ~232).
   **Verify**: `npx tsc -p tsconfig.worker.json --noEmit` → exit 0.
2. **memberships.ts**: delete the unused `homeSystem()` function; rewrite the
   header rules to: doer + Reviewer roles may be held in any number of
   systems; Admin stays cross-system under `"*"`.
   **Verify**: `npm run build` → exit 0 (confirms no hidden importer).
3. **TeamPanel.tsx** line ~165: replace the sentence with: "Any role can be
   held in several systems — add the person from each system's tab."
4. **CLAUDE.md**: update the quoted sentence to say any role may span systems
   (Admin remains the cross-system `"*"` membership).
5. **Test** in `test/engine.test.ts`: a membership set
   `{ "standard": ["Scriptwriter"], "tut-2": ["Scriptwriter"] }` yields
   `effectiveRoles(m,"standard") = ["Scriptwriter"]`,
   `effectiveRoles(m,"tut-2") = ["Scriptwriter"]`, and
   `systemsForRole(m,"Scriptwriter") = ["standard","tut-2"]`.
   **Verify**: `npm test` → all pass.
6. Manual: dev:local as Sean → Team tab → give Sam `Scriptwriter` in Tut 2
   (he already has it in Standard) → saves without error; Sam's My Work then
   shows Tut 2 outline cards when assigned.

## Done criteria

- [ ] `npm test` + `npm run build` pass.
- [ ] Saving the same doer role in two systems via the Team UI succeeds.
- [ ] `grep -rn "homeSystem" apps/tracker-app/src` → no matches.
- [ ] CLAUDE.md + TeamPanel copy no longer state the one-system rule.

## STOP conditions

- `homeSystem` turns out to HAVE a call site → stop, report it (don't refactor around it).
- Removing the guard breaks any existing test that deliberately asserts the 400 → update only if the test's purpose was that guard; otherwise stop.

## Maintenance notes

- Reviewer/doer distinction in memberships is now purely about queue behavior,
  not write rules. Future systems need no thought here.

## Git workflow

- Branch: `advisor/014-tracker-revamp` (continue).
- Commit: `feat(tracker-app): allow any role across multiple systems` — no AI footers. Do NOT push.

---
executor: agy
model:
test_cmd: cd apps/tutorial-tracker-app && npm run seed:local && npm run e2e -- e2e/team.spec.ts
ui: true
deploy: cd apps/tutorial-tracker-app && npm run deploy
needs: Independent — touches no file that 213-216 touch. Dispatch in parallel.
needs_prs: []
touches: [apps/tutorial-tracker-app/src/client/TeamPanel.tsx, apps/tutorial-tracker-app/src/client/AssignmentDefaults.tsx, apps/tutorial-tracker-app/e2e/team.spec.ts]

mutation_apply:
mutation_command:
mutation_expect:
mutation_cwd:
mutation_timeout:
---

# Plan 217: Tracker — bring Team and Assignment defaults up to the new design

## Summary

- **Problem statement**: The two admin settings screens never got the redesign. `TeamPanel.tsx` (269 lines) and `AssignmentDefaults.tsx` (188 lines) still use the pre-redesign density — dropdown rows, pill chips above titles, no dark-mode check — while every other screen moved on. `AssignmentDefaults` is also now load-bearing: plan 215 pre-fills a new video's people from it, so a confusing defaults screen becomes a confusing create screen.
- **Goals**: Match the shipped visual vocabulary. Make the per-system membership model legible. Give the defaults screen a preview of what a new video would inherit.
- **Executor proposed**: agy, executor default model — mechanical: no new logic, existing data model, existing components.
- **Done criteria** (terse): both screens match the shipped card/typography/spacing vocabulary, readable in dark mode, defaults screen previews the inherited people, new e2e spec green.
- **Stop conditions** (terse): the membership write path (`saveTeamMember`) would need to change.
- **Test / verification for success**: `e2e/team.spec.ts` drives both screens and asserts the defaults preview reflects a change.
- **Open points for plan readiness**: `mutation_apply` blank — presentation plan, no new gate logic. The e2e spec plus the existing suite is the gate.

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in the "STOP conditions" section occurs, stop and report. When
> done, update the status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 4a9c75c6..HEAD -- apps/tutorial-tracker-app/src/client/TeamPanel.tsx apps/tutorial-tracker-app/src/client/AssignmentDefaults.tsx`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Difficulty**: mechanical
- **Planned at**: commit `4a9c75c626e6`, 2026-08-21

## Why this matters

These are the last two screens still speaking the old dialect. They are also where the owner sets the rules that plan 215 leans on, so their clarity now affects the create flow.

## Current state

- `src/client/TeamPanel.tsx` — the admin **Team** tab. People are membership-grained: one row per `(email, system_id)`, `role` a comma-joined list held **in that system**. `Admin` is a cross-system `"*"` membership (founder only, auto-preserved). Writes go through `saveTeamMember({ name, email, memberships })` and `deleteTeamMember(email)` in `src/client/api.ts`. The panel is system-tabbed.
- `src/client/AssignmentDefaults.tsx` — edits `assignment_defaults`, keyed by `pipeline_id` + category + subcategory. `applyDefaults(row_id)` fills a card's blank assignee/reviewer columns from it.
- The shipped vocabulary to match (commits `516d233b`, `4a9c75c6`): cards are `rounded-[10px] border border-border bg-card p-4 shadow-xs`; titles `text-[15px]`–`text-[17px] font-semibold leading-snug tracking-tight`; one meta line at `text-xs text-muted-foreground` **under** the title, never a row of pills above it; a single primary action per row; blocked primary buttons render inert grey, not faded accent (`src/components/ui/button.tsx`).
- Dark tokens exist in `src/client/globals.css` under `.dark`. The owner uses dark mode. Check both.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `cd apps/tutorial-tracker-app && npm run typecheck` | exit 0 |
| Lint | `cd apps/tutorial-tracker-app && ./node_modules/.bin/eslint src/client/TeamPanel.tsx src/client/AssignmentDefaults.tsx` | no new errors |
| Unit tests | `cd apps/tutorial-tracker-app && npm test` | 209+ passed |
| Seed | `cd apps/tutorial-tracker-app && npm run seed:local` | `-- applied to local D1` |
| e2e | `cd apps/tutorial-tracker-app && npm run e2e` | all pass |
| Screenshots | `cd apps/tutorial-tracker-app && npm run shot -- sean docs/flow/shots/217-team.png` | prints the path |

## Scope

**In scope**:
- `src/client/TeamPanel.tsx` — presentation
- `src/client/AssignmentDefaults.tsx` — presentation, plus the inherited-people preview
- `e2e/team.spec.ts` — new
- `docs/flow/shots/217-team.png` — new

**Out of scope**:
- `saveTeamMember` / `deleteTeamMember` / `applyDefaults` and their worker routes
- The membership data model, the `"*"` Admin rule, `holdsRoleInSystem`
- Any other client file

## Git workflow

- Branch: `advisor/217-tracker-team-and-defaults`
- Commit: `feat(tracker): team and defaults screens` — no AI footers. Do NOT push.

## Steps

### Step 1: Team — one card per person, roles read as sentences

Each teammate becomes one card: name as the title, email as the meta line under it, then their roles grouped by system as quiet text (`Standard: Scriptwriter, Recorder · Tut 2: Scriptwriter`), not a wall of chips. Edit stays inline. Deleting keeps its confirm.

Make the `"*"` Admin membership visibly different and non-editable, with a one-line reason.

**Verify**: `cd apps/tutorial-tracker-app && npm run typecheck` -> exit 0

### Step 2: Defaults — show what a new video would inherit

Keep the category x subcategory editing model. Add, under the row being edited, a live preview line: `A new video here starts with: Sam (script), Anusha (recording), John (editing), Tara (thumbnail), Uma (upload), Riya (reviewer)` — and name any role with **no** default, because that is the gap plan 215's create screen will make the admin fill by hand.

**Verify**: `cd apps/tutorial-tracker-app && ./node_modules/.bin/eslint src/client/AssignmentDefaults.tsx` -> no new errors

### Step 3: Dark mode

Open both screens with `.dark` on the root. Fix anything using a raw colour instead of a token — grep both files for `bg-white`, `text-black`, and any bare `#` hex, and replace with the semantic token.

**Verify**: `grep -nE "bg-white|text-black|#[0-9a-fA-F]{3,6}" src/client/TeamPanel.tsx src/client/AssignmentDefaults.tsx` -> no matches

### Step 4: The e2e spec

Create `e2e/team.spec.ts`:

1. Log in as `PERSONAS.sean`, open the **Team** tab, assert a known seeded teammate's name and their system-scoped roles are visible.
2. Open the defaults screen, assert the inherited-people preview line is visible.
3. Change one role in a default and assert the preview line updates to match.

**Verify**: `cd apps/tutorial-tracker-app && npm run seed:local && npm run e2e -- e2e/team.spec.ts` -> passes

### Step 5: Screenshot

```bash
cd apps/tutorial-tracker-app && npm run shot -- sean docs/flow/shots/217-team.png
```

The shot script lands on the default tab; extend it with an optional selector to click, or capture with a short throwaway script. The PNG must be committed.

## Test plan

1. `npm run typecheck` — exit 0
2. `eslint` on both files — no **new** errors (they carry pre-existing ones; record the before/after counts in the PR body)
3. `npm test` — 209+ passing
4. `npm run seed:local && npm run e2e` — every spec passes
5. Step 3's grep returns nothing

## Done criteria

- [ ] Team is one card per person, title-first, roles grouped by system in words
- [ ] The `"*"` Admin membership is visibly special and not editable
- [ ] Defaults shows a live "a new video here starts with…" preview, naming gaps
- [ ] Both screens readable in dark mode, no raw colours
- [ ] `e2e/team.spec.ts` passes; all pre-existing specs pass
- [ ] No new lint errors in either file
- [ ] `docs/flow/shots/217-team.png` committed

## STOP conditions

- The preview needs a server round-trip that does not exist — report rather than adding a route
- `saveTeamMember`'s payload shape would have to change
- Any pre-existing e2e spec fails

## Maintenance notes

- Membership is per `(email, system_id)`. A person legitimately appears once per system they work in; that is not duplication and the UI should not collapse it away.
- The defaults preview is the same lookup plan 215's create screen uses. If one changes, check the other.

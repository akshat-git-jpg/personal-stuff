# Plan 019: Tracker — per-stage time visibility for everyone (who holds the ball, since when)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command. Stop and report on any STOP condition. Update the
> status row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git log --oneline -3` must show the round-2
> closeout commits (plans 016+017 committed, plan 018 committed). If 016/017
> are still uncommitted, STOP — this plan builds on them.

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: 016, 017 committed (round 2 done)
- **Category**: feature
- **Executor**: antigravity
- **Difficulty**: standard
- **Planned at**: 2026-07-05, on branch `advisor/014-tracker-revamp`

## Why this matters

The owner wants **everyone** — freelancers, reviewers, admin — to see when each
step last moved, so it's obvious which step is stuck and on whom (doer,
reviewer, or admin). Today: per-stage `status_since` is stamped in D1 and
surfaced as `<statusCol>_since` flat columns, but the board route attaches
them **admin-only**; the dwell chip on cards reads the CARD-level
`status_since` (last change on any stage), which is wrong per item; and the
My Work "Waiting on review" items don't say how long or with whom. The exact
history exists in the activity thread, but at-a-glance timing is missing.

## Current state

- `src/worker/index.ts` board route: rows attach `status_since` for everyone,
  and (from plan 016) the per-stage `*_since` keys only when the viewer is
  admin. Find the round-2 code that re-attaches keys ending `_since` under an
  admin condition.
- `src/client/Card.tsx:43-45`: dwell chip —
  `const dwell = showDwell ? daysSince((row as Record<string, string>).status_since) : null;`
  → card-level, not per-stage. The chip renders at lines 70-74 with title
  "In <status> since Nd".
- `src/client/MyWork.tsx`: builds `WorkItem { row, statusCol, stage, pipeline, status, upcoming? }`
  per item and renders sections Needs your review / Needs your action /
  Waiting on review / Up next / Done using `<Card>`.
- `src/client/CardDetail.tsx`: journey rail (from plan 015) renders one node
  per stage: done ✓ / active highlighted / locked future.
- Helpers available via `src/client/stages.ts`: `reviewerColOf(stage)`,
  `assigneeColOf(stage)`, `colOf(stage, "status")`, `isBrief(stage)`;
  `displayName(email, names)` in `api.ts`.
- Status → holder semantics (the "ball"): `To Do` / `In Progress` /
  `Need Changes` → the stage's **assignee** (brief stage → Admin);
  `In Review` → the stage's **reviewer**; done statuses → nobody.

## Scope

**In scope**: `src/worker/index.ts` (the `_since` attach condition only),
`src/client/Card.tsx`, `src/client/MyWork.tsx`, `src/client/CardDetail.tsx`,
`src/client/ReviewQueue.tsx`, a small shared helper in `src/client/stages.ts`
or `labels.ts`, `e2e/board.spec.ts` (one assertion).
**Out of scope**: datastore/schema (per-stage stamping already works), the
attention panel (already time-aware), activity thread, legacy `src/shared/*`.

## Steps

1. **Server: send `*_since` to everyone.** Remove the admin-only condition on
   re-attaching the `_since` keys in the board route (attach them for every
   row, exactly like `status_since`). Timestamps carry no confidential data;
   row/column visibility is already enforced elsewhere.
   **Verify**: `npx tsc -p tsconfig.worker.json --noEmit` → exit 0.

2. **Shared helper** (in `src/client/stages.ts`, exported):

```ts
/** When this stage's status last changed; falls back to the card-level stamp. */
export function sinceOf(row: Record<string, unknown>, statusCol: string): string {
  return String(row[`${statusCol}_since`] ?? "") || String(row["status_since"] ?? "");
}

/** Who currently holds this stage: its assignee (doing) or reviewer (reviewing). */
export function holderOf(stage: StageDef, row: Record<string, unknown>, status: string):
    { kind: "doer" | "reviewer" | "none"; email: string } {
  const done = lifecycle(stage.lifecycle).done;
  if (status === done || status === "Uploaded") return { kind: "none", email: "" };
  if (status === "In Review") return { kind: "reviewer", email: String(row[reviewerColOf(stage) ?? ""] ?? "") };
  return { kind: "doer", email: String(row[assigneeColOf(stage)] ?? "") };
}
```

   (Adjust imports to the file's existing re-export pattern; `lifecycle` comes
   from the engine.)
   **Verify**: `npm run build` → exit 0.

3. **Card.tsx: per-stage dwell.** The dwell chip must use
   `sinceOf(row, statusCol)` (Card already receives `statusCol`). Chip title:
   "In <status> for Nd". Keep `showDwell` gating as-is.

4. **MyWork items: time + holder.**
   - Needs your action: keep the dwell chip (now per-stage); on `Need Changes`
     items add muted text "sent back Nd ago".
   - Waiting on review: subtitle becomes "With <reviewer name> · Nd" using
     `holderOf` + `displayName`; if the reviewer column is blank or not
     visible on the row, render "With reviewer · Nd".
   - Up next: unchanged except the gate stage's wait: "opens after <gate
     label> — in <gate status> for Nd" via `sinceOf` on the gate stage.
   **Verify**: `npm run build`; seeded local — a `test-*-in-review` card shows
   "With Riya · Nd" for its doer persona.

5. **Journey rail (CardDetail): timestamps per node.** Under each node's
   label: active stages show "Nd in <status>" plus the holder's display name
   ("with Sam" / "with Riya"); done stages show the date they completed
   (`sinceOf` value, short date). Locked future stages: nothing. Keep it
   subtle (existing muted 11px idiom).

6. **ReviewQueue rows**: append "submitted Nd ago" (sinceOf of the item's
   statusCol — it entered In Review then). Data: queue items carry `row` +
   `statusCol` already.

7. **e2e**: extend one existing spec: after seeding, Sam's Waiting-on-review
   (or the seeded in-review test card) shows text matching /With .+ · \d+d/
   or "submitted"; keep it loose enough to survive reseeds.
   **Verify**: `npm run seed:local && npm run e2e` → all pass, twice in a row.

## Test plan

- e2e assertion (step 7); full suite `npm test` stays green.
- Manual: dev:local as Sam — an In-Review item shows reviewer + days; as Sean
  the journey rail on any `test-` card shows per-stage days and holders.

## Done criteria

- [ ] `npm test`, `npm run build`, double `seed + e2e` pass.
- [ ] A freelancer (non-admin) board response contains `*_since` keys (check
      the network tab or a dev-login fetch).
- [ ] My Work In-Review items show "With <name> · Nd"; Need-Changes items show
      "sent back Nd ago"; journey rail shows per-stage timing + holder.
- [ ] Dwell chip on an item reflects that ITEM's stage, not the card's last
      touch (verify on a card with two stages changed on different days —
      the `test-` matrix has them).

## STOP conditions

- If `*_since` keys are absent from rows even for admin (round-2 code drifted
  or missing), stop and report — the server prerequisite isn't there.
- If reviewer emails turn out to be hidden from doers by column projection
  (name can't render), fall back to "With reviewer · Nd" — do NOT widen
  column visibility to fix it.

## Maintenance notes

- `holderOf` is the single ball-in-court definition — the attention panel
  (016) and any future digest should migrate to it if their logic ever
  diverges.
- Timestamps come from stage-status writes only; content edits don't reset
  dwell (intended — dwell measures pipeline movement, not typing).

## Git workflow

- Branch: `advisor/014-tracker-revamp` (continue).
- Commit: `feat(tracker-app): per-stage time + holder visibility everywhere` — no AI footers. Do NOT push.

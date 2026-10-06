# The feedback loop: shared gates and phases

Shared by `yt-video-edit-feedback` and `yt-script-feedback`. Each skill's SKILL.md
adds its own sources (Phase 1), root-cause shapes (Phase 2), summary-table columns
and execute steps (Phase 5). The parts below are identical for both.

## Hard gates (check before anything)

1. **Opus-class only.** Folding feedback into durable rules is judgment work (owner
   decision, 2026-07-18). If the current session is not Opus-class, say so and stop.
2. **Never skip the discussion.** Phases 2–4 are the point of the skill. Do not jump
   from "feedback is done" to editing files, however obvious a fix looks.
3. **One approval gate, and it is explicit.** No file changes before the owner
   approves the Phase 4 summary. "Sounds good" on a single item is not approval of
   the batch.
4. **Never fold mid-run of another video.** Rule surfaces change between videos,
   through this fold, never during an operating session.

## Phase 3 — Discuss

The owner often asks questions inside the feedback ("why did this happen?", "what's
the long-term fix?"). **Answer them directly**: they are part of the deliverable,
not noise around it.

Then propose the solve per item and let the owner push back. Bring:

- the root cause in one sentence;
- the surface you propose to change, and why that one (the fold step's routing
  table decides);
- whether it is an instance fix or a rule, and why;
- anything you cannot fix and why;
- any place two owner instructions conflict. Surface it; do not silently pick.

Conflicts are real and must not be resolved unilaterally. On visuals-flow test-01
the owner rejected `overlay/callout`, the session built `keyword-pop` as its
replacement, and the owner then rejected that too with "no need to have this **or
alternative**", while the session had meanwhile expanded it from 6 uses to 9. Ask;
do not infer.

## Phase 4 — Summary and approval

One message. Every item in one table (columns are set by each skill), then,
separately and plainly:

- **Rule changes** — what future videos will do differently.
- **Instance fixes** — this video only, no rule.
- **Routed to a plan** — architectural or code items, via `orchestrate`, with the
  plan number.
- **Not fixing** — with the reason.
- **Open questions** — anything still blocking.

End by asking for approval to proceed. Stop. Do not edit files yet.

# Tutorials Tracker — Product Audit & Gap Analysis

**Date:** 2026-05-29
**Author:** product audit across Freelancer / Reviewer / Admin perspectives
**Scope:** the whole workflow as built (RBAC board, gated handoffs, submit→approve→send-back, approvals queue, view-as).

---

## 0. The one-line diagnosis

The app today is a **faithful, secure mirror of the sheet** — it shows the right data to the right person and enforces who can change what. But it is **passive**: it shows *state*, not *what to do, when, or on what*. Three themes capture almost every gap:

1. **Clarity** — when I open something, what exactly am I supposed to act on? (the artifact, attribution, the one field that's mine)
2. **Notification** — how do I find out there's something waiting for me, without remembering to open the app?
3. **Oversight** — as the admin, where is the pipeline stuck and who's holding it up?

Everything below ladders up to those three.

---

## 1. Personas & their core job (JTBD)

| Persona | Core job |
|---|---|
| **Tutorial Maker** (script writer) | "Write the script for my assigned videos and hand them off cleanly." |
| **Video Editor** | "Take an approved script, edit the video, hand it off." |
| **Reviewer** (approver) | "Quickly judge submitted work, approve it or bounce it back with clear feedback." |
| **Admin** | "Keep the whole pipeline moving — assign work, unblock, and see what's stuck." |

---

## 2. Happy-path journeys (as built)

- **Tutorial Maker:** log in → see my tutorials → open one → read brief → write script elsewhere → paste public link → drag to "Submitted for review."
- **Editor:** approved script appears → open → read script (read-only) → edit → paste video link → submit.
- **Reviewer:** open "Awaiting approval" → click item → *(card opens)* → approve / send back + note.
- **Admin:** view all, switch board views, "View as" any teammate, approvals queue.

These work. The gaps are in the seams.

---

## 3. Gap audit

Severity: **P0** = confusing/blocking now · **P1** = needed for real daily use · **P2** = scale / polish.

### A. The Reviewer's review moment (the trigger for this audit)

- **[P0] No "what am I reviewing" focus.** Opening a queued card shows the whole detail panel. The reviewer can't instantly tell: *is this a script or an edit? who submitted it? which field/link is the thing to judge?* They have to hunt among many fields.
  → **Fix:** a **focused review header** — "Reviewing: **Script** · submitted by **Sam**" — and surface the **artifact to review** as the first, prominent element. Everything else (other stage's fields, metadata) is collapsed/de-emphasized.
- **[P0] Links are plain text, not clickable.** Every link (script, video, YouTube) renders as a raw URL string. The reviewer/editor must select-copy-paste it into a new tab. The single most-used action in a review is "open the thing" — it should be a one-click **"Open script ↗" / "Open video ↗"** button.
- **[P1] No attribution anywhere prominent.** "Who made this?" matters for reviewing and for chasing. The submitter's name should be on the card and in the queue.
- **[P1] Reviewer sees both stages' fields at once.** With broad visibility, a script review still shows editor fields (and vice-versa) — irrelevant noise during a focused review.
- **[P1] Reviewer lands on the wrong thing.** Their default view is the kanban (upload board, often empty). Their *actual job* is the approvals queue — that should be their landing view.

### B. Freelancer (Tutorial Maker / Editor)

- **[P0] No notification when work is sent back.** Feedback is in-app only; a freelancer who isn't staring at the app has no idea their work bounced. This silently stalls the pipeline — the exact "back-and-forth" cost we're trying to kill.
  → **Fix:** a push (Telegram/ntfy/email) on **sent-back** (to the freelancer) and **assigned** (new work).
- **[P1] No two-way clarification.** Feedback is a single latest note, one-directional. If the brief is unclear, the freelancer can't ask — they guess or go off-app. Consider a lightweight comment/question affordance, or at least an "ask admin" path.
- **[P1] "Submit" is implicit.** Submitting = dragging to a lane / picking a dropdown value. There's no explicit, reassuring "Submit for review" action, and no confirmation. Easy to mis-drag; unclear it "counts."
- **[P1] No "what's pending" feedback.** After submitting, the freelancer gets no sense of "submitted, waiting on review" (or how long). The Done lane shows approved; the In-Review lane shows submitted — but there's no explicit "you're waiting on the reviewer" state.
- **[P2] Empty board has no guidance.** A freelancer with nothing assigned sees an empty board, not "Nothing assigned yet — you'll see videos here when the admin assigns you."

### C. Admin

- **[P1] Assignment is raw email editing.** To assign a maker/editor/reviewer, the admin types an email into a field. Error-prone (typos = no access/visibility). Should be a **picker of teammates** from the Employes tab.
- **[P1] No way to add a video/topic in-app.** New videos must be added in the sheet. Either add an in-app "New video" action or make the sheet-dependency explicit in the UI.
- **[P1] No pipeline pulse / bottleneck view.** Admin can't see "3 scripts waiting >2 days," "this editor has 8 open," or where the queue is backing up. No aging, no per-person load, no counts per stage. This is the admin's core job and it's invisible.
- **[P2] No timestamps / audit trail.** No "submitted at," "approved by/at," "last moved." Hurts accountability and any future SLA. (The sheet doesn't capture it today.)
- **[P2] Admin default view is the topic pipeline** (least actionable). A cross-stage overview would be a better landing.

### D. Cross-cutting (system / trust / scale)

- **[P0 for go-live] `DEV_AUTH` bypass must be OFF in production.** The preview/dev-login must never ship enabled. (A pre-deploy checklist item.)
- **[P1] Notifications, generally.** The whole loop assumes people open the app. For a low-frequency tool, they won't. Notifications (you already run ntfy/Hermes/Telegram) are the highest-leverage fix for end-to-end flow.
- **[P1] No timestamps means no staleness signal** (see admin).
- **[P2] Mobile.** Freelancers will check on phones; a horizontal drag-kanban is rough on mobile. A simple list/stacked view on small screens.
- **[P2] Search / filter at scale.** The sheet has ~1000 rows. As real volume grows, the board needs filter (by category, assignee, date) and/or search.
- **[P2] Link validation.** The public-link reminder is advisory; we can at least validate it's a URL (can't verify "public" without fetching).
- **[P2] Concurrency.** 60s cache + last-write-wins is fine at 5 people; note it.
- **[P2] topic_status overlap with the existing Python automation.** `process_yt_tracker` writes topic_status (To Process→To Review). The app also exposes topic_status. Clarify ownership so they don't fight.

---

## 4. The focused-review card (design for the P0 trigger)

When a card is opened **for review of a specific stage** (from the approvals queue):

```
┌─────────────────────────────────────────────┐
│  Reviewing:  ● Script        submitted by Sam │   ← stage + attribution
│  "heygen — AI avatar walkthrough"             │
├─────────────────────────────────────────────┤
│  THE BRIEF                                    │
│   Notes: Cover signup, pricing… (collapsed)   │   ← context, de-emphasized
├─────────────────────────────────────────────┤
│  ▶  Open the script  ↗                        │   ← THE artifact, big + clickable
│      (tutorial_link)                          │
├─────────────────────────────────────────────┤
│  Feedback (if sending back)  [____________]   │
│   [ ✓ Approve ]   [ ↩ Send back ]             │   ← decision, right here
└─────────────────────────────────────────────┘
```

Same pattern for an **Edit** review (artifact = the video link). Unrelated fields collapse. This turns "hunt through columns" into "open the thing → decide."

And **everywhere** (not just review): render link fields as clickable "Open ↗" actions.

---

## 5. Recommended roadmap

**P0 — do next (clarity, low effort, high impact):**
1. Focused review card: stage + "submitted by" header, artifact-first, decision inline.
2. Clickable links everywhere ("Open ↗") — read-only and editable.
3. Reviewer lands on the approvals queue by default.

**P1 — makes it actually usable day-to-day:**
4. Notifications (Telegram/ntfy) on: sent-back, assigned, submitted (to reviewer). Highest leverage.
5. Teammate **picker** for assignment (no raw email typing).
6. Admin **pipeline overview**: counts per stage, items aging, per-person load.
7. Explicit "Submit for review" action + "waiting on reviewer" state for freelancers.

**P2 — scale & polish:**
8. Timestamps / light audit (submitted-at, approved-by).
9. Mobile list view.
10. Filter/search.
11. In-app "New video" + topic_status/automation clarification.
12. Pre-deploy hardening (DEV_AUTH off, etc.).

---

## 6. Suggested first batch

Ship the **P0 trio** (focused review card + clickable links + reviewer-defaults-to-queue) as one pass — it directly fixes the confusion you hit and is mostly frontend. Then tackle **notifications** (P1 #4) as the next, since it's the single biggest unlock for the real back-and-forth problem.

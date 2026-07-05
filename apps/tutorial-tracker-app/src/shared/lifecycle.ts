// ===========================================================================
// STATUS LIFECYCLES — the state machine as data.
//
// Each lifecycle is an ordered list of statuses (its board lanes) plus the
// allowed transitions between them. A transition says who performs it (doer vs
// reviewer), its button label + kind, whether it's gated on required fields
// (`gate`), and whether it needs a send-back note (`needsFeedback`).
//
// `transitionsForStage` (rbac.ts) iterates this table instead of hard-coded
// if/else branches, and `statesFor` (pipeline.ts) derives lanes from it. To add
// a status, rename a button, or change who can move a card — edit here.
//
// Three lifecycles, picked by stage shape (see lifecycleFor):
//   review       reviewable stage WITH a feedback column  (Script/Recording/Editing/Thumbnail)
//   approveOnly  reviewable stage WITHOUT feedback         (Topic — approve-only, no send-back)
//   terminal     non-reviewable final stage               (Upload)
// ===========================================================================

export type By = "doer" | "reviewer";
export type TransitionKind = "start" | "submit" | "approve" | "reject" | "advance" | "reopen";
/** Which required-field set (from control.ts) blocks this move until filled. */
export type GateKind = "submit" | "approve";

export interface LifecycleTransition {
  from: string;
  to: string;
  kind: TransitionKind;
  by: By;
  label: string;
  gate?: GateKind;          // omitted = no required-field gate (e.g. "Resume editing")
  needsFeedback?: boolean;  // a send-back note is required to perform it
}

export interface Lifecycle {
  id: "review" | "approveOnly" | "terminal";
  statuses: readonly string[];   // ordered lanes
  done: string;                  // the "complete" status that opens the next stage's gate
  transitions: LifecycleTransition[];
}

export const REVIEW_LIFECYCLE: Lifecycle = {
  id: "review",
  statuses: ["To Do", "In Progress", "In Review", "Need Changes", "Done"],
  done: "Done",
  transitions: [
    { from: "To Do",        to: "In Progress",  kind: "start",   by: "doer",     label: "Start", gate: "submit" },
    { from: "In Progress",  to: "In Review",    kind: "submit",  by: "doer",     label: "Submit for review", gate: "submit" },
    { from: "Need Changes", to: "In Progress",  kind: "start",   by: "doer",     label: "Resume editing" },
    { from: "Need Changes", to: "In Review",    kind: "submit",  by: "doer",     label: "Resubmit for review", gate: "submit" },
    { from: "In Review",    to: "Done",         kind: "approve", by: "reviewer", label: "Approve", gate: "approve" },
    { from: "In Review",    to: "Need Changes", kind: "reject",  by: "reviewer", label: "Request changes", needsFeedback: true },
    { from: "Done",         to: "Need Changes", kind: "reopen",  by: "reviewer", label: "Reopen (request changes)", needsFeedback: true },
  ],
};

export const APPROVE_ONLY_LIFECYCLE: Lifecycle = {
  id: "approveOnly",
  statuses: ["To Do", "In Progress", "In Review", "Done"],
  done: "Done",
  transitions: [
    { from: "To Do",       to: "In Progress", kind: "start",   by: "doer",     label: "Start", gate: "submit" },
    { from: "In Progress", to: "In Review",   kind: "submit",  by: "doer",     label: "Submit for review", gate: "submit" },
    { from: "In Review",   to: "Done",        kind: "approve", by: "reviewer", label: "Approve", gate: "approve" },
  ],
};

export const TERMINAL_LIFECYCLE: Lifecycle = {
  id: "terminal",
  statuses: ["To Do", "In Progress", "Uploaded"],
  done: "Uploaded",
  transitions: [
    { from: "To Do",       to: "In Progress", kind: "start",   by: "doer", label: "Start upload", gate: "submit" },
    { from: "In Progress", to: "Uploaded",    kind: "advance", by: "doer", label: "Mark uploaded", gate: "submit" },
  ],
};

/** Pick the lifecycle for a stage from its shape. */
export function lifecycleFor(reviewable: boolean, hasFeedback: boolean): Lifecycle {
  if (!reviewable) return TERMINAL_LIFECYCLE;
  return hasFeedback ? REVIEW_LIFECYCLE : APPROVE_ONLY_LIFECYCLE;
}

/** Every distinct status across all lifecycles (for display tables, etc.). */
export const ALL_STATUSES: string[] = [
  ...new Set([REVIEW_LIFECYCLE, APPROVE_ONLY_LIFECYCLE, TERMINAL_LIFECYCLE].flatMap((l) => l.statuses)),
];

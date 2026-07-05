// ===========================================================================
// LIFECYCLE TEMPLATES — the status state machines, as named code primitives.
//
// A pipeline stage names which lifecycle it uses (`lifecycle: "review"`); it
// never re-defines the statuses or transitions. These four cover every flow we
// support (linear, shared status vocabulary). Adding a genuinely new status
// SHAPE is a deliberate engine change here — and then every pipeline can use it.
//
//   review       reviewable stage WITH send-back   (To Do→In Progress→In Review→Need Changes→Done)
//   approveOnly  reviewable, no send-back           (To Do→In Progress→In Review→Done)        e.g. Topic
//   task         non-reviewed worker stage          (To Do→In Progress→Done)                  e.g. Processing
//   terminal     non-reviewed final stage           (To Do→In Progress→Uploaded)              e.g. Upload
// ===========================================================================

export type LifecycleId = "review" | "approveOnly" | "task" | "terminal";

export type By = "doer" | "reviewer";
export type TransitionKind = "start" | "submit" | "approve" | "reject" | "advance" | "reopen";
/** Which required-field set (derived per stage) blocks this move until filled. */
export type GateKind = "start" | "submit" | "approve";

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
  id: LifecycleId;
  statuses: readonly string[];   // ordered lanes
  done: string;                  // the "complete" status that opens the next stage's gate
  reviewed: boolean;             // does this lifecycle have a reviewer side at all?
  transitions: LifecycleTransition[];
}

const REVIEW: Lifecycle = {
  id: "review",
  statuses: ["To Do", "In Progress", "In Review", "Need Changes", "Done"],
  done: "Done",
  reviewed: true,
  transitions: [
    { from: "To Do",        to: "In Progress",  kind: "start",   by: "doer",     label: "Start", gate: "start" },
    { from: "In Progress",  to: "In Review",    kind: "submit",  by: "doer",     label: "Submit for review", gate: "submit" },
    { from: "Need Changes", to: "In Progress",  kind: "start",   by: "doer",     label: "Resume editing" },
    { from: "Need Changes", to: "In Review",    kind: "submit",  by: "doer",     label: "Resubmit for review", gate: "submit" },
    { from: "In Review",    to: "Done",         kind: "approve", by: "reviewer", label: "Approve", gate: "approve" },
    { from: "In Review",    to: "Need Changes", kind: "reject",  by: "reviewer", label: "Request changes", needsFeedback: true },
    { from: "Done",         to: "Need Changes", kind: "reopen",  by: "reviewer", label: "Reopen (request changes)", needsFeedback: true },
  ],
};

const APPROVE_ONLY: Lifecycle = {
  id: "approveOnly",
  statuses: ["To Do", "In Progress", "In Review", "Done"],
  done: "Done",
  reviewed: true,
  transitions: [
    { from: "To Do",       to: "In Progress", kind: "start",   by: "doer",     label: "Start", gate: "start" },
    { from: "In Progress", to: "In Review",   kind: "submit",  by: "doer",     label: "Submit for review", gate: "submit" },
    { from: "In Review",   to: "Done",        kind: "approve", by: "reviewer", label: "Approve", gate: "approve" },
  ],
};

const TASK: Lifecycle = {
  id: "task",
  statuses: ["To Do", "In Progress", "Done"],
  done: "Done",
  reviewed: false,
  transitions: [
    { from: "To Do",       to: "In Progress", kind: "start",   by: "doer", label: "Start", gate: "start" },
    { from: "In Progress", to: "Done",        kind: "advance", by: "doer", label: "Complete", gate: "submit" },
  ],
};

const TERMINAL: Lifecycle = {
  id: "terminal",
  statuses: ["To Do", "In Progress", "Uploaded"],
  done: "Uploaded",
  reviewed: false,
  transitions: [
    { from: "To Do",       to: "In Progress", kind: "start",   by: "doer", label: "Start upload", gate: "start" },
    { from: "In Progress", to: "Uploaded",    kind: "advance", by: "doer", label: "Mark uploaded", gate: "submit" },
  ],
};

const LIFECYCLES: Record<LifecycleId, Lifecycle> = {
  review: REVIEW, approveOnly: APPROVE_ONLY, task: TASK, terminal: TERMINAL,
};

export function lifecycle(id: LifecycleId): Lifecycle {
  return LIFECYCLES[id];
}

/** Every distinct status across all lifecycles (for display tables, legends, etc.). */
export const ALL_STATUSES: string[] = [
  ...new Set(Object.values(LIFECYCLES).flatMap((l) => l.statuses)),
];

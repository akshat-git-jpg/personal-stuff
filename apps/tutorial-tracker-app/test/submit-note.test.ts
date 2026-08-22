// ===========================================================================
// SUBMIT NOTE — the doer's side of the review conversation.
//
// The reviewer has always been able to say WHY they sent work back
// (`needsFeedback`). The doer had no matching channel: a resubmit landed in the
// reviewer's queue with no word on what changed. These tests pin the symmetric
// rule — every submit that lands in front of a reviewer carries a note.
//
// They also pin the event-type mapping, which used to compare a lowercased
// status against the lifecycle's cased status names and so never matched: every
// doer action was logged as "complete".
// ===========================================================================
import { describe, it, expect } from "vitest";
import { getPipeline } from "../src/shared/engine/registry";
import { transitionsForStage, type Row } from "../src/shared/engine/rbac";
import { lifecycle, findTransition, eventTypeFor } from "../src/shared/engine/lifecycle";

const std = getPipeline("standard");
const editing = std.stages.find((s) => s.id === "editing")!;
const DOER = ["Video Editor"];
const ED = "ed@x.com";

/** A card that cleared Recording and sits at Editing, assigned to ED. */
function editingCard(status: string, reviewer: string | undefined = "rv@x.com"): Row {
  return {
    row_id: "r1", video_title: "T", pipeline: "standard",
    topic_status: "Done", script_status: "Done", tutorial_status: "Done",
    video_editor_status: status,
    video_editor_email: ED,
    video_editor_reviewer_email: reviewer,
    video_editor_link: "https://drive.example.com/cut",
  };
}

const doerMoves = (status: string, reviewer?: string) =>
  transitionsForStage(DOER, ED, editing, editingCard(status, reviewer));

describe("submit note is compulsory", () => {
  it("the first submit requires a note", () => {
    const t = doerMoves("In Progress").find((x) => x.to === "In Review");
    expect(t).toBeDefined();
    expect(t!.requiresNote).toBe(true);
  });

  it("a resubmit after Need Changes requires a note", () => {
    const t = doerMoves("Need Changes").find((x) => x.to === "In Review");
    expect(t).toBeDefined();
    expect(t!.label).toBe("Resubmit for review");
    expect(t!.requiresNote).toBe(true);
  });

  it("every reviewed lifecycle demands a note on every submit", () => {
    for (const id of ["review", "approveOnly"] as const) {
      const submits = lifecycle(id).transitions.filter((t) => t.kind === "submit");
      expect(submits.length).toBeGreaterThan(0);
      for (const t of submits) expect(t.needsNote).toBe(true);
    }
  });
});

describe("submit note is not demanded where nobody would read it", () => {
  it("Start does not require a note", () => {
    const t = doerMoves("To Do").find((x) => x.to === "In Progress");
    expect(t!.requiresNote).toBeFalsy();
  });

  it("Resume editing does not require a note", () => {
    const t = doerMoves("Need Changes").find((x) => x.to === "In Progress");
    expect(t!.label).toBe("Resume editing");
    expect(t!.requiresNote).toBeFalsy();
  });

  it("a stage with no reviewer auto-completes, so it asks for no note", () => {
    const t = doerMoves("In Progress", "").find((x) => x.kind === "advance");
    expect(t).toBeDefined();
    expect(t!.to).toBe("Done");
    expect(t!.requiresNote).toBeFalsy();
  });

  it("an unreviewed lifecycle has no note-bearing transition", () => {
    for (const id of ["task", "terminal"] as const) {
      for (const t of lifecycle(id).transitions) expect(t.needsNote).toBeFalsy();
    }
  });
});

describe("event type mapping", () => {
  it("matches a transition whatever the case of the stored status", () => {
    // The stored status is lowercased before the lookup; the lifecycle names it
    // "In Progress". This mismatch is the bug that logged every move as
    // "complete".
    expect(findTransition("review", "in progress", "In Review")?.kind).toBe("submit");
    expect(findTransition("review", "IN PROGRESS", "In Review")?.kind).toBe("submit");
    expect(findTransition("review", "  In Progress  ", "In Review")?.kind).toBe("submit");
  });

  it("names each doer move for the activity feed", () => {
    expect(eventTypeFor("review", "to do", "In Progress")).toBe("start");
    expect(eventTypeFor("review", "in progress", "In Review")).toBe("submit");
    expect(eventTypeFor("review", "need changes", "In Review")).toBe("submit");
    expect(eventTypeFor("review", "need changes", "In Progress")).toBe("start");
    expect(eventTypeFor("task", "in progress", "Done")).toBe("complete");
    expect(eventTypeFor("terminal", "in progress", "Uploaded")).toBe("complete");
  });

  it("falls back to complete on a move the lifecycle does not name", () => {
    expect(eventTypeFor("review", "done", "To Do")).toBe("complete");
  });
});

import { describe, it, expect } from "vitest";
import {
  ALL_ROLES, stageById, normalizeStatus, statusOf,
} from "../src/shared/pipeline";
import {
  filterRowsForRoles, transitionsForStage, authorizeWrite, canReview,
  cardStagesForUser, reviewQueueForUser, fieldLockReason, type Row,
} from "../src/shared/rbac";
import { parseRoles } from "../src/worker/roles";

const SCRIPT = stageById("script")!;
const TOPIC = stageById("topic")!;

// A card that has cleared Topic and is at the Script stage, assigned to sw@x,
// reviewed by rv@x.
function scriptCard(script_status: string): Row {
  return {
    row_id: "r1", video_title: "T",
    topic_status: "Done",
    script_writer_email: "sw@x.com",
    reviewer_email: "rv@x.com",
    script_status,
  };
}

describe("role roster", () => {
  it("has no Ideator role — Topic is the Admin's job", () => {
    expect(ALL_ROLES).not.toContain("Ideator");
    expect(ALL_ROLES.slice().sort()).toEqual(
      ["Admin", "Recorder", "Reviewer", "Scriptwriter", "Thumbnail Maker", "Uploader", "Video Editor"],
    );
  });
});

describe("lane normalization (the Need-Changes-on-create guard)", () => {
  it("maps blank/unknown to To Do, never to Need Changes", () => {
    expect(normalizeStatus(TOPIC, "")).toBe("To Do");
    expect(normalizeStatus(TOPIC, undefined)).toBe("To Do");
    expect(normalizeStatus(TOPIC, "garbage")).toBe("To Do");
    expect(normalizeStatus(SCRIPT, "")).toBe("To Do");
  });
  it("a freshly created Topic=To Do card is in the To Do lane", () => {
    const row: Row = { row_id: "r9", video_title: "New", topic_status: "To Do" };
    expect(statusOf(TOPIC, row)).toBe("To Do");
  });
});

describe("gated handoff", () => {
  it("a scriptwriter only sees a card once Topic is Done", () => {
    const blocked: Row = { row_id: "a", video_title: "A", topic_status: "In Progress", script_writer_email: "sw@x.com" };
    const open: Row = { row_id: "b", video_title: "B", topic_status: "Done", script_writer_email: "sw@x.com" };
    const visible = filterRowsForRoles(["Scriptwriter"], "sw@x.com", [blocked, open]);
    expect(visible.map((r) => r.row_id)).toEqual(["b"]);
  });
});

describe("doer transitions", () => {
  const roles = ["Scriptwriter"];
  const email = "sw@x.com";
  const tos = (status: string) => transitionsForStage(roles, email, SCRIPT, scriptCard(status)).map((t) => t.to);

  it("To Do -> Start (In Progress)", () => expect(tos("To Do")).toEqual(["In Progress"]));
  it("In Progress -> Submit (In Review)", () => expect(tos("In Progress")).toEqual(["In Review"]));
  it("In Review -> nothing (the doer waits)", () => expect(tos("In Review")).toEqual([]));
  it("Need Changes -> resume or resubmit", () => expect(tos("Need Changes")).toEqual(["In Progress", "In Review"]));
});

describe("reviewer transitions + can't-review-own-work", () => {
  it("the assigned reviewer can approve / request changes on In Review", () => {
    const tos = transitionsForStage(["Reviewer"], "rv@x.com", SCRIPT, scriptCard("In Review")).map((t) => t.to);
    expect(tos).toEqual(["Done", "Need Changes"]);
  });
  it("a reviewer who is also the submitter cannot review their own work", () => {
    const row = { ...scriptCard("In Review"), reviewer_email: "sw@x.com" };
    expect(canReview(["Reviewer", "Scriptwriter"], "sw@x.com", SCRIPT, row)).toBe(false);
    expect(transitionsForStage(["Reviewer", "Scriptwriter"], "sw@x.com", SCRIPT, row)).toEqual([]);
  });
  it("tags transitions by doer/reviewer so each context shows only its own (the My-work-vs-queue fix)", () => {
    // Sean is admin (owns Topic) AND the topic's reviewer — the exact multi-role case.
    const topicRow: Row = {
      row_id: "t1", video_title: "T", topic_status: "In Review",
      admin_email: "sean@x.com", reviewer_email: "sean@x.com",
    };
    const ts = transitionsForStage(["Admin", "Reviewer"], "sean@x.com", TOPIC, topicRow);
    // The only action (Approve) is a reviewer action — so My work (doer) shows nothing…
    expect(ts.filter((t) => t.by === "doer").map((t) => t.to)).toEqual([]);
    // …and the Review queue (reviewer) shows Approve.
    expect(ts.filter((t) => t.by === "reviewer").map((t) => t.to)).toEqual(["Done"]);
  });

  it("the admin can review their own Topic (owner == reviewer is allowed for Topic only)", () => {
    const topicRow: Row = {
      row_id: "t1", video_title: "T", topic_status: "In Review",
      admin_email: "sean@x.com", reviewer_email: "sean@x.com",
    };
    expect(canReview(["Admin", "Reviewer"], "sean@x.com", TOPIC, topicRow)).toBe(true);
    // …but on a producing stage, owner == reviewer is still blocked.
    const ownRow = { ...scriptCard("In Review"), reviewer_email: "sw@x.com" };
    expect(canReview(["Reviewer", "Scriptwriter"], "sw@x.com", SCRIPT, ownRow)).toBe(false);
  });

  it("Admin is NOT a default reviewer — it needs the Reviewer role + assignment", () => {
    // A plain Admin who isn't the assigned reviewer gets no approve/reject.
    expect(transitionsForStage(["Admin"], "boss@x.com", SCRIPT, scriptCard("In Review"))).toEqual([]);
    expect(canReview(["Admin"], "rv@x.com", SCRIPT, scriptCard("In Review"))).toBe(false);
    // An Admin who also holds Reviewer AND is the card's assigned reviewer qualifies.
    const tos = transitionsForStage(["Admin", "Reviewer"], "rv@x.com", SCRIPT, scriptCard("In Review")).map((t) => t.to);
    expect(tos).toEqual(["Done", "Need Changes"]);
  });
});

describe("required fields gate submit/advance", () => {
  it("a scriptwriter can't submit without a script link, and the transition says why", () => {
    const noLink = scriptCard("In Progress"); // script_link empty
    const ts = transitionsForStage(["Scriptwriter"], "sw@x.com", SCRIPT, noLink);
    const submit = ts.find((t) => t.kind === "submit")!;
    expect(submit.disabledReason).toMatch(/script/i); // label for script_link is "Script"
    expect(authorizeWrite(["Scriptwriter"], "sw@x.com", "script_status", "In Review", noLink).ok).toBe(false);
  });
  it("…and can once the link is filled", () => {
    const withLink = { ...scriptCard("In Progress"), script_link: "https://x.com/s" };
    const submit = transitionsForStage(["Scriptwriter"], "sw@x.com", SCRIPT, withLink).find((t) => t.kind === "submit")!;
    expect(submit.disabledReason).toBeUndefined();
    expect(authorizeWrite(["Scriptwriter"], "sw@x.com", "script_status", "In Review", withLink).ok).toBe(true);
  });
});

describe("ETA gate — Start requires the stage's ETA (control.ts mustFill on To Do)", () => {
  it("a scriptwriter can't Start until the ETA is set, and the transition says why", () => {
    const noEta = scriptCard("To Do"); // script_eta empty
    const start = transitionsForStage(["Scriptwriter"], "sw@x.com", SCRIPT, noEta).find((t) => t.kind === "start")!;
    expect(start.disabledReason).toMatch(/ETA/i);
    expect(authorizeWrite(["Scriptwriter"], "sw@x.com", "script_status", "In Progress", noEta).ok).toBe(false);
  });
  it("…and can once the ETA is filled", () => {
    const withEta = { ...scriptCard("To Do"), script_eta: "2026-07-01" };
    expect(authorizeWrite(["Scriptwriter"], "sw@x.com", "script_status", "In Progress", withEta).ok).toBe(true);
  });
});

describe("reviewer must brief the next worker before approving (control.ts toApprove)", () => {
  it("approving Script is blocked until the Recorder's instruction is written", () => {
    const noInstr = scriptCard("In Review"); // tutorial_instruction empty
    const approve = transitionsForStage(["Reviewer"], "rv@x.com", SCRIPT, noInstr).find((t) => t.kind === "approve")!;
    expect(approve.disabledReason).toMatch(/recording instruction/i); // tutorial_instruction's label is "Recording instructions"
    expect(authorizeWrite(["Reviewer"], "rv@x.com", "script_status", "Done", noInstr).ok).toBe(false);
    const briefed = { ...noInstr, tutorial_instruction: "Record at 1080p" };
    expect(authorizeWrite(["Reviewer"], "rv@x.com", "script_status", "Done", briefed).ok).toBe(true);
  });
});

describe("thumbnail stage", () => {
  it("sits between Editing and Upload, reviewable, and Upload now gates on it", () => {
    const thumb = stageById("thumbnail")!;
    expect(thumb.order).toBe(4);
    expect(thumb.reviewable).toBe(true);
    expect(stageById("upload")!.order).toBe(5);
  });
});

describe("authorizeWrite (single enforcement point)", () => {
  it("a doer cannot set Done or Need Changes (approver-only)", () => {
    expect(authorizeWrite(["Scriptwriter"], "sw@x.com", "script_status", "Done", scriptCard("In Review")).ok).toBe(false);
    expect(authorizeWrite(["Scriptwriter"], "sw@x.com", "script_status", "Need Changes", scriptCard("In Progress")).ok).toBe(false);
  });
  it("a doer can submit for review (once the required link is filled)", () => {
    const ready = { ...scriptCard("In Progress"), script_link: "https://x.com/s" };
    expect(authorizeWrite(["Scriptwriter"], "sw@x.com", "script_status", "In Review", ready).ok).toBe(true);
  });
  it("the assigned reviewer can approve (once the next worker's instruction is written)", () => {
    const ready = { ...scriptCard("In Review"), tutorial_instruction: "Record at 1080p" };
    expect(authorizeWrite(["Reviewer"], "rv@x.com", "script_status", "Done", ready).ok).toBe(true);
  });
  it("content fields lock once submitted / approved", () => {
    expect(authorizeWrite(["Scriptwriter"], "sw@x.com", "script_link", "x", scriptCard("In Progress")).ok).toBe(true);
    expect(authorizeWrite(["Scriptwriter"], "sw@x.com", "script_link", "x", scriptCard("In Review")).ok).toBe(false);
    expect(authorizeWrite(["Scriptwriter"], "sw@x.com", "script_link", "x", scriptCard("Done")).ok).toBe(false);
  });
  it("admin bypasses content locks", () => {
    expect(authorizeWrite(["Admin"], "boss@x.com", "script_link", "x", scriptCard("Done")).ok).toBe(true);
  });
  it("fieldLockReason explains why a locked field is locked", () => {
    expect(fieldLockReason(["Scriptwriter"], "sw@x.com", "script_link", scriptCard("In Review"))).toMatch(/review/i);
    expect(fieldLockReason(["Scriptwriter"], "sw@x.com", "script_link", scriptCard("In Progress"))).toBeNull();
  });
});

describe("board membership + review queue", () => {
  it("a card belongs to the doer's stage lane only when assigned + gate open", () => {
    expect(cardStagesForUser(["Scriptwriter"], "sw@x.com", scriptCard("To Do"))).toEqual(["script_status"]);
    const notMine = { ...scriptCard("To Do"), script_writer_email: "other@x.com" };
    expect(cardStagesForUser(["Scriptwriter"], "sw@x.com", notMine)).toEqual([]);
  });
  it("the review queue shows In-Review cards assigned to that reviewer", () => {
    const q = reviewQueueForUser(["Reviewer"], "rv@x.com", [scriptCard("In Review"), scriptCard("In Progress")]);
    expect(q).toHaveLength(1);
    expect(q[0].stage.id).toBe("script");
    expect(q[0].submittedBy).toBe("sw@x.com");
  });
});

describe("parseRoles validates against the new roster", () => {
  it("keeps valid roles, drops unknown", () => {
    expect(parseRoles("Scriptwriter, Nope, Recorder")).toEqual(["Scriptwriter", "Recorder"]);
  });
});

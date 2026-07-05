import { describe, it, expect } from "vitest";
import { validatePipelines, getPipeline, allRoles, pipelineIds, rolesForSystem } from "../src/shared/engine/registry";
import { assembleRow, decomposeRow, routeWrite, type StageRecord } from "../src/shared/engine/card";
import { effectiveRoles, holdsRoleInSystem } from "../src/shared/engine/memberships";
import { workerStagesForMemberships, reviewQueueForMemberships, type Row, cardStagesForUser, upcomingStagesForUser, canSeeRow } from "../src/shared/engine/rbac";
import { createFieldsOf, type PipelineDef } from "../src/shared/engine/types";

describe("pipeline definitions", () => {
  it("validate clean", () => {
    expect(validatePipelines()).toEqual([]);
  });
  it("derive both pipelines + the full role roster", () => {
    expect(pipelineIds().sort()).toEqual(["standard", "tut-2"]);
    expect(allRoles()).toEqual(expect.arrayContaining([
      "Admin", "Reviewer", "Scriptwriter", "Recorder", "Video Editor", "Thumbnail Maker", "Uploader",
    ]));
  });
});

describe("createFieldsOf", () => {
  it("returns default fields for standard and tut-2", () => {
    const defaultCols = ["video_title", "video_notes", "category", "subcategory"];
    expect(createFieldsOf(getPipeline("standard")).map((f) => f.col)).toEqual(defaultCols);
    expect(createFieldsOf(getPipeline("tut-2")).map((f) => f.col)).toEqual(defaultCols);
  });

  it("returns custom fields for synthetic def", () => {
    const p: PipelineDef = {
      id: "syn", name: "Syn",
      stages: [{
        id: "topic", label: "Topic", role: "Admin", lifecycle: "review", kind: "brief",
        createFields: [
          { col: "video_title", label: "Title", type: "text" },
          { col: "asin", label: "ASIN", type: "text" }
        ]
      }]
    };
    const fields = createFieldsOf(p);
    expect(fields).toHaveLength(2);
    expect(fields.map((f) => f.col)).toEqual(["video_title", "asin"]);
    expect(fields[1].label).toBe("ASIN");
  });
});

describe("storage round-trip (flat Row ⇄ normalized)", () => {
  const P = getPipeline("standard");
  const original: Record<string, string> = {
    pipeline: "standard", row_id: "r0007", last_updated: "2026-06-30T10:00:00Z", status_since: "2026-06-29T00:00:00Z",
    video_title: "How to SSO", video_notes: "cover SAML", video_description: "desc", category: "Tutorials", subcategory: "Auth",
    topic_date: "2026-06-01", topic_status: "Done", admin_email: "admin@x", topic_reviewer_email: "rv@x",
    reviewer_email: "legacy@x", // vestigial legacy col — must survive via passthrough
    script_status: "Done", script_writer_email: "sw@x", script_reviewer_email: "rv@x", script_link: "sl", script_eta: "2026-06-05", script_instruction: "si", script_feedback: "sf",
    tutorial_status: "In Review", tutorial_maker_email: "rec@x", tutorial_reviewer_email: "rv@x", tutorial_link: "tl", tutorial_eta: "2026-06-08", tutorial_instruction: "ti",
    video_editor_status: "To Do", video_editor_email: "ed@x", video_editor_reviewer_email: "rv@x", video_editor_instruction: "vi",
    thumbnail_status: "To Do", thumbnail_maker_email: "th@x", thumbnail_reviewer_email: "rv@x", thumbnail_instruction: "thi",
    yt_upload_status: "To Do", uploader_email: "up@x", yt_upload_date: "2026-06-30", short_links: "go/x", actual_links: "http/x",
  };

  it("is lossless including status_since + passthrough of stray legacy cols", () => {
    const { card, stages } = decomposeRow(P, original);
    const rebuilt = assembleRow(P, card, stages) as Record<string, string>;
    for (const k of Object.keys(rebuilt)) {
      expect(`${k}=${rebuilt[k] ?? ""}`).toBe(`${k}=${original[k] ?? ""}`);
    }
    expect(rebuilt.reviewer_email).toBe("legacy@x"); // passthrough preserved
    expect(rebuilt.status_since).toBe("2026-06-29T00:00:00Z");
    expect(card.status_since).toBe("2026-06-29T00:00:00Z");
  });

  it("routes writes to the right table/slot", () => {
    expect(routeWrite(P, "script_link")).toEqual({ kind: "stage", stageId: "script", slot: "work_link" });
    expect(routeWrite(P, "video_editor_status")).toEqual({ kind: "stage", stageId: "editing", slot: "status" });
    expect(routeWrite(P, "editor_feedback")).toEqual({ kind: "stage", stageId: "editing", slot: "feedback" });
    expect(routeWrite(P, "video_title")).toEqual({ kind: "card", field: "title" });
    expect(routeWrite(P, "status_since")).toEqual({ kind: "system", field: "status_since" });
    expect(routeWrite(P, "short_links")).toEqual({ kind: "stage_extra", stageId: "upload", fieldId: "short_links" });
    expect(routeWrite(P, "topic_date")).toEqual({ kind: "card_extra", key: "topic_date" });
    expect(routeWrite(P, "reviewer_email")).toEqual({ kind: "card_extra", key: "reviewer_email" }); // passthrough
  });

  it("creates a fresh card with every stage at its first status", () => {
    const { stages } = decomposeRow(P, { row_id: "r9", pipeline: "standard", video_title: "New", topic_status: "To Do", admin_email: "a@x" }, true);
    expect(stages).toHaveLength(P.stages.length);
    for (const s of stages as StageRecord[]) expect(s.status).toBeTruthy();
    expect(stages.find((s) => s.stage_id === "upload")!.status).toBe("To Do");
  });
});

describe("tut-2 normalizes cleanly", () => {
  const P = getPipeline("tut-2");
  it("has the processing (task) stage with no reviewer slot", () => {
    const { stages } = decomposeRow(P, { row_id: "v1", pipeline: "tut-2", video_title: "V2 vid" }, true);
    expect(stages.map((s) => s.stage_id)).toEqual(["topic", "outline", "recording", "processing", "editing", "thumbnail", "upload"]);
  });
});

describe("system-scoped memberships", () => {
  const samStd = { standard: ["Scriptwriter", "Recorder"] };          // standard-only doer
  const ninaTut2 = { "tut-2": ["Scriptwriter"] };                     // tut-2-only doer
  const reviewerBoth = { standard: ["Reviewer"], "tut-2": ["Reviewer"] }; // cross-system reviewer
  const admin = { "*": ["Admin"], standard: ["Reviewer"] };           // founder

  it("effectiveRoles collapses per-system + cross-system roles", () => {
    expect(effectiveRoles(admin, "tut-2")).toEqual(["Admin"]);                  // admin spans all systems
    expect(effectiveRoles(admin, "standard").sort()).toEqual(["Admin", "Reviewer"]);
    expect(effectiveRoles(ninaTut2, "standard")).toEqual([]);                   // nina has nothing in standard
    expect(effectiveRoles(ninaTut2, "tut-2")).toEqual(["Scriptwriter"]);
  });

  it("rolesForSystem = that system's doer roles + Reviewer, never Admin", () => {
    const r = rolesForSystem("standard");
    expect(r).toContain("Scriptwriter");
    expect(r).toContain("Reviewer");
    expect(r).not.toContain("Admin");
  });

  it("holdsRoleInSystem scopes the assignment dropdowns", () => {
    expect(holdsRoleInSystem(samStd, "standard", "Scriptwriter")).toBe(true);
    expect(holdsRoleInSystem(samStd, "tut-2", "Scriptwriter")).toBe(false);     // Sam never offered on a tut-2 card
    expect(holdsRoleInSystem(reviewerBoth, "tut-2", "Reviewer")).toBe(true);
  });

  it("worker lanes only cover systems the user actually works in", () => {
    const lanes = workerStagesForMemberships(ninaTut2);
    expect(new Set(lanes.map((l) => l.pipelineId))).toEqual(new Set(["tut-2"]));
    expect(lanes.every((l) => l.role === "Scriptwriter")).toBe(true);
  });

  it("a cross-system reviewer's queue spans every system they review", () => {
    const stdCard: Row = {
      row_id: "s1", pipeline: "standard", video_title: "A", topic_status: "Done",
      script_status: "In Review", script_writer_email: "sw@x.com", script_reviewer_email: "riya@x.com",
    };
    const tutCard: Row = {
      row_id: "t1", pipeline: "tut-2", video_title: "B", topic_status: "Done",
      outline_status: "In Review", outline_assignee: "nina@x.com", outline_reviewer: "riya@x.com",
    };
    const q = reviewQueueForMemberships(reviewerBoth, "riya@x.com", [stdCard, tutCard]);
    expect(q.map((i) => i.row.row_id).sort()).toEqual(["s1", "t1"]);
  });
});

describe("up next / upcoming work visibility", () => {
  it("surfaces closed-gate assigned stages and allows the doer to see the card", () => {
    // Sam is the scriptwriter AND recorder (tutorial_maker) on a standard card.
    // Script is open (In Progress); Tutorial is closed (waiting on Script).
    const row: Row = {
      row_id: "r1", pipeline: "standard", video_title: "Test",
      topic_status: "Done",
      script_status: "In Progress", script_writer_email: "sam@x.com",
      tutorial_status: "To Do", tutorial_maker_email: "sam@x.com",
    };
    const roles = ["Scriptwriter", "Recorder"];
    expect(cardStagesForUser(roles, "sam@x.com", row)).toEqual(["script_status"]);
    expect(upcomingStagesForUser(roles, "sam@x.com", row)).toEqual(["tutorial_status"]);
    // A pure Recorder can see the row even though their gate is closed.
    expect(canSeeRow(["Recorder"], "sam@x.com", row)).toBe(true);
  });
});

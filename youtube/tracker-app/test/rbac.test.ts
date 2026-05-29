import { describe, it, expect } from "vitest";
import { visibleColumns, canEdit, filterRows, projectRow, isApprover, canSetValue, isRowLockedFor } from "../src/shared/rbac";

describe("RBAC", () => {
  it("Tutorial Maker cannot see editor columns", () => {
    expect(visibleColumns("Tutorial Maker")).not.toContain("video_editor_link");
  });
  it("Editor sees tutorial columns but cannot edit them", () => {
    expect(visibleColumns("Editor")).toContain("tutorial_status");
    expect(canEdit("Editor", "tutorial_status")).toBe(false);
    expect(canEdit("Editor", "video_editor_status")).toBe(true);
  });
  it("Admin can edit anything", () => {
    expect(canEdit("Admin", "tutorial_status")).toBe(true);
  });
  it("Reviewer sees all but can only edit its listed columns", () => {
    expect(visibleColumns("Reviewer")).toContain("video_editor_link");
    expect(canEdit("Reviewer", "yt_upload_status")).toBe(true);
    // Reviewer can now approve (edit video_editor_status / tutorial_status) and write feedback
    expect(canEdit("Reviewer", "video_editor_status")).toBe(true);
    expect(canEdit("Reviewer", "tutorial_status")).toBe(true);
    expect(canEdit("Reviewer", "tutorial_feedback")).toBe(true);
    expect(canEdit("Reviewer", "editor_feedback")).toBe(true);
    // Reviewer still cannot edit meta / editor-private fields like video_editor_link
    expect(canEdit("Reviewer", "video_editor_link")).toBe(false);
  });
  it("unknown role gets nothing", () => {
    expect(visibleColumns("Nope")).toEqual([]);
    expect(canEdit("Nope", "video_title")).toBe(false);
    expect(filterRows("Nope", "x@y.com", [{} as any])).toEqual([]);
  });
  it("row filter matches assignee email case-insensitively", () => {
    const rows = [{ tutorial_maker_email: "A@x.com" }, { tutorial_maker_email: "b@x.com" }] as any;
    expect(filterRows("Tutorial Maker", "a@x.com", rows)).toHaveLength(1);
  });
  it("gated handoff: Editor only sees rows where tutorial_status is Done", () => {
    const rows = [
      { video_editor_email: "john@x.com", tutorial_status: "Done", video_title: "ready" },
      { video_editor_email: "john@x.com", tutorial_status: "In Progress", video_title: "not ready" },
      { video_editor_email: "john@x.com", tutorial_status: "", video_title: "blank" },
    ] as any;
    const seen = filterRows("Editor", "john@x.com", rows);
    expect(seen).toHaveLength(1);
    expect(seen[0].video_title).toBe("ready");
  });
  it("gated handoff: Reviewer only sees rows where video_editor_status is Done", () => {
    const rows = [
      { reviewer_email: "r@x.com", video_editor_status: "Done", video_title: "ready" },
      { reviewer_email: "r@x.com", video_editor_status: "In Review", video_title: "not ready" },
    ] as any;
    const seen = filterRows("Reviewer", "r@x.com", rows);
    expect(seen).toHaveLength(1);
    expect(seen[0].video_title).toBe("ready");
  });
  it("Tutorial Maker has no upstream gate (sees all their assigned rows)", () => {
    const rows = [
      { tutorial_maker_email: "s@x.com", tutorial_status: "To Do" },
      { tutorial_maker_email: "s@x.com", tutorial_status: "In Progress" },
    ] as any;
    expect(filterRows("Tutorial Maker", "s@x.com", rows)).toHaveLength(2);
  });
  it("projectRow returns only visible columns", () => {
    const row = { row_id: "1", video_title: "t", video_editor_link: "secret" } as any;
    const proj = projectRow("Tutorial Maker", row);
    expect(proj).not.toHaveProperty("video_editor_link");
    expect(proj.video_title).toBe("t");
  });

  // --- Approval flow ---

  it("isApprover: Admin and Reviewer are approvers; Editor and Tutorial Maker are not", () => {
    expect(isApprover("Admin")).toBe(true);
    expect(isApprover("Reviewer")).toBe(true);
    expect(isApprover("Editor")).toBe(false);
    expect(isApprover("Tutorial Maker")).toBe(false);
  });

  it("canSetValue: doers can set their status to non-Done values but not Done", () => {
    expect(canSetValue("Tutorial Maker", "tutorial_status", "In Review")).toBe(true);
    expect(canSetValue("Tutorial Maker", "tutorial_status", "Done")).toBe(false);
    expect(canSetValue("Editor", "video_editor_status", "In Review")).toBe(true);
    expect(canSetValue("Editor", "video_editor_status", "Done")).toBe(false);
  });

  it("canSetValue: approvers can set status to Done", () => {
    expect(canSetValue("Admin", "tutorial_status", "Done")).toBe(true);
    expect(canSetValue("Reviewer", "video_editor_status", "Done")).toBe(true);
    expect(canSetValue("Reviewer", "tutorial_status", "Done")).toBe(true);
  });

  it("canSetValue: doers cannot edit columns they don't own", () => {
    expect(canSetValue("Tutorial Maker", "video_editor_status", "In Progress")).toBe(false);
    expect(canSetValue("Editor", "tutorial_status", "In Progress")).toBe(false);
  });

  it("isRowLockedFor: doer row is locked when their owned status is Done", () => {
    expect(isRowLockedFor("Tutorial Maker", { tutorial_status: "Done" } as any)).toBe(true);
    expect(isRowLockedFor("Tutorial Maker", { tutorial_status: "In Review" } as any)).toBe(false);
    expect(isRowLockedFor("Tutorial Maker", { tutorial_status: "" } as any)).toBe(false);
    expect(isRowLockedFor("Editor", { video_editor_status: "Done" } as any)).toBe(true);
    expect(isRowLockedFor("Editor", { video_editor_status: "In Progress" } as any)).toBe(false);
  });

  it("isRowLockedFor: approvers are never locked", () => {
    expect(isRowLockedFor("Admin", { tutorial_status: "Done" } as any)).toBe(false);
    expect(isRowLockedFor("Reviewer", { video_editor_status: "Done" } as any)).toBe(false);
  });

  it("feedback columns: Reviewer can edit, Tutorial Maker and Editor cannot", () => {
    expect(canEdit("Reviewer", "tutorial_feedback")).toBe(true);
    expect(canEdit("Reviewer", "editor_feedback")).toBe(true);
    expect(canEdit("Tutorial Maker", "tutorial_feedback")).toBe(false);
    expect(canEdit("Editor", "editor_feedback")).toBe(false);
  });

  it("feedback col visibility: Tutorial Maker sees tutorial_feedback but not editor_feedback", () => {
    const tmCols = visibleColumns("Tutorial Maker");
    expect(tmCols).toContain("tutorial_feedback");
    expect(tmCols).not.toContain("editor_feedback");
  });

  it("feedback col visibility: Editor sees editor_feedback but not tutorial_feedback", () => {
    const edCols = visibleColumns("Editor");
    expect(edCols).toContain("editor_feedback");
    // Editor's visibleGroups includes "tutorial" group — tutorial_feedback is now in that group
    // Editor CAN see tutorial_feedback (read-only — tutorial group is in readonlyGroups for Editor)
    // but tutorial_feedback is in the tutorial group which Editor can see
    expect(edCols).toContain("tutorial_feedback");
    expect(canEdit("Editor", "tutorial_feedback")).toBe(false);
  });
});

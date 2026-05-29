import { describe, it, expect } from "vitest";
import { visibleColumns, canEdit, filterRows, projectRow } from "../src/shared/rbac";

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
    expect(canEdit("Reviewer", "video_editor_status")).toBe(false);
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
  it("projectRow returns only visible columns", () => {
    const row = { row_id: "1", video_title: "t", video_editor_link: "secret" } as any;
    const proj = projectRow("Tutorial Maker", row);
    expect(proj).not.toHaveProperty("video_editor_link");
    expect(proj.video_title).toBe("t");
  });
});

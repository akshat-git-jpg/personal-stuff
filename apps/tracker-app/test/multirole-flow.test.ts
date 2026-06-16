import { describe, it, expect } from "vitest";
import {
  filterRows,
  filterRowsForRoles,
  workerStagesForRoles,
  canEditForRoles,
  canSetValueForRoles,
  isFieldLocked,
  visibleColumnsForRoles,
  type Row,
} from "../src/shared/rbac";

// One person holding BOTH worker roles (like "Sam — Script + Recordings").
const SAM = "sam@example.com";
const ROLES = ["Script Writer", "Tutorial Maker"];

// A video assigned to Sam for both stages.
function makeRow(overrides: Partial<Row> = {}): Row {
  return {
    row_id: "r1",
    video_title: "Test video",
    category: "AI Tools",
    subcategory: "Tutorial",
    video_notes: "brief",
    topic_status: "Ready",
    script_writer_email: SAM,
    tutorial_maker_email: SAM,
    script_status: "",
    tutorial_status: "",
    ...overrides,
  };
}

describe("multi-role flow: one person is both Script Writer and Tutorial Maker", () => {
  it("exposes both worker stages, in order", () => {
    const stages = workerStagesForRoles(ROLES).map(s => s.statusCol);
    expect(stages).toContain("script_status");
    expect(stages).toContain("tutorial_status");
  });

  it("can edit both stages' fields (union of role access)", () => {
    const visible = visibleColumnsForRoles(ROLES);
    expect(visible).toContain("script_status");
    expect(visible).toContain("tutorial_status");
    expect(canEditForRoles(ROLES, "script_status")).toBe(true);
    expect(canEditForRoles(ROLES, "tutorial_status")).toBe(true);
    expect(canEditForRoles(ROLES, "script_link")).toBe(true);
    expect(canEditForRoles(ROLES, "tutorial_link")).toBe(true);
  });

  it("a doer can submit (In Review) but never approve (Done)", () => {
    expect(canSetValueForRoles(ROLES, "script_status", "In Review")).toBe(true);
    expect(canSetValueForRoles(ROLES, "script_status", "Done")).toBe(false);
    expect(canSetValueForRoles(ROLES, "tutorial_status", "In Review")).toBe(true);
    expect(canSetValueForRoles(ROLES, "tutorial_status", "Done")).toBe(false);
  });

  it("BUG GUARD: while the script isn't Done, the row is NOT in the Tutorial stage", () => {
    const row = makeRow({ script_status: "In Review" });
    // It IS visible to Sam overall (via his Script Writer role)...
    expect(filterRowsForRoles(ROLES, SAM, [row]).length).toBe(1);
    // ...but it must NOT count toward the Tutorial Maker stage yet (script not Done).
    expect(filterRows("Tutorial Maker", SAM, [row]).length).toBe(0);
    // It IS in the Script Writer stage.
    expect(filterRows("Script Writer", SAM, [row]).length).toBe(1);
  });

  it("once the script is Done, the row moves into the Tutorial stage", () => {
    const row = makeRow({ script_status: "Done", tutorial_status: "" });
    expect(filterRows("Tutorial Maker", SAM, [row]).length).toBe(1);
    // Script fields are now frozen for the doer, tutorial fields stay editable.
    expect(isFieldLocked(ROLES, "script_status", row)).toBe(true);
    expect(isFieldLocked(ROLES, "script_link", row)).toBe(true);
    expect(isFieldLocked(ROLES, "tutorial_status", row)).toBe(false);
    expect(isFieldLocked(ROLES, "tutorial_link", row)).toBe(false);
  });

  it("submitting the tutorial freezes its non-status fields, status stays movable", () => {
    const row = makeRow({ script_status: "Done", tutorial_status: "In Review" });
    expect(isFieldLocked(ROLES, "tutorial_link", row)).toBe(true);
    expect(isFieldLocked(ROLES, "tutorial_status", row)).toBe(false);
  });
});

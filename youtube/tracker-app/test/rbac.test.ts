import { describe, it, expect } from "vitest";
import {
  visibleColumns, canEdit, filterRows, projectRow,
  isApprover, canSetValue, isRowLockedFor,
  visibleColumnsForRoles, canEditForRoles, canSetValueForRoles,
  isApproverRoles, filterRowsForRoles, projectRowForRoles,
  workerStagesForRoles, isFieldLocked,
} from "../src/shared/rbac";
import { COLUMNS } from "../src/shared/columns";
import { parseRoles } from "../src/worker/roles";

// ---------------------------------------------------------------------------
// Single-role: Admin
// ---------------------------------------------------------------------------

describe("Admin", () => {
  it("can edit anything", () => {
    expect(canEdit("Admin", "tutorial_status")).toBe(true);
    expect(canEdit("Admin", "script_status")).toBe(true);
    expect(canEdit("Admin", "video_editor_status")).toBe(true);
    expect(canEdit("Admin", "script_link")).toBe(true);
  });

  it("visibleColumns === all COLUMNS", () => {
    expect(visibleColumns("Admin")).toEqual([...COLUMNS]);
  });

  it("last_updated is visible to Admin", () => {
    expect(visibleColumns("Admin")).toContain("last_updated");
  });

  it("isApprover: Admin is an approver", () => {
    expect(isApprover("Admin")).toBe(true);
  });

  it("canSetValue: Admin can set status to Done", () => {
    expect(canSetValue("Admin", "script_status", "Done")).toBe(true);
    expect(canSetValue("Admin", "tutorial_status", "Done")).toBe(true);
    expect(canSetValue("Admin", "video_editor_status", "Done")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Single-role: Reviewer
// ---------------------------------------------------------------------------

describe("Reviewer", () => {
  it("sees all but can only edit its listed columns", () => {
    expect(visibleColumns("Reviewer")).toContain("video_editor_link");
    expect(canEdit("Reviewer", "yt_upload_status")).toBe(true);
    expect(canEdit("Reviewer", "video_editor_status")).toBe(true);
    expect(canEdit("Reviewer", "tutorial_status")).toBe(true);
    expect(canEdit("Reviewer", "script_status")).toBe(true);
    expect(canEdit("Reviewer", "tutorial_feedback")).toBe(true);
    expect(canEdit("Reviewer", "editor_feedback")).toBe(true);
    // Reviewer cannot edit doer-private fields
    expect(canEdit("Reviewer", "video_editor_link")).toBe(false);
    expect(canEdit("Reviewer", "script_link")).toBe(false);
    expect(canEdit("Reviewer", "tutorial_link")).toBe(false);
  });

  it("isApprover: Reviewer is an approver", () => {
    expect(isApprover("Reviewer")).toBe(true);
  });

  it("canSetValue: Reviewer can set status to Done", () => {
    expect(canSetValue("Reviewer", "tutorial_status", "Done")).toBe(true);
    expect(canSetValue("Reviewer", "video_editor_status", "Done")).toBe(true);
    expect(canSetValue("Reviewer", "script_status", "Done")).toBe(true);
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

  it("last_updated is visible to Reviewer", () => {
    expect(visibleColumns("Reviewer")).toContain("last_updated");
  });
});

// ---------------------------------------------------------------------------
// Single-role: Script Writer
// ---------------------------------------------------------------------------

describe("Script Writer", () => {
  it("sees script_link (edit), script_status (edit), video_notes (view)", () => {
    expect(visibleColumns("Script Writer")).toContain("script_link");
    expect(canEdit("Script Writer", "script_link")).toBe(true);
    expect(visibleColumns("Script Writer")).toContain("script_status");
    expect(canEdit("Script Writer", "script_status")).toBe(true);
    expect(visibleColumns("Script Writer")).toContain("video_notes");
    expect(canEdit("Script Writer", "video_notes")).toBe(false);
  });

  it("does NOT see tutorial_link, video_editor_link, yt_upload_status", () => {
    const cols = visibleColumns("Script Writer");
    expect(cols).not.toContain("tutorial_link");
    expect(cols).not.toContain("video_editor_link");
    expect(cols).not.toContain("yt_upload_status");
  });

  it("does NOT see last_updated", () => {
    expect(visibleColumns("Script Writer")).not.toContain("last_updated");
  });

  it("cannot set script_status to Done (approver-only)", () => {
    expect(canSetValue("Script Writer", "script_status", "Done")).toBe(false);
    expect(canSetValue("Script Writer", "script_status", "In Review")).toBe(true);
  });

  it("isApprover: Script Writer is NOT an approver", () => {
    expect(isApprover("Script Writer")).toBe(false);
  });

  it("gated handoff: Script Writer only sees rows where topic_status is Ready", () => {
    const rows = [
      { script_writer_email: "sw@x.com", topic_status: "Ready", video_title: "go" },
      { script_writer_email: "sw@x.com", topic_status: "To Do", video_title: "blocked" },
      { script_writer_email: "sw@x.com", topic_status: "", video_title: "no status" },
    ] as any;
    const seen = filterRows("Script Writer", "sw@x.com", rows);
    expect(seen).toHaveLength(1);
    expect(seen[0].video_title).toBe("go");
  });

  it("row filter matches assignee email case-insensitively", () => {
    const rows = [
      { script_writer_email: "SW@x.com", topic_status: "Ready" },
      { script_writer_email: "other@x.com", topic_status: "Ready" },
    ] as any;
    expect(filterRows("Script Writer", "sw@x.com", rows)).toHaveLength(1);
  });

  it("cannot edit columns it does not own", () => {
    expect(canSetValue("Script Writer", "tutorial_status", "In Progress")).toBe(false);
    expect(canSetValue("Script Writer", "video_editor_status", "In Progress")).toBe(false);
  });

  it("row_id is always included for addressing", () => {
    expect(visibleColumns("Script Writer")).toContain("row_id");
  });
});

// ---------------------------------------------------------------------------
// Single-role: Tutorial Maker
// ---------------------------------------------------------------------------

describe("Tutorial Maker", () => {
  it("sees script_link (view, read-only) and tutorial_link (edit)", () => {
    expect(visibleColumns("Tutorial Maker")).toContain("script_link");
    expect(canEdit("Tutorial Maker", "script_link")).toBe(false);
    expect(visibleColumns("Tutorial Maker")).toContain("tutorial_link");
    expect(canEdit("Tutorial Maker", "tutorial_link")).toBe(true);
  });

  it("does NOT see video_editor_link", () => {
    expect(visibleColumns("Tutorial Maker")).not.toContain("video_editor_link");
  });

  it("tutorial_maker_email is NOT visible (need-to-know)", () => {
    expect(visibleColumns("Tutorial Maker")).not.toContain("tutorial_maker_email");
  });

  it("sees tutorial_status (edit), tutorial_feedback (view)", () => {
    expect(visibleColumns("Tutorial Maker")).toContain("tutorial_status");
    expect(canEdit("Tutorial Maker", "tutorial_status")).toBe(true);
    expect(visibleColumns("Tutorial Maker")).toContain("tutorial_feedback");
    expect(canEdit("Tutorial Maker", "tutorial_feedback")).toBe(false);
  });

  it("cannot set tutorial_status to Done (approver-only)", () => {
    expect(canSetValue("Tutorial Maker", "tutorial_status", "Done")).toBe(false);
    expect(canSetValue("Tutorial Maker", "tutorial_status", "In Review")).toBe(true);
  });

  it("isApprover: Tutorial Maker is NOT an approver", () => {
    expect(isApprover("Tutorial Maker")).toBe(false);
  });

  it("does NOT see video_editor_status, video_editor_link, yt_upload_status", () => {
    const cols = visibleColumns("Tutorial Maker");
    expect(cols).not.toContain("video_editor_status");
    expect(cols).not.toContain("video_editor_link");
    expect(cols).not.toContain("yt_upload_status");
  });

  it("does NOT see video_description, topic_status", () => {
    const cols = visibleColumns("Tutorial Maker");
    expect(cols).not.toContain("video_description");
    expect(cols).not.toContain("topic_status");
  });

  it("does NOT see last_updated", () => {
    expect(visibleColumns("Tutorial Maker")).not.toContain("last_updated");
  });

  it("sees video_notes (view)", () => {
    expect(visibleColumns("Tutorial Maker")).toContain("video_notes");
  });

  it("gated handoff: Tutorial Maker only sees rows where script_status is Done", () => {
    const rows = [
      { tutorial_maker_email: "tm@x.com", script_status: "Done", video_title: "ready" },
      { tutorial_maker_email: "tm@x.com", script_status: "In Review", video_title: "blocked" },
      { tutorial_maker_email: "tm@x.com", script_status: "", video_title: "no script" },
    ] as any;
    const seen = filterRows("Tutorial Maker", "tm@x.com", rows);
    expect(seen).toHaveLength(1);
    expect(seen[0].video_title).toBe("ready");
  });

  it("projectRow returns only visible columns", () => {
    const row = { row_id: "1", video_title: "t", video_editor_link: "secret", script_link: "ok" } as any;
    const proj = projectRow("Tutorial Maker", row);
    expect(proj).not.toHaveProperty("video_editor_link");
    expect(proj.video_title).toBe("t");
    expect(proj.script_link).toBe("ok");
  });

  it("cannot edit columns it does not own", () => {
    expect(canSetValue("Tutorial Maker", "video_editor_status", "In Progress")).toBe(false);
    expect(canSetValue("Tutorial Maker", "script_status", "In Progress")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Single-role: Video Editor
// ---------------------------------------------------------------------------

describe("Video Editor", () => {
  it("sees tutorial_link (view) + video_editor_link (edit)", () => {
    expect(visibleColumns("Video Editor")).toContain("tutorial_link");
    expect(canEdit("Video Editor", "tutorial_link")).toBe(false);
    expect(visibleColumns("Video Editor")).toContain("video_editor_link");
    expect(canEdit("Video Editor", "video_editor_link")).toBe(true);
  });

  it("does NOT see script_link", () => {
    expect(visibleColumns("Video Editor")).not.toContain("script_link");
  });

  it("does NOT see tutorial_status (need-to-know: only the recording link, not full tutorial meta)", () => {
    expect(visibleColumns("Video Editor")).not.toContain("tutorial_status");
  });

  it("sees video_editor_status (edit), editor_feedback (view)", () => {
    expect(visibleColumns("Video Editor")).toContain("video_editor_status");
    expect(canEdit("Video Editor", "video_editor_status")).toBe(true);
    expect(visibleColumns("Video Editor")).toContain("editor_feedback");
    expect(canEdit("Video Editor", "editor_feedback")).toBe(false);
  });

  it("cannot set video_editor_status to Done (approver-only)", () => {
    expect(canSetValue("Video Editor", "video_editor_status", "Done")).toBe(false);
    expect(canSetValue("Video Editor", "video_editor_status", "In Review")).toBe(true);
  });

  it("isApprover: Video Editor is NOT an approver", () => {
    expect(isApprover("Video Editor")).toBe(false);
  });

  it("does NOT see tutorial_maker_email, tutorial_instruction, tutorial_feedback, video_description, video_editor_email, topic_status", () => {
    const cols = visibleColumns("Video Editor");
    expect(cols).not.toContain("tutorial_maker_email");
    expect(cols).not.toContain("tutorial_instruction");
    expect(cols).not.toContain("tutorial_feedback");
    expect(cols).not.toContain("video_description");
    expect(cols).not.toContain("video_editor_email");
    expect(cols).not.toContain("topic_status");
  });

  it("does NOT see last_updated", () => {
    expect(visibleColumns("Video Editor")).not.toContain("last_updated");
  });

  it("gated handoff: Video Editor only sees rows where tutorial_status is Done", () => {
    const rows = [
      { video_editor_email: "john@x.com", tutorial_status: "Done", video_title: "ready" },
      { video_editor_email: "john@x.com", tutorial_status: "In Progress", video_title: "not ready" },
      { video_editor_email: "john@x.com", tutorial_status: "", video_title: "blank" },
    ] as any;
    const seen = filterRows("Video Editor", "john@x.com", rows);
    expect(seen).toHaveLength(1);
    expect(seen[0].video_title).toBe("ready");
  });

  it("cannot edit columns it does not own", () => {
    expect(canSetValue("Video Editor", "tutorial_status", "In Progress")).toBe(false);
    expect(canSetValue("Video Editor", "script_status", "In Progress")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Approver-only canSetValue
// ---------------------------------------------------------------------------

describe("canSetValue approver-only values", () => {
  it("Admin can set all status cols to Done", () => {
    expect(canSetValue("Admin", "script_status", "Done")).toBe(true);
    expect(canSetValue("Admin", "tutorial_status", "Done")).toBe(true);
    expect(canSetValue("Admin", "video_editor_status", "Done")).toBe(true);
  });

  it("Reviewer can set all status cols to Done", () => {
    expect(canSetValue("Reviewer", "script_status", "Done")).toBe(true);
    expect(canSetValue("Reviewer", "tutorial_status", "Done")).toBe(true);
    expect(canSetValue("Reviewer", "video_editor_status", "Done")).toBe(true);
  });

  it("Script Writer cannot set script_status to Done", () => {
    expect(canSetValue("Script Writer", "script_status", "Done")).toBe(false);
  });

  it("Tutorial Maker cannot set tutorial_status to Done", () => {
    expect(canSetValue("Tutorial Maker", "tutorial_status", "Done")).toBe(false);
  });

  it("Video Editor cannot set video_editor_status to Done", () => {
    expect(canSetValue("Video Editor", "video_editor_status", "Done")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isRowLockedFor (back-compat)
// ---------------------------------------------------------------------------

describe("isRowLockedFor (back-compat)", () => {
  it("doer row is locked when their owned status is Done", () => {
    expect(isRowLockedFor("Script Writer", { script_status: "Done" } as any)).toBe(true);
    expect(isRowLockedFor("Script Writer", { script_status: "In Review" } as any)).toBe(false);
    expect(isRowLockedFor("Script Writer", { script_status: "" } as any)).toBe(false);
    expect(isRowLockedFor("Tutorial Maker", { tutorial_status: "Done" } as any)).toBe(true);
    expect(isRowLockedFor("Tutorial Maker", { tutorial_status: "In Review" } as any)).toBe(false);
    expect(isRowLockedFor("Video Editor", { video_editor_status: "Done" } as any)).toBe(true);
    expect(isRowLockedFor("Video Editor", { video_editor_status: "In Progress" } as any)).toBe(false);
  });

  it("approvers are never locked", () => {
    expect(isRowLockedFor("Admin", { tutorial_status: "Done" } as any)).toBe(false);
    expect(isRowLockedFor("Admin", { script_status: "Done" } as any)).toBe(false);
    expect(isRowLockedFor("Reviewer", { video_editor_status: "Done" } as any)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unknown role
// ---------------------------------------------------------------------------

describe("unknown role", () => {
  it("gets nothing", () => {
    expect(visibleColumns("Nope")).toEqual([]);
    expect(canEdit("Nope", "video_title")).toBe(false);
    expect(filterRows("Nope", "x@y.com", [{} as any])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Multi-role union helpers
// ---------------------------------------------------------------------------

describe("visibleColumnsForRoles", () => {
  it("Script Writer + Tutorial Maker union includes BOTH script_link and tutorial_link", () => {
    const cols = visibleColumnsForRoles(["Script Writer", "Tutorial Maker"]);
    expect(cols).toContain("script_link");
    expect(cols).toContain("tutorial_link");
  });

  it("preserves COLUMNS order", () => {
    const cols = visibleColumnsForRoles(["Script Writer", "Tutorial Maker"]);
    const scriptIdx = cols.indexOf("script_link");
    const tutorialIdx = cols.indexOf("tutorial_link");
    expect(scriptIdx).toBeGreaterThanOrEqual(0);
    expect(tutorialIdx).toBeGreaterThanOrEqual(0);
    expect(scriptIdx).toBeLessThan(tutorialIdx);
  });

  it("Admin in list → all columns", () => {
    const cols = visibleColumnsForRoles(["Admin", "Script Writer"]);
    expect(cols).toEqual([...COLUMNS]);
  });

  it("Tutorial Maker + Video Editor includes both tutorial_link and video_editor_link; TM contributes script_link (view)", () => {
    const cols = visibleColumnsForRoles(["Tutorial Maker", "Video Editor"]);
    expect(cols).toContain("tutorial_link");
    expect(cols).toContain("video_editor_link");
    // Tutorial Maker can view script_link, so the union includes it
    expect(cols).toContain("script_link");
    // Video Editor alone does NOT see script_link
    expect(visibleColumns("Video Editor")).not.toContain("script_link");
  });
});

describe("canEditForRoles", () => {
  it("Script Writer + Tutorial Maker: can edit script_link (SW) AND tutorial_link (TM)", () => {
    expect(canEditForRoles(["Script Writer", "Tutorial Maker"], "script_link")).toBe(true);
    expect(canEditForRoles(["Script Writer", "Tutorial Maker"], "tutorial_link")).toBe(true);
  });

  it("Tutorial Maker alone cannot edit script_link", () => {
    expect(canEditForRoles(["Tutorial Maker"], "script_link")).toBe(false);
  });

  it("Script Writer alone cannot edit tutorial_link", () => {
    expect(canEditForRoles(["Script Writer"], "tutorial_link")).toBe(false);
  });

  it("any role with Admin can edit anything", () => {
    expect(canEditForRoles(["Admin", "Script Writer"], "video_editor_status")).toBe(true);
  });
});

describe("canSetValueForRoles", () => {
  it("Script Writer + Reviewer: can set script_status to Done (Reviewer is approver)", () => {
    expect(canSetValueForRoles(["Script Writer", "Reviewer"], "script_status", "Done")).toBe(true);
  });

  it("Script Writer alone cannot set script_status to Done", () => {
    expect(canSetValueForRoles(["Script Writer"], "script_status", "Done")).toBe(false);
  });

  it("Admin always can", () => {
    expect(canSetValueForRoles(["Admin"], "script_status", "Done")).toBe(true);
  });
});

describe("isApproverRoles", () => {
  it("Admin → true", () => expect(isApproverRoles(["Admin"])).toBe(true));
  it("Reviewer → true", () => expect(isApproverRoles(["Reviewer"])).toBe(true));
  it("Script Writer → false", () => expect(isApproverRoles(["Script Writer"])).toBe(false));
  it("Script Writer + Tutorial Maker → false", () => expect(isApproverRoles(["Script Writer", "Tutorial Maker"])).toBe(false));
  it("Script Writer + Admin → true", () => expect(isApproverRoles(["Script Writer", "Admin"])).toBe(true));
});

describe("filterRowsForRoles", () => {
  const rows = [
    { row_id: "1", script_writer_email: "sam@x.com", topic_status: "Ready", video_title: "script-row" },
    { row_id: "2", tutorial_maker_email: "sam@x.com", script_status: "Done", video_title: "tutorial-row" },
    { row_id: "3", script_writer_email: "other@x.com", topic_status: "Ready", video_title: "other-script" },
    { row_id: "4", tutorial_maker_email: "other@x.com", script_status: "Done", video_title: "other-tutorial" },
    // sam is SW but topic not Ready → blocked
    { row_id: "5", script_writer_email: "sam@x.com", topic_status: "To Do", video_title: "sw-blocked" },
    // sam is TM but script not Done → blocked
    { row_id: "6", tutorial_maker_email: "sam@x.com", script_status: "In Review", video_title: "tm-blocked" },
  ] as any;

  it("SW + TM for sam: sees rows where sam is SW (topic Ready) OR TM (script Done), deduped", () => {
    const seen = filterRowsForRoles(["Script Writer", "Tutorial Maker"], "sam@x.com", rows);
    const titles = seen.map((r: any) => r.video_title);
    expect(titles).toContain("script-row");
    expect(titles).toContain("tutorial-row");
    expect(titles).not.toContain("other-script");
    expect(titles).not.toContain("other-tutorial");
    expect(titles).not.toContain("sw-blocked");
    expect(titles).not.toContain("tm-blocked");
    // No duplicates
    expect(seen).toHaveLength(2);
  });

  it("Admin in roles → returns all rows", () => {
    const seen = filterRowsForRoles(["Admin", "Script Writer"], "sam@x.com", rows);
    expect(seen).toHaveLength(rows.length);
  });

  it("unknown role → returns nothing", () => {
    const seen = filterRowsForRoles(["Nope"], "sam@x.com", rows);
    expect(seen).toHaveLength(0);
  });
});

describe("projectRowForRoles", () => {
  it("SW + TM: row includes script_link and tutorial_link but not video_editor_link", () => {
    const row = {
      row_id: "1",
      video_title: "t",
      script_link: "s-link",
      tutorial_link: "t-link",
      video_editor_link: "secret",
    } as any;
    const proj = projectRowForRoles(["Script Writer", "Tutorial Maker"], row);
    expect(proj.script_link).toBe("s-link");
    expect(proj.tutorial_link).toBe("t-link");
    expect(proj).not.toHaveProperty("video_editor_link");
  });
});

describe("workerStagesForRoles", () => {
  it("Script Writer → script_status", () => {
    const stages = workerStagesForRoles(["Script Writer"]);
    expect(stages.map(s => s.statusCol)).toContain("script_status");
    expect(stages).toHaveLength(1);
  });

  it("Tutorial Maker → tutorial_status", () => {
    const stages = workerStagesForRoles(["Tutorial Maker"]);
    expect(stages.map(s => s.statusCol)).toContain("tutorial_status");
    expect(stages).toHaveLength(1);
  });

  it("Script Writer + Tutorial Maker → script_status AND tutorial_status", () => {
    const stages = workerStagesForRoles(["Script Writer", "Tutorial Maker"]);
    const cols = stages.map(s => s.statusCol);
    expect(cols).toContain("script_status");
    expect(cols).toContain("tutorial_status");
    expect(stages).toHaveLength(2);
  });

  it("Video Editor → video_editor_status", () => {
    const stages = workerStagesForRoles(["Video Editor"]);
    expect(stages.map(s => s.statusCol)).toContain("video_editor_status");
  });

  it("Admin → empty (handled separately)", () => {
    expect(workerStagesForRoles(["Admin"])).toHaveLength(0);
  });

  it("Reviewer → empty (handled separately)", () => {
    expect(workerStagesForRoles(["Reviewer"])).toHaveLength(0);
  });

  it("Admin + Script Writer → only script_status (Admin excluded)", () => {
    const stages = workerStagesForRoles(["Admin", "Script Writer"]);
    const cols = stages.map(s => s.statusCol);
    expect(cols).toContain("script_status");
    expect(cols).not.toContain("topic_status"); // Admin's laneStatus, but excluded
  });
});

// ---------------------------------------------------------------------------
// isFieldLocked
// ---------------------------------------------------------------------------

describe("isFieldLocked", () => {
  it("Script Writer: script_link locked when script_status is Done", () => {
    expect(isFieldLocked(["Script Writer"], "script_link", { script_status: "Done" } as any)).toBe(true);
  });

  it("Script Writer: script_link IS locked when script_status is In Review (submitted)", () => {
    expect(isFieldLocked(["Script Writer"], "script_link", { script_status: "In Review" } as any)).toBe(true);
  });

  it("Script Writer: script_status itself NOT locked when In Review (can drag back to In Progress)", () => {
    expect(isFieldLocked(["Script Writer"], "script_status", { script_status: "In Review" } as any)).toBe(false);
  });

  it("Script Writer: script_link editable again when status In Progress", () => {
    expect(isFieldLocked(["Script Writer"], "script_link", { script_status: "In Progress" } as any)).toBe(false);
  });

  it("Admin: never locked (isApprover)", () => {
    expect(isFieldLocked(["Admin"], "script_link", { script_status: "Done" } as any)).toBe(false);
  });

  it("Reviewer: never locked (isApprover)", () => {
    expect(isFieldLocked(["Reviewer"], "tutorial_link", { tutorial_status: "Done" } as any)).toBe(false);
  });

  it("SW + TM: tutorial_link NOT locked when tutorial_status is In Progress (even though script is done)", () => {
    // The lock is governed by tutorial_status for tutorial_link, not script_status
    expect(isFieldLocked(
      ["Script Writer", "Tutorial Maker"],
      "tutorial_link",
      { script_status: "Done", tutorial_status: "In Progress" } as any,
    )).toBe(false);
  });

  it("SW + TM: tutorial_link IS locked when tutorial_status is Done", () => {
    expect(isFieldLocked(
      ["Script Writer", "Tutorial Maker"],
      "tutorial_link",
      { script_status: "Done", tutorial_status: "Done" } as any,
    )).toBe(true);
  });

  it("col with no STAGE_OF_COL entry → never locked", () => {
    expect(isFieldLocked(["Script Writer"], "video_title", { script_status: "Done" } as any)).toBe(false);
  });

  it("SW + Admin: never locked (Admin is approver)", () => {
    expect(isFieldLocked(["Script Writer", "Admin"], "script_link", { script_status: "Done" } as any)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseRoles (from roles.ts)
// ---------------------------------------------------------------------------

describe("parseRoles", () => {
  it("single valid role", () => {
    expect(parseRoles("Script Writer")).toEqual(["Script Writer"]);
  });

  it("comma-separated multiple valid roles", () => {
    expect(parseRoles("Script Writer, Tutorial Maker")).toEqual(["Script Writer", "Tutorial Maker"]);
  });

  it("trims whitespace", () => {
    expect(parseRoles("  Admin , Reviewer  ")).toEqual(["Admin", "Reviewer"]);
  });

  it("drops invalid roles", () => {
    expect(parseRoles("Script Writer, InvalidRole, Tutorial Maker")).toEqual(["Script Writer", "Tutorial Maker"]);
  });

  it("empty string → []", () => {
    expect(parseRoles("")).toEqual([]);
  });

  it("all invalid → []", () => {
    expect(parseRoles("Typo, BadRole")).toEqual([]);
  });

  it("Video Editor is a valid role", () => {
    expect(parseRoles("Video Editor")).toEqual(["Video Editor"]);
  });
});

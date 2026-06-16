import { describe, it, expect } from "vitest";
import {
  overallStage,
  stageState,
  progress,
  isStalled,
  isStuck,
} from "../src/client/pipeline";

// ── Fixtures ──────────────────────────────────────────────────────────────────

// A fully published row
const published: Record<string, string> = {
  script_status:       "Done",
  tutorial_status:     "Done",
  video_editor_status: "Done",
  yt_upload_status:    "Published",
  script_feedback:     "",
  tutorial_feedback:   "",
  editor_feedback:     "",
  last_updated:        new Date(Date.now() - 10 * 86_400_000).toISOString(), // 10 days ago
};

// An editing row (tutorial done, editor In Progress)
const editing: Record<string, string> = {
  script_status:       "Done",
  tutorial_status:     "Done",
  video_editor_status: "In Progress",
  yt_upload_status:    "",
  script_feedback:     "",
  tutorial_feedback:   "",
  editor_feedback:     "",
  last_updated:        new Date(Date.now() - 1 * 86_400_000).toISOString(), // 1 day ago
};

// A sent-back (stalled) row: script In Progress + feedback present
const stalledScript: Record<string, string> = {
  script_status:       "In Progress",
  tutorial_status:     "",
  video_editor_status: "",
  yt_upload_status:    "",
  script_feedback:     "Please revise section 3",
  tutorial_feedback:   "",
  editor_feedback:     "",
  last_updated:        new Date(Date.now() - 2 * 86_400_000).toISOString(),
};

// A stuck row: not published and last_updated > 3 days ago
const stuckRow: Record<string, string> = {
  script_status:       "In Progress",
  tutorial_status:     "",
  video_editor_status: "",
  yt_upload_status:    "",
  script_feedback:     "",
  tutorial_feedback:   "",
  editor_feedback:     "",
  last_updated:        new Date(Date.now() - 7 * 86_400_000).toISOString(), // 7 days ago (old)
};

// A row in Tutorial stage (script done, tutorial in progress)
const tutorialRow: Record<string, string> = {
  script_status:       "Done",
  tutorial_status:     "In Progress",
  video_editor_status: "",
  yt_upload_status:    "",
  script_feedback:     "",
  tutorial_feedback:   "",
  editor_feedback:     "",
  last_updated:        new Date(Date.now() - 1 * 86_400_000).toISOString(),
};

// ── overallStage ──────────────────────────────────────────────────────────────

describe("overallStage", () => {
  it("returns Published when yt_upload_status is Published", () => {
    expect(overallStage(published)).toBe("Published");
  });

  it("returns Upload when video_editor_status is Done (not yet published)", () => {
    const row: Record<string, string> = {
      script_status:       "Done",
      tutorial_status:     "Done",
      video_editor_status: "Done",
      yt_upload_status:    "To Do",
    };
    expect(overallStage(row)).toBe("Upload");
  });

  it("returns Editing when tutorial_status is Done but editor not done", () => {
    expect(overallStage(editing)).toBe("Editing");
  });

  it("returns Tutorial when script_status is Done but tutorial not done", () => {
    expect(overallStage(tutorialRow)).toBe("Tutorial");
  });

  it("returns Script when script_status is not Done", () => {
    expect(overallStage(stalledScript)).toBe("Script");
    expect(overallStage(stuckRow)).toBe("Script");
  });

  it("returns Script for a blank row", () => {
    expect(overallStage({})).toBe("Script");
  });
});

// ── stageState ────────────────────────────────────────────────────────────────

describe("stageState", () => {
  it("returns done for 'Done'", () => {
    expect(stageState("Done")).toBe("done");
  });

  it("returns done for 'Published'", () => {
    expect(stageState("Published")).toBe("done");
  });

  it("returns active for 'In Progress'", () => {
    expect(stageState("In Progress")).toBe("active");
  });

  it("returns active for 'In Review'", () => {
    expect(stageState("In Review")).toBe("active");
  });

  it("returns active for 'Draft'", () => {
    expect(stageState("Draft")).toBe("active");
  });

  it("returns pending for 'To Do'", () => {
    expect(stageState("To Do")).toBe("pending");
  });

  it("returns pending for empty string", () => {
    expect(stageState("")).toBe("pending");
  });
});

// ── progress ──────────────────────────────────────────────────────────────────

describe("progress", () => {
  it("published row: all 5 steps done", () => {
    const p = progress(published);
    expect(p).toHaveLength(5);
    expect(p[0]).toEqual({ key: "Script",    state: "done" });
    expect(p[1]).toEqual({ key: "Tutorial",  state: "done" });
    expect(p[2]).toEqual({ key: "Editing",   state: "done" });
    expect(p[3]).toEqual({ key: "Upload",    state: "done" });
    expect(p[4]).toEqual({ key: "Published", state: "done" });
  });

  it("editing row: Script=done, Tutorial=done, Editing=active, Upload=pending, Published=pending", () => {
    const p = progress(editing);
    expect(p[0]).toEqual({ key: "Script",    state: "done"    });
    expect(p[1]).toEqual({ key: "Tutorial",  state: "done"    });
    expect(p[2]).toEqual({ key: "Editing",   state: "active"  });
    expect(p[3]).toEqual({ key: "Upload",    state: "pending" });
    expect(p[4]).toEqual({ key: "Published", state: "pending" });
  });

  it("tutorial row: Script=done, Tutorial=active, rest=pending", () => {
    const p = progress(tutorialRow);
    expect(p[0]).toEqual({ key: "Script",    state: "done"    });
    expect(p[1]).toEqual({ key: "Tutorial",  state: "active"  });
    expect(p[2]).toEqual({ key: "Editing",   state: "pending" });
    expect(p[3]).toEqual({ key: "Upload",    state: "pending" });
    expect(p[4]).toEqual({ key: "Published", state: "pending" });
  });

  it("scripting row: Script=active, rest=pending", () => {
    const p = progress(stalledScript);
    expect(p[0]).toEqual({ key: "Script",    state: "active"  });
    expect(p[1]).toEqual({ key: "Tutorial",  state: "pending" });
    expect(p[2]).toEqual({ key: "Editing",   state: "pending" });
    expect(p[3]).toEqual({ key: "Upload",    state: "pending" });
    expect(p[4]).toEqual({ key: "Published", state: "pending" });
  });

  it("blank row: all 5 pending", () => {
    const p = progress({});
    expect(p).toHaveLength(5);
    expect(p.every(s => s.state === "pending")).toBe(true);
  });
});

// ── isStalled ─────────────────────────────────────────────────────────────────

describe("isStalled", () => {
  it("returns true when script_status is In Progress AND script_feedback present", () => {
    expect(isStalled(stalledScript)).toBe(true);
  });

  it("returns true when tutorial_status is In Progress AND tutorial_feedback present", () => {
    const row: Record<string, string> = {
      script_status:       "Done",
      tutorial_status:     "In Progress",
      video_editor_status: "",
      tutorial_feedback:   "Please revise section 3",
      script_feedback:     "",
      editor_feedback:     "",
    };
    expect(isStalled(row)).toBe(true);
  });

  it("returns true when video_editor_status is In Progress AND editor_feedback present", () => {
    const row: Record<string, string> = {
      script_status:       "Done",
      tutorial_status:     "Done",
      video_editor_status: "In Progress",
      editor_feedback:     "Fix the colour grading",
      script_feedback:     "",
      tutorial_feedback:   "",
    };
    expect(isStalled(row)).toBe(true);
  });

  it("returns false when In Progress but NO feedback", () => {
    expect(isStalled(stuckRow)).toBe(false);
  });

  it("returns false for a published row", () => {
    expect(isStalled(published)).toBe(false);
  });

  it("returns false for an editing row without feedback", () => {
    expect(isStalled(editing)).toBe(false);
  });
});

// ── isStuck ───────────────────────────────────────────────────────────────────

describe("isStuck", () => {
  it("returns true for an unpublished row last updated > 3 days ago", () => {
    expect(isStuck(stuckRow)).toBe(true);
  });

  it("returns false for a published row even if last_updated is old", () => {
    expect(isStuck(published)).toBe(false);
  });

  it("returns false when last_updated is recent (1 day ago)", () => {
    expect(isStuck(editing)).toBe(false);
  });

  it("returns false when last_updated is missing", () => {
    const row: Record<string, string> = { script_status: "In Progress" };
    expect(isStuck(row)).toBe(false);
  });

  it("returns false when last_updated is exactly 3 days ago", () => {
    const row: Record<string, string> = {
      script_status: "In Progress",
      last_updated: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    };
    expect(isStuck(row)).toBe(false);
  });

  it("returns true when last_updated is 4 days ago", () => {
    const row: Record<string, string> = {
      script_status: "In Progress",
      last_updated: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    };
    expect(isStuck(row)).toBe(true);
  });

  it("returns false when last_updated is invalid ISO string", () => {
    const row: Record<string, string> = {
      script_status: "In Progress",
      last_updated: "not-a-date",
    };
    expect(isStuck(row)).toBe(false);
  });
});

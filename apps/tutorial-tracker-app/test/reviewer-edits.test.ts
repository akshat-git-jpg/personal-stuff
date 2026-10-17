import { describe, it, expect } from "vitest";
import { authorizeWrite } from "../src/shared/engine/rbac";

const RV = "rv@x.com";
// Standard card at Editing: RV reviews Script only.
const row = (scriptStatus: string) => ({
  row_id: "r1", video_title: "v", pipeline: "standard",
  topic_status: "Done", script_status: scriptStatus, script_reviewer_email: RV,
});

describe("a reviewer's instruction edits", () => {
  it("are allowed while the stage they review is open", () => {
    expect(authorizeWrite(["Reviewer"], RV, "tutorial_instruction", "x", row("In Review")).ok).toBe(true);
  });
  it("stop once that stage is approved", () => {
    expect(authorizeWrite(["Reviewer"], RV, "tutorial_instruction", "x", row("Done")).ok).toBe(false);
  });
});

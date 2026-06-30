import { describe, it, expect } from "vitest";
import { validatePipelines, getPipeline, allRoles, pipelineIds } from "../src/shared/engine/registry";
import { assembleRow, decomposeRow, routeWrite, type StageRecord } from "../src/shared/engine/card";

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

import { describe, it, expect } from "vitest";
import { PIPELINES, getPipeline } from "../src/shared/engine/registry";
import { colOf, stageHasReviewerSlot, stageKind } from "../src/shared/engine/types";
import { assignmentProblem, assignmentProblems, assignSlotOf } from "../src/shared/engine/assign";
import { isGateOpen } from "../src/shared/engine/derive";
import { cardIssues, defaultIssues } from "../src/shared/engine/integrity";
import type { Memberships } from "../src/shared/engine/memberships";

const ME = "me@x.com";

// Guard: loops every pipeline so a new def is covered without a new test.
describe("assignment rules across every pipeline", () => {
  for (const p of Object.values(PIPELINES)) {
    const all: Memberships = { [p.id]: [...new Set([...p.stages.map((s) => s.role), "Reviewer"])], "*": ["Admin"] };
    for (const s of p.stages) {
      const doer = colOf(s, "assignee");
      it(`${p.id}/${s.id}: slot lookup is scoped to this pipeline`, () => {
        expect(assignSlotOf(p, doer)?.role).toBe(s.role);
      });
      it(`${p.id}/${s.id}: someone without the role is refused`, () => {
        expect(assignmentProblem(p, doer, ME, {}, {})).toMatch(/isn't a/);
      });
      if (!stageHasReviewerSlot(s)) continue;
      const rev = colOf(s, "reviewer");
      const self = assignmentProblem(p, rev, ME, { [doer]: ME }, all);
      it(`${p.id}/${s.id}: reviewing your own work is ${stageKind(s) === "brief" ? "allowed on the brief" : "refused"}`, () => {
        if (stageKind(s) === "brief") expect(self).toBeNull();
        else expect(self).toMatch(/own work/);
      });
      it(`${p.id}/${s.id}: a different reviewer is fine`, () => {
        expect(assignmentProblem(p, rev, "other@x.com", { [doer]: ME }, { [p.id]: ["Reviewer"] })).toBeNull();
      });
    }
  }
});

describe("integrity: self review and bad defaults", () => {
  const p = getPipeline("coupon-code");
  const team = new Map<string, Memberships>([[ME, { "coupon-code": ["Video Editor", "Reviewer"] }]]);
  it("flags a stage whose doer is its own reviewer", () => {
    const row = { row_id: "r1", video_title: "V", pipeline: p.id, video_status: "In Progress", video_assignee: ME, video_reviewer: ME };
    expect(cardIssues([row], team).map((i) => i.code)).toContain("self_review");
  });
  it("flags a default pointing at someone who left", () => {
    expect(defaultIssues(p, { video_assignee: "gone@x.com" }, team).map((i) => i.code)).toEqual(["bad_default"]);
    expect(assignmentProblems(p, { video_assignee: ME }, team)).toEqual([]);
  });
});

describe("gates", () => {
  it("a reopened stage also closes the stages two steps later", () => {
    const p = getPipeline("coupon-code");
    const upload = p.stages.find((s) => s.id === "upload")!;
    const done = { pipeline: p.id, topic_status: "Done", video_status: "Done", thumbnail_status: "Done" };
    expect(isGateOpen(p, upload, done)).toBe(true);
    expect(isGateOpen(p, upload, { ...done, video_status: "Need Changes" })).toBe(false);
  });
});

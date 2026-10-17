import { describe, it, expect } from "vitest";
import { PIPELINES } from "../src/shared/engine/registry";
import { colOf, stageHasReviewerSlot } from "../src/shared/engine/types";
import { lifecycle } from "../src/shared/engine/lifecycle";
import { cardIssues, cardIssuesReport } from "../src/shared/engine/integrity";
import type { Memberships } from "../src/shared/engine/memberships";
import type { Row } from "../src/shared/engine/rbac";

const DOER = "doer@x.com";
const REV = "rev@x.com";

// Guard: loops every pipeline so a new def is covered without a new test.
describe("cardIssues across every pipeline", () => {
  for (const p of Object.values(PIPELINES)) {
    const team = new Map<string, Memberships>([
      [DOER, { [p.id]: [...new Set(p.stages.map((s) => s.role))], "*": ["Admin"] }],
      [REV, { [p.id]: ["Reviewer"] }],
    ]);
    for (const s of p.stages.filter((s) => lifecycle(s.lifecycle).reviewed)) {
      const row = (extra: Row): Row => ({
        row_id: "r1", video_title: "T", pipeline: p.id,
        [colOf(s, "status")]: "In Review", [colOf(s, "assignee")]: DOER, ...extra,
      });

      it(`${p.id}/${s.id}: In Review with no reviewer is flagged`, () => {
        expect(cardIssues([row({})], team).map((i) => i.code)).toEqual(["review_without_reviewer"]);
      });

      if (!stageHasReviewerSlot(s)) continue;
      it(`${p.id}/${s.id}: a real reviewer is healthy`, () => {
        expect(cardIssues([row({ [colOf(s, "reviewer")]: REV })], team)).toEqual([]);
      });
      it(`${p.id}/${s.id}: a reviewer without the Reviewer role is flagged`, () => {
        expect(cardIssues([row({ [colOf(s, "reviewer")]: "nobody@x.com" })], team).map((i) => i.code))
          .toEqual(["reviewer_lacks_role"]);
      });
      it(`${p.id}/${s.id}: a Done stage is never flagged`, () => {
        expect(cardIssues([row({ [colOf(s, "status")]: "Done", [colOf(s, "assignee")]: "gone@x.com" })], team)).toEqual([]);
      });
    }
  }
});

describe("assignee checks", () => {
  it("flags an assignee who is not in the card's system", () => {
    const row: Row = { row_id: "r2", video_title: "V", pipeline: "coupon-code", video_status: "To Do", video_assignee: "typo@gamail.com" };
    expect(cardIssues([row], new Map()).map((i) => i.code)).toEqual(["assignee_lacks_role"]);
  });
});

describe("cardIssuesReport", () => {
  it("is null when healthy and names each card otherwise", () => {
    expect(cardIssuesReport([])).toBeNull();
    const text = cardIssuesReport([{ code: "review_without_reviewer", row_id: "r1", title: "a <b>", stage: "Video", detail: "d" }]);
    expect(text).toContain("Tracker: 1 stuck card");
    expect(text).toContain("a &lt;b&gt;");
  });
});

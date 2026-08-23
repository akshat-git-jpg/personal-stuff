// Removing a person must never strand their unfinished work. These pin the query
// the Team panel asks before it lets a removal through.
import { describe, it, expect } from "vitest";
import { liveHoldingsFor, rolesRemoved, stageIsLive } from "../src/shared/engine/holdings";
import { getPipeline } from "../src/shared/engine/registry";

const ED = "ed@x.com";
const RV = "rv@x.com";

/** A standard card sitting at Editing, owned by ED and reviewed by RV. */
function card(row_id: string, editingStatus: string, extra: Record<string, string> = {}) {
  return {
    row_id, video_title: `v-${row_id}`, pipeline: "standard",
    topic_status: "Done", script_status: "Done", tutorial_status: "Done",
    video_editor_status: editingStatus,
    video_editor_email: ED,
    video_editor_reviewer_email: RV,
    ...extra,
  };
}

describe("what counts as live", () => {
  const editing = getPipeline("standard").stages.find((s) => s.id === "editing")!;

  it("an unfinished stage is live, whatever the status", () => {
    for (const s of ["To Do", "In Progress", "In Review", "Need Changes"]) {
      expect(stageIsLive(editing, card("r1", s))).toBe(true);
    }
  });

  it("a finished stage is not live", () => {
    expect(stageIsLive(editing, card("r1", "Done"))).toBe(false);
  });
});

describe("liveHoldingsFor", () => {
  it("finds the doer's unfinished stage and names the column to rewrite", () => {
    const h = liveHoldingsFor(ED, [card("r1", "To Do")]);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({
      row_id: "r1", stageId: "editing", stageLabel: "Editing", status: "To Do",
      col: "video_editor_email", slot: "doer", role: "Video Editor",
      pipelineId: "standard",
    });
  });

  it("finds a reviewer slot too, and asks for a Reviewer replacement", () => {
    const h = liveHoldingsFor(RV, [card("r1", "In Review")]);
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ col: "video_editor_reviewer_email", slot: "reviewer", role: "Reviewer" });
  });

  it("ignores finished work — that strands nothing", () => {
    expect(liveHoldingsFor(ED, [card("r1", "Done")])).toHaveLength(0);
  });

  it("is case- and space-insensitive about the email", () => {
    expect(liveHoldingsFor("  ED@X.COM ", [card("r1", "In Progress")])).toHaveLength(1);
  });

  it("finds nothing for a blank email, rather than matching empty slots", () => {
    expect(liveHoldingsFor("", [card("r1", "To Do")])).toHaveLength(0);
    expect(liveHoldingsFor("  ", [card("r1", "To Do")])).toHaveLength(0);
  });

  it("scopes to the named systems", () => {
    const rows = [card("r1", "To Do")];
    expect(liveHoldingsFor(ED, rows, { systems: ["standard"] })).toHaveLength(1);
    expect(liveHoldingsFor(ED, rows, { systems: ["tut-2"] })).toHaveLength(0);
  });

  it("scopes to the roles actually being taken away", () => {
    const rows = [card("r1", "To Do")];
    expect(liveHoldingsFor(ED, rows, { roles: ["Video Editor"] })).toHaveLength(1);
    // Losing only Thumbnail Maker strands no Editing work.
    expect(liveHoldingsFor(ED, rows, { roles: ["Thumbnail Maker"] })).toHaveLength(0);
  });

  it("reports one entry per held slot across many cards", () => {
    const h = liveHoldingsFor(ED, [card("r1", "To Do"), card("r2", "Need Changes"), card("r3", "Done")]);
    expect(h.map((x) => x.row_id)).toEqual(["r1", "r2"]);
  });

  it("counts a person who holds two slots on one card twice", () => {
    // Same person as the editor AND the thumbnail maker on one video.
    const both = card("r1", "To Do", { thumbnail_maker_email: ED, thumbnail_status: "To Do" });
    const h = liveHoldingsFor(ED, [both]);
    expect(h.map((x) => x.stageId).sort()).toEqual(["editing", "thumbnail"]);
  });
});

describe("rolesRemoved", () => {
  it("names the systems and roles a save takes away", () => {
    const r = rolesRemoved(
      { standard: ["Video Editor", "Thumbnail Maker"], "tut-2": ["Scriptwriter"] },
      { standard: ["Video Editor"], "tut-2": ["Scriptwriter"] },
    );
    expect(r.systems).toEqual(["standard"]);
    expect(r.roles).toEqual(["Thumbnail Maker"]);
  });

  it("treats a dropped system as every role in it going away", () => {
    const r = rolesRemoved({ standard: ["Video Editor"], "tut-2": ["Scriptwriter"] }, { "tut-2": ["Scriptwriter"] });
    expect(r.systems).toEqual(["standard"]);
    expect(r.roles).toEqual(["Video Editor"]);
  });

  it("says nothing was removed when roles only get added", () => {
    const r = rolesRemoved({ standard: ["Video Editor"] }, { standard: ["Video Editor", "Thumbnail Maker"] });
    expect(r.systems).toEqual([]);
    expect(r.roles).toEqual([]);
  });

  it("ignores the cross-system admin key", () => {
    expect(rolesRemoved({ "*": ["Admin"] }, {}).roles).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { groupByLane, OTHER_LANE } from "../src/client/lanes";
import type { Row } from "../src/shared/rbac";

const LANES = ["To Do", "In Progress", "Done"];

describe("groupByLane", () => {
  it("buckets rows into the right lanes", () => {
    const rows: Row[] = [
      { row_id: "1", tutorial_status: "To Do" },
      { row_id: "2", tutorial_status: "Done" },
      { row_id: "3", tutorial_status: "In Progress" },
    ];
    const groups = groupByLane(rows, "tutorial_status", LANES);
    const byLane = Object.fromEntries(groups.map(g => [g.lane, g.rows]));
    expect(byLane["To Do"]).toHaveLength(1);
    expect(byLane["To Do"][0].row_id).toBe("1");
    expect(byLane["Done"]).toHaveLength(1);
    expect(byLane["In Progress"]).toHaveLength(1);
  });

  it("unknown values go to OTHER_LANE and OTHER is not returned when empty", () => {
    const rows: Row[] = [
      { row_id: "1", tutorial_status: "weird value" },
    ];
    const groups = groupByLane(rows, "tutorial_status", LANES);
    const laneNames = groups.map(g => g.lane);
    expect(laneNames).toContain(OTHER_LANE);
    const other = groups.find(g => g.lane === OTHER_LANE);
    expect(other?.rows).toHaveLength(1);
  });

  it("OTHER_LANE is not included when all rows fit known lanes", () => {
    const rows: Row[] = [
      { row_id: "1", tutorial_status: "To Do" },
    ];
    const groups = groupByLane(rows, "tutorial_status", LANES);
    const laneNames = groups.map(g => g.lane);
    expect(laneNames).not.toContain(OTHER_LANE);
  });

  it("empty input → all-empty lanes, no OTHER", () => {
    const groups = groupByLane([], "tutorial_status", LANES);
    expect(groups).toHaveLength(LANES.length);
    for (const g of groups) expect(g.rows).toHaveLength(0);
    const laneNames = groups.map(g => g.lane);
    expect(laneNames).not.toContain(OTHER_LANE);
  });

  it("rows with missing laneStatus value go to OTHER_LANE", () => {
    const rows: Row[] = [
      { row_id: "1" },  // no tutorial_status key
    ];
    const groups = groupByLane(rows, "tutorial_status", LANES);
    const other = groups.find(g => g.lane === OTHER_LANE);
    expect(other?.rows).toHaveLength(1);
  });

  it("multiple rows with same lane all end up there", () => {
    const rows: Row[] = [
      { row_id: "a", tutorial_status: "Done" },
      { row_id: "b", tutorial_status: "Done" },
      { row_id: "c", tutorial_status: "Done" },
    ];
    const groups = groupByLane(rows, "tutorial_status", LANES);
    const done = groups.find(g => g.lane === "Done");
    expect(done?.rows).toHaveLength(3);
  });
});

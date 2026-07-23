import { describe, test, expect } from "vitest";
import { mergePublish } from "../src/worker/logic";

describe("publish handler merge logic", () => {
  const now = "2026-07-23T00:00:00Z";
  const slug = "test";

  test("3-section fixture including one version bump", () => {
    // Existing DB state
    const existingS1 = { slug, id: "s01", version: 1, demo: 0, spoken_text: "s1 mod", takes_used: 1, locked: 0, take_key: "k1", updated_at: "old" };
    const existingS2 = { slug, id: "s02", version: 1, demo: 1, spoken_text: "s2 mod", takes_used: 2, locked: 1, take_key: "k2", updated_at: "old" };
    const existingS3 = { slug, id: "s03", version: 1, demo: 0, spoken_text: "s3 mod", takes_used: 3, locked: 0, take_key: "k3", updated_at: "old" };

    const incoming = [
      { id: "s01", version: 1, demo: false, spoken_text: "s1 orig" }, // unchanged
      { id: "s02", version: 2, demo: true, spoken_text: "s2 new" },  // bumped
      { id: "s04", version: 1, demo: false, spoken_text: "s4 new" }, // fresh
    ];

    const results = incoming.map(inc => {
      const ex = inc.id === "s01" ? existingS1 : inc.id === "s02" ? existingS2 : null;
      return mergePublish(ex, inc, slug, now);
    });

    expect(results[0].action).toBe("preserve");
    expect(results[0].row.spoken_text).toBe("s1 mod"); // kept
    expect(results[0].row.takes_used).toBe(1);

    expect(results[1].action).toBe("reset");
    expect(results[1].row.spoken_text).toBe("s2 new"); // reset
    expect(results[1].row.takes_used).toBe(0);
    expect(results[1].row.locked).toBe(0);

    expect(results[2].action).toBe("insert");
    expect(results[2].row.spoken_text).toBe("s4 new");
    expect(results[2].row.takes_used).toBe(0);
  });
});

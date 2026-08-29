// Regression guard for the INSERT placeholder/bind mismatch that made every
// "Create video" return HTTP 500 (the `slug` column was added to the column
// list but never bound). The class of bug is silent in review, so pin it:
// every INSERT's "?" count must equal its bind-arg count, and slug must
// actually land in the cards row.
import { describe, it, expect } from "vitest";
import { getStore } from "../src/worker/datastore";

interface Captured { sql: string; args: unknown[] }

function fakeDb(captured: Captured[]) {
  const stmt = (sql: string) => ({
    sql,
    args: [] as unknown[],
    bind(...args: unknown[]) { const s = { ...this, args }; captured.push({ sql, args }); return s; },
    async all() { return { results: [] }; },
    async first() { return null; },
    async run() { return { meta: { changes: 1 } }; },
  });
  return {
    prepare: (sql: string) => stmt(sql),
    batch: async () => [],
  };
}

const placeholders = (sql: string) => (sql.match(/\?/g) ?? []).length;

describe("appendRow", () => {
  it("binds exactly one value per placeholder in every INSERT", async () => {
    const captured: Captured[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = getStore({ TRACKER_DB: fakeDb(captured) } as any);
    await store.appendRow({ video_title: "Test", slug: "test-1", video_notes: "brief", pipeline: "standard" });

    const inserts = captured.filter((c) => c.sql.startsWith("INSERT"));
    expect(inserts.length).toBeGreaterThan(1); // one card + one row per stage
    for (const ins of inserts) expect(placeholders(ins.sql)).toBe(ins.args.length);
  });

  it("writes the slug into the cards row", async () => {
    const captured: Captured[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = getStore({ TRACKER_DB: fakeDb(captured) } as any);
    await store.appendRow({ video_title: "Test", slug: "test-1", video_notes: "brief", pipeline: "standard" });

    const card = captured.find((c) => c.sql.startsWith("INSERT INTO cards"))!;
    const cols = [...card.sql.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(card.args[cols.indexOf("slug")]).toBe("test-1");
    expect(card.args[cols.indexOf("title")]).toBe("Test");
    expect(card.args[cols.indexOf("notes")]).toBe("brief");
  });
});

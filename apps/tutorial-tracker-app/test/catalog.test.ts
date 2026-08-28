import { describe, expect, it } from "vitest";
import { programToAffiliateRecord, programsToCatalog } from "../src/worker/catalog";
import { allLinks, clickCounts } from "../src/worker/clickstore";
import type { ProgramRow } from "../src/worker/programs";

const row = (over: Partial<ProgramRow> & { slug: string }): ProgramRow => ({
  name: over.slug, kind: "affiliate", target_url: "", network: "other",
  approval_status: "unknown", coupon_status: "unknown", coupon_code: "",
  coupon_url: "", coupon_terms: "", dashboard_url: "", dashboard_credentials: "",
  notes: "", probe_enabled: 1, last_checked_at: null, last_status: null,
  last_final_url: null, previous_final_url: null, created_at: 0, updated_at: 0,
  updated_by: "", ...over,
});

describe("programToAffiliateRecord", () => {
  it("publishes approved affiliates and all external tools", () => {
    expect(programToAffiliateRecord(row({ slug: "openart", approval_status: "approved" })).isApproved).toBe(true);
    expect(programToAffiliateRecord(row({ slug: "cursor", kind: "external" })).isApproved).toBe(true);
    expect(programToAffiliateRecord(row({ slug: "x", approval_status: "rejected" })).isApproved).toBe(false);
  });
  it("carries linkgen fields and keys catalogues by slug", () => {
    expect(programToAffiliateRecord(row({ slug: "z", coupon_code: "AGR25" })).couponCode).toBe("AGR25");
    expect(Object.keys(programsToCatalog([row({ slug: "a" }), row({ slug: "b" })]).sort())).toEqual(["a", "b"]);
  });
});

function recordingDb() {
  const statements: string[] = [];
  const stmt: Record<string, unknown> = {};
  stmt.bind = () => stmt;
  stmt.all = async () => ({ results: [] });
  stmt.first = async () => null;
  stmt.run = async () => ({ success: true });
  const db = { prepare(sql: string) { statements.push(sql); return stmt; } };
  return { db: db as unknown as D1Database, statements };
}
const WRITE_VERB = /\b(insert|update|delete|drop|alter|replace)\b/i;
function assertNoWriteToClicks(statements: string[]) {
  for (const sql of statements) if (/\bclicks\b/i.test(sql)) expect(sql).not.toMatch(WRITE_VERB);
}
describe("the clicks table is read-only from this app", () => {
  it("CLICKS_READONLY_GATE clickCounts issues no write against clicks", async () => {
    const { db, statements } = recordingDb(); await clickCounts(db);
    expect(statements.length).toBeGreaterThan(0); assertNoWriteToClicks(statements);
  });
  it("CLICKS_READONLY_GATE allLinks issues no write against clicks", async () => {
    const { db, statements } = recordingDb(); await allLinks(db);
    expect(statements.length).toBeGreaterThan(0); assertNoWriteToClicks(statements);
  });
  it("CLICKS_READONLY_GATE the recorder is capable of catching a write", () => {
    expect(() => assertNoWriteToClicks(["DELETE FROM clicks WHERE 1=0"])).toThrow();
  });
});

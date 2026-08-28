import { describe, expect, it } from "vitest";
import { buildReport, structuralIssues } from "../src/worker/linkguard";
import type { ProgramRow } from "../src/worker/programs";

const prog = (over: Partial<ProgramRow> & { slug: string }): ProgramRow => ({ name: over.slug, kind: "affiliate", target_url: "", network: "other", approval_status: "approved", coupon_status: "unknown", coupon_code: "", coupon_url: "", coupon_terms: "", dashboard_url: "", dashboard_credentials: "", notes: "", probe_enabled: 1, last_checked_at: null, last_status: null, last_final_url: null, previous_final_url: null, created_at: 0, updated_at: 0, updated_by: "", ...over } as ProgramRow);
describe("structuralIssues", () => {
  it("LINKGUARD_GATE finds every structural fault", () => {
    const issues = structuralIssues({ programs: [prog({ slug: "bad", target_url: "not a url" }), prog({ slug: "empty" }), prog({ slug: "home", target_url: "https://example.com" }), prog({ slug: "dash", target_url: "https://affiliate.example.com/home" }), prog({ slug: "one", target_url: "https://a.example/?ref=1" }), prog({ slug: "two", target_url: "https://a.example/?ref=1" })], links: [{ slug: "x/missing", tool: "missing", target_url: "https://x.example", kind: null }, { slug: "x/one", tool: "one", target_url: "https://a.example/?ref=1", kind: "affiliate" }], kv: { "x/missing": "https://x.example", "x/one": "https://other.example" } });
    for (const code of ["bad_url", "approved_no_link", "no_credit_marker", "points_at_dashboard", "duplicate_target", "link_without_program", "unclassified_kind", "kv_d1_mismatch"]) expect(issues.map((issue) => issue.code)).toContain(code);
  });
  it("LINKGUARD_GATE recognizes a healthy catalogue", () => expect(structuralIssues({ programs: [prog({ slug: "openart", target_url: "https://openart.ai/?via=seema" })], links: [{ slug: "v/openart", tool: "openart", target_url: "https://openart.ai/?via=seema", kind: "affiliate" }], kv: { "v/openart": "https://openart.ai/?via=seema" } })).toEqual([]));
  it("LINKGUARD_GATE orders issues stably", () => expect(structuralIssues({ programs: [prog({ slug: "b", target_url: "bad" }), prog({ slug: "a", target_url: "bad" })], links: [], kv: {} }).map((issue) => issue.slug)).toEqual(["a", "b"]));
  it("LINKGUARD_GATE buildReport is silent with nothing to say", () => expect(buildReport([], 0, 3, false)).toBeNull());
  it("LINKGUARD_GATE buildReport sends an explicit heartbeat", () => expect(buildReport([], 1, 3, true)).toContain("all 3 links fine"));
  it("LINKGUARD_GATE buildReport puts money before other issues", () => { const report = buildReport([{ code: "duplicate_target", slug: "later", detail: "later" }, { code: "bad_url", slug: "money", detail: "money" }], 0, 2, false)!; expect(report.indexOf("Earning nothing")).toBeLessThan(report.indexOf("Worth a look")); });
});

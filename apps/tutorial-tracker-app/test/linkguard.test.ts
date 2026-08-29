import { describe, expect, it } from "vitest";
import { buildReport, structuralIssues } from "../src/worker/linkguard";
import type { ProgramRow } from "../src/worker/programs";

const prog = (over: Partial<ProgramRow> & { slug: string }): ProgramRow => ({ name: over.slug, kind: "affiliate", target_url: "", network: "other", approval_status: "approved", coupon_status: "unknown", coupon_code: "", coupon_url: "", coupon_terms: "", dashboard_url: "", dashboard_credentials: "", notes: "", probe_enabled: 1, last_checked_at: null, last_status: null, last_final_url: null, previous_final_url: null, created_at: 0, updated_at: 0, updated_by: "", ...over } as ProgramRow);
describe("structuralIssues", () => {
  it("LINKGUARD_GATE finds every structural fault", () => {
    const issues = structuralIssues({ programs: [prog({ slug: "bad", target_url: "not a url" }), prog({ slug: "empty" }), prog({ slug: "home", target_url: "https://example.com" }), prog({ slug: "dash", target_url: "https://affiliate.example.com/home" }), prog({ slug: "one", target_url: "https://a.example/?ref=1" }), prog({ slug: "two", target_url: "https://a.example/?ref=1" })], links: [{ slug: "x/missing", tool: "missing", target_url: "https://x.example", kind: null }, { slug: "x/one", tool: "one", target_url: "https://a.example/?ref=1", kind: "affiliate" }], kv: { "x/missing": "https://x.example", "x/one": "https://other.example" } });
    for (const code of ["bad_url", "approved_no_link", "no_credit_marker", "points_at_dashboard", "duplicate_target", "link_without_program", "unclassified_kind", "kv_d1_mismatch"]) expect(issues.map((issue) => issue.code)).toContain(code);
  });
  // The external exemption. Plan 258 specified this case and the crew dropped it,
  // leaving the behaviour correct but unprotected. It is the highest-value
  // negative test in the suite: an external tool has no affiliate programme, so a
  // bare homepage is the RIGHT destination for it. If this regressed, all ~12
  // external links (cursor, zapier, langchain, bolt, higgsfield...) would be
  // reported as "no affiliate code" every single day, and a guard that cries
  // wolf daily is a guard nobody reads. An earlier audit made exactly this
  // mistake before the owner corrected it.
  it("LINKGUARD_GATE never asks an external tool for an affiliate code", () => {
    const issues = structuralIssues({
      programs: [
        prog({ slug: "cursor", kind: "external", target_url: "https://cursor.com", approval_status: "unknown" }),
        prog({ slug: "zapier", kind: "external", target_url: "https://zapier.com", approval_status: "unknown" }),
      ],
      links: [
        { slug: "v/cursor", tool: "cursor", target_url: "https://cursor.com", kind: "external" },
        { slug: "v/zapier", tool: "zapier", target_url: "https://zapier.com", kind: "external" },
      ],
      kv: { "v/cursor": "https://cursor.com", "v/zapier": "https://zapier.com" },
    });
    expect(issues.map((issue) => issue.code)).not.toContain("no_credit_marker");
    // Nor should an unapproved external tool be nagged for a missing link.
    expect(issues.map((issue) => issue.code)).not.toContain("approved_no_link");
    expect(issues).toEqual([]);
  });

  // The mirror of the case above: the SAME bare homepage on an affiliate
  // programme must still be flagged, so the exemption cannot be widened into
  // "never check anything".
  it("LINKGUARD_GATE still flags a bare homepage on an affiliate programme", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "cursor", kind: "affiliate", target_url: "https://cursor.com" })],
      links: [{ slug: "v/cursor", tool: "cursor", target_url: "https://cursor.com", kind: "affiliate" }],
      kv: { "v/cursor": "https://cursor.com" },
    });
    expect(issues.map((issue) => issue.code)).toContain("no_credit_marker");
  });

  it("LINKGUARD_GATE recognizes a healthy catalogue", () => expect(structuralIssues({ programs: [prog({ slug: "openart", target_url: "https://openart.ai/?via=seema" })], links: [{ slug: "v/openart", tool: "openart", target_url: "https://openart.ai/?via=seema", kind: "affiliate" }], kv: { "v/openart": "https://openart.ai/?via=seema" } })).toEqual([]));
  it("LINKGUARD_GATE orders issues stably", () => expect(structuralIssues({ programs: [prog({ slug: "b", target_url: "bad" }), prog({ slug: "a", target_url: "bad" })], links: [], kv: {} }).map((issue) => issue.slug)).toEqual(["a", "b"]));
  it("LINKGUARD_GATE flags a video with links but no YouTube mapping", () => {
    const issues = structuralIssues({ programs: [prog({ slug: "openart", target_url: "https://openart.ai/?via=seema" })], links: [{ slug: "vcfX/openart", tool: "openart", target_url: "https://openart.ai/?via=seema", kind: "affiliate" }], kv: { "vcfX/openart": "https://openart.ai/?via=seema" }, videos: { vcfX: null }, clicks: { vcfX: 12 } });
    const issue = issues.find((item) => item.code === "unmapped_video");
    expect(issue).toBeDefined();
    expect(issue!.slug).toBe("vcfX");
    expect(issue!.detail).toContain("invisible in analytics");
    expect(issue!.detail).toContain("12 recorded clicks");
  });
  it("LINKGUARD_GATE does not flag a mapped video", () => {
    const issues = structuralIssues({ programs: [prog({ slug: "openart", target_url: "https://openart.ai/?via=seema" })], links: [{ slug: "vcfX/openart", tool: "openart", target_url: "https://openart.ai/?via=seema", kind: "affiliate" }], kv: { "vcfX/openart": "https://openart.ai/?via=seema" }, videos: { vcfX: "TaBrgRQSqeU" }, clicks: { vcfX: 12 } });
    expect(issues.map((issue) => issue.code)).not.toContain("unmapped_video");
  });
  it("LINKGUARD_GATE reports an unmapped video once even with multiple links", () => {
    const issues = structuralIssues({ programs: [prog({ slug: "a", target_url: "https://a.example/?ref=1" }), prog({ slug: "b", target_url: "https://b.example/?ref=1" })], links: [{ slug: "vcfX/a", tool: "a", target_url: "https://a.example/?ref=1", kind: "affiliate" }, { slug: "vcfX/b", tool: "b", target_url: "https://b.example/?ref=1", kind: "affiliate" }], kv: { "vcfX/a": "https://a.example/?ref=1", "vcfX/b": "https://b.example/?ref=1" }, videos: { vcfX: null }, clicks: { vcfX: 3 } });
    expect(issues.filter((issue) => issue.code === "unmapped_video")).toHaveLength(1);
  });
  it("LINKGUARD_GATE omits mapping checks when no mapping is supplied", () => {
    const issues = structuralIssues({ programs: [prog({ slug: "a", target_url: "https://a.example/?ref=1" })], links: [{ slug: "vcfX/a", tool: "a", target_url: "https://a.example/?ref=1", kind: "affiliate" }], kv: { "vcfX/a": "https://a.example/?ref=1" } });
    expect(issues.map((issue) => issue.code)).not.toContain("unmapped_video");
  });

  // Drafts. Minting a short link happens while a video is still being made, so
  // "has links, no YouTube id" described 8 unpublished drafts on 2026-08-28 and
  // nothing else - zero clicks between them, and none of their short links in
  // any of the channel's 68 published descriptions. Eight daily cards the owner
  // could do nothing about is how a guard trains you to stop reading it.
  it("LINKGUARD_GATE does not flag an unmapped video with no clicks", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "openart", target_url: "https://openart.ai/?via=seema" })],
      links: [{ slug: "R1k8/openart", tool: "openart", target_url: "https://openart.ai/?via=seema", kind: "affiliate" }],
      kv: { "R1k8/openart": "https://openart.ai/?via=seema" },
      videos: { R1k8: null },
      clicks: { R1k8: 0 },
    });
    expect(issues.map((issue) => issue.code)).not.toContain("unmapped_video");
    expect(issues).toEqual([]);
  });

  // A code absent from the clicks map means zero, not unknown.
  it("LINKGUARD_GATE treats a code missing from the clicks map as a draft", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "openart", target_url: "https://openart.ai/?via=seema" })],
      links: [{ slug: "R1k8/openart", tool: "openart", target_url: "https://openart.ai/?via=seema", kind: "affiliate" }],
      kv: { "R1k8/openart": "https://openart.ai/?via=seema" },
      videos: { R1k8: null },
      clicks: {},
    });
    expect(issues.map((issue) => issue.code)).not.toContain("unmapped_video");
  });

  // The mirror, and the reason the check exists at all: one recorded click is
  // proof the link is published and its traffic cannot be attributed. This is
  // the case that was live earlier on 2026-08-28, when visible clicks read 2
  // against a real 55 because most videos carried no YouTube id.
  it("LINKGUARD_GATE flags an unmapped video the moment it has a click", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "openart", target_url: "https://openart.ai/?via=seema" })],
      links: [{ slug: "R1k8/openart", tool: "openart", target_url: "https://openart.ai/?via=seema", kind: "affiliate" }],
      kv: { "R1k8/openart": "https://openart.ai/?via=seema" },
      videos: { R1k8: null },
      clicks: { R1k8: 1 },
    });
    const issue = issues.find((item) => item.code === "unmapped_video");
    expect(issue).toBeDefined();
    // Singular for one click - the owner reads these in Telegram.
    expect(issue!.detail).toContain("1 recorded click ");
  });

  // Supplying videos without clicks skips the check rather than reporting every
  // draft, so a caller that cannot count clicks degrades to silence.
  it("LINKGUARD_GATE skips the mapping check when clicks are not supplied", () => {
    const issues = structuralIssues({
      programs: [prog({ slug: "openart", target_url: "https://openart.ai/?via=seema" })],
      links: [{ slug: "R1k8/openart", tool: "openart", target_url: "https://openart.ai/?via=seema", kind: "affiliate" }],
      kv: { "R1k8/openart": "https://openart.ai/?via=seema" },
      videos: { R1k8: null },
    });
    expect(issues.map((issue) => issue.code)).not.toContain("unmapped_video");
  });
  it("LINKGUARD_GATE buildReport is silent with nothing to say", () => expect(buildReport([], 0, 3, false)).toBeNull());
  it("LINKGUARD_GATE buildReport sends an explicit heartbeat", () => expect(buildReport([], 1, 3, true)).toContain("all 3 links fine"));
  it("LINKGUARD_GATE buildReport puts money before other issues", () => { const report = buildReport([{ code: "duplicate_target", slug: "later", detail: "later" }, { code: "bad_url", slug: "money", detail: "money" }], 0, 2, false)!; expect(report.indexOf("Earning nothing")).toBeLessThan(report.indexOf("Worth a look")); });
});

import { describe, it, expect } from "vitest";
import { harvestExternalTools, mapSheetRows } from "../src/worker/programs-import";

const HEADER = ["Affiliate Program", "Slug", "Where", "Notes", "Approval Status",
  "My Affiliate Link", "Coupon Status", "Coupon Code", "Notes", "", "Dashboard",
  "Registered Email", "Password"];

describe("mapSheetRows", () => {
  it("repairs the scheme-less OpenArt link", () => {
    const r = mapSheetRows([HEADER, ["Openart", "openart", "Website", "", "Approved",
      "openart.ai/home/?via=seema", "code received", "AGROLLO", "", "",
      "https://affiliate.openart.ai/", "khushibakliwal@agrolloo.com", "Solarsystem@123"]]);
    expect(r.programs[0].slug).toBe("openart");
    expect(r.programs[0].target_url).toBe("https://openart.ai/home/?via=seema");
    expect(r.issues).toHaveLength(0);
  });

  it("imports a prose link field as empty and reports it", () => {
    const r = mapSheetRows([HEADER, ["clickfunnels", "clickfunnels", "Website", "", "Approved",
      'have multile campaign to choose named as "Manage Affiliate Codes"', "", "", "", "", "", "", ""]]);
    expect(r.programs[0].target_url).toBe("");
    expect(r.issues.some((i) => i.field === "target_url")).toBe(true);
  });

  it("refuses the agrolloo.com hop and reports it", () => {
    const r = mapSheetRows([HEADER, ["filmora ", "filmora", "Impact.com", "", "Approved",
      "https://agrolloo.com/filmora", "Occassional Code", "", "", "", "", "", ""]]);
    expect(r.programs[0].target_url).toBe("");
    expect(r.issues.some((i) => i.detail.includes("agrolloo.com"))).toBe(true);
    expect(r.programs[0].coupon_status).toBe("occasional");
  });

  it("merges both Notes columns and the unnamed 14th column into credentials/notes", () => {
    const r = mapSheetRows([HEADER, ["alidropship", "alidropship", "Website", "", "Approved",
      " https://alidropship.com/?via=21184 ", "Occassional Code", "", "needs a wise account", "",
      "https://affiliates.alidropship.com/", "khushibakliwal@agrolloo.com", "Solarsystem@123",
      "mob number : 9516782062"]]);
    const p = r.programs[0];
    expect(p.target_url).toBe("https://alidropship.com/?via=21184");
    expect(p.notes).toContain("needs a wise account");
    expect(p.dashboard_credentials).toContain("email: khushibakliwal@agrolloo.com");
    expect(p.dashboard_credentials).toContain("password: Solarsystem@123");
    expect(p.dashboard_credentials).toContain("mob number : 9516782062");
  });

  it("splits a crammed coupon cell without losing the original", () => {
    const r = mapSheetRows([HEADER, ["helium 10", "helium-10", "Impact.com", "", "Approved",
      "https://helium10.sjv.io/abc", "code received",
      "AGROLLO10 - 10% discount forever    AGROLLO20 -20% for 6 months discount.", "", "", "", "", ""]]);
    expect(r.programs[0].coupon_code).toBe("AGROLLO10");
    expect(r.programs[0].coupon_terms).toContain("AGROLLO20");
  });

  it("maps every approval value present in the live sheet", () => {
    const approvals = ["Approved", "Rejected", "To Apply", "Applied. Waiting for Response", ""];
    const expected = ["approved", "rejected", "to_apply", "applied", "unknown"];
    approvals.forEach((approval, i) => {
      const r = mapSheetRows([HEADER, ["x", "x", "Website", "", approval, "", "", "", "", "", "", "", ""]]);
      expect(r.programs[0].approval_status).toBe(expected[i]);
      expect(r.issues.filter((issue) => issue.field === "approval_status")).toHaveLength(0);
    });
  });

  it("maps every coupon value present in the live sheet", () => {
    const coupons = ["code received", "no code", "Occassional Code", "need code", "applied, waiting for response", ""];
    const expected = ["received", "none", "occasional", "needed", "applied", "unknown"];
    coupons.forEach((coupon, i) => {
      const r = mapSheetRows([HEADER, ["x", "x", "Website", "", "Approved", "", coupon, "", "", "", "", "", ""]]);
      expect(r.programs[0].coupon_status).toBe(expected[i]);
      expect(r.issues.filter((issue) => issue.field === "coupon_status")).toHaveLength(0);
    });
  });

  it("skips trailing blank rows", () => {
    expect(mapSheetRows([HEADER, ["", "", "", "", "", "", "", "", "", "", "", "", ""]]).programs).toHaveLength(0);
  });
});

describe("harvestExternalTools", () => {
  it("collects distinct external tools and ignores catalog picks", () => {
    const { programs } = harvestExternalTools([
      { row_id: "r1", video_tools: JSON.stringify([{ kind: "external", name: "Cursor", url: "https://cursor.com" }, { kind: "catalog", slug: "openart" }]) },
      { row_id: "r2", video_tools: JSON.stringify([{ kind: "external", name: "Zapier", url: "zapier.com" }]) },
    ]);
    expect(programs.map((p) => p.slug).sort()).toEqual(["cursor", "zapier"]);
    expect(programs.find((p) => p.slug === "zapier")!.target_url).toBe("https://zapier.com");
    expect(programs.every((p) => p.kind === "external")).toBe(true);
  });

  it("keeps the first URL and reports a conflicting one", () => {
    const { programs, issues } = harvestExternalTools([
      { row_id: "r1", video_tools: JSON.stringify([{ kind: "external", name: "Bolt", url: "https://bolt.new" }]) },
      { row_id: "r2", video_tools: JSON.stringify([{ kind: "external", name: "Bolt", url: "https://bolt.example" }]) },
    ]);
    expect(programs).toHaveLength(1);
    expect(programs[0].target_url).toBe("https://bolt.new");
    expect(issues.some((i) => i.detail.includes("different URL"))).toBe(true);
  });

  it("survives malformed video_tools JSON", () => {
    expect(harvestExternalTools([{ row_id: "r1", video_tools: "not json" }]).programs).toHaveLength(0);
  });
});

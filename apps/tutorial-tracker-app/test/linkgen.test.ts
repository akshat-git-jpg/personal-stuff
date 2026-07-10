import { describe, it, expect } from "vitest";
import {
  resolveSelection,
  externalCollisions,
  renderDescription,
  validateDescription,
  planHash,
  generateVideoCode,
  type VideoTool,
  type LinkPlanItem
} from "../src/worker/linkgen";
import type { AffiliateRecord } from "../src/worker/affiliate";

const aff = (over: Partial<AffiliateRecord> & { tool: string }): AffiliateRecord => ({
  displayName: over.tool,
  targetUrl: "",
  approvalStatus: "",
  couponStatus: "",
  couponCode: "",
  isApproved: false,
  ...over,
});

describe("generateVideoCode", () => {
  it("returns a 4-char code not in the existing set", () => {
    const code = generateVideoCode(new Set<string>());
    expect(code).toMatch(/^[a-zA-Z0-9]{4}$/);
  });
  it("avoids collisions", () => {
    const existing = new Set<string>();
    const c1 = generateVideoCode(existing);
    existing.add(c1);
    const c2 = generateVideoCode(existing);
    expect(c2).not.toBe(c1);
  });
});

describe("resolveSelection", () => {
  const affiliates: Record<string, AffiliateRecord> = {
    railway: aff({ tool: "railway", displayName: "Railway", isApproved: true, targetUrl: "https://aff/railway", couponCode: "SAVE10" }),
    render: aff({ tool: "render", displayName: "Render", isApproved: false, targetUrl: "https://aff/render" }),
    blank: aff({ tool: "blank", displayName: "Blank", isApproved: true, targetUrl: " " }),
  };

  it("resolves approved catalog tools to affiliate status", () => {
    const tools: VideoTool[] = [{ kind: "catalog", slug: "railway" }];
    const res = resolveSelection(tools, affiliates);
    expect(res).toEqual([
      { slug: "railway", displayName: "Railway", status: "affiliate", targetUrl: "https://aff/railway", couponCode: "SAVE10" }
    ]);
  });

  it("blocks unapproved catalog tools and emits empty targetUrl", () => {
    const tools: VideoTool[] = [{ kind: "catalog", slug: "render" }];
    const res = resolveSelection(tools, affiliates);
    expect(res).toEqual([
      { slug: "render", displayName: "Render", status: "blocked", targetUrl: "", couponCode: "", reason: expect.stringContaining("not approved") }
    ]);
  });

  it("blocks approved catalog tools with blank URLs", () => {
    const tools: VideoTool[] = [{ kind: "catalog", slug: "blank" }];
    const res = resolveSelection(tools, affiliates);
    expect(res).toEqual([
      { slug: "blank", displayName: "Blank", status: "blocked", targetUrl: "", couponCode: "", reason: expect.stringContaining("no affiliate link set") }
    ]);
  });

  it("blocks missing catalog tools", () => {
    const tools: VideoTool[] = [{ kind: "catalog", slug: "notfound" }];
    const res = resolveSelection(tools, affiliates);
    expect(res).toEqual([
      { slug: "notfound", displayName: "notfound", status: "blocked", targetUrl: "", couponCode: "", reason: expect.stringContaining("not in affiliate catalog") }
    ]);
  });

  it("resolves external tools with valid URLs", () => {
    const tools: VideoTool[] = [{ kind: "external", name: "My Tool", url: "https://example.com/foo" }];
    const res = resolveSelection(tools, affiliates);
    expect(res).toEqual([
      { slug: "my-tool", displayName: "My Tool", status: "external", targetUrl: "https://example.com/foo", couponCode: "" }
    ]);
  });

  it("blocks external tools with bad URLs", () => {
    const tools: VideoTool[] = [{ kind: "external", name: "Bad", url: "ftp://example.com" }];
    const res = resolveSelection(tools, affiliates);
    expect(res).toEqual([
      { slug: "bad", displayName: "Bad", status: "blocked", targetUrl: "", couponCode: "", reason: expect.stringContaining("valid https URL") }
    ]);
  });
});

describe("externalCollisions", () => {
  it("warns when an external name normalizes to a catalog slug", () => {
    const affiliates: Record<string, AffiliateRecord> = { railway: aff({ tool: "railway" }) };
    const tools: VideoTool[] = [{ kind: "external", name: "Railway!", url: "https://railway.app" }];
    const warns = externalCollisions(tools, affiliates);
    expect(warns).toHaveLength(1);
    expect(warns[0]).toContain("Railway!");
  });
  it("does not warn on safe external tools", () => {
    const affiliates: Record<string, AffiliateRecord> = { railway: aff({ tool: "railway" }) };
    const tools: VideoTool[] = [{ kind: "external", name: "Fliki", url: "https://fliki.ai" }];
    const warns = externalCollisions(tools, affiliates);
    expect(warns).toHaveLength(0);
  });
});

describe("renderDescription", () => {
  it("excludes blocked tools and includes coupons", () => {
    const items: LinkPlanItem[] = [
      { slug: "t1", displayName: "Tool 1", short_url: "http://go/t1", target_url: "", status: "affiliate", coupon: "T1_10" },
      { slug: "t2", displayName: "Tool 2", short_url: "http://go/t2", target_url: "", status: "blocked", coupon: "" },
      { slug: "t3", displayName: "Tool 3", short_url: "http://go/t3", target_url: "", status: "external", coupon: "" },
    ];
    const desc = renderDescription("My Video", items);
    expect(desc).toContain("🎥 My Video");
    expect(desc).toContain("▶ Tool 1 — http://go/t1");
    expect(desc).toContain("Code: T1_10");
    expect(desc).not.toContain("Tool 2");
    expect(desc).toContain("▶ Tool 3 — http://go/t3");
  });
});

describe("validateDescription", () => {
  const items: LinkPlanItem[] = [
    { slug: "t1", displayName: "T1", short_url: "https://go.example.com/abcd/t1", target_url: "", status: "affiliate", coupon: "" },
    { slug: "t2", displayName: "T2", short_url: "https://go.example.com/abcd/t2", target_url: "", status: "blocked", coupon: "" },
  ];
  const domain = "go.example.com";

  it("passes valid descriptions", () => {
    expect(() => validateDescription("Here is https://go.example.com/abcd/t1", items, domain)).not.toThrow();
  });
  
  it("throws if a short url is duplicated", () => {
    expect(() => validateDescription("Here is https://go.example.com/abcd/t1 and https://go.example.com/abcd/t1", items, domain)).toThrow("appears 2×");
  });

  it("throws if an unexpected url from the domain appears", () => {
    expect(() => validateDescription("Here is https://go.example.com/abcd/t1 and https://go.example.com/abcd/t99", items, domain)).toThrow("unexpected link");
  });
});

describe("planHash", () => {
  const items: LinkPlanItem[] = [
    { slug: "t1", displayName: "T1", short_url: "s", target_url: "u", status: "affiliate", coupon: "c" }
  ];
  it("is stable", async () => {
    const h1 = await planHash("abcd", items);
    const h2 = await planHash("abcd", items);
    expect(h1).toBe(h2);
    expect(h1.length).toBeGreaterThan(0);
  });
  it("changes on target mutation", async () => {
    const h1 = await planHash("abcd", items);
    const h2 = await planHash("abcd", [{ ...items[0], target_url: "u2" }]);
    expect(h1).not.toBe(h2);
  });
});

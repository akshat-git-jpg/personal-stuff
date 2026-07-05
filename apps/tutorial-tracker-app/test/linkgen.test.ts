import { describe, it, expect } from "vitest";
import {
  generateVideoCode,
  resolveTools,
  formatActualLinks,
  formatShortLinks,
  processVideo,
  type DetectedTool,
} from "../src/worker/linkgen";
import type { AffiliateRecord } from "../src/worker/affiliate";
import type { GeminiClient } from "../src/worker/gemini";

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

describe("resolveTools", () => {
  const affiliates: Record<string, AffiliateRecord> = {
    railway: aff({ tool: "railway", isApproved: true, targetUrl: "https://aff/railway", couponCode: "SAVE10" }),
    render: aff({ tool: "render", isApproved: false, targetUrl: "" }),
  };
  it("uses affiliate URL when approved", () => {
    const r = resolveTools([{ slug: "railway", display_name: "Railway", homepage_url: "" }], affiliates);
    expect(r).toEqual([
      { slug: "railway", displayName: "Railway", targetUrl: "https://aff/railway", couponCode: "SAVE10", hasAffiliate: true },
    ]);
  });
  it("falls back to homepage_url for non-affiliate tools", () => {
    const r = resolveTools([{ slug: "fliki", display_name: "Fliki", homepage_url: "https://fliki.ai" }], affiliates);
    expect(r).toEqual([
      { slug: "fliki", displayName: "Fliki", targetUrl: "https://fliki.ai", couponCode: "", hasAffiliate: false },
    ]);
  });
  it("skips tools with no resolvable URL", () => {
    const r = resolveTools([{ slug: "render", display_name: "Render", homepage_url: "" }], affiliates);
    expect(r).toEqual([]);
  });
});

describe("formatters", () => {
  it("formatShortLinks pairs tool: url", () => {
    expect(formatShortLinks([["railway", "https://go/x/railway"]])).toBe("railway: https://go/x/railway");
  });
  it("formatActualLinks flags non-affiliate", () => {
    expect(
      formatActualLinks([
        ["railway", "https://aff", true],
        ["fliki", "https://fliki.ai", false],
      ]),
    ).toBe("railway: https://aff\nfliki: https://fliki.ai (no affiliate)");
  });
});

function fakeGemini(tools: DetectedTool[], description: string): GeminiClient {
  return {
    async generateJSON<T>() {
      return { tools } as unknown as T;
    },
    async generateText() {
      return description;
    },
  };
}

describe("processVideo", () => {
  it("mints code, writes KV+D1, returns description + links", async () => {
    const kv: Record<string, string> = {};
    const d1videos: { video_code: string; video_title: string }[] = [];
    const d1links: { slug: string }[] = [];
    const deps = {
      gemini: fakeGemini([{ slug: "railway", display_name: "Railway", homepage_url: "" }], "DESC"),
      affiliates: {
        railway: aff({ tool: "railway", displayName: "Railway", targetUrl: "https://aff/railway", approvalStatus: "Approved", isApproved: true }),
      },
      linkDomain: "go.agrolloo.com",
      existingCodes: async () => new Set<string>(),
      videoCodeForTitle: async () => null,
      existingSlugs: async () => new Set<string>(),
      insertVideo: async (code: string, title: string) => {
        d1videos.push({ video_code: code, video_title: title });
      },
      insertLink: async (slug: string) => {
        d1links.push({ slug });
      },
      kvPut: async (k: string, v: string) => {
        kv[k] = v;
      },
    };
    const res = await processVideo("Best hosts", "compare railway", deps);
    expect(res.description).toBe("DESC");
    expect(res.links).toHaveLength(1);
    expect(res.links[0].short_url).toMatch(/^https:\/\/go\.agrolloo\.com\/[a-zA-Z0-9]{4}\/railway$/);
    expect(Object.keys(kv)).toHaveLength(1);
    expect(d1videos).toHaveLength(1);
    expect(d1links).toHaveLength(1);
  });

  it("throws when no tools detected", async () => {
    const deps = {
      gemini: fakeGemini([], ""),
      affiliates: {},
      linkDomain: "go.agrolloo.com",
      existingCodes: async () => new Set<string>(),
      videoCodeForTitle: async () => null,
      existingSlugs: async () => new Set<string>(),
      insertVideo: async () => {},
      insertLink: async () => {},
      kvPut: async () => {},
    };
    await expect(processVideo("x", "", deps)).rejects.toThrow();
  });
});

import { describe, it, expect, vi } from "vitest";
import { normalizeToolName, loadAffiliateRecords } from "../src/worker/affiliate";
import * as sheets from "../src/worker/sheets";

describe("normalizeToolName", () => {
  it("lowercases and hyphenates", () => {
    expect(normalizeToolName("Invideo Studio")).toBe("invideo-studio");
  });
  it("strips special chars and collapses separators", () => {
    expect(normalizeToolName("Runway ML!!")).toBe("runway-ml");
  });
  it("trims leading/trailing hyphens", () => {
    expect(normalizeToolName("  -Fliki- ")).toBe("fliki");
  });
  it("throws on empty", () => {
    expect(() => normalizeToolName("   ")).toThrow();
  });
});

describe("loadAffiliateRecords", () => {
  it("uses Slug when present, falling back to normalized display name", async () => {
    vi.spyOn(sheets, "sheetsGet").mockResolvedValue([
      ["Affiliate Program", "Slug", "Approval Status", "My Affiliate Link"],
      ["My Tool", "explicit-slug", "Approved", "https://x"],
      ["Another Tool", "", "Approved", "https://y"],
    ]);
    const res = await loadAffiliateRecords("tok", "http://sheet");
    expect(res["explicit-slug"].displayName).toBe("My Tool");
    expect(res["another-tool"].displayName).toBe("Another Tool");
  });
});

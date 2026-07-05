import { describe, it, expect } from "vitest";
import { normalizeToolName } from "../src/worker/affiliate";

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

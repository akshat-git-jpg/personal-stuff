import { describe, it, expect } from "vitest";
import { slugify, mintSlug } from "../src/shared/slug";

describe("slugify", () => {
  it("passes a short title through", () => {
    expect(slugify("Best AI Video Generator")).toBe("best-ai-video-generator");
  });
  it("keeps vs", () => {
    expect(slugify("OpusClip vs Submagic")).toBe("opusclip-vs-submagic");
  });
  it("keeps how-to and does not truncate at 38 chars", () => {
    expect(slugify("How To Make A Consistent AI Influencer"))
      .toBe("how-to-make-a-consistent-ai-influencer");
  });
  it("drops stop words but keeps digit words when over the cap", () => {
    expect(slugify("I Tested 7 AI Video Generators So You Don't Have To (2026)"))
      .toBe("tested-7-ai-video-generators-2026");
  });
  it("folds accents", () => {
    expect(slugify("Café Recipes")).toBe("cafe-recipes");
  });
  it("deletes apostrophes rather than splitting the word", () => {
    expect(slugify("Don't Panic")).toBe("dont-panic");
  });
  it("returns empty string when nothing usable remains", () => {
    expect(slugify("🔥🔥🔥")).toBe("");
  });
  it("never exceeds 40 characters", () => {
    const s = slugify("The Absolutely Enormous And Very Comprehensive Guide To Everything Ever");
    expect(s.length).toBeLessThanOrEqual(40);
  });
  it("never ends or starts with a dash", () => {
    expect(slugify("  ...Hello World!!  ")).toBe("hello-world");
  });
});

describe("mintSlug", () => {
  it("returns the plain slug when free", () => {
    expect(mintSlug("Best AI Video Generator", new Set(), "abc123"))
      .toBe("best-ai-video-generator");
  });
  it("appends -2 then -3 on collision", () => {
    const taken = new Set(["best-ai-video-generator", "best-ai-video-generator-2"]);
    expect(mintSlug("Best AI Video Generator", taken, "abc123"))
      .toBe("best-ai-video-generator-3");
  });
  it("falls back to video-<cardId> when the title yields nothing", () => {
    expect(mintSlug("🔥🔥🔥", new Set(), "abc123")).toBe("video-abc123");
  });
});

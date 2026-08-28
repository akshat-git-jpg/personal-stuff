import { describe, it, expect } from "vitest";
import { networkLabel, normalizeNetwork, toSlug, validateTargetUrl } from "../src/worker/programs";

describe("toSlug", () => {
  it("matches the sheet's slug shape", () => {
    expect(toSlug("Jungle Scout")).toBe("jungle-scout");
    expect(toSlug("veed.io")).toBe("veed-io");
    expect(toSlug("  Openart  ")).toBe("openart");
  });
});

describe("validateTargetUrl", () => {
  it("repairs the scheme-less value that caused the incident", () => {
    const r = validateTargetUrl("openart.ai/home/?via=seema", "affiliate");
    expect(r.ok).toBe(true);
    expect(r.value).toBe("https://openart.ai/home/?via=seema");
  });
  it("allows an approved programme with no link yet", () => {
    expect(validateTargetUrl("", "affiliate")).toEqual({ ok: true, value: "" });
  });
  it("refuses prose typed into the link field", () => {
    const r = validateTargetUrl('have multile campaign to choose named as "x"', "affiliate");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Not a usable web address");
  });
  it("refuses the agrolloo.com hop", () => {
    const r = validateTargetUrl("https://agrolloo.com/filmora", "affiliate");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("agrolloo.com redirect");
  });
  it("refuses our own affiliate dashboard", () => {
    const r = validateTargetUrl("https://affiliate.bookbolt.io/account.php", "affiliate");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("dashboard");
  });
  it("does not apply the dashboard rule to external tools", () => {
    expect(validateTargetUrl("https://app.example.com/home", "external").ok).toBe(true);
  });
});

/**
 * Networks are an OPEN vocabulary (owner request 2026-08-28): joining a new
 * affiliate network must not require a code change. The old closed enum silently
 * coerced anything unknown to "other", losing the real name.
 */
describe("normalizeNetwork / networkLabel", () => {
  it("folds a typed name into a stable token", () => {
    expect(normalizeNetwork("CJ Affiliate")).toBe("cj-affiliate");
    expect(normalizeNetwork("Impact.com")).toBe("impact-com");
    expect(normalizeNetwork("  ShareASale  ")).toBe("shareasale");
    expect(normalizeNetwork("Awin!!")).toBe("awin");
  });

  it("falls back to other rather than rejecting the save", () => {
    expect(normalizeNetwork("")).toBe("other");
    expect(normalizeNetwork("   ")).toBe("other");
    expect(normalizeNetwork("!!!")).toBe("other");
    expect(normalizeNetwork(null)).toBe("other");
  });

  it("caps the token so a pasted essay cannot become a network", () => {
    expect(normalizeNetwork("x".repeat(200)).length).toBe(40);
  });

  it("keeps the seeded labels", () => {
    expect(networkLabel("impact")).toBe("Impact.com");
    expect(networkLabel("partnerstack")).toBe("PartnerStack");
  });

  it("title-cases a brand-new network with no code change", () => {
    expect(networkLabel("cj-affiliate")).toBe("Cj Affiliate");
    expect(networkLabel("shareasale")).toBe("Shareasale");
  });
});

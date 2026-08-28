import { describe, it, expect } from "vitest";
import { toSlug, validateTargetUrl } from "../src/worker/programs";

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

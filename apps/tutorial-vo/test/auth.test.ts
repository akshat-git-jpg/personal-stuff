import { describe, test, expect } from "vitest";
import { sectionToken, timingSafeEqual } from "../src/worker/auth";

describe("auth", () => {
  test("sectionToken is stable and 32 hex chars", async () => {
    const t1 = await sectionToken("secret1", "slug1");
    const t2 = await sectionToken("secret1", "slug1");
    expect(t1).toBe(t2);
    expect(t1).toMatch(/^[0-9a-f]{32}$/);
  });

  test("sectionToken differs across slugs and secrets", async () => {
    const t1 = await sectionToken("secret1", "slug1");
    const t2 = await sectionToken("secret1", "slug2");
    const t3 = await sectionToken("secret2", "slug1");
    expect(t1).not.toBe(t2);
    expect(t1).not.toBe(t3);
  });

  test("timingSafeEqual", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
  });
});

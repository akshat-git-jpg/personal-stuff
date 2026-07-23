import { describe, test, expect } from "vitest";
import { takeKey, mergePublish, canGenerate, validateRespell } from "../src/worker/logic";

describe("takeKey", () => {
  test("formats properly", () => {
    expect(takeKey("my-slug", "s01", 3, 2)).toBe("my-slug/s01/v3-t2.wav");
  });
});

describe("mergePublish", () => {
  const now = "2026-07-23T00:00:00Z";
  const slug = "my-slug";

  test("insert fresh", () => {
    const res = mergePublish(
      null,
      { id: "s01", version: 1, demo: true, spoken_text: "hello" },
      slug,
      now
    );
    expect(res.action).toBe("insert");
    expect(res.row.takes_used).toBe(0);
    expect(res.row.locked).toBe(0);
    expect(res.row.take_key).toBeNull();
  });

  test("preserve same version", () => {
    const existing = {
      slug, id: "s01", version: 1, demo: 1, spoken_text: "respelled hello",
      takes_used: 2, locked: 1, take_key: "key", updated_at: "old"
    };
    const res = mergePublish(
      existing,
      { id: "s01", version: 1, demo: true, spoken_text: "hello" },
      slug,
      now
    );
    expect(res.action).toBe("preserve");
    expect(res.row.takes_used).toBe(2);
    expect(res.row.locked).toBe(1);
    expect(res.row.spoken_text).toBe("respelled hello");
    expect(res.row.take_key).toBe("key");
  });

  test("reset new version", () => {
    const existing = {
      slug, id: "s01", version: 1, demo: 1, spoken_text: "respelled hello",
      takes_used: 2, locked: 1, take_key: "key", updated_at: "old"
    };
    const res = mergePublish(
      existing,
      { id: "s01", version: 2, demo: true, spoken_text: "new hello" },
      slug,
      now
    );
    expect(res.action).toBe("reset");
    expect(res.row.takes_used).toBe(0);
    expect(res.row.locked).toBe(0);
    expect(res.row.spoken_text).toBe("new hello");
    expect(res.row.take_key).toBeNull();
  });
});

describe("canGenerate", () => {
  const base = { slug: "s", id: "s01", version: 1, demo: 1, spoken_text: "t", updated_at: "u", take_key: null };

  test("ok", () => {
    expect(canGenerate({ ...base, locked: 0, takes_used: 0 })).toEqual({ ok: true });
    expect(canGenerate({ ...base, locked: 0, takes_used: 3 })).toEqual({ ok: true });
  });

  test("locked", () => {
    expect(canGenerate({ ...base, locked: 1, takes_used: 0 })).toEqual({ ok: false, status: 409, error: "locked" });
  });

  test("cap reached", () => {
    expect(canGenerate({ ...base, locked: 0, takes_used: 4 })).toEqual({ ok: false, status: 429, error: "cap reached" });
    expect(canGenerate({ ...base, locked: 0, takes_used: 5 })).toEqual({ ok: false, status: 429, error: "cap reached" });
  });
});

describe("validateRespell", () => {
  test("ok", () => {
    expect(validateRespell("valid text", false)).toEqual({ ok: true });
  });

  test("locked", () => {
    expect(validateRespell("valid text", true)).toEqual({ ok: false, status: 409, error: "locked" });
  });

  test("empty", () => {
    expect(validateRespell("   ", false)).toEqual({ ok: false, status: 400, error: "empty" });
  });

  test("too long", () => {
    const long = "a".repeat(1201);
    expect(validateRespell(long, false)).toEqual({ ok: false, status: 400, error: "too long" });
  });

  test("contains flag marker", () => {
    expect(validateRespell("test [VERIFY: something]", false)).toEqual({ ok: false, status: 400, error: "contains flag marker" });
    expect(validateRespell("test [FILL: something]", false)).toEqual({ ok: false, status: 400, error: "contains flag marker" });
  });
});

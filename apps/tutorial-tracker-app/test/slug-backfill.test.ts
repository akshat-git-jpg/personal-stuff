import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { slugify } from "../src/shared/slug";

const SQL = readFileSync(
  new URL("../migrations/0004_backfill_card_slugs.sql", import.meta.url),
  "utf8",
);

/** [id, slug, commentedTitle] for every UPDATE, in file order. */
function parse() {
  const out: Array<{ id: string; slug: string; title: string }> = [];
  const lines = SQL.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(
      /^UPDATE cards SET slug = '(.+)' WHERE id = '(.+)' AND slug IS NULL;$/,
    );
    if (!m) continue;
    const c = (lines[i - 1] ?? "").match(/^-- (\S+)\s+(.*)$/);
    out.push({ slug: m[1], id: m[2], title: c ? c[2] : "" });
  }
  return out;
}

describe("0004 slug backfill", () => {
  const rows = parse();

  it("covers every live card exactly once", () => {
    expect(rows).toHaveLength(76);
    expect(new Set(rows.map((r) => r.id)).size).toBe(76);
  });

  it("mints no duplicate slug", () => {
    const seen = new Set<string>();
    for (const r of rows) {
      // the unique partial index on cards(slug) would reject this in production
      expect(seen.has(r.slug), `duplicate slug ${r.slug} (${r.id})`).toBe(false);
      seen.add(r.slug);
    }
  });

  it("mints no empty or malformed slug", () => {
    for (const r of rows) {
      expect(r.slug).not.toBe("");
      expect(r.slug).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/);
      expect(r.slug.length).toBeLessThanOrEqual(45); // 40 + a -NN suffix
    }
  });

  it("every UPDATE is guarded, so re-running renumbers nothing", () => {
    const updates = SQL.split("\n").filter((l) => l.startsWith("UPDATE cards"));
    expect(updates).toHaveLength(76);
    for (const u of updates) expect(u).toContain("AND slug IS NULL;");
  });

  it("touches only the slug column", () => {
    expect(SQL).not.toMatch(/\b(DROP|DELETE|ALTER|INSERT)\b/i);
    for (const u of SQL.split("\n").filter((l) => l.startsWith("UPDATE cards"))) {
      expect(u).toMatch(/^UPDATE cards SET slug = /);
    }
  });

  it("agrees with slugify, ignoring the collision suffix", () => {
    for (const r of rows) {
      if (!r.title) continue;
      const base = slugify(r.title);
      if (!base) continue;
      // r.slug is either the base, or the base plus -2 / -3 / ...
      expect(r.slug === base || new RegExp(`^${base}-\\d+$`).test(r.slug)).toBe(true);
    }
  });
});

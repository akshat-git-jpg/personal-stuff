/**
 * clickstore.ts
 * Native D1 + KV adapters that satisfy linkgen's injected deps.
 * D1 schema (owned by workers/redirector): videos(video_code, video_title, created_at),
 * links(slug, video_code, tool, target_url, created_at).
 */

import type { AffiliateRecord } from "./affiliate";

export async function existingCodes(db: D1Database): Promise<Set<string>> {
  const { results } = await db.prepare("SELECT video_code FROM videos").all<{ video_code: string }>();
  return new Set((results ?? []).map((r) => r.video_code));
}

export async function existingSlugs(db: D1Database, videoCode: string): Promise<Set<string>> {
  const { results } = await db
    .prepare("SELECT slug FROM links WHERE video_code = ?")
    .bind(videoCode)
    .all<{ slug: string }>();
  return new Set((results ?? []).map((r) => r.slug));
}

/**
 * @param channelId What lets the analytics dashboard split clicks per channel.
 */
export async function insertVideo(db: D1Database, videoCode: string, title: string, channelId: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare("INSERT INTO videos (video_code, video_title, channel_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(videoCode, title, channelId, now)
    .run();
}

export async function insertLink(
  db: D1Database,
  slug: string,
  videoCode: string,
  tool: string,
  targetUrl: string,
  kind: "affiliate" | "external",
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare("INSERT INTO links (slug, video_code, tool, target_url, created_at, kind) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(slug, videoCode, tool, targetUrl, now, kind)
    .run();
}

export async function linksForVideo(db: D1Database, videoCode: string): Promise<{ slug: string; tool: string; target_url: string }[]> {
  const { results } = await db.prepare("SELECT slug, tool, target_url FROM links WHERE video_code = ?").bind(videoCode).all();
  return (results ?? []) as { slug: string; tool: string; target_url: string }[];
}

export async function updateLinkTarget(db: D1Database, slug: string, targetUrl: string): Promise<void> {
  await db.prepare("UPDATE links SET target_url = ? WHERE slug = ?").bind(targetUrl, slug).run();
}

/** Click totals per slug. READ ONLY: redirector owns writes to clicks. */
export async function clickCounts(db: D1Database): Promise<Record<string, number>> {
  const { results } = await db
    .prepare("SELECT slug, COUNT(*) AS n FROM clicks GROUP BY slug")
    .all<{ slug: string; n: number }>();
  const out: Record<string, number> = {};
  for (const r of results ?? []) out[r.slug] = r.n;
  return out;
}

/** Every minted link with its video code. READ ONLY. */
export async function allLinks(
  db: D1Database,
): Promise<{ slug: string; video_code: string; tool: string; target_url: string; kind: string | null; created_at: number }[]> {
  const { results } = await db
    .prepare(`SELECT slug, video_code, tool, target_url, kind, created_at
              FROM links ORDER BY video_code, tool`)
    .all();
  return (results ?? []) as { slug: string; video_code: string; tool: string; target_url: string; kind: string | null; created_at: number }[];
}

export interface DriftRow {
  slug: string;
  tool: string;
  minted_url: string;
  current_url: string;
  kind: "url_changed" | "deactivated" | "missing";
}

export function linkDriftDiff(
  links: { slug: string; tool: string; target_url: string }[],
  affiliates: Record<string, AffiliateRecord>
): DriftRow[] {
  const drift: DriftRow[] = [];
  for (const link of links) {
    const rec = affiliates[link.tool];
    if (!rec) {
      drift.push({
        slug: link.slug,
        tool: link.tool,
        minted_url: link.target_url,
        current_url: "",
        kind: "missing",
      });
    } else if (!rec.isApproved) {
      drift.push({
        slug: link.slug,
        tool: link.tool,
        minted_url: link.target_url,
        current_url: "",
        kind: "deactivated",
      });
    } else if (link.target_url !== rec.targetUrl.trim()) {
      drift.push({
        slug: link.slug,
        tool: link.tool,
        minted_url: link.target_url,
        current_url: rec.targetUrl.trim(),
        kind: "url_changed",
      });
    }
  }
  return drift;
}

/**
 * video_code -> video_title from the videos table. READ ONLY.
 *
 * The links list used to title its groups only from tracker cards, but just 2 of
 * 76 cards carry a video_code (links minted before that field existed have none),
 * so 85 of 87 groups rendered as "Untitled video" — indistinguishable from a real
 * test entry. The owner nearly deleted a live video because of it (2026-08-28).
 */
export async function videoTitles(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db
    .prepare("SELECT video_code, video_title FROM videos")
    .all<{ video_code: string; video_title: string }>();
  const out: Record<string, string> = {};
  for (const r of results ?? []) out[r.video_code] = r.video_title ?? "";
  return out;
}

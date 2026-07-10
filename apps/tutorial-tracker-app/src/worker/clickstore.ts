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

export async function videoCodeForTitle(db: D1Database, title: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT video_code FROM videos WHERE video_title = ? LIMIT 1")
    .bind(title)
    .first<{ video_code: string }>();
  return row?.video_code ?? null;
}

export async function existingSlugs(db: D1Database, videoCode: string): Promise<Set<string>> {
  const { results } = await db
    .prepare("SELECT slug FROM links WHERE video_code = ?")
    .bind(videoCode)
    .all<{ slug: string }>();
  return new Set((results ?? []).map((r) => r.slug));
}

export async function insertVideo(db: D1Database, videoCode: string, title: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare("INSERT INTO videos (video_code, video_title, created_at) VALUES (?, ?, ?)")
    .bind(videoCode, title, now)
    .run();
}

export async function insertLink(
  db: D1Database,
  slug: string,
  videoCode: string,
  tool: string,
  targetUrl: string,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .prepare("INSERT INTO links (slug, video_code, tool, target_url, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(slug, videoCode, tool, targetUrl, now)
    .run();
}

export async function linksForVideo(db: D1Database, videoCode: string): Promise<{ slug: string; tool: string; target_url: string }[]> {
  const { results } = await db.prepare("SELECT slug, tool, target_url FROM links WHERE video_code = ?").bind(videoCode).all();
  return (results ?? []) as { slug: string; tool: string; target_url: string }[];
}

export async function updateLinkTarget(db: D1Database, slug: string, targetUrl: string): Promise<void> {
  await db.prepare("UPDATE links SET target_url = ? WHERE slug = ?").bind(targetUrl, slug).run();
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

/**
 * clickstore.ts
 * Native D1 + KV adapters that satisfy linkgen's injected deps.
 * D1 schema (owned by workers/redirector): videos(video_code, video_title, created_at),
 * links(slug, video_code, tool, target_url, created_at).
 */

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

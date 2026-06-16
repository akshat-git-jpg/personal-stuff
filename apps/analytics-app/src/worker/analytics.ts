/**
 * analytics.ts
 * Read-only aggregation over the redirector's clicks-db (D1).
 *
 * Click counts use the SAME de-duplication as sync_clicks.py: a click is keyed
 * by (slug, ip_hash, ua_hash, hour-bucket), so one person clicking the same
 * link repeatedly within an hour counts once. We compute all-time and 30-day
 * counts per slug, then fold them into a per-video tree.
 */

import type { Env } from "./auth";

export interface LinkStat {
  slug: string;
  tool: string;
  target_url: string;
  short_url: string;
  clicks_30d: number;
  clicks_all: number;
}

export interface VideoStat {
  video_code: string;
  video_title: string;
  yt_video_id: string | null;
  /** Live YouTube view count; null if unknown (no yt id or API key/lookup failed). */
  views: number | null;
  total_30d: number;
  total_all: number;
  links: LinkStat[];
}

interface LinkRow {
  video_code: string;
  video_title: string;
  video_created: number;
  yt_video_id: string | null;
  slug: string | null;
  tool: string | null;
  target_url: string | null;
}

interface CountRow {
  slug: string;
  clicks_all: number;
  clicks_30d: number;
}

export async function getVideoStats(env: Env): Promise<VideoStat[]> {
  const cutoffHour = Math.floor((Math.floor(Date.now() / 1000) - 30 * 86400) / 3600);

  // 1) Every video and its links (LEFT JOIN so videos with no links still show).
  const linkRows =
    (
      await env.DB.prepare(
        `SELECT v.video_code   AS video_code,
                v.video_title  AS video_title,
                v.created_at   AS video_created,
                v.yt_video_id  AS yt_video_id,
                l.slug         AS slug,
                l.tool         AS tool,
                l.target_url   AS target_url
         FROM videos v
         LEFT JOIN links l ON l.video_code = v.video_code
         ORDER BY v.created_at DESC, l.tool ASC`,
      ).all<LinkRow>()
    ).results ?? [];

  // 2) De-duplicated per-slug click counts (all-time + last 30 days).
  const countRows =
    (
      await env.DB.prepare(
        `SELECT slug,
                COUNT(*)                                  AS clicks_all,
                SUM(CASE WHEN hr >= ? THEN 1 ELSE 0 END)  AS clicks_30d
         FROM (
           SELECT slug, ip_hash, ua_hash, clicked_at / 3600 AS hr
           FROM clicks
           GROUP BY slug, ip_hash, ua_hash, clicked_at / 3600
         )
         GROUP BY slug`,
      )
        .bind(cutoffHour)
        .all<CountRow>()
    ).results ?? [];

  const counts = new Map<string, { all: number; d30: number }>();
  for (const r of countRows) {
    counts.set(r.slug, { all: r.clicks_all ?? 0, d30: r.clicks_30d ?? 0 });
  }

  // 3) Fold into a per-video tree.
  const byVideo = new Map<string, VideoStat>();
  for (const row of linkRows) {
    let video = byVideo.get(row.video_code);
    if (!video) {
      video = {
        video_code: row.video_code,
        video_title: row.video_title,
        yt_video_id: row.yt_video_id ?? null,
        views: null,
        total_30d: 0,
        total_all: 0,
        links: [],
      };
      byVideo.set(row.video_code, video);
    }
    if (row.slug) {
      const c = counts.get(row.slug) ?? { all: 0, d30: 0 };
      video.links.push({
        slug: row.slug,
        tool: row.tool ?? "",
        target_url: row.target_url ?? "",
        short_url: `https://${env.LINK_DOMAIN}/${row.slug}`,
        clicks_30d: c.d30,
        clicks_all: c.all,
      });
      video.total_30d += c.d30;
      video.total_all += c.all;
    }
  }

  const videos = [...byVideo.values()];
  for (const v of videos) {
    v.links.sort((a, b) => b.clicks_all - a.clicks_all || a.tool.localeCompare(b.tool));
  }

  // 4) Live YouTube view counts (best-effort; never blocks the response on failure).
  await attachViewCounts(env, videos);

  videos.sort((a, b) => b.total_all - a.total_all || b.total_30d - a.total_30d);
  return videos;
}

/**
 * Fetch viewCount for every video that has a yt_video_id and fold it into `views`.
 * Batches by 50 (YouTube videos.list limit). Silent no-op if no API key is set;
 * any API failure leaves `views` null rather than throwing.
 */
async function attachViewCounts(env: Env, videos: VideoStat[]): Promise<void> {
  if (!env.YT_API_KEY) return;
  const ids = videos.map((v) => v.yt_video_id).filter((x): x is string => !!x);
  if (ids.length === 0) return;

  const views = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url =
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${batch.join(",")}` +
      `&key=${env.YT_API_KEY}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) continue;
      const json = (await resp.json()) as {
        items?: { id: string; statistics?: { viewCount?: string } }[];
      };
      for (const it of json.items ?? []) {
        const n = Number(it.statistics?.viewCount ?? NaN);
        if (!Number.isNaN(n)) views.set(it.id, n);
      }
    } catch {
      /* network/API error — leave these videos' views null */
    }
  }

  for (const v of videos) {
    if (v.yt_video_id && views.has(v.yt_video_id)) v.views = views.get(v.yt_video_id)!;
  }
}

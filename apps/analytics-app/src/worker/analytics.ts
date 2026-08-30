/**
 * analytics.ts
 * Per-video analytics with YouTube as the source of truth for the video list.
 *
 * The list of videos = the channel's PUBLIC uploads (YouTube Data API), Shorts
 * excluded. Each video is enriched with live view count + real publish date
 * from YouTube, and — where the video has go.agrolloo links — with de-duplicated
 * click counts from the redirector's clicks-db (D1). A video with no shortener
 * links still shows (0 clicks). D1 is read-only and is the source ONLY for
 * link/click data; it never decides which videos exist.
 *
 * Click counts use the SAME de-duplication as sync_clicks.py: a click is keyed
 * by (slug, ip_hash, ua_hash, hour-bucket), so one person clicking the same
 * link repeatedly within an hour counts once.
 *
 * If YouTube is unconfigured (no API key / channel id) or the API errors, the
 * result carries youtube_ok=false + a message and an empty video list — the UI
 * surfaces that rather than silently showing nothing.
 */

import type { Env } from "./auth";
import { DEFAULT_CHANNEL_ID, linkDomainFor, uploadsPlaylistFor } from "./channels";

/** Videos at or under this duration are treated as Shorts and excluded. */
const SHORTS_MAX_SECONDS = 60;

export interface LinkStat {
  slug: string;
  tool: string;
  target_url: string;
  short_url: string;
  clicks_30d: number;
  clicks_all: number;
}

export interface VideoStat {
  /** YouTube video id — always present; the stable key for a video. */
  yt_video_id: string;
  /** Shortener video_code, if this video has any go.agrolloo links; else null. */
  video_code: string | null;
  /** Live YouTube title. */
  video_title: string;
  /** Live YouTube view count; null if the lookup didn't return it. */
  views: number | null;
  /** Real YouTube upload date (ISO 8601 publishedAt); null if unknown. */
  published_at: string | null;
  total_30d: number;
  total_all: number;
  links: LinkStat[];
}

/**
 * A shortener video that carries links but has no `videos.yt_video_id`, so its
 * clicks can never be attached to a YouTube upload and were previously dropped
 * silently.
 *
 * This existed unnoticed for months: on 2026-08-28 the dashboard showed 2 of 69
 * recorded clicks, and four videos holding 54 clicks rendered as "No links for
 * this video" — indistinguishable from a video that genuinely has none. Nothing
 * in the codebase writes `videos.yt_video_id` (the column was filled once by a
 * manual backfill on 2026-06-16), so every video published since then is
 * invisible until someone maps it. Surfacing them is what makes that a visible
 * problem instead of a silent zero.
 */
export interface UnmatchedVideo {
  video_code: string;
  /** The working title from D1, which is usually NOT the published YouTube title. */
  video_title: string;
  total_30d: number;
  total_all: number;
  links: LinkStat[];
}

export interface VideoStatsResult {
  videos: VideoStat[];
  /** Shortener videos with links but no YouTube mapping. Empty is the healthy state. */
  unmatched: UnmatchedVideo[];
  /** False if YouTube was unconfigured or the API call failed. */
  youtube_ok: boolean;
  /** Human-readable reason when youtube_ok is false; null otherwise. */
  youtube_error: string | null;
}

interface LinkRow {
  video_code: string;
  video_title: string | null;
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

interface YtVideo {
  id: string;
  title: string;
  published_at: string | null;
  views: number | null;
  /** Duration in seconds; NaN if it couldn't be parsed (then kept as long-form). */
  duration_seconds: number;
}

export async function getVideoStats(env: Env, channelId: string): Promise<VideoStatsResult> {
  // D1 link/click data, keyed by YouTube video id. D1 is the click source only.
  const { byYt: linksByYt, unmatched } = await loadLinksByYouTubeId(env, channelId);

  // YouTube uploads are the source of truth for which videos exist.
  if (!env.YT_API_KEY) {
    return {
      videos: [],
      youtube_ok: false,
      unmatched,
      youtube_error: "YouTube isn't configured (missing API key).",
    };
  }

  const uploadsPlaylist = uploadsPlaylistFor(channelId);
  let ytVideos: YtVideo[];
  try {
    const ids = await fetchUploadVideoIds(env, uploadsPlaylist);
    ytVideos = await fetchVideoDetails(env, ids);
  } catch (e) {
    return {
      videos: [],
      // Still report unmapped work: it does not depend on YouTube being reachable.
      unmatched,
      youtube_ok: false,
      youtube_error:
        e instanceof Error ? `Couldn't reach YouTube: ${e.message}` : "Couldn't reach YouTube.",
    };
  }

  // Long-form only — drop Shorts (keep anything we couldn't measure).
  const longform = ytVideos.filter(
    (v) => Number.isNaN(v.duration_seconds) || v.duration_seconds > SHORTS_MAX_SECONDS,
  );

  const videos: VideoStat[] = longform.map((v) => {
    const entry = linksByYt.get(v.id);
    const links = entry?.links ?? [];
    return {
      yt_video_id: v.id,
      video_code: entry?.video_code ?? null,
      video_title: v.title,
      views: v.views,
      published_at: v.published_at,
      total_30d: links.reduce((n, l) => n + l.clicks_30d, 0),
      total_all: links.reduce((n, l) => n + l.clicks_all, 0),
      links,
    };
  });

  // Most-clicked first; ties broken by newest upload.
  videos.sort(
    (a, b) => b.total_all - a.total_all || dateMs(b.published_at) - dateMs(a.published_at),
  );

  return { videos, unmatched, youtube_ok: true, youtube_error: null };
}

function dateMs(iso: string | null): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Read every go.agrolloo link + its de-duplicated click counts from D1, split
 * into two groups:
 *
 *   byYt      — videos that carry a `yt_video_id`, keyed by it, so the caller can
 *               attach them to a YouTube upload. Links sorted by clicks desc.
 *   unmatched — videos with links but NO `yt_video_id`. These cannot be attached
 *               to an upload, and until 2026-08-28 they were dropped here, which
 *               hid 54 of 69 recorded clicks. They are now returned so the UI can
 *               say so out loud.
 */
async function loadLinksByYouTubeId(env: Env, channelId: string): Promise<{
  byYt: Map<string, { video_code: string; links: LinkStat[] }>;
  unmatched: UnmatchedVideo[];
}> {
  const cutoffHour = Math.floor((Math.floor(Date.now() / 1000) - 30 * 86400) / 3600);

  let whereClause: string;
  let params: string[];
  if (channelId === DEFAULT_CHANNEL_ID) {
    whereClause = "WHERE v.channel_id = ? OR v.channel_id IS NULL";
    params = [channelId];
  } else {
    whereClause = "WHERE v.channel_id = ?";
    params = [channelId];
  }

  // Every shortener video, mapped or not. The `WHERE v.yt_video_id IS NOT NULL`
  // filter used to live here and was the whole bug: an unmapped video's links
  // never reached the client, so its clicks read as a genuine zero. We now load
  // both and let the caller separate them, so unmapped work is reportable.
  const linkRows =
    (
      await env.DB.prepare(
        `SELECT v.video_code  AS video_code,
                v.video_title AS video_title,
                v.yt_video_id AS yt_video_id,
                l.slug        AS slug,
                l.tool        AS tool,
                l.target_url  AS target_url
         FROM videos v
         LEFT JOIN links l ON l.video_code = v.video_code
         ${whereClause}
         ORDER BY l.tool ASC`,
      )
        .bind(...params)
        .all<LinkRow>()
    ).results ?? [];

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

  const domain = linkDomainFor(channelId);
  const statOf = (row: LinkRow, slug: string): LinkStat => {
    const c = counts.get(slug) ?? { all: 0, d30: 0 };
    return {
      slug,
      tool: row.tool ?? "",
      target_url: row.target_url ?? "",
      short_url: `https://${domain}/${slug}`,
      clicks_30d: c.d30,
      clicks_all: c.all,
    };
  };

  const byYt = new Map<string, { video_code: string; links: LinkStat[] }>();
  const byCode = new Map<string, UnmatchedVideo>();

  for (const row of linkRows) {
    if (row.yt_video_id) {
      let entry = byYt.get(row.yt_video_id);
      if (!entry) {
        entry = { video_code: row.video_code, links: [] };
        byYt.set(row.yt_video_id, entry);
      }
      if (row.slug) entry.links.push(statOf(row, row.slug));
      continue;
    }
    // No YouTube mapping. Collected rather than dropped.
    let u = byCode.get(row.video_code);
    if (!u) {
      u = {
        video_code: row.video_code,
        video_title: row.video_title ?? row.video_code,
        total_30d: 0,
        total_all: 0,
        links: [],
      };
      byCode.set(row.video_code, u);
    }
    if (row.slug) u.links.push(statOf(row, row.slug));
  }

  for (const entry of byYt.values()) {
    entry.links.sort((a, b) => b.clicks_all - a.clicks_all || a.tool.localeCompare(b.tool));
  }

  // Only unmapped videos that actually HAVE links are worth reporting. A video
  // row with no links and no mapping is just an unused draft, not a fault.
  const unmatched = [...byCode.values()]
    .filter((u) => u.links.length > 0)
    .map((u) => ({
      ...u,
      total_30d: u.links.reduce((n, l) => n + l.clicks_30d, 0),
      total_all: u.links.reduce((n, l) => n + l.clicks_all, 0),
      links: u.links.sort((a, b) => b.clicks_all - a.clicks_all || a.tool.localeCompare(b.tool)),
    }))
    .sort((a, b) => b.total_all - a.total_all || a.video_code.localeCompare(b.video_code));

  return { byYt, unmatched };
}

/** Page through the uploads playlist and collect every video id (50/page). */
async function fetchUploadVideoIds(env: Env, playlistId: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken = "";
  // Hard cap on pages (50 × 40 = 2000 videos) so a bad token can't loop forever.
  for (let page = 0; page < 40; page++) {
    const url =
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails` +
      `&maxResults=50&playlistId=${playlistId}&key=${env.YT_API_KEY}` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`playlistItems ${resp.status}`);
    const json = (await resp.json()) as {
      items?: { contentDetails?: { videoId?: string } }[];
      nextPageToken?: string;
    };
    for (const it of json.items ?? []) {
      const id = it.contentDetails?.videoId;
      if (id) ids.push(id);
    }
    pageToken = json.nextPageToken ?? "";
    if (!pageToken) break;
  }
  return ids;
}

/** Fetch title, publish date, view count, and duration for each id (50/request). */
async function fetchVideoDetails(env: Env, ids: string[]): Promise<YtVideo[]> {
  const out: YtVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url =
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails` +
      `&id=${batch.join(",")}&key=${env.YT_API_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`videos ${resp.status}`);
    const json = (await resp.json()) as {
      items?: {
        id: string;
        snippet?: { title?: string; publishedAt?: string };
        statistics?: { viewCount?: string };
        contentDetails?: { duration?: string };
      }[];
    };
    for (const it of json.items ?? []) {
      const views = Number(it.statistics?.viewCount ?? NaN);
      out.push({
        id: it.id,
        title: it.snippet?.title ?? "(untitled)",
        published_at: it.snippet?.publishedAt ?? null,
        views: Number.isNaN(views) ? null : views,
        duration_seconds: parseIso8601Duration(it.contentDetails?.duration),
      });
    }
  }
  return out;
}

/** Parse an ISO-8601 duration (e.g. "PT1H2M3S") to seconds; NaN if unparseable. */
function parseIso8601Duration(d: string | undefined): number {
  if (!d) return NaN;
  const m = /^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d);
  if (!m) return NaN;
  const [, h, min, s] = m;
  return (Number(h) || 0) * 3600 + (Number(min) || 0) * 60 + (Number(s) || 0);
}

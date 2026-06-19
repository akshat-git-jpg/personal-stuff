/**
 * rankings.ts
 * Keyword rank tracking, backed by this app's OWN database (RANKINGS_DB).
 *
 * For each (video, keyword) the user tracks, a manual "check" runs a YouTube
 * search.list (top 50) and records where the video lands — appending one
 * rank_checks row so history accrues over time. No Sheets, no Python, no AI.
 *
 * Quota note: each keyword check = 1 search.list call = 100 quota units (vs 1
 * unit for the videos.list calls analytics.ts makes). The default daily quota
 * is 10,000 units, so checks are manual + per-video by design.
 */

import type { Env } from "./auth";

/** Search depth — beyond this the video is reported as "not in top N". */
const SEARCH_DEPTH = 50;

export interface RankCheck {
  rank: number | null;
  not_in_top: boolean;
  checked_at: number;
}

export interface KeywordStat {
  id: number;
  keyword: string;
  created_at: number;
  /** Full check history, oldest first (drives the line chart). */
  history: RankCheck[];
}

/** Tracked keywords grouped by video id. Videos with none simply aren't here. */
export type KeywordsByVideo = Record<string, KeywordStat[]>;

interface KeywordRow {
  id: number;
  yt_video_id: string;
  keyword: string;
  created_at: number;
}

interface CheckRow {
  keyword_id: number;
  rank: number | null;
  not_in_top: number;
  checked_at: number;
}

/** All tracked keywords + their check history, grouped by yt_video_id. */
export async function getRankings(env: Env): Promise<KeywordsByVideo> {
  const keywordRows =
    (
      await env.RANKINGS_DB.prepare(
        `SELECT id, yt_video_id, keyword, created_at FROM keywords ORDER BY created_at ASC`,
      ).all<KeywordRow>()
    ).results ?? [];

  const checkRows =
    (
      await env.RANKINGS_DB.prepare(
        `SELECT keyword_id, rank, not_in_top, checked_at
         FROM rank_checks ORDER BY checked_at ASC`,
      ).all<CheckRow>()
    ).results ?? [];

  const historyByKeyword = new Map<number, RankCheck[]>();
  for (const r of checkRows) {
    const arr = historyByKeyword.get(r.keyword_id) ?? [];
    arr.push({ rank: r.rank, not_in_top: r.not_in_top === 1, checked_at: r.checked_at });
    historyByKeyword.set(r.keyword_id, arr);
  }

  const byVideo: KeywordsByVideo = {};
  for (const k of keywordRows) {
    (byVideo[k.yt_video_id] ??= []).push({
      id: k.id,
      keyword: k.keyword,
      created_at: k.created_at,
      history: historyByKeyword.get(k.id) ?? [],
    });
  }
  return byVideo;
}

/** Add a keyword to a video. Idempotent on (video, keyword). Returns the row id. */
export async function addKeyword(
  env: Env,
  ytVideoId: string,
  keyword: string,
): Promise<{ id: number } | { error: string }> {
  const kw = keyword.trim();
  if (!ytVideoId.trim() || !kw) return { error: "video id and keyword are required" };
  if (kw.length > 200) return { error: "keyword too long" };

  await env.RANKINGS_DB.prepare(
    `INSERT OR IGNORE INTO keywords (yt_video_id, keyword, created_at) VALUES (?, ?, ?)`,
  )
    .bind(ytVideoId, kw, Math.floor(Date.now() / 1000))
    .run();

  const row = await env.RANKINGS_DB.prepare(
    `SELECT id FROM keywords WHERE yt_video_id = ? AND keyword = ?`,
  )
    .bind(ytVideoId, kw)
    .first<{ id: number }>();

  return row ? { id: row.id } : { error: "failed to add keyword" };
}

/** Delete a keyword (its rank_checks cascade). */
export async function deleteKeyword(env: Env, id: number): Promise<void> {
  await env.RANKINGS_DB.prepare(`DELETE FROM keywords WHERE id = ?`).bind(id).run();
}

export interface CheckResult {
  /** Per-keyword outcome written this run. */
  checked: { id: number; keyword: string; rank: number | null; not_in_top: boolean }[];
  /** Set when YouTube quota was exhausted mid-run (partial results still saved). */
  quota_exhausted: boolean;
  error: string | null;
}

/**
 * Run a rank check for every keyword on one video and append the results.
 * Best-effort + transparent: a quota 403 stops further calls but keeps whatever
 * was already written, and flags quota_exhausted so the UI can say so.
 */
export async function checkVideo(env: Env, ytVideoId: string): Promise<CheckResult> {
  if (!env.YT_API_KEY) {
    return { checked: [], quota_exhausted: false, error: "YouTube API key not configured." };
  }

  const keywords =
    (
      await env.RANKINGS_DB.prepare(
        `SELECT id, keyword FROM keywords WHERE yt_video_id = ? ORDER BY created_at ASC`,
      )
        .bind(ytVideoId)
        .all<{ id: number; keyword: string }>()
    ).results ?? [];

  const out: CheckResult = { checked: [], quota_exhausted: false, error: null };
  const now = Math.floor(Date.now() / 1000);

  for (const k of keywords) {
    let result: { rank: number | null; not_in_top: boolean };
    try {
      result = await searchRank(env.YT_API_KEY, k.keyword, ytVideoId);
    } catch (e) {
      if (e instanceof QuotaError) {
        out.quota_exhausted = true;
        out.error = "YouTube daily quota exhausted — partial results saved. Try again tomorrow.";
        break;
      }
      out.error = e instanceof Error ? e.message : "rank check failed";
      break;
    }

    await env.RANKINGS_DB.prepare(
      `INSERT INTO rank_checks (keyword_id, rank, not_in_top, checked_at) VALUES (?, ?, ?, ?)`,
    )
      .bind(k.id, result.rank, result.not_in_top ? 1 : 0, now)
      .run();

    out.checked.push({ id: k.id, keyword: k.keyword, rank: result.rank, not_in_top: result.not_in_top });
  }

  return out;
}

class QuotaError extends Error {}

/** Search YouTube for `keyword` and find `targetVideoId`'s position in the top results. */
async function searchRank(
  apiKey: string,
  keyword: string,
  targetVideoId: string,
): Promise<{ rank: number | null; not_in_top: boolean }> {
  const url =
    `https://www.googleapis.com/youtube/v3/search?part=id&type=video` +
    `&maxResults=${SEARCH_DEPTH}&q=${encodeURIComponent(keyword)}&key=${apiKey}`;
  const resp = await fetch(url);
  if (resp.status === 403) {
    const body = await resp.text();
    if (/quota/i.test(body)) throw new QuotaError("quotaExceeded");
    throw new Error(`search 403: ${body.slice(0, 120)}`);
  }
  if (!resp.ok) throw new Error(`search ${resp.status}`);

  const json = (await resp.json()) as { items?: { id?: { videoId?: string } }[] };
  const items = json.items ?? [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].id?.videoId === targetVideoId) {
      return { rank: i + 1, not_in_top: false };
    }
  }
  return { rank: SEARCH_DEPTH, not_in_top: true };
}

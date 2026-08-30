// Client-side API wrappers + shared types (mirror of the worker's analytics types).

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
  /** Shortener video_code, if this video has go.agrolloo links; else null. */
  video_code: string | null;
  video_title: string;
  views: number | null;
  /** Real YouTube upload date (ISO 8601 publishedAt); null if unknown. */
  published_at: string | null;
  total_30d: number;
  total_all: number;
  links: LinkStat[];
}

/**
 * A shortener video carrying links but with no YouTube mapping in D1. Its clicks
 * are real but cannot be attached to an upload, so the UI lists these separately
 * instead of letting them read as zero (the 2026-08-28 bug: 54 of 69 clicks were
 * dropped silently and four videos showed "No links for this video").
 */
export interface UnmatchedVideo {
  video_code: string;
  /** Working title from D1 — usually NOT the published YouTube title. */
  video_title: string;
  total_30d: number;
  total_all: number;
  links: LinkStat[];
}

export interface VideosResponse {
  videos: VideoStat[];
  /** Videos with links but no YouTube mapping. Empty is the healthy state. */
  unmatched: UnmatchedVideo[];
  /** False if YouTube was unconfigured or its API errored — list is then empty. */
  youtube_ok: boolean;
  youtube_error: string | null;
  generated_at: number;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthorizedError";
  }
}

export interface ChannelsResponse {
  channels: { id: string; name: string; handle: string }[];
  default_channel_id: string;
}

export async function fetchChannels(): Promise<ChannelsResponse> {
  const res = await fetch("/api/channels", { credentials: "same-origin" });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`Failed to load channels (${res.status})`);
  return (await res.json()) as ChannelsResponse;
}

export async function fetchVideos(channelId?: string): Promise<VideosResponse> {
  const q = channelId ? `?channel=${encodeURIComponent(channelId)}` : "";
  const res = await fetch(`/api/videos${q}`, { credentials: "same-origin" });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`Failed to load data (${res.status})`);
  return (await res.json()) as VideosResponse;
}

// ── Rankings ────────────────────────────────────────────────────────────────

export interface RankCheck {
  rank: number | null;
  not_in_top: boolean;
  checked_at: number;
}

export interface KeywordStat {
  id: number;
  keyword: string;
  created_at: number;
  history: RankCheck[];
}

/** Tracked keywords grouped by yt_video_id. */
export type KeywordsByVideo = Record<string, KeywordStat[]>;

export interface CheckResult {
  checked: { id: number; keyword: string; rank: number | null; not_in_top: boolean }[];
  quota_exhausted: boolean;
  error: string | null;
}

export interface QuotaInfo {
  spent_today: number;
  daily_limit: number;
  remaining: number;
  checks_remaining: number;
}

export interface RankingsResponse {
  byVideo: KeywordsByVideo;
  quota: QuotaInfo;
}

export async function fetchRankings(channelId?: string): Promise<RankingsResponse> {
  const q = channelId ? `?channel=${encodeURIComponent(channelId)}` : "";
  const res = await fetch(`/api/rankings${q}`, { credentials: "same-origin" });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`Failed to load rankings (${res.status})`);
  return (await res.json()) as RankingsResponse;
}

export async function addKeyword(channelId: string, ytVideoId: string, keyword: string): Promise<{ id: number }> {
  const q = channelId ? `?channel=${encodeURIComponent(channelId)}` : "";
  const res = await fetch(`/api/rankings/keywords${q}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yt_video_id: ytVideoId, keyword }),
    credentials: "same-origin",
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) {
    const msg = ((await res.json().catch(() => ({}))) as { error?: string }).error;
    throw new Error(msg ?? `Failed to add keyword (${res.status})`);
  }
  return (await res.json()) as { id: number };
}

export async function deleteKeyword(id: number): Promise<void> {
  const res = await fetch(`/api/rankings/keywords/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`Failed to delete keyword (${res.status})`);
}

export async function checkVideoRankings(ytVideoId: string): Promise<CheckResult> {
  const res = await fetch("/api/rankings/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ yt_video_id: ytVideoId }),
    credentials: "same-origin",
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`Check failed (${res.status})`);
  return (await res.json()) as CheckResult;
}

// ── Income ──────────────────────────────────────────────────────────────────

/** One PayPal program (payer) inside a month. Amounts arrive as strings. */
export interface IncomeProgram {
  program: string;
  received: string;
  bank_amount: string;
  count: number;
}

export interface IncomePayPalMonth {
  month: string;
  currency: string;
  received: string;
  bank_amount: string;
  programs: IncomeProgram[];
}

export interface IncomeStatement {
  file: string;
  transactions: number;
  period_start: string | null;
  period_end: string | null;
}

export interface IncomeResponse {
  /** ISO timestamp of the last ingest, or null if nothing has been ingested. */
  generated_at: string | null;
  statements: IncomeStatement[];
  /** rail id → display label, e.g. { paypal: "PayPal" }. */
  rails: Record<string, string>;
  /** "2026-01" → { paypal: 24711.29, personal: 10950 }. Non-rail keys are not income. */
  bank_by_month: Record<string, Record<string, number>>;
  paypal?: { months: IncomePayPalMonth[] };
}

export async function fetchIncome(): Promise<IncomeResponse> {
  const res = await fetch("/api/income", { credentials: "same-origin" });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) throw new Error(`Failed to load income (${res.status})`);
  return (await res.json()) as IncomeResponse;
}

export async function login(password: string): Promise<void> {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    credentials: "same-origin",
  });
  if (res.status === 401) throw new Error("Wrong password");
  if (!res.ok) throw new Error(`Login failed (${res.status})`);
}

export async function logout(): Promise<void> {
  await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
}

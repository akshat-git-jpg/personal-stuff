/**
 * The affiliate/external catalogue: vocabularies, row type, and D1 access.
 *
 * Replaces the "Affiliate Programs" Google Sheet. Every field here is either
 * a closed vocabulary or runs through linkhealth's validator.
 */

import { normalizeTargetUrl } from "./linkhealth";

export const NETWORKS = [
  "website", "impact", "partnerstack", "paykickstart", "network", "other",
] as const;
/**
 * A network is free text, not a closed set. NETWORKS below is only the seed list
 * (the values that existed in the retired Google Sheet); the owner joins new
 * affiliate networks regularly and must be able to name one without a code
 * change. Stored values are normalized by `normalizeNetwork`.
 */
export type Network = string;

/** Seed values, kept for the label map and as the dropdown's starting options. */
export type SeedNetwork = (typeof NETWORKS)[number];

/**
 * Fold a typed network name into a stable stored token: lower-case, spaces and
 * punctuation to single dashes. "Impact.com" -> "impact-com", "CJ Affiliate" ->
 * "cj-affiliate". Empty or unusable input falls back to "other" rather than
 * rejecting the save — the network is metadata, never the money path.
 */
export function normalizeNetwork(raw: string | null | undefined): Network {
  const token = (raw ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!token) return "other";
  return token.slice(0, 40);
}

/**
 * Display name for any network token, seeded or new. Unknown tokens are
 * title-cased from the token itself, so a network added today reads properly
 * without a code change.
 */
export function networkLabel(token: string): string {
  const seeded = (NETWORK_LABELS as Record<string, string>)[token];
  if (seeded) return seeded;
  return token
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const APPROVAL_STATUSES = [
  "approved", "applied", "to_apply", "rejected", "unknown",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const COUPON_STATUSES = [
  "received", "occasional", "none", "needed", "applied", "unknown",
] as const;
export type CouponStatus = (typeof COUPON_STATUSES)[number];

export const KINDS = ["affiliate", "external"] as const;
export type Kind = (typeof KINDS)[number];

/** Labels the UI shows. Keys must stay in sync with the arrays above. */
export const NETWORK_LABELS: Record<SeedNetwork, string> = {
  website: "Website", impact: "Impact.com", partnerstack: "PartnerStack",
  paykickstart: "PayKickstart", network: "Network", other: "Other",
};
export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  approved: "Approved", applied: "Applied, waiting", to_apply: "To apply",
  rejected: "Rejected", unknown: "Not set",
};
export const COUPON_LABELS: Record<CouponStatus, string> = {
  received: "Code received", occasional: "Occasional code", none: "No code",
  needed: "Need code", applied: "Applied, waiting", unknown: "Not set",
};

export interface ProgramRow {
  slug: string;
  name: string;
  kind: Kind;
  target_url: string;
  network: Network;
  approval_status: ApprovalStatus;
  coupon_status: CouponStatus;
  coupon_code: string;
  coupon_url: string;
  coupon_terms: string;
  dashboard_url: string;
  dashboard_credentials: string;
  notes: string;
  probe_enabled: number;
  last_checked_at: number | null;
  last_status: string | null;
  last_final_url: string | null;
  previous_final_url: string | null;
  created_at: number;
  updated_at: number;
  updated_by: string;
}

/** Slug rule, identical to affiliate.ts normalizeToolName so slugs don't shift. */
export function toSlug(name: string): string {
  const s = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return s.replace(/^-+|-+$/g, "");
}

export interface ProgramValidation {
  ok: boolean;
  value?: string;
  error?: string;
}

/** A program's target URL. Empty targets are allowed but cannot be published. */
export function validateTargetUrl(raw: string, kind: Kind): ProgramValidation {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: true, value: "" };
  const norm = normalizeTargetUrl(trimmed);
  if (!norm) {
    return {
      ok: false,
      error: `Not a usable web address: ${JSON.stringify(trimmed.slice(0, 60))}. Paste the link your affiliate dashboard gives you.`,
    };
  }
  if (/(^|\.)agrolloo\.com$/i.test(new URL(norm.url).hostname)) {
    return {
      ok: false,
      error: "That is the agrolloo.com redirect, not the real affiliate link. Paste the destination itself.",
    };
  }
  if (kind === "affiliate") {
    const url = new URL(norm.url);
    if (/^(affiliate|affiliates|partners?|dash|dashboard|console)\./i.test(url.hostname) &&
        /^\/(home|dashboard|account|login|performance|analytics|payout|profile)(\/|$|\.)/i.test(url.pathname)) {
      return {
        ok: false,
        error: "That looks like your own affiliate dashboard, not a referral link. It would earn nothing.",
      };
    }
  }
  const parsed = new URL(norm.url);
  // URL#toString adds a trailing slash to a bare hostname. Preserve the shape
  // the admin pasted once it has passed the shared validator.
  const value = parsed.pathname === "/" && !parsed.search && !parsed.hash && !trimmed.endsWith("/")
    ? norm.url.slice(0, -1)
    : norm.url;
  return { ok: true, value };
}

const COLS = `slug, name, kind, target_url, network, approval_status,
  coupon_status, coupon_code, coupon_url, coupon_terms, dashboard_url,
  dashboard_credentials, notes, probe_enabled, last_checked_at, last_status,
  last_final_url, previous_final_url, created_at, updated_at, updated_by`;

export async function listPrograms(db: D1Database): Promise<ProgramRow[]> {
  const { results } = await db.prepare(`SELECT ${COLS} FROM programs ORDER BY name COLLATE NOCASE`).all();
  return (results ?? []) as unknown as ProgramRow[];
}

export async function getProgram(db: D1Database, slug: string): Promise<ProgramRow | null> {
  return (await db.prepare(`SELECT ${COLS} FROM programs WHERE slug = ?`).bind(slug).first()) as ProgramRow | null;
}

export interface ProgramInput {
  slug: string; name: string; kind: Kind; target_url: string; network: Network;
  approval_status: ApprovalStatus; coupon_status: CouponStatus;
  coupon_code: string; coupon_url: string; coupon_terms: string;
  dashboard_url: string; dashboard_credentials: string; notes: string;
  probe_enabled: number;
}

/** Insert or update by slug without touching the cron-owned guard fields. */
export async function upsertProgram(db: D1Database, p: ProgramInput, updatedBy: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db.prepare(
    `INSERT INTO programs (slug, name, kind, target_url, network, approval_status,
       coupon_status, coupon_code, coupon_url, coupon_terms, dashboard_url,
       dashboard_credentials, notes, probe_enabled, created_at, updated_at, updated_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(slug) DO UPDATE SET
       name=excluded.name, kind=excluded.kind, target_url=excluded.target_url,
       network=excluded.network, approval_status=excluded.approval_status,
       coupon_status=excluded.coupon_status, coupon_code=excluded.coupon_code,
       coupon_url=excluded.coupon_url, coupon_terms=excluded.coupon_terms,
       dashboard_url=excluded.dashboard_url,
       dashboard_credentials=excluded.dashboard_credentials,
       notes=excluded.notes, probe_enabled=excluded.probe_enabled,
       updated_at=excluded.updated_at, updated_by=excluded.updated_by`,
  ).bind(
    p.slug, p.name, p.kind, p.target_url, p.network, p.approval_status,
    p.coupon_status, p.coupon_code, p.coupon_url, p.coupon_terms,
    p.dashboard_url, p.dashboard_credentials, p.notes, p.probe_enabled,
    now, now, updatedBy,
  ).run();
}

export async function deleteProgram(db: D1Database, slug: string): Promise<void> {
  await db.prepare("DELETE FROM programs WHERE slug = ?").bind(slug).run();
}

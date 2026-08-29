/** Daily structural checks. Pure: it never performs I/O or fetches. */
import { creditWarnings, normalizeTargetUrl } from "./linkhealth";
import type { ProgramRow } from "./programs";

export type IssueCode = "bad_url" | "own_redirect_layer" | "points_at_dashboard"
  | "no_credit_marker" | "approved_no_link" | "duplicate_target"
  | "kv_d1_mismatch" | "link_without_program" | "unclassified_kind" | "changed_destination"
  | "unmapped_video";
export interface GuardIssue { code: IssueCode; slug: string; detail: string; }
export interface GuardInput {
  programs: ProgramRow[];
  links: { slug: string; tool: string; target_url: string; kind: string | null }[];
  kv: Record<string, string>;
  /** video_code -> YouTube video id (null when unmapped). */
  videos?: Record<string, string | null>;
  /**
   * video_code -> recorded clicks. Proof the short link is actually published
   * somewhere; without it an unmapped video cannot be told apart from a draft.
   * Omit to skip the mapping check entirely (see `unmapped_video` below).
   */
  clicks?: Record<string, number>;
}

/** Every structural fault, ordered by code then slug so two runs are diffable. */
export function structuralIssues(input: GuardInput): GuardIssue[] {
  const issues: GuardIssue[] = [];
  const { programs, links, kv } = input;
  const targetOwners = new Map<string, string[]>();
  for (const p of programs) {
    const isAffiliate = p.kind === "affiliate";
    if (!p.target_url) {
      if (isAffiliate && p.approval_status === "approved") issues.push({ code: "approved_no_link", slug: p.slug, detail: `${p.name} is approved but has no link, so it can never be published.` });
      continue;
    }
    const norm = normalizeTargetUrl(p.target_url);
    if (!norm) {
      issues.push({ code: "bad_url", slug: p.slug, detail: `${p.name}: stored value is not a usable web address (${JSON.stringify(p.target_url.slice(0, 60))}).` });
      continue;
    }
    for (const warning of creditWarnings(norm.url, isAffiliate ? "affiliate" : "external")) {
      if (warning.code !== "scheme_added") issues.push({ code: warning.code as IssueCode, slug: p.slug, detail: `${p.name}: ${warning.message}` });
    }
    const key = norm.url.replace(/\/+$/, "").toLowerCase();
    targetOwners.set(key, [...(targetOwners.get(key) ?? []), p.slug]);
  }
  for (const [target, owners] of targetOwners) if (owners.length > 1) for (const slug of owners.sort()) {
    issues.push({ code: "duplicate_target", slug, detail: `Shares its destination (${target}) with: ${owners.filter((owner) => owner !== slug).sort().join(", ")}.` });
  }
  const bySlug = new Map(programs.map((p) => [p.slug, p]));
  for (const link of links) {
    if (!bySlug.has(link.tool)) issues.push({ code: "link_without_program", slug: link.slug, detail: `Live link points at tool "${link.tool}", which has no programme row.` });
    if (link.kind === null || link.kind === "") issues.push({ code: "unclassified_kind", slug: link.slug, detail: "Minted before the kind column existed, so its credit expectation is unknown." });
    const kvValue = kv[link.slug];
    if (kvValue === undefined) issues.push({ code: "kv_d1_mismatch", slug: link.slug, detail: "Recorded in the database but missing from the live redirects — this link 404s." });
    else if (kvValue.trim() !== link.target_url.trim()) issues.push({ code: "kv_d1_mismatch", slug: link.slug, detail: `Redirect sends visitors to ${kvValue} but the record says ${link.target_url}.` });
  }
  // An unmapped video is only a problem once its links are LIVE. Minting a
  // short link happens while a video is still being made, so "links exist but
  // no YouTube id" describes every draft as well as every genuinely broken
  // mapping — on 2026-08-28 all 8 videos this reported were unpublished drafts:
  // zero clicks between them, and none of their short links appeared in any of
  // the channel's 68 published descriptions. Recorded clicks are the evidence
  // that a link is out in the world and its traffic cannot be attributed,
  // which is the actual analytics loss worth waking the owner for.
  //
  // `clicks` is optional so a caller that cannot supply it (or a test that does
  // not care) skips the check rather than reporting every draft.
  if (input.videos && input.clicks) {
    const codesWithLinks = new Set(links.map((link) => link.slug.split("/")[0]).filter(Boolean));
    for (const code of [...codesWithLinks].sort()) {
      if (!(code in input.videos) || input.videos[code]) continue;
      const clicks = input.clicks[code] ?? 0;
      if (clicks === 0) continue;
      issues.push({
        code: "unmapped_video",
        slug: code,
        detail: `Video ${code} has ${clicks} recorded click${clicks === 1 ? "" : "s"} but no YouTube video against it, so that traffic is invisible in analytics. Set the YouTube link on the card.`,
      });
    }
  }
  issues.sort((a, b) => (a.code === b.code ? a.slug.localeCompare(b.slug) : a.code.localeCompare(b.code)));
  return issues;
}

/** Telegram body. Silence is the default unless a heartbeat was requested. */
export function buildReport(issues: GuardIssue[], unverifiable: number, total: number, includeHeartbeat: boolean): string | null {
  if (issues.length === 0 && !includeHeartbeat) return null;
  const lines: string[] = [];
  if (issues.length === 0) {
    lines.push(`<b>Link guard</b> — all ${total} links fine`);
    if (unverifiable) lines.push(`${unverifiable} could not be checked (the site blocks robots)`);
  } else {
    lines.push(`<b>Link guard</b> — ${issues.length} need you`);
    const money = issues.filter((issue) => ["no_credit_marker", "points_at_dashboard", "bad_url", "kv_d1_mismatch"].includes(issue.code));
    const other = issues.filter((issue) => !money.includes(issue));
    if (money.length) { lines.push("", "<b>Earning nothing</b>"); for (const issue of money.slice(0, 10)) lines.push(`• ${issue.slug} — ${issue.detail}`); }
    if (other.length) { lines.push("", "<b>Worth a look</b>"); for (const issue of other.slice(0, 10)) lines.push(`• ${issue.slug} — ${issue.detail}`); }
    lines.push("", `${total - issues.length} fine · ${unverifiable} need your eyes`);
  }
  lines.push("", "tutorials-tracker.agrolloo.com → Links → Health");
  return lines.join("\n");
}

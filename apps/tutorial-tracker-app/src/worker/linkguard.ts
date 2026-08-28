/** Daily structural checks. Pure: it never performs I/O or fetches. */
import { creditWarnings, normalizeTargetUrl } from "./linkhealth";
import type { ProgramRow } from "./programs";

export type IssueCode = "bad_url" | "own_redirect_layer" | "points_at_dashboard"
  | "no_credit_marker" | "approved_no_link" | "duplicate_target"
  | "kv_d1_mismatch" | "link_without_program" | "unclassified_kind" | "changed_destination";
export interface GuardIssue { code: IssueCode; slug: string; detail: string; }
export interface GuardInput {
  programs: ProgramRow[];
  links: { slug: string; tool: string; target_url: string; kind: string | null }[];
  kv: Record<string, string>;
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

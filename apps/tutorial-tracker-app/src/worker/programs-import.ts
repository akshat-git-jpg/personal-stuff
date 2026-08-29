/** One-time, re-runnable import of the Affiliate Programs sheet into D1. */

import { extractSheetId } from "./sheet-id";
import { sheetsGet } from "./sheets";
import {
  toSlug, validateTargetUrl,
  type ApprovalStatus, type CouponStatus, type Network, type ProgramInput,
} from "./programs";

const NETWORK_MAP: Record<string, Network> = {
  website: "website",
  "impact.com": "impact",
  partnerstack: "partnerstack",
  paykickstart: "paykickstart",
  network: "network",
  "": "other",
};

const APPROVAL_MAP: Record<string, ApprovalStatus> = {
  approved: "approved",
  rejected: "rejected",
  "to apply": "to_apply",
  "applied. waiting for response": "applied",
  "": "unknown",
};

const COUPON_MAP: Record<string, CouponStatus> = {
  "code received": "received",
  "no code": "none",
  "occassional code": "occasional",
  "occasional code": "occasional",
  "need code": "needed",
  "applied, waiting for response": "applied",
  "": "unknown",
};

export interface ImportIssue {
  row: number;
  slug: string;
  field: string;
  detail: string;
}

export interface ImportResult {
  programs: ProgramInput[];
  issues: ImportIssue[];
  droppedCells: { row: number; column: string; value: string }[];
}

const COL = {
  name: 0, slug: 1, network: 2, notesD: 3, approval: 4, target: 5,
  couponStatus: 6, couponCode: 7, notesI: 8, blankJ: 9, dashboard: 10,
  email: 11, password: 12, extraN: 13,
} as const;

/** Pure sheet row mapping, kept separate from the I/O wrapper for testing. */
export function mapSheetRows(rows: string[][]): ImportResult {
  const programs: ProgramInput[] = [];
  const issues: ImportIssue[] = [];
  const droppedCells: ImportResult["droppedCells"] = [];
  const cell = (r: string[], i: number) => (i < r.length ? (r[i] ?? "").trim() : "");

  for (let n = 1; n < rows.length; n++) {
    const r = rows[n];
    const rowNo = n + 1;
    const name = cell(r, COL.name);
    if (!name) continue;

    const slug = toSlug(cell(r, COL.slug) || name);
    if (!slug) {
      issues.push({ row: rowNo, slug: "", field: "slug", detail: `cannot derive a slug from ${JSON.stringify(name)}` });
      continue;
    }

    const rawNetwork = cell(r, COL.network).toLowerCase();
    const network = NETWORK_MAP[rawNetwork];
    if (network === undefined) {
      issues.push({ row: rowNo, slug, field: "network", detail: `unmapped value ${JSON.stringify(cell(r, COL.network))} -> other` });
    }

    const rawApproval = cell(r, COL.approval).toLowerCase();
    const approval = APPROVAL_MAP[rawApproval];
    if (approval === undefined) {
      issues.push({ row: rowNo, slug, field: "approval_status", detail: `unmapped value ${JSON.stringify(cell(r, COL.approval))} -> unknown` });
    }

    const rawCoupon = cell(r, COL.couponStatus).toLowerCase();
    const coupon = COUPON_MAP[rawCoupon];
    if (coupon === undefined) {
      issues.push({ row: rowNo, slug, field: "coupon_status", detail: `unmapped value ${JSON.stringify(cell(r, COL.couponStatus))} -> unknown` });
    }

    const rawTarget = cell(r, COL.target);
    const checked = validateTargetUrl(rawTarget, "affiliate");
    const target = checked.ok ? (checked.value ?? "") : "";
    if (!checked.ok) {
      issues.push({ row: rowNo, slug, field: "target_url", detail: `${checked.error} (raw: ${JSON.stringify(rawTarget.slice(0, 80))})` });
    }

    const rawCode = cell(r, COL.couponCode);
    const looksLikeCodeOnly = rawCode.length > 0 && rawCode.length <= 20 && !/\s{2,}|[-–]\s*\d|%/.test(rawCode);
    const couponCode = looksLikeCodeOnly ? rawCode : rawCode.split(/\s{2,}|\s-\s/)[0]?.trim() ?? "";
    const couponTerms = looksLikeCodeOnly ? "" : rawCode;

    const credParts: string[] = [];
    if (cell(r, COL.email)) credParts.push(`email: ${cell(r, COL.email)}`);
    if (cell(r, COL.password)) credParts.push(`password: ${cell(r, COL.password)}`);
    if (cell(r, COL.extraN)) credParts.push(cell(r, COL.extraN));

    const noteParts: string[] = [];
    if (cell(r, COL.notesD)) noteParts.push(cell(r, COL.notesD));
    if (cell(r, COL.notesI)) noteParts.push(cell(r, COL.notesI));

    if (cell(r, COL.blankJ)) droppedCells.push({ row: rowNo, column: "J", value: cell(r, COL.blankJ) });

    programs.push({
      slug, name, kind: "affiliate", target_url: target, network: network ?? "other",
      approval_status: approval ?? "unknown", coupon_status: coupon ?? "unknown",
      coupon_code: couponCode, coupon_url: "", coupon_terms: couponTerms,
      dashboard_url: cell(r, COL.dashboard), dashboard_credentials: credParts.join("\n"),
      notes: noteParts.join("\n\n"), probe_enabled: 1,
    });
  }
  return { programs, issues, droppedCells };
}

/** Thin I/O wrapper. Reads the sheet and returns the fully mapped report. */
export async function readSheetForImport(token: string, sheetUrl: string): Promise<ImportResult> {
  const rows = await sheetsGet(token, extractSheetId(sheetUrl), "Sheet1!A1:Z999");
  return mapSheetRows(rows);
}

/** Harvest distinct external tools from per-card video_tools JSON. */
export function harvestExternalTools(
  cards: { row_id?: string; video_tools?: unknown }[],
): { programs: ProgramInput[]; issues: ImportIssue[] } {
  const bySlug = new Map<string, ProgramInput>();
  const issues: ImportIssue[] = [];
  for (const card of cards) {
    let tools: unknown[] = [];
    try { tools = JSON.parse((card.video_tools as string) || "[]"); } catch { continue; }
    if (!Array.isArray(tools)) continue;
    for (const t of tools) {
      const tool = t as { kind?: string; name?: string; url?: string };
      if (tool.kind !== "external") continue;
      const name = (tool.name ?? "").trim();
      const rawUrl = (tool.url ?? "").trim();
      if (!name) continue;
      const slug = toSlug(name);
      if (!slug) continue;
      const checked = validateTargetUrl(rawUrl, "external");
      const url = checked.ok ? (checked.value ?? "") : "";
      if (!checked.ok) {
        issues.push({ row: 0, slug, field: "target_url", detail: `${checked.error} (card ${card.row_id ?? "?"})` });
      }
      const existing = bySlug.get(slug);
      if (existing) {
        if (url && existing.target_url && url !== existing.target_url) {
          issues.push({ row: 0, slug, field: "target_url", detail: `card ${card.row_id ?? "?"} has a different URL (${url}) than the first seen (${existing.target_url}); kept the first` });
        }
        continue;
      }
      bySlug.set(slug, {
        slug, name, kind: "external", target_url: url, network: "other",
        approval_status: "unknown", coupon_status: "unknown",
        coupon_code: "", coupon_url: "", coupon_terms: "",
        dashboard_url: "", dashboard_credentials: "", notes: "", probe_enabled: 1,
      });
    }
  }
  return { programs: [...bySlug.values()], issues };
}

/**
 * affiliate.ts
 * Reads the Affiliate Programs sheet (Sheet1) and normalizes tool names.
 * Ported from common/affiliate.py.
 */

import { sheetsGet } from "./sheets";
import { extractSheetId } from "./sheet-id";

export interface AffiliateRecord {
  tool: string;
  displayName: string;
  targetUrl: string;
  approvalStatus: string;
  couponStatus: string;
  couponCode: string;
  isApproved: boolean;
}

export function normalizeToolName(name: string): string {
  if (!name || !name.trim()) throw new Error("Tool name is empty");
  const s = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return s.replace(/^-+|-+$/g, "");
}

export async function loadAffiliateRecords(
  token: string,
  sheetUrl: string,
): Promise<Record<string, AffiliateRecord>> {
  const sheetId = extractSheetId(sheetUrl);
  const rows = await sheetsGet(token, sheetId, "Sheet1!A1:Z999");
  if (rows.length < 2) return {};

  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const cell = (row: string[], col: string) => {
    const i = idx(col);
    return i >= 0 && i < row.length ? row[i].trim() : "";
  };

  const out: Record<string, AffiliateRecord> = {};
  for (const row of rows.slice(1)) {
    const display = cell(row, "Affiliate Program");
    if (!display) continue;
    const explicit = cell(row, "Slug");
    let slug: string;
    try {
      slug = explicit ? normalizeToolName(explicit) : normalizeToolName(display);
    } catch {
      continue;
    }
    const approvalStatus = cell(row, "Approval Status");
    out[slug] = {
      tool: slug,
      displayName: display,
      targetUrl: cell(row, "My Affiliate Link"),
      approvalStatus,
      couponStatus: cell(row, "Coupon Status"),
      couponCode: cell(row, "Coupon Code"),
      isApproved: approvalStatus.toLowerCase() === "approved",
    };
  }
  return out;
}

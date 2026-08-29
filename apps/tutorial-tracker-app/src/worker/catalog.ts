/** The single place the minting path gets its catalogue from. */
import { loadAffiliateRecords, type AffiliateRecord } from "./affiliate";
import { listPrograms, type ProgramRow } from "./programs";

/** Pure. One catalogue row -> the shape linkgen already understands. */
export function programToAffiliateRecord(p: ProgramRow): AffiliateRecord {
  return {
    tool: p.slug,
    displayName: p.name,
    targetUrl: p.target_url,
    approvalStatus: p.approval_status,
    couponStatus: p.coupon_status,
    couponCode: p.coupon_code,
    // External tools have no approval to grant; affiliates must be approved.
    isApproved: p.kind === "external" || p.approval_status === "approved",
  };
}

/** Pure. The whole catalogue, keyed by slug, as linkgen expects. */
export function programsToCatalog(rows: ProgramRow[]): Record<string, AffiliateRecord> {
  const out: Record<string, AffiliateRecord> = {};
  for (const p of rows) out[p.slug] = programToAffiliateRecord(p);
  return out;
}

export interface CatalogEnv {
  PROGRAMS_BACKEND?: string;
  TRACKER_DB: D1Database;
  AFFILIATE_PROGRAMS_SHEET_URL: string;
}

/** Load D1 by default only when configured; sheets remains the rollback path. */
export async function loadCatalog(
  env: CatalogEnv,
  getToken: () => Promise<string>,
): Promise<Record<string, AffiliateRecord>> {
  if ((env.PROGRAMS_BACKEND ?? "sheets") === "d1") {
    return programsToCatalog(await listPrograms(env.TRACKER_DB));
  }
  return loadAffiliateRecords(await getToken(), env.AFFILIATE_PROGRAMS_SHEET_URL);
}

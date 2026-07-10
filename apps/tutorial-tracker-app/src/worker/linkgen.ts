/**
 * linkgen.ts
 * Deterministic, pure-function link generation.
 */

import type { AffiliateRecord } from "./affiliate";

const BASE62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 4;

export function generateVideoCode(existing: Set<string>, maxAttempts = 100): string {
  for (let i = 0; i < maxAttempts; i++) {
    let code = "";
    const bytes = new Uint8Array(CODE_LENGTH);
    crypto.getRandomValues(bytes);
    for (let j = 0; j < CODE_LENGTH; j++) code += BASE62[bytes[j] % BASE62.length];
    if (!existing.has(code)) return code;
  }
  throw new Error(`Could not generate a unique ${CODE_LENGTH}-char code in ${maxAttempts} attempts`);
}

export type ToolStatus = "affiliate" | "external" | "blocked";

/** What the admin picked, stored on the card as JSON. */
export type VideoTool =
  | { kind: "catalog"; slug: string }
  | { kind: "external"; name: string; url: string };

export interface ResolvedTool {
  slug: string;              // URL path segment + link key
  displayName: string;
  status: ToolStatus;
  targetUrl: string;         // "" when blocked
  couponCode: string;        // "" unless affiliate w/ coupon
  reason?: string;           // human-readable, for blocked
}

const HTTP_RE = /^https?:\/\/\S+$/i;

/** Pure. Selection → resolved plan. NEVER invents a URL; blocked tools carry no URL. */
export function resolveSelection(
  tools: VideoTool[],
  affiliates: Record<string, AffiliateRecord>,
): ResolvedTool[] {
  const out: ResolvedTool[] = [];
  for (const t of tools) {
    if (t.kind === "catalog") {
      const rec = affiliates[t.slug];
      if (!rec) { out.push({ slug: t.slug, displayName: t.slug, status: "blocked", targetUrl: "", couponCode: "", reason: "not in affiliate catalog (deleted or renamed?)" }); continue; }
      if (!rec.isApproved) { out.push({ slug: rec.tool, displayName: rec.displayName, status: "blocked", targetUrl: "", couponCode: "", reason: `affiliate program not approved (status: ${rec.approvalStatus || "unknown"})` }); continue; }
      if (!rec.targetUrl.trim()) { out.push({ slug: rec.tool, displayName: rec.displayName, status: "blocked", targetUrl: "", couponCode: "", reason: "approved but no affiliate link set in the sheet" }); continue; }
      out.push({ slug: rec.tool, displayName: rec.displayName, status: "affiliate", targetUrl: rec.targetUrl.trim(), couponCode: rec.couponCode.trim() });
    } else {
      const url = (t.url || "").trim();
      const name = (t.name || "").trim();
      const slug = name ? safeSlug(name) : "";
      if (!name || !HTTP_RE.test(url)) { out.push({ slug: slug || "external", displayName: name || "(unnamed)", status: "blocked", targetUrl: "", couponCode: "", reason: "external tool needs a name and a valid https URL" }); continue; }
      out.push({ slug, displayName: name, status: "external", targetUrl: url, couponCode: "" });
    }
  }
  return out;
}

function safeSlug(name: string): string {
  const s = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "tool";
}

/** Advisory lint (deterministic, NO LLM): warn when an external entry's name
 *  collides with a catalog program the admin owns — the one spot homepage-vs-affiliate
 *  confusion can happen. Never auto-applied. */
export function externalCollisions(tools: VideoTool[], affiliates: Record<string, AffiliateRecord>): string[] {
  const warns: string[] = [];
  for (const t of tools) {
    if (t.kind !== "external" || !t.name?.trim()) continue;
    const norm = safeSlug(t.name);
    if (affiliates[norm]) warns.push(`"${t.name}" is entered as an external link, but you have an affiliate program for it — use the catalog entry to earn commission.`);
  }
  return warns;
}

export interface LinkPlanItem { slug: string; displayName: string; short_url: string; target_url: string; status: ToolStatus; coupon: string; reason?: string; }

export function buildPlan(resolved: ResolvedTool[], videoCode: string, linkDomain: string): LinkPlanItem[] {
  return resolved.map(r => {
    let short_url = "";
    if (r.status !== "blocked") {
      short_url = `https://${linkDomain}/${videoCode}/${r.slug}`;
    }
    return {
      slug: r.slug,
      displayName: r.displayName,
      short_url,
      target_url: r.targetUrl,
      status: r.status,
      coupon: r.couponCode,
      reason: r.reason
    };
  });
}

/** Deterministic YouTube description. Only linkable (affiliate|external) tools appear. */
export function renderDescription(videoTitle: string, items: LinkPlanItem[]): string {
  const linkable = items.filter((i) => i.status !== "blocked");
  const lines: string[] = [];
  lines.push(`🎥 ${videoTitle.trim()}`, "", "Tools I used in this video:", "");
  for (const i of linkable) {
    lines.push(`▶ ${i.displayName} — ${i.short_url}`);
    if (i.coupon) lines.push(`   Code: ${i.coupon}`);
  }
  lines.push("", "Subscribe for more comparisons 👍");
  return lines.join("\n");
}

/** Belt-and-braces: every planned short_url appears exactly once; no OTHER go-domain URL leaked in. */
export function validateDescription(description: string, items: LinkPlanItem[], linkDomain: string): void {
  for (const i of items.filter((x) => x.status !== "blocked")) {
    const n = description.split(i.short_url).length - 1;
    if (n !== 1) throw new Error(`description integrity: ${i.short_url} appears ${n}× (expected 1)`);
  }
  const domainHits = [...description.matchAll(new RegExp(`https?://${linkDomain.replace(/\./g, "\\.")}/\\S+`, "g"))].map((m) => m[0]);
  const planned = new Set(items.filter((x) => x.status !== "blocked").map((x) => x.short_url));
  for (const h of domainHits) if (!planned.has(h.replace(/[).,]+$/, ""))) throw new Error(`description integrity: unexpected link ${h}`);
}

/** Stable hash of the resolved plan, so confirm can detect the sheet changing under preview. */
export async function planHash(videoCode: string, items: LinkPlanItem[]): Promise<string> {
  const canon = JSON.stringify({ videoCode, items: items.map((i) => [i.slug, i.status, i.target_url, i.coupon]).sort() });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canon));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

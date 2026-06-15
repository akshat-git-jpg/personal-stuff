/**
 * linkgen.ts
 * Ported from process_yt_tracker.py: detect tools → resolve URLs → mint code →
 * write KV + D1 → generate description. Pure helpers + an injected-deps orchestrator.
 */

import type { AffiliateRecord } from "./affiliate";
import type { GeminiClient } from "./gemini";
import { detectToolsPrompt, describePrompt } from "./prompts";

const BASE62 = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 4;

export interface DetectedTool {
  slug: string;
  display_name: string;
  homepage_url: string;
}

export interface ResolvedTool {
  slug: string;
  displayName: string;
  targetUrl: string;
  couponCode: string;
  hasAffiliate: boolean;
}

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

export function resolveTools(
  detected: DetectedTool[],
  affiliates: Record<string, AffiliateRecord>,
): ResolvedTool[] {
  const out: ResolvedTool[] = [];
  for (const entry of detected) {
    const rec = affiliates[entry.slug];
    if (rec && rec.isApproved && rec.targetUrl.trim()) {
      out.push({
        slug: entry.slug,
        displayName: entry.display_name || rec.displayName,
        targetUrl: rec.targetUrl,
        couponCode: rec.couponCode,
        hasAffiliate: true,
      });
    } else {
      const fallback = (rec?.targetUrl.trim() || "") || entry.homepage_url;
      if (!fallback) continue; // no URL anywhere — skip this tool
      out.push({
        slug: entry.slug,
        displayName: entry.display_name,
        targetUrl: fallback,
        couponCode: "",
        hasAffiliate: false,
      });
    }
  }
  return out;
}

export function formatShortLinks(items: [string, string][]): string {
  return items.map(([tool, url]) => `${tool}: ${url}`).join("\n");
}

export function formatActualLinks(items: [string, string, boolean][]): string {
  return items
    .map(([tool, url, hasAff]) => (hasAff ? `${tool}: ${url}` : `${tool}: ${url} (no affiliate)`))
    .join("\n");
}

export interface LinkGenDeps {
  gemini: GeminiClient;
  affiliates: Record<string, AffiliateRecord>;
  linkDomain: string;
  existingCodes: () => Promise<Set<string>>;
  videoCodeForTitle: (title: string) => Promise<string | null>;
  existingSlugs: (videoCode: string) => Promise<Set<string>>;
  insertVideo: (videoCode: string, title: string) => Promise<void>;
  insertLink: (slug: string, videoCode: string, tool: string, targetUrl: string) => Promise<void>;
  kvPut: (slug: string, targetUrl: string) => Promise<void>;
}

export interface GeneratedLink {
  tool: string;
  short_url: string;
  target_url: string;
  has_affiliate: boolean;
  coupon: string;
}

export interface LinkGenResult {
  video_code: string;
  description: string;
  links: GeneratedLink[];
  non_affiliate_tools: string[];
  short_links_text: string;
  actual_links_text: string;
}

export async function processVideo(
  videoTitle: string,
  videoNotes: string,
  deps: LinkGenDeps,
): Promise<LinkGenResult> {
  if (!videoTitle.trim()) throw new Error("video_title is empty");

  const candidatesBlock = Object.entries(deps.affiliates)
    .map(([slug, rec]) => `- ${slug} — ${rec.displayName}`)
    .join("\n");

  const detectedRaw = await deps.gemini.generateJSON<{ tools?: DetectedTool[] }>(
    detectToolsPrompt(videoTitle, videoNotes, candidatesBlock),
  );
  const detected = (detectedRaw.tools ?? [])
    .filter((t) => t && (t.slug ?? "").trim())
    .map((t) => ({
      slug: t.slug.trim(),
      display_name: (t.display_name || t.slug).trim(),
      homepage_url: (t.homepage_url || "").trim(),
    }));
  if (detected.length === 0) throw new Error("LLM returned no tools — refine notes and try again");

  const resolved = resolveTools(detected, deps.affiliates);
  if (resolved.length === 0) throw new Error("No tools resolved — all detected tools failed URL resolution");

  const existingCode = await deps.videoCodeForTitle(videoTitle);
  let videoCode: string;
  let alreadyPresent = new Set<string>();
  if (existingCode) {
    videoCode = existingCode;
    alreadyPresent = await deps.existingSlugs(videoCode);
  } else {
    videoCode = generateVideoCode(await deps.existingCodes());
    await deps.insertVideo(videoCode, videoTitle);
  }

  const actualItems: [string, string, boolean][] = [];
  const shortPairs: [string, string][] = [];
  const links: GeneratedLink[] = [];
  const nonAffiliate: string[] = [];

  for (const r of resolved) {
    const slug = `${videoCode}/${r.slug}`;
    const short = `https://${deps.linkDomain}/${slug}`;
    actualItems.push([r.slug, r.targetUrl, r.hasAffiliate]);
    shortPairs.push([r.slug, short]);
    links.push({
      tool: r.slug,
      short_url: short,
      target_url: r.targetUrl,
      has_affiliate: r.hasAffiliate,
      coupon: r.couponCode,
    });
    if (!r.hasAffiliate) nonAffiliate.push(r.slug);
    if (alreadyPresent.has(slug)) continue;
    await deps.insertLink(slug, videoCode, r.slug, r.targetUrl);
    await deps.kvPut(slug, r.targetUrl);
  }

  const linksBlock = links
    .map((l) => `- ${l.tool} → ${l.short_url}${l.coupon ? ` (coupon: ${l.coupon})` : ""}`)
    .join("\n");
  const description = await deps.gemini.generateText(describePrompt(videoTitle, videoNotes, linksBlock));

  return {
    video_code: videoCode,
    description,
    links,
    non_affiliate_tools: nonAffiliate,
    short_links_text: formatShortLinks(shortPairs),
    actual_links_text: formatActualLinks(actualItems),
  };
}

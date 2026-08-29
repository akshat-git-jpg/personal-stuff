/** Weekly destination-only probe. Fetch is injected so its decisions are testable offline. */
import { creditWarnings } from "./linkhealth";

export type ProbeStatus = "ok" | "no_credit" | "dead" | "unverifiable";
export interface ProbeResult { slug: string; status: ProbeStatus; httpStatus: number | null; finalUrl: string | null; detail: string; }
const SHORT_LINK_HOST = /(^|\.)go\.agrolloo\.com$/i;

/** Throwing is deliberate: silently skipping a short link would hide an analytics-corrupting bug. */
export function assertNotOwnShortLink(url: string): void {
  let host: string;
  try { host = new URL(url).hostname; } catch { return; }
  if (SHORT_LINK_HOST.test(host)) throw new Error(`linkprobe refuses ${url}: probing our own short links would write to the clicks table and falsify the owner's analytics.`);
}
export function isBotBlock(httpStatus: number): boolean { return httpStatus === 403 || httpStatus === 429 || httpStatus === 503; }
export interface ProbeOne { slug: string; targetUrl: string; kind: "affiliate" | "external"; }
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export function judge(item: ProbeOne, httpStatus: number | null, finalUrl: string | null): ProbeResult {
  if (httpStatus === null || finalUrl === null) return { slug: item.slug, status: "unverifiable", httpStatus, finalUrl, detail: "The request did not complete, so nothing could be judged." };
  if (isBotBlock(httpStatus)) return { slug: item.slug, status: "unverifiable", httpStatus, finalUrl, detail: `The site answered ${httpStatus} to an automated request. Only a person can check this one.` };
  if (httpStatus >= 400) return { slug: item.slug, status: "dead", httpStatus, finalUrl, detail: `The destination answered ${httpStatus}.` };
  if (item.kind === "external") return { slug: item.slug, status: "ok", httpStatus, finalUrl, detail: "Reachable. No affiliate code expected for an external tool." };
  if (creditWarnings(finalUrl, "affiliate").some((warning) => warning.code === "no_credit_marker")) return { slug: item.slug, status: "no_credit", httpStatus, finalUrl, detail: "Loads fine, but the final address carries no affiliate code, so this earns nothing." };
  return { slug: item.slug, status: "ok", httpStatus, finalUrl, detail: "Reachable, and the affiliate code survives to the final address." };
}
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export async function probeOne(item: ProbeOne, doFetch: FetchLike): Promise<ProbeResult> {
  assertNotOwnShortLink(item.targetUrl);
  try { const response = await doFetch(item.targetUrl, { redirect: "follow", headers: { "user-agent": UA } }); return judge(item, response.status, response.url || item.targetUrl); }
  catch { return judge(item, null, null); }
}
export async function probeAll(items: ProbeOne[], doFetch: FetchLike, concurrency = 4): Promise<ProbeResult[]> {
  const out: ProbeResult[] = []; const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, Math.max(1, queue.length)) }, async () => {
    for (;;) { const item = queue.shift(); if (!item) return; out.push(await probeOne(item, doFetch)); }
  });
  await Promise.all(workers);
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

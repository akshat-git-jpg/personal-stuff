/**
 * Redirector Worker for go.agrolloo.com/*
 *
 * - KV lookup → 302 redirect (synchronous, fast)
 * - Click logged to D1 in background via ctx.waitUntil() (does NOT block)
 * - Dedup is done at query time in sync_clicks.py, NOT here.
 *
 * This is the money path: every click here is potential affiliate commission,
 * so the handler must never fail closed with an exception. `Response.redirect()`
 * is deliberately NOT used — it throws on a non-absolute URL, which reaches the
 * visitor as Cloudflare "Error 1101". We build the Location header ourselves and
 * wrap the whole handler, so the worst case a visitor can see is a 404.
 */

import { normalizeTarget } from "./url";

export interface Env {
  CLICKS_KV: KVNamespace;
  DB: D1Database;
}

const NOT_FOUND_BODY = "Link not found";
const SLUG_RE = /^[a-zA-Z0-9]+\/[a-zA-Z0-9-]+$/;

export async function hashIdentifier(value: string): Promise<string> {
  if (!value) return "";
  const data = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

function notFound(): Response {
  return new Response(NOT_FOUND_BODY, {
    status: 404,
    headers: { "content-type": "text/plain" },
  });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await handle(req, env, ctx);
    } catch (e) {
      // Backstop: a 404 loses one click, a 1101 crash page loses trust.
      console.error("redirector fetch failed", req.url, e);
      return notFound();
    }
  },
};

async function handle(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const slug = url.pathname.replace(/^\/+/, "");

  if (!slug || !isValidSlug(slug)) return notFound();

  const stored = await env.CLICKS_KV.get(slug);
  if (!stored) return notFound();

  const target = normalizeTarget(stored);
  if (!target) {
    // Unusable stored value. Log loudly so the link guard reports it, and fail
    // soft — we will not invent a destination for the visitor.
    console.error("unusable target", JSON.stringify({ slug, stored }));
    return notFound();
  }
  if (target.repaired) {
    // The redirect works, but KV still holds a malformed value. The daily link
    // guard reads KV directly and will flag this; this log is the live signal.
    console.warn("repaired target", JSON.stringify({ slug, stored, sent: target.url }));
  }

  // Count GET only. A HEAD is never a person: link-preview fetchers (WhatsApp,
  // Slack, Twitter, Google) and security scanners all HEAD the URLs in a YouTube
  // description, and counting those inflates the owner's real analytics. The
  // redirect itself still answers HEAD normally — only the logging is skipped.
  if (req.method === "GET") {
    const ip = req.headers.get("cf-connecting-ip") ?? "";
    const ua = req.headers.get("user-agent") ?? "";
    const referer = req.headers.get("referer") ?? "";
    if (isRobot(ua)) {
      // Not counted, still redirected. See isRobot for why this exists.
      console.warn("robot click skipped", JSON.stringify({ slug, ua: ua.slice(0, 120) }));
    } else {
      ctx.waitUntil(logClick(env, slug, ip, ua, referer));
    }
  }

  return new Response(null, {
    status: 302,
    headers: { location: target.url, "cache-control": "no-store" },
  });
}

/**
 * Is this User-Agent a robot rather than a person?
 *
 * Why this exists (2026-08-28): the moment 65 YouTube descriptions were rewritten
 * to point at this redirector, crawlers harvested every new URL. 269 GET requests
 * arrived in 622 seconds from 143 distinct IPs but only 9 distinct User-Agents,
 * hitting the slugs in exactly the order the descriptions had been saved. Each
 * slug got one bare request then two or three more carrying a spoofed
 * `referer: https://www.google.com/`. Not one came from youtube.com, which is
 * what a real viewer clicking a description link sends.
 *
 * The HEAD-only rule above does not catch these because they are GETs, and the
 * (slug, ip, ua, hour) dedup does not either because the IPs are all different.
 * Left alone this multiplied the owner's real 57 clicks by nearly six, and it
 * would recur on every future description edit.
 *
 * Matching on User-Agent is deliberately conservative: it skips the obvious
 * self-identifying robots and nothing else. A miss costs one inflated count that
 * can be deleted; a false positive silently loses a real click, which is worse.
 * The redirect is never affected — a robot is still sent to the destination.
 */
export function isRobot(ua: string): boolean {
  const s = ua.toLowerCase();
  if (!s) return false;   // Absent UA is normal for some real browsers/privacy tools.
  return /(bot|crawler|crawl|spider|slurp|scrap|fetcher|archiver|monitor|preview|validator|checker|probe|headless|phantom|puppeteer|playwright|selenium|curl|wget|python-requests|httpie|libwww|okhttp|java\/|go-http|axios|node-fetch|guzzle|apache-httpclient|facebookexternalhit|whatsapp|telegrambot|slackbot|discordbot|twitterbot|linkedinbot|embedly|quora link|pinterest|redditbot|applebot|bingpreview|yandex|baidu|duckduckbot|semrush|ahrefs|mj12|dotbot|petalbot|gptbot|claudebot|ccbot|bytespider|amazonbot|google-inspectiontool|googleother|adsbot|mediapartners|feedfetcher|apis-google|lighthouse|pagespeed|uptime|pingdom|statuscake|newrelic)/.test(s);
}

async function logClick(
  env: Env,
  slug: string,
  ip: string,
  ua: string,
  referer: string,
): Promise<void> {
  try {
    const ipHash = await hashIdentifier(ip);
    const uaHash = await hashIdentifier(ua);
    const ts = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      "INSERT INTO clicks (slug, clicked_at, ip_hash, ua_hash, referer) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(slug, ts, ipHash, uaHash, referer)
      .run();
  } catch (e) {
    console.error("logClick failed", e);
  }
}

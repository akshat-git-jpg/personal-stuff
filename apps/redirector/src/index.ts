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

  const ip = req.headers.get("cf-connecting-ip") ?? "";
  const ua = req.headers.get("user-agent") ?? "";
  const referer = req.headers.get("referer") ?? "";
  ctx.waitUntil(logClick(env, slug, ip, ua, referer));

  return new Response(null, {
    status: 302,
    headers: { location: target.url, "cache-control": "no-store" },
  });
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

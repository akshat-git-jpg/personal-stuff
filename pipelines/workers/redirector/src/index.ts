/**
 * Redirector Worker for go.agrolloo.com/*
 *
 * - KV lookup → 302 redirect (synchronous, fast)
 * - Click logged to D1 in background via ctx.waitUntil() (does NOT block)
 * - Dedup is done at query time in sync_clicks.py, NOT here.
 */

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

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const slug = url.pathname.replace(/^\/+/, "");

    if (!slug || !isValidSlug(slug)) {
      return new Response(NOT_FOUND_BODY, {
        status: 404,
        headers: { "content-type": "text/plain" },
      });
    }

    const target = await env.CLICKS_KV.get(slug);
    if (!target) {
      return new Response(NOT_FOUND_BODY, {
        status: 404,
        headers: { "content-type": "text/plain" },
      });
    }

    const ip = req.headers.get("cf-connecting-ip") ?? "";
    const ua = req.headers.get("user-agent") ?? "";
    const referer = req.headers.get("referer") ?? "";
    ctx.waitUntil(logClick(env, slug, ip, ua, referer));

    return Response.redirect(target, 302);
  },
};

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

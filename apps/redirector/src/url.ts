/**
 * Target-URL normalization for the redirector.
 *
 * The redirect path must NEVER throw. `Response.redirect()` throws a TypeError
 * on a non-absolute URL, which reaches the visitor as Cloudflare "Error 1101 —
 * Worker threw exception". That happened in production on 2026-08-28: KV held
 * `openart.ai/home/?via=seema` (no scheme) for 5 slugs, so every click on those
 * affiliate links hit a crash page instead of earning commission.
 *
 * This module is the single place that decides whether a stored value is
 * usable, and repairs the one shape that is safely repairable: a bare
 * host+path, which is what a human pastes when they forget the scheme.
 */

/** Zero-width and soft-hyphen characters that survive a copy out of a sheet. */
const INVISIBLE_RE = /[​-‍⁠﻿­]/g;

export interface NormalizedTarget {
  /** Absolute URL, safe to put in a Location header. */
  url: string;
  /** True when the stored value needed repair — the stored data is still bad. */
  repaired: boolean;
}

/**
 * Returns a usable absolute URL, or null when the value cannot be trusted.
 *
 * Repairs (`repaired: true`): a bare `host/path` gains an `https://` prefix.
 * Rejects (`null`): empty, a non-http(s) scheme, a hostname without a dot, or
 * anything `new URL()` refuses. Prose typed into the link column ("have
 * multiple campaigns to choose...") lands here and yields a 404 — never a
 * crash, and never a guessed destination.
 */
export function normalizeTarget(raw: string | null | undefined): NormalizedTarget | null {
  const value = (raw ?? "").replace(INVISIBLE_RE, "").trim();
  if (!value) return null;

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
  // A scheme-less value must still look like a hostname, not a sentence.
  if (!hasScheme && /\s/.test(value)) return null;

  let parsed: URL;
  try {
    parsed = new URL(hasScheme ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  // Rejects `https://localhost` and other non-public hosts.
  if (!parsed.hostname.includes(".") || parsed.hostname.endsWith(".")) return null;

  return { url: parsed.toString(), repaired: !hasScheme };
}

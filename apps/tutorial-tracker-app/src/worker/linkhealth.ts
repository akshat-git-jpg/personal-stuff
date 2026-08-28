/**
 * linkhealth.ts
 * Pure rules for "is this target URL safe to publish, and will it pay us?".
 *
 * Background (2026-08-28 incident): the affiliate sheet held
 * `openart.ai/home/?via=seema` with no scheme. Nothing validated it, so it was
 * written straight to KV, and the redirector threw on it — Cloudflare Error
 * 1101 on 5 live affiliate links. The same audit found two silent failures that
 * cost money without ever erroring:
 *
 *   - bookbolt: sheet has `bookbolt.io/6671.html` (6671 IS the affiliate id) but
 *     the link resolved to a bare `bookbolt.io/` — page loads, pays nothing.
 *   - a sheet cell pointing at `affiliate.bookbolt.io/account.php`, i.e. our own
 *     affiliate DASHBOARD rather than a referral link.
 *
 * So there are two separate questions, and they need separate answers:
 *   1. Is the URL well-formed?          -> `normalizeTargetUrl`, blocks on failure
 *   2. Will it actually credit us?      -> `creditWarnings`, warns, never blocks
 *
 * (2) must never hard-block: some programs credit via a path rather than a query
 * param (`bookbolt.io/6671.html`, `aff.vidello.com/37289/153371`), and no regex
 * can know every network's scheme. A wrong block would silently drop a real
 * earning link, which is the exact failure we are trying to prevent.
 */

/** Zero-width and soft-hyphen characters that survive a copy out of a sheet. */
const INVISIBLE_RE = /[​-‍⁠﻿­]/g;

export interface NormalizedUrl {
  url: string;
  /** True when a scheme had to be added — the SOURCE value is still malformed. */
  repaired: boolean;
}

/**
 * Well-formedness only. Returns null when the value cannot be a URL at all.
 * Mirrors `apps/redirector/src/url.ts` on purpose: the two Workers deploy
 * independently, and the redirector must not depend on this app's build. Any
 * change here must be made there too, and both test suites cover the same cases.
 */
export function normalizeTargetUrl(raw: string | null | undefined): NormalizedUrl | null {
  const value = (raw ?? "").replace(INVISIBLE_RE, "").trim();
  if (!value) return null;

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
  // A scheme-less value must look like a hostname, not a sentence. This is what
  // rejects the clickfunnels row, which holds prose instead of a link.
  if (!hasScheme && /\s/.test(value)) return null;

  let parsed: URL;
  try {
    parsed = new URL(hasScheme ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!parsed.hostname.includes(".") || parsed.hostname.endsWith(".")) return null;

  return { url: parsed.toString(), repaired: !hasScheme };
}

/**
 * Query params and path shapes that carry affiliate credit. Deliberately broad:
 * a false "looks credited" is cheap (the weekly chain probe catches it), while a
 * false "not credited" trains the operator to ignore warnings.
 */
const CREDIT_PARAM_RE =
  /[?&](via|ref|referral|referrer|fpr|fp_ref|aff|aff_id|affiliate|sca_ref|invite|tag|irclickid|impact_click_id|clickid|iradid|irgwc|utm_campaign|ps_partner_key|gspk|gsxid|rfsn|_r|a|sa|token|coupon|promo|partner|pid|sid|siteid|cid|am_id|pscd|deal)=/i;

/** Path-based credit, e.g. `bookbolt.io/6671.html`, `aff.vidello.com/37289/153371`. */
const CREDIT_PATH_RE = /\/\d{4,}(\.html?)?(\/|$)|\/\d{3,}\/\d{3,}/;

/** Networks whose bare domain already implies tracking. */
const NETWORK_HOST_RE =
  /(^|\.)(sjv\.io|pxf\.io|prf\.hn|partnerlinks\.io|grsm\.io|getrewardful\.com|partnerstack\.com|paykstrt\.com|tolt\.io|firstpromoter\.com|shareasale\.com|envato\.market|impact\.com|dpbolvw\.net|anrdoezrs\.net|jdoqocy\.com|tkqlhce\.com|kqzyfj\.com|go\.redirectingat\.com)$/i;

/**
 * Hosts+paths that are our OWN affiliate dashboards, not referral links.
 * Pasting one of these is a common slip and earns nothing.
 */
const DASHBOARD_RE =
  /^(affiliate|affiliates|partners?|dash|dashboard|console|app)\./i;
const DASHBOARD_PATH_RE =
  /^\/(home|dashboard|account|login|performance|analytics|payout|profile|secure)(\/|$|\.)/i;

/** Our own redirect layer. Must not appear in a stored target (see decisions.md). */
const OWN_REDIRECT_RE = /(^|\.)agrolloo\.com$/i;

/**
 * A subdomain a vendor dedicates to referrals: `go.expressvpn.com/OryBzA`,
 * `get.brevo.com/538136cj7gdc`, `try.elevenlabs.io/…`, `free-trial.adcreative.ai/…`.
 * On its own it proves nothing — `partners.emergent.sh/` is a bare landing page
 * that credits nobody — so it only counts alongside an opaque code in the path.
 */
const REFERRAL_SUBDOMAIN_RE =
  /^(go|get|try|start|join|signup|refer|referral|referrals|ref|aff|affiliate|link|links|track|click|cc|promo|trial|free-trial|partner|partners)\./i;

/**
 * One opaque path segment that looks GENERATED rather than written.
 *
 * Shape alone is not enough: `/pricing` is seven word-characters and sailed
 * through an earlier version of this rule, which would have credited
 * `go.example.com/pricing` as an earning link. A generated code carries a digit
 * (`538136cj7gdc`, `aztd3d3n5sba`) or mixed case (`OryBzA`, `mQMwrjE`); a page
 * name a human typed is lowercase letters only.
 *
 * The dot exclusion is deliberate, so `/account.php` still reads as a dashboard
 * rather than as a code that happens to live on one.
 *
 * This errs strict on purpose. Missing an all-lowercase code costs one alarm to
 * dismiss; crediting a dead homepage costs real commission silently.
 */
function looksLikeGeneratedCode(pathname: string): boolean {
  if (!/^\/[A-Za-z0-9_-]{5,}\/?$/.test(pathname)) return false;
  return /[0-9]/.test(pathname) || /[A-Z]/.test(pathname);
}

/** Vendor affiliate path prefixes: `mailerlite.com/a/mqjayzbdlssd`, `/r/`, `/l/`. */
const CREDIT_PATH_PREFIX_RE =
  /^\/(a|r|l|c|e|ref|refer|referral|aff|affiliate|invite|join|partner|recommends?)\/[A-Za-z0-9_.-]{4,}/i;

/**
 * The owner's own affiliate handles. This is the most direct answer to "will
 * this link pay me?" — if my identifier is in the URL, something is tracking me,
 * whatever shape the vendor chose. It is what credits `vidiq.com/agrollo`, a
 * vanity path no generic pattern can recognise.
 *
 * Add a handle here when a new programme issues one. A handle that is also a
 * common English word would over-credit, so keep them distinctive.
 */
const OWN_HANDLE_RE = /(agrollo|khushi|seema|kushal|hvd)/i;

export type LinkKind = "affiliate" | "external";

export interface LinkWarning {
  code:
    | "no_credit_marker"
    | "points_at_dashboard"
    | "own_redirect_layer"
    | "wrapped_redirect"
    | "scheme_added";
  message: string;
}

/**
 * Advisory checks for a *well-formed* URL. Never blocks; the caller surfaces
 * these in the review screen and the link guard reports them.
 *
 * `kind` matters: an `external` tool has no affiliate program by definition, so
 * landing on a plain homepage is correct for it and must not warn. Getting this
 * wrong is why an earlier audit flagged cursor/zapier/langchain as broken when
 * they were fine.
 */
export function creditWarnings(url: string, kind: LinkKind, repaired = false): LinkWarning[] {
  const out: LinkWarning[] = [];
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return out;
  }

  if (repaired) {
    out.push({
      code: "scheme_added",
      message: "The saved link was missing https:// — fix it at the source, this was auto-repaired.",
    });
  }

  if (OWN_REDIRECT_RE.test(u.hostname)) {
    out.push({
      code: "own_redirect_layer",
      message:
        "Points at agrolloo.com, which adds a hand-edited hop that nothing here can verify. Store the direct affiliate link instead.",
    });
  }

  if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/redirect")) {
    out.push({
      code: "wrapped_redirect",
      message: "This is a YouTube redirect wrapper, not the affiliate link. Paste the real destination.",
    });
  }

  if (kind !== "affiliate") return out;

  if (DASHBOARD_RE.test(u.hostname) && DASHBOARD_PATH_RE.test(u.pathname)) {
    out.push({
      code: "points_at_dashboard",
      message: "This looks like your own affiliate dashboard, not a referral link. It will not credit you.",
    });
  }

  // Six ways a link can carry credit. Measured against the live catalogue on
  // 2026-08-28: the first three alone flagged 10 programmes, and 9 of those were
  // real earning links (Impact branded short links, PartnerStack codes, vanity
  // paths). A guard that is wrong 9 times out of 10 trains you to ignore it,
  // which is the failure this file's header warns about — so the last three
  // exist to keep the alarm rare enough to be worth reading.
  const credited =
    CREDIT_PARAM_RE.test(u.search) ||
    CREDIT_PATH_RE.test(u.pathname) ||
    NETWORK_HOST_RE.test(u.hostname) ||
    (REFERRAL_SUBDOMAIN_RE.test(u.hostname) && looksLikeGeneratedCode(u.pathname)) ||
    CREDIT_PATH_PREFIX_RE.test(u.pathname) ||
    OWN_HANDLE_RE.test(u.pathname + u.search);
  if (!credited) {
    out.push({
      code: "no_credit_marker",
      message:
        "No affiliate code found in this link (no ?via= / ?ref= style marker, no network domain). Check you copied the referral link, not the plain homepage.",
    });
  }

  return out;
}

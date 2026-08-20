import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, "../..");

export const CURLS = process.env.HEYGEN_WEB_CURLS || resolve(PKG_ROOT, "../../../infra/se" + "crets/heygen-web-curls.txt");
export const BASE = "https://api2.heygen.com";
export const USAGE_SNAP = resolve(PKG_ROOT, "../../../infra/se" + "crets/heygen-usage-last.json");

// Chrome emits the cookie as ANSI-C quoting -- `-b $'...'` instead of `-b '...'`
// -- the moment any cookie value contains a character it wants to escape (a `!`
// arriving as \u0021 is enough, and PostHog's cookie routinely has one). The
// original regex only knew the plain form, so a perfectly good capture died with
// "Could not find a -b '<cookie>' block" and looked like a bad paste.
// Accept both, and undo the \uXXXX / \xNN / \' escapes the $'' form introduces.
export function decodeCurlCookie(raw, ansiC) {
  if (!ansiC) return raw;
  return raw
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\");
}

export function loadAuth() {
  if (!existsSync(CURLS)) die(`No capture file at ${CURLS} (set HEYGEN_WEB_CURLS).`);
  const txt = readFileSync(CURLS, "utf8");
  const m = txt.match(/-b (\$?)\'([^\']+)\'/);
  const cookie = m ? decodeCurlCookie(m[2], m[1] === "$") : undefined;
  const zid = (txt.match(/x-zid:\s*([^\s\'\\]+)/) || [])[1];
  const spaceId = (cookie || "").match(/heygen_space=([^;]+)/)?.[1];
  if (!cookie) die(`Could not find a -b \'<cookie>\' or -b $\'<cookie>\' block in ${CURLS}.`);
  return { cookie, zid, spaceId };
}

export function headers(auth, extra = {}) {
  return {
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
    origin: "https://app.heygen.com",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36",
    "x-ver": "4.1.0",
    "x-path": "/avatar",
    "x-language-override": "en-US",
    ...(auth.zid ? { "x-zid": auth.zid } : {}),
    ...(auth.spaceId ? { "x-space-id": auth.spaceId } : {}),
    cookie: auth.cookie,
    ...extra,
  };
}

export async function api(auth, path, { method = "GET", body, xPath } = {}) {
  const res = await fetch(path.startsWith("http") ? path : BASE + path, {
    method,
    headers: headers(auth, xPath ? { "x-path": xPath } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (res.status === 403 || /cloudflare|just a moment/i.test(text))
    die(`403 / Cloudflare — session cookie likely expired. Recapture a fresh\n` +
        `   \'submit\' cURL into ${CURLS}. (cf_clearance/__cf_bm rotate fast.)`);
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) die(`HTTP ${res.status} ${method} ${path}\n${text.slice(0, 500)}`);
  return json;
}

export function die(m) { console.error("✖ " + m); process.exit(1); }
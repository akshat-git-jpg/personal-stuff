import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir, homedir, platform } from "node:os";
import { join, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pbkdf2Sync, createDecipheriv, createHash } from "node:crypto";
import { CURLS, die } from "../client/http.mjs";

// Log in once in a Chromium browser, then this copies the session cookies into
// the auth file, so nobody pastes a cURL. macOS only (cookies are keyed by the
// Keychain entry "<Browser> Safe Storage"; the first read shows an Allow popup).

const BROWSERS = {
  arc: { dir: "Arc/User Data", keychain: "Arc Safe Storage" },
  chrome: { dir: "Google/Chrome", keychain: "Chrome Safe Storage" },
};

// Chromium's macOS cookie crypto: AES-128-CBC, PBKDF2(saltysalt, 1003), iv of 16 spaces,
// and since cookie DB version 24 a 32-byte SHA256(host) prefix on the plaintext.
export function decryptCookie(enc, password, { host, dbVersion }) {
  if (enc.length === 0) return "";
  if (enc.subarray(0, 3).toString() !== "v10") throw new Error("unknown cookie encryption version");
  const key = pbkdf2Sync(password, "saltysalt", 1003, 16, "sha1");
  const d = createDecipheriv("aes-128-cbc", key, Buffer.alloc(16, " "));
  let out = Buffer.concat([d.update(enc.subarray(3)), d.final()]);
  if (dbVersion >= 24 && out.length >= 32 && out.subarray(0, 32).equals(createHash("sha256").update(host).digest())) {
    out = out.subarray(32);
  }
  return out.toString("utf8");
}

// Cookies api2.heygen.com receives: its own host plus the parent domains.
export function cookiesForApi(rows) {
  const ok = (h) => h === "api2.heygen.com" || h === ".heygen.com" || h === "heygen.com" || h === ".api2.heygen.com";
  const seen = new Map();
  for (const r of rows) if (ok(r.host) && !seen.has(r.name)) seen.set(r.name, r.value);
  return [...seen].map(([k, v]) => `${k}=${v}`).join("; ");
}

function sqliteRows(db, sql) {
  const r = spawnSync("sqlite3", ["-separator", "\t", db, sql], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) die(`sqlite3 failed: ${r.stderr.toString().trim()}`);
  return r.stdout.toString("utf8").split("\n").filter(Boolean).map((l) => l.split("\t"));
}

export async function loginFromBrowser(args) {
  if (platform() !== "darwin") die("login-from-browser reads the macOS Keychain; on other systems paste a cURL into the auth file");
  const i = args.indexOf("--browser");
  const name = i >= 0 ? args[i + 1] : "arc";
  const b = BROWSERS[name];
  if (!b) die(`--browser must be one of: ${Object.keys(BROWSERS).join(", ")}`);
  const src = join(homedir(), "Library", "Application Support", b.dir, "Default", "Cookies");
  if (!existsSync(src)) die(`no cookie store at ${src}`);

  const tmp = mkdtempSync(join(tmpdir(), "hg-cookies-"));
  try {
    const db = join(tmp, "Cookies");
    copyFileSync(src, db); // the browser holds a lock on the live file
    const version = Number(sqliteRows(db, "select value from meta where key='version'")[0]?.[0] ?? 0);
    const rows = sqliteRows(db, "select host_key, name, hex(encrypted_value) from cookies where host_key like '%heygen.com'");
    if (!rows.length) die(`no heygen.com cookies in ${name}: log in at app.heygen.com in ${name} first`);

    console.error(`reading the "${b.keychain}" key: allow the Keychain popup if one appears`);
    const pw = spawnSync("security", ["find-generic-password", "-w", "-s", b.keychain], { encoding: "utf8" });
    if (pw.status !== 0) die(`Keychain read refused or failed (${pw.stderr.trim()}): click Allow on the popup and re-run`);
    const password = pw.stdout.trim();

    const cookies = rows.map(([host, cname, hex]) => ({ host, name: cname, value: decryptCookie(Buffer.from(hex, "hex"), password, { host, dbVersion: version }) }));
    if (!cookies.some((c) => c.name === "heygen_session" || c.name === "heygen_token")) die(`no heygen_session/heygen_token cookie in ${name}: log in at app.heygen.com first`);
    const header = cookiesForApi(cookies);
    if (header.includes("'")) die("a cookie value contains a quote; paste a cURL instead");

    mkdirSync(dirname(CURLS), { recursive: true });
    if (existsSync(CURLS)) copyFileSync(CURLS, `${CURLS}.bak`);
    writeFileSync(CURLS, `# written by heygen-web login-from-browser (${name}) ${new Date().toISOString()}\ncurl 'https://api2.heygen.com/v2/avatar_group.private.list' -b '${header}'\n`);
    chmodSync(CURLS, 0o600);
    console.error(`✓ wrote ${cookies.length} ${name} cookies to ${CURLS} (previous file kept as .bak)`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

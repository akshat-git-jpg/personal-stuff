#!/usr/bin/env node
// pp-secrets: sync this repo's gitignored secret files with Infisical (free plan). See README.md.
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CFG_DIR = path.join(os.homedir(), ".config", "pp-secrets");
const CFG = path.join(CFG_DIR, "infisical.json");
const STATE = path.join(CFG_DIR, "state.json");
const FILE_KEY = "FILE_CONTENT";
const ENV_LINE = /^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/;

const USAGE = `usage: pp-secrets <command>
  setup <login.json>     save this machine's Infisical login (one time)
  pull [--quiet]         write every secret file from Infisical
  status                 show what pull would change, change nothing
  push [path...] [--force]  upload local files (all mapped files if no path)`;

const hash = (v) => crypto.createHash("sha256").update(v).digest("hex").slice(0, 16);
const readJson = (p, dflt) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : dflt);

function writePrivate(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text, { mode: 0o600 });
  if (process.platform !== "win32") fs.chmodSync(p, 0o600);
}

// Secrets always land in the main checkout, never in a pp-work workspace (PP_SECRETS_ROOT overrides, for tests).
function mainRoot() {
  if (process.env.PP_SECRETS_ROOT) return process.env.PP_SECRETS_ROOT;
  const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: HERE, encoding: "utf8",
  }).trim();
  return path.dirname(common);
}

const folderOf = (rel) => "/" + rel.split("/").map((s) => s.replace(/[^A-Za-z0-9_-]/g, "_")).join("/");

function loadMap() {
  return readJson(path.join(HERE, "secrets.map.json")).files;
}

// ---- Infisical API ----

async function connect() {
  const cfg = readJson(CFG, null);
  if (!cfg) throw new Error(`no login on this machine: run "pp-secrets setup <login.json>" first`);
  const r = await fetch(`${cfg.siteUrl}/api/v1/auth/universal-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: cfg.clientId, clientSecret: cfg.clientSecret }),
  });
  if (!r.ok) throw new Error(`Infisical login failed: ${r.status} ${await r.text()}`);
  const { accessToken } = await r.json();
  const call = async (method, p, body) => {
    const res = await fetch(cfg.siteUrl + p, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: body && JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw Object.assign(new Error(`${method} ${p}: ${res.status} ${text}`), { status: res.status, text });
    return JSON.parse(text);
  };
  return { cfg, call };
}

async function remoteByFolder({ cfg, call }) {
  const q = `workspaceId=${cfg.projectId}&environment=${cfg.environment}&secretPath=/&recursive=true&expandSecretReferences=false`;
  const { secrets } = await call("GET", `/api/v3/secrets/raw?${q}`);
  const by = new Map();
  for (const s of secrets) {
    if (!by.has(s.secretPath)) by.set(s.secretPath, new Map());
    by.get(s.secretPath).set(s.secretKey, s.secretValue);
  }
  return by;
}

async function ensureFolder({ cfg, call }, folder) {
  let parent = "/";
  for (const name of folder.split("/").filter(Boolean)) {
    try {
      await call("POST", "/api/v1/folders", { workspaceId: cfg.projectId, environment: cfg.environment, name, path: parent });
    } catch (e) {
      if (!/exist/i.test(e.text || "")) throw e;
    }
    parent = parent === "/" ? `/${name}` : `${parent}/${name}`;
  }
}

async function upsert({ cfg, call }, folder, create, update) {
  const base = { workspaceId: cfg.projectId, environment: cfg.environment, secretPath: folder };
  const rows = (o) => Object.entries(o).map(([secretKey, secretValue]) => ({ secretKey, secretValue }));
  if (Object.keys(create).length) await call("POST", "/api/v3/secrets/batch/raw", { ...base, secrets: rows(create) });
  if (Object.keys(update).length) await call("PATCH", "/api/v3/secrets/batch/raw", { ...base, secrets: rows(update) });
}

// ---- .env parsing: values are stored unquoted; local layout and comments are kept ----

function parseEnv(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  const keys = new Map();
  lines.forEach((line, idx) => {
    const m = line.match(ENV_LINE);
    if (!m) return;
    const raw = m[4];
    const qm = raw.match(/^(["'])(.*)\1\s*$/);
    keys.set(m[2], { idx, prefix: m[1], eq: m[3], q: qm ? qm[1] : "", value: qm ? qm[2] : raw.trimEnd() });
  });
  return { lines, keys };
}

function envLine(prefix, key, eq, q, value) {
  if (!q && /[\s#"'`$\\]/.test(value)) q = value.includes('"') ? "'" : '"';
  return `${prefix}${key}${eq}${q}${value}${q}`;
}

// ---- commands ----

function backup(root, rel) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(CFG_DIR, "backup", stamp, rel);
  writePrivate(dest, fs.readFileSync(path.join(root, rel)));
}

async function pull({ quiet = false, dryRun = false } = {}) {
  const api = await connect();
  const remote = await remoteByFolder(api);
  const root = mainRoot();
  const state = readJson(STATE, {});
  let changed = 0;
  const say = (tag, rel, note = "") => {
    if (quiet && (tag === "ok" || tag === "missing")) return;
    console.log(`${tag.padEnd(9)} ${rel}${note ? `  (${note})` : ""}`);
  };

  for (const { path: rel, type } of loadMap()) {
    const rmap = remote.get(folderOf(rel));
    if (!rmap) { say("missing", rel, "not in Infisical yet"); continue; }
    const abs = path.join(root, rel);
    const exists = fs.existsSync(abs);
    const local = exists ? fs.readFileSync(abs, "utf8") : null;
    const st = state[rel] || {};

    if (type === "file") {
      const rv = rmap.get(FILE_KEY) ?? "";
      if (local === rv) { st[FILE_KEY] = hash(rv); say("ok", rel); }
      else if (local === null || !st[FILE_KEY] || st[FILE_KEY] === hash(local)) {
        say(exists ? "updated" : "written", rel);
        if (!dryRun) { if (exists) backup(root, rel); writePrivate(abs, rv); st[FILE_KEY] = hash(rv); }
        changed++;
      } else say("kept", rel, "local edit not uploaded: run pp-secrets push " + rel);
    } else {
      const env = parseEnv(local ?? "");
      const touched = [];
      const kept = [];
      for (const [k, rv] of rmap) {
        const e = env.keys.get(k);
        if (!e) { env.lines.push(envLine("", k, "=", "", rv)); touched.push(k); }
        else if (e.value === rv) st[k] = hash(rv);
        else if (!st[k] || st[k] === hash(e.value)) { env.lines[e.idx] = envLine(e.prefix, k, e.eq, e.q, rv); touched.push(k); }
        else kept.push(k);
      }
      if (touched.length) {
        say(exists ? "updated" : "written", rel, exists ? touched.join(",") : "");
        if (!dryRun) {
          if (exists) backup(root, rel);
          writePrivate(abs, env.lines.join("\n") + "\n");
          for (const k of touched) st[k] = hash(rmap.get(k));
        }
        changed++;
      } else if (!kept.length) say("ok", rel);
      if (kept.length) say("kept", rel, `local edit not uploaded: ${kept.join(",")}`);
    }
    state[rel] = st;
  }
  if (!dryRun) writePrivate(STATE, JSON.stringify(state, null, 2));
  if (quiet && changed) console.log(`pp-secrets: ${changed} secret file(s) updated from Infisical`);
}

async function push(paths, { force = false } = {}) {
  const api = await connect();
  const remote = await remoteByFolder(api);
  const root = mainRoot();
  const state = readJson(STATE, {});
  const map = loadMap();
  const wanted = paths.length ? paths.map((p) => p.replace(/\\/g, "/")) : map.map((f) => f.path);
  let conflicts = 0;

  for (const rel of wanted) {
    const entry = map.find((f) => f.path === rel);
    if (!entry) throw new Error(`${rel} is not in secrets.map.json: add it there first`);
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) { console.log(`skipped   ${rel}  (no local file)`); continue; }
    const folder = folderOf(rel);
    const rmap = remote.get(folder) || new Map();
    const st = state[rel] || {};
    const text = fs.readFileSync(abs, "utf8");
    const local = entry.type === "file" ? new Map([[FILE_KEY, text]]) : new Map([...parseEnv(text).keys].map(([k, e]) => [k, e.value]));

    const create = {}, update = {}, clash = [];
    for (const [k, lv] of local) {
      if (!rmap.has(k)) create[k] = lv;
      else if (rmap.get(k) !== lv) {
        // someone changed it in Infisical since this machine last synced: do not overwrite blindly
        if (!force && st[k] && st[k] !== hash(rmap.get(k))) clash.push(k);
        else update[k] = lv;
      }
    }
    if (clash.length) { conflicts++; console.log(`conflict  ${rel}  (changed in Infisical too: ${clash.join(",")}; pull first or --force)`); }
    const n = Object.keys(create).length + Object.keys(update).length;
    if (n) {
      await ensureFolder(api, folder);
      await upsert(api, folder, create, update);
      console.log(`uploaded  ${rel}  (${Object.keys({ ...create, ...update }).join(",")})`);
    } else if (!clash.length) console.log(`ok        ${rel}`);
    for (const [k, lv] of local) if (!clash.includes(k)) st[k] = hash(lv);
    const extra = [...rmap.keys()].filter((k) => !local.has(k));
    if (extra.length) console.log(`          ${rel}: only in Infisical, kept: ${extra.join(",")}`);
    state[rel] = st;
  }
  writePrivate(STATE, JSON.stringify(state, null, 2));
  if (conflicts) process.exitCode = 3;
}

async function setup(file) {
  if (!file) throw Object.assign(new Error(USAGE), { usage: true });
  const cfg = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const k of ["siteUrl", "projectId", "environment", "clientId", "clientSecret"]) {
    if (!cfg[k]) throw new Error(`${file} is missing "${k}"`);
  }
  fs.mkdirSync(CFG_DIR, { recursive: true, mode: 0o700 });
  writePrivate(CFG, JSON.stringify(cfg, null, 2));
  await connect();
  console.log(`saved ${CFG} and logged in to Infisical. Next: pp-secrets pull`);
}

const [cmd, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith("--")));
const args = rest.filter((a) => !a.startsWith("--"));
const quiet = flags.has("--quiet");

try {
  if (cmd === "setup") await setup(args[0]);
  else if (cmd === "pull") {
    if (quiet && !fs.existsSync(CFG)) process.exit(0);
    await pull({ quiet });
  } else if (cmd === "status") await pull({ dryRun: true });
  else if (cmd === "push") await push(args, { force: flags.has("--force") });
  else { console.error(USAGE); process.exit(2); }
} catch (e) {
  // the SessionStart hook runs pull --quiet: never block a session on a network blip
  console.error(`pp-secrets: ${e.message}`);
  process.exit(quiet ? 0 : e.usage ? 2 : 1);
}

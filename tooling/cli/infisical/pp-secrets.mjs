#!/usr/bin/env node
// pp-secrets: keep every personal secret file in sync with Infisical (free plan). See README.md.
import crypto from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const CFG_DIR = process.env.PP_SECRETS_HOME_CFG || path.join(os.homedir(), ".config", "pp-secrets");
const CFG = path.join(CFG_DIR, "infisical.json");
const STATE = path.join(CFG_DIR, "state.json");
const LOCK = path.join(CFG_DIR, "sync.lock");
const LOG = path.join(CFG_DIR, "sync.log");
const REGISTRY = { folder: "/_registry", key: "FILES" };
const FILE_KEY = "FILE_CONTENT";
const ENV_LINE = /^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_]*)(\s*=\s*)(.*)$/;

// Personal repos only, as paths next to personal-stuff. Never a work or ZluriHQ repo.
const OTHER_REPOS = ["IT", "vps-crons", "personal projects/mend-pilot"];
const SECRET_NAME = /(^|\/)(\.env(\.[^/]+)?|[^/]+\.env|\.dev\.vars(\.[^/]+)?|[^/]*credentials[^/]*\.json|token[^/]*\.json|\.?[^/]*secret[^/]*)$|(^|\/)infra\/secrets\/[^/]+$|\/tokens\/[^/]+\.json$/i;
const SKIP_DIR = /(^|\/)(node_modules|dist|build|\.next|\.wrangler|venv|\.venv|site-packages|__pycache__|\.git|\.claude|\.[a-z_]*cache)(\/|$)/i;
// telegram-user.session: Telegram kills a session used from two machines at once.
const DENY = /(\.example|\.sample|\.template|\.bak|\.log|\.session)$|heygen-usage-last\.json$/i;
const HOME_CFG_DIR = /^([a-z0-9-]+-pp-cli|pp-trip)$/;
const HOME_CFG_FILE = /\.(env|toml|json)$/;

const USAGE = `usage: pp-secrets <command>
  setup <login.json>          save this machine's Infisical login (one time)
  sync [--quiet] [--background]  pull new secrets, push local new or changed ones
  status                      what sync would do; changes nothing
  remove <path>               delete a secret file from Infisical and this machine`;

const hash = (v) => crypto.createHash("sha256").update(v).digest("hex").slice(0, 16);
const readJson = (p, dflt) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : dflt);

function writePrivate(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text, { mode: 0o600 });
  if (process.platform !== "win32") fs.chmodSync(p, 0o600);
}

// ---- where an id lives on this machine ----
// ids: "repo:<repo>/<rel>", "home:<rel>", "vps:<abs path>"

function mainRoot() {
  if (process.env.PP_SECRETS_ROOT) return process.env.PP_SECRETS_ROOT;
  const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
    cwd: HERE, encoding: "utf8",
  }).trim();
  return path.dirname(common);
}

function repoRoots() {
  const main = mainRoot();
  const roots = { "personal-stuff": main };
  for (const name of OTHER_REPOS) {
    const p = path.join(path.dirname(main), name);
    if (fs.existsSync(path.join(p, ".git"))) roots[name] = p;
  }
  return roots;
}

function locate(id, ctx) {
  const [kind, rest] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
  if (ctx.machine === "vps") return kind === "vps" ? rest : null;
  if (kind === "home") return path.join(ctx.home, rest);
  if (kind === "repo") {
    const name = Object.keys(ctx.roots).sort((a, b) => b.length - a.length).find((n) => rest.startsWith(n + "/"));
    return name ? path.join(ctx.roots[name], rest.slice(name.length + 1)) : null;
  }
  return null;
}

const folderOf = (id) => "/" + id.replace(":", "/").split("/").filter(Boolean)
  .map((s) => s.replace(/[^A-Za-z0-9_-]/g, "_")).join("/");

const ENV_FILE = /(^|\/)(\.env(\.[^/]+)?|[^/]+\.env|\.dev\.vars(\.[^/]+)?)$/;

function isEnvText(id, text) {
  if (!ENV_FILE.test(id)) return false;
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  return lines.length > 0 && lines.every((l) => ENV_LINE.test(l));
}

function readLocal(abs) {
  if (!fs.existsSync(abs)) return null;
  const buf = fs.readFileSync(abs);
  const text = buf.toString("utf8");
  return Buffer.from(text, "utf8").equals(buf) ? text : undefined; // undefined = binary, not synced
}

// ---- discovery: every secret file on this machine ----

function discover(ctx) {
  const found = [];
  const add = (id, abs) => {
    const text = readLocal(abs);
    if (typeof text === "string") found.push({ id, type: isEnvText(id, text) ? "env" : "file" });
  };
  if (ctx.machine === "vps") {
    for (const d of fs.existsSync("/srv/crons") ? fs.readdirSync("/srv/crons") : []) {
      const p = `/srv/crons/${d}/.env`;
      if (fs.existsSync(p)) add(`vps:${p}`, p);
    }
    if (fs.existsSync("/root/.claude-rc.env")) add("vps:/root/.claude-rc.env", "/root/.claude-rc.env");
    return found;
  }
  for (const [name, root] of Object.entries(ctx.roots)) {
    const out = execFileSync("git", ["ls-files", "--others", "-z"], {
      cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024,
    });
    for (const rel of out.split("\0")) {
      if (!rel || SKIP_DIR.test(rel) || !SECRET_NAME.test(rel) || DENY.test(rel)) continue;
      add(`repo:${name}/${rel}`, path.join(root, rel));
    }
  }
  const cfg = path.join(ctx.home, ".config");
  for (const d of fs.existsSync(cfg) ? fs.readdirSync(cfg) : []) {
    if (!HOME_CFG_DIR.test(d)) continue;
    for (const f of fs.readdirSync(path.join(cfg, d))) {
      if (HOME_CFG_FILE.test(f) && !DENY.test(f)) add(`home:.config/${d}/${f}`, path.join(cfg, d, f));
    }
  }
  return found;
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
    let res, text;
    for (let attempt = 0; ; attempt++) {
      res = await fetch(cfg.siteUrl + p, {
        method,
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: body && JSON.stringify(body),
      });
      text = await res.text();
      // free plan rate limit: wait the time Infisical asks for, then retry
      if (res.status !== 429 || attempt >= 8) break;
      const wait = Number(text.match(/in (\d+) second/)?.[1] || 5);
      await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
    }
    if (!res.ok) throw Object.assign(new Error(`${method} ${p}: ${res.status} ${text}`), { text });
    return JSON.parse(text);
  };
  return { cfg, call, folders: new Set() };
}

async function fetchRemote(api) {
  const { cfg, call } = api;
  const q = `workspaceId=${cfg.projectId}&environment=${cfg.environment}&secretPath=/&recursive=true&expandSecretReferences=false`;
  const { secrets } = await call("GET", `/api/v3/secrets/raw?${q}`);
  const by = new Map();
  for (const s of secrets) {
    if (!by.has(s.secretPath)) by.set(s.secretPath, new Map());
    for (let p = s.secretPath; p && p !== "/"; p = p.slice(0, p.lastIndexOf("/")) || "/") api.folders.add(p);
    by.get(s.secretPath).set(s.secretKey, { value: s.secretValue, at: Date.parse(s.updatedAt) || 0 });
  }
  return by;
}

async function ensureFolder({ cfg, call, folders }, folder) {
  let parent = "/";
  for (const name of folder.split("/").filter(Boolean)) {
    const here = parent === "/" ? `/${name}` : `${parent}/${name}`;
    if (folders.has(here)) { parent = here; continue; }
    try {
      await call("POST", "/api/v1/folders", { workspaceId: cfg.projectId, environment: cfg.environment, name, path: parent });
    } catch (e) {
      if (!/exist/i.test(e.text || "")) throw e;
    }
    folders.add(here);
    parent = here;
  }
}

async function upsert(api, folder, create, update) {
  const base = { workspaceId: api.cfg.projectId, environment: api.cfg.environment, secretPath: folder };
  const rows = (o) => Object.entries(o).map(([secretKey, secretValue]) => ({ secretKey, secretValue }));
  if (Object.keys(create).length) {
    await ensureFolder(api, folder);
    await api.call("POST", "/api/v3/secrets/batch/raw", { ...base, secrets: rows(create) });
  }
  if (Object.keys(update).length) await api.call("PATCH", "/api/v3/secrets/batch/raw", { ...base, secrets: rows(update) });
}

// ---- .env layout: values stored unquoted; local comments and order are kept ----

function parseEnv(text) {
  const lines = text.split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  const keys = new Map();
  lines.forEach((line, idx) => {
    const m = line.match(ENV_LINE);
    if (!m) return;
    const qm = m[4].match(/^(["'])(.*)\1\s*$/);
    keys.set(m[2], { idx, prefix: m[1], eq: m[3], q: qm ? qm[1] : "", value: qm ? qm[2] : m[4].trimEnd() });
  });
  return { lines, keys };
}

function envLine(prefix, key, eq, q, value) {
  if (!q && /[\s#"'`$\\]/.test(value)) q = value.includes('"') ? "'" : '"';
  return `${prefix}${key}${eq}${q}${value}${q}`;
}

// ---- sync ----

function backup(abs) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writePrivate(path.join(CFG_DIR, "backup", stamp, abs.replace(/^[A-Za-z]:/, "").replace(/^[\\/]+/, "")), fs.readFileSync(abs));
}

async function sync({ dryRun = false, quiet = false } = {}) {
  const api = await connect();
  const ctx = { machine: api.cfg.machine || "dev", home: os.homedir() };
  if (ctx.machine !== "vps") ctx.roots = repoRoots();
  const remote = await fetchRemote(api);
  const state = readJson(STATE, {});
  const regRaw = remote.get(REGISTRY.folder)?.get(REGISTRY.key)?.value;
  const registry = new Map((regRaw ? JSON.parse(regRaw) : []).map((e) => [e.id, e]));
  let regDirty = false;
  for (const e of discover(ctx)) if (!registry.has(e.id)) { registry.set(e.id, e); regDirty = true; }

  const lines = [];
  const say = (tag, id, note = "") => lines.push(`${tag.padEnd(9)} ${id}${note ? `  (${note})` : ""}`);

  for (const entry of registry.values()) {
    const { id, type } = entry;
    const abs = locate(id, ctx);
    if (!abs) continue;
    if (entry.removed) {
      // removed elsewhere: delete here too, unless the file was re-created after the removal
      if (!fs.existsSync(abs)) continue;
      if (fs.statSync(abs).mtimeMs <= entry.removed) {
        say("deleted", id);
        if (!dryRun) { backup(abs); fs.rmSync(abs); delete state[id]; }
        continue;
      }
      delete entry.removed;
      regDirty = true;
    }
    const folder = folderOf(id);
    const rmap = remote.get(folder) || new Map();
    const text = readLocal(abs);
    if (text === undefined) { say("skipped", id, "binary file"); continue; }
    if (text === null && !rmap.size) continue;
    const mtime = text === null ? 0 : fs.statSync(abs).mtimeMs;
    const st = state[id] || {};

    const env = type === "env" ? parseEnv(text ?? "") : null;
    const local = new Map(env ? [...env.keys].map(([k, e]) => [k, e.value]) : text === null ? [] : [[FILE_KEY, text]]);
    const create = {}, update = {}, take = new Map();
    for (const k of new Set([...local.keys(), ...rmap.keys()])) {
      const l = local.get(k), r = rmap.get(k)?.value, s = st[k];
      if (l === r) { st[k] = hash(l); continue; }
      if (r === undefined) create[k] = l;
      else if (l === undefined || s === undefined || hash(l) === s) take.set(k, r); // first contact: Infisical wins
      else if (hash(r) === s) update[k] = l;
      else if (rmap.get(k).at > mtime) take.set(k, r); // both changed: newest wins, loser goes to backup
      else update[k] = l;
    }

    const pushed = [...Object.keys(create), ...Object.keys(update)];
    if (take.size) {
      say(text === null ? "written" : "pulled", id, [...take.keys()].join(","));
      if (!dryRun) {
        if (text !== null) backup(abs);
        let out;
        if (env) {
          for (const [k, v] of take) {
            const e = env.keys.get(k);
            if (e) env.lines[e.idx] = envLine(e.prefix, k, e.eq, e.q, v);
            else env.lines.push(envLine("", k, "=", "", v));
          }
          out = env.lines.join("\n") + "\n";
        } else out = take.get(FILE_KEY);
        writePrivate(abs, out);
        for (const [k, v] of take) st[k] = hash(v);
      }
    }
    if (pushed.length) {
      say("pushed", id, pushed.join(","));
      if (!dryRun) {
        await upsert(api, folder, create, update);
        for (const k of pushed) st[k] = hash(local.get(k));
      }
    }
    state[id] = st;
  }

  if (!dryRun) {
    if (regDirty) {
      const body = JSON.stringify([...registry.values()].sort((a, b) => a.id.localeCompare(b.id)));
      await upsert(api, REGISTRY.folder, regRaw ? {} : { [REGISTRY.key]: body }, regRaw ? { [REGISTRY.key]: body } : {});
      say("register", "file list updated");
    }
    writePrivate(STATE, JSON.stringify(state, null, 2));
  }
  if (!quiet || lines.length) console.log(lines.length ? lines.join("\n") : "everything in sync");
  if (quiet && lines.length) console.log(`pp-secrets: ${lines.length} secret file change(s) synced with Infisical`);
}

// a local path (or an id) -> its id, by matching it against this machine's locations
function idFor(p, ctx) {
  if (/^(repo|home|vps):/.test(p)) return p;
  const abs = path.resolve(p);
  for (const [name, root] of Object.entries(ctx.roots || {})) {
    if (abs.startsWith(root + path.sep)) return `repo:${name}/${path.relative(root, abs).split(path.sep).join("/")}`;
  }
  if (ctx.machine === "vps") return `vps:${abs}`;
  if (abs.startsWith(ctx.home + path.sep)) return `home:${path.relative(ctx.home, abs).split(path.sep).join("/")}`;
  throw new Error(`${p} is not inside a synced location`);
}

async function remove(p) {
  if (!p) throw Object.assign(new Error(USAGE), { usage: true });
  const api = await connect();
  const ctx = { machine: api.cfg.machine || "dev", home: os.homedir() };
  if (ctx.machine !== "vps") ctx.roots = repoRoots();
  const id = idFor(p, ctx);
  const remote = await fetchRemote(api);
  const regRaw = remote.get(REGISTRY.folder)?.get(REGISTRY.key)?.value;
  const reg = (regRaw ? JSON.parse(regRaw) : []).map((e) => (e.id === id ? { ...e, removed: Date.now() } : e));
  const folder = folderOf(id);
  const parent = folder.slice(0, folder.lastIndexOf("/")) || "/";
  try {
    await api.call("DELETE", `/api/v1/folders/${folder.slice(folder.lastIndexOf("/") + 1)}`,
      { workspaceId: api.cfg.projectId, environment: api.cfg.environment, path: parent });
  } catch (e) { if (!/not found/i.test(e.text || "")) throw e; }
  if (regRaw) await upsert(api, REGISTRY.folder, {}, { [REGISTRY.key]: JSON.stringify(reg) });
  const abs = locate(id, ctx);
  if (abs && fs.existsSync(abs)) { backup(abs); fs.rmSync(abs); }
  const state = readJson(STATE, {});
  delete state[id];
  writePrivate(STATE, JSON.stringify(state, null, 2));
  console.log(`removed   ${id}  (other machines delete it on their next sync)`);
}

// one sync at a time per machine; a stale lock (crash) expires after 5 minutes
function takeLock() {
  try {
    if (fs.existsSync(LOCK) && Date.now() - fs.statSync(LOCK).mtimeMs < 5 * 60 * 1000) return false;
    writePrivate(LOCK, String(process.pid));
    return true;
  } catch { return false; }
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
  console.log(`saved ${CFG} and logged in to Infisical`);
}

let [cmd, ...rest] = process.argv.slice(2);
if (cmd === "pull" || cmd === "push") cmd = "sync"; // old names, still used by older hook configs
const flags = new Set(rest.filter((a) => a.startsWith("--")));
const args = rest.filter((a) => !a.startsWith("--"));
const quiet = flags.has("--quiet");

if (cmd === "sync" && flags.has("--background")) {
  // Stop hook: return at once, sync in a detached child that logs to sync.log
  if (fs.existsSync(CFG)) {
    fs.mkdirSync(CFG_DIR, { recursive: true });
    const log = fs.openSync(LOG, "a");
    spawn(process.execPath, [SELF, "sync", "--quiet"], { detached: true, stdio: ["ignore", log, log], windowsHide: true }).unref();
  }
  process.exit(0);
}

try {
  if (cmd === "setup") await setup(args[0]);
  else if (cmd === "status") await sync({ dryRun: true });
  else if (cmd === "remove") await remove(args[0]);
  else if (cmd === "sync") {
    if (quiet && !fs.existsSync(CFG)) process.exit(0);
    if (!takeLock()) { if (!quiet) console.log("another sync is running"); process.exit(0); }
    try { await sync({ quiet }); } finally { fs.rmSync(LOCK, { force: true }); }
  } else { console.error(USAGE); process.exit(2); }
} catch (e) {
  // hooks run sync --quiet: never block a session on a network blip
  console.error(`pp-secrets: ${new Date().toISOString()} ${e.message}`);
  process.exit(quiet ? 0 : e.usage ? 2 : 1);
}

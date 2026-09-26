#!/usr/bin/env node
// pp-splitwise: Splitwise through your own logged-in web session (free; API keys need Pro).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { expenseBody, missing, pickMembers } from "./lib.mjs";

const SITE = "https://secure.splitwise.com";
const PROFILE = process.env.PP_SPLITWISE_PROFILE ?? path.join(os.homedir(), ".pp-splitwise", "chromium");
// Session cookies die when the browser closes, so the login is also kept here.
const STATE = path.join(path.dirname(PROFILE), "login.json");

const USAGE = `pp-splitwise <command>

  login                       open a browser window; log in to Splitwise once
  me | groups | friends       who you are, your groups and their members, your friends
  expenses [--group G] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--json]
  add --group G --cost N --desc TEXT [--date YYYY-MM-DD] [--notes TEXT] [--with A,B] [--yes]
                              you paid, split equally with the group (or only --with people).
                              Without --yes it only prints what it would add.
  delete ID --yes             delete one expense (Splitwise keeps it restorable)
  missing --payments FILE --group G [--days 3] [--json]
                              payments (JSON [{date, amount, desc}]) not on Splitwise yet`;

/** Playwright's own Chromium. Managed Chrome on a work Mac refuses custom profiles. */
function browserPath() {
  if (process.env.PP_SPLITWISE_CHROME) return process.env.PP_SPLITWISE_CHROME;
  const own = chromium.executablePath();
  if (fs.existsSync(own)) return own;
  const cache = process.platform === "darwin" ? path.join(os.homedir(), "Library/Caches/ms-playwright")
    : process.platform === "win32" ? path.join(os.homedir(), "AppData/Local/ms-playwright")
    : path.join(os.homedir(), ".cache/ms-playwright");
  const dirs = fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  for (const d of dirs) {
    for (const rel of [
      "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
      "chrome-win/chrome.exe", "chrome-win64/chrome.exe", "chrome-linux/chrome",
    ]) {
      const p = path.join(cache, d, rel);
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error("No Chromium found. Run: npx playwright install chromium");
}

async function open(headless) {
  fs.mkdirSync(PROFILE, { recursive: true });
  const exe = browserPath();
  let ua;
  if (headless) { // headless Chrome says "HeadlessChrome" in its user agent
    const b = await chromium.launch({ executablePath: exe, headless: true });
    try { ua = (await (await b.newPage()).evaluate(() => navigator.userAgent)).replace("HeadlessChrome", "Chrome"); } finally { await b.close(); }
  }
  const ctx = await chromium.launchPersistentContext(PROFILE, { executablePath: exe, headless, viewport: null, userAgent: ua });
  if (fs.existsSync(STATE)) {
    const year = Date.now() / 1000 + 365 * 86400;
    const { cookies } = JSON.parse(fs.readFileSync(STATE, "utf8"));
    await ctx.addCookies(cookies.map((c) => (c.expires < 0 ? { ...c, expires: year } : c)));
  }
  return ctx;
}

/** One request from inside the logged-in page, the way the Splitwise website makes it. */
async function raw(page, method, endpoint, body) {
  return page.evaluate(async ([method, url, body]) => {
    const csrf = document.querySelector("meta[name=csrf-token]")?.content;
    const r = await fetch(url, {
      method, credentials: "include",
      headers: { Accept: "application/json", ...(csrf ? { "X-CSRF-Token": csrf } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, text: await r.text() };
  }, [method, `/api/v3.0/${endpoint}`, body]);
}

let session;
async function call(method, endpoint, body) {
  if (!session) {
    const ctx = await open(true);
    const page = ctx.pages()[0] ?? (await ctx.newPage());
    await page.goto(`${SITE}/`, { waitUntil: "domcontentloaded" });
    session = { ctx, page };
  }
  const { status, text } = await raw(session.page, method, endpoint, body);
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`HTTP ${status}: ${text.slice(0, 200)}`); }
  if (status === 401 || status === 403) throw new Error("Not logged in to Splitwise. Run: pp-splitwise login");
  if (status >= 300) throw new Error(`HTTP ${status}: ${JSON.stringify(data).slice(0, 300)}`);
  // Splitwise reports validation failures with HTTP 200 and an errors object.
  const errs = data.errors && (Array.isArray(data.errors) ? data.errors : Object.values(data.errors).flat());
  if (errs && errs.length) throw new Error(`Splitwise: ${errs.join("; ")}`);
  return data;
}

const name = (u) => `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();

async function login() {
  const ctx = await open(false);
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(`${SITE}/login`);
  console.error("A browser window is open. Log in to Splitwise. It closes by itself once you are in.");
  try {
    for (const end = Date.now() + 15 * 60e3; Date.now() < end; await page.waitForTimeout(2000)) {
      const r = await raw(page, "GET", "get_current_user").catch(() => null);
      if (r?.status === 200) {
        const { user } = JSON.parse(r.text);
        await ctx.storageState({ path: STATE });
        fs.chmodSync(STATE, 0o600);
        console.error(`Logged in as ${name(user)} (${user.email}).`);
        return;
      }
    }
    throw new Error("Timed out waiting for the login.");
  } finally {
    await ctx.close();
  }
}

async function group(g) {
  const { groups } = await call("GET", "get_groups");
  const hits = groups.filter((x) => String(x.id) === String(g) || x.name.toLowerCase() === String(g).toLowerCase());
  if (hits.length !== 1) throw new Error(`No single group "${g}". Groups: ${groups.map((x) => x.name).join(", ")}`);
  return hits[0];
}

async function expenses({ groupId, since, until }) {
  const out = [];
  for (let offset = 0; ; offset += 200) {
    const q = new URLSearchParams({ limit: "200", offset: String(offset) });
    if (groupId !== undefined) q.set("group_id", String(groupId));
    if (since) q.set("dated_after", `${since}T00:00:00Z`);
    if (until) q.set("dated_before", `${until}T23:59:59Z`);
    const { expenses: page } = await call("GET", `get_expenses?${q}`);
    out.push(...page.filter((e) => !e.deleted_at && !e.payment));
    if (page.length < 200) return out;
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
  const has = (n) => rest.includes(n);
  const json = (x) => console.log(JSON.stringify(x, null, 1));

  if (cmd === "login") return login();
  if (cmd === "me") {
    const { user } = await call("GET", "get_current_user");
    return has("--json") ? json(user) : console.log(`${name(user)}  ${user.email}  id ${user.id}  ${user.default_currency}`);
  }
  if (cmd === "groups") {
    const { groups } = await call("GET", "get_groups");
    if (has("--json")) return json(groups);
    for (const g of groups) {
      console.log(`${g.id}  ${g.name}`);
      for (const m of g.members ?? []) console.log(`    ${m.id}  ${name(m)}  ${m.email ?? ""}`);
    }
    return;
  }
  if (cmd === "friends") {
    const { friends } = await call("GET", "get_friends");
    if (has("--json")) return json(friends);
    for (const f of friends) {
      const bal = (f.balance ?? []).map((b) => `${b.amount} ${b.currency_code}`).join(", ") || "settled";
      console.log(`${f.id}  ${name(f)}  ${f.email ?? ""}  ${bal}`);
    }
    return;
  }
  if (cmd === "expenses") {
    const g = flag("--group") ? await group(flag("--group")) : null;
    const list = await expenses({ groupId: g?.id, since: flag("--since"), until: flag("--until") });
    if (has("--json")) return json(list);
    for (const e of list) {
      const payer = (e.users ?? []).filter((u) => Number(u.paid_share) > 0).map((u) => name(u.user ?? {})).join(", ");
      console.log(`${e.date.slice(0, 10)}  ${e.currency_code} ${e.cost}  ${e.description}  (paid by ${payer})  id ${e.id}`);
    }
    return;
  }
  if (cmd === "add") {
    for (const f of ["--group", "--cost", "--desc"]) if (!flag(f)) throw new Error(`add needs ${f}`);
    if (!(Number(flag("--cost")) > 0)) throw new Error("--cost must be a positive number");
    const date = flag("--date");
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("--date takes YYYY-MM-DD");
    const { user } = await call("GET", "get_current_user");
    const g = await group(flag("--group"));
    const members = flag("--with") ? pickMembers(g.members, flag("--with").split(",")) : g.members.map((m) => m.id);
    const body = expenseBody({ cost: flag("--cost"), desc: flag("--desc"), date, groupId: g.id,
      currency: user.default_currency || "INR", notes: flag("--notes"), payer: user.id, members });
    const who = [user.id, ...members.filter((m) => m !== user.id)].map((id) => name(g.members.find((m) => m.id === id) ?? user));
    console.error(`${date ?? "today"}  ${body.currency_code} ${body.cost}  ${body.description}  in ${g.name}, you paid, split equally: ${who.join(", ")}`);
    if (!has("--yes")) return console.error("Not added. Run again with --yes to add it.");
    const { expenses: made } = await call("POST", "create_expense", body);
    console.log(`added id ${made[0].id}`);
    return;
  }
  if (cmd === "delete") {
    const id = rest[0];
    if (!/^\d+$/.test(id ?? "")) throw new Error("delete takes an expense id");
    if (!has("--yes")) return console.error("Not deleted. Run again with --yes.");
    await call("POST", `delete_expense/${id}`);
    console.log(`deleted id ${id}`);
    return;
  }
  if (cmd === "missing") {
    if (!flag("--payments") || !flag("--group")) throw new Error("missing needs --payments FILE and --group G");
    const payments = JSON.parse(fs.readFileSync(flag("--payments"), "utf8"));
    const g = await group(flag("--group"));
    const since = payments.map((p) => p.date).sort()[0];
    const days = Number(flag("--days") ?? 3);
    const back = since && new Date(Date.parse(since) - days * 864e5).toISOString().slice(0, 10);
    const left = missing(payments, await expenses({ groupId: g.id, since: back }), days);
    if (has("--json")) return json(left);
    for (const p of left) console.log(`${p.date}  ₹${Math.abs(p.amount)}  ${p.desc ?? ""}`);
    console.error(`${left.length} of ${payments.length} payments are not on Splitwise in ${g.name}.`);
    return;
  }
  console.log(USAGE);
  if (cmd && cmd !== "help" && cmd !== "--help") process.exitCode = 2;
}

main().catch((e) => { console.error(`pp-splitwise: ${e.message}`); process.exitCode = 1; })
  .finally(() => session?.ctx.close());

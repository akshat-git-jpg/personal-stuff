#!/usr/bin/env node
// pp-splitwise: Splitwise through its official API (v3.0) with your personal API key.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { expenseBody, missing, pickMembers } from "./lib.mjs";

const API = "https://secure.splitwise.com/api/v3.0";
const KEY_FILE = process.env.PP_SPLITWISE_KEY_FILE ?? path.join(os.homedir(), ".pp-splitwise", "key");

const USAGE = `pp-splitwise <command>

  login [--key KEY]           save your API key (secure.splitwise.com/apps -> register an app)
  me | groups | friends       who you are, your groups and their members, your friends
  expenses [--group G] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--json]
  add --group G --cost N --desc TEXT [--date YYYY-MM-DD] [--notes TEXT] [--with A,B] [--yes]
                              you paid, split equally with the group (or only --with people).
                              Without --yes it only prints what it would add.
  delete ID --yes             delete one expense (Splitwise keeps it restorable)
  missing --payments FILE --group G [--days 3] [--json]
                              payments (JSON [{date, amount, desc}]) not on Splitwise yet`;

function key() {
  if (process.env.SPLITWISE_API_KEY) return process.env.SPLITWISE_API_KEY;
  if (fs.existsSync(KEY_FILE)) return fs.readFileSync(KEY_FILE, "utf8").trim();
  throw new Error("No API key. Run: pp-splitwise login");
}

async function call(method, endpoint, body, k = key()) {
  const res = await fetch(`${API}/${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${k}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`); }
  if (res.status === 401) throw new Error("Splitwise refused the API key. Run: pp-splitwise login");
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  // Splitwise reports validation failures with HTTP 200 and an errors object.
  const errs = data.errors && (Array.isArray(data.errors) ? data.errors : Object.values(data.errors).flat());
  if (errs && errs.length) throw new Error(`Splitwise: ${errs.join("; ")}`);
  return data;
}

const name = (u) => `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();

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

  if (cmd === "login") {
    let k = flag("--key");
    if (!k) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
      k = (await rl.question("Paste your Splitwise API key: ")).trim();
      rl.close();
    }
    const { user } = await call("GET", "get_current_user", undefined, k);
    fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
    fs.writeFileSync(KEY_FILE, k + "\n", { mode: 0o600 });
    fs.chmodSync(KEY_FILE, 0o600);
    console.error(`Saved. Logged in as ${name(user)} (${user.email}).`);
    return;
  }
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
    const [{ user }, g] = await Promise.all([call("GET", "get_current_user"), group(flag("--group"))]);
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

main().catch((e) => { console.error(`pp-splitwise: ${e.message}`); process.exit(1); });

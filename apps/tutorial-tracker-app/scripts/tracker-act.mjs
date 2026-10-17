#!/usr/bin/env node
// Act on the live tracker as a named teammate, through the same API the UI uses.
// The ONLY way a script or Claude session may change a card: never write tracker-db directly.
//
//   node scripts/tracker-act.mjs show   <row_id> --as <email>
//   node scripts/tracker-act.mjs submit <row_id> <stage> --as <email> --note "<what was done>" [--complete]
//   node scripts/tracker-act.mjs set    <row_id> <col> <value> --as <email>
//
// Token: TRACKER_AGENT_TOKEN, else AGENT_TOKEN in apps/tutorial-tracker-app/agent.env (synced by pp-secrets).
// Base URL: TRACKER_URL (default https://tutorials-tracker.agrolloo.com).
// Exit codes: 0 ok, 1 refused or failed, 2 usage.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const BASE = (process.env.TRACKER_URL || "https://tutorials-tracker.agrolloo.com").replace(/\/$/, "");

function usage(msg) {
  if (msg) console.error(msg);
  console.error("usage: tracker-act.mjs show <row_id> | submit <row_id> <stage> --note <text> [--complete] | set <row_id> <col> <value>   (all need --as <email>)");
  process.exit(2);
}

function parseArgs(argv) {
  const pos = []; const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--complete") flags.complete = true;
    else if (a.startsWith("--")) { flags[a.slice(2)] = argv[++i]; if (flags[a.slice(2)] === undefined) usage(`${a} needs a value`); }
    else pos.push(a);
  }
  return { pos, flags };
}

function readToken() {
  if (process.env.TRACKER_AGENT_TOKEN) return process.env.TRACKER_AGENT_TOKEN.trim();
  const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const candidates = [join(appDir, "agent.env")];
  // A pp-work workspace has no secret files; pp-secrets keeps them in the main checkout.
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: appDir, encoding: "utf8" }).trim();
    candidates.push(join(dirname(common), "apps", "tutorial-tracker-app", "agent.env"));
  } catch { /* not a git checkout */ }
  for (const f of candidates) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, "utf8").match(/^\s*AGENT_TOKEN\s*=\s*"?([^"\r\n]+)"?/m);
    if (m) return m[1].trim();
  }
  console.error("No agent token. Set TRACKER_AGENT_TOKEN or add AGENT_TOKEN=... to apps/tutorial-tracker-app/agent.env.");
  process.exit(1);
}

async function api(method, path, as, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${readToken()}`, "X-Act-As": as, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) { console.error(`HTTP ${res.status}: ${json.message || json.error || text}`); process.exit(1); }
  return json;
}

async function loadRow(rowId, as) {
  const board = await api("GET", "/api/board", as);
  const row = (board.rows || []).find((r) => r.row_id === rowId);
  if (!row) { console.error(`${rowId} not found, or ${as} cannot see it.`); process.exit(1); }
  return row;
}

const { pos, flags } = parseArgs(process.argv.slice(2));
const [cmd, rowId] = pos;
const as = (flags.as || "").trim().toLowerCase();
if (!cmd || !rowId) usage();
if (!as) usage("--as <email> is required: every change is made as a real teammate.");

if (cmd === "show") {
  const row = await loadRow(rowId, as);
  console.log(`${row.row_id}  ${row.video_title || ""}  [${row.pipeline}]`);
  for (const a of row._actions || []) {
    console.log(`  ${a.stageId}: ${a.transitions.map((t) => `${t.label} -> ${t.to}${t.disabledReason ? ` (blocked: ${t.disabledReason})` : ""}`).join(", ")}`);
  }
  if (!(row._actions || []).length) console.log(`  ${as} has no actions on this card.`);
} else if (cmd === "submit") {
  const stage = pos[2];
  if (!stage) usage("submit needs a stage id");
  const note = (flags.note || "").trim();
  if (!note) usage("--note is required: the reviewer reads it.");
  const row = await loadRow(rowId, as);
  const transitions = (row._actions || []).find((a) => a.stageId === stage)?.transitions || [];
  const forReview = transitions.find((t) => t.by === "doer" && t.requiresNote);
  const complete = transitions.find((t) => t.by === "doer" && t.kind === "advance");
  const pick = forReview || complete;
  if (!pick) {
    console.error(`${as} cannot submit ${stage} on ${rowId} now. Allowed: ${transitions.map((t) => t.label).join(", ") || "nothing"}.`);
    process.exit(1);
  }
  if (pick.disabledReason) { console.error(`Blocked: ${pick.disabledReason}`); process.exit(1); }
  if (forReview) {
    const out = await api("POST", "/api/submit", as, { row_id: rowId, stage, note });
    console.log(`${rowId} ${stage}: ${out.status}. The reviewer was emailed.`);
  } else {
    // No reviewer on this stage, so the app would mark it Done. That is rarely what a script wants.
    if (!flags.complete) {
      console.error(`${stage} on ${rowId} has no reviewer, so submitting marks it Done with no review. Assign a reviewer in the app first, or pass --complete.`);
      process.exit(1);
    }
    await api("POST", "/api/update", as, { row_id: rowId, col: pick.statusCol, value: pick.to, prev: row[pick.statusCol] });
    console.log(`${rowId} ${stage}: ${pick.to}.`);
  }
} else if (cmd === "set") {
  const [, , col, value] = pos;
  if (!col || value === undefined) usage("set needs <col> <value>");
  await api("POST", "/api/update", as, { row_id: rowId, col, value });
  console.log(`${rowId} ${col} = ${value}`);
} else {
  usage(`unknown command: ${cmd}`);
}

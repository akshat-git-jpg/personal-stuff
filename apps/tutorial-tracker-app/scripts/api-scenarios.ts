// End-to-end scenarios against the real Worker + local D1 (wrangler dev).
// Each one is a bug that reached prod once. Run: npm run test:api (it seeds, starts and stops the server).
import { spawn, execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { getPipeline } from "../src/shared/engine/registry";
import { colOf, stageHasEta, stageHasInstruction } from "../src/shared/engine/types";

const PORT = Number(process.env.SCENARIO_PORT || 8700 + Math.floor(Math.random() * 200)); // random: parallel lands
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "scenario-token";
const ADMIN = "seankerman25@gmail.com";
const NINA = "nina@dev.local";   // tut-2 Scriptwriter + Tutorial Maker
const RIYA = "riya@dev.local";   // tut-2 Reviewer
const TARA = "tara@dev.local";   // tut-2 Thumbnail Maker
const JOHN = "akshatpatidar17@gmail.com"; // tut-2 Video Editor + Processor
const UMA = "uma@dev.local";     // tut-2 Uploader
const p = getPipeline("tut-2");
const st = (id: string) => p.stages.find((s) => s.id === id)!;
const col = (id: string, slot: Parameters<typeof colOf>[1]) => colOf(st(id), slot);
// Every doer a new tut-2 card must have.
const crew = () => ({
  [col("recording", "assignee")]: NINA, [col("processing", "assignee")]: JOHN,
  [col("editing", "assignee")]: JOHN, [col("thumbnail", "assignee")]: TARA, [col("upload", "assignee")]: UMA,
});

type Json = Record<string, any>;
async function call(as: string, method: string, path: string, body?: Json): Promise<{ status: number; json: Json }> {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "X-Act-As": as, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) as Json };
}
const board = async (as: string, asUser?: string) =>
  (await call(as, "GET", `/api/board${asUser ? `?asUser=${encodeURIComponent(asUser)}` : ""}`)).json;
const rowOf = async (as: string, id: string) => (await board(as)).rows.find((r: Json) => r.row_id === id);
const queue = async (as: string, asUser?: string) =>
  (await call(as, "GET", `/api/review-queue${asUser ? `?asUser=${encodeURIComponent(asUser)}` : ""}`)).json.items.map((i: Json) => `${i.row_id}:${i.stageId}`).sort();

/** Run the doer's move on a stage: start, then submit with a note (or complete). */
async function advance(as: string, id: string, stage: string, to: string) {
  if (to === "In Progress" && stageHasEta(st(stage))) {
    await call(as, "POST", "/api/update", { row_id: id, col: col(stage, "eta"), value: "2030-01-01" });
  }
  const row = await rowOf(as, id);
  const t = row._actions.find((a: Json) => a.stageId === stage)?.transitions.find((x: Json) => x.to === to);
  if (!t) throw new Error(`${as} has no move to ${to} on ${id}/${stage}`);
  if (t.disabledReason) throw new Error(`${id}/${stage} blocked: ${t.disabledReason}`);
  return t.requiresNote
    ? call(as, "POST", "/api/submit", { row_id: id, stage, note: "done" })
    : call(as, "POST", "/api/update", { row_id: id, col: t.statusCol, value: to, prev: row[t.statusCol] ?? "" });
}

/** Approve as Riya, first writing the next stage's instruction that approval requires. */
async function approve(id: string, stage: string) {
  const next = p.stages[p.stages.findIndex((x) => x.id === stage) + 1];
  if (next && stageHasInstruction(next)) await call(RIYA, "POST", "/api/update", { row_id: id, col: colOf(next, "instruction"), value: "go" });
  const r = await call(RIYA, "POST", "/api/review", { row_id: id, stage, action: "approve" });
  if (r.status !== 200) throw new Error(`approve ${stage} failed: ${r.status} ${JSON.stringify(r.json)}`);
}

const results: { name: string; ok: boolean; detail?: string }[] = [];
async function scenario(name: string, fn: () => Promise<void>) {
  try { await fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) }); }
}
function expect(cond: unknown, msg: string) { if (!cond) throw new Error(msg); }

async function newCard(extra: Json = {}) {
  const r = await call(ADMIN, "POST", "/api/video", {
    pipeline: p.id, video_title: `Scenario ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    video_notes: "n", project_folder: "https://drive.google.com/drive/folders/x",
    ...crew(), [col("outline", "assignee")]: NINA, [col("outline", "reviewer")]: RIYA, ...extra,
  });
  expect(r.status === 200, `create failed: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json.row_id as string;
}

/** Bring a fresh card's Outline to In Review (topic brief done by the admin first). */
async function toOutlineReview(id: string) {
  const topic = st("topic").id;
  await call(ADMIN, "POST", "/api/update", { row_id: id, col: "video_description", value: "d" });
  for (const t of ["In Progress", "In Review", "Done"]) {
    const has = (await rowOf(ADMIN, id))._actions.find((a: Json) => a.stageId === topic)?.transitions.find((x: Json) => x.to === t);
    if (has) await advance(ADMIN, id, topic, t);
  }
  await advance(NINA, id, "outline", "In Progress");
  const sub = await advance(NINA, id, "outline", "In Review");
  expect(sub.status === 200, `submit failed: ${sub.status} ${JSON.stringify(sub.json)}`);
}

async function main() {
  await scenario("refuses a reviewer who is the stage's own doer", async () => {
    const r = await call(ADMIN, "POST", "/api/video", {
      pipeline: p.id, video_title: "Self review", video_notes: "n", project_folder: "x", ...crew(),
      [col("outline", "assignee")]: NINA, [col("outline", "reviewer")]: NINA,
    });
    expect(r.status === 400 && r.json.error === "bad_assignment", `got ${r.status} ${JSON.stringify(r.json)}`);
    const id = await newCard();
    const u = await call(ADMIN, "POST", "/api/update", { row_id: id, col: col("outline", "reviewer"), value: NINA });
    expect(u.status === 400 && u.json.error === "bad_assignment", `update got ${u.status} ${JSON.stringify(u.json)}`);
  });

  await scenario("refuses a person without the role in that system", async () => {
    const id = await newCard();
    const u = await call(ADMIN, "POST", "/api/update", { row_id: id, col: col("outline", "reviewer"), value: TARA });
    expect(u.status === 400, `got ${u.status}`);
  });

  await scenario("a submitted stage shows in the reviewer's queue, and view-as shows the same", async () => {
    const id = await newCard();
    await toOutlineReview(id);
    const own = await queue(RIYA);
    expect(own.includes(`${id}:outline`), `not in Riya's queue: ${own}`);
    const mirrored = await queue(ADMIN, RIYA);
    expect(JSON.stringify(own) === JSON.stringify(mirrored), `view-as differs: ${mirrored} vs ${own}`);
  });

  await scenario("view-as board equals the real user's board", async () => {
    const real = await board(NINA);
    const mirror = await board(ADMIN, NINA);
    const shape = (b: Json) => JSON.stringify(b.rows.map((r: Json) => [r.row_id, r._stages, r._actions.map((a: Json) => a.transitions.map((t: Json) => t.to))]));
    expect(shape(real) === shape(mirror), "rows or actions differ");
  });

  await scenario("approve and request-changes only go through /api/review", async () => {
    const id = await newCard();
    await toOutlineReview(id);
    const u = await call(RIYA, "POST", "/api/update", { row_id: id, col: col("outline", "status"), value: "Need Changes" });
    expect(u.status >= 400, `update accepted a reviewer move: ${u.status}`);
  });

  await scenario("two approvals at once: exactly one wins", async () => {
    const id = await newCard();
    await toOutlineReview(id);
    const [a, b] = await Promise.all([
      call(RIYA, "POST", "/api/review", { row_id: id, stage: "outline", action: "approve" }),
      call(RIYA, "POST", "/api/review", { row_id: id, stage: "outline", action: "sendback", feedback: "redo" }),
    ]);
    const codes = [a.status, b.status].sort();
    expect(codes[0] === 200 && codes[1] !== 200, `both or neither won: ${codes}`);
  });

  await scenario("events are logged with the right type", async () => {
    const id = await newCard();
    await toOutlineReview(id);
    const ev = (await call(ADMIN, "GET", `/api/card-events?row_id=${id}`)).json.events.filter((e: Json) => e.stage_id === "outline").map((e: Json) => e.type);
    expect(JSON.stringify(ev) === JSON.stringify(["start", "submit"]), `got ${ev}`);
  });

  await scenario("a deleted card's id is never reused", async () => {
    const id = await newCard();
    await call(ADMIN, "POST", "/api/delete", { row_id: id });
    const next = await newCard();
    expect(next !== id, `id ${id} reused`);
  });

  await scenario("a reopened stage locks the stages after its next one", async () => {
    const id = await newCard({ [col("recording", "assignee")]: NINA, [col("recording", "reviewer")]: RIYA });
    await toOutlineReview(id);
    await approve(id, "outline");
    await advance(NINA, id, "recording", "In Progress");
    await advance(NINA, id, "recording", "In Review");
    await approve(id, "recording");
    const r = await call(RIYA, "POST", "/api/review", { row_id: id, stage: "outline", action: "sendback", feedback: "redo" });
    expect(r.status === 200, `reopen failed ${r.status} ${JSON.stringify(r.json)}`);
    const row = await rowOf(ADMIN, id);
    const processing = row._actions.find((a: Json) => a.stageId === "processing");
    expect(!processing, "processing still open after outline was reopened");
  });

  await scenario("refuses a misspelt email and a broken default", async () => {
    const t = await call(ADMIN, "POST", "/api/team", { name: "T", email: "t@gamail.com", memberships: { "tut-2": ["Reviewer"] } });
    expect(t.status === 400 && t.json.error === "bad_email", `team got ${t.status}`);
    const d = await call(ADMIN, "POST", "/api/defaults", { pipeline: p.id, assignments: { [col("outline", "assignee")]: TARA } });
    expect(d.status === 400, `defaults got ${d.status}`);
  });

  await scenario("a removed teammate loses access at once", async () => {
    const email = "leaver@dev.local";
    await call(ADMIN, "POST", "/api/team", { name: "Leaver", email, memberships: { "tut-2": ["Reviewer"] } });
    expect((await call(email, "GET", "/api/board")).status === 200, "new teammate cannot load the board");
    await call(ADMIN, "POST", "/api/team/delete", { email });
    expect((await call(email, "GET", "/api/board")).status === 403, "removed teammate still has access");
  });
}

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) {
      throw new Error(`wrangler dev exited prematurely with code ${server.exitCode}${serverErr ? `: ${serverErr}` : ""}`);
    }
    try { if ((await fetch(`${BASE}/api/auth-mode`)).ok) return; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`wrangler dev did not start${serverErr ? `: ${serverErr}` : ""}`);
}

mkdirSync(new URL("../dist", import.meta.url), { recursive: true });
const skipSeed = process.argv.includes("--no-seed");
if (!skipSeed) execSync("npm run seed:local", { stdio: "ignore" });
let serverErr = "";
const server = spawn("npx", ["wrangler", "dev", "--port", String(PORT), "--var", `AGENT_TOKEN:${TOKEN}`, "--var", "DEV_AUTH:0"], { stdio: ["ignore", "ignore", "pipe"], detached: true });
server.stderr?.on("data", (chunk) => { serverErr += chunk.toString(); });
try {
  await waitUp();
  await main();
} finally {
  try { process.kill(-server.pid!); } catch { /* already gone */ }
}
for (const r of results) console.log(`${r.ok ? "ok  " : "FAIL"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} scenarios passed`);
process.exit(failed ? 1 : 0);

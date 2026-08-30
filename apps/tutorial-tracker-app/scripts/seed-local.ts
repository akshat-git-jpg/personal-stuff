/**
 * Local dev seed — wipes and repopulates the LOCAL D1 (`TRACKER_DB`) with a set
 * of dev personas and demo cards spread across every pipeline / stage / status,
 * so every board (and the review queue + Need-Changes banner) is populated for
 * design + functional review.
 *
 * Personas match the dev preview buttons in src/App.tsx (no Google / password).
 * Cards are authored as flat wide Rows and run through the app's own
 * `decomposeRow` — the exact transform the engine uses — so this can't drift.
 *
 *   npm run seed:local              # build SQL + apply to local D1
 *   npx tsx scripts/seed-local.ts --print   # just print the SQL
 *
 * Local-only: it targets `--local` and never touches remote.
 */
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPipeline, PIPELINES } from "../src/shared/engine/registry";
import { decomposeRow, type Row } from "../src/shared/engine/card";
import { colOf, stageHasReviewerSlot, type StageDef } from "../src/shared/engine/types";
import { lifecycle } from "../src/shared/engine/lifecycle";
import { decomposeRow, type Row } from "../src/shared/engine/card";
import { colOf, stageHasReviewerSlot, type StageDef } from "../src/shared/engine/types";
import registry from "../../../config/channels.json";

const q = (v: unknown) => (v == null || v === "" ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);

// ── Personas (email → roles). Keep in sync with DEV_PERSONAS in src/App.tsx. ──
const SEAN = "seankerman25@gmail.com";
const JOHN = "akshatpatidar17@gmail.com";
const SAM = "kushalbakliwal25@gmail.com";
const ANUSHA = "khushibakliwal125@gmail.com";
const TARA = "tara@dev.local";
const UMA = "uma@dev.local";
const RIYA = "riya@dev.local";
const NINA = "nina@dev.local";

// System-scoped memberships: systemId (or "*" cross-system Admin) → roles there.
// Demonstrates the model: Riya is a CROSS-SYSTEM reviewer (standard + tut-2);
// everyone else is a single-system doer. In tut-2, Nina holds BOTH Scriptwriter
// and Tutorial Maker — i.e. one person who owns two consecutive reviewed stages
// (Outline → Screen recording), the "same person, reviewed per part" flow.
const EMPLOYEES: { email: string; name: string; memberships: Record<string, string[]> }[] = [
  { email: SEAN, name: "Sean", memberships: { "*": ["Admin"], "standard": ["Reviewer"], "tut-2": ["Reviewer"] } },
  // John mirrors the real owner setup: ONE person owning two stages of the same
  // video (Editing then Thumbnail) — the case that used to render each video
  // twice in My work, once live and once title-only under "Up next".
  { email: JOHN, name: "John", memberships: { "standard": ["Video Editor", "Thumbnail Maker"], "tut-2": ["Processor", "Video Editor"] } },
  { email: SAM, name: "Sam", memberships: { "standard": ["Scriptwriter", "Recorder"] } },
  { email: ANUSHA, name: "Anusha", memberships: { "standard": ["Recorder"] } },
  { email: TARA, name: "Tara", memberships: { "standard": ["Thumbnail Maker"], "tut-2": ["Thumbnail Maker"] } },
  { email: UMA, name: "Uma", memberships: { "standard": ["Uploader"], "tut-2": ["Uploader"] } },
  { email: RIYA, name: "Riya", memberships: { "standard": ["Reviewer"], "tut-2": ["Reviewer"] } },
  { email: NINA, name: "Nina", memberships: { "tut-2": ["Scriptwriter", "Tutorial Maker"] } },
];

// ── Card spec DSL — keyed by stage id; columns resolved via the engine. ──────
type StageVals = { status?: string; assignee?: string; reviewer?: string; feedback?: string; link?: string };
interface CardSpec {
  pipeline: string;
  title: string;
  category?: string;
  subcategory?: string;
  notes?: string;
  daysAgo?: number;
  stages: Record<string, StageVals>;
}

const isoDaysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

function specToRow(spec: CardSpec, id: string): Row {
  const p = getPipeline(spec.pipeline);
  const row: Row = {
    row_id: id,
    pipeline: spec.pipeline,
    video_title: spec.title,
    category: spec.category ?? "",
    subcategory: spec.subcategory ?? "",
    video_notes: spec.notes ?? "",
    status_since: isoDaysAgo(spec.daysAgo ?? 1),
    last_updated: isoDaysAgo(spec.daysAgo ?? 1),
  };
  for (const [stageId, vals] of Object.entries(spec.stages)) {
    const s = p.stages.find((x: StageDef) => x.id === stageId);
    if (!s) throw new Error(`[seed] ${spec.pipeline} has no stage "${stageId}"`);
    if (vals.status) row[colOf(s, "status")] = vals.status;
    if (vals.assignee) row[colOf(s, "assignee")] = vals.assignee;
    if (vals.reviewer && stageHasReviewerSlot(s)) row[colOf(s, "reviewer")] = vals.reviewer;
    if (vals.feedback) row[colOf(s, "feedback")] = vals.feedback;
    if (vals.link) row[colOf(s, "work_link")] = vals.link;
  }
  return row;
}

const D = (assignee: string) => ({ status: "Done", assignee });

// ── Demo cards ──────────────────────────────────────────────────────────────
const CARDS: CardSpec[] = [
  { pipeline: "standard", title: "How to color grade in DaVinci Resolve", daysAgo: 3,
    notes: "Beginner-friendly walkthrough of the color page — wheels, curves, and a quick LUT.",
    stages: { topic: D(SEAN), script: { status: "To Do", assignee: SAM } } },
  { pipeline: "standard", title: "Color matching multi-cam footage", daysAgo: 0,
    notes: "Match shots across two cameras before grading.",
    stages: { topic: D(SEAN), script: D(SAM), recording: D(ANUSHA), editing: { status: "In Review", assignee: JOHN, reviewer: SEAN, link: "https://drive.example.com/final-multicam" } } },

  // ── Two fixtures for the "same video, two of my stages" case ──────────────
  // A: John owns Editing (live) AND Thumbnail (gated) on one video. This used to
  //    render the title twice — once actionable, once bare under "Up next".
  //    Upstream links are filled so the editor's detail card has a real Recording
  //    link to read (the column RBAC used to withhold).
  { pipeline: "standard", title: "Two of my stages — editing now, thumbnail after", daysAgo: 2,
    notes: "One person owns both the edit and the thumbnail on this video.",
    stages: {
      topic: D(SEAN),
      script: { status: "Done", assignee: SAM, link: "https://docs.example.com/script-two-stages" },
      recording: { status: "Done", assignee: ANUSHA, link: "https://drive.example.com/screen-recording-raw" },
      editing: { status: "Need Changes", assignee: JOHN, reviewer: SEAN, feedback: "audio drifts after 4:10", link: "https://drive.example.com/cut-v1" },
      thumbnail: { status: "To Do", assignee: JOHN, reviewer: SEAN },
    } },
  // B: Tara owns only the gated Thumbnail — a genuine "Up next" entry, since she
  //    has nothing actionable on this video yet.
  { pipeline: "standard", title: "Waiting on someone else's edit", daysAgo: 4,
    notes: "Thumbnail can't start until the edit is approved.",
    stages: {
      topic: D(SEAN),
      script: { status: "Done", assignee: SAM, link: "https://docs.example.com/script-waiting" },
      recording: { status: "Done", assignee: ANUSHA, link: "https://drive.example.com/recording-waiting" },
      editing: { status: "In Progress", assignee: JOHN, reviewer: SEAN },
      thumbnail: { status: "To Do", assignee: TARA, reviewer: SEAN },
    } },
];

function getAssignee(sys: string, role: string) {
  if (role === "Admin") return SEAN;
  if (sys === "standard") {
    if (role === "Scriptwriter") return SAM;
    if (role === "Recorder") return ANUSHA;
    if (role === "Video Editor") return JOHN;
    if (role === "Thumbnail Maker") return TARA;
    if (role === "Uploader") return UMA;
  }
  if (sys === "tut-2") {
    if (role === "Scriptwriter" || role === "Tutorial Maker") return NINA;
    if (role === "Processor" || role === "Video Editor") return JOHN;
    if (role === "Thumbnail Maker") return TARA;
    if (role === "Uploader") return UMA;
  }
  return SEAN;
}

for (const p of Object.values(PIPELINES)) {
  for (let sIdx = 0; sIdx < p.stages.length; sIdx++) {
    const s = p.stages[sIdx];
    const lc = lifecycle(s.lifecycle);
    for (const status of lc.statuses) {
      const spec: CardSpec = {
        pipeline: p.id,
        title: `test-${p.id}-${s.id}-${status.toLowerCase().replace(/ /g, "-")}`,
        daysAgo: 1,
        stages: {}
      };

      for (let i = 0; i < sIdx; i++) {
        const priorStage = p.stages[i];
        spec.stages[priorStage.id] = { 
          status: lifecycle(priorStage.lifecycle).done, 
          assignee: getAssignee(p.id, priorStage.role)
        };
      }
      
      const stageVals: StageVals = { status, assignee: getAssignee(p.id, s.role) };
      if (lc.reviewed && stageHasReviewerSlot(s)) {
        stageVals.reviewer = RIYA;
      }
      if (status === "Need Changes") stageVals.feedback = "test feedback: tighten the intro";
      if (status === "In Review" || status === "Need Changes" || status === "Done" || status === "Uploaded") {
        stageVals.link = "https://example.com/test";
      }

      spec.stages[s.id] = stageVals;
      CARDS.push(spec);
    }
  }
}


function main() {
  const out: string[] = [];
  out.push("DELETE FROM card_stages;");
  out.push("DELETE FROM cards;");

  // Employees are membership-grained: one row per (email, system_id). Recreate the
  // table so a local DB on the old (email PK) schema is brought up to date.
  out.push("DROP TABLE IF EXISTS employees;");
  out.push(`CREATE TABLE employees (
  email TEXT NOT NULL, system_id TEXT NOT NULL, name TEXT, role TEXT,
  PRIMARY KEY (email, system_id)
);`);
  // Assignment defaults are per system (pipeline_id in the PK). Recreate so a local
  // DB on the old (no pipeline_id) schema is brought up to date. Local-only, and
  // defaults are reconfigurable, so dropping them is safe.
  out.push("DROP TABLE IF EXISTS assignment_defaults;");
  out.push(`CREATE TABLE assignment_defaults (
  pipeline_id TEXT NOT NULL DEFAULT 'standard', category TEXT NOT NULL,
  subcategory TEXT NOT NULL DEFAULT '', col TEXT NOT NULL, email TEXT NOT NULL,
  PRIMARY KEY (pipeline_id, category, subcategory, col)
);`);
  // One default set per SYSTEM now — the category/subcategory columns remain in
  // the schema (they are part of the legacy PK) but are always blank.
  out.push(`INSERT INTO assignment_defaults (pipeline_id, category, subcategory, col, email) VALUES ('standard', '', '', 'script_writer_email', 'kushalbakliwal25@gmail.com'), ('standard', '', '', 'tutorial_maker_email', 'khushibakliwal125@gmail.com'), ('standard', '', '', 'video_editor_email', 'akshatpatidar17@gmail.com'), ('standard', '', '', 'thumbnail_maker_email', 'tara@dev.local'), ('standard', '', '', 'uploader_email', 'uma@dev.local');`);

  out.push("DROP TABLE IF EXISTS card_events;");
  out.push(`CREATE TABLE card_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  type TEXT NOT NULL,
  actor TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);`);
  out.push(`CREATE INDEX IF NOT EXISTS idx_card_events_card ON card_events (card_id, id);`);

  let memberships = 0;
  for (const e of EMPLOYEES) {
    for (const [sys, roles] of Object.entries(e.memberships)) {
      out.push(`INSERT INTO employees (email, system_id, name, role) VALUES (${q(e.email)}, ${q(sys)}, ${q(e.name)}, ${q(roles.join(", "))});`);
      memberships++;
    }
  }

  let cards = 0, stageRows = 0;
  CARDS.forEach((spec, i) => {
    const id = `seed-${String(i + 1).padStart(3, "0")}`;
    const p = getPipeline(spec.pipeline);
    const { card, stages } = decomposeRow(p, specToRow(spec, id), true);
    const channelId = i === 0 && registry.channels.length > 1 ? registry.channels[1].id : "agrollo";
    out.push(`INSERT INTO cards (id, pipeline_id, channel_id, title, notes, description, category, subcategory, extra_json, created_at, updated_at, status_since) VALUES (${q(card.id)}, ${q(card.pipeline_id)}, ${q(channelId)}, ${q(card.title)}, ${q(card.notes)}, ${q(card.description)}, ${q(card.category)}, ${q(card.subcategory)}, ${q(card.extra_json)}, ${q(card.updated_at)}, ${q(card.updated_at)}, ${q(card.status_since)});`);
    cards++;
    for (const s of stages) {
      out.push(`INSERT INTO card_stages (card_id, stage_id, status, assignee, reviewer, work_link, instruction, eta, feedback, extra_json, status_since) VALUES (${q(s.card_id)}, ${q(s.stage_id)}, ${q(s.status)}, ${q(s.assignee)}, ${q(s.reviewer)}, ${q(s.work_link)}, ${q(s.instruction)}, ${q(s.eta)}, ${q(s.feedback)}, ${q(s.extra_json)}, ${q(s.status_since)});`);
      stageRows++;
    }
  });

  const sql = out.join("\n") + "\n";
  process.stderr.write(`-- seed: ${EMPLOYEES.length} employees (${memberships} memberships), ${cards} cards, ${stageRows} card_stages rows\n`);

  if (process.argv.includes("--print")) { process.stdout.write(sql); return; }

  const file = join(tmpdir(), `tracker-seed-${Date.now()}.sql`);
  writeFileSync(file, sql);
  execSync(`npx wrangler d1 execute TRACKER_DB --local --file=${file}`, { stdio: "inherit" });
  process.stderr.write(`-- applied to local D1\n`);

  // The worker caches board rows in KV for 60s (BOARD_CACHE_TTL in worker/index.ts).
  // Bust it so a reseed is visible immediately instead of serving stale rows
  // left over from whatever the dev server/e2e run mutated before this reseed.
  try {
    execSync(`npx wrangler kv key delete --binding=SESSIONS --local "board:rows"`, { stdio: "pipe" });
  } catch { /* key may not exist yet on a fresh dev server — fine */ }
}

main();

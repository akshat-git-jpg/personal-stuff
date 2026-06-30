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
import { getPipeline } from "../src/shared/engine/registry";
import { decomposeRow, type Row } from "../src/shared/engine/card";
import { colOf, stageHasReviewerSlot, type StageDef } from "../src/shared/engine/types";

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
// Nina is a TUT-2-ONLY scriptwriter; everyone else is a single-system doer.
const EMPLOYEES: { email: string; name: string; memberships: Record<string, string[]> }[] = [
  { email: SEAN, name: "Sean", memberships: { "*": ["Admin"], "standard": ["Reviewer"], "tut-2": ["Reviewer"] } },
  { email: JOHN, name: "John", memberships: { "standard": ["Video Editor"] } },
  { email: SAM, name: "Sam", memberships: { "standard": ["Scriptwriter", "Recorder"] } },
  { email: ANUSHA, name: "Anusha", memberships: { "standard": ["Recorder"] } },
  { email: TARA, name: "Tara", memberships: { "standard": ["Thumbnail Maker"] } },
  { email: UMA, name: "Uma", memberships: { "standard": ["Uploader"] } },
  { email: RIYA, name: "Riya", memberships: { "standard": ["Reviewer"], "tut-2": ["Reviewer"] } },
  { email: NINA, name: "Nina", memberships: { "tut-2": ["Scriptwriter"] } },
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
  // Script board (Sam) — every status
  { pipeline: "standard", title: "How to color grade in DaVinci Resolve", category: "Editing", subcategory: "Color", daysAgo: 3,
    notes: "Beginner-friendly walkthrough of the color page — wheels, curves, and a quick LUT.",
    stages: { topic: D(SEAN), script: { status: "To Do", assignee: SAM } } },
  { pipeline: "standard", title: "5 keyboard shortcuts that save hours", category: "Editing", subcategory: "Workflow", daysAgo: 1,
    notes: "Punchy listicle. Keep each tip under 20s.",
    stages: { topic: D(SEAN), script: { status: "In Progress", assignee: SAM } } },
  { pipeline: "standard", title: "Masking explained in 4 minutes", category: "Editing", subcategory: "Effects", daysAgo: 2,
    notes: "Cover shape vs. luma masks with one real example each.",
    stages: { topic: D(SEAN), script: { status: "Need Changes", assignee: SAM, reviewer: RIYA, feedback: "Intro runs too long — cut to ~15s and lead with the payoff shot." } } },
  { pipeline: "standard", title: "Exporting for YouTube without quality loss", category: "Editing", subcategory: "Export", daysAgo: 0,
    notes: "Settings table + why bitrate matters.",
    stages: { topic: D(SEAN), script: { status: "In Review", assignee: SAM, reviewer: RIYA, link: "https://docs.example.com/export-script" } } },

  // Recording board (Sam / Anusha)
  { pipeline: "standard", title: "Proxy workflow for 4K footage", category: "Editing", subcategory: "Workflow", daysAgo: 1,
    notes: "Generate + relink proxies; when to use them.",
    stages: { topic: D(SEAN), script: D(SAM), recording: { status: "In Progress", assignee: ANUSHA } } },
  { pipeline: "standard", title: "Lighting on a budget", category: "Production", subcategory: "Lighting", daysAgo: 4,
    notes: "Three-point lighting with cheap gear.",
    stages: { topic: D(SEAN), script: D(SAM), recording: { status: "To Do", assignee: SAM } } },

  // Editing board (John) — incl. review queue (reviewer = Sean)
  { pipeline: "standard", title: "Audio cleanup with iZotope", category: "Editing", subcategory: "Audio", daysAgo: 2,
    notes: "De-noise, de-reverb, and mouth-click removal.",
    stages: { topic: D(SEAN), script: D(SAM), recording: D(ANUSHA), editing: { status: "In Progress", assignee: JOHN } } },
  { pipeline: "standard", title: "Color matching multi-cam footage", category: "Editing", subcategory: "Color", daysAgo: 0,
    notes: "Match shots across two cameras before grading.",
    stages: { topic: D(SEAN), script: D(SAM), recording: D(ANUSHA), editing: { status: "In Review", assignee: JOHN, reviewer: SEAN, link: "https://drive.example.com/final-multicam" } } },

  // Thumbnail (Tara) + Upload (Uma)
  { pipeline: "standard", title: "Thumbnail psychology that gets clicks", category: "Channel", subcategory: "Thumbnails", daysAgo: 1,
    notes: "Contrast, faces, and the 3-word rule.",
    stages: { topic: D(SEAN), script: D(SAM), recording: D(ANUSHA), editing: D(JOHN), thumbnail: { status: "To Do", assignee: TARA } } },
  { pipeline: "standard", title: "Channel trailer breakdown", category: "Channel", subcategory: "Strategy", daysAgo: 1,
    notes: "Anatomy of a trailer that converts visitors to subs.",
    stages: { topic: D(SEAN), script: D(SAM), recording: D(ANUSHA), editing: D(JOHN), thumbnail: D(TARA), upload: { status: "To Do", assignee: UMA } } },

  // Tut-2 system — for the type picker + "Tut 2" system chip. Doer = Nina
  // (tut-2-only Scriptwriter); reviewer = Riya (cross-system). Sam (standard
  // Scriptwriter) must NOT appear in these cards' assignment dropdowns.
  { pipeline: "tut-2", title: "AI avatar explainer: zero to first video", category: "AI", subcategory: "Avatars", daysAgo: 1,
    notes: "End-to-end with an avatar tool; script-led.",
    stages: { topic: D(SEAN), outline: { status: "In Progress", assignee: NINA } } },
  { pipeline: "tut-2", title: "Faceless shorts pipeline", category: "AI", subcategory: "Shorts", daysAgo: 0,
    notes: "Batch-produce shorts from one long video.",
    stages: { topic: D(SEAN), outline: D(NINA), recording: { status: "In Review", assignee: NINA, reviewer: RIYA, link: "https://drive.example.com/shorts-rec" } } },
];

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
    out.push(`INSERT INTO cards (id, pipeline_id, title, notes, description, category, subcategory, extra_json, created_at, updated_at, status_since) VALUES (${q(card.id)}, ${q(card.pipeline_id)}, ${q(card.title)}, ${q(card.notes)}, ${q(card.description)}, ${q(card.category)}, ${q(card.subcategory)}, ${q(card.extra_json)}, ${q(card.updated_at)}, ${q(card.updated_at)}, ${q(card.status_since)});`);
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
}

main();

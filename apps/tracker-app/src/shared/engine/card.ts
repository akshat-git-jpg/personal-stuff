// ===========================================================================
// CARD ASSEMBLY — the bridge between normalized storage and the flat `Row` that
// the rest of the app (rbac, board, client) speaks.
//
//   storage:  cards(1) + card_stages(N)   ⇄   flat Row { col: value, … }
//
// assembleRow()  : cards row + its card_stages rows → flat Row
// routeWrite()   : a flat-col write → where it lands (card field / stage slot /
//                  extra_json), so updateCells can target the normalized tables
// newCardStages(): the card_stages rows to create for a fresh card
//
// All column<->slot mapping lives here, derived from the pipeline def. Adding a
// system needs no change here — it's generic over PipelineDef.
// ===========================================================================
import type { PipelineDef, StageDef, SlotKey, FieldDef } from "./types";
import {
  colOf, stageHasEta, stageHasInstruction, stageHasReviewerSlot, workField,
} from "./types";
import { lifecycle } from "./lifecycle";

export type Row = Record<string, string | undefined>;

/** Fixed card-level fields ⇄ their `cards` table columns. */
const CARD_FIELDS: Record<string, string> = {
  video_title: "title",
  video_notes: "notes",
  video_description: "description",
  category: "category",
  subcategory: "subcategory",
};
const CARD_COL_BY_DB: Record<string, string> = Object.fromEntries(
  Object.entries(CARD_FIELDS).map(([col, db]) => [db, col]),
);

/** The DB row shapes (string-valued; extra is a JSON string). */
export interface CardRecord {
  id: string;
  pipeline_id: string;
  title?: string; notes?: string; description?: string; category?: string; subcategory?: string;
  extra_json?: string;        // brief extras (e.g. topic_date) + passthrough of any stray legacy col
  created_at?: string;
  updated_at?: string;
  status_since?: string;      // card-level: when any stage status last changed (legacy parity)
}
export interface StageRecord {
  card_id: string;
  stage_id: string;
  status?: string;
  assignee?: string;
  reviewer?: string;
  work_link?: string;
  instruction?: string;
  eta?: string;
  feedback?: string;
  extra_json?: string;        // stage extras (e.g. short_links, actual_links, yt_upload_date)
  status_since?: string;
}

const STAGE_SLOTS: SlotKey[] = ["status", "assignee", "reviewer", "work_link", "instruction", "eta", "feedback"];

function fieldCol(s: StageDef, f: FieldDef): string {
  return f.slot ? colOf(s, f.slot) : f.id;
}

/** Which first-class slots this stage actually exposes (so we don't map absent ones). */
function activeSlots(s: StageDef): SlotKey[] {
  return STAGE_SLOTS.filter((slot) => {
    if (slot === "status" || slot === "assignee") return true;
    if (slot === "reviewer") return stageHasReviewerSlot(s);
    if (slot === "work_link") return !!workField(s);
    if (slot === "eta") return stageHasEta(s);
    if (slot === "instruction") return stageHasInstruction(s);
    if (slot === "feedback") return s.lifecycle === "review";
    return false;
  });
}

const parse = (j: string | undefined): Record<string, string> => {
  if (!j) return {};
  try { return JSON.parse(j) as Record<string, string>; } catch { return {}; }
};

// --- assemble: normalized rows → flat Row ----------------------------------

export function assembleRow(p: PipelineDef, card: CardRecord, stages: StageRecord[]): Row {
  const byStage = new Map(stages.map((s) => [s.stage_id, s]));
  const row: Row = {
    pipeline: p.id, row_id: card.id,
    last_updated: card.updated_at ?? "", status_since: card.status_since ?? "",
  };

  for (const [col, db] of Object.entries(CARD_FIELDS)) row[col] = (card as unknown as Record<string, string | undefined>)[db] ?? "";
  for (const [k, v] of Object.entries(parse(card.extra_json))) row[k] = v; // brief extras (topic_date…)

  for (const s of p.stages) {
    const sr = byStage.get(s.id);
    for (const slot of activeSlots(s)) row[colOf(s, slot)] = (sr?.[slot as keyof StageRecord] as string) ?? "";
    const ex = parse(sr?.extra_json);
    for (const f of s.extra ?? []) row[fieldCol(s, f)] = ex[f.id] ?? "";
  }
  return row;
}

// --- route a write: flat col → storage target ------------------------------

export type WriteTarget =
  | { kind: "card"; field: string }
  | { kind: "card_extra"; key: string }
  | { kind: "stage"; stageId: string; slot: SlotKey }
  | { kind: "stage_extra"; stageId: string; fieldId: string }
  | { kind: "system"; field: string }   // last_updated, status_since handled by the store
  | null;

interface RouteMaps { byCol: Map<string, WriteTarget>; }
const routeCache = new Map<string, RouteMaps>();

function routeMaps(p: PipelineDef): RouteMaps {
  const hit = routeCache.get(p.id);
  if (hit) return hit;
  const byCol = new Map<string, WriteTarget>();

  for (const [col, db] of Object.entries(CARD_FIELDS)) byCol.set(col, { kind: "card", field: db });
  byCol.set("last_updated", { kind: "system", field: "updated_at" });
  byCol.set("status_since", { kind: "system", field: "status_since" });

  for (const s of p.stages) {
    for (const slot of activeSlots(s)) byCol.set(colOf(s, slot), { kind: "stage", stageId: s.id, slot });
    for (const f of s.extra ?? []) byCol.set(fieldCol(s, f), { kind: "stage_extra", stageId: s.id, fieldId: f.id });
    // brief fields beyond the fixed card columns (e.g. topic_date) live in card.extra_json
    for (const bf of s.briefFields ?? []) {
      if (!(bf in CARD_FIELDS) && !byCol.has(bf)) byCol.set(bf, { kind: "card_extra", key: bf });
    }
  }
  const maps = { byCol };
  routeCache.set(p.id, maps);
  return maps;
}

export function routeWrite(p: PipelineDef, col: string): WriteTarget {
  const known = routeMaps(p).byCol.get(col);
  if (known) return known;
  if (col === "pipeline" || col === "row_id") return null;     // addressing — not written as data
  return { kind: "card_extra", key: col };                     // passthrough any stray legacy col
}

/** The status col of a stage whose status is being set — for stamping status_since. */
export function statusStageId(p: PipelineDef, col: string): string | undefined {
  const t = routeWrite(p, col);
  return t && t.kind === "stage" && t.slot === "status" ? t.stageId : undefined;
}

// --- decompose: flat Row → normalized records (migration + tests + create) -
// For a fresh card, pass `fillFirstStatus: true` so each stage starts at its
// lifecycle's first status (To Do) rather than empty.

export function decomposeRow(p: PipelineDef, row: Row, fillFirstStatus = false): { card: CardRecord; stages: StageRecord[] } {
  const card: CardRecord = {
    id: String(row.row_id ?? ""), pipeline_id: p.id,
    updated_at: row.last_updated || undefined, status_since: row.status_since || undefined,
  };
  for (const [col, db] of Object.entries(CARD_FIELDS)) (card as unknown as Record<string, string>)[db] = row[col] ?? "";
  // Card-level extras: brief fields like topic_date + passthrough of any stray
  // legacy col (e.g. reviewer_email) — everything that routes to card_extra.
  const extra: Record<string, string> = {};
  for (const [col, v] of Object.entries(row)) {
    if (!v) continue;
    const t = routeWrite(p, col);
    if (t && t.kind === "card_extra") extra[t.key] = v;
  }
  if (Object.keys(extra).length) card.extra_json = JSON.stringify(extra);

  const stages: StageRecord[] = p.stages.map((s) => {
    const rec: StageRecord = { card_id: card.id, stage_id: s.id };
    for (const slot of activeSlots(s)) {
      const v = row[colOf(s, slot)];
      if (v) (rec as unknown as Record<string, string>)[slot] = v;
    }
    if (fillFirstStatus && !rec.status) rec.status = lifecycle(s.lifecycle).statuses[0];
    const extra: Record<string, string> = {};
    for (const f of s.extra ?? []) { const v = row[fieldCol(s, f)]; if (v) extra[f.id] = v; }
    if (Object.keys(extra).length) rec.extra_json = JSON.stringify(extra);
    return rec;
  });
  return { card, stages };
}

export { CARD_FIELDS, CARD_COL_BY_DB };

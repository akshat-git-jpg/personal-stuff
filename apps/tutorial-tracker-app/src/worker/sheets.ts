/**
 * sheets.ts
 * Google Sheets adapter — the ONLY module that talks to the Sheets v4 REST API.
 * Web-standard APIs only (Workers + Node 20+); no googleapis / Node crypto.
 */

import type { Column } from "../shared/columns";
import { COLUMNS } from "../shared/columns";
import type { Row } from "../shared/rbac";
import { colLetter } from "./google-jwt";

// ---------------------------------------------------------------------------
// Re-export getAccessToken so callers can import from this module
// ---------------------------------------------------------------------------
export { getAccessToken } from "./google-jwt";

// ---------------------------------------------------------------------------
// Internal Sheets API helpers
// ---------------------------------------------------------------------------

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const TAB = "Master";
/**
 * Read range derived from COLUMNS length so a future column past Z never falls
 * outside the read window. +2 = safety for an appended row_id beyond the schema.
 */
const READ_RANGE = `${TAB}!A1:${colLetter(COLUMNS.length + 2)}999`;

interface SheetValuesResponse {
  values?: string[][];
}

export async function sheetsGet(token: string, sheetId: string, range: string): Promise<string[][]> {
  const url = `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Sheets GET failed (${resp.status}): ${text}`);
  }
  const json = (await resp.json()) as SheetValuesResponse;
  return json.values ?? [];
}

async function sheetsPut(
  token: string,
  sheetId: string,
  range: string,
  value: string,
): Promise<void> {
  const url =
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [[value]] }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Sheets PUT failed (${resp.status}): ${text}`);
  }
}

// ---------------------------------------------------------------------------
// ensureRowIds
// ---------------------------------------------------------------------------

/**
 * Idempotent migration: ensures a `row_id` column exists and every data row
 * that has content has a unique row_id.
 *
 * - If `row_id` header doesn't exist → append it as a new rightmost column.
 * - For every data row with any non-empty cell but no row_id → write `r<padded-index>`.
 * - Rows that already have a row_id are untouched.
 */
export async function ensureRowIds(token: string, sheetId: string): Promise<void> {
  const rows = await sheetsGet(token, sheetId, READ_RANGE);
  if (rows.length === 0) return; // Empty sheet — nothing to do

  const headerRow = rows[0];

  // Find or determine row_id column
  let rowIdColIdx = headerRow.findIndex((h) => h.trim() === "row_id");
  let rowIdColLetter: string;

  if (rowIdColIdx === -1) {
    // Append row_id header to the right of existing columns
    rowIdColIdx = headerRow.length; // next empty column (0-based)
    rowIdColLetter = colLetter(rowIdColIdx);
    const headerCell = `${TAB}!${rowIdColLetter}1`;
    await sheetsPut(token, sheetId, headerCell, "row_id");
  } else {
    rowIdColLetter = colLetter(rowIdColIdx);
  }

  const titleColIdx = headerRow.findIndex((h) => h.trim() === "video_title");

  // Counter for row_ids — pad to 4 digits
  let counter = 1;
  // Pre-scan existing ids to initialise counter past them
  for (let i = 1; i < rows.length; i++) {
    const existing = rows[i][rowIdColIdx] ?? "";
    if (existing.trim() !== "") {
      // Parse numeric suffix if it matches r\d+
      const m = existing.match(/^r(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n >= counter) counter = n + 1;
      }
    }
  }

  // Write row_ids for rows that need them
  for (let i = 1; i < rows.length; i++) {
    const dataRow = rows[i];
    // A real video must have a title — skip stray/blank rows so they don't get IDs.
    const title = titleColIdx === -1 ? "" : (dataRow[titleColIdx] ?? "").trim();
    if (title === "") continue;

    const existingId = (dataRow[rowIdColIdx] ?? "").trim();
    if (existingId !== "") continue; // Already has a row_id

    const newId = `r${String(counter).padStart(4, "0")}`;
    counter++;
    const targetCell = `${TAB}!${rowIdColLetter}${i + 1}`; // +1 because rows are 1-indexed in A1
    await sheetsPut(token, sheetId, targetCell, newId);
  }
}

// ---------------------------------------------------------------------------
// ensureColumns
// ---------------------------------------------------------------------------

/**
 * Idempotent migration: ensure every column in COLUMNS has a header in the
 * Master tab. Missing headers are appended as new rightmost columns (existing
 * data is never shifted — all I/O is keyed by header name, so physical order is
 * irrelevant). Returns the list of headers that were added.
 */
export async function ensureColumns(token: string, sheetId: string): Promise<string[]> {
  const raw = await sheetsGet(token, sheetId, READ_RANGE);
  const header = (raw[0] ?? []).map((h) => h.trim());
  const present = new Set(header.filter(Boolean));
  const missing = (COLUMNS as readonly string[]).filter((c) => !present.has(c));
  let nextIdx = header.length;
  for (const col of missing) {
    const cell = `${TAB}!${colLetter(nextIdx)}1`;
    await sheetsPut(token, sheetId, cell, col);
    nextIdx++;
  }
  return missing;
}

// ---------------------------------------------------------------------------
// readRows
// ---------------------------------------------------------------------------

/**
 * Read the Master tab using the schema-derived READ_RANGE, map headers → values.
 * Returns one Row per data row; skips fully-empty rows and columns with blank headers.
 */
export async function readRows(token: string, sheetId: string): Promise<Row[]> {
  const raw = await sheetsGet(token, sheetId, READ_RANGE);
  if (raw.length < 2) return [];

  const headerRow = raw[0];

  // Build a mapping: colIndex → Column name (only known COLUMNS + non-blank headers)
  const colMap: Array<{ idx: number; name: Column }> = [];
  let titleColIdx = -1;
  for (let i = 0; i < headerRow.length; i++) {
    const h = headerRow[i].trim();
    if (h === "") continue;
    if (h === "video_title") titleColIdx = i;
    if ((COLUMNS as readonly string[]).includes(h)) {
      colMap.push({ idx: i, name: h as Column });
    }
  }

  const result: Row[] = [];
  for (let i = 1; i < raw.length; i++) {
    const dataRow = raw[i];
    // A real video must have a title — skip stray/blank rows entirely.
    const title = titleColIdx === -1 ? "" : (dataRow[titleColIdx] ?? "").trim();
    if (title === "") continue;

    const row: Row = {};
    for (const { idx, name } of colMap) {
      row[name] = dataRow[idx] ?? "";
    }
    result.push(row);
  }

  return result;
}

// ---------------------------------------------------------------------------
// updateCell
// ---------------------------------------------------------------------------

/** Thrown by updateCell when an optimistic-concurrency `expected` check fails. */
export class ConflictError extends Error {
  constructor(public readonly current: string, public readonly expected: string) {
    super("conflict: the value changed since you last loaded it");
    this.name = "ConflictError";
  }
}

/**
 * Update a single cell identified by (rowId, col).
 * Re-reads the sheet to locate the exact A1 cell, then PUTs the new value.
 * Throws a clear Error if rowId or col is not found.
 *
 * Optimistic concurrency: if `expected` is provided, the FRESH cell value (read
 * here, not from any cache) must equal it, otherwise a ConflictError is thrown
 * and nothing is written. This prevents two people clobbering each other.
 */
export async function updateCell(
  token: string,
  sheetId: string,
  rowId: string,
  col: Column,
  value: string,
  expected?: string,
): Promise<void> {
  const raw = await sheetsGet(token, sheetId, READ_RANGE);
  if (raw.length < 1) throw new Error("Sheet is empty");

  const headerRow = raw[0];

  // Find the column index for `col`
  const colIdx = headerRow.findIndex((h) => h.trim() === col);
  if (colIdx === -1) throw new Error(`Column "${col}" not found in sheet header`);

  // Find the row_id column index
  const rowIdColIdx = headerRow.findIndex((h) => h.trim() === "row_id");
  if (rowIdColIdx === -1) throw new Error(`"row_id" column not found — run ensureRowIds first`);

  // Find the data row by rowId
  let targetRowNum: number | null = null;
  let targetRowArr: string[] | null = null;
  for (let i = 1; i < raw.length; i++) {
    const cellId = (raw[i][rowIdColIdx] ?? "").trim();
    if (cellId === rowId) {
      targetRowNum = i + 1; // 1-indexed sheet row number (header is row 1)
      targetRowArr = raw[i];
      break;
    }
  }
  if (targetRowNum === null || targetRowArr === null) throw new Error(`Row with row_id "${rowId}" not found`);

  if (expected !== undefined) {
    const current = (targetRowArr[colIdx] ?? "").trim();
    if (current !== expected.trim()) throw new ConflictError(current, expected);
  }

  const cell = `${TAB}!${colLetter(colIdx)}${targetRowNum}`;
  await sheetsPut(token, sheetId, cell, value);
}

// ---------------------------------------------------------------------------
// updateCells — one read + one batched write for several cells of a row
// ---------------------------------------------------------------------------

/**
 * Write multiple cells of the row identified by `rowId` in a SINGLE read + a
 * SINGLE batched write, and stamp `last_updated` automatically. This replaces
 * doing updateCell()+touchRow() (two full-sheet reads + two writes) per action.
 *
 * Optional optimistic concurrency: if `expected` is given, that column's FRESH
 * value must equal it, else a ConflictError is thrown and nothing is written.
 */
export async function updateCells(
  token: string,
  sheetId: string,
  rowId: string,
  values: Partial<Record<Column, string>>,
  expected?: { col: Column; value: string },
): Promise<void> {
  const raw = await sheetsGet(token, sheetId, READ_RANGE);
  if (raw.length < 1) throw new Error("Sheet is empty");
  const header = raw[0].map((h) => h.trim());

  const rowIdColIdx = header.indexOf("row_id");
  if (rowIdColIdx === -1) throw new Error(`"row_id" column not found — run ensureRowIds first`);

  let targetRowNum: number | null = null;
  let targetRowArr: string[] | null = null;
  for (let i = 1; i < raw.length; i++) {
    if ((raw[i][rowIdColIdx] ?? "").trim() === rowId) {
      targetRowNum = i + 1; targetRowArr = raw[i]; break;
    }
  }
  if (targetRowNum === null || targetRowArr === null) throw new Error(`Row with row_id "${rowId}" not found`);

  if (expected !== undefined) {
    const ci = header.indexOf(expected.col);
    if (ci === -1) throw new Error(`Column "${expected.col}" not found in sheet header`);
    const current = (targetRowArr[ci] ?? "").trim();
    if (current !== expected.value.trim()) throw new ConflictError(current, expected.value);
  }

  const data: { range: string; values: string[][] }[] = [];
  for (const [col, val] of Object.entries(values)) {
    const ci = header.indexOf(col);
    if (ci === -1) throw new Error(`Column "${col}" not found in sheet header`);
    data.push({ range: `${TAB}!${colLetter(ci)}${targetRowNum}`, values: [[val ?? ""]] });
  }
  // Auto-stamp last_updated (skip silently if the column isn't present).
  const luIdx = header.indexOf("last_updated");
  if (luIdx !== -1 && !("last_updated" in values)) {
    data.push({ range: `${TAB}!${colLetter(luIdx)}${targetRowNum}`, values: [[new Date().toISOString()]] });
  }
  if (data.length === 0) return;

  const url = `${SHEETS_BASE}/${sheetId}/values:batchUpdate`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }),
  });
  if (!resp.ok) throw new Error(`Sheets batchUpdate failed (${resp.status}): ${await resp.text()}`);
}

// ---------------------------------------------------------------------------
// touchRow
// ---------------------------------------------------------------------------

/**
 * Best-effort: write the current ISO timestamp into the `last_updated` cell for
 * the given rowId. If the `last_updated` header isn't found in the sheet, this
 * is a silent no-op — it never throws.
 *
 * Call immediately after a successful updateCell to timestamp the mutation.
 */
export async function touchRow(
  token: string,
  sheetId: string,
  rowId: string,
): Promise<void> {
  const raw = await sheetsGet(token, sheetId, READ_RANGE);
  if (raw.length < 1) return;

  const headerRow = raw[0];

  // Locate last_updated column — no-op if not present
  const colIdx = headerRow.findIndex((h) => h.trim() === "last_updated");
  if (colIdx === -1) return;

  // Locate row_id column
  const rowIdColIdx = headerRow.findIndex((h) => h.trim() === "row_id");
  if (rowIdColIdx === -1) return;

  // Find the target data row
  let targetRowNum: number | null = null;
  for (let i = 1; i < raw.length; i++) {
    if ((raw[i][rowIdColIdx] ?? "").trim() === rowId) {
      targetRowNum = i + 1; // 1-indexed
      break;
    }
  }
  if (targetRowNum === null) return;

  const cell = `${TAB}!${colLetter(colIdx)}${targetRowNum}`;
  await sheetsPut(token, sheetId, cell, new Date().toISOString());
}

// ---------------------------------------------------------------------------
// appendRow
// ---------------------------------------------------------------------------

/** Compute the next r#### id by scanning existing row_ids. */
function nextRowId(rows: string[][], rowIdColIdx: number): string {
  let counter = 1;
  for (let i = 1; i < rows.length; i++) {
    const m = (rows[i][rowIdColIdx] ?? "").trim().match(/^r(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= counter) counter = n + 1;
    }
  }
  return `r${String(counter).padStart(4, "0")}`;
}

/**
 * Append a new Master row. `values` maps known Column → value; missing columns are blank.
 * Generates and returns the new row_id. Stamps last_updated.
 */
export async function appendRow(
  token: string,
  sheetId: string,
  values: Partial<Record<Column, string>>,
): Promise<string> {
  const raw = await sheetsGet(token, sheetId, READ_RANGE);
  if (raw.length < 1) throw new Error("Sheet has no header row");
  const header = raw[0].map((h) => h.trim());

  const rowIdColIdx = header.indexOf("row_id");
  if (rowIdColIdx === -1) throw new Error('"row_id" column not found — run ensureRowIds first');

  const rowId = nextRowId(raw, rowIdColIdx);
  const full: Record<string, string> = {
    ...values,
    row_id: rowId,
    last_updated: new Date().toISOString(),
  };

  // Build a row array aligned to the sheet header order.
  const rowArray = header.map((h) => full[h] ?? "");

  const range = `${TAB}!A1`;
  const url =
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}:append` +
    `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [rowArray] }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Sheets append failed (${resp.status}): ${text}`);
  }
  return rowId;
}

// ---------------------------------------------------------------------------
// deleteRowById
// ---------------------------------------------------------------------------

/** Resolve a tab's numeric gridId (needed for structural batchUpdate requests). */
async function getTabGridId(token: string, sheetId: string, tabName: string): Promise<number> {
  const url = `${SHEETS_BASE}/${sheetId}?fields=sheets.properties(sheetId,title)`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Sheets get-meta failed (${resp.status}): ${text}`);
  }
  const json = (await resp.json()) as {
    sheets?: { properties?: { sheetId?: number; title?: string } }[];
  };
  const found = json.sheets?.find((s) => s.properties?.title === tabName);
  if (!found?.properties || found.properties.sheetId == null) {
    throw new Error(`Tab "${tabName}" not found`);
  }
  return found.properties.sheetId;
}

/**
 * Delete the entire Master row whose row_id matches. Removes the row (shifts
 * the rows below up), not just clears it. Throws if the row_id isn't found.
 */
export async function deleteRowById(
  token: string,
  sheetId: string,
  rowId: string,
): Promise<void> {
  const raw = await sheetsGet(token, sheetId, READ_RANGE);
  if (raw.length < 1) throw new Error("Sheet is empty");

  const rowIdColIdx = raw[0].findIndex((h) => h.trim() === "row_id");
  if (rowIdColIdx === -1) throw new Error('"row_id" column not found');

  let targetRowNum: number | null = null;
  for (let i = 1; i < raw.length; i++) {
    if ((raw[i][rowIdColIdx] ?? "").trim() === rowId) {
      targetRowNum = i + 1; // 1-indexed sheet row number (header is row 1)
      break;
    }
  }
  if (targetRowNum === null) throw new Error(`Row with row_id "${rowId}" not found`);

  const gridId = await getTabGridId(token, sheetId, TAB);
  const url = `${SHEETS_BASE}/${sheetId}:batchUpdate`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: gridId,
              dimension: "ROWS",
              startIndex: targetRowNum - 1, // 0-based, inclusive
              endIndex: targetRowNum, // exclusive → deletes exactly one row
            },
          },
        },
      ],
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Sheets delete-row failed (${resp.status}): ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Employes tab (team) writes — columns A=Name, B=Email, C=Role
// ---------------------------------------------------------------------------

const EMPLOYES_TAB = "Employes";

/** Upsert a teammate by email (case-insensitive): update Name+Role if present, else append. */
export async function upsertEmployee(
  token: string,
  sheetId: string,
  name: string,
  email: string,
  roleCell: string,
): Promise<"updated" | "added"> {
  const raw = await sheetsGet(token, sheetId, `${EMPLOYES_TAB}!A1:C999`);
  const target = email.trim().toLowerCase();
  for (let i = 1; i < raw.length; i++) {
    if ((raw[i]?.[1] ?? "").trim().toLowerCase() === target) {
      const range = `${EMPLOYES_TAB}!A${i + 1}:C${i + 1}`;
      const url = `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
      const resp = await fetch(url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [[name, email, roleCell]] }),
      });
      if (!resp.ok) throw new Error(`Sheets team update failed (${resp.status}): ${await resp.text()}`);
      return "updated";
    }
  }
  const appendUrl =
    `${SHEETS_BASE}/${sheetId}/values/${encodeURIComponent(`${EMPLOYES_TAB}!A1`)}:append` +
    `?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const resp = await fetch(appendUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ values: [[name, email, roleCell]] }),
  });
  if (!resp.ok) throw new Error(`Sheets team append failed (${resp.status}): ${await resp.text()}`);
  return "added";
}

/** Remove a teammate from the Employes tab (matched by email). Returns true if a row was deleted. */
export async function deleteEmployee(token: string, sheetId: string, email: string): Promise<boolean> {
  const raw = await sheetsGet(token, sheetId, `${EMPLOYES_TAB}!A1:C999`);
  const target = email.trim().toLowerCase();
  for (let i = 1; i < raw.length; i++) {
    if ((raw[i]?.[1] ?? "").trim().toLowerCase() === target) {
      const gridId = await getTabGridId(token, sheetId, EMPLOYES_TAB);
      const url = `${SHEETS_BASE}/${sheetId}:batchUpdate`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            { deleteDimension: { range: { sheetId: gridId, dimension: "ROWS", startIndex: i, endIndex: i + 1 } } },
          ],
        }),
      });
      if (!resp.ok) throw new Error(`Sheets team delete failed (${resp.status}): ${await resp.text()}`);
      return true;
    }
  }
  return false;
}

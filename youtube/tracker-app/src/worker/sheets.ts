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

async function sheetsGet(token: string, sheetId: string, range: string): Promise<string[][]> {
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
    // Check if row has any non-empty cell
    const hasContent = dataRow.some((cell) => cell.trim() !== "");
    if (!hasContent) continue;

    const existingId = (dataRow[rowIdColIdx] ?? "").trim();
    if (existingId !== "") continue; // Already has a row_id

    const newId = `r${String(counter).padStart(4, "0")}`;
    counter++;
    const targetCell = `${TAB}!${rowIdColLetter}${i + 1}`; // +1 because rows are 1-indexed in A1
    await sheetsPut(token, sheetId, targetCell, newId);
  }
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
  for (let i = 0; i < headerRow.length; i++) {
    const h = headerRow[i].trim();
    if (h === "") continue;
    if ((COLUMNS as readonly string[]).includes(h)) {
      colMap.push({ idx: i, name: h as Column });
    }
  }

  const result: Row[] = [];
  for (let i = 1; i < raw.length; i++) {
    const dataRow = raw[i];
    // Skip fully-empty rows
    if (!dataRow.some((cell) => cell.trim() !== "")) continue;

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

/**
 * Update a single cell identified by (rowId, col).
 * Re-reads the sheet to locate the exact A1 cell, then PUTs the new value.
 * Throws a clear Error if rowId or col is not found.
 */
export async function updateCell(
  token: string,
  sheetId: string,
  rowId: string,
  col: Column,
  value: string,
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
  for (let i = 1; i < raw.length; i++) {
    const cellId = (raw[i][rowIdColIdx] ?? "").trim();
    if (cellId === rowId) {
      targetRowNum = i + 1; // 1-indexed sheet row number (header is row 1)
      break;
    }
  }
  if (targetRowNum === null) throw new Error(`Row with row_id "${rowId}" not found`);

  const cell = `${TAB}!${colLetter(colIdx)}${targetRowNum}`;
  await sheetsPut(token, sheetId, cell, value);
}

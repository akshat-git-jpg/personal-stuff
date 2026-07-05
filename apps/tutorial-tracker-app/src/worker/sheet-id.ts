/** Extract the spreadsheet id from a full Google Sheets URL (or pass through a bare id). */
export function extractSheetId(urlOrId: string): string {
  const m = urlOrId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : urlOrId.trim();
}

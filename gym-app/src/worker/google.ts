// Thin Google Sheets REST client for the Worker.
// Auth: exchange the long-lived OAuth refresh token for a short-lived access
// token, cached in the isolate until shortly before expiry.

export interface Env {
  ASSETS: Fetcher;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REFRESH_TOKEN: string;
  SHEET_ID: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function getAccessToken(env: Env): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.value;
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: env.GOOGLE_REFRESH_TOKEN,
  });
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) {
    throw new Error(`token refresh failed: ${resp.status} ${await resp.text()}`);
  }
  const json = (await resp.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };
  return json.access_token;
}

async function sheetsFetch(env: Env, path: string, init?: RequestInit): Promise<any> {
  const token = await getAccessToken(env);
  const resp = await fetch(`${SHEETS_BASE}/${env.SHEET_ID}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!resp.ok) {
    throw new Error(`sheets ${path} -> ${resp.status} ${await resp.text()}`);
  }
  return resp.json();
}

const enc = (range: string) => encodeURIComponent(range);

/** Read a value range; returns a 2D array of strings (missing cells -> ""). */
export async function valuesGet(env: Env, range: string): Promise<string[][]> {
  const data = await sheetsFetch(env, `/values/${enc(range)}?majorDimension=ROWS`);
  return (data.values ?? []) as string[][];
}

/** Read many ranges in one request. Returns results in the same order. */
export async function valuesBatchGet(env: Env, ranges: string[]): Promise<string[][][]> {
  const qs = ranges.map((r) => `ranges=${enc(r)}`).join("&");
  const data = await sheetsFetch(env, `/values:batchGet?${qs}&majorDimension=ROWS`);
  return (data.valueRanges ?? []).map((vr: any) => (vr.values ?? []) as string[][]);
}

/** Overwrite a value range (RAW input). */
export async function valuesUpdate(env: Env, range: string, values: any[][]): Promise<void> {
  await sheetsFetch(env, `/values/${enc(range)}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
  });
}

/** Append rows after the last row of a range (RAW input). */
export async function valuesAppend(env: Env, range: string, values: any[][]): Promise<void> {
  await sheetsFetch(
    env,
    `/values/${enc(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      body: JSON.stringify({ range, majorDimension: "ROWS", values }),
    },
  );
}

/** Clear a value range. */
export async function valuesClear(env: Env, range: string): Promise<void> {
  await sheetsFetch(env, `/values/${enc(range)}:clear`, { method: "POST", body: "{}" });
}

export interface SheetMeta {
  title: string;
  sheetId: number;
  rowCount: number;
  colCount: number;
}

/** List all tabs with their grid dimensions. */
export async function getTabs(env: Env): Promise<SheetMeta[]> {
  const data = await sheetsFetch(
    env,
    `?fields=${enc("sheets(properties(title,sheetId,gridProperties(rowCount,columnCount)))")}`,
  );
  return (data.sheets ?? []).map((s: any) => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId,
    rowCount: s.properties.gridProperties?.rowCount ?? 0,
    colCount: s.properties.gridProperties?.columnCount ?? 0,
  }));
}

/** Create a new tab; returns its sheetId. No-op-safe if it already exists. */
export async function addTab(env: Env, title: string): Promise<void> {
  await sheetsFetch(env, ":batchUpdate", {
    method: "POST",
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
  });
}

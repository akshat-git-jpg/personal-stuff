/**
 * migrate-keys.mjs
 * Emits the ordered statements that make the canonical registry key the primary
 * key in clicks-db and in yt-script-desk. The planners are PURE — they emit SQL,
 * they never execute it.
 *
 * Design: docs/specs/2026-08-25-video-identity-design.md §4.4.
 *
 * WHY THE ORDER IS LOAD-BEARING
 * clicks-db has exactly one foreign key: links.video_code -> videos.video_code.
 * Insert-then-repoint-then-delete keeps it satisfied at every step:
 *   1. INSERT the new videos row    -> both old and new exist; links still valid
 *   2. UPDATE links to the new code -> target row already exists; valid
 *   3. DELETE the old videos row    -> nothing references it now; valid
 * Any other order transiently violates the constraint. Do not reorder, and do
 * not "fix" it with PRAGMA foreign_keys / defer_foreign_keys — the order is
 * chosen precisely so no pragma is needed.
 */

// Committed in apps/redirector/wrangler.toml and apps/yt-script-desk/wrangler.toml,
// so neither id is a secret.
export const CLICKS_DB_ID = "3415a408-ccc9-49e2-8fe1-60009dfd83ce";
export const DESK_DB_ID = "6e2263df-96c9-4803-985b-89c0957da787";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

/**
 * @param pairs [{ oldCode, newKey }] for clicks-db
 * @returns [{ sql, params, why }] in the order they must run
 */
export function planClicksDb(pairs) {
  const stmts = [];
  for (const { oldCode, newKey } of pairs) {
    if (!oldCode || !newKey) throw new Error("planClicksDb: oldCode and newKey are required");
    if (oldCode === newKey) continue;                      // already canonical
    // 1. INSERT the new row (copy every column, new primary key)
    stmts.push({
      sql: "INSERT INTO videos (video_code, video_title, created_at, yt_id) " +
           "SELECT ?, video_title, created_at, yt_id FROM videos WHERE video_code = ?",
      params: [newKey, oldCode],
      why: "new row must exist before links can point at it",
    });
    // 2. REPOINT the child rows
    stmts.push({
      sql: "UPDATE links SET video_code = ? WHERE video_code = ?",
      params: [newKey, oldCode],
      why: "insert must precede the links update, or the FK is transiently violated",
    });
    // 3. DELETE the old row, now unreferenced
    stmts.push({
      sql: "DELETE FROM videos WHERE video_code = ?",
      params: [oldCode],
      why: "safe only after every link has been repointed",
    });
  }
  return stmts;
}

/**
 * The desk declares NO foreign keys, so plain updates are safe in any order.
 * token is never touched — shared desk links resolve by it.
 * @param pairs [{ oldKey, newKey }]
 */
export function planDesk(pairs) {
  const stmts = [];
  for (const { oldKey, newKey } of pairs) {
    if (!oldKey || !newKey) throw new Error("planDesk: oldKey and newKey are required");
    if (oldKey === newKey) continue;
    stmts.push({ sql: "UPDATE videos SET key = ? WHERE key = ?", params: [newKey, oldKey], why: "desk primary key" });
    stmts.push({ sql: "UPDATE answers SET video_key = ? WHERE video_key = ?", params: [newKey, oldKey], why: "answers child rows" });
    stmts.push({ sql: "UPDATE say_edits SET video_key = ? WHERE video_key = ?", params: [newKey, oldKey], why: "say_edits child rows" });
  }
  return stmts;
}

/** The counts that must be identical before and after. */
export const INVARIANT_QUERIES = [
  { label: "clicks rows (must never change)", sql: "SELECT COUNT(*) AS n FROM clicks" },
  { label: "links rows", sql: "SELECT COUNT(*) AS n FROM links" },
  { label: "distinct link slugs (published URLs)", sql: "SELECT COUNT(DISTINCT slug) AS n FROM links" },
  { label: "videos rows", sql: "SELECT COUNT(*) AS n FROM videos" },
];

/**
 * Compare the invariant counts taken before and after an apply. PURE.
 *
 * boss runs `--apply` unattended, so this comparison is the only thing standing
 * between a bad mapping and the click history. Any drift — including a label
 * that went missing — is a violation, and the caller must exit non-zero.
 *
 * @param before {label: number}
 * @param after  {label: number}
 * @returns [{ label, before, after }] — empty means every count held
 */
export function diffInvariants(before, after) {
  const violations = [];
  for (const { label } of INVARIANT_QUERIES) {
    const b = before?.[label];
    const a = after?.[label];
    if (typeof b !== "number" || typeof a !== "number") {
      violations.push({ label, before: b ?? null, after: a ?? null });
      continue;
    }
    if (b !== a) violations.push({ label, before: b, after: a });
  }
  return violations;
}

/**
 * Refuse a pair list where two different old codes claim one new key. PURE.
 * That means two `videos` rows claim one video; merging them would merge click
 * history, which is irreversible. Report it, never merge.
 *
 * @param pairs [{ oldCode, newKey }] or [{ oldKey, newKey }]
 * @returns [{ newKey, olds: [...] }] — empty means the mapping is one-to-one
 */
export function findCollisions(pairs) {
  const byNew = new Map();
  for (const p of pairs) {
    const old = p.oldCode ?? p.oldKey;
    if (!byNew.has(p.newKey)) byNew.set(p.newKey, new Set());
    byNew.get(p.newKey).add(old);
  }
  const out = [];
  for (const [newKey, olds] of byNew) {
    if (olds.size > 1) out.push({ newKey, olds: [...olds].sort() });
  }
  return out;
}

/** Run one statement against a D1 database over the REST API. */
export async function queryD1(databaseId, sql, params = [], fetchImpl = fetch, env = process.env) {
  const account = env.CF_ACCOUNT_ID;
  const token = env.CF_API_TOKEN;
  if (!account || !token) {
    throw new Error("CF_ACCOUNT_ID and CF_API_TOKEN must be set (see pipelines/.env.example)");
  }
  const url = `${CF_API_BASE}/accounts/${account}/d1/database/${databaseId}/query`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  if (!res.ok) throw new Error(`D1 query failed: HTTP ${res.status} (${sql})`);
  const body = await res.json();
  if (!body.success) throw new Error(`D1 query failed: ${JSON.stringify(body.errors)} (${sql})`);
  return body.result?.[0]?.results ?? [];
}

/** Read every invariant count from clicks-db. */
export async function readInvariants(fetchImpl = fetch, env = process.env) {
  const counts = {};
  for (const q of INVARIANT_QUERIES) {
    const rows = await queryD1(CLICKS_DB_ID, q.sql, [], fetchImpl, env);
    counts[q.label] = Number(rows?.[0]?.n ?? NaN);
  }
  return counts;
}

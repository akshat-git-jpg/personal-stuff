/**
 * tracker.mjs
 * Seeds the registry from tracker-db. The tracker mints a video's slug at card
 * creation (see apps/tutorial-tracker-app/src/shared/slug.ts); a Worker cannot
 * write to this repo, so this carries it across.
 *
 * Design: docs/specs/2026-08-25-video-identity-design.md §4.2.
 */

// tracker-db. Committed in apps/tutorial-tracker-app/wrangler.toml, so not a secret.
export const TRACKER_DB_ID = "1562469d-ffd1-4cc2-b9f7-7095b84128ad";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

/**
 * Decide what a sync would change. PURE — no I/O, no clock, no network.
 *
 * @param rows     [{ id, slug, title }] from tracker-db
 * @param registry the parsed videos.json object
 * @param today    ISO date string used as `minted` for new entries
 * @returns { mints: [{key,title,card_id}], stamps: [{key,card_id}], skipped: [{reason,id}] }
 */
export function planSync(rows, registry, today) {
  const mints = [], stamps = [], skipped = [];
  const known = registry.videos ?? {};

  // Every name already resolvable: a key, or any alias of a key.
  const resolvable = new Map();
  for (const [key, entry] of Object.entries(known)) {
    resolvable.set(key, key);
    for (const a of entry.aliases ?? []) resolvable.set(a, key);
  }

  for (const row of rows) {
    if (!row.slug) continue;                 // a card with no slug is not an error
    const existing = resolvable.get(row.slug);
    if (existing) {
      const entry = known[existing];
      if (!entry.card_id && row.id) stamps.push({ key: existing, card_id: row.id });
      else if (entry.card_id && row.id && entry.card_id !== row.id) {
        skipped.push({ reason: "card_id conflict", id: row.id, key: existing });
      }
      continue;
    }
    mints.push({ key: row.slug, title: row.title ?? "", card_id: row.id, minted: today });
  }
  return { mints, stamps, skipped };
}

/** Read every card that has a slug. Read-only. */
export async function fetchCards(fetchImpl = fetch, env = process.env) {
  const account = env.CF_ACCOUNT_ID;
  const token = env.CF_API_TOKEN;
  if (!account || !token) {
    throw new Error("CF_ACCOUNT_ID and CF_API_TOKEN must be set (see pipelines/.env.example)");
  }
  const url = `${CF_API_BASE}/accounts/${account}/d1/database/${TRACKER_DB_ID}/query`;
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      sql: "SELECT id, slug, title FROM cards WHERE slug IS NOT NULL ORDER BY id",
    }),
  });
  if (!res.ok) throw new Error(`tracker-db query failed: HTTP ${res.status}`);
  const body = await res.json();
  if (!body.success) throw new Error(`tracker-db query failed: ${JSON.stringify(body.errors)}`);
  return body.result?.[0]?.results ?? [];
}

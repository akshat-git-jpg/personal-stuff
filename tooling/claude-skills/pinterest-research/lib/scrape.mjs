// scrape.mjs — pure helpers for turning Pinterest's internal JSON blobs into ranked pin records.
// No Playwright here; this is data-shaping only so it's easy to reason about & reuse.

// Deep-walk ANY parsed JSON (initial page state or an XHR response) and collect every
// object that looks like a Pinterest pin. Path-agnostic on purpose — Pinterest reshapes its
// store often, but a "pin" always has a numeric string id + images + pin-ish fields.
export function collectPins(root, out = new Map(), depth = 0) {
  if (!root || typeof root !== "object" || depth > 12) return out;
  if (Array.isArray(root)) {
    for (const v of root) collectPins(v, out, depth + 1);
    return out;
  }
  const isPin =
    typeof root.id === "string" &&
    /^\d{5,}$/.test(root.id) &&
    (root.images || root.image_large_url) &&
    ("grid_title" in root || "repin_count" in root || "description" in root || "pinner" in root);
  if (isPin && !out.has(root.id)) out.set(root.id, root);
  for (const k in root) {
    const v = root[k];
    if (v && typeof v === "object") collectPins(v, out, depth + 1);
  }
  return out;
}

const num = (x) => (typeof x === "number" && isFinite(x) ? x : 0);

function pinImage(p) {
  const im = p.images || {};
  return (
    (im.orig || im["736x"] || im["600x"] || im["474x"] || im["236x"] || {}).url ||
    p.image_large_url ||
    p.image_medium_url ||
    ""
  );
}

function reactionTotal(p) {
  if (p.reaction_counts && typeof p.reaction_counts === "object") {
    return Object.values(p.reaction_counts).reduce((a, b) => a + num(b), 0);
  }
  return num(p.total_reaction_count);
}

// Turn a raw pin object into a compact, scored record.
export function toRecord(p, now = Date.now()) {
  const saves =
    num(p.repin_count) ||
    num(p.aggregated_pin_data && p.aggregated_pin_data.aggregated_stats && p.aggregated_pin_data.aggregated_stats.saves);
  const comments =
    num(p.comment_count) || num(p.aggregated_pin_data && p.aggregated_pin_data.comment_count);
  const created = p.created_at ? new Date(p.created_at) : null;
  const ageDays =
    created && !isNaN(created) ? Math.max(1, Math.round((now - created.getTime()) / 86400000)) : null;
  // "savesPerMonth" = velocity. A high-velocity pin is winning FAST = the real outlier signal.
  const savesPerMonth = ageDays ? Math.round((saves / ageDays) * 30) : saves;
  return {
    id: p.id,
    title: (p.grid_title || p.title || "").trim(),
    description: (p.description || "").trim().slice(0, 280),
    link: p.link || "",
    pinUrl: `https://www.pinterest.com/pin/${p.id}/`,
    image: pinImage(p),
    pinner: (p.pinner && (p.pinner.full_name || p.pinner.username)) || "",
    saves,
    comments,
    reactions: reactionTotal(p),
    ageDays,
    savesPerMonth,
  };
}

// Map of raw pins -> sorted, deduped records.
export function rankRecords(rawMap, now = Date.now()) {
  const recs = [...rawMap.values()].map((p) => toRecord(p, now));
  // Keep pins with a real title or a destination link (usable for research); drop empties.
  const usable = recs.filter((r) => r.title || r.link);
  usable.sort((a, b) => b.savesPerMonth - a.savesPerMonth);
  return usable;
}

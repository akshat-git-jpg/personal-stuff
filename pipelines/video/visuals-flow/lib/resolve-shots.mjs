import fs from 'node:fs';
import path from 'node:path';
import { normWord, findPhrase } from './resolve.mjs';
import { resolveWorkdir } from './workdir.mjs';
import { pathToFileURL } from 'node:url';
export const ENGINE_MODES = ['test', 'production'];
export const SNAP_EDGE = 1.5;

// Spans are matched with the same forward-cursor discipline as cues: each
// span's from_anchor is searched after the previous span's to_anchor, so
// repeated phrases resolve in transcript order.
export function resolveShots(shotsFile, words) {
  const W = words.map((x) => ({ ...x, n: normWord(x.text) })).filter((x) => x.n);
  const total = W.length > 0 ? W[W.length - 1].end : 0;
  const errors = [];
  const out = [];
  let cursor = 0;

  if (!ENGINE_MODES.includes(shotsFile.engineMode)) {
    errors.push(`engineMode "${shotsFile.engineMode}" invalid — must be one of: ${ENGINE_MODES.join(', ')}`);
  }
  // "production" (Avatar IV, metered) implemented 2026-08-01 on owner order —
  // heygen-web's generate-from-template grew --engine heygen4 and
  // avatar-render routes span jobs to it. It stays owner-flipped per video:
  // the mode is never a default, because it spends the monthly second-pool.

  const seen = new Set();
  for (const span of shotsFile.spans ?? []) {
    if (!span.id || seen.has(span.id)) { errors.push(`duplicate or missing span id: "${span.id}"`); continue; }
    seen.add(span.id);
    if (span.flagged) continue; // parked, same semantics as flagged cues
    // "purpose" renamed from "kind" 2026-07-31 (owner: confusable with "mode");
    // legacy "kind" still accepted so committed shots.json/llm snapshots resolve.
    const purpose = span.purpose ?? span.kind;
    if (purpose !== 'avatar-full') { errors.push(`${span.id}: unknown purpose "${purpose}" — only "avatar-full" exists today`); continue; }
    if (span.mode === undefined) { errors.push(`${span.id}: mode is required — must be "full" or "side" ("panel" is supported but not currently planned)`); continue; }
    const mode = span.mode;
    if (mode !== 'full' && mode !== 'panel' && mode !== 'side') { errors.push(`${span.id}: unknown mode "${span.mode}" — must be "full", "panel", or "side"`); continue; }
    const a = findPhrase(W, span.from_anchor ?? '', cursor);
    if (a.err) { errors.push(`${span.id} from_anchor: ${a.err}`); continue; }
    const b = findPhrase(W, span.to_anchor ?? '', a.idx + a.len);
    if (b.err) { errors.push(`${span.id} to_anchor: ${b.err}`); continue; }
    cursor = b.idx + b.len;
    let start = +a.start.toFixed(2);
    let end = +W[b.idx + b.len - 1].end.toFixed(2);
    let snapped = false;
    if (start < SNAP_EDGE) {
      start = 0;
      snapped = true;
    }
    if (total - end < SNAP_EDGE) {
      end = total;
      snapped = true;
    }
    const spanObj = {
      id: span.id, purpose, mode,
      start, end, duration: +(end - start).toFixed(2),
      note: span.note ?? '',
    };
    if (snapped) spanObj.snapped = true;
    out.push(spanObj);
  }
  return { spans: out, errors };
}


async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: node lib/resolve-shots.mjs <slug-or-path>');
    process.exit(1);
  }
  const workdir = resolveWorkdir(arg);
  const shotsFile = JSON.parse(fs.readFileSync(path.join(workdir, 'shots.json'), 'utf8'));
  const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));

  const { spans, errors } = resolveShots(shotsFile, words);
  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  fs.writeFileSync(
    path.join(workdir, 'shots.resolved.json'),
    JSON.stringify({
      video: shotsFile.video,
      offset: shotsFile.offset ?? 0,
      engineMode: shotsFile.engineMode,
      // Carried through so lint-shots' E8 intro-host gate can see it: the lint
      // reads shots.resolved.json, and a waiver written in shots.json that was
      // silently dropped here would look exactly like no waiver at all.
      ...(shotsFile.intro_host_waived ? { intro_host_waived: shotsFile.intro_host_waived } : {}),
      spans,
    }, null, 2),
  );
}

// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is a backslash
// path, so naive string concatenation never matches import.meta.url.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

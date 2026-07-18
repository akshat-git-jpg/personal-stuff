import fs from 'node:fs';
import path from 'node:path';
import { normWord, findPhrase } from './resolve.mjs';

export const ENGINE_MODES = ['test', 'production'];

// Spans are matched with the same forward-cursor discipline as cues: each
// span's from_anchor is searched after the previous span's to_anchor, so
// repeated phrases resolve in transcript order.
export function resolveShots(shotsFile, words) {
  const W = words.map((x) => ({ ...x, n: normWord(x.text) })).filter((x) => x.n);
  const errors = [];
  const out = [];
  let cursor = 0;

  if (!ENGINE_MODES.includes(shotsFile.engineMode)) {
    errors.push(`engineMode "${shotsFile.engineMode}" invalid — must be one of: ${ENGINE_MODES.join(', ')}`);
  } else if (shotsFile.engineMode === 'production') {
    // heygen-web is Avatar III-only and its heygen4 path is an unimplemented
    // TODO (design doc 2026-07-18). The owner flips this explicitly, together
    // with the heygen-web work — until then production is an error, not a
    // dormant code path.
    errors.push('engineMode "production" is not implemented yet — keep "test" (see docs/specs/2026-07-18-avatar-shot-plan-design.md)');
  }

  const seen = new Set();
  for (const span of shotsFile.spans ?? []) {
    if (!span.id || seen.has(span.id)) { errors.push(`duplicate or missing span id: "${span.id}"`); continue; }
    seen.add(span.id);
    if (span.flagged) continue; // parked, same semantics as flagged cues
    if (span.kind !== 'avatar-full') { errors.push(`${span.id}: unknown kind "${span.kind}" — only "avatar-full" exists today`); continue; }
    const a = findPhrase(W, span.from_anchor ?? '', cursor);
    if (a.err) { errors.push(`${span.id} from_anchor: ${a.err}`); continue; }
    const b = findPhrase(W, span.to_anchor ?? '', a.idx + a.len);
    if (b.err) { errors.push(`${span.id} to_anchor: ${b.err}`); continue; }
    cursor = b.idx + b.len;
    const start = +a.start.toFixed(2);
    const end = +W[b.idx + b.len - 1].end.toFixed(2);
    out.push({
      id: span.id, kind: span.kind,
      start, end, duration: +(end - start).toFixed(2),
      note: span.note ?? '',
    });
  }
  return { spans: out, errors };
}

function resolveWorkdir(arg) {
  if (arg.includes('/') || fs.existsSync(arg)) return path.resolve(arg);
  const pipelineRoot = path.resolve(import.meta.dirname, '..');
  return path.join(pipelineRoot, 'videos', arg);
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
      spans,
    }, null, 2),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

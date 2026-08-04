import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// The owner records every video as three files. That IS the structure — the
// pipeline used to throw it away and re-guess it from transcript keywords.
// Order matters: it is the timeline order.
export const PARTS = ['intro', 'body', 'conclusion'];
export const REQUIRED_PARTS = ['intro', 'conclusion'];

export function probeDuration(file) {
  const res = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
  ], { encoding: 'utf8' });
  if (res.status !== 0) return null;
  const d = parseFloat((res.stdout || '').trim());
  return Number.isFinite(d) ? d : null;
}

// Returns { structure, errors, warnings }.
// structure: [{ part, start, end }] in timeline order, or [] when there is no
// src/ directory at all (a pre-convention workdir).
export function sourceStructure(workdir, { total = null, probe = probeDuration } = {}) {
  const errors = [];
  const warnings = [];
  const srcDir = path.join(workdir, 'src');

  if (!fs.existsSync(srcDir)) {
    warnings.push('no src/ directory — this workdir predates the intro/body/conclusion convention; structure is unavailable');
    return { structure: [], errors, warnings };
  }

  const present = {};
  for (const part of PARTS) {
    const f = path.join(srcDir, `${part}.mp4`);
    present[part] = fs.existsSync(f) ? f : null;
  }

  for (const part of REQUIRED_PARTS) {
    if (!present[part]) {
      errors.push(`src/${part}.mp4 is missing — every video must be recorded as intro.mp4 + body.mp4 + conclusion.mp4. A video with no ${part} cannot be cut.`);
    }
  }
  if (errors.length) return { structure: [], errors, warnings };

  const structure = [];
  let t = 0;
  for (const part of PARTS) {
    const f = present[part];
    if (!f) continue;
    const d = probe(f);
    if (d === null) {
      errors.push(`could not read the duration of src/${part}.mp4`);
      return { structure: [], errors, warnings };
    }
    structure.push({ part, start: +t.toFixed(3), end: +(t + d).toFixed(3) });
    t += d;
  }

  // A part that exists in the source but never reaches the cut is exactly how
  // test-03 shipped without its conclusion: the cut stopped at the length of
  // the screen recording and nobody was told.
  if (total !== null) {
    for (const s of structure) {
      if (s.start >= total) {
        warnings.push(`the ${s.part} (source ${s.start.toFixed(1)}s-${s.end.toFixed(1)}s) is entirely OUTSIDE this ${total.toFixed(1)}s cut — it was recorded but never used`);
      } else if (s.end > total + 0.5) {
        warnings.push(`the ${s.part} is truncated by this cut (source ends ${s.end.toFixed(1)}s, cut ends ${total.toFixed(1)}s)`);
      }
    }
  }

  return { structure, errors, warnings };
}

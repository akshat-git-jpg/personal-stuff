import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';


// Per-cue frame gate (plan 175). Probes every resolved cue's card with its
// REAL variables at its real beat times in a headless page, using plan 168's
// probe machinery from card-library. DOM overflow only — the accent check
// lives in render.mjs because the browser cannot reproduce render-only bugs.
async function loadProbe(cardLibraryRoot) {
  const mod = path.join(cardLibraryRoot, 'scripts', 'overflow-probe.mjs');
  return import(pathToFileURL(mod).href);
}

export function probeTimesForCue(cue) {
  const beats = Array.isArray(cue.variables?.beats) ? cue.variables.beats : [];
  const times = beats.map((b) => b.at).filter((t) => typeof t === 'number');
  const dur = typeof cue.duration === 'number' ? cue.duration : 6;
  times.push(Math.max(0.5, dur / 2), Math.max(0.5, dur - 1));
  return [...new Set(times.map((t) => +t.toFixed(2)))].sort((a, b) => a - b);
}

// Returns array of error strings (E12 …), empty when clean.
export async function frameGate(resolved, cardLibraryRoot, { only } = {}) {
  const probe = await loadProbe(cardLibraryRoot);
  const errors = [];
  try {
    for (const cue of resolved) {
      if (only && !only.includes(cue.id)) continue;
      const cardDir = path.join(cardLibraryRoot, cue.card);
      const vars = cue.variables ?? {};
      const times = probeTimesForCue(cue);
      const res = await probe.probeCardVariant(cardDir, vars.variant ?? 'a', vars, times);
      if (res.broken) {
        res.offenders = res.offenders.filter(o => o !== '#spotlight');
        if (res.offenders.length === 0) continue;

        errors.push(
          `E12 frame-gate: ${cue.id} (${cue.card}) overflows the canvas at t=${res.t}s ` +
          `with its real content — offenders: ${res.offenders.join(', ') || '(document scroll)'}`
        );
      }
    }
  } finally {
    await probe.closeBrowser();
  }
  return errors;
}

// Parse '#rrggbb' → [r,g,b]
const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// True when the frame contains at least `minPixels` pixels within ±tol per
// channel of accentHex. Reads the frame via ffmpeg rawvideo at 480x270 —
// dependency-free, ~50ms.
export function frameHasColor(framePath, accentHex, { tol = 36, minPixels = 25 } = {}) {
  const [ar, ag, ab] = hexRgb(accentHex);
  const buf = execSync(
    `ffmpeg -v error -i "${framePath}" -vf scale=480:270 -f rawvideo -pix_fmt rgb24 -`,
    { maxBuffer: 8 * 1024 * 1024 },
  );
  let hits = 0;
  for (let i = 0; i + 2 < buf.length; i += 3) {
    if (Math.abs(buf[i] - ar) <= tol && Math.abs(buf[i + 1] - ag) <= tol && Math.abs(buf[i + 2] - ab) <= tol) {
      if (++hits >= minPixels) return true;
    }
  }
  return false;
}

// Policy: a cue whose variables carry a non-empty string `accent` must show
// accent-colored pixels in the rendered output at its last beat (or midpoint
// when beatless). Returns null when clean, an error string otherwise.
export function checkAccentVisible(cue, outPath, accentHex) {
  const beats = Array.isArray(cue.variables?.beats) ? cue.variables.beats : [];
  const lastAt = beats.length ? Math.max(...beats.map((b) => b.at ?? 0)) : (cue.duration ?? 6) / 2;
  const t = Math.min(lastAt + 0.5, Math.max(0.2, (cue.duration ?? 6) - 0.3));
  const tmp = `${outPath}.accent-probe.png`;
  execSync(`ffmpeg -v error -y -ss ${t.toFixed(2)} -i "${outPath}" -frames:v 1 "${tmp}"`);
  try {
    if (!frameHasColor(tmp, accentHex)) {
      return `accent-gate: ${cue.id} (${cue.card}) declares accent "${cue.variables.accent}" but the rendered frame at t=${t.toFixed(2)}s contains no accent-colored pixels — render-only color loss (see TESTS.md 2026-07-31)`;
    }
    return null;
  } finally {
    execSync(`rm -f "${tmp}"`);
  }
}


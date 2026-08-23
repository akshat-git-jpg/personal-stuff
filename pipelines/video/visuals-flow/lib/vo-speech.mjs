// Where the voiceover ACTUALLY speaks, measured from vo.mp3 itself.
//
// Every other time in this pipeline comes from transcript.json, whose word times
// are a Groq/Whisper pass over the SCREEN RECORDING audio re-timed with
// alignScriptToWords. The HeyGen slices and the master clock are cut from
// vo.mp3. The two agree to a few hundred milliseconds, not to the frame — so a
// span end taken from a transcript word is not a fact about the audio.
//
// It cost a shipped video to learn that. On opusclip-vs-submagic the transcript
// put "Goodbye." at 1074.31-1074.83; acoustically the word runs 1074.889-1075.377.
// Span s10 resolved to end at 1074.83, avatar-render sliced vo.mp3 with
// `-ss start -to end`, and the word was never IN the driving audio — so the
// render could not say it, and no amount of sync work downstream could fix it.
// Measured across all ten spans, end drift ran -0.18s to +0.69s.
//
// Thresholds: -45dB over 0.20s. Verified 2026-08-22 against that video — it
// resolves the 0.24s breath before "Goodbye" as silence while keeping the word
// itself intact. Loosening either one merges the breath into the speech and the
// tail check stops being able to see the bug.
import { spawnSync } from 'node:child_process';

export const SILENCE_NOISE_DB = -45;
export const SILENCE_MIN = 0.20;

// ffmpeg emits `silence_start: X` and `silence_end: Y | silence_duration: Z`
// interleaved in stderr, in time order. Pair them positionally.
export function parseSilences(stderr) {
  const out = [];
  for (const m of String(stderr).matchAll(/silence_(start|end):\s*(-?[\d.]+)/g)) {
    const t = Number(m[2]);
    if (!Number.isFinite(t)) continue;
    if (m[1] === 'start') out.push({ start: t, end: Infinity });
    else if (out.length) out[out.length - 1].end = t;
  }
  return out;
}

// ffmpeg's header line, e.g. "  Duration: 00:17:56.35, start: 0.02, ...".
export function parseDuration(stderr) {
  const m = String(stderr).match(/Duration:\s*(\d+):(\d\d):(\d\d(?:\.\d+)?)/);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

// Speech is whatever is left of [0, duration] once the silences are removed.
// Zero-length gaps are dropped: two abutting silences are one silence, and a 0s
// "speech" interval would otherwise report a boundary where nothing is said.
export function speechFromSilences(silences, duration) {
  const out = [];
  let cursor = 0;
  for (const s of [...silences].sort((a, b) => a.start - b.start)) {
    if (s.start > cursor) out.push({ start: cursor, end: Math.min(s.start, duration) });
    cursor = Math.max(cursor, Math.min(s.end, duration));
  }
  if (cursor < duration) out.push({ start: cursor, end: duration });
  return out.filter((x) => x.end - x.start > 1e-9);
}

export function lastSpeechEnd(voSpeech) {
  const sp = voSpeech?.speech ?? [];
  return sp.length ? sp[sp.length - 1].end : null;
}

// `run` is injectable so the parsing above is testable without ffmpeg.
export function probeVoSpeech(voPath, {
  run = spawnSync, noiseDb = SILENCE_NOISE_DB, minSilence = SILENCE_MIN,
} = {}) {
  const args = [
    '-hide_banner', '-nostdin', '-i', voPath,
    '-af', `silencedetect=noise=${noiseDb}dB:d=${minSilence}`,
    '-f', 'null', '-',
  ];
  const res = run('ffmpeg', args, { encoding: 'utf8' });
  // A failed probe must never look like "no silence, all speech" — that would
  // silently pass the very gate this module exists to fail.
  if (!res || res.status !== 0) {
    throw new Error(`vo-speech probe failed for ${voPath}: ${(res?.stderr || '').slice(-400)}`);
  }
  const stderr = res.stderr || '';
  const silences = parseSilences(stderr);
  const duration = parseDuration(stderr)
    ?? silences.reduce((m, s) => Math.max(m, Number.isFinite(s.end) ? s.end : m), 0);
  return { duration, silences, speech: speechFromSilences(silences, duration) };
}

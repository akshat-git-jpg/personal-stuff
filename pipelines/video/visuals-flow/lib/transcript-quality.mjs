// Step 010 runs a real transcript-quality pass instead of shipping raw ASR
// punctuation: script-first alignment when videos/<slug>/script.txt exists,
// else an LLM cleanup pass (steps/010-transcribe-run/cleanup-prompt.md).
// Both must run BEFORE the cue pass — anchors quote the transcript verbatim,
// so a later text edit would silently break every anchor.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveWorkdir } from './workdir.mjs';
import { writeTranscriptDiff } from './transcript-diff.mjs';

// A cleaned transcript is only valid if every word still has a usable time span
// and the timeline never goes backwards. Captions are word-timed, so a cleanup
// that breaks this desyncs the whole video — a worse defect than the punctuation
// it set out to fix.
export function checkTimingIntegrity(before, after) {
  const errors = [];
  if (!Array.isArray(after) || after.length === 0) {
    errors.push('cleaned transcript is empty');
    return errors;
  }
  if (after.length > before.length) {
    errors.push(`cleaned transcript has MORE words (${after.length}) than the source (${before.length}) — cleanup may merge or drop, never invent`);
  }
  for (let i = 0; i < after.length; i++) {
    const w = after[i];
    if (typeof w.text !== 'string' || !w.text.trim()) errors.push(`word ${i}: empty text`);
    if (!Number.isFinite(w.start) || !Number.isFinite(w.end)) errors.push(`word ${i} ("${w.text}"): non-numeric start/end`);
    else if (w.end < w.start) errors.push(`word ${i} ("${w.text}"): end ${w.end} before start ${w.start}`);
    if (i > 0 && Number.isFinite(w.start) && Number.isFinite(after[i - 1].start) && w.start < after[i - 1].start) {
      errors.push(`word ${i} ("${w.text}"): starts ${w.start} before the previous word ${after[i - 1].start} — timeline went backwards`);
    }
  }
  const span = (a) => [Math.min(...a.map(w => w.start)), Math.max(...a.map(w => w.end))];
  const [b0, b1] = span(before);
  const [a0, a1] = span(after);
  if (a0 < b0 - 0.01 || a1 > b1 + 0.01) {
    errors.push(`cleaned transcript spans [${a0}, ${a1}] outside the source [${b0}, ${b1}]`);
  }
  return errors;
}

// Validates a cleanup-pass result against the source words and throws rather
// than let a broken transcript reach disk — a silently half-applied cleanup is
// worse than no cleanup at all.
export function applyCleanup(words, cleaned) {
  const errors = checkTimingIntegrity(words, cleaned);
  if (errors.length) {
    throw new Error(`cleanup rejected — timing integrity failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }
  return cleaned;
}

function normTok(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9']/g, '');
}

// Longest common subsequence between two normalised token streams, by index
// pair. O(n*m) DP — fine at transcript scale (hundreds to low thousands of
// words), and the two streams are near-identical so the walk stays cheap.
function lcsMatches(scriptNorm, asrNorm) {
  const n = scriptNorm.length;
  const m = asrNorm.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = scriptNorm[i] && scriptNorm[i] === asrNorm[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const matches = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (scriptNorm[i] && scriptNorm[i] === asrNorm[j]) {
      matches.push([i, j]);
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return matches;
}

// Walk the script and ASR token streams together. Matching tokens inherit the
// ASR word's timing; a run of unmatched script tokens is spread evenly across
// the time the corresponding ASR run occupied.
export function alignScriptToWords(scriptTokens, asrWords) {
  const asrNorm = asrWords.map(w => normTok(w.text));
  const scriptNorm = scriptTokens.map(normTok);
  const matches = lcsMatches(scriptNorm, asrNorm);

  const first = asrWords[0];
  const last = asrWords[asrWords.length - 1];
  const out = new Array(scriptTokens.length);

  // Virtual boundaries at both ends so the loop below also spreads any
  // unmatched run that opens or closes the script.
  const boundaries = [{ si: -1, ai: -1 }, ...matches.map(([si, ai]) => ({ si, ai })), { si: scriptTokens.length, ai: asrWords.length }];

  for (let b = 0; b < boundaries.length - 1; b++) {
    const cur = boundaries[b];
    const next = boundaries[b + 1];

    if (cur.si >= 0) {
      const w = asrWords[cur.ai];
      out[cur.si] = { text: scriptTokens[cur.si], start: w.start, end: w.end };
    }

    const gapStart = cur.si + 1;
    const gapEnd = next.si - 1; // inclusive
    if (gapEnd >= gapStart) {
      const tStart = cur.ai >= 0 ? asrWords[cur.ai].end : first.start;
      const tEnd = next.ai < asrWords.length ? asrWords[next.ai].start : last.end;
      const count = gapEnd - gapStart + 1;
      const span = Math.max(tEnd - tStart, 0);
      for (let k = 0; k < count; k++) {
        const si = gapStart + k;
        const s = tStart + (span * k) / count;
        const e = Math.max(tStart + (span * (k + 1)) / count, s);
        out[si] = { text: scriptTokens[si], start: +s.toFixed(3), end: +e.toFixed(3) };
      }
    }
  }
  return out;
}

// Script-first mode may legitimately output more words than the ASR (the
// script can spell out things the speaker slurred together), so the "more
// words out than in" integrity check does not apply here — everything else
// (monotonic timeline, in-span, non-empty text) still must hold.
export function checkScriptAlignmentIntegrity(asrWords, aligned) {
  return checkTimingIntegrity(asrWords, aligned).filter(e => !e.includes('MORE words'));
}

function usage() {
  console.error('usage: node lib/transcript-quality.mjs <align|apply> <slug-or-path> [cleanedFile]');
}

// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is a backslash
// path, so naive string concatenation never matches import.meta.url.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, workdirArg, cleanedArg] = process.argv.slice(2);
  if (!mode || !workdirArg) {
    usage();
    process.exit(1);
  }
  const workdir = resolveWorkdir(workdirArg);
  const transcriptPath = path.join(workdir, 'transcript.json');
  const before = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));

  if (mode === 'align') {
    const scriptPath = path.join(workdir, 'script.txt');
    if (!fs.existsSync(scriptPath)) {
      console.error(`no script.txt at ${scriptPath}`);
      process.exit(1);
    }
    const scriptTokens = fs.readFileSync(scriptPath, 'utf8').split(/\s+/).filter(Boolean);
    const aligned = alignScriptToWords(scriptTokens, before);
    const errors = checkScriptAlignmentIntegrity(before, aligned);
    if (errors.length) {
      console.error('script alignment rejected — timing integrity failed:');
      for (const e of errors) console.error(`  - ${e}`);
      process.exit(1);
    }
    fs.writeFileSync(transcriptPath, JSON.stringify(aligned));
    const files = fs.readdirSync(workdir);
    const rawFile = files.find(f => f.startsWith('transcript.') && f.endsWith('-raw.bak.json'));
    if (rawFile) {
      const rawWords = JSON.parse(fs.readFileSync(path.join(workdir, rawFile), 'utf8'));
      writeTranscriptDiff(workdir, { rawWords, cleanWords: aligned, suspects: [] });
    } else {
      console.log('note: no raw backup found, skipping transcript.diff.json generation');
    }
    console.log(JSON.stringify({ ok: true, mode: 'align', words: aligned.length }));
  } else if (mode === 'apply') {
    if (!cleanedArg) {
      console.error('apply needs a cleaned-transcript JSON file path');
      process.exit(1);
    }
    const cleaned = JSON.parse(fs.readFileSync(path.resolve(cleanedArg), 'utf8'));
    try {
      applyCleanup(before, cleaned);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
    fs.writeFileSync(transcriptPath, JSON.stringify(cleaned));
    const files = fs.readdirSync(workdir);
    const rawFile = files.find(f => f.startsWith('transcript.') && f.endsWith('-raw.bak.json'));
    if (rawFile) {
      const rawWords = JSON.parse(fs.readFileSync(path.join(workdir, rawFile), 'utf8'));
      writeTranscriptDiff(workdir, { rawWords, cleanWords: cleaned, suspects: [] });
    } else {
      console.log('note: no raw backup found, skipping transcript.diff.json generation');
    }
    console.log(JSON.stringify({ ok: true, mode: 'apply', words: cleaned.length }));
  } else {
    console.error(`unknown mode: ${mode}`);
    usage();
    process.exit(1);
  }
}

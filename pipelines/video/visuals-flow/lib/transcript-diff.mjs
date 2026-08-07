import fs from 'node:fs';
import path from 'node:path';

// 141 scattered token changes scrolling past in a terminal is not a review.
// The same 141 as a diff is (plan 198). This is the artifact the cleanup step
// produces — the ONLY representation in which a human can see what the machine
// decided to change about the words that will be burned into captions verbatim.
//
// Compares by INDEX, not by alignment: checkTimingIntegrity() guarantees the
// cleaned list has the same length and the same word times as the raw one, so
// index i is the same spoken word in both. If that guarantee ever breaks, this
// throws rather than producing a plausible-looking wrong diff.
export function transcriptDiff(rawWords, cleanWords) {
  if (rawWords.length !== cleanWords.length) {
    throw new Error(
      `TRANSCRIPT-DIFF-INVISIBLE: raw has ${rawWords.length} words, cleaned has ${cleanWords.length} — ` +
      'checkTimingIntegrity() should have rejected this; a length change means the diff cannot be trusted',
    );
  }
  const changes = [];
  for (let i = 0; i < rawWords.length; i++) {
    const before = rawWords[i]?.text ?? '';
    const after = cleanWords[i]?.text ?? '';
    if (before === after) continue;
    changes.push({ i, start: rawWords[i]?.start ?? null, before, after });
  }
  return { changes, total: changes.length };
}

// `suspects` are words the second-opinion pass still doubts — including ones the
// cleanup did NOT change. A diff alone cannot show those: it only shows what
// moved. Carrying them on the same artifact is what makes the review complete.
export function writeTranscriptDiff(workdir, { rawWords, cleanWords, suspects = [] }) {
  const { changes, total } = transcriptDiff(rawWords, cleanWords);
  const out = path.join(workdir, 'transcript.diff.json');
  const report = {
    total,
    changes,
    suspects,
    note: 'changes[] is what the cleanup altered; suspects[] is what a second pass still doubts, including words it did not touch',
  };
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  return report;
}

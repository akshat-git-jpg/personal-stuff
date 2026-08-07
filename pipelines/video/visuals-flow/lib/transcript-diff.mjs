import fs from 'node:fs';
import path from 'node:path';

// 141 scattered token changes scrolling past in a terminal is not a review.
// The same 141 as a diff is (plan 198). This is the artifact the cleanup step
// produces — the ONLY representation in which a human can see what the machine
// decided to change about the words that will be burned into captions verbatim.
//
// Two alignment modes, because a cleanup pass is allowed to MERGE words:
//
//   - Equal lengths  -> compare by index. Every clean word is the same spoken
//     word as the raw word at the same index.
//   - Fewer clean words -> align by TIME. checkTimingIntegrity() permits a
//     cleanup to merge or drop ("never invent"), so "open"+"art" collapsing to
//     "OpenArt" is normal and shifts every later index by one. Word times are
//     preserved across a merge, so the raw words belonging to a clean word are
//     exactly those starting before the NEXT clean word does.
//
// Index-comparing a merged transcript is what made this step unrunnable on its
// first real video (consistent-ai-influencer: 4062 raw -> 4005 clean). The old
// code threw on any length change, citing a checkTimingIntegrity() guarantee
// that does not exist — that function only rejects growth, never shrinkage.
const EPS = 1e-6;

function textOf(w) {
  return String(w?.text ?? '');
}

// Groups raw words under the clean word they were folded into. The boundary is
// the NEXT clean word's start rather than this one's end, so a gap between
// words can never orphan a raw token.
export function alignRawToClean(rawWords, cleanWords) {
  const groups = [];
  let r = 0;
  for (let c = 0; c < cleanWords.length; c++) {
    const isLast = c === cleanWords.length - 1;
    const nextStart = isLast ? Infinity : cleanWords[c + 1]?.start;
    const boundary = Number.isFinite(nextStart) ? nextStart : Infinity;
    const group = [];
    while (r < rawWords.length) {
      const rs = rawWords[r]?.start;
      // Always claim one raw word first. ASR emits adjacent words with
      // IDENTICAL start times (consistent-ai-influencer: "aesthetic" and "and"
      // both at 39.14s), and a purely boundary-driven walk hands those clean
      // words an empty group and reads it as an invented word.
      if (group.length && !isLast && Number.isFinite(rs) && rs >= boundary - EPS) break;
      group.push(rawWords[r]);
      r++;
    }
    groups.push(group);
  }
  return groups;
}

export function transcriptDiff(rawWords, cleanWords) {
  if (cleanWords.length > rawWords.length) {
    throw new Error(
      `TRANSCRIPT-DIFF-INVISIBLE: cleaned has ${cleanWords.length} words, raw has ${rawWords.length} — ` +
      'a cleanup may merge or drop but never invent, so this diff cannot be trusted',
    );
  }

  const changes = [];

  if (rawWords.length === cleanWords.length) {
    for (let i = 0; i < rawWords.length; i++) {
      const before = textOf(rawWords[i]);
      const after = textOf(cleanWords[i]);
      if (before === after) continue;
      changes.push({ i, start: rawWords[i]?.start ?? null, before, after });
    }
    return { changes, total: changes.length };
  }

  const groups = alignRawToClean(rawWords, cleanWords);
  const covered = groups.reduce((n, g) => n + g.length, 0);
  if (covered !== rawWords.length) {
    throw new Error(
      `TRANSCRIPT-DIFF-INVISIBLE: time alignment covered ${covered} of ${rawWords.length} raw words — ` +
      'the cleaned word times no longer tile the raw ones, so the diff cannot be trusted',
    );
  }
  for (let c = 0; c < cleanWords.length; c++) {
    const group = groups[c];
    if (!group.length) {
      throw new Error(
        `TRANSCRIPT-DIFF-INVISIBLE: cleaned word ${c} ("${textOf(cleanWords[c])}") matched no raw word — ` +
        'a cleanup may merge or drop but never invent',
      );
    }
    const before = group.map(textOf).join(' ');
    const after = textOf(cleanWords[c]);
    if (before === after) continue;
    changes.push({
      i: c,
      start: group[0]?.start ?? null,
      before,
      after,
      ...(group.length > 1 ? { merged: group.length } : {}),
    });
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

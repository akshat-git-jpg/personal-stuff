import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';

export function findSuspects(words, lexicon) {
  const suspects = [];
  const termsSet = new Set(lexicon.terms || []);
  
  const confusables = lexicon.confusables || {};
  for (const [key, suggestion] of Object.entries(confusables)) {
    const keyTokens = key.split(/\s+/);
    for (let i = 0; i <= words.length - keyTokens.length; i++) {
      let match = true;
      let matchedText = [];
      for (let j = 0; j < keyTokens.length; j++) {
        const textClean = words[i + j].text.replace(/[^\w\s-]/g, '').toLowerCase();
        if (textClean !== keyTokens[j]) {
          match = false;
          break;
        }
        matchedText.push(words[i + j].text);
      }
      if (match) {
        suspects.push({
          kind: 'confusable',
          at: words[i].start,
          text: matchedText.join(' '),
          suggestion,
          reason: 'matches known confusable'
        });
      }
    }
  }

  const frequencies = new Map();
  for (const w of words) {
    const stripped = w.text.replace(/[^\w\s-]/g, '');
    if (!stripped) continue;
    frequencies.set(stripped, (frequencies.get(stripped) || 0) + 1);
  }

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const stripped = w.text.replace(/[^\w\s-]/g, '');
    if (!stripped) continue;

    // Rule 2: digit-letter
    if (/^\d+$/.test(stripped) && i + 1 < words.length) {
      const nextStripped = words[i+1].text.replace(/[^\w\s-]/g, '');
      if (/^[A-Z]{2,4}$/.test(nextStripped)) {
        const joined = stripped + nextStripped;
        if (!termsSet.has(joined)) {
          suspects.push({
            kind: 'digit-letter',
            at: w.start,
            text: `${w.text} ${words[i+1].text}`,
            suggestion: null,
            reason: 'digit followed by acronym'
          });
        }
      }
    }
    
    if (/^\d+[A-Za-z]{2,}$/.test(stripped)) {
      if (!termsSet.has(stripped)) {
        suspects.push({
          kind: 'digit-letter',
          at: w.start,
          text: w.text,
          suggestion: null,
          reason: 'mixed digit and letters'
        });
      }
    }

    // Rule 3: once-only-proper-noun
    if (/^[A-Z][A-Za-z]{3,}$/.test(stripped)) {
      const isSentenceInitial = (i === 0) || /[.!?]["']?$/.test(words[i-1].text);
      if (!isSentenceInitial && frequencies.get(stripped) === 1 && !termsSet.has(stripped)) {
        suspects.push({
          kind: 'once-only-proper-noun',
          at: w.start,
          text: w.text,
          suggestion: null,
          reason: 'rare proper noun'
        });
      }
    }
  }

  return suspects.sort((a, b) => a.at - b.at);
}

export function isAcknowledged(suspect, reviewedList) {
  return reviewedList.some(r => r.at === suspect.at && r.why && String(r.why).trim().length > 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: node lib/transcript-suspect.mjs <slug-or-path>');
    process.exit(1);
  }
  const workdir = resolveWorkdir(arg);
  const transcriptPath = path.join(workdir, 'transcript.json');
  if (!fs.existsSync(transcriptPath)) {
    console.error(`missing ${transcriptPath}`);
    process.exit(1);
  }
  const words = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));

  const baseLexicon = JSON.parse(fs.readFileSync(new URL('./lexicon.json', import.meta.url), 'utf8'));
  const mergedLexicon = {
    terms: [...baseLexicon.terms],
    confusables: { ...baseLexicon.confusables }
  };
  
  const videoLexiconPath = path.join(workdir, 'lexicon.json');
  if (fs.existsSync(videoLexiconPath)) {
    const videoLexicon = JSON.parse(fs.readFileSync(videoLexiconPath, 'utf8'));
    if (videoLexicon.terms) mergedLexicon.terms.push(...videoLexicon.terms);
    if (videoLexicon.confusables) Object.assign(mergedLexicon.confusables, videoLexicon.confusables);
  }

  const suspects = findSuspects(words, mergedLexicon);
  const outPath = path.join(workdir, 'transcript-suspects.json');
  fs.writeFileSync(outPath, JSON.stringify(suspects, null, 2));

  const reviewedPath = path.join(workdir, 'transcript-suspects.reviewed.json');
  let reviewedList = [];
  if (fs.existsSync(reviewedPath)) {
    const revData = JSON.parse(fs.readFileSync(reviewedPath, 'utf8'));
    reviewedList = revData.reviewed || [];
  }

  let failed = false;
  for (const s of suspects) {
    if (!isAcknowledged(s, reviewedList)) failed = true;
    console.log(`${s.kind}  t=${s.at}s  "${s.text}"  -> ${s.suggestion || '?'}  (${s.reason})`);
  }

  if (failed) {
    process.exit(1);
  }
}

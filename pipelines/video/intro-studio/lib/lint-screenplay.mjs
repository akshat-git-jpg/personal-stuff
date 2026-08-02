import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { INTENTS, REGISTERS, FACE_MODES, TRANSITIONS, followsDefaultArc, normaliseClause } from './screenplay-schema.mjs';

export function lintScreenplay({ screenplay, words, introDuration }) {
  const errors = [];
  const warnings = [];

  const beats = screenplay.beats || [];
  
  let carriesCount = 0;
  let hasRegisterChange = false;
  let firstRegister = beats.length > 0 ? beats[0].register : null;
  let faceFullFirstTwo = false;

  const usedIds = new Set();
  
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const beatId = beat.id;

    // E5: enum checks
    if (!INTENTS.includes(beat.intent)) {
      errors.push({ code: 'E5', beat: beatId, message: `intent '${beat.intent}' not in enum` });
    }
    if (!REGISTERS.includes(beat.register)) {
      errors.push({ code: 'E5', beat: beatId, message: `register '${beat.register}' not in enum` });
    }
    if (!FACE_MODES.includes(beat.face)) {
      errors.push({ code: 'E5', beat: beatId, message: `face '${beat.face}' not in enum` });
    }
    if (!TRANSITIONS.includes(beat.transition_out)) {
      errors.push({ code: 'E5', beat: beatId, message: `transition_out '${beat.transition_out}' not in enum` });
    }
    if (typeof beat.stage !== 'string' || beat.stage.trim() === '') {
      errors.push({ code: 'E5', beat: beatId, message: `stage must be a non-empty string` });
    }

    // E4: unique id and valid carries.from
    if (usedIds.has(beat.id)) {
      errors.push({ code: 'E4', beat: beatId, message: `id '${beat.id}' is not unique` });
    }
    usedIds.add(beat.id);
    
    if (beat.carries && beat.carries.from) {
      if (!usedIds.has(beat.carries.from) || beat.carries.from === beat.id) {
        errors.push({ code: 'E4', beat: beatId, message: `carries.from '${beat.carries.from}' does not name an EARLIER beat's id` });
      }
    }

    // E1 and E2: contiguous run in transcript text, times match
    const clauseNorm = normaliseClause(beat.clause);
    const clauseWords = clauseNorm.split(' ').filter(w => w);
    
    // One transcript token can normalise to SEVERAL words ("side-by-side" ->
    // "side by side", "let's" -> "let s"). Flatten to one entry per word while
    // keeping the owning token's index, so timings still resolve to real words.
    // Comparing token-to-word instead made every hyphenated clause unmatchable.
    const normWords = [];
    words.forEach((w, idx) => {
      for (const piece of normaliseClause(w.text).split(' ')) {
        if (piece) normWords.push({ text: piece, idx });
      }
    });

    let foundStartIdx = -1;
    let foundEndIdx = -1;
    
    for (let w = 0; w <= normWords.length - clauseWords.length; w++) {
      let match = true;
      for (let c = 0; c < clauseWords.length; c++) {
        if (normWords[w + c].text !== clauseWords[c]) {
          match = false;
          break;
        }
      }
      if (match) {
        foundStartIdx = normWords[w].idx;
        foundEndIdx = normWords[w + clauseWords.length - 1].idx;
        break;
      }
    }

    if (foundStartIdx === -1) {
      errors.push({ code: 'E1', beat: beatId, message: `clause '${beat.clause}' not found contiguously in transcript` });
    } else {
      const expectedStart = words[foundStartIdx].start;
      const expectedEnd = words[foundEndIdx].end;
      
      // E2 is CONTAINMENT, not endpoint matching. Endpoint matching cannot be
      // satisfied alongside E3: speech has pauses between clauses, and E3 makes
      // beats tile without gaps, so one beat must absorb each pause. A 0.72s
      // pause was enough to make the two rules jointly unsatisfiable.
      // The beat must cover its clause, and may lead or trail it by at most
      // LEAD_MAX so times still derive from word timings rather than estimation.
      const LEAD_MAX = 1.5;
      const isFirstBeat = i === 0;
      const isLastBeat = i === beats.length - 1;

      if (beat.t_start > expectedStart + 0.25) {
        errors.push({ code: 'E2', beat: beatId, message: `t_start (${beat.t_start}) starts after its clause begins (${expectedStart})` });
      } else if (beat.t_start < expectedStart - LEAD_MAX) {
        // E3 pins the FIRST beat to 0 and no recording speaks at 0.000, so the
        // lead bound cannot apply there.
        if (!(isFirstBeat && Math.abs(beat.t_start) <= 0.05)) {
          errors.push({ code: 'E2', beat: beatId, message: `t_start (${beat.t_start}) leads its clause (${expectedStart}) by more than ${LEAD_MAX}s` });
        }
      }

      if (beat.t_end < expectedEnd - 0.25) {
        errors.push({ code: 'E2', beat: beatId, message: `t_end (${beat.t_end}) ends before its clause does (${expectedEnd})` });
      } else if (beat.t_end > expectedEnd + LEAD_MAX) {
        // E7 requires the final beat to stretch to introDuration.
        if (!(isLastBeat && Math.abs(beat.t_end - introDuration) <= 0.1)) {
          errors.push({ code: 'E2', beat: beatId, message: `t_end (${beat.t_end}) trails its clause (${expectedEnd}) by more than ${LEAD_MAX}s` });
        }
      }
    }

    // E3: contiguous and gapless
    if (i === 0) {
      if (Math.abs(beat.t_start - 0) > 0.05) {
        errors.push({ code: 'E3', beat: beatId, message: `beats[0].t_start must be 0 (±0.05), got ${beat.t_start}` });
      }
    } else {
      const prevBeat = beats[i - 1];
      if (Math.abs(beat.t_start - prevBeat.t_end) > 0.05) {
        errors.push({ code: 'E3', beat: beatId, message: `beat.t_start (${beat.t_start}) does not match previous beat.t_end (${prevBeat.t_end})` });
      }
    }

    // E7: last beat's t_end equals introDuration
    if (i === beats.length - 1) {
      if (Math.abs(beat.t_end - introDuration) > 0.1) {
        errors.push({ code: 'E7', beat: beatId, message: `last beat's t_end (${beat.t_end}) must equal introDuration (${introDuration}) within 0.1s` });
      }
    }

    // W1 logic
    if (i > 0 && beat.carries) {
      carriesCount++;
    }

    // W2 logic
    if (beat.register !== firstRegister) {
      hasRegisterChange = true;
    }

    // W3 logic
    if (i < 2 && beat.face === 'full') {
      faceFullFirstTwo = true;
    }

    // W4 logic
    if (beat.t_end - beat.t_start > 12) {
      warnings.push({ code: 'W4', beat: beatId, message: `beat is longer than 12s (${(beat.t_end - beat.t_start).toFixed(2)}s)` });
    }
  }

  // E6 logic
  const intents = beats.map(b => b.intent);
  if (!followsDefaultArc(intents)) {
    for (const beat of beats) {
      if (typeof beat.deviation_reason !== 'string' || beat.deviation_reason.trim() === '') {
        errors.push({ code: 'E6', beat: beat.id, message: `deviation_reason required when intent order departs from DEFAULT_ARC` });
      }
    }
  }

  // W1 check eval
  if (beats.length >= 2) {
    if (carriesCount < Math.ceil((beats.length - 1) / 2)) {
      warnings.push({ code: 'W1', beat: null, message: `At least half of the beats after the first must carry something.` });
    }
  }

  // W2 check eval
  if (beats.length > 0 && !hasRegisterChange) {
    warnings.push({ code: 'W2', beat: null, message: `register must change at least once across the screenplay` });
  }

  // W3 check eval
  if (beats.length > 0 && !faceFullFirstTwo) {
    warnings.push({ code: 'W3', beat: null, message: `At least one of the first two beats must have face: "full"` });
  }

  return { errors, warnings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node lint-screenplay.mjs <slug>');
    process.exit(1);
  }
  
  const workdir = resolveWorkdir(slug);
  const screenplayFile = path.join(workdir, 'screenplay.json');
  const transcriptFile = path.join(workdir, 'transcript.json');
  const intakeFile = path.join(workdir, 'intake.json');
  
  if (!fs.existsSync(screenplayFile) || !fs.existsSync(transcriptFile) || !fs.existsSync(intakeFile)) {
    console.error(`Missing input files in ${workdir}`);
    process.exit(1);
  }
  
  const screenplay = JSON.parse(fs.readFileSync(screenplayFile, 'utf8'));
  const transcript = JSON.parse(fs.readFileSync(transcriptFile, 'utf8'));
  const intake = JSON.parse(fs.readFileSync(intakeFile, 'utf8'));
  
  const res = lintScreenplay({ 
    screenplay, 
    words: transcript, 
    introDuration: intake.duration 
  });
  
  for (const w of res.warnings) {
    console.log(`W${w.code.replace('W','')} ${w.beat || '*'}: ${w.message}`);
  }
  
  if (res.errors.length > 0) {
    for (const e of res.errors) {
      console.error(`E${e.code.replace('E','')} ${e.beat || '*'}: ${e.message}`);
    }
    process.exit(1);
  }
  
  process.exit(0);
}

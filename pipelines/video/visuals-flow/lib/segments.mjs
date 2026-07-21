import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DEMO_CUES = [
  'click on', 'clicking on', 'go over to', 'going to go over', 'over here',
  'right here', 'as you can see', 'you can see that', 'let\'s go with',
  'select your', 'i\'m going to go with', 'upload', 'on this side',
  'go ahead with that', 'move over to',
];

const WINDOW = 30;   // s — rolling window the density is measured over
const MIN_HITS = 2;  // hits inside a window to call it demo
const MIN_SEG = 20;  // s — shorter runs are merged into their neighbour

export function proposeSegments(transcript) {
  const words = transcript.map(w => ({
    text: w.text.toLowerCase().replace(/[^\w\s']/g, ''),
    start: w.start,
    end: w.end
  }));

  if (words.length === 0) return [];
  const lastWordEnd = words[words.length - 1].end;

  const stepCount = Math.ceil(lastWordEnd / 5);
  const steps = [];
  for (let i = 0; i < stepCount; i++) {
    const t = i * 5;
    const windowStart = t;
    const windowEnd = t + WINDOW;
    
    const windowWords = words.filter(w => w.start >= windowStart && w.start < windowEnd);
    const joined = windowWords.map(w => w.text).join(' ');
    
    let hits = 0;
    for (const cue of DEMO_CUES) {
      if (new RegExp(`\\b${cue.replace(/'/g, "\\'")}\\b`).test(joined)) {
        hits++;
      }
    }
    
    steps.push({ start: t, end: t + 5, kind: hits >= MIN_HITS ? 'demo' : 'narration' });
  }

  let runs = [];
  for (const step of steps) {
    if (runs.length === 0) {
      runs.push({ kind: step.kind, start: step.start, end: step.end });
    } else {
      const last = runs[runs.length - 1];
      if (last.kind === step.kind) {
        last.end = step.end;
      } else {
        runs.push({ kind: step.kind, start: step.start, end: step.end });
      }
    }
  }

  if (runs.length > 0) {
    runs[runs.length - 1].end = lastWordEnd;
  }

  let mergedRuns = [];
  for (const run of runs) {
    if (mergedRuns.length === 0) {
      mergedRuns.push({ ...run });
    } else {
      const duration = run.end - run.start;
      if (duration < MIN_SEG) {
        mergedRuns[mergedRuns.length - 1].end = run.end;
      } else {
        mergedRuns.push({ ...run });
      }
    }
  }

  let finalRuns = [];
  for (const run of mergedRuns) {
    if (finalRuns.length === 0) {
      finalRuns.push(run);
    } else {
      const last = finalRuns[finalRuns.length - 1];
      if (last.kind === run.kind) {
        last.end = run.end;
      } else {
        finalRuns.push(run);
      }
    }
  }

  finalRuns.forEach(r => {
    r.start = Number(r.start.toFixed(3));
    r.end = Number(r.end.toFixed(3));
    if (r.kind === 'demo' && (r.end - r.start) > 40) {
      r.note = "check for sample-clip playback inside this range";
    }
  });

  return finalRuns;
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const slug = args[0];
  const isPropose = args[1] === '--propose';

  if (!slug) {
    console.error("Usage: node segments.mjs <slug> [--propose]");
    process.exit(1);
  }

  const workdir = path.join(process.cwd(), 'videos', slug);
  const segmentsFile = path.join(workdir, 'segments.json');
  
  if (isPropose) {
    const transcriptPath = path.join(workdir, 'transcript.json');
    if (!fs.existsSync(transcriptPath)) {
      console.error(`Transcript not found: ${transcriptPath}`);
      process.exit(1);
    }
    const transcript = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
    const segments = proposeSegments(transcript);
    
    const out = {
      video: slug,
      confirmed: false,
      segments
    };
    
    fs.writeFileSync(segmentsFile, JSON.stringify(out, null, 2));
    console.log(`Wrote ${segmentsFile}`);
  } else {
    if (!fs.existsSync(segmentsFile)) {
      console.error(`No segments.json found for ${slug}`);
      process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(segmentsFile, 'utf8'));
    console.table(data.segments);
  }
}

import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from '../workdir.mjs';
import { SOUND_CONSTANTS } from './sound-constants.mjs';

export function planSfx({ resolved, effects, segments, total }) {
  let rawInstances = [];
  let idCounter = 1;

  const pushSfx = (at, sample, semi, gainDb, extra = {}) => {
    rawInstances.push({ id: `sfx-${idCounter++}`, at, sample, semi, gainDb, ...extra });
  };

  // Structural start
  pushSfx(0.5, 'riser', 0, SOUND_CONSTANTS.HIT_GAIN_DB);

  let lastPopClass = 'blip';

  for (const cue of resolved) {
    // Entrances
    if (cue.placement === 'overlay') {
      pushSfx(cue.start, 'blip', 0, SOUND_CONSTANTS.HIT_GAIN_DB);
    } else {
      const isDark = cue.register === 'dark';
      pushSfx(cue.start, isDark ? 'whoosh-down' : 'whoosh-up', 0, SOUND_CONSTANTS.HIT_GAIN_DB);
    }

    // Reveal runs
    const beats = cue.variables?.beats || [];
    if (beats.length > 0) {
      const parts = cue.card.split('/');
      const family = parts[0];
      const cardType = parts[1] || family;

      let runSample = 'pop';
      let contour = 'contour';
      
      if (cue.card === 'enacted/counter-tally' || cue.card === 'enacted/price-meter') {
        runSample = 'tick';
        contour = 'flat';
      } else if (family === 'enacted' && ['fill-gauge', 'stack-builder', 'connect-nodes', 'pipeline-flow'].includes(cardType)) {
        runSample = 'pop';
        contour = 'contour';
      } else if (family === 'enacted' && ['race-bars', 'verdict-scale'].includes(cardType)) {
        runSample = 'thock';
        contour = 'alt';
      } else {
        runSample = 'pop';
        contour = 'contour';
      }

      if (runSample === 'pop') {
        runSample = lastPopClass === 'pop' ? 'blip' : 'pop';
        lastPopClass = runSample;
      }

      const runLen = beats.length;
      beats.forEach((beat, i) => {
        let keep = false;
        if (runLen <= SOUND_CONSTANTS.POP_CAP) {
          keep = true;
        } else {
          if (i < SOUND_CONSTANTS.POP_CAP - 1 || i === runLen - 1) {
            keep = true;
          }
        }
        if (!keep) return;

        let semi = 0;
        if (contour === 'contour') {
          semi = SOUND_CONSTANTS.RUN_SEMITONES[i % SOUND_CONSTANTS.RUN_SEMITONES.length];
        } else if (contour === 'alt') {
          semi = i % 2 === 0 ? 0 : 4;
        }

        const gainDb = SOUND_CONSTANTS.POP_GAIN_DB + SOUND_CONSTANTS.JITTER_DB[i % SOUND_CONSTANTS.JITTER_DB.length];
        pushSfx(cue.start + beat.at, runSample, semi, gainDb);
      });
    }
  }

  // Structural end
  if (resolved.length > 0) {
    const lastCue = resolved[resolved.length - 1];
    if (lastCue.register !== 'dark') {
      const endAt = lastCue.start + lastCue.duration;
      pushSfx(endAt, 'success', 0, SOUND_CONSTANTS.HIT_GAIN_DB);
    }
  }

  // Transitions
  if (effects && effects.instances) {
    for (const inst of effects.instances) {
      if (!inst.enabled) continue;
      if (inst.type === 'whip') {
        pushSfx(inst.at, 'swipe', 0, SOUND_CONSTANTS.HIT_GAIN_DB);
      } else if (inst.type === 'register') {
        pushSfx(inst.at, 'impact', 0, SOUND_CONSTANTS.HIT_GAIN_DB - 6);
      }
    }
  }

  // Drone
  if (segments) {
    for (const seg of segments) {
      if (seg.kind === 'narration' && seg.end - seg.start > 20) {
        pushSfx(seg.start, 'drone_low', 0, SOUND_CONSTANTS.DRONE_GAIN_DB, { loop: true, end: seg.end });
      }
    }
  }

  // Sort by time
  rawInstances.sort((a, b) => a.at - b.at);

  // De-clutter MIN_SPACING
  let minSpaced = [];
  let lastAt = -999;
  for (const inst of rawInstances) {
    if (inst.loop) {
      minSpaced.push(inst);
      continue;
    }
    if (inst.at - lastAt >= SOUND_CONSTANTS.MIN_SPACING) {
      minSpaced.push(inst);
      lastAt = inst.at;
    }
  }

  // Lone pop in 10s window (±5s)
  let finalInsts = [];
  for (let i = 0; i < minSpaced.length; i++) {
    const inst = minSpaced[i];
    if (['pop', 'blip'].includes(inst.sample)) {
      const prev = i > 0 ? minSpaced[i - 1] : null;
      const next = i < minSpaced.length - 1 ? minSpaced[i + 1] : null;
      
      const prevDist = prev ? (inst.at - prev.at) : Infinity;
      const nextDist = next ? (next.at - inst.at) : Infinity;

      if (prevDist > 5 && nextDist > 5) {
        continue;
      }
    }
    finalInsts.push(inst);
  }

  return finalInsts;
}

function main() {
  if (process.argv.length < 3 || !process.argv[1].endsWith('sfx-plan.mjs')) return;
  const slug = process.argv[2];
  const workdir = resolveWorkdir(slug);

  const resolvedPath = path.join(workdir, 'resolved.json');
  if (!fs.existsSync(resolvedPath)) {
    console.error('missing resolved.json');
    process.exit(1);
  }
  const { video, resolved } = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

  const effectsPath = path.join(workdir, 'effects.json');
  let effects = { instances: [] };
  if (fs.existsSync(effectsPath)) {
    effects = JSON.parse(fs.readFileSync(effectsPath, 'utf8'));
  }

  const segmentsPath = path.join(workdir, 'segments.json');
  let segments = [];
  if (fs.existsSync(segmentsPath)) {
    segments = JSON.parse(fs.readFileSync(segmentsPath, 'utf8'));
  }
  
  const manifestPath = path.join(workdir, 'video.json');
  let total = 0; // If total is needed outside of segments, though we mostly use resolved cues

  const newInstances = planSfx({ resolved, effects, segments, total });

  const soundPath = path.join(workdir, 'sound.json');
  let existing = { instances: [] };
  if (fs.existsSync(soundPath)) {
    existing = JSON.parse(fs.readFileSync(soundPath, 'utf8'));
  }

  const finalInstances = [];
  for (const inst of newInstances) {
    const override = existing.instances.find(m => m.id === inst.id);
    if (override && override.enabled !== undefined) {
      finalInstances.push({ ...inst, enabled: override.enabled });
    } else {
      finalInstances.push({ ...inst });
    }
  }

  const stripEnabled = (instances) => instances.map(({ enabled, ...rest }) => rest);
  const canon = (v) => Array.isArray(v) ? v.map(canon)
    : (v && typeof v === 'object')
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
      : v;
      
  const unchanged = JSON.stringify(canon(stripEnabled(existing.instances ?? []))) === JSON.stringify(canon(stripEnabled(newInstances)));
  
  const outData = {
    video,
    approved: existing.approved === true && unchanged,
    instances: finalInstances
  };

  fs.writeFileSync(soundPath, JSON.stringify(outData, null, 2) + '\n');
  console.log(`wrote ${soundPath} with ${finalInstances.length} instances`);
}

main();

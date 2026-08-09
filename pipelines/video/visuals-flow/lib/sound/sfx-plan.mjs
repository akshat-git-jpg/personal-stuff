import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveWorkdir } from '../workdir.mjs';
import { SOUND_CONSTANTS } from './sound-constants.mjs';

// Longest sample in assets/sfx. An effect must START early enough that its
// tail still lands inside the voiceover, so the clamp reserves this much.
export const SFX_MAX_SAMPLE_S = 0.5;

export function planSfx({ resolved, effects, segments, total }) {
  let rawInstances = [];
  let idCounter = 1;

  // Nothing may be scheduled into the silence after the voiceover ends. The
  // planner used to place the structural-end effect at the LAST CUE's end, and
  // a cue can outlast the VO: on consistent-ai-influencer the final cue ran to
  // 1230.73s against a 1230.229s voiceover, so a "success" hit was scheduled
  // 0.5s past the end of the audio (2026-08-08). It was inaudible AND it
  // lengthened the master, failing the frame-exact gate at 460.
  // `total` is the voiceover duration; 0 or missing means "not measured",
  // in which case we clamp nothing rather than clamp to zero.
  const latest = Number.isFinite(total) && total > 0 ? total - SFX_MAX_SAMPLE_S : null;
  const pushSfx = (at, sample, semi, gainDb, extra = {}) => {
    const clamped = latest === null ? at : Math.min(at, latest);
    rawInstances.push({ id: `sfx-${idCounter++}`, at: +clamped.toFixed(2), sample, semi, gainDb, ...extra });
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
      
      if (cue.card === 'enacted/counter-tally') {
        runSample = 'tick';
        contour = 'flat';
      } else if (family === 'enacted' && ['fill-gauge', 'pipeline-flow'].includes(cardType)) {
        runSample = 'pop';
        contour = 'contour';
      } else if (family === 'enacted' && ['race-bars'].includes(cardType)) {
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
    const raw = JSON.parse(fs.readFileSync(segmentsPath, 'utf8'));
    // segments.json is {video, confirmed, segments:[...]} — accept both shapes.
    segments = Array.isArray(raw) ? raw : (raw.segments ?? []);
  }
  
  // The voiceover length, measured — not inferred from cues. A cue can outlast
  // the VO, and until 2026-08-08 this was hardcoded to 0, which disabled the
  // end-clamp in planSfx entirely.
  const voPath = path.join(workdir, 'vo.mp3');
  let total = 0;
  if (fs.existsSync(voPath)) {
    const probe = spawnSync('ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voPath],
      { encoding: 'utf8' });
    const parsed = parseFloat((probe.stdout || '').trim());
    if (Number.isFinite(parsed)) total = parsed;
  }
  if (!total) console.error('warning: could not measure vo.mp3 — effects will not be clamped to the voiceover end');

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

  const outData = {
    video,
    approved: true,
    instances: finalInstances
  };

  fs.writeFileSync(soundPath, JSON.stringify(outData, null, 2) + '\n');
  console.log(`wrote ${soundPath} with ${finalInstances.length} instances`);
}

main();

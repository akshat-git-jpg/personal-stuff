import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { planSegments, absorbSlivers, CANVAS } from './assemble.mjs';
import { resolveWorkdir } from './workdir.mjs';
import { EFFECT_MODULES } from './effects/registry.mjs';

function main() {
  if (process.argv.length < 3) {
    console.error('usage: node lib/effects-plan.mjs <slug-or-path>');
    process.exit(1);
  }
  const slug = process.argv[2];
  const workdir = resolveWorkdir(slug);

  const resolvedPath = path.join(workdir, 'resolved.json');
  if (!fs.existsSync(resolvedPath)) {
    console.error('missing resolved.json');
    process.exit(1);
  }
  const { video, resolved } = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

  const transcriptPath = path.join(workdir, 'transcript.json');
  const words = fs.existsSync(transcriptPath) ? JSON.parse(fs.readFileSync(transcriptPath, 'utf8')) : [];
  
  const shotsPath = path.join(workdir, 'shots.json');
  const avatarJobsPath = path.join(workdir, 'avatar-jobs.json');
  let avatarJobs = [];
  if (fs.existsSync(shotsPath) && fs.existsSync(avatarJobsPath)) {
    const avatarJobsFile = JSON.parse(fs.readFileSync(avatarJobsPath, 'utf8'));
    avatarJobs = avatarJobsFile.jobs.filter(j => j.kind === 'avatar-full');
  }

  const voPath = path.join(workdir, 'vo.mp3');
  let total = 0;
  if (fs.existsSync(voPath)) {
    const probeVo = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voPath], { encoding: 'utf8' });
    total = parseFloat(probeVo.stdout);
  } else if (words.length > 0) {
    total = words[words.length - 1].end + 1.0;
  } else {
    // Should not happen on real videos
    total = 0;
  }

  let segments = planSegments({ resolved, avatarJobs, total });
  segments = absorbSlivers(segments);

  const renderDir = path.join(workdir, 'renders');
  const overlays = resolved.filter(c => c.placement === 'overlay').map(c => {
    return { id: c.id, start: c.start, end: c.start + c.duration, file: path.join(renderDir, `${c.id}.mov`) }; // dummy file for plan
  });

  const { w, h } = CANVAS;
  const VF = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`;

  const defaultInstances = [];
  let ctx = { segments, overlays, words, resolved, total, w, h, VF };
  
  for (const mod of EFFECT_MODULES) {
    if (mod.plan) {
      const modInsts = mod.plan(ctx);
      defaultInstances.push(...modInsts);
    }
    if (mod.transformSegments) {
      // effects-plan computes default instances, so we can just use them for transform
      // to keep segmentation in sync.
      const insts = defaultInstances.filter(i => i.type === mod.TYPE);
      ctx.segments = mod.transformSegments(ctx.segments, insts, ctx);
    }
  }

  const manifestPath = path.join(workdir, 'effects.json');
  let existing = { instances: [] };
  if (fs.existsSync(manifestPath)) {
    existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }

  const newInstances = [];
  for (const inst of defaultInstances) {
    const override = existing.instances.find(m => m.id === inst.id);
    if (override) {
      newInstances.push({ ...inst, ...override });
    } else {
      newInstances.push(inst);
    }
  }

  const outData = {
    video,
    instances: newInstances
  };

  fs.writeFileSync(manifestPath, JSON.stringify(outData, null, 2) + '\n');
  console.log(`wrote ${manifestPath} with ${newInstances.length} instances`);
}

main();

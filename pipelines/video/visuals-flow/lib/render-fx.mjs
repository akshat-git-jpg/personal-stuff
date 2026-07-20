import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveWorkdir } from './workdir.mjs';
import * as whipMod from './effects/whip.mjs';
import * as beatsMod from './effects/beats.mjs';

const FPS = 30;
const W = 1920;
const H = 1080;

// Per-frame alpha envelopes (0..1). Derived from the SAME constants the
// assembly path uses, sampled at frame centers, so a 060-fold constant tune
// changes both renditions together.
// Whip flash: eq brightness ramps 0->FLASH_GAIN over the out half (0.1s) and
// back to 0 over the in half — 6 frames spanning [at-0.1, at+0.1).
export function whipFlashEnvelope() {
  const G = whipMod.CONSTANTS.FLASH_GAIN;
  const ramp = [0, 1, 2].map((n) => Math.min((n + 0.5) / 3, 1));
  return [...ramp.map((f) => +(G * f).toFixed(3)), ...ramp.slice().reverse().map((f) => +(G * f).toFixed(3))];
}

// Beat flash: three 1-frame phases before the beat (OUT), three after (IN),
// three band-settle — 9 frames spanning [at-0.1, at+0.2).
export function beatEnvelope() {
  const C = beatsMod.CONSTANTS;
  return [...C.FLASH_OUT_OPACITIES, ...C.FLASH_IN_OPACITIES, ...C.FLASH_BAND_OPACITIES];
}

// Nested-if geq alpha expression over frame index N.
export function envelopeExpr(env) {
  let expr = '0';
  for (let i = env.length - 1; i >= 0; i--) {
    expr = `if(lt(N,${i + 1}),${Math.round(env[i] * 255)},${expr})`;
  }
  return expr;
}

// One transparent flash clip: the beat module's diagonal orange->white
// gradient with the envelope as its alpha channel. Both flash renditions use
// this gradient wash — the whip's channel-mixer tint reads the same on screen
// and keeps the clip recipe single.
export function fxRenderArgs({ envelope, outFile }) {
  const d = (envelope.length / FPS + 0.1).toFixed(3);
  const grad = `gradients=s=${W}x${H}:c0=${beatsMod.CONSTANTS.FLASH_COLOR}:c1=0xffffff:x0=0:y0=${H}:x1=${W}:y1=0:speed=0.00001:d=${d}`;
  const vf = `format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='${envelopeExpr(envelope)}'`;
  return [
    '-y', '-f', 'lavfi', '-i', grad,
    '-vf', vf, '-r', String(FPS), '-frames:v', String(envelope.length),
    '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le',
    outFile,
  ];
}

// Instance -> plan: what renders, what drops (markers in plan 112).
export function planFx(instances) {
  const rendered = [];
  const dropped = [];
  for (const inst of instances) {
    if (inst.enabled === false) continue;
    if (inst.type === 'whip' && inst.style === 'flash') {
      const env = whipFlashEnvelope();
      rendered.push({
        id: inst.id, type: 'whip-flash', at: inst.at,
        timelineStart: +(inst.at - 0.1).toFixed(3),
        duration: +(env.length / FPS).toFixed(3),
        envelope: env,
      });
    } else if (inst.type === 'whip') {
      dropped.push({ id: inst.id, type: 'whip-blur', at: inst.at, reason: 'blur whip needs frame displacement — add a Resolve transition here if wanted' });
    } else if (inst.type === 'beat') {
      const env = beatEnvelope();
      rendered.push({
        id: inst.id, type: 'beat-flash', at: inst.at,
        timelineStart: +(inst.at - 0.1).toFixed(3),
        duration: +(env.length / FPS).toFixed(3),
        envelope: env,
      });
      if (inst.punch && inst.punch > 1.0) {
        dropped.push({ id: `${inst.id}-punch`, type: 'beat-punch', at: inst.at, reason: `punch-in x${inst.punch} dropped — use Dynamic Zoom on the underlying clip if wanted` });
      }
    } else if (inst.type === 'drift') {
      dropped.push({ id: inst.id, type: 'drift', at: inst.at ?? null, reason: 'Ken Burns drift dropped — use Dynamic Zoom on the screen clip if wanted' });
    } else if (inst.type === 'bubble') {
      dropped.push({ id: inst.id, type: 'bubble', at: inst.at ?? null, reason: 'corner bubble is assembly-only for now' });
    }
    // captions instances are handled by the SRT emitter in plan 112 — neither rendered nor dropped here.
  }
  return { rendered, dropped };
}

function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error('usage: node lib/render-fx.mjs <slug-or-path>');
    process.exit(1);
  }
  const workdir = resolveWorkdir(slug);
  const effectsPath = path.join(workdir, 'effects.json');
  if (!fs.existsSync(effectsPath)) {
    console.error(`missing ${effectsPath} — run node lib/effects-plan.mjs <slug> first`);
    process.exit(1);
  }
  const effects = JSON.parse(fs.readFileSync(effectsPath, 'utf8'));
  const { rendered, dropped } = planFx(effects.instances || []);

  const outDir = path.join(workdir, 'renders-fx');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  // All instances of a type share one identical envelope — render ONE file per
  // unique type and let every timeline placement reference it (one media-pool
  // item, many clips), instead of N duplicate movs.
  const fileByType = new Map();
  for (const r of rendered) {
    if (!fileByType.has(r.type)) {
      const outFile = path.join(outDir, `${r.type}.mov`);
      const res = spawnSync('ffmpeg', fxRenderArgs({ envelope: r.envelope, outFile }), { encoding: 'utf8' });
      if (res.status !== 0) {
        console.error(`ffmpeg failed for ${r.type}\n${(res.stderr || '').slice(-2000)}`);
        process.exit(1);
      }
      fileByType.set(r.type, outFile);
    }
    r.file = fileByType.get(r.type);
    delete r.envelope;
  }

  const manifest = { video: path.basename(workdir), rendered, dropped };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`fx clips: ${rendered.length} placements over ${fileByType.size} unique files, ${dropped.length} dropped -> ${outDir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

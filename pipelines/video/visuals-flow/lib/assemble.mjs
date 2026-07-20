import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { mmss, planRender } from './render.mjs';
import { resolveCues } from './resolve.mjs';
import { resolveWorkdir } from './workdir.mjs';
import { EFFECT_MODULES } from './effects/registry.mjs';

import * as whipMod from './effects/whip.mjs';
import * as beatsMod from './effects/beats.mjs';
import * as driftMod from './effects/drift.mjs';
import * as captionsMod from './effects/captions.mjs';
import { planCaptions, assEscape } from './captions.mjs';
import { createHash } from 'node:crypto';

function formatAssTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function jobKey(args) {
  const h = createHash('sha1');
  for (const a of args) {
    h.update(a); h.update(' ');
    if (fs.existsSync(a) && fs.statSync(a).isFile()) {
      const st = fs.statSync(a);
      h.update(`${st.size}:${Math.floor(st.mtimeMs)}`);
    }
  }
  return h.digest('hex');
}

const EPS = 0.05;
export const CANVAS = { w: 1920, h: 1080, fps: 30 };
export const ASSEMBLE_MEDIA_ROOT = process.env.ASSEMBLE_MEDIA_ROOT
  ?? path.join(os.homedir(), 'kb-scratch', 'video', 'visuals-flow');

export const TRANSITION_DUR = whipMod.CONSTANTS.TRANSITION_DUR;
export const WHIP_SIGMAS = whipMod.CONSTANTS.WHIP_SIGMAS;
export const WHIP_ZOOM = whipMod.CONSTANTS.WHIP_ZOOM;

export const BEAT_INTERVAL = beatsMod.CONSTANTS.BEAT_INTERVAL;
export const BEAT_MIN_EDGE = beatsMod.CONSTANTS.BEAT_MIN_EDGE;
export const BEAT_SNAP_WINDOW = beatsMod.CONSTANTS.BEAT_SNAP_WINDOW;
export const BEAT_MIN_GAP = beatsMod.CONSTANTS.BEAT_MIN_GAP;
export const FLASH_COLOR = beatsMod.CONSTANTS.FLASH_COLOR;
export const FLASH_OUT_OPACITIES = beatsMod.CONSTANTS.FLASH_OUT_OPACITIES;
export const FLASH_IN_OPACITIES = beatsMod.CONSTANTS.FLASH_IN_OPACITIES;
export const FLASH_BAND_OPACITIES = beatsMod.CONSTANTS.FLASH_BAND_OPACITIES;
export const PUNCH_SCALE = beatsMod.CONSTANTS.PUNCH_SCALE;

export const DRIFT_MAX = driftMod.CONSTANTS.DRIFT_MAX;
export const DRIFT_MIN_SEG = driftMod.CONSTANTS.DRIFT_MIN_SEG;
export const DRIFT_PERIOD = driftMod.CONSTANTS.DRIFT_PERIOD;

export function planSegments({ resolved, avatarJobs, total }) {
  const repl = [];
  for (const c of resolved.filter((c) => c.placement === 'fullframe')) {
    repl.push({ kind: 'graphic', id: c.id, start: c.start,
      end: Math.min(+(c.start + c.duration).toFixed(3), total) });
  }
  for (const j of avatarJobs.filter((j) => j.kind === 'avatar-full')) {
    repl.push({ kind: 'avatar', id: j.id, start: j.start,
      end: Math.min(j.end, total) });
  }
  repl.sort((a, b) => a.start - b.start);
  for (let i = 1; i < repl.length; i++) {
    if (repl[i].start < repl[i - 1].end - EPS) {
      throw new Error(`overlapping base segments: ${repl[i - 1].id} ends ${repl[i - 1].end}, ${repl[i].id} starts ${repl[i].start}`);
    }
  }
  const segments = [];
  let t = 0;
  let n = 0;
  for (const r of repl) {
    const start = Math.max(r.start, t);
    if (start > t + EPS) {
      n++;
      segments.push({ kind: 'screen', id: `screen-${String(n).padStart(2, '0')}`, start: t, end: start });
    }
    segments.push({ ...r, start });
    t = Math.max(t, r.end);
  }
  if (total > t + EPS) {
    n++;
    segments.push({ kind: 'screen', id: `screen-${String(n).padStart(2, '0')}`, start: t, end: total });
  }
  return segments;
}

export function planSegmentOverlays(segments, overlays) {
  return segments.map((seg) => {
    const local = [];
    for (const o of overlays) {
      const s = Math.max(o.start, seg.start);
      const e = Math.min(o.end, seg.end);
      if (e - s > 0.01) {
        local.push({
          id: o.id,
          file: o.file,
          trimStart: +Math.max(seg.start - o.start, 0).toFixed(3),
          at: +(s - seg.start).toFixed(3),
          until: +(e - seg.start).toFixed(3),
        });
      }
    }
    return local;
  });
}

export const SLIVER_GRAPHIC = 2.5;
export const SLIVER_AVATAR = 1.0;

export function absorbSlivers(segments, { graphicMax = SLIVER_GRAPHIC, avatarMax = SLIVER_AVATAR } = {}) {
  const currentSegments = JSON.parse(JSON.stringify(segments));
  let changed = true;
  while (changed) {
    changed = false;
    for (let j = 0; j < currentSegments.length; j++) {
      const seg = currentSegments[j];
      if (seg.kind !== 'screen') continue;
      const dur = +(seg.end - seg.start).toFixed(3);
      const prev = j > 0 ? currentSegments[j - 1] : null;
      const next = j < currentSegments.length - 1 ? currentSegments[j + 1] : null;
      
      let absorbed = false;
      if (dur <= graphicMax) {
        if (prev && prev.kind === 'graphic') {
          prev.end = seg.end;
          prev.padEnd = +( (prev.padEnd || 0) + dur ).toFixed(3);
          absorbed = true;
        } else if (next && next.kind === 'graphic') {
          next.start = seg.start;
          next.padStart = +( (next.padStart || 0) + dur ).toFixed(3);
          absorbed = true;
        }
      }
      if (!absorbed && dur <= avatarMax) {
        if (prev && prev.kind === 'avatar') {
          prev.end = seg.end;
          prev.padEnd = +( (prev.padEnd || 0) + dur ).toFixed(3);
          absorbed = true;
        } else if (next && next.kind === 'avatar') {
          next.start = seg.start;
          next.padStart = +( (next.padStart || 0) + dur ).toFixed(3);
          absorbed = true;
        }
      }
      
      if (absorbed) {
        currentSegments.splice(j, 1);
        changed = true;
        break;
      }
    }
  }
  return currentSegments;
}

export const planTransitions = (segments, overlays, opts = {}) => {
  return whipMod.plan({ segments, overlays }).map(t => ({
    at: t.at,
    direction: t.direction,
    fromIdx: t.fromIdx,
    toIdx: t.toIdx
  }));
};

export const planAvatarBeats = (seg, words, opts = {}) => {
  const cueTimes = opts.cueTimes || [];
  const dummyResolved = cueTimes.map(t => ({ placement: 'overlay', start: t }));
  const instances = beatsMod.plan({ segments: [{ ...seg, kind: 'avatar' }], words, resolved: dummyResolved });
  return instances.map(i => i.at);
};

export const splitAvatarSegments = (segments, words, opts = {}) => {
  const cueTimes = opts.cueTimes || [];
  const dummyResolved = cueTimes.map(t => ({ placement: 'overlay', start: t }));
  const instances = beatsMod.plan({ segments, words, resolved: dummyResolved });
  return beatsMod.transformSegments(segments, instances, { words, resolved: dummyResolved });
};

export const driftVF = (screenOrdinal, dur, w, h, opts = {}) => {
  const ctx = { dur, w, h };
  const seg = { kind: 'screen', id: 'dummy' };
  const direction = screenOrdinal % 2 === 0 ? 'in' : 'out';
  const instance = { segId: 'dummy', direction };
  const res = driftMod.contribute(seg, [instance], ctx);
  return res && res.vfSuffix ? res.vfSuffix : '';
};

export function encoderArgs({ encoder, draft }) {
  if (encoder === 'videotoolbox') {
    return ['-c:v', 'h264_videotoolbox', '-b:v', draft ? '4M' : '12M', '-pix_fmt', 'yuv420p'];
  }
  return draft
    ? ['-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28']
    : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18'];
}

export function detectEncoder() {
  const res = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  return (res.stdout || '').includes('h264_videotoolbox') ? 'videotoolbox' : 'x264';
}

export function assemblyMd(video, segments, overlays, total, outPath, transitions = [], captions = 'on', drift = 'on') {
  const getSegId = (s) => s.sub !== undefined ? `${s.id}.${s.sub + 1}` : s.id;
  const seg = segments.map((s) =>
    `| ${mmss(s.start)} | ${mmss(s.end)} | ${s.kind} | ${getSegId(s)} |`);
  const ov = overlays.map((o) =>
    `| ${mmss(o.start)} | ${mmss(o.end)} | ${path.basename(o.file)} |`);
  const transSentence = transitions.length > 0
    ? 'Whip transitions at the listed boundaries; hard cuts elsewhere.'
    : 'Hard cuts.';

  const capSentence = captions === 'on' ? ' Captions burned on screen segments.' : '';
  const driftSentence = drift === 'on' ? ' Ken Burns drift on screen segments.' : '';

  const lines = [
    `# ${video} — assembly`,
    '',
    `Master timeline = voiceover (${total.toFixed(1)}s starts at 00:00.0; any editor-timeline offset is NOT applied here). Audio: vo.mp3 throughout — screen and avatar audio muted. ${transSentence}${capSentence}${driftSentence}`,
    '',
    `Output: ${outPath}`,
    '',
    '## Base track',
    '',
    '| from | to | source | id |',
    '|---|---|---|---|',
    ...seg,
    '',
    '## Overlays (composited on top)',
    '',
    '| at | until | file |',
    '|---|---|---|',
    ...ov,
    ''
  ];

  if (transitions.length > 0) {
    const tr = transitions.map((t) =>
      `| ${mmss(t.at)} | ${t.direction} | ${getSegId(segments[t.fromIdx])} | ${getSegId(segments[t.toIdx])} |`);
    lines.push(
      '## Transitions',
      '',
      '| at | direction | from | to |',
      '|---|---|---|---|',
      ...tr,
      ''
    );
  }

  return lines.join('\n');
}

function parseArgs(argv) {
  const opts = { workdir: null, screen: null, screenOffset: 0, out: null, draft: false, encoder: null, keepTemp: false, force: false, transitions: 'whip', beats: 'on', captions: 'on', drift: 'on', effects: 'on', bubble: 'on', jobs: 3, noCache: false, bare: false };
  const rest = [...argv];
  opts.workdir = rest.shift();
  while (rest.length) {
    const a = rest.shift();
    if (a === '--screen') opts.screen = rest.shift();
    else if (a === '--screen-offset') opts.screenOffset = parseFloat(rest.shift());
    else if (a === '--out') opts.out = rest.shift();
    else if (a === '--draft') opts.draft = true;
    else if (a === '--encoder') {
      const e = rest.shift();
      if (e !== 'x264' && e !== 'videotoolbox') throw new Error('--encoder must be x264 or videotoolbox');
      opts.encoder = e;
    }
    else if (a === '--transitions') {
      const t = rest.shift();
      if (t !== 'whip' && t !== 'none') throw new Error('--transitions must be whip or none');
      opts.transitions = t;
    }
    else if (a === '--beats') {
      const b = rest.shift();
      if (b !== 'on' && b !== 'off') throw new Error('--beats must be on or off');
      opts.beats = b;
    }
    else if (a === '--captions') {
      const c = rest.shift();
      if (c !== 'on' && c !== 'off') throw new Error('--captions must be on or off');
      opts.captions = c;
    }
    else if (a === '--drift') {
      const d = rest.shift();
      if (d !== 'on' && d !== 'off') throw new Error('--drift must be on or off');
      opts.drift = d;
    }
    else if (a === '--effects') {
      const e = rest.shift();
      if (e !== 'on' && e !== 'off') throw new Error('--effects must be on or off');
      opts.effects = e;
    }
    else if (a === '--bubble') {
      const b = rest.shift();
      if (b !== 'on' && b !== 'off') throw new Error('--bubble must be on or off');
      opts.bubble = b;
    }
    else if (a === '--keep-temp') opts.keepTemp = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--jobs') opts.jobs = parseInt(rest.shift(), 10);
    else if (a === '--no-cache') opts.noCache = true;
    else if (a === '--bare') opts.bare = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  if (opts.bare) {
    const hasCapOn = argv.findIndex(x => x === '--captions') >= 0 && argv[argv.findIndex(x => x === '--captions')+1] === 'on';
    const hasDriftOn = argv.findIndex(x => x === '--drift') >= 0 && argv[argv.findIndex(x => x === '--drift')+1] === 'on';
    const hasTransWhip = argv.findIndex(x => x === '--transitions') >= 0 && argv[argv.findIndex(x => x === '--transitions')+1] === 'whip';
    if (hasCapOn || hasDriftOn || hasTransWhip) throw new Error('--bare cannot be combined with explicit --captions on or --drift on or --transitions whip');
    opts.captions = 'off';
    opts.drift = 'off';
    opts.transitions = 'none';
  }
  return opts;
}

export async function runAssembly({ workdir, video = 'it', resolved, avatarJobs = [], cornerJobs = [], total, screen, screenOffset = 0, out, draft = false, encoder = detectEncoder(), keepTemp = false, transitions = 'whip', beats = 'on', captions = 'on', drift = 'on', effects = 'on', bubble = 'on', words = [], jobsN = 3, noCache = false }) {
  let segments = planSegments({ resolved, avatarJobs, total });
  segments = absorbSlivers(segments);

  const renderDir = path.join(workdir, 'renders');
  const overlays = resolved.filter(c => c.placement === 'overlay').map(c => {
    return { id: c.id, start: c.start, end: c.start + c.duration, file: path.join(renderDir, planRender(c).outFile) };
  });

  const tmpDir = path.join(workdir, 'assembly-tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const cacheDir = path.join(workdir, 'assembly-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const now = Date.now();
  if (fs.existsSync(cacheDir)) {
    for (const f of fs.readdirSync(cacheDir)) {
      if (f.endsWith('.ts')) {
        const p = path.join(cacheDir, f);
        if (now - fs.statSync(p).mtimeMs > 14 * 24 * 60 * 60 * 1000) fs.rmSync(p);
      }
    }
  }

  const { w, h } = draft ? { w: 1280, h: 720 } : { w: CANVAS.w, h: CANVAS.h };
  const VF = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`;
  const ENC = encoderArgs({ encoder, draft });

  const effectFlags = {
    whip: transitions !== 'none',
    beat: beats === 'on',
    captions: captions === 'on',
    drift: drift === 'on',
    bubble: bubble === 'on'
  };

  const manifestPath = path.join(workdir, 'effects.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { instances: [] };

  const defaultInstances = [];
  const enabledInstances = [];
  
  let ctx = { segments, overlays, words, resolved, avatarJobs, cornerJobs, total, w, h, VF, screen };
  
  for (const mod of EFFECT_MODULES) {
    if (mod.plan) {
      const modInstances = mod.plan(ctx);
      defaultInstances.push(...modInstances);
      
      for (const inst of modInstances) {
        const isEnabled = effectFlags[inst.type] !== false && effects !== 'off';
        const override = manifest.instances.find(m => m.id === inst.id);
        if (override) {
          if (isEnabled && override.enabled !== false) {
            enabledInstances.push({ ...inst, ...override, enabled: true });
          }
        } else if (isEnabled) {
          enabledInstances.push(inst);
        }
      }
    }
    
    if (mod.transformSegments) {
      const modEnabledInsts = enabledInstances.filter(i => i.type === mod.TYPE);
      segments = mod.transformSegments(segments, modEnabledInsts, ctx);
      ctx.segments = segments;
    }
  }

  if (manifest.instances && effects !== 'off') {
    for (const m of manifest.instances) {
      if (!defaultInstances.some(inst => inst.id === m.id)) {
        console.warn(`warning: ignoring effects.json instance with unknown id: ${m.id}`);
      }
    }
  }

  const segOverlays = planSegmentOverlays(segments, overlays);
  
  let capDir = null;
  let capChunks = [];
  const capInstances = enabledInstances.filter(i => i.type === 'captions');
  if (capInstances.length > 0) {
    const inst = capInstances[0];
    capChunks = planCaptions(words);
    const screenChunks = capChunks.filter(c => 
      segments.some(seg => seg.kind === 'screen' && c.start < seg.end && c.end > seg.start)
    );
    if (screenChunks.length > 0) {
      capDir = path.join(tmpDir, 'captions');
      fs.mkdirSync(capDir, { recursive: true });
      const capWidth = Math.round(w * 0.86);
      const capFontPx = Math.round((inst.fontPx || captionsMod.CONSTANTS.CAP_FONT_PX) * h / 1080);
      
      const outline = Math.max(2, Math.floor(capFontPx / 16));
      const marginV = h - Math.round(h * (inst.yFrac !== undefined ? inst.yFrac : captionsMod.CONSTANTS.CAP_Y_FRAC));
      const whipInstancesTmp = enabledInstances.filter(i => i.type === 'whip');
      
      for (const seg of segments) {
        if (seg.kind !== 'screen') continue;
        const tIn = whipInstancesTmp.find(t => Math.abs(t.at - seg.start) < 0.01);
        const startTrim = tIn ? TRANSITION_DUR / 2 : 0;
        
        let assBody = '';
        for (const c of capChunks) {
          const cAt = c.start - seg.start - startTrim;
          const cUntil = c.end - seg.start - startTrim;
          if (cUntil > 0 && cAt < (seg.end - seg.start)) {
            const startStr = formatAssTime(Math.max(0, cAt));
            const endStr = formatAssTime(cUntil);
            const textASS = c.words.map(w => w.hl ? `{\\1c&H3C92FB&}${assEscape(w.text)}{\\1c&HFFFFFF&}` : assEscape(w.text)).join(' ');
            assBody += `Dialogue: 0,${startStr},${endStr},Cap,,0,0,0,,${textASS}\n`;
          }
        }
        
        if (assBody) {
          const assHead = `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Helvetica,${capFontPx},&H00FFFFFF,&H00000000,&H00000000,1,${outline},0,2,40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
          fs.writeFileSync(path.join(capDir, `seg-${seg.id}.ass`), assHead + assBody);
        }
      }
    }
  }

  const whipInstances = enabledInstances.filter(i => i.type === 'whip');
  
  const concatLines = [];
  let segIndex = 1;
  const jobs = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const L = segOverlays[i];
    const segFileStr = `seg-${String(segIndex).padStart(3, '0')}-${seg.id}.ts`;
    const segFile = path.join(tmpDir, segFileStr);
    concatLines.push(`file '${segFileStr}'`);
    segIndex++;

    let startTrim = 0;
    let endTrim = 0;
    
    const tOut = whipInstances.find(t => Math.abs(t.at - seg.end) < 0.01);
    const tIn = whipInstances.find(t => Math.abs(t.at - seg.start) < 0.01);
    
    if (tOut) endTrim = TRANSITION_DUR / 2;
    if (tIn) startTrim = TRANSITION_DUR / 2;

    const dur = seg.end - seg.start - startTrim - endTrim;
    let src = '';
    let seekArgs = [];

    const pStart = seg.padStart || 0;
    const actualPadStart = Math.max(0, pStart - startTrim);
    if (seg.kind === 'screen') {
      seekArgs = ['-ss', String(seg.start + screenOffset + startTrim), '-to', String(seg.end + screenOffset - endTrim)];
      src = screen;
    } else if (seg.kind === 'avatar') {
      const job = avatarJobs.find(j => j.id === seg.id);
      src = job.file;
      const contentStartTrim = Math.max(0, startTrim - pStart);
      seekArgs = ['-ss', String(seg.start + pStart - job.start + contentStartTrim)];
    } else if (seg.kind === 'graphic') {
      const cue = resolved.find(c => c.id === seg.id);
      src = path.join(renderDir, planRender(cue).outFile);
    }
    
    let punchVF = VF;
    const contribCtx = { ...ctx, dur, startTrim, endTrim, capDir, capChunks };
    let finalVFSuffix = '';
    let inputs = [];
    let fragments = [];
    
    for (const mod of EFFECT_MODULES) {
      if (mod.contribute) {
        const insts = enabledInstances.filter(inst => inst.type === mod.TYPE);
        if (insts.length > 0) {
          const contrib = mod.contribute(seg, insts, contribCtx);
          if (contrib) {
            if (contrib.vfSuffix) finalVFSuffix += contrib.vfSuffix;
            if (contrib.inputs) {
              const offset = inputs.length;
              inputs.push(...contrib.inputs);
              const numInputs = contrib.inputs.filter(x => x === '-i').length;
              if (contrib.chainFragments) {
                for (const frag of contrib.chainFragments) {
                  fragments.push({ frag, offset, numInputs });
                }
              }
            } else if (contrib.chainFragments) {
              for (const frag of contrib.chainFragments) {
                fragments.push({ frag, offset: 0, numInputs: 0 });
              }
            }
          }
        }
      }
    }
    
    punchVF += finalVFSuffix;
    
    let needsComplex = false;
    if (L && L.length > 0) needsComplex = true;
    if (fragments.length > 0) needsComplex = true;

    let spawnArgs = [];

    if (needsComplex) {
      const padStartFilter = actualPadStart > 0 ? `,tpad=start_mode=clone:start_duration=${actualPadStart}` : '';
      let chain = `[0:v]${punchVF}${padStartFilter},tpad=stop_mode=clone:stop_duration=30[b0];`;
      let lastV = 'b0';
      
      let allInputs = [];
      let globalInputIdx = 1;

      if (L && L.length > 0) {
        for (const o of L) allInputs.push('-i', o.file);
        for (let j = 0; j < L.length; j++) {
          const o = L[j];
          const oj = `o${j}`;
          const nextV = `b${j + 1}`;
          const adjustedAt = +(o.at - startTrim).toFixed(3);
          const adjustedUntil = +(o.until - startTrim).toFixed(3);
          chain += `[${globalInputIdx}:v]trim=start=${o.trimStart},setpts=PTS-STARTPTS+${adjustedAt}/TB,scale=${w}:${h}[${oj}];`;
          chain += `[${lastV}][${oj}]overlay=eof_action=pass:enable='between(t,${adjustedAt},${adjustedUntil})'[${nextV}];`;
          lastV = nextV;
          globalInputIdx++;
        }
      }
      
      if (fragments.length > 0) {
        allInputs.push(...inputs);
        let inputsProcessed = 0;
        for (const { frag, offset, numInputs } of fragments) {
          // the frag receives inputOffset corresponding to its inputs start
          // wait, inputs from all modules are concatenated into `inputs` array.
          // how many inputs were BEFORE this module?
          // Since we pushed in order, globalInputIdx + (number of -i before this module).
          // We can just calculate number of -i in `inputs.slice(0, offset)`.
          const numBefore = inputs.slice(0, offset).filter(x => x === '-i').length;
          const state = { inputOffset: globalInputIdx + numBefore };
          const res = frag(lastV, state);
          chain += res.chain;
          lastV = res.nextV;
        }
      }
      
      if (chain.endsWith(';')) chain = chain.slice(0, -1);
      
      spawnArgs = [
        '-y', ...seekArgs, '-i', src, ...allInputs,
        '-filter_complex', chain, '-map', `[${lastV}]`,
        '-t', String(dur), '-an', ...ENC, '-f', 'mpegts', segFile
      ];
    } else {
      spawnArgs = [
        '-y', ...seekArgs, '-i', src,
        '-vf', `${punchVF}${actualPadStart > 0 ? ',tpad=start_mode=clone:start_duration=' + actualPadStart : ''},tpad=stop_mode=clone:stop_duration=30`,
        '-t', String(dur), '-an', ...ENC, '-f', 'mpegts', segFile
      ];
    }

    jobs.push({ outFile: segFile, args: spawnArgs, label: `segment ${seg.id}` });

    if (tOut) {
      const bSegsRes = whipMod.boundarySegments(tOut, {
        ...ctx, screenOffset, ENC,
        graphicFile: (cue) => path.join(renderDir, planRender(cue).outFile)
      });
      if (bSegsRes && bSegsRes.extraSegments) {
        for (const ex of bSegsRes.extraSegments) {
          const transStr = `seg-${String(segIndex).padStart(3, '0')}-${ex.fileTag}.ts`;
          const transFile = path.join(tmpDir, transStr);
          concatLines.push(`file '${transStr}'`);
          segIndex++;
          
          const spawnArgsEx = ['-y', ...ex.sliceArgs,
            '-filter_complex', ex.chain, '-map', '[v]',
            '-t', String(ex.dur), '-an', ...ENC, '-f', 'mpegts', transFile];
          
          jobs.push({ outFile: transFile, args: spawnArgsEx, label: `transition ${ex.fileTag}` });
        }
      }
    }
  }

  let cacheHits = 0;
  let cacheMisses = 0;

  async function runPool(jobsList, jobsNWorkers) {
    let i = 0; let failed = null;
    async function worker() {
      while (i < jobsList.length && !failed) {
        const job = jobsList[i++];
        const key = jobKey(job.args);
        const cachePath = path.join(cacheDir, `${key}.ts`);

        if (!noCache && fs.existsSync(cachePath)) {
          fs.copyFileSync(cachePath, job.outFile);
          cacheHits++;
          continue;
        }

        const res = await new Promise((resolve) => {
          import('node:child_process').then(({ spawn }) => {
            const p = spawn('ffmpeg', job.args, { stdio: ['ignore', 'ignore', 'pipe'] });
            let err = '';
            p.stderr.setEncoding('utf8');
            p.stderr.on('data', (d) => { err += d; });
            p.on('close', (code) => resolve({ code, err }));
          });
        });

        if (res.code !== 0) failed = { job, err: res.err };
        else {
          cacheMisses++;
          fs.copyFileSync(job.outFile, cachePath);
        }
      }
    }
    await Promise.all(Array.from({ length: jobsNWorkers }, worker));
    if (failed) {
      console.error(`ffmpeg failed for ${failed.job.label}\n${failed.err.slice(-2000)}`);
      process.exit(1);
    }
  }

  await runPool(jobs, jobsN);
  console.log(`segments: ${cacheHits} cached, ${cacheMisses} encoded (jobs=${jobsN})`);

  const voPath = path.join(workdir, 'vo.mp3');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'concat.txt'), concatLines.join('\n') + '\n');
  
  const finalArgs = [
    '-y', '-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-i', path.resolve(voPath),
    '-map', '0:v', '-c:v', 'copy', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k',
    '-t', String(total), '-movflags', '+faststart', out
  ];
  const finalRes = spawnSync('ffmpeg', finalArgs, { cwd: tmpDir, encoding: 'utf8' });
  if (finalRes.status !== 0) {
    console.error(finalRes.stderr);
    process.exit(1);
  }

  const probeRes = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' });
  const actualTotal = parseFloat(probeRes.stdout);
  if (Math.abs(actualTotal - total) > 0.5) {
    console.error(`mismatched duration: ${actualTotal} != ${total}`);
    process.exit(1);
  }

  const streamProbe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', out], { encoding: 'utf8' });
  if (streamProbe.stdout.trim() !== `${w}x${h}`) {
    console.error(`mismatched video resolution: ${streamProbe.stdout.trim()} != ${w}x${h}`);
    process.exit(1);
  }

  const audioProbe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', out], { encoding: 'utf8' });
  if (!audioProbe.stdout.includes('audio')) {
    console.error('mismatched audio: missing audio stream');
    process.exit(1);
  }

  const transitionsObj = whipInstances.map(t => {
    const toIdx = segments.findIndex(s => Math.abs(s.start - t.at) < 0.01);
    const fromIdx = toIdx - 1;
    return { at: t.at, direction: t.direction, fromIdx, toIdx };
  });

  const assemblyMdContent = assemblyMd(video, segments, overlays, total, out, transitionsObj, captions, drift);
  fs.writeFileSync(path.join(workdir, 'assembly.md'), assemblyMdContent);

  if (!keepTemp) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`assembled: ${out} (${mmss(total)})`);
  return;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.workdir) {
    console.error('usage: node lib/assemble.mjs <slug-or-path> [--screen <path>] [--screen-offset <sec>] [--out <path>] [--draft] [--encoder x264|videotoolbox] [--keep-temp] [--force] [--captions on|off] [--drift on|off] [--bubble on|off] [--effects on|off]');
    process.exit(1);
  }

  if (opts.captions === 'on') {
    const ffprobeRes = spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' });
    if (!ffprobeRes.stdout.includes(' subtitles ')) {
      console.error('ffmpeg lacks the subtitles filter (libass required)');
      process.exit(1);
    }
  }

  const workdir = resolveWorkdir(opts.workdir);
  const cuesPath = path.join(workdir, 'cues.json');
  
  const cuesFile = JSON.parse(fs.readFileSync(cuesPath, 'utf8'));
  if (cuesFile.approved !== true && !opts.force) {
    console.error('refusing to render: cues.json approved=false — review on the board (node lib/board.mjs <slug>) or pass --force');
    process.exit(1);
  }

  const resolvedPath = path.join(workdir, 'resolved.json');
  const { video, resolved } = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

  const cardLibraryRoot = path.resolve(import.meta.dirname, '..', '..', 'card-library');
  const words = JSON.parse(fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(path.join(cardLibraryRoot, 'catalog.json'), 'utf8'));
  const recomputed = resolveCues(cuesFile.cues, words, catalog, cardLibraryRoot);
  const fresh = recomputed.errors.length === 0
    && JSON.stringify(recomputed.resolved) === JSON.stringify(resolved);
  if (!fresh && !opts.force) {
    console.error('resolved.json is stale or cues.json no longer resolves — re-run node lib/resolve.mjs <slug>');
    process.exit(1);
  }

  const shotsPath = path.join(workdir, 'shots.json');
  const avatarJobsPath = path.join(workdir, 'avatar-jobs.json');
  let avatarJobs = [];
  let cornerJobs = [];
  if (fs.existsSync(shotsPath)) {
    const shotsFile = JSON.parse(fs.readFileSync(shotsPath, 'utf8'));
    if (shotsFile.approved !== true && !opts.force) {
      console.error('shots.json approved=false');
      process.exit(1);
    }
    if (!fs.existsSync(avatarJobsPath)) {
      console.error('run "download the avatar videos" first');
      process.exit(1);
    }
    const avatarJobsFile = JSON.parse(fs.readFileSync(avatarJobsPath, 'utf8'));
    avatarJobs = avatarJobsFile.jobs.filter(j => j.kind === 'avatar-full');
    // Corner chunks composited as the top-right bubble (plan 100). Absent files
    // are dropped so the bubble module simply no-ops rather than failing assembly.
    cornerJobs = avatarJobsFile.jobs.filter(j => j.kind === 'corner' && j.file && fs.existsSync(j.file));
    const missing = avatarJobs.filter(j => !j.file || !fs.existsSync(j.file));
    if (missing.length > 0) {
      const missingIds = missing.map(j => j.id).join(', ');
      console.error(`run "download the avatar videos" first. missing: ${missingIds}`);
      process.exit(1);
    }
  }

  const effectsGatePath = path.join(workdir, 'effects.json');
  if (fs.existsSync(effectsGatePath)) {
    const effectsFile = JSON.parse(fs.readFileSync(effectsGatePath, 'utf8'));
    if (effectsFile.approved !== true && !opts.force) {
      console.error('refusing to render: effects.json approved=false — review the effects lane on the board (node lib/board.mjs <slug>) or pass --force');
      process.exit(1);
    }
  }

  const voPath = path.join(workdir, 'vo.mp3');
  const screen = opts.screen ?? path.join(workdir, 'screen.mp4');
  if (!fs.existsSync(voPath)) {
    console.error(`missing file: ${voPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(screen)) {
    console.error(`missing file: ${screen}`);
    process.exit(1);
  }

  const renderDir = path.join(workdir, 'renders');
  const missingRenders = resolved.filter(c => !fs.existsSync(path.join(renderDir, planRender(c).outFile)));
  if (missingRenders.length > 0) {
    const missingIds = missingRenders.map(c => c.id).join(', ');
    console.error(`run node lib/render.mjs first. missing renders: ${missingIds}`);
    process.exit(1);
  }

  const probeVo = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voPath], { encoding: 'utf8' });
  const total = parseFloat(probeVo.stdout);

  const probeScreen = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', screen], { encoding: 'utf8' });
  const screenDuration = parseFloat(probeScreen.stdout);
  const segments = planSegments({ resolved, avatarJobs, total });
  const lastScreen = segments.findLast(s => s.kind === 'screen');
  if (lastScreen && screenDuration + opts.screenOffset < lastScreen.end - 2.0) {
    console.warn('warning: screen source duration + offset is more than 2s short of the last screen segment end');
  }

  const out = opts.out ?? path.join(ASSEMBLE_MEDIA_ROOT, video, opts.draft ? 'final-draft.mp4' : 'final.mp4');
  await runAssembly({ workdir, video, resolved, avatarJobs, cornerJobs, total, screen, screenOffset: opts.screenOffset, out, draft: opts.draft, encoder: opts.encoder ?? detectEncoder(), keepTemp: opts.keepTemp, transitions: opts.transitions, beats: opts.beats, captions: opts.captions, drift: opts.drift, effects: opts.effects, bubble: opts.bubble, words, jobsN: opts.jobs, noCache: opts.noCache });
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

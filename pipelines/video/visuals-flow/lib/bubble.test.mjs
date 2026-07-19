import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { plan, contribute, bubbleGeometry, bubbleSlices, CONSTANTS } from './effects/bubble.mjs';

test('plan emits one bubble instance', () => {
  const insts = plan({});
  assert.strictEqual(insts.length, 1);
  assert.strictEqual(insts[0].type, 'bubble');
  assert.strictEqual(insts[0].id, 'bubble');
  assert.strictEqual(insts[0].enabled, true);
});

test('bubbleGeometry integer values at 1080p and 720p', () => {
  const g1 = bubbleGeometry(1920, 1080);
  assert.strictEqual(g1.D, 150);
  assert.strictEqual(g1.R, 75);
  assert.strictEqual(g1.RING, 3);
  assert.strictEqual(g1.INSET, 40);
  assert.deepStrictEqual([g1.rr, g1.gg, g1.bb], [251, 146, 60]);
  assert.strictEqual(g1.OX, 1920 - 40 - 150);
  assert.strictEqual(g1.OY, 40);

  const g2 = bubbleGeometry(1280, 720);
  assert.strictEqual(g2.D, 100);
  assert.strictEqual(g2.R, 50);
  assert.ok(Number.isInteger(g2.RING) && g2.RING >= 1);
  assert.ok(Number.isInteger(g2.INSET));
});

test('contribute returns null for non-screen segments', () => {
  const ctx = { w: 1920, h: 1080, cornerJobs: [{ file: 'a.mp4', start: 0, end: 15 }] };
  const inst = plan({});
  assert.strictEqual(contribute({ kind: 'avatar', start: 0, end: 10 }, inst, ctx), null);
  assert.strictEqual(contribute({ kind: 'graphic', start: 0, end: 10 }, inst, ctx), null);
});

test('contribute returns null when cornerJobs empty or filesless', () => {
  const inst = plan({});
  const seg = { kind: 'screen', start: 0, end: 10 };
  assert.strictEqual(contribute(seg, inst, { w: 1920, h: 1080, cornerJobs: [] }), null);
  assert.strictEqual(contribute(seg, inst, { w: 1920, h: 1080 }), null);
  // corner rows with no downloaded file → dropped → no-op
  assert.strictEqual(
    contribute(seg, inst, { w: 1920, h: 1080, cornerJobs: [{ start: 0, end: 15 }] }),
    null
  );
});

test('contribute slice arithmetic across a chunk boundary', () => {
  // screen seg 10-20s over two contiguous corner chunks 0-15 + 15-30.
  const seg = { kind: 'screen', start: 10, end: 20 };
  const cornerJobs = [
    { file: 'a.mp4', start: 0, end: 15, kind: 'corner' },
    { file: 'b.mp4', start: 15, end: 30, kind: 'corner' }
  ];
  const ctx = { w: 1920, h: 1080, startTrim: 0, endTrim: 0, cornerJobs };

  const slices = bubbleSlices(seg, cornerJobs, ctx);
  assert.strictEqual(slices.length, 2);
  // chunk a overlap 10-15: seek 10 into a, shows segment-local 0-5
  assert.deepStrictEqual(slices[0], { file: 'a.mp4', sliceStart: 10, overlapDur: 5, at: 0, until: 5 });
  // chunk b overlap 15-20: seek 0 into b, shows segment-local 5-10 (boundary at t=5)
  assert.deepStrictEqual(slices[1], { file: 'b.mp4', sliceStart: 0, overlapDur: 5, at: 5, until: 10 });

  const contrib = contribute(seg, plan({}), ctx);
  assert.deepStrictEqual(contrib.inputs, [
    '-ss', '10', '-t', '5', '-i', 'a.mp4',
    '-ss', '0', '-t', '5', '-i', 'b.mp4'
  ]);
  assert.strictEqual(contrib.chainFragments.length, 1);
  const { chain, nextV } = contrib.chainFragments[0]('b0', { inputOffset: 1 });
  // two overlaps, indexed at inputOffset and inputOffset+1
  assert.ok(chain.includes('[1:v]'), 'first chunk uses input index 1');
  assert.ok(chain.includes('[2:v]'), 'second chunk uses input index 2');
  assert.ok(chain.includes("enable='between(t,0.000,5.000)'"), 'first enable window');
  assert.ok(chain.includes("enable='between(t,5.000,10.000)'"), 'second enable window');
  assert.strictEqual(nextV, 'bb_1');
  // format=rgba precedes every geq (alpha math in RGB space)
  const geqCount = (chain.match(/geq=/g) || []).length;
  const rgbaCount = (chain.match(/format=rgba,geq=/g) || []).length;
  assert.strictEqual(geqCount, rgbaCount, 'every geq is preceded by format=rgba');
  assert.ok(chain.includes('cos('), 'gradient includes cos');
  assert.ok(chain.includes('sin('), 'gradient includes sin');
  assert.ok(chain.includes('pow('), 'gradient includes pow');
  assert.ok(chain.includes('T+10'), 'phase constant T+10');
  assert.ok(chain.includes('251+'), 'base red 251');
  assert.ok(chain.includes('255-251'), 'highlight red 255 minus base red');
});

test('contribute assigns phase constants per segment', () => {
  const ctx = { w: 1920, h: 1080, startTrim: 0, cornerJobs: [{ file: 'a.mp4', start: 0, end: 100 }] };
  const c1 = contribute({ kind: 'screen', start: 10, end: 20 }, plan({}), ctx);
  const { chain: chain1 } = c1.chainFragments[0]('b0', { inputOffset: 1 });
  assert.ok(chain1.includes('T+10)'), 'segment at 10s uses T+10');

  const c2 = contribute({ kind: 'screen', start: 60, end: 70 }, plan({}), ctx);
  const { chain: chain2 } = c2.chainFragments[0]('b0', { inputOffset: 1 });
  assert.ok(chain2.includes('T+60)'), 'segment at 60s uses T+60');
});

test('contribute honours startTrim in slice + local timing', () => {
  const seg = { kind: 'screen', start: 10, end: 20 };
  const cornerJobs = [{ file: 'a.mp4', start: 0, end: 30, kind: 'corner' }];
  const ctx = { w: 1920, h: 1080, startTrim: 1, endTrim: 0.5, cornerJobs };
  const slices = bubbleSlices(seg, cornerJobs, ctx);
  // visible content is [11, 19.5]; seek 11 into a, local window 0..8.5
  assert.deepStrictEqual(slices, [{ file: 'a.mp4', sliceStart: 11, overlapDur: 8.5, at: 0, until: 8.5 }]);
});

test('pixel proof: masked circle + ring composited at top-right', () => {
  const ff = spawnSync('ffmpeg', ['-hide_banner', '-version']);
  if (ff.status !== 0) return; // skip when ffmpeg is unavailable
  const pil = spawnSync('python3', ['-c', 'import PIL']);
  if (pil.status !== 0) return; // skip when Pillow is unavailable

  const tmp = fs.mkdtempSync(path.join(import.meta.dirname, 'bubble-proof-'));
  try {
    const green = path.join(tmp, 'screen.mp4');
    const white = path.join(tmp, 'corner.mp4');
    const outPng = path.join(tmp, 'frame.png');
    const W = 1280, H = 720;

    for (const [color, file] of [['green', green], ['white', white]]) {
      const r = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i',
        `color=c=${color}:s=${W}x${H}:d=2:r=30`, '-pix_fmt', 'yuv420p', file], { encoding: 'utf8' });
      assert.strictEqual(r.status, 0, r.stderr);
    }

    const seg = { kind: 'screen', start: 0, end: 2 };
    const cornerJobs = [{ file: white, start: 0, end: 30, kind: 'corner' }];
    const ctx = { w: W, h: H, startTrim: 0, endTrim: 0, cornerJobs };
    const contrib = contribute(seg, plan({}), ctx);
    assert.ok(contrib, 'contribute should produce a chain');

    const { chain, nextV } = contrib.chainFragments[0]('b0', { inputOffset: 1 });
    let full = `[0:v]scale=${W}:${H},format=yuv420p[b0];${chain}`;
    if (full.endsWith(';')) full = full.slice(0, -1);

    const r = spawnSync('ffmpeg', ['-y', '-i', green, ...contrib.inputs,
      '-filter_complex', full, '-map', `[${nextV}]`,
      '-frames:v', '1', '-update', '1', outPng], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(fs.existsSync(outPng), 'proof frame written');

    const g = bubbleGeometry(W, H);
    const cx = g.OX + Math.round(g.D / 2); // bubble centre x
    const cy = g.OY + Math.round(g.D / 2); // bubble centre y
    // point inside the crop box but outside the circle (diagonal corner)
    const boxX = g.OX + 3, boxY = g.OY + 3;
    // point on the ring band, straight up from centre
    const ringX = cx, ringY = g.OY + g.RING; // ~top edge of the circle

    const checkScript = `
from PIL import Image
img = Image.open('${outPng}').convert('RGB')
def px(x, y):
    return img.getpixel((x, y))
print('center', *px(${cx}, ${cy}))
print('framecenter', *px(${Math.round(W/2)}, ${Math.round(H/2)}))
print('boxcorner', *px(${boxX}, ${boxY}))
print('ring', *px(${ringX}, ${ringY}))
`;
    const py = spawnSync('python3', ['-c', checkScript], { encoding: 'utf8' });
    assert.strictEqual(py.status, 0, py.stderr);
    const vals = {};
    for (const line of py.stdout.trim().split('\n')) {
      const [k, r0, g0, b0] = line.split(' ');
      vals[k] = [Number(r0), Number(g0), Number(b0)];
    }

    const [cr, cg, cb] = vals.center;
    assert.ok(cr > 200 && cg > 200 && cb > 200, `bubble centre should be white, got ${vals.center}`);

    const [fr, fg, fb] = vals.framecenter;
    assert.ok(fg > 100 && fr < 100 && fb < 100, `frame centre should be green, got ${vals.framecenter}`);

    // The alpha mask is a real circle, not the square crop: the box corner
    // (inside the bounding box, outside the radius) shows the green base.
    const [br, bg, bb2] = vals.boxcorner;
    assert.ok(bg > 100 && br < 100 && bb2 < 100, `box corner should be green (circular mask), got ${vals.boxcorner}`);

    // Ring band carries the brand orange (softened by the glow).
    const [rr, rg, rb] = vals.ring;
    assert.ok(rr > rg && rg > rb && rr > 150, `ring should read orange (r>g>b), got ${vals.ring}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('pixel proof: arc position changes with phase', () => {
  const ff = spawnSync('ffmpeg', ['-hide_banner', '-version']);
  if (ff.status !== 0) return; // skip
  const pil = spawnSync('python3', ['-c', 'import PIL']);
  if (pil.status !== 0) return; // skip

  const tmp = fs.mkdtempSync(path.join(import.meta.dirname, 'bubble-arc-proof-'));
  try {
    const D = 120;
    const R = 60;
    const RING = 4;
    const GLOW = 0;
    const P = 4;
    const K = 2;
    const rr=251, gg=146, bb=60;
    const hr=255, hg=227, hb=194;

    const runFrame = (phase, outFile) => {
      const th = `(2*PI*(T+${phase})/${P})`;
      const wgt = `pow(0.5*(1+((X-${R})*cos(${th})+(Y-${R})*sin(${th}))/max(hypot(X-${R},Y-${R}),1)),${K})`;
      const mix = (base, hi) => `'${base}+(${hi}-${base})*${wgt}'`;
      const geq = `geq=r=${mix(rr, hr)}:g=${mix(gg, hg)}:b=${mix(bb, hb)}:a='if(between(hypot(X-${R},Y-${R}),${R}-${RING}-1,${R}+1),255,0)'`;

      const r = spawnSync('ffmpeg', [
        '-y',
        '-f', 'lavfi', '-i', `color=c=black:s=${D}x${D}:d=0.1`,
        '-f', 'lavfi', '-i', `color=c=0x00000000:s=${D}x${D}:d=0.1`,
        '-filter_complex', `[1:v]format=rgba,${geq}[ring];[0:v][ring]overlay=0:0`,
        '-frames:v', '1',
        outFile
      ], { encoding: 'utf8' });
      assert.strictEqual(r.status, 0, r.stderr);
    };

    const outA = path.join(tmp, 'ringA.png');
    const outB = path.join(tmp, 'ringB.png');
    runFrame(0, outA); // Frame A
    runFrame(2.0, outB); // Frame B

    const checkScript = `
from PIL import Image
imgA = Image.open('${outA}').convert('RGB')
imgB = Image.open('${outB}').convert('RGB')
def b(img, x, y):
    p = img.getpixel((x, y))
    return p[0] + p[1] + p[2]
print('A', b(imgA, 117, 60), b(imgA, 3, 60))
print('B', b(imgB, 117, 60), b(imgB, 3, 60))
`;
    const py = spawnSync('python3', ['-c', checkScript], { encoding: 'utf8' });
    assert.strictEqual(py.status, 0, py.stderr);
    
    const lines = py.stdout.trim().split('\n');
    const [_, aRightStr, aLeftStr] = lines[0].split(' ');
    const [__, bRightStr, bLeftStr] = lines[1].split(' ');
    const aRight = Number(aRightStr), aLeft = Number(aLeftStr);
    const bRight = Number(bRightStr), bLeft = Number(bLeftStr);

    assert.ok(aRight - aLeft >= 60, `Frame A (PHASE=0): right(${aRight}) should be > left(${aLeft}) by >= 60`);
    assert.ok(bLeft - bRight >= 60, `Frame B (PHASE=2.0): left(${bLeft}) should be > right(${bRight}) by >= 60`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

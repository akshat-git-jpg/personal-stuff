import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildFcpxml, frames, rt, srtTime, srtFromCaptions, buildNativeFcpxml, makeSrcUrl, sfxBakeName, bakeSfxClips, bakeVo } from './export-timeline.mjs';
import { screenCaptionChunks, assFromCaptions } from './export-timeline.mjs';
import { VO_CHAIN } from './sound/build-mix.mjs';
import { planCaptions } from './captions.mjs';
import { runAssembly } from './assemble.mjs';

const testTmp = path.join(import.meta.dirname, '.test-tmp', 'export-it');

test('frames/rt basics', () => {
  assert.equal(frames(57.5), 1725);
  assert.equal(frames(0), 0);
  assert.equal(rt(30), '3000/3000s');
});

test('srt basics', () => {
  assert.equal(srtTime(0), '00:00:00,000');
  assert.equal(srtTime(3661.042), '01:01:01,042');
  const srt = srtFromCaptions([{start: 0, end: 1.2, text: 'hi'}, {start: 1.2, end: 2.5, text: 'there'}]);
  assert.ok(srt.includes('1\n00:00:00,000 --> 00:00:01,200\nhi\n\n2\n00:00:01,200 --> 00:00:02,500\nthere\n'));
});

// Regression: --bundle emitted "./media/x.mp4" and Resolve resolved NONE of
// them ("97 of 97 clips were not yet found", best-ai-video-generator
// 2026-08-02). src is a URL; a relative one is not importable.
test('makeSrcUrl: bundled src is an absolute file:// URL into the bundle', () => {
  const dir = path.join(testTmp, 'srcurl-bundle');
  fs.rmSync(dir, { recursive: true, force: true });
  const srcDir = path.join(dir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  const a = path.join(srcDir, 'clip a.mp4');   // space: must be percent-encoded
  fs.writeFileSync(a, 'AAA');
  const exportDir = path.join(dir, 'export');

  const url = makeSrcUrl({ exportDir, bundle: true })(a);

  assert.ok(url.startsWith('file:///'), `expected an absolute file URL, got ${url}`);
  assert.ok(!url.includes('./media'), 'must not emit a relative path');
  assert.ok(url.endsWith('/media/clip%20a.mp4'), `expected a percent-encoded bundled path, got ${url}`);
  // the URL must point at bytes that actually exist
  assert.equal(fs.readFileSync(new URL(url), 'utf8'), 'AAA');
});

test('makeSrcUrl: unbundled src is the absolute URL of the original file', () => {
  const dir = path.join(testTmp, 'srcurl-plain');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const a = path.join(dir, 'clip.mp4');
  fs.writeFileSync(a, 'BBB');
  const url = makeSrcUrl({ exportDir: path.join(dir, 'export'), bundle: false })(a);
  assert.equal(url, pathToFileURL(a).href);
  assert.equal(fs.readFileSync(new URL(url), 'utf8'), 'BBB');
});

// The old code skipped the copy when the basename existed and handed both
// assets the FIRST file's bytes — a silently wrong timeline.
test('makeSrcUrl: a bundle basename collision throws instead of aliasing', () => {
  const dir = path.join(testTmp, 'srcurl-collide');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'one'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'two'), { recursive: true });
  const a = path.join(dir, 'one', 'same.mp4');
  const b = path.join(dir, 'two', 'same.mp4');
  fs.writeFileSync(a, 'AAA');
  fs.writeFileSync(b, 'BBB');
  const srcUrl = makeSrcUrl({ exportDir: path.join(dir, 'export'), bundle: true });
  srcUrl(a);
  assert.throws(() => srcUrl(b), /name collision/);
  // the same file asked for twice is fine (baked mode does not dedupe assets)
  assert.equal(srcUrl(a), srcUrl(a));
});

// Anything already inside the export folder is self-contained; copying it into
// media/ would duplicate it, and vo-processed.wav is ~370 MB on its own.
test('makeSrcUrl: files already inside the export dir are not re-copied', () => {
  const dir = path.join(testTmp, 'srcurl-seg');
  fs.rmSync(dir, { recursive: true, force: true });
  const exportDir = path.join(dir, 'export');
  const segDir = path.join(exportDir, 'segments');
  fs.mkdirSync(segDir, { recursive: true });
  fs.mkdirSync(path.join(exportDir, 'audio'), { recursive: true });
  const seg = path.join(segDir, '0001.mp4');
  const vo = path.join(exportDir, 'audio', 'vo-processed.wav');
  fs.writeFileSync(seg, 'SEG');
  fs.writeFileSync(vo, 'VO');
  const srcUrl = makeSrcUrl({ exportDir, bundle: true });
  assert.equal(srcUrl(seg), pathToFileURL(seg).href);
  assert.equal(srcUrl(vo), pathToFileURL(vo).href);
  assert.ok(!fs.existsSync(path.join(exportDir, 'media', '0001.mp4')), 'segment must not be duplicated into media/');
  assert.ok(!fs.existsSync(path.join(exportDir, 'media', 'vo-processed.wav')), 'baked audio must not be duplicated into media/');
});

test('sfxBakeName: one file per distinct sample/pitch/gain/loop-length', () => {
  const n = (o) => sfxBakeName(o);
  assert.equal(n({ sample: 'pop', semi: 0, gainDb: -16 }), 'sfx-pop-s0-g-16.wav');
  assert.equal(n({ sample: 'pop', semi: 4, gainDb: -16 }), 'sfx-pop-s4-g-16.wav');
  assert.equal(n({ sample: 'pop', semi: 0, gainDb: -16.5 }), 'sfx-pop-s0-g-16.5.wav');
  assert.equal(n({ sample: 'drone_low', semi: 0, gainDb: -30, loop: true, at: 0, end: 86.733 }),
    'sfx-drone_low-s0-g-30-l86.733.wav');
  // same sample, different loop length => different file
  assert.notEqual(n({ sample: 'drone_low', semi: 0, gainDb: -30, loop: true, at: 0, end: 86.733 }),
    n({ sample: 'drone_low', semi: 0, gainDb: -30, loop: true, at: 420, end: 500 }));
});

// Regression: the exporter dropped gainDb, semi and loop entirely, and
// hardcoded a 2.0s duration. Owner heard a -30 dB bed playing at unity
// (2026-08-02).
test('bakeSfxClips: bakes gain, pitch and loop, and dedupes by variant', () => {
  const dir = path.join(testTmp, 'sfx-bake');
  fs.rmSync(dir, { recursive: true, force: true });
  const outDir = path.join(dir, 'audio');
  const calls = [];
  const run = (bin, args) => {
    calls.push({ bin, args });
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(args[args.length - 1], 'WAV');
    return { status: 0 };
  };
  const instances = [
    { id: 'a', sample: 'pop', semi: 0, gainDb: -16, at: 1 },
    { id: 'b', sample: 'pop', semi: 0, gainDb: -16, at: 2 },     // same variant -> reuse
    { id: 'c', sample: 'pop', semi: 4, gainDb: -16, at: 3 },     // pitched -> new file
    { id: 'd', sample: 'drone_low', semi: 0, gainDb: -30, at: 0, loop: true, end: 86.733 },
  ];
  const clips = bakeSfxClips({ instances, outDir, sfxAssetDir: '/sfx', run, probe: () => 0.06 });

  assert.equal(clips.length, 4, 'one clip per instance');
  assert.equal(calls.length, 3, 'four instances collapse to three baked files');
  assert.equal(clips[0].file, clips[1].file, 'identical variants share one file');
  assert.notEqual(clips[0].file, clips[2].file, 'a pitch change is a different file');

  const gainOf = (i) => calls[i].args[calls[i].args.indexOf('-af') + 1];
  assert.ok(gainOf(0).includes('volume=-16dB'), `gain must be baked, got ${gainOf(0)}`);
  assert.ok(!gainOf(0).includes('adelay'), 'offset is the clip position in an NLE, not silence padding');
  assert.ok(gainOf(1).includes('asetrate='), 'pitch must be baked');
  assert.ok(gainOf(2).includes('volume=-30dB') && gainOf(2).includes('atrim=0:86.733'), 'loop must be trimmed and gained');
  // drone_low.wav is 8s of media behind an 86.7s clip: only -stream_loop fills it
  assert.ok(calls[2].args.includes('-stream_loop'), 'a looped bed must actually loop');

  // duration comes from the baked file, never the old hardcoded 2.0
  assert.equal(clips[0].durationSec, 0.06);
});

test('bakeSfxClips: no instances means no ffmpeg and no clips', () => {
  const run = () => { throw new Error('must not run ffmpeg'); };
  assert.deepEqual(bakeSfxClips({ instances: [], outDir: '/nope', sfxAssetDir: '/sfx', run }), []);
});

test('bakeVo: the voiceover lane carries the same chain as the master', () => {
  const dir = path.join(testTmp, 'vo-bake');
  fs.rmSync(dir, { recursive: true, force: true });
  let seen = null;
  const run = (bin, args) => {
    seen = args;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(args[args.length - 1], 'WAV');
    return { status: 0 };
  };
  const out = bakeVo({ voPath: '/vo.mp3', outDir: dir, run });
  assert.equal(path.basename(out), 'vo-processed.wav');
  assert.equal(seen[seen.indexOf('-af') + 1], VO_CHAIN);
  assert.ok(VO_CHAIN.includes('acompressor') && VO_CHAIN.includes('alimiter'));
});

// Regression: the sidecar SRT shipped every caption chunk, so Resolve showed
// captions over the intro motion graphics where the burned video has none.
test('screenCaptionChunks: captions only over screen, never over cards or avatar', () => {
  const words = [];
  for (let i = 0; i < 40; i++) words.push({ text: `w${i}`, start: i, end: i + 0.9 });
  const resolved = [
    { id: 'z01', placement: 'fullframe', start: 0, duration: 10 },   // intro card
    { id: 'c05', placement: 'overlay', start: 12, duration: 3 },     // overlay: screen still visible
    { id: 'z09', placement: 'fullframe', start: 20, duration: 6 },
  ];
  const avatarJobs = [{ id: 'a1', purpose: 'avatar-full', start: 30, end: 36 }];
  const chunks = screenCaptionChunks({ words, resolved, avatarJobs, total: 40 });

  assert.ok(chunks.length > 0, 'screen stretches must still be captioned');
  const covered = (t) => (t >= 0 && t < 10) || (t >= 20 && t < 26) || (t >= 30 && t < 36);
  for (const c of chunks) {
    const mid = (c.start + c.end) / 2;
    assert.ok(!covered(mid), `chunk at ${mid}s sits under a card/avatar and must be dropped`);
  }
  // an overlay does NOT suppress captions — the screen is still what you see
  assert.ok(chunks.some((c) => c.start < 15 && c.end > 12), 'overlay stretches keep their captions');
  // and it really is a subset, not a pass-through
  assert.ok(chunks.length < planCaptions(words).length, 'some chunks must actually be suppressed');
});

// Regression: Resolve anchors a subtitle clip to its first cue, so an SRT
// starting at 25.61s played the whole track 25.61s early.
test('srtFromCaptions: anchors at 00:00:00 so an NLE cannot shift the track', () => {
  const srt = srtFromCaptions([
    { start: 25.61, end: 26.67, text: 'are going to settle' },
    { start: 26.67, end: 29.12, text: 'wins and for who' },
  ]);
  assert.ok(srt.startsWith('1\n00:00:00,000 --> '), `must start at zero, got: ${srt.slice(0, 40)}`);
  // the real cues keep their absolute timecodes
  assert.ok(srt.includes('00:00:25,610 --> 00:00:26,670'), 'real cue keeps its timecode');
  assert.ok(srt.includes('00:00:26,670 --> 00:00:29,120'));
  // anchor is invisible and does not eat into the first real caption
  assert.ok(srt.includes('​'), 'anchor text must be a zero-width space');
  assert.ok(!/00:00:00,000 --> 00:00:2/.test(srt), 'anchor must be short, not a 25s block');
  assert.equal(srt.match(/-->/g).length, 3, 'anchor + 2 cues');
});

test('srtFromCaptions: no anchor when captions already start at zero', () => {
  const srt = srtFromCaptions([{ start: 0, end: 1, text: 'hi' }]);
  assert.equal(srt.match(/-->/g).length, 1, 'no spurious anchor');
  assert.ok(!srt.includes('​'));
  assert.ok(srt.startsWith('1\n00:00:00,000 --> 00:00:01,000\nhi'));
});

// SRT cannot express font, size, position or per-word colour, so the imported
// captions came in as Resolve's oversized all-white default. The ASS twin
// carries the burn's actual style.
test('assFromCaptions: carries the burn style and per-word keyword colour', () => {
  const chunks = [
    { start: 25.61, end: 26.67, words: [{ text: 'costs', hl: false }, { text: '$49', hl: true }] },
  ];
  const ass = assFromCaptions({ chunks, w: 1920, h: 1080 });

  assert.ok(ass.includes('PlayResX: 1920') && ass.includes('PlayResY: 1080'));
  // same style line assemble builds: Helvetica 44, bold, outline 2, bottom-centre
  assert.ok(/Style: Cap,Helvetica,44,&H00FFFFFF,&H00000000,&H00000000,1,2,0,2,40,40,140,1/.test(ass),
    `style line mismatch:\n${ass.split('\n').find((l) => l.startsWith('Style:'))}`);
  // ASS centiseconds, absolute timeline time. Centiseconds FLOOR, exactly as
  // assemble's formatAssTime does — 25.61 lands on .60, and matching the burn
  // matters more than rounding prettily.
  assert.ok(ass.includes('Dialogue: 0,0:00:25.60,0:00:26.67,Cap,'), `absolute ASS timing:\n${ass}`);
  // the highlighted word is orange; ASS colours are BGR, so #fb923c -> 3C92FB
  assert.ok(ass.includes('{\\1c&H3C92FB&}$49{\\1c&HFFFFFF&}'), `keyword colour missing:\n${ass}`);
  assert.ok(/,,costs \{/.test(ass), 'non-keyword stays plain');
});

test('assFromCaptions: margin follows yFrac, size follows canvas height', () => {
  const chunks = [{ start: 0, end: 1, words: [{ text: 'x', hl: false }] }];
  const ass = assFromCaptions({ chunks, w: 3840, h: 2160 });
  // 44px scales with height, margin is (1 - 0.87) of height
  assert.ok(ass.includes('Style: Cap,Helvetica,88,'), 'font scales to canvas');
  assert.ok(/,40,40,281,1/.test(ass), `margin should be 2160-round(2160*0.87)=281:\n${ass}`);
});

test('buildNativeFcpxml: native generator layers', () => {
  const avatarClips = [
    { id: 'a1', offsetSec: 2, durationSec: 5, file: 'a1.mp4' },
    { id: 'a2', offsetSec: 10, durationSec: 3, file: 'a2.mp4' }
  ];
  const fullframes = [
    { id: 'ff1', offsetSec: 7, durationSec: 2, file: 'ff1.mp4' },
    { id: 'ff2', offsetSec: 15, durationSec: 4, file: 'ff2.mp4' }
  ];
  const overlayClips = [
    { id: 'o1', offsetSec: 20, durationSec: 1, file: 'o1.mov' }
  ];
  const fxClips = [
    { id: 'fx1&', offsetSec: 1, durationSec: 0.5, file: 'fx1.mov' },
    { id: 'fx2', offsetSec: 5, durationSec: 0.5, file: 'fx2.mov' }
  ];
  const markers = [
    { at: 12, note: 'drift' },
    { at: null, note: 'punch' }
  ];
  
  const sfxClips = [
    { id: 'sfx1', offsetSec: 10, durationSec: 2, file: 'sfx1.wav' },
    { id: 'sfx2', offsetSec: 20, durationSec: 2, file: 'sfx2.wav' }
  ];
  
  const xml = buildNativeFcpxml({
    video: 't', screenPath: 'screen.mp4', voPath: 'vo.mp3', musicPath: 'music-ducked.wav', total: 30, w: 1920, h: 1080,
    avatarClips, fullframes, overlayClips, fxClips, sfxClips, markers, srcUrl: (f) => f
  });
  
  const spineRe = /<asset-clip ref="[^"]+" offset="[^"]+" duration="[^"]+" start="0s" name="screen"/g;
  const spines = xml.match(spineRe) || [];
  assert.equal(spines.length, 1, 'exactly 1 spine clip');
  assert.match(spines[0], new RegExp(`duration="${frames(30)*100}/3000s"`), 'spine spans total frames');
  
  const l1 = (xml.match(/lane="1"/g) || []).length;
  assert.equal(l1, 2, '2 clips lane 1');
  const l2 = (xml.match(/lane="2"/g) || []).length;
  assert.equal(l2, 2, '2 clips lane 2');
  const l3 = (xml.match(/lane="3"/g) || []).length;
  assert.equal(l3, 1, '1 clip lane 3');
  const l4 = (xml.match(/lane="4"/g) || []).length;
  assert.equal(l4, 2, '2 clips lane 4');
  const lm1 = (xml.match(/lane="-1"/g) || []).length;
  assert.equal(lm1, 1, '1 clip lane -1');
  
  const lm2 = (xml.match(/lane="-2"/g) || []).length;
  assert.equal(lm2, 1, '1 clip lane -2 (music)');
  
  const lm3 = (xml.match(/lane="-3"/g) || []).length;
  assert.equal(lm3, 2, '2 clips lane -3 (sfx)');
  
  const xmlMarkers = xml.match(/<marker /g) || [];
  assert.equal(xmlMarkers.length, 1, 'exactly 1 marker');
  assert.match(xml, new RegExp(`<marker start="${frames(12)*100}/3000s"`), 'marker start equals frames(at)*100');
  
  const numAssets = (xml.match(/<asset /g) || []).length;
  assert.equal(numAssets, 12, 'exactly 12 assets');
  
  for (const c of [...avatarClips, ...fullframes, ...overlayClips, ...fxClips, ...sfxClips]) {
    const oOffset = rt(frames(c.offsetSec));
    const escId = c.id.replace('&', '&amp;');
    assert.match(xml, new RegExp(`offset="${oOffset}"[^>]+name="${escId}"`), `offset matches for ${c.id}`);
  }
  
  assert.ok(!/&(?!amp;|lt;|gt;|quot;)/.test(xml), 'no unescaped ampersands');
  assert.ok(xml.includes('fx1&amp;'), 'fx id escaped correctly');
});

test('buildFcpxml: gapless spine under rounding drift', () => {
  const clips = Array.from({ length: 30 }, (_, i) => ({ file: `c${i}.mp4`, id: `s${i}`, kind: 'screen', dur: 1.0333 }));
  const xml = buildFcpxml({ video: 't', clips, overlays: [], voPath: 'vo.mp3', total: 30.999, w: 1920, h: 1080, srcUrl: (f) => f });
  
  const re = /<asset-clip ref="r\d+" offset="(\d+)\/3000s" duration="(\d+)\/3000s"/g;
  let match;
  let matches = [];
  while ((match = re.exec(xml)) !== null) {
    if (!match[0].includes('lane=')) {
      matches.push({ offset: parseInt(match[1], 10), duration: parseInt(match[2], 10) });
    }
  }
  
  for (let i = 0; i < matches.length - 1; i++) {
    assert.equal(matches[i].offset + matches[i].duration, matches[i+1].offset, `spine clip ${i} gap`);
  }
  const last = matches[matches.length - 1];
  assert.equal(last.offset + last.duration, frames(30.999) * 100, 'spine total duration matches');
});

test('buildFcpxml: structure counts', () => {
  const clips = [
    { file: 'c1.mp4', id: 'c1', kind: 'screen', dur: 5 },
    { file: 'c2.mp4', id: 'c2', kind: 'screen', dur: 5 }
  ];
  const overlays = [
    { id: 'o1', start: 1, end: 2, file: 'o1.mov' },
    { id: 'o2', start: 3, end: 4, file: 'o2.mov' },
    { id: 'o3', start: 5, end: 6, file: 'o3.mov' }
  ];
  const xml = buildFcpxml({ video: 't', clips, overlays, voPath: 'vo.mp3', total: 10, w: 1920, h: 1080, srcUrl: (f) => f });
  
  const assetClips = (xml.match(/<asset-clip /g) || []).length;
  assert.equal(assetClips, 2 + 3 + 1, 'total asset-clips');
  
  const lane1 = (xml.match(/lane="1"/g) || []).length;
  assert.equal(lane1, 3, 'overlays on lane 1');
  
  const laneMinus1 = (xml.match(/lane="-1"/g) || []).length;
  assert.equal(laneMinus1, 1, 'vo on lane -1');
  
  const assets = (xml.match(/<asset /g) || []).length;
  assert.equal(assets, 2 + 3 + 1, 'total assets');
  
  for (const o of overlays) {
    const oOffset = rt(frames(o.start));
    assert.match(xml, new RegExp(`lane="1" ref="[^"]+" offset="${oOffset}"`), `overlay ${o.id} offset`);
  }
});

test('buildFcpxml: XML escaping', () => {
  const clips = [{ file: 'c&"1.mp4', id: 'c&<1', kind: 'screen', dur: 5 }];
  const xml = buildFcpxml({ video: 't&>', clips, overlays: [], voPath: 'vo.mp3', total: 5, w: 1920, h: 1080, srcUrl: (f) => f });
  assert.ok(!/&(?!amp;|lt;|gt;|quot;)/.test(xml), 'no unescaped ampersands');
  assert.ok(xml.includes('c&amp;&quot;1.mp4'));
});

test('Integration: export mode', { skip: spawnSync('ffmpeg', ['-version']).error ? 'ffmpeg not found' : false }, async () => {
  fs.mkdirSync(path.join(testTmp, 'media'), { recursive: true });
  fs.mkdirSync(path.join(testTmp, 'renders'), { recursive: true });

  const screenMp4 = path.join(testTmp, 'screen.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc=size=1920x1080:rate=30', '-t', '68', '-r', '30', '-pix_fmt', 'yuv420p', screenMp4]);
  const avatarFile = path.join(testTmp, 'media', 's01.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=red:s=1920x1080', '-t', '60', '-r', '30', '-pix_fmt', 'yuv420p', avatarFile]);

  const voMp3 = path.join(testTmp, 'vo.mp3');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '68', '-q:a', '9', voMp3]);

  const resolved = [
    { id: 'c1', placement: 'fullframe', start: 3, duration: 2, card: 'green' },
    { id: 'c2', placement: 'fullframe', start: 67, duration: 2, card: 'blue' },
    { id: 'o1', placement: 'overlay', start: 5.5, duration: 1, card: 'black' }
  ];
  const ffFile1 = path.join(testTmp, 'renders', '0003-c1-green.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=green:s=1920x1080:r=30', '-t', '2', '-pix_fmt', 'yuv420p', ffFile1]);

  const ffFile2 = path.join(testTmp, 'renders', '0107-c2-blue.mp4');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=1920x1080:r=30', '-t', '2', '-pix_fmt', 'yuv420p', ffFile2]);

  const ovFile = path.join(testTmp, 'renders', '0005-o1-black.mov');
  spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=black@0.0:s=1920x1080:r=30,format=yuva420p', '-t', '1', '-c:v', 'qtrle', ovFile]);

  const avatarJobs = [
    { kind: 'avatar-full', id: 's01', start: 6, end: 66, file: avatarFile }
  ];
  const words = [
    { start: 0, end: 5, word: 'hello_world' },
    { start: 6, end: 25, word: 'something_else' },
    { start: 26, end: 45, word: 'third_chunk' },
    { start: 46, end: 68, word: 'final_words' }
  ];
  
  const outMp4 = path.join(testTmp, 'final.mp4');
  if (fs.existsSync(outMp4)) fs.unlinkSync(outMp4);

  const tmpDir = path.join(testTmp, 'assembly-tmp');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  
  const segmentsOutDir = path.join(testTmp, 'segments');
  fs.rmSync(segmentsOutDir, { recursive: true, force: true });

  const plan = await runAssembly({
    workdir: testTmp,
    video: 'it',
    resolved,
    avatarJobs,
    total: 68,
    screen: screenMp4,
    out: outMp4,
    encoder: 'x264',
    keepTemp: true,
    beats: 'on',
    words,
    overlayComposite: false,
    segmentsOutDir
  });

  assert.ok(plan.clips.length >= 3, 'returned plan.clips length >= 3');
  for (const c of plan.clips) {
    assert.ok(fs.existsSync(c.file), `segment file exists: ${c.file}`);
    assert.ok(c.file.endsWith('.mp4'), `segment file ends with .mp4: ${c.file}`);
  }
  
  assert.equal(plan.overlays.length, 1, 'plan.overlays length equals fixture overlay count');
  
  assert.ok(!fs.existsSync(outMp4), 'no final output written');
  assert.ok(!fs.existsSync(path.join(testTmp, 'assembly.md')), 'no assembly.md written');
  
  const xml = buildFcpxml({
    video: 'it', clips: plan.clips, overlays: plan.overlays,
    voPath: voMp3, total: plan.total, w: plan.w, h: plan.h, srcUrl: (f) => f
  });
  
  const re = /<asset-clip ref="r\d+" offset="(\d+)\/3000s" duration="(\d+)\/3000s"/g;
  let match;
  let matches = [];
  while ((match = re.exec(xml)) !== null) {
    if (!match[0].includes('lane=')) {
      matches.push({ offset: parseInt(match[1], 10), duration: parseInt(match[2], 10) });
    }
  }
  
  let sumDur = 0;
  for (const m of matches) { sumDur += m.duration; }
  assert.equal(sumDur, frames(68) * 100, 'spine total duration matches frames(total)*100');
  
  const firstSeg = plan.clips[0].file;
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', firstSeg], { encoding: 'utf8' });
  assert.equal(probe.stdout.trim(), 'h264', 'segment ffprobes to h264');
});

test('buildNativeFcpxml: panel clips receive adjust-transform', async () => {
  const { buildNativeFcpxml } = await import('./export-timeline.mjs');
  const xml = buildNativeFcpxml({
    video: 't', screenPath: 'screen.mp4', voPath: 'vo.mp3', total: 30, w: 1920, h: 1080,
    avatarClips: [
      { id: 'panel:p1', isPanel: true, offsetSec: 2, durationSec: 5, file: 'p1.mp4' }
    ],
    fullframes: [], overlayClips: [], fxClips: [], sfxClips: [], markers: [], srcUrl: (f) => f
  });
  
  assert.match(xml, /<adjust-transform position="659 -357" scale="0\.2802\d+ 0\.2802\d+"\/>/);
  assert.match(xml, /name="panel:p1"/);
});

test('buildNativeFcpxml: side clips receive adjust-crop and adjust-transform', async () => {
  const { buildNativeFcpxml } = await import('./export-timeline.mjs');
  const xml = buildNativeFcpxml({
    video: 't', screenPath: 'screen.mp4', voPath: 'vo.mp3', total: 30, w: 1920, h: 1080,
    avatarClips: [
      { id: 'side:s1', isSide: true, offsetSec: 2, durationSec: 5, file: 's1.mp4' }
    ],
    fullframes: [], overlayClips: [], fxClips: [], sfxClips: [], markers: [], srcUrl: (f) => f
  });

  assert.match(xml, /<video lane="1"/);
  assert.match(xml, /<adjust-crop mode="trim" left="[^"]+" right="[^"]+" top="[^"]+" bottom="[^"]+"\/>/);
  assert.match(xml, /<adjust-transform position="[^"]+" scale="[^"]+"\/>/);
  assert.match(xml, /name="side:s1"/);
});

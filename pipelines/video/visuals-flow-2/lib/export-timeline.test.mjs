import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildFcpxml, frames, rt, srtTime, srtFromCaptions, buildNativeFcpxml } from './export-timeline.mjs';
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
  
  const xml = buildNativeFcpxml({
    video: 't', screenPath: 'screen.mp4', voPath: 'vo.mp3', total: 30, w: 1920, h: 1080,
    avatarClips, fullframes, overlayClips, fxClips, markers, srcUrl: (f) => f
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
  
  const xmlMarkers = xml.match(/<marker /g) || [];
  assert.equal(xmlMarkers.length, 1, 'exactly 1 marker');
  assert.match(xml, new RegExp(`<marker start="${frames(12)*100}/3000s"`), 'marker start equals frames(at)*100');
  
  const numAssets = (xml.match(/<asset /g) || []).length;
  assert.equal(numAssets, 9, 'exactly 9 assets');
  
  for (const c of [...avatarClips, ...fullframes, ...overlayClips, ...fxClips]) {
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

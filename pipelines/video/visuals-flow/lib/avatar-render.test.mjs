import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert';
import { planCornerChunks, planJobs, avatarManifestMd } from './avatar-render.mjs';

test('planCornerChunks', () => {
  const chunks = planCornerChunks(650);
  assert.strictEqual(chunks.length, 3);
  assert.strictEqual(chunks[0].start, 0);
  assert.strictEqual(chunks[0].end, 300);
  assert.strictEqual(chunks[1].start, 300);
  assert.strictEqual(chunks[1].end, 600);
  assert.strictEqual(chunks[2].start, 600);
  assert.strictEqual(chunks[2].end, 650);
});

test('avatarManifestMd', () => {
  const jobs = [
    { start: 10, file: 'b.mp4', duration: 15, kind: 'avatar-full' },
    { start: 0, duration: 5, kind: 'corner' }, // no file, pending
    { start: 5, file: 'a.mp4', duration: 5, kind: 'corner' }
  ];
  const md = avatarManifestMd('test-vid', jobs, 2.5);
  assert.ok(md.includes('| 00:07.5 | a.mp4 | 5s | corner |'));
  assert.ok(md.includes('| 00:12.5 | b.mp4 | 15s | avatar-full |'));
  assert.ok(!md.includes('pending'));
  assert.ok(md.indexOf('a.mp4') < md.indexOf('b.mp4')); // ordered by start
});

test('CLI tests', (t) => {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'avatar-render-test-'));
  const workdir = path.join(tmpdir, 'videos', 'test-01');
  const mediaRoot = path.join(tmpdir, 'media');
  
  t.after(() => {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  fs.mkdirSync(workdir, { recursive: true });
  fs.mkdirSync(mediaRoot, { recursive: true });

  const HEYGEN_WEB_BIN = `node ${path.resolve(import.meta.dirname, 'fixtures', 'heygen-web-stub.mjs')}`;
  const CLI_SCRIPT = path.resolve(import.meta.dirname, 'avatar-render.mjs');

  const runCLI = (args, envOverrides = {}) => {
    return spawnSync(process.execPath, [CLI_SCRIPT, ...args], {
      cwd: workdir,
      encoding: 'utf8',
      env: {
        ...process.env,
        HEYGEN_WEB_BIN,
        AVATAR_RENDER_NO_PACING: '1',
        AVATAR_MEDIA_ROOT: mediaRoot,
        ...envOverrides
      }
    });
  };

  // Setup basic files
  fs.writeFileSync(path.join(workdir, 'transcript.json'), JSON.stringify([
    { start: 0, end: 5, text: "hello" },
    { start: 5, end: 10, text: "world" },
    { start: 10, end: 15, text: "this" },
    { start: 15, end: 20, text: "is" },
    { start: 20, end: 25, text: "a" },
    { start: 25, end: 30, text: "test" }
  ]));
  fs.writeFileSync(path.join(workdir, 'resolved.json'), JSON.stringify({
    video: 'test-01',
    resolved: []
  }));
  fs.writeFileSync(path.join(workdir, 'shots.json'), JSON.stringify({
    video: 'test-01',
    approved: true,
    engineMode: 'test',
    spans: [{ id: 's01', kind: 'avatar-full', from_anchor: "hello world this", to_anchor: "is a test" }]
  }));
  
  // Create silent vo.mp3
  spawnSync('ffmpeg', ['-f', 'lavfi', '-i', 'anullsrc', '-t', '35', '-q:a', '9', path.join(workdir, 'vo.mp3')]);
  
  // Resolve shots initially
  const rs = spawnSync(process.execPath, [path.resolve(import.meta.dirname, 'resolve-shots.mjs'), workdir], { encoding: 'utf8' });
  if (rs.status !== 0) throw new Error(rs.stderr);

  // Case 2: Unapproved shots.json
  const shotsJson = JSON.parse(fs.readFileSync(path.join(workdir, 'shots.json')));
  shotsJson.approved = false;
  fs.writeFileSync(path.join(workdir, 'shots.json'), JSON.stringify(shotsJson));
  let res = runCLI([workdir, '--template', 't', '--submit']);
  assert.strictEqual(res.status, 1);
  assert.ok(res.stderr.includes('approved=false'));
  
  shotsJson.approved = true;
  fs.writeFileSync(path.join(workdir, 'shots.json'), JSON.stringify(shotsJson));

  // Case 3: engineMode production
  shotsJson.engineMode = 'production';
  fs.writeFileSync(path.join(workdir, 'shots.json'), JSON.stringify(shotsJson));
  res = runCLI([workdir, '--template', 't', '--submit', '--force']);
  assert.strictEqual(res.status, 1);
  assert.ok(res.stderr.includes('engineMode "production" is not implemented'));
  
  shotsJson.engineMode = 'test';
  fs.writeFileSync(path.join(workdir, 'shots.json'), JSON.stringify(shotsJson));

  // Case 4: Stale shots.resolved.json
  const resolvedShots = JSON.parse(fs.readFileSync(path.join(workdir, 'shots.resolved.json')));
  resolvedShots.spans[0].start = 99;
  fs.writeFileSync(path.join(workdir, 'shots.resolved.json'), JSON.stringify(resolvedShots));
  res = runCLI([workdir, '--template', 't', '--submit']);
  assert.strictEqual(res.status, 1);
  assert.ok(res.stderr.includes('re-run node lib/resolve-shots.mjs'));
  
  const rs2 = spawnSync(process.execPath, [path.resolve(import.meta.dirname, 'resolve-shots.mjs'), workdir], { encoding: 'utf8' });
  if (rs2.status !== 0) throw new Error(rs2.stderr);

  // Case 5: Lint gate
  const resolvedCues = JSON.parse(fs.readFileSync(path.join(workdir, 'resolved.json')));
  resolvedCues.resolved = [{ id: 'c01', placement: 'fullframe', start: 0, duration: 5 }];
  fs.writeFileSync(path.join(workdir, 'resolved.json'), JSON.stringify(resolvedCues));
  res = runCLI([workdir, '--template', 't', '--submit']);
  assert.strictEqual(res.status, 1);
  assert.ok(res.stderr.includes('E2 fullframe-collision'));
  
  resolvedCues.resolved = [];
  fs.writeFileSync(path.join(workdir, 'resolved.json'), JSON.stringify(resolvedCues));

  // Case 6: Happy submit
  res = runCLI([workdir, '--template', 't', '--submit']);
  assert.strictEqual(res.status, 0);
  assert.ok(fs.existsSync(path.join(workdir, 'slices-avatar', 's01.mp3')));
  assert.ok(fs.existsSync(path.join(workdir, 'slices-avatar', 'corner-01.mp3')));
  
  const jobsData = JSON.parse(fs.readFileSync(path.join(workdir, 'avatar-jobs.json')));
  assert.strictEqual(jobsData.jobs.length, 2);
  assert.ok(jobsData.jobs[0].video_id);
  assert.ok(jobsData.jobs[1].video_id);

  const counterBefore = fs.readFileSync(path.join(workdir, 'stub-counter.txt'), 'utf8');
  res = runCLI([workdir, '--template', 't', '--submit']);
  assert.strictEqual(res.status, 0);
  const counterAfter = fs.readFileSync(path.join(workdir, 'stub-counter.txt'), 'utf8');
  assert.strictEqual(counterBefore, counterAfter);

  // Case 7: Happy download
  res = runCLI([workdir, '--download']);
  assert.strictEqual(res.status, 0);
  const outDir = path.join(mediaRoot, 'test-01');
  assert.ok(fs.existsSync(path.join(outDir, 's01.mp4')));
  assert.ok(fs.existsSync(path.join(outDir, 'corner-01.mp4')));
  
  const manifest = fs.readFileSync(path.join(workdir, 'avatar-manifest.md'), 'utf8');
  assert.ok(manifest.includes('s01.mp4'));
  assert.ok(manifest.includes('corner-01.mp4'));
});

test('planJobs spansOnly → no corner jobs', async () => {
  const { planJobs } = await import('./avatar-render.mjs');
  const jobs = planJobs({ spans: [{ id: 's01', start: 10, end: 40 }] }, 650, { spansOnly: true });
  assert.equal(jobs.length, 1);
  assert.ok(jobs.every(j => j.kind === 'avatar-full'));
});

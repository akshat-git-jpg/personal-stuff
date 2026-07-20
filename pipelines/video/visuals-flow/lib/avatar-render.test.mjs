import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert';
import { planCornerChunks, planCornerChunksRange, planJobs, avatarManifestMd } from './avatar-render.mjs';

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

test('planCornerChunksRange → single sub-300s window is one chunk', () => {
  const chunks = planCornerChunksRange(113.67, 293.67);
  assert.strictEqual(chunks.length, 1);
  assert.strictEqual(chunks[0].start, 113.67);
  assert.strictEqual(chunks[0].end, 293.67);
});

test('planJobs cornerRange → only the ranged corner chunk, no whole-VO track', () => {
  const jobs = planJobs({ spans: [] }, 2167, { cornerRange: [113.67, 293.67] });
  assert.strictEqual(jobs.length, 1);
  assert.strictEqual(jobs[0].kind, 'corner');
  assert.strictEqual(jobs[0].start, 113.67);
  assert.strictEqual(jobs[0].duration, 180);
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

  // Case 8: Bad slug
  const origShotsResolved = JSON.parse(fs.readFileSync(path.join(workdir, 'shots.resolved.json'), 'utf8'));
  const badShotsResolved = { ...origShotsResolved, video: 'bad slug' };
  fs.writeFileSync(path.join(workdir, 'shots.resolved.json'), JSON.stringify(badShotsResolved));
  res = runCLI([workdir, '--template', 't', '--submit']);
  assert.strictEqual(res.status, 1);
  assert.ok(res.stderr.includes('invalid video slug'));
  fs.writeFileSync(path.join(workdir, 'shots.resolved.json'), JSON.stringify(origShotsResolved));

  // Case 9: Bad template
  res = runCLI([workdir, '--template', 't; bad', '--submit']);
  assert.strictEqual(res.status, 1);
  assert.ok(res.stderr.includes('invalid template'));

  // Case 10: Empty transcript
  const origTranscript = fs.readFileSync(path.join(workdir, 'transcript.json'), 'utf8');
  const origShots10 = fs.readFileSync(path.join(workdir, 'shots.json'), 'utf8');
  const origShotsRes10 = fs.readFileSync(path.join(workdir, 'shots.resolved.json'), 'utf8');
  fs.writeFileSync(path.join(workdir, 'transcript.json'), JSON.stringify([]));
  fs.writeFileSync(path.join(workdir, 'shots.json'), JSON.stringify({ ...JSON.parse(origShots10), spans: [] }));
  fs.writeFileSync(path.join(workdir, 'shots.resolved.json'), JSON.stringify({ ...JSON.parse(origShotsRes10), spans: [] }));
  res = runCLI([workdir, '--template', 't', '--submit']);
  assert.strictEqual(res.status, 1);
  assert.ok(res.stderr.includes('empty transcript.json'));
  fs.writeFileSync(path.join(workdir, 'transcript.json'), origTranscript);
  fs.writeFileSync(path.join(workdir, 'shots.json'), origShots10);
  fs.writeFileSync(path.join(workdir, 'shots.resolved.json'), origShotsRes10);

  // Case 11: Slice failure
  const origVo = path.join(workdir, 'vo.mp3');
  fs.renameSync(origVo, path.join(workdir, 'vo_backup.mp3'));
  fs.rmSync(path.join(workdir, 'slices-avatar', 's01.mp3'), { force: true });
  res = runCLI([workdir, '--template', 't', '--submit']);
  assert.strictEqual(res.status, 1);
  assert.ok(res.stderr.includes('slice failed for s01'));
  fs.renameSync(path.join(workdir, 'vo_backup.mp3'), origVo);

  // Case 12: Slice duration precise check
  // Resolve a new shot "s02" to trigger a fresh slice
  const newShots = JSON.parse(fs.readFileSync(path.join(workdir, 'shots.json'), 'utf8'));
  newShots.spans = [{ id: 's02', kind: 'avatar-full', from_anchor: "hello world this", to_anchor: "is a test" }];
  fs.writeFileSync(path.join(workdir, 'shots.json'), JSON.stringify(newShots));
  const rs3 = spawnSync(process.execPath, [path.resolve(import.meta.dirname, 'resolve-shots.mjs'), workdir], { encoding: 'utf8' });
  if (rs3.status !== 0) throw new Error(rs3.stderr);
  
  res = runCLI([workdir, '--template', 't', '--submit']);
  assert.strictEqual(res.status, 0);
  
  const probeRes = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path.join(workdir, 'slices-avatar', 's02.mp3')], { encoding: 'utf8' });
  const duration = parseFloat(probeRes.stdout.trim());
  const resShots2 = JSON.parse(fs.readFileSync(path.join(workdir, 'shots.resolved.json'), 'utf8'));
  const expectedDuration = resShots2.spans[0].duration;
  assert.ok(Math.abs(duration - expectedDuration) <= 0.05, `duration ${duration} not within 0.05s of ${expectedDuration}`);
});

test('planJobs spansOnly → no corner jobs', async () => {
  const { planJobs } = await import('./avatar-render.mjs');
  const jobs = planJobs({ spans: [{ id: 's01', start: 10, end: 40 }] }, 650, { spansOnly: true });
  assert.equal(jobs.length, 1);
  assert.ok(jobs.every(j => j.kind === 'avatar-full'));
});

test('retry run flushes skipped jobs after the last submit (s03-retry incident)', (t) => {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'avatar-render-flush-'));
  const workdir = path.join(tmpdir, 'videos', 'vid');
  const mediaRoot = path.join(tmpdir, 'media');
  t.after(() => fs.rmSync(tmpdir, { recursive: true, force: true }));
  fs.mkdirSync(workdir, { recursive: true });
  fs.mkdirSync(mediaRoot, { recursive: true });

  const words = Array.from({ length: 12 }, (_, i) => ({ start: i * 5, end: i * 5 + 5, text: `w${i}` }));
  fs.writeFileSync(path.join(workdir, 'transcript.json'), JSON.stringify(words));
  fs.writeFileSync(path.join(workdir, 'resolved.json'), JSON.stringify({ video: 'vid', resolved: [] }));
  fs.writeFileSync(path.join(workdir, 'shots.json'), JSON.stringify({
    video: 'vid', approved: true, engineMode: 'test',
    spans: [
      { id: 's01', kind: 'avatar-full', from_anchor: 'w0 w1 w2', to_anchor: 'w3 w4 w5' },
      { id: 's02', kind: 'avatar-full', from_anchor: 'w6 w7 w8', to_anchor: 'w9 w10 w11' }
    ]
  }));
  spawnSync('ffmpeg', ['-f', 'lavfi', '-i', 'anullsrc', '-t', '65', '-q:a', '9', path.join(workdir, 'vo.mp3')]);
  const rs = spawnSync(process.execPath, [path.resolve(import.meta.dirname, 'resolve-shots.mjs'), workdir], { encoding: 'utf8' });
  if (rs.status !== 0) throw new Error(rs.stderr);

  // Pre-seed: s02 already submitted, s01 needs a submit → the skip comes AFTER the submit.
  const resolved = JSON.parse(fs.readFileSync(path.join(workdir, 'shots.resolved.json'), 'utf8'));
  const s02 = resolved.spans.find((s) => s.id === 's02');
  fs.writeFileSync(path.join(workdir, 'avatar-jobs.json'), JSON.stringify({
    video: 'vid', template: 'girl-1', engineMode: 'test',
    jobs: [{ id: 's02', kind: 'avatar-full', start: s02.start, end: s02.end, duration: s02.duration,
             audio: 'slices-avatar/s02.mp3', video_id: 'pre-existing-id', status: 'submitted', submitted_at: 'x' }]
  }));

  const res = spawnSync(process.execPath, [path.resolve(import.meta.dirname, 'avatar-render.mjs'), workdir, '--template', 'girl-1', '--submit', '--spans-only'], {
    cwd: workdir, encoding: 'utf8',
    env: { ...process.env, HEYGEN_WEB_BIN: `node ${path.resolve(import.meta.dirname, 'fixtures', 'heygen-web-stub.mjs')}`, AVATAR_RENDER_NO_PACING: '1', AVATAR_MEDIA_ROOT: mediaRoot }
  });
  assert.strictEqual(res.status, 0, res.stderr);

  const after = JSON.parse(fs.readFileSync(path.join(workdir, 'avatar-jobs.json'), 'utf8'));
  assert.strictEqual(after.jobs.length, 2, 'both jobs must survive the rewrite');
  assert.ok(after.jobs.every((j) => j.video_id), 'every job keeps a video_id');
  assert.strictEqual(after.jobs.find((j) => j.id === 's02').video_id, 'pre-existing-id');
});

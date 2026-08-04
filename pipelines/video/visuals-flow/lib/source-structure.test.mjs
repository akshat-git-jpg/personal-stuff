import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { sourceStructure } from './source-structure.mjs';

test('source structure', async (t) => {
  const tmpDir = path.join('.test-tmp', 'source-structure-tests');

  t.beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  t.afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  await t.test('three files present', () => {
    const workdir = path.join(tmpDir, 'case1');
    const srcDir = path.join(workdir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    
    fs.writeFileSync(path.join(srcDir, 'intro.mp4'), '');
    fs.writeFileSync(path.join(srcDir, 'body.mp4'), '');
    fs.writeFileSync(path.join(srcDir, 'conclusion.mp4'), '');
    
    const fakeProbe = (f) => {
      if (f.endsWith('intro.mp4')) return 10;
      if (f.endsWith('body.mp4')) return 20;
      if (f.endsWith('conclusion.mp4')) return 30;
      return null;
    };

    const res = sourceStructure(workdir, { probe: fakeProbe });
    assert.deepEqual(res.errors, []);
    assert.deepEqual(res.structure, [
      { part: 'intro', start: 0, end: 10 },
      { part: 'body', start: 10, end: 30 },
      { part: 'conclusion', start: 30, end: 60 }
    ]);
  });

  await t.test('conclusion.mp4 missing', () => {
    const workdir = path.join(tmpDir, 'case2');
    const srcDir = path.join(workdir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    
    fs.writeFileSync(path.join(srcDir, 'intro.mp4'), '');
    fs.writeFileSync(path.join(srcDir, 'body.mp4'), '');
    
    const fakeProbe = () => 10;
    const res = sourceStructure(workdir, { probe: fakeProbe });
    assert.equal(res.errors.length, 1);
    assert.match(res.errors[0], /src\/conclusion\.mp4 is missing/);
    assert.deepEqual(res.structure, []);
  });

  await t.test('intro.mp4 missing', () => {
    const workdir = path.join(tmpDir, 'case3');
    const srcDir = path.join(workdir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    
    fs.writeFileSync(path.join(srcDir, 'body.mp4'), '');
    fs.writeFileSync(path.join(srcDir, 'conclusion.mp4'), '');
    
    const fakeProbe = () => 10;
    const res = sourceStructure(workdir, { probe: fakeProbe });
    assert.equal(res.errors.length, 1);
    assert.match(res.errors[0], /src\/intro\.mp4 is missing/);
    assert.deepEqual(res.structure, []);
  });

  await t.test('no src/ directory', () => {
    const workdir = path.join(tmpDir, 'case4');
    fs.mkdirSync(workdir, { recursive: true });
    
    const res = sourceStructure(workdir);
    assert.deepEqual(res.errors, []);
    assert.equal(res.warnings.length, 1);
    assert.match(res.warnings[0], /no src\/ directory/);
    assert.deepEqual(res.structure, []);
  });

  await t.test('total shorter than the conclusion start -> never used', () => {
    const workdir = path.join(tmpDir, 'case5');
    const srcDir = path.join(workdir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    
    fs.writeFileSync(path.join(srcDir, 'intro.mp4'), '');
    fs.writeFileSync(path.join(srcDir, 'body.mp4'), '');
    fs.writeFileSync(path.join(srcDir, 'conclusion.mp4'), '');
    
    const fakeProbe = (f) => {
      if (f.endsWith('intro.mp4')) return 10;
      if (f.endsWith('body.mp4')) return 20;
      if (f.endsWith('conclusion.mp4')) return 30;
      return null;
    };

    // Conclusion starts at 30. Total is 25.
    const res = sourceStructure(workdir, { total: 25, probe: fakeProbe });
    assert.deepEqual(res.errors, []);
    assert.equal(res.warnings.length, 2);
    assert.match(res.warnings[1], /never used/);
  });
});

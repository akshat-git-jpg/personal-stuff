import test from 'node:test';
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { markBBox, normalizeFile } from './normalize-logo.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, '..', 'logos');

test('markBBox detects off-centre mark in opaque image', () => {
  const tmpPng = path.join(testDir, 'test1.tmp.png');
  const tmpRaw = path.join(testDir, 'test1.raw.tmp');
  
  try {
    // 64x64 blue background, with a 10x10 red box at x=40, y=20
    execFileSync('ffmpeg', [
      '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=64x64',
      '-vf', 'drawbox=x=40:y=20:w=10:h=10:color=red:t=fill',
      '-frames:v', '1', tmpPng, '-y'
    ]);
    
    const box = markBBox(tmpPng, tmpRaw);
    assert.strictEqual(box.w, 10);
    assert.strictEqual(box.h, 10);
    assert.strictEqual(box.x, 40);
    assert.strictEqual(box.y, 20);
    assert.strictEqual(box.hasAlpha, false);
  } finally {
    if (fs.existsSync(tmpPng)) fs.unlinkSync(tmpPng);
    if (fs.existsSync(tmpRaw)) fs.unlinkSync(tmpRaw);
  }
});

test('markBBox detects mark in alpha image', () => {
  const tmpPng = path.join(testDir, 'test2.tmp.png');
  const tmpRaw = path.join(testDir, 'test2.raw.tmp');
  
  try {
    // 64x64 transparent background, with a 15x15 red box at x=10, y=30
    execFileSync('ffmpeg', [
      '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black@0.0:s=64x64,format=rgba',
      '-f', 'lavfi', '-i', 'color=c=red:s=15x15',
      '-filter_complex', '[0:v][1:v]overlay=10:30',
      '-frames:v', '1', tmpPng, '-y'
    ]);
    
    const box = markBBox(tmpPng, tmpRaw);
    assert.strictEqual(box.w, 15);
    assert.strictEqual(box.h, 15);
    assert.strictEqual(box.x, 10);
    assert.strictEqual(box.y, 30);
    assert.strictEqual(box.hasAlpha, true);
  } finally {
    if (fs.existsSync(tmpPng)) fs.unlinkSync(tmpPng);
    if (fs.existsSync(tmpRaw)) fs.unlinkSync(tmpRaw);
  }
});

test('idempotence: normalize twice, assert byte-identical output', () => {
  const tmpPng = path.join(testDir, 'test3.tmp.png');
  const tmpRaw = path.join(testDir, 'test3.raw.tmp');
  const tmpOut1 = path.join(testDir, 'test3.out1.tmp.png');
  const tmpOut2 = path.join(testDir, 'test3.out2.tmp.png');
  
  try {
    execFileSync('ffmpeg', [
      '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=128x128',
      '-vf', 'drawbox=x=40:y=40:w=48:h=48:color=red:t=fill',
      '-frames:v', '1', tmpPng, '-y'
    ]);
    
    normalizeFile(tmpPng, tmpRaw, tmpOut1);
    normalizeFile(tmpOut1, tmpRaw, tmpOut2);
    
    const b1 = fs.readFileSync(tmpOut1);
    const b2 = fs.readFileSync(tmpOut2);
    assert.ok(b1.equals(b2), 'Outputs should be byte-identical');
  } finally {
    if (fs.existsSync(tmpPng)) fs.unlinkSync(tmpPng);
    if (fs.existsSync(tmpRaw)) fs.unlinkSync(tmpRaw);
    if (fs.existsSync(tmpOut1)) fs.unlinkSync(tmpOut1);
    if (fs.existsSync(tmpOut2)) fs.unlinkSync(tmpOut2);
  }
});

test('markBBox throws no mark detected on uniform image', () => {
  const tmpPng = path.join(testDir, 'test4.tmp.png');
  const tmpRaw = path.join(testDir, 'test4.raw.tmp');
  
  try {
    execFileSync('ffmpeg', [
      '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=64x64',
      '-frames:v', '1', tmpPng, '-y'
    ]);
    
    assert.throws(() => markBBox(tmpPng, tmpRaw), /no mark detected/);
  } finally {
    if (fs.existsSync(tmpPng)) fs.unlinkSync(tmpPng);
    if (fs.existsSync(tmpRaw)) fs.unlinkSync(tmpRaw);
  }
});

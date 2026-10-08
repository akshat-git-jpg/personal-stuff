import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert';
import { newestShell, launchOptions, isShell, QUIET_ARGS } from './chrome.mjs';

const EXE = process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';
function fakeShell(home, root, ver) {
  const dir = path.join(home, root, ver, 'chrome-headless-shell-x');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, EXE), '');
  return path.join(dir, EXE);
}

test('newestShell picks the newest v150+ shell across both caches and skips older ones', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-home-'));
  fakeShell(home, '.cache/puppeteer/chrome-headless-shell', 'mac_arm-127.0.6533.88');
  fakeShell(home, '.cache/hyperframes/chrome/chrome-headless-shell', 'mac_arm-152.0.7928.2');
  const want = fakeShell(home, '.cache/hyperframes/chrome/chrome-headless-shell', 'mac_arm-152.0.7977.30');
  assert.equal(newestShell(home), want);
});

test('newestShell returns null when only a stale shell is cached', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-home-'));
  fakeShell(home, '.cache/puppeteer/chrome-headless-shell', 'mac_arm-127.0.6533.88');
  assert.equal(newestShell(home), null);
});

test('launchOptions uses shell mode and keeps audio off', () => {
  const prev = process.env.CHROME_BIN;
  process.env.CHROME_BIN = '/x/chrome-headless-shell';
  try {
    const o = launchOptions({ args: ['--extra'] });
    assert.equal(o.executablePath, '/x/chrome-headless-shell');
    assert.equal(o.headless, 'shell');
    assert.ok(o.args.includes('--mute-audio') && o.args.includes('--disable-audio-output'));
    assert.equal(o.args.at(-1), '--extra');
    assert.equal(launchOptions({ playwright: true }).headless, true);
  } finally {
    if (prev === undefined) delete process.env.CHROME_BIN; else process.env.CHROME_BIN = prev;
  }
});

test('isShell tells the shell from the full app', () => {
  assert.ok(isShell('/a/chrome-headless-shell'));
  assert.ok(!isShell('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'));
  assert.ok(QUIET_ARGS.includes('--disable-audio-input'));
});

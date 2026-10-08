// Single picker for headless Chrome: the full app takes 50-120s to start here, the headless shell <1s (2026-10-08).
// puppeteer.launch(launchOptions()) | chromium.launch(launchOptions({ playwright: true })) | `node scripts/lib/chrome.mjs path`
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// v127 drew the visuals-flow board wrong and failed real assertions; v150+ is known good.
export const MIN_SHELL_MAJOR = 150;
const SHELL_ROOTS = ['.cache/hyperframes/chrome/chrome-headless-shell', '.cache/puppeteer/chrome-headless-shell'];
const SHELL_EXE = process.platform === 'win32' ? 'chrome-headless-shell.exe' : 'chrome-headless-shell';

// Audio off: a page stuck on the macOS audio stack hung the board smoke for minutes.
export const QUIET_ARGS = ['--no-sandbox', '--mute-audio', '--disable-audio-output', '--disable-audio-input',
  '--no-first-run', '--password-store=basic', '--use-mock-keychain', '--disable-background-networking', '--disable-sync'];

function fullChromeCandidates() {
  if (process.platform === 'darwin') return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    return roots.map(r => path.join(r, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  }
  return ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
}

export function newestShell(home = os.homedir()) {
  const found = [];
  for (const root of SHELL_ROOTS) {
    const dir = path.join(home, root);
    if (!fs.existsSync(dir)) continue;
    for (const ver of fs.readdirSync(dir)) {
      const v = (ver.split('-').pop() || '').split('.').map(Number);
      if (!(v[0] >= MIN_SHELL_MAJOR)) continue;
      for (const sub of fs.readdirSync(path.join(dir, ver))) {
        const exe = path.join(dir, ver, sub, SHELL_EXE);
        if (fs.existsSync(exe)) found.push({ v, exe });
      }
    }
  }
  found.sort((a, b) => b.v.reduce((d, x, i) => d || x - (a.v[i] ?? 0), 0));
  return found[0]?.exe ?? null;
}

let warned = false;
// CHROME_BIN (or CHROME_PATH) wins, then the newest cached headless shell, then the slow full Chrome app with a warning.
export function findChrome() {
  const forced = process.env.CHROME_BIN || process.env.CHROME_PATH;
  if (forced) return forced;
  const shell = newestShell();
  if (shell) return shell;
  const full = fullChromeCandidates().find(p => fs.existsSync(p)) ?? null;
  if (full && !warned) {
    warned = true;
    console.error(`[chrome] no chrome-headless-shell v${MIN_SHELL_MAJOR}+ cached; using the slow full Chrome. Fix: npx hyperframes browser ensure`);
  }
  return full;
}

export const isShell = exe => path.basename(exe || '').startsWith('chrome-headless-shell');

// Options for puppeteer.launch / playwright chromium.launch. `headless: 'shell'` is puppeteer's mode for the shell binary.
export function launchOptions({ playwright = false, args = [], ...rest } = {}) {
  const executablePath = findChrome();
  if (!executablePath) throw new Error('No Chrome found. Run: npx hyperframes browser ensure');
  const headless = playwright ? true : (isShell(executablePath) ? 'shell' : true);
  return { executablePath, headless, args: [...QUIET_ARGS, ...args], ...rest };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const cmd = process.argv[2] || 'path';
  if (cmd === 'path') {
    const exe = findChrome();
    if (!exe) { console.error('No Chrome found. Run: npx hyperframes browser ensure'); process.exit(1); }
    console.log(exe);
  } else if (cmd === 'args') {
    console.log(QUIET_ARGS.join(' '));
  } else {
    console.error('usage: node scripts/lib/chrome.mjs [path|args]');
    process.exit(2);
  }
}

// Fails when tracked code starts the full Chrome app instead of going through scripts/lib/chrome.mjs.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const CODE = /\.(mjs|cjs|js|ts|tsx|py|sh)$/;
const BAD = [
  [/Google Chrome\.app\/Contents\/MacOS/, 'hard-coded full Chrome app'],
  [/channel:\s*['"]chrome['"]/, "playwright channel 'chrome' (the full app)"],
  [/\bchrome\.exe\b/, 'hard-coded full Chrome on Windows'],
];
// Each exception says why it may name the full app.
const ALLOW = [
  'scripts/lib/chrome.mjs',                          // the helper's own last-resort fallback
  'scripts/lib/chrome.test.mjs',                     // the helper's test suite
  'scripts/check-chrome-launch.mjs',                 // this file
  '.claude/hooks/chrome-via-shell.sh',               // the ad-hoc guard names what it blocks
  '.claude/hooks/test-chrome-via-shell.sh',
  'pipelines/.agents/skills/',                       // vendor packs: local edits are lost on update
  'pipelines/youtube/yt-script/render-outline.mjs',  // Edge/Chromium fallback after findChrome()
  'pipelines/youtube/yt-script/render-script.mjs',
  'tooling/cli/flipkart/pp-flipkart.mjs',            // logged-in scrapers: playwright's own Chromium with a profile
  'tooling/cli/splitwise/pp-splitwise.mjs',
];
const allowed = f => ALLOW.some(a => f === a || (a.endsWith('/') && f.startsWith(a))) || /(^|\/)(archive|skills-archive)\//.test(f);

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(f => CODE.test(f) && !allowed(f));
const hits = [];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    for (const [re, why] of BAD) if (re.test(line)) hits.push(`${f}:${i + 1}: ${why}`);
  });
}
if (hits.length) {
  console.error(hits.join('\n'));
  console.error('CHROME-LAUNCH: use scripts/lib/chrome.mjs (launchOptions / findChrome / `node scripts/lib/chrome.mjs path`).');
  console.error('The full Chrome app takes 50-120s to start on this Mac; the headless shell <1s. See the debugging playbook, row 17.');
  process.exit(1);
}
console.log(`chrome launch OK (${files.length} files)`);

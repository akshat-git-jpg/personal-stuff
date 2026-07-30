import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HASHES = ['', '#card-plan', '#storyboard', '#final-cut'];

if (!fs.existsSync(CHROME)) {
  console.log('SKIP board-ui smoke: no Chrome');
  process.exit(0);
}

const tmpDir = path.join(process.cwd(), '.test-tmp', 'board-ui-smoke');
const slug = 'smoke';
const workdir = path.join(tmpDir, slug);
fs.mkdirSync(workdir, { recursive: true });

// 1. fixture workdir
const fixturesDir = path.join(process.cwd(), 'lib', 'fixtures', 'board');
['cues.json', 'resolved.json', 'transcript.json'].forEach(f => {
  if (fs.existsSync(path.join(fixturesDir, f))) {
    fs.copyFileSync(path.join(fixturesDir, f), path.join(workdir, f));
  } else {
    fs.writeFileSync(path.join(workdir, f), '{}');
  }
});
spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=30', '-c:a', 'libmp3lame', path.join(workdir, 'vo.mp3')]);
fs.writeFileSync(path.join(workdir, 'card-plan.json'), JSON.stringify({
  video: 'smoke',
  approved: false,
  sections: [
    { part: 'body', items: [{ id: 'c01', card: 'a/b', status: 'existing' }] }
  ]
}));

// 2. createServer
const boardMod = await import(path.resolve(process.cwd(), 'lib/board.mjs'));
const server = boardMod.createServer(workdir);
const port = await new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});

try {
  let expectedTabs = null;
  let expectedSlot = null;
  
  for (const hash of HASHES) {
    const url = `http://127.0.0.1:${port}/app/?video=${slug}&probe=layout${hash}`;
    
    // 3. dumpDom
    const dom = await new Promise((resolve, reject) => {
      const child = spawn(CHROME, [
        '--headless=new',
        '--no-sandbox',
        '--password-store=basic',
        '--use-mock-keychain',
        '--no-proxy-server',
        `--user-data-dir=${path.join(tmpDir, 'chrome-profile')}`,
        '--incognito',
        '--disable-gpu',
        '--hide-scrollbars',
        '--virtual-time-budget=8000',
        '--dump-dom',
        url
      ]);
      let out = '';
      let err = '';
      child.stdout.on('data', d => out += d);
      child.stderr.on('data', d => err += d);
      child.on('close', code => {
        if (code !== 0) console.error('Chrome dump-dom error:', err);
        fs.writeFileSync(path.join(tmpDir, 'chrome-out.html'), out);
        resolve(out);
      });
      child.on('error', reject);
    });

    const match = dom.match(/<meta\s+name="layout-probe"\s+content="([^"]+)">/);
    if (!match) throw new Error(`layout-probe meta not found on ${hash || 'run'}`);
    
    const jsonStr = match[1].replace(/&quot;/g, '"');
    const probe = JSON.parse(jsonStr);

    // 4. assertions
    if (probe.headerCount !== 1) throw new Error(`headerCount is ${probe.headerCount} on ${hash || 'run'}`);
    if (probe.header.y !== 0) throw new Error(`header.y is ${probe.header.y} on ${hash || 'run'}`);
    if (!dom.includes('id="videoPicker"')) throw new Error(`videoPicker not found on ${hash || 'run'}`);
    
    if (expectedTabs === null) {
      expectedTabs = probe.tabs;
      expectedSlot = probe.slot;
    } else {
      if (!probe.tabs || probe.tabs.y !== expectedTabs.y || probe.tabs.h !== expectedTabs.h) {
        throw new Error(`tabs rect changed on ${hash || 'run'}: expected ${JSON.stringify(expectedTabs)} got ${JSON.stringify(probe.tabs)}`);
      }
      if (!probe.slot || probe.slot.y !== expectedSlot.y) {
        throw new Error(`slot.y changed on ${hash || 'run'}: expected ${expectedSlot.y} got ${probe.slot.y}`);
      }
    }

    // 5. screenshots
    await new Promise((resolve, reject) => {
      const child = spawn(CHROME, [
        '--headless=new',
        '--no-sandbox',
        '--password-store=basic',
        '--use-mock-keychain',
        '--no-proxy-server',
        `--user-data-dir=${path.join(tmpDir, 'chrome-profile')}`,
        '--incognito',
        '--disable-gpu',
        '--hide-scrollbars',
        '--virtual-time-budget=8000',
        `--window-size=1400,1000`,
        `--screenshot=${path.join(tmpDir, `tab-${hash ? hash.slice(1) : 'run'}.png`)}`,
        url
      ]);
      child.on('close', resolve);
      child.on('error', reject);
    });
  }
  console.log('board-ui smoke OK');
  process.exit(0);
} finally {
  server.close();
}

import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HASHES = ['', '#card-plan', '#storyboard', '#final-cut'];

// 30+ iframed tiles, measured ~20s+ on storyboard, plans 173/174 will add more.
// Need 60s floor so it does not flake on a loaded machine.
const CHROME_TIMEOUT_MS = Number(process.env.BOARD_UI_SMOKE_TIMEOUT_MS ?? 60000);

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
      const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-ui-smoke-'));
      let child;
      const timeout = setTimeout(() => {
        if (child) child.kill('SIGKILL');
        fs.writeFileSync(path.join(tmpDir, 'chrome-out.html'), out);
        fs.rmSync(profileDir, { recursive: true, force: true });
        reject(new Error(`Chrome dump-dom timeout on ${hash || 'run'}. stderr:\n${err}`));
      }, CHROME_TIMEOUT_MS);
      child = spawn(CHROME, [
        '--headless=new',
        '--no-sandbox',
        '--password-store=basic',
        '--use-mock-keychain',
        '--no-proxy-server',
        '--disable-background-networking',
        '--disable-sync',
        `--user-data-dir=${profileDir}`,
        '--disable-gpu',
        '--hide-scrollbars',
        '--virtual-time-budget=8000',
        '--dump-dom',
        '--enable-logging',
        '--v=1',
        url
      ]);
      let out = '';
      let err = '';
      child.stdout.on('data', d => {
        out += d;
        if (out.includes('</html>')) {
          clearTimeout(timeout);
          child.kill('SIGKILL');
          fs.writeFileSync(path.join(tmpDir, 'chrome-out.html'), out);
          resolve(out);
        }
      });
      child.stderr.on('data', d => err += d);
      child.on('close', code => {
        clearTimeout(timeout);
        fs.rmSync(profileDir, { recursive: true, force: true });
        if (code !== 0 && !out.includes('</html>')) console.error('Chrome dump-dom error:', err);
      });
      child.on('error', err => {
        clearTimeout(timeout);
        fs.rmSync(profileDir, { recursive: true, force: true });
        reject(err);
      });
    });

    const match = dom.match(/<meta\s+name="layout-probe"\s+content="([^"]+)">/);
    if (!match) throw new Error(`layout-probe meta not found on ${hash || 'run'}`);
    
    const jsonStr = match[1].replace(/&quot;/g, '"');
    const probe = JSON.parse(jsonStr);

    // 4. assertions
    if (probe.headerCount !== 1) throw new Error(`headerCount is ${probe.headerCount} on ${hash || 'run'}`);
    if (probe.header.y !== 0) throw new Error(`header.y is ${probe.header.y} on ${hash || 'run'}`);
    if (!dom.includes('id="videoPicker"')) throw new Error(`videoPicker not found on ${hash || 'run'}`);
    if (hash === '#card-plan') {
      
      const idx = dom.indexOf('<div class="action-slot">');
      const actionSlotMatch = idx > -1 ? [dom.slice(idx, idx + 200)] : null;

      if (!actionSlotMatch || !actionSlotMatch[0].includes('Approve card plan')) {
        throw new Error('Approve card plan not found inside .action-slot');
      }
      if (!dom.includes('data-rid="cp:c01"')) throw new Error('data-rid="cp:c01" not found on #card-plan');
      if (!dom.includes('plan-note"')) throw new Error('plan-note not found on #card-plan');
    }
    if (hash === '#storyboard') {
      if (!dom.includes('class="tl-ruler"')) throw new Error('tl-ruler not found');
      const ticks = dom.match(/class="tl-tick"/g) || [];
      if (ticks.length < 2) throw new Error(`Expected >=2 tl-tick, found ${ticks.length}`);
      
      const graphicsTrackIdx = dom.indexOf('id="tlGraphics"');
      const graphicsTrackSlice = dom.slice(graphicsTrackIdx, graphicsTrackIdx + 1000);
      const blocks = graphicsTrackSlice.match(/class="tl-block"/g) || [];
      if (blocks.length < 1) throw new Error('Expected >=1 tl-block in graphics track');
      
      if (!dom.includes('id="detail-panel"')) throw new Error('detail-panel not found');
      if (!dom.includes('click a block to preview')) throw new Error('detail dock placeholder not found');
      
      if (!dom.includes('Timeline</button>')) throw new Error('Timeline toggle not found');
      if (!dom.includes('List</button>')) throw new Error('List toggle not found');

      const idxSlot = dom.indexOf('<div class="action-slot">');
      const slotMatch = idxSlot > -1 ? dom.slice(idxSlot, idxSlot + 300) : '';
      if (!slotMatch.includes('Approve graphics')) throw new Error('Approve graphics not found inside .action-slot');
      
      const idxRow2 = dom.indexOf('<div class="app-header-row2">');
      const row2Match = idxRow2 > -1 ? dom.slice(idxRow2, idxRow2 + 500) : '';
      if (!row2Match.includes('Save')) throw new Error('Save not found inside .app-header-row2');
    }

    
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
  }

  // 5. screenshots
  const distAssets = fs.readdirSync(path.join(process.cwd(), 'board-ui/dist/assets'));
  const cssFile = distAssets.find(f => f.endsWith('.css'));
  const cssContent = fs.readFileSync(path.join(process.cwd(), 'board-ui/dist/assets', cssFile), 'utf8');

  for (const hash of ['#run', '#card-plan', '#storyboard', '#final-cut']) {
    const url = `http://127.0.0.1:${port}/app/?video=${slug}${hash}`;
    const outPath = path.join(workdir, `tab-${hash ? hash.slice(1) : 'run'}.png`);
    
    const domOut = await new Promise((resolve, reject) => {
      const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-ui-smoke-'));
      let child;
      const timeout = setTimeout(() => {
        if (child) child.kill('SIGKILL');
        fs.rmSync(profileDir, { recursive: true, force: true });
        reject(new Error(`Chrome dump-dom timeout on ${hash}`));
      }, CHROME_TIMEOUT_MS);
      child = spawn(CHROME, [
        '--headless=new', '--no-sandbox', '--disable-background-networking',
        `--user-data-dir=${profileDir}`, '--disable-gpu', '--hide-scrollbars',
        '--virtual-time-budget=8000', '--dump-dom', url
      ]);
      let out = '';
      child.stdout.on('data', d => {
        out += d;
        if (out.includes('</html>')) {
          clearTimeout(timeout);
          child.kill('SIGKILL');
          resolve(out);
        }
      });
      child.on('close', () => {
        clearTimeout(timeout);
        fs.rmSync(profileDir, { recursive: true, force: true });
      });
      child.on('error', e => {
        clearTimeout(timeout);
        fs.rmSync(profileDir, { recursive: true, force: true });
        reject(e);
      });
    });

    const injectedHtml = domOut.replace(/<link[^>]+rel="stylesheet"[^>]+>/, `<style>${cssContent}</style>`);
    const staticHtmlPath = path.resolve(process.cwd(), tmpDir, `shot-${hash ? hash.slice(1) : 'run'}.html`);
    fs.writeFileSync(staticHtmlPath, injectedHtml);

    await new Promise((resolve, reject) => {
      const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-ui-smoke-'));
      let child;
      const timeout = setTimeout(() => {
        if (child) child.kill('SIGKILL');
        fs.rmSync(profileDir, { recursive: true, force: true });
        reject(new Error(`Chrome screenshot timeout on static ${hash}`));
      }, 10000);
      child = spawn(CHROME, [
        '--headless=new', '--no-sandbox', `--user-data-dir=${profileDir}`,
        '--disable-gpu', '--hide-scrollbars', `--window-size=1400,1000`,
        `--screenshot=${outPath}`, `file://${staticHtmlPath}`
      ]);
      const poll = setInterval(() => {
        if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
          clearInterval(poll);
          clearTimeout(timeout);
          child.kill('SIGKILL');
          resolve();
        }
      }, 100);
      child.on('close', code => {
        clearInterval(poll);
        clearTimeout(timeout);
        fs.rmSync(profileDir, { recursive: true, force: true });
        if (fs.existsSync(outPath)) resolve();
        else reject(new Error(`Screenshot missing on ${hash}`));
      });
      child.on('error', e => {
        clearInterval(poll);
        clearTimeout(timeout);
        fs.rmSync(profileDir, { recursive: true, force: true });
        reject(e);
      });
    });
  }
  // pre-040 degraded
  const workdirPre = path.join(tmpDir, 'smoke-pre');
  fs.mkdirSync(workdirPre, { recursive: true });
  ['cues.json', 'transcript.json'].forEach(f => {
    fs.copyFileSync(path.join(workdir, f), path.join(workdirPre, f));
  });
  fs.copyFileSync(path.join(workdir, 'vo.mp3'), path.join(workdirPre, 'vo.mp3'));
  fs.copyFileSync(path.join(workdir, 'card-plan.json'), path.join(workdirPre, 'card-plan.json'));

  const serverPre = boardMod.createServer(workdirPre);
  const portPre = await new Promise((resolve) => {
    serverPre.listen(0, '127.0.0.1', () => resolve(serverPre.address().port));
  });

  try {
    const urlPre = `http://127.0.0.1:${portPre}/app/?video=smoke-pre#storyboard`;
    const domPre = await new Promise((resolve, reject) => {
      const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-ui-smoke-'));
      let child;
      const timeout = setTimeout(() => {
        if (child) child.kill('SIGKILL');
        fs.rmSync(profileDir, { recursive: true, force: true });
        reject(new Error(`Chrome dump-dom timeout on pre-040`));
      }, CHROME_TIMEOUT_MS);
      child = spawn(CHROME, [
        '--headless=new', '--no-sandbox', '--disable-background-networking',
        `--user-data-dir=${profileDir}`, '--disable-gpu', '--hide-scrollbars',
        '--virtual-time-budget=8000', '--dump-dom', urlPre
      ]);
      let out = '';
      child.stdout.on('data', d => {
        out += d;
        if (out.includes('</html>')) {
          clearTimeout(timeout);
          child.kill('SIGKILL');
          resolve(out);
        }
      });
      child.on('close', () => {
        clearTimeout(timeout);
        fs.rmSync(profileDir, { recursive: true, force: true });
      });
      child.on('error', e => {
        clearTimeout(timeout);
        fs.rmSync(profileDir, { recursive: true, force: true });
        reject(e);
      });
    });

    if (!domPre.includes('no <code>resolved.json</code> yet')) {
      throw new Error('no resolved banner not found');
    }
    if (!domPre.match(/disabled[^>]*>Approve graphics/)) {
      throw new Error('Approve graphics should be disabled');
    }
  } finally {
    if (serverPre.closeAllConnections) serverPre.closeAllConnections();
    serverPre.close();
  }

  console.log('board-ui smoke OK');
  process.exit(0);
} finally {
  if (server.closeAllConnections) server.closeAllConnections();
  server.close();
}

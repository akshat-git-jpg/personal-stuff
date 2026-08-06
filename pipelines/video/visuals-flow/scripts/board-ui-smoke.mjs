import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HASHES = ['', '#card-plan', '#intro', '#storyboard', '#final-cut', '#calibrate'];

// 30+ iframed tiles, measured ~20s+ on storyboard, plans 173/174 will add more.
// Need 60s floor so it does not flake on a loaded machine.
// 120s: a parallel Chrome-heavy job on the same machine pushed a dump past
// 60s and flaked the merge gate (2026-07-31) — the ceiling must absorb load.
const CHROME_TIMEOUT_MS = Number(process.env.BOARD_UI_SMOKE_TIMEOUT_MS ?? 120000);

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
    { part: 'body', items: [{ id: 'c01', card: 'a/b', status: 'existing' }, { id: 'c02', card: 'c/d', status: 'new' }] }
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
    if (!dom.includes(`<title>${slug} — visuals-flow board</title>`)) throw new Error(`page title missing or wrong on ${hash || 'run'}`);

    if (hash === '#card-plan') {
      
      const idx = dom.indexOf('<div class="action-slot">');
      const actionSlotMatch = idx > -1 ? [dom.slice(idx, idx + 200)] : null;

      if (!actionSlotMatch || !actionSlotMatch[0].includes('Approve card plan')) {
        throw new Error('Approve card plan not found inside .action-slot');
      }
      if (!dom.includes('data-rid="cp:c01"')) throw new Error('data-rid="cp:c01" not found on #card-plan');
      if (!dom.includes('plan-note"')) throw new Error('plan-note not found on #card-plan');
      if (!dom.includes('NEW — to build')) throw new Error('NEW — to build chip not found on #card-plan');
    }
    if (hash === '#intro') {
      if (!dom.includes('This video does not use the bespoke intro film.')) throw new Error('intro missing-film text not found on #intro');
    }
    if (hash === '#storyboard') {
      // LIST is the default view (owner call 2026-07-31) — assert tile anatomy.
      // Timeline-mode anatomy is asserted below via the ?view=timeline override.
      if (!dom.includes('timeline-block tile reviewable')) throw new Error('no cue tile in default (list) storyboard view');
      if (!dom.includes('<mark>')) throw new Error('no highlighted anchor <mark> in a tile excerpt');
      if (!dom.includes('class="fb-shot"')) throw new Error('no fb-shot attach row in list view');

      // List must be the FIRST toggle button and active by default.
      const iList = dom.indexOf('List</button>');
      const iTimeline = dom.indexOf('Timeline</button>');
      if (iList === -1 || iTimeline === -1) throw new Error('view toggle buttons not found');
      if (iList > iTimeline) throw new Error('List must be the first view-toggle button');
      const listBtnStart = dom.lastIndexOf('<button', iList);
      if (!dom.slice(listBtnStart, iList).includes('active')) throw new Error('List must be the active default view');

      const idxSlot = dom.indexOf('<div class="action-slot">');
      const slotMatch = idxSlot > -1 ? dom.slice(idxSlot, idxSlot + 300) : '';
      if (!slotMatch.includes('Approve graphics')) throw new Error('Approve graphics not found inside .action-slot');

      const idxRow2 = dom.indexOf('<div class="app-header-row2">');
      const row2Match = idxRow2 > -1 ? dom.slice(idxRow2, idxRow2 + 500) : '';
      if (!row2Match.includes('Save')) throw new Error('Save not found inside .app-header-row2');
      // flagged/note controls were removed from everywhere (owner 2026-07-31)
      if (dom.includes('flag: no card fits') || dom.includes('why no card fits')) {
        throw new Error('removed flag/note controls are back in the storyboard');
      }
    }
    if (hash === '#final-cut') {
      const idxSlot = dom.indexOf('<div class="action-slot">');
      const slotMatch = idxSlot > -1 ? dom.slice(idxSlot, idxSlot + 300) : '';
      if (!slotMatch.includes('Approve final cut')) throw new Error('Approve final cut not found inside .action-slot on #final-cut');
      // This fixture has no assembled cut, so the surface must SAY so rather
      // than show a transport wired to nothing. The transport itself is one
      // shared component and is covered by the intro fixture below, which has
      // a real clip.
      if (!dom.includes('rs-empty')) throw new Error('#final-cut with no versions must render the empty state');
      if (!dom.includes('No assembled cut to review yet')) {
        throw new Error('#final-cut empty state must say there is no cut yet');
      }
      const idxPanel = dom.indexOf('class="rs-panel"');
      const panelMatch = idxPanel > -1 ? dom.slice(idxPanel, idxPanel + 1000) : '';
      if (panelMatch.includes('Approve final cut')) throw new Error('Approve final cut found inside comments panel on #final-cut');
    }
    if (hash === '#calibrate') {
      if (!dom.includes('class="timeline-block tile reviewable"')) throw new Error('no calibrate tile found on #calibrate');
    }
    if (hash === '') {
      if (!dom.includes('✅') && !dom.includes('❌') && !dom.includes('⏳')) throw new Error('Run tab emojis not found');
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


  // Check server post-cutover redirects
  {
    
    const resList = await fetch(`http://127.0.0.1:${port}/list?video=test-01`, { redirect: 'manual' });
    if (resList.status !== 302 || resList.headers.get('location') !== '/?video=test-01#storyboard') {
      throw new Error('/list?video=test-01 did not 302 to /?video=test-01#storyboard');
    }
    const resBare = await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' });
    if (resBare.status !== 302) throw new Error('/ did not 302');
  }

  // Approved card plan with NEW items must show the build-next-step banner
  // (plan 174 disposition of the legacy banner test; the fixture has c02
  // status:"new", so toBuild > 0).
  {
    const resApprove = await fetch(`http://127.0.0.1:${port}/approve-card-plan`, { method: 'POST' });
    if (!resApprove.ok) throw new Error('POST /approve-card-plan failed in smoke');
    const domApproved = await new Promise((resolve, reject) => {
      const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-ui-smoke-'));
      let child;
      const timeout = setTimeout(() => {
        if (child) child.kill('SIGKILL');
        fs.rmSync(profileDir, { recursive: true, force: true });
        reject(new Error('Chrome dump-dom timeout on approved #card-plan'));
      }, CHROME_TIMEOUT_MS);
      child = spawn(CHROME, [
        '--headless=new', '--no-sandbox', '--disable-background-networking',
        `--user-data-dir=${profileDir}`, '--disable-gpu', '--hide-scrollbars',
        '--virtual-time-budget=8000', '--dump-dom',
        `http://127.0.0.1:${port}/app/?video=${slug}#card-plan`
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
    // Approved state lives on the button (banners removed — owner 2026-07-31)
    if (!domApproved.includes('✓ card plan approved')) {
      throw new Error('approved card plan must show the ✓ approved button state');
    }
    if (domApproved.includes('build the NEW cards')) {
      throw new Error('approved banner should be gone from #card-plan');
    }
  }

  // Timeline mode still works behind the ?view=timeline override (list is the
  // default view since 2026-07-31).
  {
    const domTl = await new Promise((resolve, reject) => {
      const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-ui-smoke-'));
      let child;
      const timeout = setTimeout(() => {
        if (child) child.kill('SIGKILL');
        fs.rmSync(profileDir, { recursive: true, force: true });
        reject(new Error('Chrome dump-dom timeout on ?view=timeline#storyboard'));
      }, CHROME_TIMEOUT_MS);
      child = spawn(CHROME, [
        '--headless=new', '--no-sandbox', '--disable-background-networking',
        `--user-data-dir=${profileDir}`, '--disable-gpu', '--hide-scrollbars',
        '--virtual-time-budget=8000', '--dump-dom',
        `http://127.0.0.1:${port}/app/?video=${slug}&view=timeline#storyboard`
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
    if (!domTl.includes('class="tl-ruler"')) throw new Error('tl-ruler not found in ?view=timeline');
    const ticks = domTl.match(/class="tl-tick"/g) || [];
    if (ticks.length < 2) throw new Error(`Expected >=2 tl-tick in ?view=timeline, found ${ticks.length}`);
    const graphicsTrackIdx = domTl.indexOf('id="tlGraphics"');
    const graphicsTrackSlice = domTl.slice(graphicsTrackIdx, graphicsTrackIdx + 1000);
    if (!(graphicsTrackSlice.match(/class="tl-block"/g) || []).length) throw new Error('Expected >=1 tl-block in ?view=timeline graphics track');
    if (!domTl.includes('id="detail-panel"')) throw new Error('detail-panel not found in ?view=timeline');
    if (!domTl.includes('click a block to preview')) throw new Error('detail dock placeholder not found in ?view=timeline');
  }

  // 5. screenshots
  const distAssets = fs.readdirSync(path.join(process.cwd(), 'board-ui/dist/assets'));
  const cssFile = distAssets.find(f => f.endsWith('.css'));
  const cssContent = fs.readFileSync(path.join(process.cwd(), 'board-ui/dist/assets', cssFile), 'utf8');

  const domByHash = {};
  for (const hash of ['#run', '#card-plan', '#intro', '#storyboard', '#final-cut']) {
    const url = `http://127.0.0.1:${port}/app/?video=${slug}${hash}`;
    const outPath = path.join(workdir, `tab-${hash ? hash.slice(1) : 'run'}.png`);
    // A leftover file from a previous run satisfies the poll below instantly
    // and Chrome gets killed before rendering — screenshots would silently
    // never refresh (found 2026-07-31, an hour-stale storyboard png).
    fs.rmSync(outPath, { force: true });
    
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

    domByHash[hash] = domOut;

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

  // ---- Intro player transport is wired ------------------------------------
  // The <video> mounts only AFTER /api/intro-data answers, so a listener effect
  // that reads the ref on first render sees null and never subscribes. Nothing
  // throws and the film still paints its first frame, so this is invisible to a
  // build, a typecheck and every unit test — the only symptom is a dead
  // transport: duration stuck at 00:00, clock stuck at 00:00:00, and a Play
  // button that can never pause (owner report 2026-08-06). Assert the rendered
  // duration, which is exactly the bit that was wrong.
  const introSlug = 'smoke-intro';
  const introWorkdir = path.join(tmpDir, introSlug);
  fs.mkdirSync(path.join(introWorkdir, 'intro-film', 'out'), { recursive: true });
  fs.writeFileSync(path.join(introWorkdir, 'run-config.json'),
    JSON.stringify({ engine: 'heygen3', review: 'full', intro: 'film' }));
  fs.copyFileSync(path.join(workdir, 'vo.mp3'), path.join(introWorkdir, 'vo.mp3'));
  // The real transcript fixture, not a {} stub: board-data builds segments from
  // its words and 500s without them, and the Intro tab loads board-data too.
  fs.copyFileSync(path.join(workdir, 'transcript.json'), path.join(introWorkdir, 'transcript.json'));
  // One existing comment, so the per-comment controls actually render.
  fs.writeFileSync(path.join(introWorkdir, 'feedback.json'), JSON.stringify({
    video: introSlug,
    items: { 'intro:0': { text: 'an existing note', t: 2, context: 'intro@00:02' } },
  }));
  fs.writeFileSync(path.join(introWorkdir, 'intro-film', 'screenplay.json'), JSON.stringify({
    approved: false,
    beats: [
      { id: 'b01', intent: 'hook', register: 'dark', face: 'full', t_start: 0, t_end: 4, clause: 'a', stage: 'b' },
      { id: 'b02', intent: 'stakes', register: 'dark', face: 'panel', t_start: 4, t_end: 7, clause: 'c', stage: 'd' },
    ],
  }));
  // 7s so the rendered duration is unambiguous — and +faststart, because a moov
  // atom at the tail is its own way to make duration never arrive.
  const introMp4 = path.join(introWorkdir, 'intro-film', 'out', 'intro.mp4');
  const enc = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=30:duration=7',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', introMp4]);
  if (enc.status !== 0 || !fs.existsSync(introMp4)) {
    console.log('SKIP intro player check: ffmpeg could not build the fixture clip');
  } else {
    const serverIntro = boardMod.createServer(introWorkdir);
    const portIntro = await new Promise((resolve) => {
      serverIntro.listen(0, '127.0.0.1', () => resolve(serverIntro.address().port));
    });
    try {
      const urlIntro = `http://127.0.0.1:${portIntro}/app/?video=${introSlug}#intro`;
      const domIntro = await new Promise((resolve, reject) => {
        const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-ui-smoke-'));
        let child;
        const timeout = setTimeout(() => {
          if (child) child.kill('SIGKILL');
          fs.rmSync(profileDir, { recursive: true, force: true });
          reject(new Error('Chrome dump-dom timeout on #intro player'));
        }, CHROME_TIMEOUT_MS);
        child = spawn(CHROME, [
          '--headless=new', '--no-sandbox', '--disable-background-networking',
          `--user-data-dir=${profileDir}`, '--disable-gpu', '--hide-scrollbars',
          '--virtual-time-budget=8000', '--dump-dom', urlIntro
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

      if (!domIntro.includes('class="rs-video"')) {
        throw new Error('intro player: no <video> rendered for an intro-film video');
      }
      const clock = domIntro.match(/<span class="rs-clock">.*?<span class="cur">([^<]*)<\/span>[^<]*<span>([^<]*)<\/span>/);
      if (!clock) throw new Error('intro player: transport clock not found');
      if (clock[2] === '00:00') {
        throw new Error(
          'intro player: duration reads 00:00 — the media listeners never attached, '
          + 'so the transport is dead (clock frozen, Play cannot pause)');
      }

      // Review-surface parity. Intro and Final Cut are the SAME component now
      // (components/ReviewSurface.tsx); they used to be two near-copies, and the
      // copy that was not Final Cut shipped without attach and without edit
      // (owner report 2026-08-06). Assert both render the same surface, so a
      // future step that mounts ReviewSurface cannot quietly lose half of it.
      const SURFACE_MARKERS = [
        ['rs-container', 'the shared review surface'],
        ['rs-panel', 'the comment panel'],
        ['rs-input', 'the comment composer'],
        ['📎 image', 'attach a screenshot'],
      ];
      for (const [dom, where] of [[domIntro, '#intro'], [domByHash['#final-cut'], '#final-cut']]) {
        for (const [needle, what] of SURFACE_MARKERS) {
          if (!dom.includes(needle)) {
            throw new Error(`${where} is missing ${what} ("${needle}") — the two review tabs have diverged again`);
          }
        }
      }
      // Per-comment controls need a comment to exist, which only the intro
      // fixture has.
      for (const [needle, what] of [['✎ Edit', 'edit a comment'], ['✕ Delete', 'delete a comment']]) {
        if (!domIntro.includes(needle)) {
          throw new Error(`intro review: no way to ${what} — "${needle}" control is missing`);
        }
      }
    } finally {
      if (serverIntro.closeAllConnections) serverIntro.closeAllConnections();
      serverIntro.close();
    }
  }

  console.log('board-ui smoke OK');
  process.exit(0);
} finally {
  if (server.closeAllConnections) server.closeAllConnections();
  server.close();
}

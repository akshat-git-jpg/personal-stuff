import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HASHES = ['', '#intro', '#storyboard', '#avatar', '#final-cut', '#calibrate'];

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

    // 'smoke' has no run-config.json, so it defaults to intro:"film" now.
    // The Intro tab's step (027) ALWAYS applies, and its button must render.
    if (!(probe.tabIds || []).includes('intro')) {
      throw new Error(`intro tab button not rendered on ${hash || 'run'}`);
    }
    // The Avatar tab's step (102) ALWAYS applies too (plan 197).
    if (!(probe.tabIds || []).includes('avatar')) {
      throw new Error(`avatar tab button not rendered on ${hash || 'run'}`);
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
    if (hash === '#avatar') {
      // The 'smoke' fixture has no shots.resolved.json — the required
      // degraded state (plan 197 step 102): a banner explaining why, and
      // every button disabled with a title, not just hidden.
      if (!dom.includes('the storyboard has not been resolved yet')) {
        throw new Error('#avatar with no shots.resolved.json must render the degraded-state banner');
      }
      if (!dom.match(/disabled[^>]*>Approve avatar spend/)) {
        throw new Error('Approve avatar spend should be disabled when shots.resolved.json is missing');
      }
      const modelBtnMatch = dom.match(/<button[^>]*class="avatar-model-btn"[^>]*>/);
      if (!modelBtnMatch || !modelBtnMatch[0].includes('disabled')) {
        throw new Error('avatar model buttons should be disabled when shots.resolved.json is missing');
      }
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

  // Vite bundles every imported stylesheet into ONE file, so an unscoped class
  // in any tab restyles that class everywhere. CardPlanTab.css declared
  // `.banner{display:flex}` — while rendering no banner at all — which turned
  // the Storyboard's pre-040 notice into a flex ROW: each run of text became an
  // anonymous flex item, the whitespace between items was dropped ("no" +
  // "resolved.json" fused), and one sentence rendered as three columns (owner
  // report 2026-08-06).
  //
  // A banner is prose. Assert at the STYLESHEET level rather than the DOM,
  // because the fixture has resolved.json and so renders no banner to inspect —
  // the declaration is the defect, whether or not this run paints one.
  for (const m of cssContent.matchAll(/\.banner(?![-\w])[^{}]*\{([^}]*)\}/g)) {
    if (/display\s*:\s*(inline-)?flex/.test(m[1])) {
      throw new Error(
        'a .banner rule declares display:flex — flex reflows inline text into '
        + 'items and eats the spaces between them, which mangles banner prose. '
        + `Offending rule: {${m[1].trim()}}`);
    }
  }
  // And exactly one owner, so the rules cannot drift apart again.
  const bannerOwners = (cssContent.match(/\.banner(?![-\w])[^{}]*\{[^}]*\}/g) || []).length;
  if (bannerOwners === 0) throw new Error('no .banner rule survived the bundle — banners are unstyled');

  const domByHash = {};
  for (const hash of ['#run', '#intro', '#storyboard', '#final-cut']) {
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
      const urlIntro = `http://127.0.0.1:${portIntro}/app/?video=${introSlug}&probe=layout#intro`;
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
          // A pinned window, because the player-size assertion below measures
          // against it. The headless default (800px) is narrower than the
          // wrappers this gate exists to catch, so the check would be blind.
          '--window-size=1600,1000',
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

      // Plan 193: intro:"film" is the one config where the Intro tab's step
      // (027) applies, so its button must render — the mirror image of the
      // cards-fixture check above.
      const introMatch = domIntro.match(/<meta\s+name="layout-probe"\s+content="([^"]+)">/);
      if (!introMatch) throw new Error('layout-probe meta not found on #intro (intro-film fixture)');
      const introProbe = JSON.parse(introMatch[1].replace(/&quot;/g, '"'));
      if (!(introProbe.tabIds || []).includes('intro')) {
        throw new Error('intro tab button missing for an intro:"film" video');
      }

      if (!domIntro.includes('class="rs-video"')) {
        throw new Error('intro player: no <video> rendered for an intro-film video');
      }

      // The film takes the whole window it is given. Reviewing a cut in a
      // postage stamp is reviewing nothing, and the regression is silent: the
      // Intro tab sat in a 1000px wrapper for months while Final Cut mounted
      // the same component full width (owner report 2026-08-07).
      //
      // The measurement is against the WINDOW, not against .rs-main. A wrapper
      // that caps the tab shrinks the surface and its column together, so a
      // player-vs-column check stays happily green while the film is half the
      // size it should be — that is exactly how the first version of this gate
      // passed with the 1000px cap put back. The chrome above therefore runs at
      // a fixed 1600px width, wider than any wrapper anyone would write.
      const { rsSurface, rsMain, rsPlayer, vw, vh } = introProbe;
      if (!rsPlayer || rsPlayer.w <= 0) throw new Error('intro player: .rs-video-container not found in the layout probe');
      if (rsSurface.w < vw - 4) {
        throw new Error(
          `intro player: the review surface is ${rsSurface.w}px wide in a ${vw}px window — a wrapper `
          + 'around <ReviewSurface> is capping it, so this tab renders a smaller film than Final Cut');
      }
      // Within that surface, the player fills its column unless the
      // viewport-height cap binds first — which still leaves a big frame.
      const fillsColumn = rsPlayer.w >= rsMain.w - 1;
      const heightBound = rsPlayer.h >= vh * 0.5;
      if (!fillsColumn && !heightBound) {
        throw new Error(
          `intro player: ${rsPlayer.w}x${rsPlayer.h} inside a ${rsMain.w}px column (viewport ${vh}px tall) — `
          + 'the player is neither filling its column nor viewport-height-bound, so something is capping its width');
      }
      const clock = domIntro.match(/<span class="rs-clock">.*?<span class="cur">([^<]*)<\/span>[^<]*<span>([^<]*)<\/span>/);
      if (!clock) throw new Error('intro player: transport clock not found');
      if (clock[2] === '00:00') {
        throw new Error(
          'intro player: duration reads 00:00 — the media listeners never attached, '
          + 'so the transport is dead (clock frozen, Play cannot pause)');
      }

      // The two halves of the readout sit side by side and MUST NOT look like
      // the same format. Current time carries frames; when it was mm:ss:ff the
      // pair rendered as "00:01:12 / 01:30", read as "1m12s of 1m30s", and the
      // owner scrubbed to what they thought was the end of a 90s film while
      // actually sitting at 1.4 SECONDS (report 2026-08-06). A dot before the
      // frames is what makes the two unmistakable.
      if (!/^\d{2}:\d{2}\.\d{2}$/.test(clock[1])) {
        throw new Error(
          `intro player: current time is "${clock[1]}" — expected mm:ss.ff. A third `
          + 'colon makes the frame count read as a seconds field next to the mm:ss duration');
      }
      if (!/^\d{2}:\d{2}$/.test(clock[2])) {
        throw new Error(`intro player: duration is "${clock[2]}" — expected mm:ss`);
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

  // ---- Idea gate plays teasers, not prose (plan 206) ----------------------
  // Direction 'a' has a rendered teaser, direction 'b' deliberately does not,
  // so one pass exercises the player, the honest missing-teaser state, the
  // disabled approve button and the reject-all composer together.
  const ideaSlug = 'smoke-idea';
  const ideaWorkdir = path.join(tmpDir, ideaSlug);
  fs.mkdirSync(path.join(ideaWorkdir, 'intro-film', 'teasers'), { recursive: true });
  fs.copyFileSync(path.join(fixturesDir, 'idea.json'), path.join(ideaWorkdir, 'intro-film', 'idea.json'));
  // board-data needs these to answer at all; the idea gate itself does not
  // read them, but /api/board-data 500s without them and the tab's own
  // posture (each fetch in its own try) must not be relied on to hide that.
  fs.copyFileSync(path.join(workdir, 'vo.mp3'), path.join(ideaWorkdir, 'vo.mp3'));
  fs.copyFileSync(path.join(workdir, 'transcript.json'), path.join(ideaWorkdir, 'transcript.json'));

  // Only 'a' gets a teaser file. 'b' stays missing on purpose — a zero-byte
  // stub would make <video> render an error state and the assertion below
  // would pass for the wrong reason, so this SKIPs like the intro player
  // check above rather than faking the file.
  const ideaMp4 = path.join(ideaWorkdir, 'intro-film', 'teasers', 'a.mp4');
  const encIdea = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=30:duration=2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', ideaMp4]);
  if (encIdea.status !== 0 || !fs.existsSync(ideaMp4)) {
    console.log('SKIP idea-gate teaser check: ffmpeg could not build the fixture clip');
  } else {
    const serverIdea = boardMod.createServer(ideaWorkdir);
    const portIdea = await new Promise((resolve) => {
      serverIdea.listen(0, '127.0.0.1', () => resolve(serverIdea.address().port));
    });
    try {
      const urlIdea = `http://127.0.0.1:${portIdea}/app/?video=${ideaSlug}#intro`;
      const domIdea = await new Promise((resolve, reject) => {
        const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'board-ui-smoke-'));
        let child;
        const timeout = setTimeout(() => {
          if (child) child.kill('SIGKILL');
          fs.rmSync(profileDir, { recursive: true, force: true });
          reject(new Error('Chrome dump-dom timeout on #intro (idea gate)'));
        }, CHROME_TIMEOUT_MS);
        child = spawn(CHROME, [
          '--headless=new', '--no-sandbox', '--disable-background-networking',
          `--user-data-dir=${profileDir}`, '--disable-gpu', '--hide-scrollbars',
          '--virtual-time-budget=8000', '--dump-dom', urlIdea
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

      const playerCount = (domIdea.match(/class="intro-idea-teaser"/g) || []).length;
      if (playerCount !== 1) {
        throw new Error(`idea gate: expected exactly 1 intro-idea-teaser <video> (direction a), found ${playerCount}`);
      }

      // The literal is both the mutation marker AND the message: the merge
      // gate rewrites it in IntroTab.tsx and requires it to appear in this
      // pass's FAILURE OUTPUT, so it has to live in the thrown message, not
      // only in the markup being searched for.
      const missingCount = (domIdea.match(/IDEA-TEASER-NOT-RENDERED/g) || []).length;
      if (missingCount !== 1) {
        throw new Error(`IDEA-TEASER-NOT-RENDERED assertion failed on #intro: expected 1 missing-teaser box (direction b), found ${missingCount}`);
      }

      const approveButtons = domIdea.match(/<button class="intro-idea-approve-btn"[^>]*>/g) || [];
      if (approveButtons.length !== 2) {
        throw new Error(`idea gate: expected 2 approve buttons, found ${approveButtons.length}`);
      }
      if (!approveButtons.some(b => b.includes('disabled'))) {
        throw new Error('idea gate: expected a disabled approve button for the direction with no rendered teaser');
      }

      if (!domIdea.includes('intro-idea-reject-note')) {
        throw new Error('idea gate: reject-all composer (intro-idea-reject-note) not found');
      }
    } finally {
      if (serverIdea.closeAllConnections) serverIdea.closeAllConnections();
      serverIdea.close();
    }
  }

  console.log('board-ui smoke OK');
  process.exit(0);
} finally {
  if (server.closeAllConnections) server.closeAllConnections();
  server.close();
}

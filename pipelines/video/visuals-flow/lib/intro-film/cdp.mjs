// A zero-dependency Chrome DevTools Protocol client, just enough to seek a
// composition and measure it.
//
// WHY NOT PUPPETEER/PLAYWRIGHT: `pipelines/video/visuals-flow/` has no
// package.json and no node_modules, on purpose — everything runs as plain `node`
// plus `npx <pinned-package>`. Two facts make a raw client the cheaper option:
// the renderer already downloads and manages a Chrome build (so there is a
// binary to point at), and Node >= 22 ships a global `WebSocket` (so CDP needs
// no transport library). Adding a dependency here would be the larger change.
//
// WHY THE RENDERER'S CHROME: if the checker measured a different browser than
// the one that renders the film, the two could disagree about layout and the
// gate would be reporting on a picture nobody ships.

import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { npxArgs, npxSpawnOpts } from './npx.mjs';
import { FILM_RENDERER } from '../renderer-constants.mjs';

// The renderer already manages a Chrome download; reuse THAT binary so the
// checker and the render never disagree about the engine.
export function chromePath() {
  const r = spawnSync('npx', npxArgs(['-y', FILM_RENDERER, 'browser', 'path']),
    npxSpawnOpts({ encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
  if (r.status !== 0) throw new Error(`hyperframes browser path failed (exit ${r.status})`);
  const line = String(r.stdout).trim().split(/\r?\n/).filter(Boolean).pop();
  if (!line) throw new Error('hyperframes browser path printed nothing');
  return line;
}

// port 0 => the OS picks a free one. A fixed port collides when two runs overlap.
export async function launch() {
  const exe = chromePath();
  const proc = spawn(exe, [
    '--headless=new', '--remote-debugging-port=0', '--no-first-run',
    '--disable-gpu', '--hide-scrollbars', '--window-size=1920,1080',
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const t = setTimeout(() => reject(new Error('chrome did not report a DevTools endpoint in 30s')), 30000);
    proc.stderr.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(t); resolve(m[1]); }
    });
    proc.on('exit', (c) => { clearTimeout(t); reject(new Error(`chrome exited early (${c})`)); });
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP socket failed')); });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  // One tab, driven through a flat session.
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  return {
    async goto(file) {
      await send('Page.enable', {}, sessionId);
      await send('Page.navigate', { url: pathToFileURL(file).href }, sessionId);
      // Poll for the composition runtime rather than racing a load event: the
      // films register `window.__timelines` from an inline script, so a load
      // event can fire before there is anything to seek.
      for (let i = 0; i < 200; i++) {
        const r = await this.eval('!!(window.__timelines && Object.keys(window.__timelines).length)');
        if (r === true) return;
        await new Promise((s) => setTimeout(s, 100));
      }
      throw new Error('window.__timelines never appeared — is this a composition?');
    },
    async eval(expression) {
      const r = await send('Runtime.evaluate',
        { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) {
        // `exceptionDetails.text` is just "Uncaught" — the real message lives on
        // the exception object. Reporting "Uncaught" gives a debugging session
        // nothing to go on, and these snippets run page-side where a typo is
        // otherwise invisible.
        const e = r.exceptionDetails.exception;
        throw new Error(e?.description || e?.value?.message || e?.value
          || r.exceptionDetails.text || 'page-side exception');
      }
      return r.result.value;
    },
    async close() { try { ws.close(); } catch {} proc.kill(); },
  };
}

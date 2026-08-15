import test, { after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';

let srv;
const origCreateServer = http.createServer;
http.createServer = function(...args) {
  srv = origCreateServer.apply(this, args);
  return srv;
};

process.env.PORT = '0';
await import('../dashboard.mjs');

const port = srv.address().port;

after(() => {
  if (srv) {
    srv.close();
    srv.closeAllConnections();
  }
});

async function fetchDash(path) {
  const r = await fetch(`http://localhost:${port}${path}`);
  return r;
}

test('1. /api/workspace returns the four layers', async () => {
  const r = await fetchDash('/api/workspace');
  assert.strictEqual(r.status, 200);
  const body = await r.json();
  const keys = Object.keys(body.layers).sort();
  assert.deepStrictEqual(keys, ['apps', 'memory', 'routines', 'skills']);
});

test('2. page serves both tab buttons', async () => {
  const r = await fetchDash('/');
  const html = await r.text();
  assert.ok(html.includes('data-tab="usage"'), 'Missing usage tab');
  assert.ok(html.includes('data-tab="workspace"'), 'Missing workspace tab');
});

test('3. page mounts both panes', async () => {
  const r = await fetchDash('/');
  const html = await r.text();
  assert.ok(html.includes('id="app"'), 'Missing app pane');
  assert.ok(html.includes('id="ws-app"'), 'Missing ws-app pane');
});

test('4. workspace JS defines its own namespace', async () => {
  const r = await fetchDash('/');
  const html = await r.text();
  assert.ok(html.includes('renderWorkspace'), 'Missing renderWorkspace');
  assert.ok(html.includes('loadWorkspace'), 'Missing loadWorkspace');
});

test('5. usage routes still work', async () => {
  const r = await fetchDash('/api/data');
  assert.strictEqual(r.status, 200);
  const body = await r.json();
  assert.ok(Array.isArray(body.scopes), 'Usage view scopes array missing');
});

test('6. workspace route survives a scanner error', async () => {
  const origURL = globalThis.URL;
  const origNow = Date.now;
  
  globalThis.URL = class extends origURL {
    constructor(href, base) {
      if (href === '.') throw new Error('fake scanner error');
      super(href, base);
    }
  };
  Date.now = () => origNow() + 100000;
  
  try {
    const r = await fetchDash('/api/workspace');
    assert.strictEqual(r.status, 500);
    const body = await r.json();
    assert.ok(body.error, 'Expected error field in response');
    assert.ok(body.error.includes('fake scanner error'), 'Expected fake error message');
  } finally {
    globalThis.URL = origURL;
    Date.now = origNow;
  }
});

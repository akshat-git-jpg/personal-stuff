/*
 * Regression test for helper.js. Not part of any build — run it by hand:
 *
 *   cd apps/upwork-helper
 *   npm install --no-save jsdom@24
 *   node test-helper.mjs
 *
 * jsdom is a transient test-only dependency. Nothing here ships in the
 * extension, and the extension itself still has zero runtime dependencies.
 *
 * It builds DOM shapes matching Upwork's work-history modal, loads helper.js
 * into them, feeds the real GraphQL payload shape through the capture hooks,
 * and asserts the private notice was replaced with the full description.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, 'helper.js'), 'utf8');

const TITLE = 'Faceless Video Creator & Editor (Screen Recording + Voiceover) - Ongoing Project';
const DESC =
  'We are seeking for a versatile Content Creator to handle both the recording and post-production of faceless, step-by-step explainer videos.\n\nCRITICAL NOTE: any "AI" voiceovers rejected. A backslash \\ survives too.';

const PAYLOAD = {
  data: {
    inProgress: {
      node: {
        assignments: [
          {
            node: {
              type: 'Fixed',
              title: TITLE,
              description: DESC,
              openingUid: '2066518726036709949',
              isPrivate: true,
            },
          },
          {
            node: {
              title: 'Short video creator How to solve problem',
              description: 'I want a Pro-freelancer to create short and simple tutorial videos.',
            },
          },
        ],
      },
    },
  },
};

const results = [];
function check(name, pass, extra = '') {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
}

function boot() {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="app"></div></body></html>', {
    runScripts: 'outside-only',
    url: 'https://www.upwork.com/nx/proposals/123',
  });
  dom.window.eval(SOURCE);
  return dom.window;
}

const settle = () => new Promise((r) => setTimeout(r, 500));

// --- capture paths -----------------------------------------------------------

{
  const w = boot();
  check('script arms and exposes __uhelp', typeof w.__uhelp === 'object');
  w.eval(`JSON.parse(${JSON.stringify(JSON.stringify(PAYLOAD))})`);
  check('JSON.parse hook captures both jobs', w.__uhelp.count() === 2, `count=${w.__uhelp.count()}`);
  check('hits() reports the parse path', w.__uhelp.hits().parse > 0, JSON.stringify(w.__uhelp.hits()));
  check(
    'the full description is stored, not a truncation',
    w.__uhelp.find('faceless')[0]?.description === DESC
  );
}

// --- DOM shapes --------------------------------------------------------------

const SHAPES = {
  'title in an h2': `
    <div role="dialog">
      <h2>${TITLE}</h2>
      <div><h3>Job description</h3><p>This job is private</p></div>
    </div>`,
  'title in a div with a title class (no heading tags)': `
    <div role="dialog">
      <div class="air3-modal-title">${TITLE}</div>
      <div><div class="section-label">Job description</div><p>This job is private</p></div>
    </div>`,
  'section label sits closer than the title': `
    <div role="dialog">
      <h1>${TITLE}</h1>
      <section><h4>Client's review</h4><h4>Job description</h4><span>This job is private.</span></section>
    </div>`,
};

for (const [name, html] of Object.entries(SHAPES)) {
  const w = boot();
  w.eval(`JSON.parse(${JSON.stringify(JSON.stringify(PAYLOAD))})`);
  w.document.getElementById('app').innerHTML = html;
  await settle();
  w.__uhelp.retry();
  const revealed = w.document.querySelector('.uhelp-reveal');
  check(`[${name}] description swapped in`, !!revealed);
  check(`[${name}] swapped text is the full description`, revealed?.textContent === DESC);
  check(`[${name}] private notice gone`, !/This job is private/.test(w.document.body.textContent));
}

// --- late-arriving title (modal renders body before heading) ------------------

{
  const w = boot();
  w.eval(`JSON.parse(${JSON.stringify(JSON.stringify(PAYLOAD))})`);
  const app = w.document.getElementById('app');
  app.innerHTML = '<div role="dialog"><p>This job is private</p></div>';
  await settle();
  check('no false swap while the title is missing', !w.document.querySelector('.uhelp-reveal'));
  const dlg = w.document.querySelector('[role="dialog"]');
  dlg.insertAdjacentHTML('afterbegin', `<h2>${TITLE}</h2>`);
  await settle();
  check('swaps once the title appears (retry works)', !!w.document.querySelector('.uhelp-reveal'));
}

// --- data arriving after the DOM ---------------------------------------------

{
  const w = boot();
  w.document.getElementById('app').innerHTML = SHAPES['title in an h2'];
  await settle();
  check('no swap before any payload is captured', !w.document.querySelector('.uhelp-reveal'));
  w.eval(`JSON.parse(${JSON.stringify(JSON.stringify(PAYLOAD))})`);
  await settle();
  check('swaps once the payload lands', !!w.document.querySelector('.uhelp-reveal'));
}

// --- it must never invent a description --------------------------------------

{
  const w = boot();
  w.document.getElementById('app').innerHTML = `
    <div role="dialog">
      <h2>Some Completely Unrelated Contract Title</h2>
      <div><h3>Job description</h3><p>This job is private</p></div>
    </div>`;
  w.eval(`JSON.parse(${JSON.stringify(JSON.stringify(PAYLOAD))})`);
  await settle();
  check('unknown title is left alone', !w.document.querySelector('.uhelp-reveal'));
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);

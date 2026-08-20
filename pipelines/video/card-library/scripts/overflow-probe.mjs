import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

// Ensure MEASURE_OVERFLOW_SRC is loaded from the shared module in visuals-flow.
// pathToFileURL, not a raw resolved path: on Windows a bare "C:\..." path is
// rejected by the ESM loader (ERR_UNSUPPORTED_ESM_URL_SCHEME) — import() needs
// a real file:// URL, same class of bug as the CLI entrypoint fix.
const visualsFlowDir = path.join(process.cwd(), '../visuals-flow');
const sharedModulePath = path.join(visualsFlowDir, 'lib/overflow-measure.mjs');
let MEASURE_OVERFLOW_SRC;
let MEASURE_CLEARANCE_SRC;
try {
  const mod = await import(pathToFileURL(path.resolve(sharedModulePath)).href);
  MEASURE_OVERFLOW_SRC = mod.MEASURE_OVERFLOW_SRC;
  MEASURE_CLEARANCE_SRC = mod.MEASURE_CLEARANCE_SRC;
} catch (e) {
  // If run from a different CWD (e.g., test vs root), try a different path resolution
  const altPath = path.resolve(import.meta.dirname, '../../visuals-flow/lib/overflow-measure.mjs');
  const mod = await import(pathToFileURL(altPath).href);
  MEASURE_OVERFLOW_SRC = mod.MEASURE_OVERFLOW_SRC;
  MEASURE_CLEARANCE_SRC = mod.MEASURE_CLEARANCE_SRC;
}

const FILLER = ['publish', 'workflow', 'captions', 'rendering', 'automation', 'timeline', 'export', 'quality'];

const ROLE_DEFAULTS = {
  heading: 7,
  label: 4,
  body: 12,
  value: 4,
  caption: 12
};

export function fillString(spec, overrideMaxWords = null) {
  const defaultWords = spec.role && ROLE_DEFAULTS[spec.role] ? ROLE_DEFAULTS[spec.role] : 6;
  const words = overrideMaxWords !== null ? overrideMaxWords : (spec.max_words ?? defaultWords);
  let out = [];
  for (let i = 0; i < words; i++) out.push(FILLER[i % FILLER.length]);
  let s = out.join(' ');
  if (spec.max_chars) s = s.slice(0, spec.max_chars);
  if (spec.role === 'value') s = '$' + (12 + (words % 7)) + ' / mo';
  return s;
}

function generateVar(spec, logoToggle, maxItems, fieldOverrides) {
  if (spec.type === 'string') {
    if (spec.role === 'logo_slug') return logoToggle ? 'opusclip' : 'submagic';
    if (spec.role === 'icon_name') return 'brain';
    if (spec.enum) return spec.enum[spec.enum.length - 1];
    return fillString(spec, fieldOverrides?.[spec._field_path]);
  }
  if (spec.type === 'object') {
    let obj = {};
    for (const [k, v] of Object.entries(spec.shape)) {
      v._field_path = spec._field_path ? `${spec._field_path}.${k}` : k;
      obj[k] = generateVar(v, logoToggle, maxItems, fieldOverrides);
    }
    return obj;
  }
  if (spec.type === 'array') {
    let arr = [];
    for (let i = 0; i < maxItems; i++) {
      if (spec.item_shape) {
        let item = {};
        for (const [k, v] of Object.entries(spec.item_shape)) {
           v._field_path = spec._field_path ? `${spec._field_path}[].${k}` : `${k}`;
           item[k] = generateVar(v, i % 2 === 0, maxItems, fieldOverrides);
        }
        arr.push(item);
      } else {
        const fakeSpec = { type: spec.item_type || 'string', role: spec.item_role || 'label', _field_path: spec._field_path ? `${spec._field_path}[]` : '' };
        arr.push(generateVar(fakeSpec, i % 2 === 0, maxItems, fieldOverrides));
      }
    }
    return arr;
  }
}

export function fillToCapacity(card, variant, fieldOverrides = {}) {
  let vars = {};
  let logoToggle = true;
  if (card.variables) {
    for (const [k, spec] of Object.entries(card.variables)) {
      const maxItems = k === 'products' ? 5 : (card.max_beats ?? 5);
      spec._field_path = k;
      vars[k] = generateVar(spec, logoToggle, maxItems, fieldOverrides);
      logoToggle = !logoToggle;
    }
  }
  if (card.beat_shape) {
    let beats = [];
    const count = card.max_beats ?? 5;
    for (let i = 0; i < count; i++) {
      let beat = {};
      for (const [k, spec] of Object.entries(card.beat_shape)) {
        spec._field_path = `beats[].${k}`;
        beat[k] = generateVar(spec, i % 2 === 0, count, fieldOverrides);
      }
      beat.at = 0.5 + (i * 0.5);
      beats.push(beat);
    }
    vars.beats = beats;
  }
  vars.variant = variant;
  return vars;
}

export function probeTimes(card, vars) {
  let times = [];
  if (vars && vars.beats) {
    for (const b of vars.beats) {
      if (typeof b.at === 'number') times.push(b.at);
    }
  }
  const dur = card.default_duration || 5;
  times.push(dur / 2);
  times.push(dur - 1);
  return [...new Set(times)].sort((a, b) => a - b);
}

export function resolveChrome() {
  const out = execSync('npx --yes hyperframes@latest browser path', { encoding: 'utf8' });
  const lines = out.trim().split('\n');
  const exe = lines[lines.length - 1].trim();
  if (!fs.existsSync(exe)) {
    throw new Error(`Chrome not found at ${exe}. Please run: npx hyperframes@latest browser ensure`);
  }
  return exe;
}

let browserCache = null;

// The browser is cached across probes for speed, which means it outlives any single
// call. main() closed it; a test file that imports probeCardVariant directly never
// runs main(), so the handle stayed open and `node --test` hung forever after
// printing all its oks (boss dispatch 3, 2026-07-30). Anything that imports this
// module MUST call closeBrowser() when it is done — the tests do it in an after()
// hook. Idempotent, so calling it twice or with no browser open is safe.
export async function closeBrowser() {
  if (browserCache) {
    const b = browserCache;
    browserCache = null;
    await b.close();
  }
}

export async function probeCardVariant(cardSlug, variant, variables, times) {
  if (!browserCache) {
    const executablePath = resolveChrome();
    browserCache = await puppeteer.launch({
      executablePath,
      defaultViewport: { width: 1920, height: 1080 }
    });
  }
  const browser = browserCache;
  const page = await browser.newPage();
  
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-'));
  const renderDir = path.join(tempDir, path.basename(cardSlug));
  fs.cpSync(path.resolve(cardSlug), renderDir, { recursive: true });
  const indexPath = path.join(renderDir, 'index.html');
  const originalHtml = fs.readFileSync(indexPath, 'utf8');
  
  const newHtml = originalHtml.replace(
    /data-composition-variables='[^']*'/,
    `data-composition-variables='${JSON.stringify(variables).replace(/'/g, "&apos;")}'`
  );
  fs.writeFileSync(indexPath, newHtml);

  try {
    await page.evaluateOnNewDocument((vars) => {
      window.__hyperframes = { getVariables: () => vars };
    }, variables);
    await page.goto(`file://${indexPath}`);
    try {
      await page.waitForFunction('!!window.__timelines && Object.values(window.__timelines).length > 0', { timeout: 4000 });
    } catch (e) {
      console.error(`WARN: ${cardSlug} timed out waiting for timelines (likely crashed on bad variables)`);
      await page.close();
      return { broken: false, offenders: [] };
    }

    for (const t of times) {
      await page.evaluate((time) => {
        const tls = Object.values(window.__timelines || {});
        if (tls.length) {
          const tl = tls[0];
          tl.pause();
          tl.time(Math.min(time, tl.duration()));
        }
      }, t);

      // await requestAnimationFrame equivalent in puppeteer
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
      
      const res = await page.evaluate(MEASURE_OVERFLOW_SRC + '; __measureOverflow()');
      if (res.broken) {
        await page.close();
        return { broken: true, t, offenders: res.offenders };
      }
      /* Text sitting on artwork. Checked at the same sampled times as overflow,
         because a collision is usually transient -- it appears while one element
         is still animating in and is gone a beat later, which is exactly why an
         eye on a contact sheet keeps missing it. */
      const clr = await page.evaluate(MEASURE_CLEARANCE_SRC + '; __measureClearance()');
      if (clr.broken) {
        await page.close();
        return { broken: true, t, offenders: clr.hits, kind: 'clearance' };
      }
    }

    await page.close();
    return { broken: false, offenders: [] };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isDerive = args.includes('--derive');
  const slugs = args.filter(a => !a.startsWith('--'));
  
  const catalogPath = path.resolve('catalog.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  let catalogText = fs.readFileSync(catalogPath, 'utf8');
  
  let targetCards = catalog.cards.filter(c => !c.structural);
  if (slugs.length > 0) {
    targetCards = targetCards.filter(c => slugs.includes(c.slug));
  }
  
  let anyOverflow = false;
  
  for (const card of targetCards) {
    console.log(`TESTING CARD: ${card.slug}`);
    const variants = (card.variants && card.variants.length > 0) ? card.variants : ['a'];
    
    if (isDerive && card.variants && card.variants.length > 0) {
      // Find text fields to derive
      let fieldsToDerive = [];
      if (card.variables) {
        for (const [k, spec] of Object.entries(card.variables)) {
          if (spec.type === 'string' && spec.max_words === undefined) {
             fieldsToDerive.push({ path: k, spec });
          } else if (spec.type === 'object' && spec.shape) {
             for (const [subk, subspec] of Object.entries(spec.shape)) {
               if (subspec.type === 'string' && subspec.max_words === undefined) {
                 fieldsToDerive.push({ path: `${k}.${subk}`, spec: subspec, parentName: k, keyName: subk });
               }
             }
          }
        }
      }
      
      for (const field of fieldsToDerive) {
        let maxWords = field.spec.role && ROLE_DEFAULTS[field.spec.role] ? ROLE_DEFAULTS[field.spec.role] : 6;
        let bestWords = maxWords;
        
        while (bestWords >= 1) {
          let overflowedInAnyVariant = false;
          for (const variant of variants) {
            const vars = fillToCapacity(card, variant, { [field.path]: bestWords });
            const times = probeTimes(card, vars);
            const res = await probeCardVariant(card.slug, variant, vars, times);
            if (res.broken) {
              overflowedInAnyVariant = true;
              break;
            }
          }
          if (!overflowedInAnyVariant) {
            break; // found the max capacity
          }
          bestWords--;
        }
        
        if (bestWords < maxWords && bestWords > 0) {
           console.log(`derived ${card.slug}.${field.path} max_words=${bestWords}`);
           // text surgery
           const regex = new RegExp(`("${field.keyName || field.path}"\\s*:\\s*{[^}]*?"type"\\s*:\\s*"string"([^}]*?))}`, 'g');
           catalogText = catalogText.replace(regex, `$1, "max_words": ${bestWords}}`);
        } else if (bestWords === 0) {
           // Shrinking this field to one word did not clear the overflow, which means
           // this field is NOT the cause. On enacted/pipeline-flow the real culprit is
           // `max_beats` (6 beats cannot fit the vertical chain) while the title was
           // already fine at 3 words — reporting "title capacity below 1 word" there
           // was simply wrong, and would have written a nonsense cap. Report the
           // offending ELEMENTS so a human can see which declared capacity is at
           // fault, and change nothing. (2026-07-30)
           const probe = await probeCardVariant(
             card.slug, variants[0],
             fillToCapacity(card, variants[0], { [field.path]: 1 }),
             probeTimes(card, fillToCapacity(card, variants[0], { [field.path]: 1 })),
           );
           console.log(
             `UNATTRIBUTED ${card.slug}: shrinking ${field.path} to 1 word does not fix the ` +
             `overflow — offenders ${probe.offenders.join(',') || '(none reported)'}. ` +
             `The cause is another declared capacity (often max_beats or max_reveal_chars), ` +
             `not this field. No cap written.`,
           );
        }
      }
      
    } else {
      for (const variant of variants) {
        const vars = fillToCapacity(card, variant);
        const times = probeTimes(card, vars);
        const res = await probeCardVariant(card.slug, variant, vars, times);
        if (res.broken) {
          console.log(`OVERFLOW ${card.slug} ${variant} @${res.t}s ${res.offenders.join(',')}`);
          anyOverflow = true;
        } else {
          console.log(`ok ${card.slug} ${variant}`);
        }
      }
    }
  }
  
  await closeBrowser();

  if (isDerive) {
    fs.writeFileSync(catalogPath, catalogText);
  }
  
  if (anyOverflow && !isDerive) {
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch(async (err) => {
      console.error(err);
      await closeBrowser();
      process.exit(1);
    })
    // A thrown error mid-run leaves the browser open and the process hanging, which
    // looks identical to a passing-but-stuck run. Always tear down.
    .finally(() => closeBrowser());
}

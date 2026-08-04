import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { probeCardVariant, probeTimes, closeBrowser } from './overflow-probe.mjs';

const FILLER = ['publish', 'workflow', 'captions', 'rendering', 'automation', 'timeline', 'export', 'quality'];
function fillString(spec) {
  const words = spec.max_words ?? 6;
  let out = [];
  for (let i = 0; i < words; i++) out.push(FILLER[i % FILLER.length]);
  let s = out.join(' ');
  if (spec.max_chars) s = s.slice(0, spec.max_chars);
  if (spec.role === 'value') s = '$' + (12 + (words % 7)) + ' / mo';
  return s;
}

function generateVar(spec, variant, logoToggle, maxItems) {
  if (spec.type === 'string') {
    if (spec.role === 'logo_slug') return logoToggle ? 'opusclip' : 'submagic';
    if (spec.role === 'icon_name') return 'brain';
    if (spec.enum) return spec.enum[spec.enum.length - 1];
    if (variant === 'min') {
      if (spec.role === 'value') return '$1/m';
      return 'word';
    } else {
      return fillString(spec);
    }
  }
  if (spec.type === 'object') {
    let obj = {};
    for (const [k, v] of Object.entries(spec.shape)) {
      if (!v.required && variant === 'min') continue;
      obj[k] = generateVar(v, variant, logoToggle, maxItems);
    }
    return obj;
  }
  if (spec.type === 'array') {
    let arr = [];
    const count = variant === 'min' ? 2 : maxItems;
    for (let i = 0; i < count; i++) {
      if (spec.item_shape) {
        let item = {};
        for (const [k, v] of Object.entries(spec.item_shape)) {
           if (!v.required && variant === 'min') continue;
           item[k] = generateVar(v, variant, i % 2 === 0, maxItems);
        }
        arr.push(item);
      } else {
        // Fallback for arrays without item_shape (e.g. array of strings)
        arr.push(generateVar({ type: spec.item_type || 'string', role: spec.item_role || 'label' }, variant, i % 2 === 0, maxItems));
      }
    }
    return arr;
  }
}

function generateVariables(card, variant) {
  let vars = {};
  let logoToggle = true; 
  if (card.variables) {
    for (const [k, spec] of Object.entries(card.variables)) {
      if (!spec.required && variant === 'min') continue;
      const maxItems = k === 'products' ? 5 : (card.max_beats ?? 5);
      vars[k] = generateVar(spec, variant, logoToggle, maxItems);
      logoToggle = !logoToggle;
    }
  }
  if (card.beat_shape) {
    let beats = [];
    const count = variant === 'min' ? 2 : (card.max_beats ?? 5);
    for (let i = 0; i < count; i++) {
      let beat = {};
      for (const [k, spec] of Object.entries(card.beat_shape)) {
        if (!spec.required && variant === 'min') continue;
        beat[k] = generateVar(spec, variant, i % 2 === 0, count);
      }
      beat.at = 0.5 + (i * 0.5);
      beats.push(beat);
    }
    vars.beats = beats;
  }
  return vars;
}

const outDir = path.join(os.homedir(), 'kb-scratch', 'card-qa');
fs.mkdirSync(outDir, { recursive: true });

const catalog = JSON.parse(fs.readFileSync('catalog.json', 'utf8'));

const cliArgs = process.argv.slice(2);
const checkMode = cliArgs.includes('--check');
const sideMode = cliArgs.includes('--side');
const targetCardSlug = cliArgs.find(a => !a.startsWith('--'));

const cards = targetCardSlug
  ? catalog.cards.filter(c => c.slug === targetCardSlug)
  : catalog.cards;

// Side mode: the renderer bakes the 1200px side-cue canvas by rewriting only
// data-width on #root (see visuals-flow/lib/render.mjs rewriteCanvas) — it
// never touches CSS. Mirror exactly that single-attribute rewrite here, on a
// throwaway copy of the card, so QA renders what the pipeline will actually
// produce.
const SIDE_WIDTH = 1200;
function rewriteCanvasWidth(html) {
  return html.replace(/data-width="1920"/g, `data-width="${SIDE_WIDTH}"`);
}

const AMBIENT_REQUIRED = [
  'enacted/before-after', 'enacted/counter-tally',
  'enacted/fill-gauge', 'enacted/pipeline-flow',
  'enacted/race-bars', 'enacted/spotlight-focus',
  'enacted/terminal-enact', 'enacted/timeline-scrub',
  'overlay/stat-hit', 'overlay/lower-third', 'overlay/tip-banner',
  'section/bullet-points-highlighted', 'section/tool-intro', 'slate/kinetic-sentence',
  'statement/keyword-statement', 'title/title-aurora-wave', 'checklist/icon-pills'
];

let anyOverflow = false;

for (const card of cards) {
  const minVars = generateVariables(card, 'min');
  const maxVarsTpl = generateVariables(card, 'max');

  const realCardPath = path.join(process.cwd(), card.slug);

  let renderDir = realCardPath;
  let tempDir = null;
  if (sideMode) {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'card-qa-side-'));
    renderDir = path.join(tempDir, path.basename(card.slug));
    fs.cpSync(realCardPath, renderDir, { recursive: true });
    const rewritten = rewriteCanvasWidth(fs.readFileSync(path.join(renderDir, 'index.html'), 'utf8'));
    fs.writeFileSync(path.join(renderDir, 'index.html'), rewritten);
  }

  const indexPath = path.join(renderDir, 'index.html');
  const originalHtml = fs.readFileSync(indexPath, 'utf8');

  if (AMBIENT_REQUIRED.includes(card.slug) && !originalHtml.includes('/* hf-ambient */')) {
    console.error(`FAIL: ${card.slug} missing /* hf-ambient */ marker`);
    process.exit(1);
  }

  const suffix = sideMode ? '-side' : '';
  const slugFile = card.slug.split('/').join('-');

  const runVariant = async (sizeMode, vars, abVariant = null) => {
    let finalVars = vars;
    if (abVariant) {
      finalVars = { ...vars, variant: abVariant };
    }
    const newHtml = originalHtml.replace(
      /data-composition-variables='[^']*'/,
      `data-composition-variables='${JSON.stringify(finalVars).replace(/'/g, "&apos;")}'`
    );
    fs.writeFileSync(indexPath, newHtml);

    let mp4Path, pngPath;
    try {
      mp4Path = `/tmp/${slugFile}${suffix}-${sizeMode}${abVariant ? '-' + abVariant : ''}.mp4`;
      pngPath = `/tmp/${slugFile}${suffix}-${sizeMode}${abVariant ? '-' + abVariant : ''}.png`;
      execSync(`npx --yes hyperframes@0.7.62 render ${renderDir} -o ${mp4Path}`, { stdio: 'ignore' });

      const duration = card.default_duration || 5;
      const ss = duration * 0.8;

      execSync(`ffmpeg -v error -ss ${ss} -i ${mp4Path} -frames:v 1 ${pngPath} -y`, { stdio: 'ignore' });
      
      if (checkMode) {
        const times = probeTimes(card, finalVars);
        const res = await probeCardVariant(card.slug, abVariant || 'a', finalVars, times);
        if (res.broken) {
           console.error(`OVERFLOW ${card.slug} ${sizeMode}${abVariant ? '-' + abVariant : ''} @${res.t}s ${res.offenders.join(',')}`);
           anyOverflow = true;
        }
      }
      return pngPath;
    } finally {
      fs.writeFileSync(indexPath, originalHtml);
    }
  };

  console.log(`Processing ${card.slug}${sideMode ? ' (side)' : ''}...`);
  
  const cardVariants = (card.variants && card.variants.length > 0) ? card.variants : [null];
  
  try {
    for (const v of cardVariants) {
      const minPng = await runVariant('min', minVars, v);
      const maxPng = await runVariant('max', maxVarsTpl, v);
      
      const sheetSuffix = v ? `-${v}` : '';
      const finalSheet = path.join(outDir, `${slugFile}${suffix}${sheetSuffix}.png`);
      
      const minText = v ? `MIN (${v})` : 'MIN';
      const maxText = v ? `MAX (${v})` : 'MAX';
      const filter = `[0:v]drawtext=text='${minText}':fontsize=48:fontcolor=white:box=1:boxcolor=black@0.5:x=10:y=10[v0];[1:v]drawtext=text='${maxText}':fontsize=48:fontcolor=white:box=1:boxcolor=black@0.5:x=10:y=10[v1];[v0][v1]vstack`;
      execSync(`ffmpeg -v error -y -i ${minPng} -i ${maxPng} -filter_complex "${filter}" ${finalSheet}`, { stdio: 'ignore' });
      console.log(`Wrote ${finalSheet}`);
    }
  } catch (e) {
    console.error(`Failed to process sheet for ${card.slug}`, e);
  } finally {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (checkMode) {
  await closeBrowser();
  if (anyOverflow) process.exit(1);
}

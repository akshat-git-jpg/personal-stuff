import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';

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
      let item = {};
      for (const [k, v] of Object.entries(spec.item_shape)) {
         if (!v.required && variant === 'min') continue;
         item[k] = generateVar(v, variant, i % 2 === 0, maxItems);
      }
      arr.push(item);
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

const targetCardSlug = process.argv[2];

const cards = targetCardSlug 
  ? catalog.cards.filter(c => c.slug === targetCardSlug)
  : catalog.cards;

for (const card of cards) {
  const minVars = generateVariables(card, 'min');
  const maxVars = generateVariables(card, 'max');
  
  const cardPath = path.join(process.cwd(), card.slug);
  const indexPath = path.join(cardPath, 'index.html');
  const originalHtml = fs.readFileSync(indexPath, 'utf8');
  
  const runVariant = (variant, vars) => {
    const newHtml = originalHtml.replace(
      /data-composition-variables='[^']*'/, 
      `data-composition-variables='${JSON.stringify(vars).replace(/'/g, "&apos;")}'`
    );
    fs.writeFileSync(indexPath, newHtml);
    
    try {
      const mp4Path = `/tmp/${card.slug.split('/').join('-')}-${variant}.mp4`;
      const pngPath = `/tmp/${card.slug.split('/').join('-')}-${variant}.png`;
      execSync(`npx --yes hyperframes@0.7.62 render ${card.slug} -o ${mp4Path}`, { stdio: 'ignore' });
      
      const duration = card.default_duration || 5;
      const ss = duration * 0.8;
      
      execSync(`ffmpeg -v error -ss ${ss} -i ${mp4Path} -frames:v 1 ${pngPath} -y`, { stdio: 'ignore' });
      return pngPath;
    } finally {
      fs.writeFileSync(indexPath, originalHtml);
    }
  };
  
  console.log(`Processing ${card.slug}...`);
  const minPng = runVariant('min', minVars);
  const maxPng = runVariant('max', maxVars);
  
  const finalSheet = path.join(outDir, `${card.slug.split('/').join('-')}.png`);
  
  try {
    const filter = `[0:v]drawtext=text='MIN':fontsize=48:fontcolor=white:box=1:boxcolor=black@0.5:x=10:y=10[v0];[1:v]drawtext=text='MAX':fontsize=48:fontcolor=white:box=1:boxcolor=black@0.5:x=10:y=10[v1];[v0][v1]vstack`;
    execSync(`ffmpeg -v error -y -i ${minPng} -i ${maxPng} -filter_complex "${filter}" ${finalSheet}`, { stdio: 'ignore' });
    console.log(`Wrote ${finalSheet}`);
  } catch (e) {
    console.error(`Failed to stitch sheet for ${card.slug}`, e);
  }
}

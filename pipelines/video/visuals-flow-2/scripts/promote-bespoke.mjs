import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from '../lib/workdir.mjs';

function main() {
  const [,, slugOrPath, bespokeDirname, targetCard] = process.argv;
  if (!slugOrPath || !bespokeDirname || !targetCard) {
    console.error('usage: node scripts/promote-bespoke.mjs <slug-or-path> <bespoke-dirname> <family/card-name>');
    process.exit(1);
  }
  const workdir = resolveWorkdir(slugOrPath);
  const src = path.join(workdir, 'bespoke', bespokeDirname);
  if (!fs.existsSync(src)) {
    console.error(`Error: bespoke source not found: ${src}`);
    process.exit(1);
  }
  
  const cardLibraryRoot = process.env.CARD_LIBRARY_ROOT || path.resolve(import.meta.dirname, '..', '..', 'card-library');
  const target = path.join(cardLibraryRoot, targetCard);
  
  if (fs.existsSync(target)) {
    console.error(`Error: target already exists: ${target}`);
    process.exit(1);
  }
  
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(src, target, { recursive: true });
  
  const html = fs.existsSync(path.join(target, 'index.html')) ? fs.readFileSync(path.join(target, 'index.html'), 'utf8') : '';
  const kind = html.includes('beats') ? 'beat' : 'single';
  
  const stub = {
    slug: targetCard,
    kind,
    placement: "fullframe",
    purpose: "",
    intent: "",
    anti_intent: "",
    variables: {}
  };
  
  console.log(JSON.stringify(stub, null, 2));
  console.log('Next steps:');
  console.log('1. Add the entry to catalog.json');
  console.log('2. Run `npm run check` in card-library');
  console.log('3. Commit and push in card-library');
}
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

#!/usr/bin/env node
import {
  load, save, mint, addAlias, list, resolveKey,
  ensure, whereIs, unregisteredDirs, REGISTRY_PATH,
} from '../lib/registry.mjs';

const [cmd, ...rest] = process.argv.slice(2);

function flag(name) {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? undefined : rest[i + 1];
}
const positional = rest.filter((a, i) => !a.startsWith('--') && !(rest[i - 1] || '').startsWith('--'));

function usage() {
  console.log('usage: vreg ensure <name> [--title "..."]   get the key, minting only if new');
  console.log('       vreg resolve <name>                  canonical key, exit 1 if unknown');
  console.log('       vreg where <name>                    which pipelines have a folder for it');
  console.log('       vreg list                            every registered video');
  console.log('       vreg check                           fail on any videos/ dir not registered');
  console.log('       vreg mint <key> [--title "..."]      register a new key (fails if taken)');
  console.log('       vreg alias <key> <other-name>        point another name at an existing key');
}

try {
  if (cmd === 'list') {
    for (const v of list()) {
      const al = v.aliases?.length ? `  (aka ${v.aliases.join(', ')})` : '';
      console.log(`${v.key}  ${v.minted}  ${v.title || '-'}${al}`);
    }
  } else if (cmd === 'resolve') {
    const key = resolveKey(positional[0]);
    if (!key) { console.error(`not registered: ${positional[0]}`); process.exit(1); }
    console.log(key);
  } else if (cmd === 'ensure') {
    // The symmetric verb both pipelines call. Prints ONLY the canonical key on
    // stdout so a caller can use `$(vreg ensure ...)` directly; the human-facing
    // note goes to stderr.
    if (!positional[0]) { console.error('ensure needs a name'); process.exit(1); }
    const { key, minted, reg } = ensure(positional[0], { title: flag('title') ?? '' });
    if (minted) save(reg);
    console.error(minted ? `minted new key: ${key}` : `already registered: ${key}`);
    console.log(key);
  } else if (cmd === 'where') {
    const key = resolveKey(positional[0]);
    if (!key) { console.error(`not registered: ${positional[0]}`); process.exit(1); }
    console.log(key);
    for (const [pipeline, info] of Object.entries(whereIs(key))) {
      const aka = info.exists && info.name !== key ? `  (folder named "${info.name}")` : '';
      console.log(`  ${info.exists ? '[x]' : '[ ]'} ${pipeline.padEnd(8)} ${info.path}${aka}`);
    }
  } else if (cmd === 'check') {
    const stray = unregisteredDirs();
    for (const p of stray) console.error(`unregistered: ${p}`);
    if (stray.length) {
      console.error(`${stray.length} video dir(s) not in the registry — run: vreg ensure <name>`);
      process.exit(1);
    }
    console.log('every video dir is registered');
  } else if (cmd === 'mint') {
    const reg = mint(positional[0], { title: flag('title') ?? '' });
    save(reg);
    console.log(`minted ${positional[0]} -> ${REGISTRY_PATH}`);
  } else if (cmd === 'alias') {
    save(addAlias(positional[0], positional[1]));
    console.log(`${positional[1]} -> ${positional[0]}`);
  } else {
    usage();
    process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error(String(e.message || e));
  process.exit(1);
}

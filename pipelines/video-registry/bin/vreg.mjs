#!/usr/bin/env node
import {
  load, save, mint, addAlias, list, resolveKey,
  ensure, whereIs, unregisteredDirs, REGISTRY_PATH,
} from '../lib/registry.mjs';
import { defaultChannel, getChannel } from '../../../config/channels.mjs';
import { fetchCards, planSync } from '../lib/tracker.mjs';
import {
  planClicksDb, planDesk, diffInvariants, partitionCollisions,
  queryD1, readInvariants, INVARIANT_QUERIES,
  CLICKS_DB_ID, DESK_DB_ID,
} from '../lib/migrate-keys.mjs';
import { TRACKER_DB_ID } from '../lib/tracker.mjs';

const [cmd, ...rest] = process.argv.slice(2);

function flag(name) {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? undefined : rest[i + 1];
}
const positional = rest.filter((a, i) => !a.startsWith('--') && !(rest[i - 1] || '').startsWith('--'));

function usage() {
  console.log('usage: vreg ensure <name> [--title "..."] [--channel <id>]   get the key, minting only if new');
  console.log('       vreg resolve <name>                  canonical key, exit 1 if unknown');
  console.log('       vreg where <name>                    which pipelines have a folder for it');
  console.log('       vreg list                            every registered video');
  console.log('       vreg check                           fail on any videos/ dir not registered');
  console.log('       vreg mint <key> [--title "..."]      register a new key (fails if taken)');
  console.log('       vreg alias <key> <other-name>        point another name at an existing key');
  console.log('       vreg sync [--dry-run]                seed registry from the tracker');
  console.log('       vreg migrate-keys [--dry-run|--apply] make the registry key canonical in D1');
}

try {
  if (cmd === 'list') {
    for (const v of list()) {
      const al = v.aliases?.length ? `  (aka ${v.aliases.join(', ')})` : '';
      console.log(`${v.key}  ${v.minted}  ${v.channel}  ${v.title || '-'}${al}`);
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
    const channelFlag = flag('channel');
    // Validate BEFORE minting — an unknown id must never produce an entry that
    // points nowhere. getChannel throws CHANNEL_UNKNOWN, caught by the outer
    // try/catch below, which prints it and exits non-zero.
    if (channelFlag) getChannel(channelFlag);
    const { key, minted, reg } = ensure(positional[0], { title: flag('title') ?? '', channel: channelFlag });
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
  } else if (cmd === 'sync') {
    if (rest.includes('--help') || positional.includes('help')) {
      usage();
      process.exit(0);
    }
    const isDry = rest.includes('--dry-run');
    const rows = await fetchCards();
    const reg = load();
    const today = new Date().toISOString().slice(0, 10);
    const plan = planSync(rows, reg, today);
    if (isDry) {
      console.log(plan);
      process.exit(0);
    }
    for (const s of plan.skipped) {
      console.error(`skipped ${s.key} (${s.reason} with id ${s.id})`);
    }
    for (const m of plan.mints) {
      reg.videos[m.key] = {
        title: m.title, minted: m.minted, aliases: [], card_id: m.card_id, channel: defaultChannel().id,
      };
      console.error(`minted ${m.key}`);
    }
    for (const s of plan.stamps) {
      reg.videos[s.key].card_id = s.card_id;
      console.error(`stamped ${s.key} with card_id ${s.card_id}`);
    }
    if (plan.mints.length > 0 || plan.stamps.length > 0) save(reg);
  } else if (cmd === 'migrate-keys') {
    if (rest.includes('--help') || positional.includes('help')) {
      usage();
      process.exit(0);
    }
    // Dry run is the DEFAULT. --apply is the only thing that writes, and boss
    // runs it post-merge as this plan's deploy step, never a crew.
    const isApply = rest.includes('--apply');

    // clicks-db pairs: the tracker card holds both halves of the mapping.
    // `slug` is a real column (migration 0003), but `video_code` is NOT — the
    // tracker keeps it inside the card's extra_json blob (datastore.ts writes
    // any non-core cell there), so it has to be json_extract-ed out.
    const cardRows = await queryD1(
      TRACKER_DB_ID,
      "SELECT json_extract(extra_json, '$.video_code') AS video_code, slug FROM cards " +
      "WHERE slug IS NOT NULL AND json_extract(extra_json, '$.video_code') IS NOT NULL",
    );
    const clicksPairs = cardRows
      .map((r) => ({ oldCode: String(r.video_code || '').trim(), newKey: String(r.slug || '').trim() }))
      .filter((p) => p.oldCode && p.newKey);

    // desk pairs: every desk row's key mapped through the registry (aliases too).
    const deskRows = await queryD1(DESK_DB_ID, 'SELECT key FROM videos');
    const reg = load();
    const deskPairs = [];
    for (const r of deskRows) {
      const oldKey = String(r.key || '').trim();
      if (!oldKey) continue;
      const canonical = resolveKey(oldKey, reg);
      if (!canonical) {
        console.error(`skipped desk key "${oldKey}" (not registered)`);
        continue;
      }
      deskPairs.push({ oldKey, newKey: canonical });
    }

    // Two old codes claiming one new key means two rows claim one video.
    // Merging them would merge click history or drop a desk row, and neither is
    // recoverable. A blocked pair is NEVER planned, in either mode; --apply
    // additionally refuses outright, because boss runs it with nobody watching.
    const clicks = partitionCollisions(clicksPairs);
    const desk = partitionCollisions(deskPairs);
    const collisions = [...clicks.collisions, ...desk.collisions];
    for (const c of collisions) {
      console.error(`E-COLLISION: "${c.newKey}" is claimed by ${c.olds.join(', ')}`);
    }
    if (collisions.length) {
      console.error('two rows claim one video — the owner must resolve the duplicate by hand.');
      console.error('these keys are excluded from the plan below; nothing is ever merged.');
      if (isApply) {
        console.error('refusing to apply while a collision is unresolved');
        process.exit(1);
      }
    }

    const clicksStmts = planClicksDb(clicks.safe);
    const deskStmts = planDesk(desk.safe);

    const show = (title, stmts) => {
      console.log(`\n== ${title} (${stmts.length} statement${stmts.length === 1 ? '' : 's'}) ==`);
      stmts.forEach((st, i) => {
        console.log(`${String(i + 1).padStart(3)}. ${st.sql}`);
        console.log(`     params: ${JSON.stringify(st.params)}`);
        console.log(`     why:    ${st.why}`);
      });
    };

    if (!isApply) {
      show('clicks-db', clicksStmts);
      show('yt-script-desk', deskStmts);
      console.log('\n== invariant counts that --apply checks before and after ==');
      for (const q of INVARIANT_QUERIES) console.log(`  ${q.label}: ${q.sql}`);
      console.log('\ndry run — nothing was written. Use --apply to run it.');
      process.exit(0);
    }

    show('clicks-db', clicksStmts);
    show('yt-script-desk', deskStmts);

    const before = await readInvariants();
    console.log('\n== invariants BEFORE ==');
    for (const [k, v] of Object.entries(before)) console.log(`  ${k}: ${v}`);

    for (const st of clicksStmts) await queryD1(CLICKS_DB_ID, st.sql, st.params);
    for (const st of deskStmts) await queryD1(DESK_DB_ID, st.sql, st.params);

    const after = await readInvariants();
    console.log('\n== invariants AFTER ==');
    for (const [k, v] of Object.entries(after)) console.log(`  ${k}: ${v}`);

    // The only thing standing between a bad mapping and the click history.
    // boss runs --apply unattended, so drift REFUSES rather than logging on.
    const violations = diffInvariants(before, after);
    if (violations.length) {
      for (const v of violations) {
        console.error(`E-INVARIANT: ${v.label} was ${v.before}, is now ${v.after}`);
      }
      console.error('invariant drift — investigate before touching this database again');
      process.exit(1);
    }
    console.log('\nevery invariant held');
  } else {
    usage();
    process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error(String(e.message || e));
  process.exit(1);
}

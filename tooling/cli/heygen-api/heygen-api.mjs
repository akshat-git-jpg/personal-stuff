#!/usr/bin/env node
// heygen-api — drive HeyGen's OFFICIAL public API (api.heygen.com) with an API key.
//
// ⚠️ METERED. Every `generate`/`render` bills credits against the API plan.
// The free path is tooling/cli/heygen-web (web session, Avatar III unlimited)
// and it stays the default for the pipelines. Use this when no session capture
// exists on the machine, or when you want the low-ban-risk official route.
//
// AUTH: HEYGEN_API_KEY env var, or infra/secrets/heygen-api.env (gitignored)
//       containing a single line:  HEYGEN_API_KEY=hg_...
//
// Commands:
//   heygen-api auth-check
//   heygen-api list-templates [--json]
//   heygen-api get-template <template_id>          # dump the template's variable slots
//   heygen-api upload <file>                       # -> asset_id
//   heygen-api generate --template <id> --audio <file> [--audio-var <name>] [--title T]
//   heygen-api status <video_id>
//   heygen-api download <video_id> <dest.mp4>
//   heygen-api render --template <id> --audio <file> --out <dest.mp4> [--audio-var <name>] [--title T]
//                                                  # upload -> generate -> poll -> download

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  loadKey, die, listTemplates, getTemplate, uploadAsset, audioVariable,
  generateFromTemplate, videoStatus, downloadTo,
} from './src/client.mjs';

const HELP = `heygen-api — official HeyGen API (METERED; the free path is heygen-web)

  auth-check
  list-templates [--json]
  get-template <template_id>
  upload <file>
  generate --template <id> --audio <file> [--audio-var <name>] [--title T]
  status <video_id>
  download <video_id> <dest.mp4>
  render --template <id> --audio <file> --out <dest.mp4> [--audio-var <name>] [--title T] [--poll-secs N]

auth: HEYGEN_API_KEY env, or infra/secrets/heygen-api.env`;

export function arg(args, flag, fallback = null) {
  const i = args.indexOf(flag);
  return i === -1 ? fallback : args[i + 1];
}

// A template can expose several slots; we only ever swap audio. If the caller
// does not name one, insist there is exactly one audio slot rather than
// guessing — picking the wrong slot burns credits on a silent-avatar render.
export function pickAudioVar(variables, wanted) {
  const audio = Object.entries(variables ?? {}).filter(([, v]) => v?.type === 'audio').map(([k]) => k);
  if (wanted) {
    if (!audio.includes(wanted)) {
      die(`--audio-var "${wanted}" is not an audio slot on this template. Audio slots: ${audio.join(', ') || '(none)'}`);
    }
    return wanted;
  }
  if (audio.length === 1) return audio[0];
  if (audio.length === 0) {
    die('this template exposes no audio variable — it cannot be driven by a pre-recorded voiceover.\n'
      + 'Run `get-template <id>` to see what slots it does expose.');
  }
  die(`template has ${audio.length} audio slots (${audio.join(', ')}) — pass --audio-var <name> to choose`);
}

const TERMINAL = new Set(['completed', 'failed', 'error']);

export async function pollUntilDone(key, videoId, { pollSecs = 15, maxMins = 30, log = console.error } = {}) {
  const deadline = Date.now() + maxMins * 60_000;
  for (;;) {
    const s = await videoStatus(key, videoId);
    if (TERMINAL.has(s.status)) return s;
    if (Date.now() > deadline) die(`${videoId} still "${s.status}" after ${maxMins}m — giving up (it may still finish; re-check with \`status\`)`);
    log(`  ${videoId}: ${s.status} …`);
    await new Promise((r) => setTimeout(r, pollSecs * 1000));
  }
}

async function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === 'help' || cmd === '--help') { console.log(HELP); return; }

  const key = loadKey();

  switch (cmd) {
    case 'auth-check': {
      const out = await listTemplates(key);
      const n = (out?.data?.templates ?? out?.data ?? []).length;
      console.log(`ok — key authenticates; ${n} template(s) visible`);
      return;
    }

    case 'list-templates': {
      const out = await listTemplates(key);
      const rows = out?.data?.templates ?? out?.data ?? [];
      if (rest.includes('--json')) { console.log(JSON.stringify(rows, null, 2)); return; }
      if (!rows.length) { console.log('(no templates visible to this API key)'); return; }
      for (const t of rows) console.log(`${t.template_id ?? t.id}  ${t.name ?? ''}`);
      return;
    }

    case 'get-template': {
      const id = rest[0];
      if (!id) die('usage: get-template <template_id>');
      const out = await getTemplate(key, id);
      console.log(JSON.stringify(out?.data ?? out, null, 2));
      return;
    }

    case 'upload': {
      const file = rest[0];
      if (!file) die('usage: upload <file>');
      const a = await uploadAsset(key, file);
      console.log(JSON.stringify(a, null, 2));
      return;
    }

    case 'generate': {
      const tpl = arg(rest, '--template');
      const audio = arg(rest, '--audio');
      if (!tpl || !audio) die('usage: generate --template <id> --audio <file> [--audio-var <name>] [--title T]');
      const tplData = (await getTemplate(key, tpl))?.data ?? {};
      const slot = pickAudioVar(tplData.variables, arg(rest, '--audio-var'));
      const asset = await uploadAsset(key, audio);
      console.error(`⚠️ METERED — this render bills credits (asset ${asset.asset_id}, slot "${slot}")`);
      const r = await generateFromTemplate(key, tpl, {
        variables: { [slot]: audioVariable(asset.asset_id) },
        title: arg(rest, '--title') ?? path.basename(audio, path.extname(audio)),
      });
      console.log(JSON.stringify(r, null, 2));
      return;
    }

    case 'status': {
      const id = rest[0];
      if (!id) die('usage: status <video_id>');
      console.log(JSON.stringify(await videoStatus(key, id), null, 2));
      return;
    }

    case 'download': {
      const [id, dest] = rest;
      if (!id || !dest) die('usage: download <video_id> <dest.mp4>');
      const s = await videoStatus(key, id);
      if (s.status !== 'completed') die(`${id} is "${s.status}", not completed — nothing to download`);
      const bytes = await downloadTo(s.video_url, dest);
      console.log(`${dest}  ${(bytes / 1048576).toFixed(1)} MB`);
      return;
    }

    case 'render': {
      const tpl = arg(rest, '--template');
      const audio = arg(rest, '--audio');
      const out = arg(rest, '--out');
      if (!tpl || !audio || !out) die('usage: render --template <id> --audio <file> --out <dest.mp4>');
      const tplData = (await getTemplate(key, tpl))?.data ?? {};
      const slot = pickAudioVar(tplData.variables, arg(rest, '--audio-var'));
      const asset = await uploadAsset(key, audio);
      console.error(`⚠️ METERED — billing credits. template ${tpl}, slot "${slot}"`);
      const { video_id } = await generateFromTemplate(key, tpl, {
        variables: { [slot]: audioVariable(asset.asset_id) },
        title: arg(rest, '--title') ?? path.basename(out, path.extname(out)),
      });
      console.error(`submitted ${video_id} — polling`);
      const s = await pollUntilDone(key, video_id, { pollSecs: Number(arg(rest, '--poll-secs', 15)) });
      if (s.status !== 'completed') die(`${video_id} finished as "${s.status}": ${JSON.stringify(s.error)}`);
      const bytes = await downloadTo(s.video_url, out);
      console.log(JSON.stringify({ video_id, out, mb: +(bytes / 1048576).toFixed(1), duration: s.duration }, null, 2));
      return;
    }

    default:
      die(`unknown command "${cmd}"\n\n${HELP}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((e) => die(e?.stack ?? String(e)));
}

export { main };

// Plain-text transcript for LLM passes: transcript.json is [{text,start,end}]
// but the cue/shot prompts consume word text + order only (~8k tokens vs ~69k
// raw on a 32-min VO) — resolve.mjs re-derives timing from anchors afterward.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveWorkdir } from './workdir.mjs';

export function transcriptText(words) {
  return words.map((w) => w.text).join(' ');
}

// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is a backslash
// path, so naive string concatenation never matches import.meta.url.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const workdirArg = args[0];
  if (!workdirArg) {
    console.error('usage: node lib/transcript-text.mjs <slug-or-path> [--out <file>]');
    process.exit(1);
  }
  const outFlag = args.indexOf('--out');
  if (outFlag !== -1 && !args[outFlag + 1]) {
    console.error('--out needs a file path');
    process.exit(1);
  }
  const words = JSON.parse(fs.readFileSync(path.join(resolveWorkdir(workdirArg), 'transcript.json'), 'utf8'));
  const text = transcriptText(words);
  if (outFlag !== -1) fs.writeFileSync(path.resolve(args[outFlag + 1]), text + '\n');
  else process.stdout.write(text + '\n');
}

// Plain-text transcript for LLM passes: transcript.json is [{text,start,end}]
// but the cue/shot prompts consume word text + order only (~8k tokens vs ~69k
// raw on a 32-min VO) — resolve.mjs re-derives timing from anchors afterward.
import fs from 'node:fs';
import path from 'node:path';

function resolveWorkdir(arg) {
  if (arg.includes('/') || fs.existsSync(arg)) return path.resolve(arg);
  const pipelineRoot = path.resolve(import.meta.dirname, '..');
  return path.join(pipelineRoot, 'videos', arg);
}

export function transcriptText(words) {
  return words.map((w) => w.text).join(' ');
}

if (import.meta.url === `file://${process.argv[1]}`) {
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

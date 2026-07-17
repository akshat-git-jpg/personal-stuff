import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const DURATION_TOLERANCE = 0.15;

export function mmss(seconds) {
  const s = Math.max(0, seconds);
  const mm = Math.floor(s / 60);
  const ss = s - mm * 60;
  return `${String(mm).padStart(2, '0')}:${ss.toFixed(1).padStart(4, '0')}`;
}

function mmssDigits(seconds) {
  const s = Math.floor(Math.max(0, seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}${String(ss).padStart(2, '0')}`;
}

export function rewriteDuration(html, seconds) {
  const re = /data-duration="([0-9.]+)"/g;
  const values = new Set();
  let m;
  while ((m = re.exec(html))) values.add(m[1]);
  if (values.size === 0) {
    return { html, error: 'no data-duration attribute found' };
  }
  if (values.size > 1) {
    return { html, error: `mixed data-duration values: ${[...values].sort().join(', ')}` };
  }
  const newHtml = html.replace(/data-duration="[0-9.]+"/g, `data-duration="${seconds}"`);
  return { html: newHtml, error: null };
}

export function planRender(cue, quality = 'standard') {
  const format = cue.placement === 'overlay' ? 'mov' : 'mp4';
  const cardBase = path.basename(cue.card);
  const outFile = `${mmssDigits(cue.start)}-${cue.id}-${cardBase}.${format}`;
  const args = [
    'render', cue.card,
    '--variables-file', 'vars.json',
    '--fps', '30',
    '--format', format,
    '--quality', quality,
    '--quiet',
  ];
  return { args, outFile, format };
}

export function manifestMd(video, cues) {
  const sorted = [...cues].sort((a, b) => a.start - b.start);
  const rows = sorted.map((cue) => {
    const { outFile } = planRender(cue);
    return `| ${mmss(cue.start)} | ${outFile} | ${cue.duration}s | ${cue.placement} | ${cue.card} |`;
  });
  return [
    `# ${video} — graphics manifest`,
    '',
    '| place at | file | duration | placement | card |',
    '|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

function parseArgs(argv) {
  const opts = { workdir: null, only: null, quality: 'standard' };
  const rest = [...argv];
  opts.workdir = rest.shift();
  while (rest.length) {
    const a = rest.shift();
    if (a === '--only') opts.only = rest.shift();
    else if (a === '--quality') opts.quality = rest.shift();
    else throw new Error(`unknown argument: ${a}`);
  }
  return opts;
}

function resolveWorkdir(arg) {
  if (arg.includes('/') || fs.existsSync(arg)) return path.resolve(arg);
  const pipelineRoot = path.resolve(import.meta.dirname, '..');
  return path.join(pipelineRoot, 'videos', arg);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.workdir) {
    console.error('usage: node lib/render.mjs <slug-or-path> [--only <cueId>] [--quality draft|standard]');
    process.exit(1);
  }

  const cardLibraryRoot = path.resolve(import.meta.dirname, '..', '..', 'card-library');
  const workdir = resolveWorkdir(opts.workdir);
  const resolvedPath = path.join(workdir, 'resolved.json');
  const renderDir = path.join(workdir, 'renders');
  fs.mkdirSync(renderDir, { recursive: true });

  const { video, resolved } = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const cues = opts.only ? resolved.filter((c) => c.id === opts.only) : resolved;

  const errors = [];
  const rendered = [];

  for (const cue of cues) {
    const stagedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hf-render-'));
    try {
      fs.cpSync(path.join(cardLibraryRoot, 'hyperframes.json'), path.join(stagedDir, 'hyperframes.json'));
      fs.cpSync(path.join(cardLibraryRoot, 'meta.json'), path.join(stagedDir, 'meta.json'));
      const stagedCardDir = path.join(stagedDir, cue.card);
      fs.mkdirSync(path.dirname(stagedCardDir), { recursive: true });
      fs.cpSync(path.join(cardLibraryRoot, cue.card), stagedCardDir, { recursive: true });

      const indexPath = path.join(stagedCardDir, 'index.html');
      const html = fs.readFileSync(indexPath, 'utf8');
      const { html: newHtml, error: rewriteError } = rewriteDuration(html, cue.duration);
      if (rewriteError) {
        errors.push(`${cue.id}: data-duration rewrite failed: ${rewriteError}`);
        continue;
      }
      fs.writeFileSync(indexPath, newHtml);

      fs.writeFileSync(path.join(stagedDir, 'vars.json'), JSON.stringify(cue.variables));

      const { args, outFile } = planRender(cue, opts.quality);
      const outPath = path.join(renderDir, outFile);
      const spawnArgs = ['hyperframes@latest', ...args, '-o', outPath];
      const result = spawnSync('npx', spawnArgs, { cwd: stagedDir, encoding: 'utf8' });
      if (result.status !== 0) {
        console.error(result.stdout ?? '');
        console.error(result.stderr ?? '');
        errors.push(`${cue.id}: render failed (exit ${result.status})`);
        continue;
      }

      const probe = spawnSync(
        'ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', outPath],
        { encoding: 'utf8' },
      );
      const actualDuration = parseFloat(probe.stdout);
      if (!Number.isFinite(actualDuration) || Math.abs(actualDuration - cue.duration) > DURATION_TOLERANCE) {
        errors.push(`${cue.id}: rendered duration ${actualDuration} != expected ${cue.duration}`);
        continue;
      }

      rendered.push(cue);
    } finally {
      fs.rmSync(stagedDir, { recursive: true, force: true });
    }
  }

  fs.writeFileSync(path.join(workdir, 'manifest.md'), manifestMd(video, rendered));

  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

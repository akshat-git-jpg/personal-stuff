import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import { parseArgs } from 'node:util';
import { durationOf, heightOf } from './ffmeta.mjs';

export function checkSection({ id, demo, audioDur, clip }) {
  if (!demo) {
    return { verdict: 'skip', issues: [] };
  }

  const issues = [];
  
  if (clip === 'duplicate') {
    return { verdict: 'fail', issues: ['duplicate clip extensions found'] };
  }

  if (!clip) {
    return { verdict: 'fail', issues: ['missing clip file'] };
  }

  if (clip.videoDur < audioDur) {
    issues.push(`video duration (${clip.videoDur.toFixed(2)}s) < audio duration (${audioDur.toFixed(2)}s)`);
  }
  if (clip.videoDur > audioDur + 20) {
    issues.push(`video duration (${clip.videoDur.toFixed(2)}s) > audio duration + 20s (${(audioDur + 20).toFixed(2)}s)`);
  }
  if (clip.height < 1080) {
    issues.push(`video height (${clip.height}) < 1080`);
  }

  if (issues.length > 0) {
    return { verdict: 'fail', issues };
  }

  return { verdict: 'pass', issues: [] };
}

export function buildReport(slug, rows, dateStr) {
  let failCount = 0;
  
  let md = `# Intake QC — ${slug} — ${dateStr}\n\n`;
  md += '| section | clip | video s | audio s | height | verdict | issues |\n';
  md += '|---|---|---|---|---|---|---|\n';
  
  for (const r of rows) {
    if (r.verdict === 'fail') failCount++;
    const clipName = r.clipPath ? path.basename(r.clipPath) : '-';
    const vDur = r.videoDur !== undefined ? r.videoDur.toFixed(2) : '-';
    const aDur = r.audioDur !== undefined ? r.audioDur.toFixed(2) : '-';
    const h = r.height !== undefined ? r.height : '-';
    const issues = r.issues.join(', ') || '-';
    md += `| ${r.id} | ${clipName} | ${vDur} | ${aDur} | ${h} | ${r.verdict} | ${issues} |\n`;
  }
  
  md += `\nRESULT: ${failCount === 0 ? 'PASS' : `FAIL (${failCount} sections)`}\n`;
  return md;
}

const isMain = typeof process !== 'undefined' && import.meta.url.startsWith('file:') && url.fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      root: { type: 'string', short: 'd' }
    },
    allowPositionals: true
  });
  
  if (positionals.length === 0) {
    console.error("Usage: node lib/intake-qc.mjs <slug> [--root d]");
    process.exit(1);
  }

  const slug = positionals[0];
  const root = values.root || '.';
  const scriptPath = path.join(root, 'videos', slug, 'script.json');
  const script = JSON.parse(await fs.readFile(scriptPath, 'utf8'));

  const recDir = path.join(root, 'videos', slug, 'recordings');
  const audioDir = path.join(root, 'videos', slug, 'audio');
  
  let recFiles = [];
  try {
    recFiles = await fs.readdir(recDir);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const rows = [];
  let scriptModified = false;

  for (const section of script.sections) {
    if (!section.demo) {
      rows.push({
        id: section.id, verdict: 'skip', issues: [],
      });
      continue;
    }

    let audioDur = 0;
    try {
      audioDur = await durationOf(path.join(audioDir, `${section.id}.wav`));
    } catch (err) {
      console.warn(`Could not probe audio for ${section.id}: ${err.message}`);
    }

    const matches = recFiles.filter(f => f.match(new RegExp(`^${section.id}\\.(mp4|mov)$`)));
    
    let clipObj = null;
    let clipPath = null;
    let videoDur = undefined;
    let height = undefined;

    if (matches.length > 1) {
      clipObj = 'duplicate';
    } else if (matches.length === 1) {
      clipPath = path.join(recDir, matches[0]);
      videoDur = await durationOf(clipPath);
      height = await heightOf(clipPath);
      clipObj = { path: clipPath, videoDur, height };
    }

    const { verdict, issues } = checkSection({
      id: section.id,
      demo: section.demo,
      audioDur,
      clip: clipObj
    });

    rows.push({
      id: section.id,
      clipPath: clipPath,
      videoDur,
      audioDur,
      height,
      verdict,
      issues
    });

    const newStatus = verdict === 'pass' ? 'received' : 're-record';
    if (section.recording.status !== newStatus) {
      section.recording.status = newStatus;
      scriptModified = true;
    }
  }

  const reportMd = buildReport(slug, rows, new Date().toISOString().split('T')[0]);
  await fs.writeFile(path.join(root, 'videos', slug, 'intake-report.md'), reportMd);

  if (scriptModified) {
    await fs.writeFile(scriptPath, JSON.stringify(script, null, 2) + '\n');
  }

  const failCount = rows.filter(r => r.verdict === 'fail').length;
  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

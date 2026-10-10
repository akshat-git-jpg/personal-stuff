// 520 add-on, REPORT-ONLY: dead beats and a phone sheet on the assembled cut, via the kit.
// It warns and never fails the run: exit code is always 0.
//   node lib/qc-motion.mjs <video.mp4> <qc dir> [--dead-max 4]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { deadBeats, phoneSheet } from './kit/index.mjs';

export function motionReportMd(video, dead, phone) {
  const lines = [`# Motion QC (report-only): ${path.basename(video)}`, '',
    `Dead beats: stretches of ${dead.maxStill}s or more with no visible change (median change ${dead.median}, still below ${dead.threshold}).`, ''];
  if (dead.runs.length) for (const r of dead.runs) lines.push(`- WARN ${r.from.toFixed(2)}-${r.to.toFixed(2)}s: ${r.seconds}s with nothing new on screen`);
  else lines.push('- none');
  lines.push('', `Phone sheet (1 frame a second at 360px wide): \`${phone}\``, '');
  return lines.join('\n');
}

export function qcMotion(video, qcDir, { deadMax = 4 } = {}) {
  const dead = deadBeats(video, { maxStill: deadMax });
  const phone = phoneSheet(video, path.join(qcDir, 'phone.jpg')).out;
  fs.writeFileSync(path.join(qcDir, 'motion.md'), motionReportMd(video, dead, phone));
  return { dead, phone };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [video, qcDir, flag, value] = process.argv.slice(2);
  try {
    if (!video || !qcDir) throw new Error('usage: node lib/qc-motion.mjs <video.mp4> <qc dir> [--dead-max 4]');
    const { dead, phone } = qcMotion(video, qcDir, { deadMax: flag === '--dead-max' ? Number(value) : 4 });
    for (const r of dead.runs) console.log(`motion qc WARN: dead beat ${r.from.toFixed(2)}-${r.to.toFixed(2)}s (${r.seconds}s)`);
    console.log(`motion qc (report-only): ${dead.runs.length} dead beat(s), phone sheet ${phone}`);
  } catch (e) {
    console.log(`motion qc skipped (report-only): ${e.message}`);
  }
  process.exitCode = 0;
}

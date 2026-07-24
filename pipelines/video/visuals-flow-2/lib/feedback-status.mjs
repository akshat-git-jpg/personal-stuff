import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';


function checkWorkdir(workdir) {
  const cuesJsonPath = path.join(workdir, 'cues.json');
  const cuesLlmPath = path.join(workdir, 'cues.llm.json');
  const feedbackPath = path.join(workdir, 'feedback.json');
  
  if (fs.existsSync(cuesJsonPath) && !fs.existsSync(cuesLlmPath)) {
    console.error(`warning: ${workdir} has cues.json but no cues.llm.json`);
  }

  const pending = [];
  if (fs.existsSync(feedbackPath)) {
    let fb;
    try {
      fb = JSON.parse(fs.readFileSync(feedbackPath, 'utf8'));
    } catch (e) {
      // ignore parse errors or handle them?
    }
    if (fb && fb.items) {
      const today = new Date().getTime();
      for (const [ref, item] of Object.entries(fb.items)) {
        if (!item.applied && !item.folded) {
          const ageDays = item.added ? Math.floor((today - new Date(item.added).getTime()) / (1000 * 3600 * 24)) : 0;
          pending.push({
            ref,
            text: (item.text || '').slice(0, 80) + (item.text?.length > 80 ? '...' : ''),
            age: ageDays
          });
        }
      }
    }
  }
  return pending;
}

export function runFeedbackStatus(workdirs) {
  const results = {};
  let hasPending = false;

  for (const wd of workdirs) {
    const pending = checkWorkdir(wd);
    if (pending.length > 0) {
      results[wd] = pending;
      hasPending = true;
    }
  }

  for (const [wd, pending] of Object.entries(results)) {
    const slug = path.basename(wd);
    console.log(`Video: ${slug}`);
    for (const p of pending) {
      console.log(`  - ${p.ref} (${p.age} days old): ${p.text}`);
    }
    console.log('');
  }

  return hasPending ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  let workdirs = [];

  if (args.length === 1) {
    workdirs.push(resolveWorkdir(args[0]));
  } else {
    const pipelineRoot = path.resolve(import.meta.dirname, '..');
    const videosDir = path.join(pipelineRoot, 'videos');
    if (fs.existsSync(videosDir)) {
      for (const f of fs.readdirSync(videosDir)) {
        const wd = path.join(videosDir, f);
        if (fs.statSync(wd).isDirectory()) {
          workdirs.push(wd);
        }
      }
    }
  }

  process.exit(runFeedbackStatus(workdirs));
}

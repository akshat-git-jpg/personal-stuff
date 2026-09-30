import fs from 'node:fs';
import path from 'node:path';

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  
  if (cmd === 'auth-check') {
    process.exit(0);
  }
  
  // Meters come from stub-usage.json in cwd so a test can move them mid-batch.
  if (cmd === 'usage') {
    const f = path.join(process.cwd(), 'stub-usage.json');
    const snap = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8'))
      : { credits: 100, seconds_consumed: 0, seconds_limit: 1200, ai_image_credits: 5, ai_video_credits: 5, ai_concept_credits: 5 };
    console.log(JSON.stringify({ ts: new Date().toISOString(), ...snap }));
    process.exit(0);
  }

  if (cmd === 'template-engine') {
    const iv = process.env.STUB_TEMPLATE_IV === '1';
    console.log(JSON.stringify({ template: args[2], avatar_iii: !iv }));
    process.exit(iv ? 3 : 0);
  }

  if (cmd === 'generate-from-template') {
    const counterFile = path.join(process.cwd(), 'stub-counter.txt');
    let n = 1;
    if (fs.existsSync(counterFile)) {
      n = parseInt(fs.readFileSync(counterFile, 'utf8'), 10) + 1;
    }
    fs.writeFileSync(counterFile, String(n));
    // Record the full arg vector so tests can assert what the pipeline sent
    // (e.g. --engine heygen4 in production mode).
    fs.appendFileSync(path.join(process.cwd(), 'stub-args.log'), args.join(' ') + '\n');
    console.log(JSON.stringify({ video_id: `vid-${n}`, status: 'submitted' }));
    process.exit(0);
  }
  
  if (cmd === 'status') {
    console.log(JSON.stringify({ status: 'completed' }));
    process.exit(0);
  }
  
  if (cmd === 'download') {
    const outIdx = args.indexOf('--out');
    if (outIdx === -1 || !args[outIdx + 1]) {
      process.exit(1);
    }
    const outFile = args[outIdx + 1];
    fs.writeFileSync(outFile, '');
    console.log(JSON.stringify({}));
    process.exit(0);
  }
  
  process.exit(1);
}

main();

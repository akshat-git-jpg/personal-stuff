import fs from 'node:fs';
import path from 'node:path';

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  
  if (cmd === 'auth-check') {
    process.exit(0);
  }
  
  if (cmd === 'generate-from-template') {
    const counterFile = path.join(process.cwd(), 'stub-counter.txt');
    let n = 1;
    if (fs.existsSync(counterFile)) {
      n = parseInt(fs.readFileSync(counterFile, 'utf8'), 10) + 1;
    }
    fs.writeFileSync(counterFile, String(n));
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

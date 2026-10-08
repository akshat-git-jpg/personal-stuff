import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { claudeArgs, parseEnvelope, runClaude, pool } from './claude.mjs';

test('headless flags: prompt on stdin, project settings only, json envelope', () => {
  const a = claudeArgs({ model: 'opus', maxTurns: 40 });
  assert.deepEqual(a, ['-p', '--model', 'opus', '--max-turns', '40', '--output-format', 'json', '--dangerously-skip-permissions', '--setting-sources', 'project']);
  assert.deepEqual(claudeArgs({ model: 'opus', maxTurns: 5, resume: 'abc' }).slice(-2), ['--resume', 'abc']);
});

test('the envelope is the whole output or its last line', () => {
  assert.equal(parseEnvelope('{"result":"x"}').result, 'x');
  assert.equal(parseEnvelope('warning: something\n{"result":"y"}').result, 'y');
  assert.equal(parseEnvelope('not json'), null);
});

test('a run happens in the stage, reads the prompt from stdin, and leaves its envelope', { skip: process.platform === 'win32' && 'posix fake binary' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'animate-claude-'));
  const fake = path.join(dir, 'fake-claude');
  fs.writeFileSync(fake, `#!${process.execPath}\nlet s='';process.stdin.on('data',d=>s+=d).on('end',()=>{require('fs').writeFileSync('seen.txt',process.cwd()+'|'+s+'|'+process.argv.slice(2).join(' '));console.log(JSON.stringify({result:'done',session_id:'s1',total_cost_usd:0.5}));});\n`);
  fs.chmodSync(fake, 0o755);
  const r = await runClaude({ cwd: dir, prompt: 'Read PROMPT.md', model: 'opus', maxTurns: 3, cmd: fake, label: 't' });
  assert.equal(r.ok, true);
  assert.equal(r.sessionId, 's1');
  assert.equal(r.cost, 0.5);
  const [cwd, stdin, args] = fs.readFileSync(path.join(dir, 'seen.txt'), 'utf8').split('|');
  assert.equal(fs.realpathSync(cwd), fs.realpathSync(dir));
  assert.equal(stdin, 'Read PROMPT.md');
  assert.match(args, /--setting-sources project/);
  assert.ok(fs.existsSync(path.join(dir, 'claude-t.json')));
});

test('pool keeps at most n in flight and preserves order', async () => {
  let live = 0, peak = 0;
  const out = await pool([1, 2, 3, 4, 5], 2, async (x) => { live++; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 5)); live--; return x * 10; });
  assert.deepEqual(out, [10, 20, 30, 40, 50]);
  assert.equal(peak, 2);
});

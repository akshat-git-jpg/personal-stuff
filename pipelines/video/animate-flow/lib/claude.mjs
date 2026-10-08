// One headless `claude -p` run inside a sealed stage. Flags follow tooling/boss/executors/claude-p.sh;
// --setting-sources project keeps user hooks, skills and memory out, so the stage is the whole world.
// npm_config_userconfig: an expired token in ~/.npmrc 401s public packages for the author's npx calls.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const CLAUDE_CMD = process.env.ANIMATE_CLAUDE_CMD || 'claude';
const IS_WIN = process.platform === 'win32';

// The prompt goes in on stdin, so no argument ever needs shell quoting (Windows runs claude.cmd via a shell).
export function claudeArgs({ model, maxTurns, resume } = {}) {
  return ['-p', '--model', model, '--max-turns', String(maxTurns), '--output-format', 'json',
    '--dangerously-skip-permissions', '--setting-sources', 'project', ...(resume ? ['--resume', resume] : [])];
}

// The JSON envelope: the whole output, else its last line (stderr chatter can precede it).
export function parseEnvelope(raw) {
  const text = String(raw).trim();
  for (const cand of [text, text.split('\n').pop()]) {
    try { return JSON.parse(cand); } catch { /* next */ }
  }
  return null;
}

export function runClaude({ cwd, prompt, model, maxTurns = 60, resume, timeoutMs = 45 * 60 * 1000, cmd = CLAUDE_CMD, env = process.env, label = 'claude' }) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(cmd, claudeArgs({ model, maxTurns, resume }), {
      cwd, shell: IS_WIN, env: { ...env, npm_config_userconfig: os.devNull },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.on('error', (e) => { err += String(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const envelope = parseEnvelope(out);
      fs.writeFileSync(path.join(cwd, `claude-${label}.json`), JSON.stringify({ code, envelope, stderr: err.slice(-4000) }, null, 2) + '\n');
      resolve({
        ok: code === 0 && envelope && !envelope.is_error,
        code, envelope, stderr: err,
        sessionId: envelope?.session_id ?? null,
        cost: envelope?.total_cost_usd ?? 0,
        seconds: Math.round((Date.now() - started) / 1000),
      });
    });
    child.stdin.end(prompt);
  });
}

// Run fn over items with at most n in flight.
export async function pool(items, n, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i], i); }
  }));
  return results;
}

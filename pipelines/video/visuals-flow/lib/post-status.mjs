import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { pathToFileURL } from 'node:url';

export function mergeStatus(prev, updates) {
  const allowedStatuses = ['fixed', 'skipped', 'question'];
  const items = { ...(prev.items || {}) };
  
  for (const [key, update] of Object.entries(updates)) {
    if (!allowedStatuses.includes(update.status)) {
      throw new Error(`Invalid status: ${update.status} for key ${key}`);
    }
    items[key] = {
      status: update.status,
      message: update.message || ''
    };
  }
  
  return {
    updated: new Date().toISOString(),
    items
  };
}

async function main() {
  const arg1 = process.argv[2];
  const arg2 = process.argv[3];
  
  if (!arg1 || !arg2) {
    console.error("Usage: node lib/post-status.mjs <slug-or-path> '<json>'");
    process.exit(1);
  }
  
  const workdir = resolveWorkdir(arg1);
  if (!workdir) {
    console.error(`workdir not found for: ${arg1}`);
    process.exit(1);
  }

  let updates;
  try {
    updates = JSON.parse(arg2);
  } catch (e) {
    console.error("Invalid JSON:", e.message);
    process.exit(1);
  }

  const statusPath = path.join(workdir, 'claude_status.json');
  let prev = { items: {} };
  
  if (fs.existsSync(statusPath)) {
    try {
      prev = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    } catch (e) {
      console.warn("Could not read existing claude_status.json, starting fresh.");
    }
  }

  let next;
  try {
    next = mergeStatus(prev, updates);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  fs.writeFileSync(statusPath, JSON.stringify(next, null, 2));
  console.log(`Updated ${statusPath}`);
}

// pathToFileURL, not `file://${argv[1]}`: on Windows argv[1] is a backslash
// path, so naive string concatenation never matches import.meta.url.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

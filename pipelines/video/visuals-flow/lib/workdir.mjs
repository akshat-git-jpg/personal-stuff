import fs from 'node:fs';
import path from 'node:path';
import { resolveKey } from '../../../video-registry/lib/registry.mjs';

export function resolveWorkdir(arg) {
  if (arg.includes('/') || fs.existsSync(arg)) return path.resolve(arg);
  const pipelineRoot = path.resolve(import.meta.dirname, '..');
  const direct = path.join(pipelineRoot, 'videos', arg);
  if (fs.existsSync(direct)) return direct;
  // Not on disk under this name. If the registry knows it as an alias of a video
  // whose workdir DOES exist, use that. Otherwise fall through to `direct`
  // unchanged: this function is also how a NEW workdir path is built, so it must
  // still return a path for a directory that does not exist yet, and must never
  // throw — a missing or malformed registry cannot be allowed to break the run.
  try {
    const canonical = resolveKey(arg);
    if (canonical && canonical !== arg) {
      const aliased = path.join(pipelineRoot, 'videos', canonical);
      if (fs.existsSync(aliased)) return aliased;
    }
  } catch {
    // fall through
  }
  return direct;
}

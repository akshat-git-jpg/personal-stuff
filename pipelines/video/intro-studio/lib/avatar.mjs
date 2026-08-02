import fs from 'node:fs';
import path from 'node:path';
import { resolveWorkdir } from './workdir.mjs';
import { probeDuration } from './intake.mjs';

// The avatar clip must cover the whole intro, or the film cannot show the face
// wherever the screenplay wants it. Short by more than a frame is a hard stop.
export function checkAvatarClip(slug, { tolerance = 0.1 } = {}) {
  const workdir = resolveWorkdir(slug);
  const clip = path.join(workdir, 'avatar.mp4');
  if (!fs.existsSync(clip)) return { ok: false, reason: 'no avatar.mp4 — see steps/015-avatar-clip-human/README.md' };
  const intake = JSON.parse(fs.readFileSync(path.join(workdir, 'intake.json'), 'utf8'));
  const clipDur = probeDuration(clip);
  if (clipDur + tolerance < intake.duration) {
    return { ok: false, reason: `avatar.mp4 is ${clipDur.toFixed(2)}s but the intro is ${intake.duration.toFixed(2)}s — regenerate over the full VO` };
  }
  return { ok: true, duration: clipDur };
}

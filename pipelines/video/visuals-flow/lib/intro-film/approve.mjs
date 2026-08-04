import fs from 'node:fs';
import path from 'node:path';
import { gateWaived } from '../run-config.mjs';

// The intro film is judged almost entirely by eye. Across three review passes
// the mechanical checker was clean while the film had a crown landing on the
// presenter, rails invisible at 2px/20% opacity, and a label doing a graphic's
// job. None of those is machine-detectable, so the owner gate is the real gate.
//
// This is a REVIEW gate, in the same class as 037 and 080, so express waives it.
// The 120 final-cut gate is the one that never routes through gateWaived.
export function requireIntroApproved(workdir) {
  if (gateWaived(workdir, '027 intro film')) return;
  const p = path.join(workdir, 'intro-film', 'screenplay.json');
  if (!fs.existsSync(p)) throw new Error(`missing ${p} — author the intro film first`);
  const intro = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!intro.approved) {
    throw new Error(
      'intro film must not render before the owner approves it — open the board, ' +
      'read the Intro tab, and approve there (step 027)'
    );
  }
}

export function approveIntro(workdir, { approved = true } = {}) {
  const p = path.join(workdir, 'intro-film', 'screenplay.json');
  const intro = JSON.parse(fs.readFileSync(p, 'utf8'));
  intro.approved = approved;
  intro.approved_at = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(intro, null, 2) + '\n');
  return intro;
}

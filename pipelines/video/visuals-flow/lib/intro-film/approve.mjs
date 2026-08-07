import fs from 'node:fs';
import path from 'node:path';


// The intro film is judged almost entirely by eye. Across three review passes
// the mechanical checker was clean while the film had a crown landing on the
// presenter, rails invisible at 2px/20% opacity, and a label doing a graphic's
// job. None of those is machine-detectable, so the owner gate is the real gate.
//

// It guards ASSEMBLY, not rendering. It used to block intro-render, which was
// coherent while the Intro tab was a contact sheet of stills — you could review
// without a render. Plan 189 made the review surface a video PLAYER, and the
// gate became a deadlock: you cannot approve a film you have not watched, and
// you could not render the film you needed in order to watch it. Worse, it
// guarded the wrong door — assemble consumed intro.mp4 with no approval check
// at all, so the gate blocked the harmless step and let the consequential one
// through. Rendering is how the owner GETS something to judge; approval is what
// lets that judged film into the cut (owner report 2026-08-06).
export function requireIntroApproved(workdir) {

  const p = path.join(workdir, 'intro-film', 'screenplay.json');
  if (!fs.existsSync(p)) throw new Error(`missing ${p} — author the intro film first`);
  const intro = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!intro.approved) {
    throw new Error(
      'intro film is not approved — it must not go into the cut until the owner ' +
      'has watched it. Open the board, play it on the Intro tab, and approve ' +
      'there (step 027). Re-rendering after feedback needs no approval.'
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

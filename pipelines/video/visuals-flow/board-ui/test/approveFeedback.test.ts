import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// A gate button that writes its approval but changes nothing on screen is
// indistinguishable from a broken one. The Final Cut button did exactly that:
// it approved v3 on the first click and the owner reported it dead, because the
// label, the disabled state and the page all looked identical afterwards
// (2026-08-09). The Storyboard tab had carried the ✓-and-disable pattern for
// months; Final Cut was simply never given it.
//
// This repo's board tests are plain logic tests — there is no jsdom or React
// testing library here, and adding one to assert a label is not worth the
// dependency. So this reads the sources instead: any tab that POSTs to an
// /approve* endpoint must also consume an approved flag and render a ✓ state.
// Crude, but it fails for the exact reason the owner filed, and it fails for
// the NEXT gate button someone adds without feedback.
const TABS = path.resolve(import.meta.dirname, '..', 'src', 'tabs');

function tabSources() {
  return fs.readdirSync(TABS)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => ({ file: f, src: fs.readFileSync(path.join(TABS, f), 'utf8') }));
}

describe('gate approve buttons show their approved state', () => {
  // Matching the endpoint STRING, not `fetch(...)`. StoryboardTab posts through
  // a local handleApprove('/approve') helper, so a fetch-shaped pattern skipped
  // the one tab that had the ✓ pattern right all along — the guard would have
  // been blind to exactly the file worth comparing against.
  const gated = tabSources().filter(({ src }) => /['"`]\/approve/.test(src));

  it('finds the tabs that own an approve gate', () => {
    // Guards the guard: if a refactor moves these calls elsewhere, the loop
    // below would silently assert nothing at all.
    expect(gated.map((g) => g.file).sort())
      .toEqual(['AvatarTab.tsx', 'FinalCutTab.tsx', 'IntroTab.tsx', 'StoryboardTab.tsx']);
  });

  for (const { file, src } of gated) {
    it(`${file} renders a ✓ approved state`, () => {
      expect(src, `${file} posts an approval but never renders a ✓ — the owner cannot see the click land`)
        .toMatch(/✓/);
    });

    it(`${file} disables the button once approved`, () => {
      // `disabled={...approved...}` in some form. Re-clicking an already-passed
      // gate should be impossible, not merely idempotent.
      expect(src, `${file} never disables on an approved flag — the button stays live after passing the gate`)
        .toMatch(/disabled=\{[^}]*[Aa]pproved/);
    });
  }
});

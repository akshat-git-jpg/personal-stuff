// The hyperframes renderer pins, in ONE place.
//
// There are TWO pins today and they disagree by 26 patch versions:
//
//   CARD_RENDERER  0.7.62 — every graphics card (lib/render.mjs, step 090) and
//                           the local transcribe fallback (steps/010-.../run.sh)
//   FILM_RENDERER  0.7.88 — the bespoke intro film, both render AND review
//
// The split is NOT a decision anybody recorded: decisions.md and HANDOFF.md are
// silent on it, so it reads as two pins bumped by two different plans rather
// than a choice. Before this module the two values lived in four files with no
// way to see they disagreed, which is how a board review on one renderer and a
// shipped render on another become possible.
//
// WHY THE SPLIT IS PRESERVED HERE INSTEAD OF UNIFIED: unifying changes rendered
// output. Moving cards to 0.7.88 re-renders all 42 catalog cards on a renderer
// nobody has frame-verified them against, and this repo's house rule is that a
// visual change is verified by extracting and LOOKING at frames, because a
// render+inspect gate did not catch three effect regressions that a frame read
// did (decisions.md 2026-07-19). Unification is an owner call with a
// frame-verification pass attached, not a tidy-up.
//
// What this module buys today: one place to read the pins, one place to bump
// one, and a guard test (renderer-constants.test.mjs) that fails if any file
// hardcodes `hyperframes@<version>` again.
//
// HYPERFRAMES_VERSION overrides BOTH pins together. render.mjs already honoured
// it; the film path did not. Overriding both is what keeps render-film and
// review-film on the same renderer, which their own comments require — a green
// review on one version shipping on another is the exact failure they warn about.

const OVERRIDE = process.env.HYPERFRAMES_VERSION ? `hyperframes@${process.env.HYPERFRAMES_VERSION}` : null;

export const CARD_RENDERER_VERSION = '0.7.62';
export const FILM_RENDERER_VERSION = '0.7.88';

export const CARD_RENDERER = OVERRIDE ?? `hyperframes@${CARD_RENDERER_VERSION}`;
export const FILM_RENDERER = OVERRIDE ?? `hyperframes@${FILM_RENDERER_VERSION}`;

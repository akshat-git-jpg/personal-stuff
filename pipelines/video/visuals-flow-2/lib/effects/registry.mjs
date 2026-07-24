import * as whip from './whip.mjs';
import * as beats from './beats.mjs';
import * as captions from './captions.mjs';
import * as bubble from './bubble.mjs';
import * as motif from './motif.mjs';

// bubble stacks LAST so it draws over captions if they ever collide.
// drift (Ken Burns) was removed for good — owner verdict 2026-07-24: "remove
// this forever, not adding much value" (test-01 Final Cut feedback).
export const EFFECT_MODULES = [whip, beats, motif, captions, bubble];

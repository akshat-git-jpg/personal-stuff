import * as whip from './whip.mjs';
import * as beats from './beats.mjs';
import * as drift from './drift.mjs';
import * as captions from './captions.mjs';
import * as bubble from './bubble.mjs';
import * as motif from './motif.mjs';

// bubble stacks LAST so it draws over captions if they ever collide.
export const EFFECT_MODULES = [whip, beats, motif, captions, drift, bubble];

import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import { loadFont as loadKalam } from "@remotion/google-fonts/Kalam";
import { loadFont as loadPatrick } from "@remotion/google-fonts/PatrickHand";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

// Fresh-install fix: bare loadFont() pulls every weight × every language subset
// (hundreds of requests) and blows the delayRender("fonts") timeout on a cold cache.
// Restrict to the latin subset — all styles/weights kept, ~5× fewer requests.
const OPT = { subsets: ["latin"], ignoreTooManyRequestsWarning: true } as const;

export const CAVEAT = loadCaveat(undefined, OPT).fontFamily;      // marker handwriting — headlines / annotations
export const KALAM = loadKalam(undefined, OPT).fontFamily;        // pen handwriting — notes / body
export const PATRICK = loadPatrick(undefined, OPT).fontFamily;    // rounder pencil hand — labels
export const FRAUNCES = loadFraunces(undefined, OPT).fontFamily;  // editorial serif — the "printed" counterpoint
export const HMONO = loadMono(undefined, OPT).fontFamily;         // tiny figure tags

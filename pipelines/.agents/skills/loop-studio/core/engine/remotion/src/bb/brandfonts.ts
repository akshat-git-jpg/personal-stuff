import { loadFont as loadSans } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadSerif } from "@remotion/google-fonts/PlayfairDisplay";

// Fresh-install fix: latin-only subset so cold-cache font loading clears the
// delayRender("fonts") timeout (bare loadFont() made hundreds of requests).
const OPT = { subsets: ["latin"], ignoreTooManyRequestsWarning: true } as const;

export const SANS = loadSans(undefined, OPT).fontFamily;   // Space Grotesk — headings/UI (uppercase, tight)
export const MONO = loadMono(undefined, OPT).fontFamily;   // JetBrains Mono — eyebrows / FIG / labels
export const SERIF = loadSerif(undefined, OPT).fontFamily; // Playfair Display italic — counterpoint

// BuildLoop System v1 — LOCKED palette (raisin + silver + neo-lime; no navy, no cream)
export const RAISIN = "#0F121A";
export const RAISIN_DEEP = "#1E2434";
export const STEEL = "#343E5B";
export const SILVER = "#E9ECED";
export const SILVER_SOFT = "#D2D8DA";
export const SILVER_MID = "#B5BFC2";
export const BODY = "#5A6068";
export const LIME = "#CFFF05";
export const WHITE = "#FFFFFF";

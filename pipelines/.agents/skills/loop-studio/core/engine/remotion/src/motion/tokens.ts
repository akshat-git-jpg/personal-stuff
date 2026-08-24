/* BuildLoop System v1 — LOCKED design tokens.
   Palette is raisin + silver + lime ONLY. Off-palette colors are intentionally
   NOT exported, so a viz literally cannot import a navy/violet/chrome. */

export const RAISIN = "#0F121A";
export const RAISIN_DEEP = "#1E2434";
export const STEEL = "#343E5B"; // the only "blue" — offset on dark
export const SILVER = "#E9ECED";
export const SILVER_SOFT = "#D2D8DA";
export const SILVER_MID = "#B5BFC2";
export const BODY = "#5A6068";
export const LIME = "#CFFF05"; // THE single accent — one per frame
export const WHITE = "#FFFFFF";

export const SANS = '"Space Grotesk", system-ui, sans-serif';
export const MONO = '"JetBrains Mono", ui-monospace, monospace';
export const SERIF = '"Playfair Display", Georgia, serif';

/* two-tier radius rule */
export const R_SURFACE = 12; // cards / frames / containers
export const R_INK = 0; // buttons / badges / bars / blocks — sharp print edge

export const SHADOW_CARD = "0 1px 2px rgba(15,18,26,.05), 0 18px 40px -16px rgba(15,18,26,.30)";

/* brand background plates (full-frame, in public/brand) */
export type BgKey = "grid-dark" | "grid-light" | "riso";

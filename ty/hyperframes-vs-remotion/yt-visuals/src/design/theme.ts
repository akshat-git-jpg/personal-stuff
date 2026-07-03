import { Easing } from "remotion";

// Warm-Amber design system: near-black warm background, orange/amber accents,
// gold winner color. "Tech-bro YouTube" energy — high CTR, urgent, warm.

export const colors = {
  // Background layers — warm-tinted dark, not pure black
  bgBase: "#0d0a06",
  bgGradientFrom: "#3a1f08",   // deep burnt-amber tint at the gradient origin
  bgGradientTo: "#0a0805",     // near-black with warm undertone

  // Text — slightly warm whites for tonal consistency on a warm BG
  textPrimary: "#ffffff",
  textSecondary: "rgba(255,239,219,0.65)",
  textTertiary: "rgba(255,239,219,0.40)",
  textDim: "rgba(255,239,219,0.20)",

  // Primary accent — bright orange → burnt orange gradient
  accentFrom: "#fb923c",
  accentTo: "#c2410c",
  accentSolid: "#fb923c",
  accentGlow: "rgba(251,146,60,0.45)",

  // Winner color — gold/amber (trophy energy). Used for "WINNER" markers + the
  // bright bar in pricing comparisons.
  win: "#facc15",
  winDim: "rgba(250,204,21,0.18)",
  cross: "rgba(255,239,219,0.22)",

  // Dividers carry a faint warm tint so hairlines feel part of the same family
  divider: "rgba(255,200,100,0.10)",
};

export const fonts = {
  // We load Inter as SF Pro Display substitute (SF is not free-licensed for video).
  family: "Inter",
  // Tabular numerals for prices and rankings — no jiggling digits when counting up.
  tabular: { fontFeatureSettings: '"tnum"', fontVariantNumeric: "tabular-nums" } as const,
};

export const type = {
  hero: { fontSize: 120, fontWeight: 700, letterSpacing: -4 },
  title: { fontSize: 88, fontWeight: 700, letterSpacing: -3 },
  sectionTitle: { fontSize: 110, fontWeight: 700, letterSpacing: -3 },
  subtitle: { fontSize: 32, fontWeight: 400, letterSpacing: -0.2 },
  body: { fontSize: 26, fontWeight: 400 },
  eyebrow: { fontSize: 18, fontWeight: 600, letterSpacing: 6, textTransform: "uppercase" as const },
  bigNumber: { fontSize: 110, fontWeight: 600, letterSpacing: -3 },
  midNumber: { fontSize: 64, fontWeight: 600, letterSpacing: -2 },
  caption: { fontSize: 20, fontWeight: 500, letterSpacing: 0.3 },
};

export const spacing = {
  framePadding: 140,    // outer padding for every slide
  blockGap: 56,         // between large blocks (eyebrow → title → subtitle)
  itemGap: 28,
  tightGap: 14,
};

// Motion language — strong ease-out for entrances.
export const motion = {
  enterEase: Easing.bezier(0.16, 1, 0.3, 1),
  exitEase: Easing.in(Easing.cubic),
  enterDuration: 28,   // frames @ 30fps → ~0.93s
  staggerFrames: 6,    // delay between staggered children
  numberCountFrames: 45,
};

// Standard video config (1080p, 30fps — YouTube default).
export const video = {
  width: 1920,
  height: 1080,
  fps: 30,
};

// Default duration per template type, in seconds. The editor can trim shorter.
export const sceneDurations = {
  title: 10,
  toc: 9,
  sectionDivider: 5,
  comparisonTable: 13,
  pricingBars: 8,
  verdict: 6,
  ctaDiscount: 7,
};

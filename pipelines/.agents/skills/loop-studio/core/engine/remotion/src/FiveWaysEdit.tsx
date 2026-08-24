/**
 * FiveWaysEdit v3 — bespoke world-canvas edit, "5 Ways To Make Money With AI" (0–122s).
 * Rebuilt per Luuk: VISUALIZE the concepts — each station is an animated visual metaphor
 * (icons / diagrams / motion), NOT big typography. The karaoke captions carry the spoken
 * words, so stations stay near-textless. No connecting trail. Speaker = a rounded video card
 * (fullscreen hook → travelling card → fullscreen for the "they trusted me" beat).
 * Scenes: A websites/automations/apps eaten by an AI scan · B value collapses to €0 ·
 * C a graph crashes · LADDER money-duration bars with growing coin stacks · AU code crossed
 * out → a handshake · BOARD four icons · WAY1 a magnifier diagnosing a storefront.
 */
import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
} from "remotion";

const FPS = 25;
const f = (sec: number) => Math.round(sec * FPS);
const EASE = Easing.bezier(0.45, 0, 0.18, 1);
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const RAISIN = "#0F121A";
const RAISIN2 = "#1E2434";
const SILVER_BG = "#E9ECED";
const SILVER_SOFT = "#D2D8DA";
const BODY = "#5A6068";
const LIME = "#CFFF05";
const RED = "#C0392B";
const TEAL = "#0B2B30";   // Way 1 environment
const TEAL_LT = "#E9ECED";
const RED_ENV = "#2A0E16"; // Way 2 environment (rescue)
const RED_L = "#F0E7E9";   // light ink on the red canvas
const DEAD = "#7A5A62";    // muted rose for "failed / dead" markers
const AMB_ENV = "#2A1E08"; // Way 3 environment (niche)
const AMB_L = "#F1EADA";   // light ink on the amber canvas
const IND_ENV = "#0E1630"; // Way 4 environment (memory)
const IND_L = "#E4E9F5";   // light ink on the indigo canvas
const VIO_ENV = "#1A0E2A"; // Way 5 environment (equity)
const VIO_L = "#ECE4F5";   // light ink on the violet canvas
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const SERIF = "'Playfair Display', Georgia, serif";

/* ---------------- world station centers ---------------- */
const A = { x: 1200, y: 1050 };
const B = { x: 1200, y: 3150 };
const C = { x: 3750, y: 3150 };
const LAD = { x: 3750, y: 1050 };
const AU = { x: 6350, y: 1050 };
const BD = { x: 6350, y: 3350 };
const W1T = { x: 5100, y: 5650 };  // WAY 1 — section title
const W1N = { x: 6350, y: 5650 };  // they need direction, not builders
const W1 = { x: 7700, y: 5650 };   // the storefront / where to start
const OF1 = { x: 8850, y: 5650 };  // the offer
const NB = { x: 8850, y: 3150 };   // the notebook method (hero)
const RC1 = { x: 11350, y: 3150 }; // 3 months vs 1 week
const PR1 = { x: 11350, y: 5650 }; // €3,000
const MO1 = { x: 13850, y: 5650 }; // Monday move
const TEAL_L = "#E9ECED";          // light ink on the teal Way-1 canvas
// ---- Way 2 (rescue) positions, continuing rightward ----
const W2T = { x: 16500, y: 5650 }; // title + MIT 95% stat
const W2Y = { x: 19000, y: 5650 }; // why it failed
const W2M = { x: 21500, y: 5650 }; // the market grows
const W2O = { x: 24000, y: 5650 }; // the offer
const W2W = { x: 26500, y: 5650 }; // who to call (the shrug)
const W2X = { x: 29000, y: 5650 }; // 2x success
const W2P = { x: 31500, y: 5650 }; // price
const W2MO = { x: 34000, y: 5650 }; // Monday + handoff
// ---- Way 3 (niche) positions ----
const W3T = { x: 36500, y: 5650 }; // title + YC 10x
const W3N = { x: 39000, y: 5650 }; // thousands of niches
const W3O = { x: 41500, y: 5650 }; // become THE one
const W3M = { x: 44000, y: 5650 }; // the moat
const W3B = { x: 46500, y: 5650 }; // build once, sell 10 + price
const W3MO = { x: 49000, y: 5650 }; // Monday
const W3H = { x: 51500, y: 5650 }; // handoff + subscribe
// ---- Way 4 (memory) positions ----
const W4T = { x: 54000, y: 5650 }; // title + Fable ban
const W4M = { x: 56500, y: 5650 }; // model is just the worker (swappable)
const W4S = { x: 59000, y: 5650 }; // scattered → one place
const W4U = { x: 61500, y: 5650 }; // free upgrade
const W4O = { x: 64000, y: 5650 }; // offer
const W4P = { x: 66500, y: 5650 }; // price
const W4MO = { x: 69000, y: 5650 }; // Monday + handoff
// ---- Way 5 (equity) + landing positions ----
const W5T = { x: 71500, y: 5650 }; // title
const W5I = { x: 74000, y: 5650 }; // the invoice given up
const W5C = { x: 76500, y: 5650 }; // the compounding gap
const W5V = { x: 79000, y: 5650 }; // investors buying businesses
const W5P = { x: 81500, y: 5650 }; // two prices + buy one
const LND = { x: 84000, y: 5650 }; // landing thesis
const CTA = { x: 86500, y: 5650 }; // final CTA

/* ---------------- world camera ---------------- */
// Every station is a SINGLE frozen pose (identical x/y/z on both keyframes of a hold),
// so text + grid rasterize once and lock — no sub-pixel shimmer. The camera only moves
// during the short transition segments between stations (and the two deliberate intro
// beats: the crash punch-in and the pull-back into the Way-1 world).
const CAM: [number, number, number, number][] = [
  [f(0.0), A.x, A.y, 1.03],
  [f(13.42), A.x, A.y, 1.03],            // A — dead still
  [f(13.92), B.x, B.y, 1.03],           // move A→B
  [f(17.56), B.x, B.y, 1.03],           // B — dead still
  [f(18.06), C.x, C.y, 1.0],            // arrive at the graph
  [f(21.2), C.x, C.y - 30, 1.16],      // deliberate PUNCH IN on the crash (intentional move)
  [f(22.42), LAD.x, LAD.y, 0.62],       // dramatic pull back to the wide money ladder
  [f(41.83), LAD.x, LAD.y, 0.62],       // LAD — dead still (elements animate, camera doesn't)
  [f(44.12), AU.x, AU.y, 0.94],         // move → authority
  [f(67.89), AU.x, AU.y, 0.94],         // AU — dead still
  [f(70.04), BD.x - 380, BD.y, 0.88],   // board: deliberate pan across the four cards
  [f(76.94), BD.x, BD.y, 0.84],
  [f(84.26), BD.x + 380, BD.y, 0.88],
  [f(88.60), BD.x, BD.y, 0.86],              // settle back on the centred board (no jarring zoom-out)
  [f(90.66), W1T.x, W1T.y, 0.97],            // clean dive down into the Way 1 world
  [f(96.03), W1T.x, W1T.y, 0.97],      // WAY 1 title — still
  [f(96.86), W1N.x, W1N.y, 0.97],
  [f(106.16), W1N.x, W1N.y, 0.97],      // "need direction" — still
  [f(107.24), W1.x, W1.y, 0.98],
  [f(117.0), W1.x, W1.y, 0.98],        // storefront — still
  // ---- Way 1 continued (teal world) ----
  [f(118.6), OF1.x, OF1.y, 1.01],
  [f(127.0), OF1.x, OF1.y, 1.01],      // offer — still
  [f(128.99), NB.x + 265, NB.y, 0.73],
  [f(174.62), NB.x + 265, NB.y, 0.73],  // notebook — dead still (48s hold, was the worst shimmer)
  [f(176.22), RC1.x, RC1.y, 0.96],
  [f(197.63), RC1.x, RC1.y, 0.96],      // 3 months vs 1 week — still
  [f(199.53), PR1.x, PR1.y, 1.04],
  [f(205.56), PR1.x, PR1.y, 1.04],      // the price — still
  [f(211.94), MO1.x, MO1.y, 1.0],
  [f(235.46), MO1.x, MO1.y, 1.0],       // Monday — still
  // ---- Way 2 (rescue, red) ----
  [f(237.14), W2T.x, W2T.y, 0.90],
  [f(247.45), W2T.x, W2T.y, 0.90],
  [f(248.66), W2Y.x, W2Y.y, 0.96],
  [f(263.95), W2Y.x, W2Y.y, 0.96],
  [f(264.73), W2M.x, W2M.y, 0.94],
  [f(276.94), W2M.x, W2M.y, 0.94],
  [f(278.16), W2O.x, W2O.y, 0.97],
  [f(286.96), W2O.x, W2O.y, 0.97],
  [f(288.06), W2W.x, W2W.y, 0.95],
  [f(308.95), W2W.x, W2W.y, 0.95],
  [f(310.45), W2X.x, W2X.y, 0.98],
  [f(315.95), W2X.x, W2X.y, 0.98],
  [f(316.95), W2P.x, W2P.y, 1.03],
  [f(323.45), W2P.x, W2P.y, 1.03],
  [f(324.65), W2MO.x, W2MO.y, 0.94],
  [f(352.64), W2MO.x, W2MO.y, 0.94],   // hold still through the "next way…" teaser (no 8s drift)
  // ---- Way 3 (niche, amber) ----
  [f(354.14), W3T.x, W3T.y, 0.93],     // then a quick, deliberate move into Way 3
  [f(364.93), W3T.x, W3T.y, 0.93],
  [f(366.28), W3N.x, W3N.y, 0.91],
  [f(376.61), W3N.x, W3N.y, 0.91],
  [f(377.63), W3O.x, W3O.y, 0.97],
  [f(385.51), W3O.x, W3O.y, 0.97],
  [f(386.11), W3M.x, W3M.y, 0.93],
  [f(412.19), W3M.x, W3M.y, 0.93],
  [f(412.99), W3B.x, W3B.y, 0.95],
  [f(432.01), W3B.x, W3B.y, 0.95],
  [f(432.73), W3MO.x, W3MO.y, 0.97],
  [f(442.81), W3MO.x, W3MO.y, 0.97],
  [f(443.72), W3H.x, W3H.y, 0.95],
  [f(455.31), W3H.x, W3H.y, 0.95],
  // ---- Way 4 (memory, indigo) ----
  [f(458.11), W4T.x, W4T.y, 0.93],
  [f(469.51), W4T.x, W4T.y, 0.93],
  [f(470.45), W4M.x, W4M.y, 0.93],
  [f(495.47), W4M.x, W4M.y, 0.93],
  [f(496.15), W4S.x, W4S.y, 0.93],
  [f(512.08), W4S.x, W4S.y, 0.93],
  [f(513.06), W4U.x, W4U.y, 0.95],
  [f(525.7), W4U.x, W4U.y, 0.95],
  [f(526.4), W4O.x, W4O.y, 0.97],
  [f(537.4), W4O.x, W4O.y, 0.97],   // hold long enough for "at no extra cost" to land + read
  [f(538.42), W4P.x, W4P.y, 1.03],   // then a quick pan to the price
  [f(548.71), W4P.x, W4P.y, 1.03],
  [f(549.4), W4MO.x, W4MO.y, 0.95],
  [f(564.27), W4MO.x, W4MO.y, 0.95],
  // ---- Way 5 (equity, violet) + landing ----
  [f(564.67), W5T.x, W5T.y, 0.93],
  [f(574.21), W5T.x, W5T.y, 0.93],
  [f(575.21), W5I.x, W5I.y, 0.95],
  [f(583.71), W5I.x, W5I.y, 0.95],
  [f(584.71), W5C.x, W5C.y, 0.93],
  [f(600.71), W5C.x, W5C.y, 0.93],
  [f(602.85), W5V.x, W5V.y, 0.93],
  [f(623.97), W5V.x, W5V.y, 0.93],
  [f(624.57), W5P.x, W5P.y, 0.93],
  [f(651.2), W5P.x, W5P.y, 0.93],
  [f(652.34), LND.x, LND.y, 0.95],
  [f(661.74), LND.x, LND.y, 0.95],
  [f(662.74), CTA.x, CTA.y, 0.94],
  [f(673.22), CTA.x, CTA.y, 0.94],
];
function cam(frame: number) {
  const ks = CAM;
  if (frame <= ks[0][0]) { const [, x, y, z] = ks[0]; return { x, y, z }; }
  for (let i = 0; i < ks.length - 1; i++) {
    const [fa, xa, ya, za] = ks[i]; const [fb, xb, yb, zb] = ks[i + 1];
    if (frame >= fa && frame <= fb) { const t = EASE((frame - fa) / Math.max(1, fb - fa)); return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, z: za + (zb - za) * t }; }
  }
  const [, x, y, z] = ks[ks.length - 1]; return { x, y, z };
}
// Detect a real station-to-station camera move (not a micro-pan) so we can fire a
// directional "comet" during it — a transient travelling accent, never a persistent trail.
function moveState(frame: number) {
  const ks = CAM;
  for (let i = 0; i < ks.length - 1; i++) {
    const [fa, xa, ya] = ks[i]; const [fb, xb, yb] = ks[i + 1];
    if (frame >= fa && frame <= fb) {
      const dx = xb - xa, dy = yb - ya;
      if (Math.hypot(dx, dy) > 1300) return { active: true, t: (frame - fa) / Math.max(1, fb - fa), dx, dy };
      return { active: false, t: 0, dx: 0, dy: 0 };
    }
  }
  return { active: false, t: 0, dx: 0, dy: 0 };
}

/* ---------------- speaker card ---------------- */
function spkAt(frame: number) {
  const kf: [number, number, number, number, number][] = [
    [f(0.0), 0.500, 0.500, 0.95, 0],
    [f(4.7), 0.500, 0.500, 0.95, 0],
    [f(6.4), 0.820, 0.205, 0.205, 1.6],
    [f(21.12), 0.820, 0.205, 0.205, 1.6],
    [f(22.42), 0.825, 0.200, 0.180, 1.6],
    [f(42.73), 0.825, 0.200, 0.180, 1.6],
    [f(44.61), 0.180, 0.775, 0.190, -1.6],
    [f(54.59), 0.180, 0.775, 0.190, -1.6],
    [f(56.39), 0.500, 0.500, 0.92, 0],
    [f(66.02), 0.500, 0.500, 0.92, 0],
    [f(67.89), 0.820, 0.205, 0.205, 1.6],
    [f(89.6), 0.820, 0.205, 0.205, 1.6],
    [f(91.68), 0.820, 0.205, 0.205, 1.6],
    [f(117.0), 0.820, 0.205, 0.205, 1.6],
    // Way 1 continued
    [f(118.6), 0.820, 0.205, 0.200, 1.6],
    [f(127.31), 0.820, 0.205, 0.200, 1.6],
    [f(129.3), 0.882, 0.500, 0.170, 0],   // notebook: PORTRAIT card docked right
    [f(173.79), 0.882, 0.500, 0.170, 0],
    [f(176.22), 0.820, 0.205, 0.200, 1.6],  // receipt: back to top-right landscape
    [f(235.46), 0.820, 0.205, 0.200, 1.6],
    // Way 2
    [f(237.14), 0.820, 0.205, 0.200, 1.6],
    [f(286.96), 0.820, 0.205, 0.200, 1.6],
    [f(289.06), 0.882, 0.500, 0.170, 0],   // portrait during the "who to call" beat
    [f(307.95), 0.882, 0.500, 0.170, 0],
    [f(310.45), 0.820, 0.205, 0.200, 1.6],
    [f(345.44), 0.820, 0.205, 0.200, 1.6],
    // Way 3
    [f(354.14), 0.820, 0.205, 0.200, 1.6],
    [f(385.51), 0.820, 0.205, 0.200, 1.6],
    [f(387.61), 0.882, 0.500, 0.170, 0],   // portrait during the moat beat
    [f(411.19), 0.882, 0.500, 0.170, 0],
    [f(412.99), 0.820, 0.205, 0.200, 1.6],
    [f(455.31), 0.820, 0.205, 0.200, 1.6],
    // Way 4
    [f(458.11), 0.820, 0.205, 0.200, 1.6],
    [f(469.98), 0.820, 0.205, 0.200, 1.6],
    [f(471.97), 0.882, 0.500, 0.170, 0],   // portrait during the swappable-model beat
    [f(494.53), 0.882, 0.500, 0.170, 0],
    [f(496.15), 0.820, 0.205, 0.200, 1.6],
    [f(564.27), 0.820, 0.205, 0.200, 1.6],
    // Way 5 + landing
    [f(564.67), 0.820, 0.205, 0.200, 1.6],
    [f(623.97), 0.820, 0.205, 0.200, 1.6],
    [f(625.47), 0.882, 0.500, 0.170, 0],   // portrait during the two-prices beat
    [f(650.22), 0.882, 0.500, 0.170, 0],
    [f(651.50), 0.882, 0.500, 0.170, 0],   // hold portrait through the last Way-5 line
    [f(653.40), 0.500, 0.500, 1.00, 0],    // push IN to FULL-SCREEN for the outro
    [f(673.22), 0.500, 0.500, 1.00, 0],    // hold full-screen to the end
  ];
  for (let i = 0; i < kf.length - 1; i++) {
    const [fa, xa, ya, wa, ra] = kf[i]; const [fb, xb, yb, wb, rb] = kf[i + 1];
    if (frame >= fa && frame <= fb) { const t = EASE((frame - fa) / Math.max(1, fb - fa)); return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, w: wa + (wb - wa) * t, r: ra + (rb - ra) * t }; }
  }
  const [, x, y, w, r] = kf[kf.length - 1]; return { x, y, w, r };
}
// portrait/landscape aspect for the speaker card (0 = landscape, 1 = portrait)
function spkAsp(frame: number) {
  return Math.max(
    interpolate(frame, [f(129.3), f(130.58), f(172.84), f(174.22)], [0, 1, 1, 0], clamp),
    interpolate(frame, [f(289.06), f(290.66), f(306.95), f(308.44)], [0, 1, 1, 0], clamp),
    interpolate(frame, [f(387.61), f(389.19), f(410.2), f(411.69)], [0, 1, 1, 0], clamp),
    interpolate(frame, [f(471.97), f(473.7), f(492.92), f(494.53)], [0, 1, 1, 0], clamp),
    interpolate(frame, [f(625.47), f(627.46), f(648.73), f(650.22)], [0, 1, 1, 0], clamp),
  );
}

const gridUri = (stroke: string) => {
  const s = 76;
  return "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'><path d='M ${s} 0 L 0 0 0 ${s}' fill='none' stroke='${stroke}' stroke-width='1'/></svg>`);
};
const GRID_URI = gridUri("rgba(15,18,26,0.09)");
const GRID_DARK_URI = gridUri("rgba(233,236,237,0.08)");

const useIn = (at: number, dur = 16) => {
  const frame = useCurrentFrame();
  if (frame < at) return 0;
  return interpolate(frame, [at, at + dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
};
const useSpring = (at: number, dur = 18, damp = 13) => {
  const frame = useCurrentFrame();
  return frame < at ? 0 : spring({ frame: frame - at, fps: FPS, config: { damping: damp, stiffness: 150 }, durationInFrames: dur });
};

/* ---------------- karaoke captions ---------------- */
const CAP_LINES: { words: { t: string; at: number }[]; end: number }[] = [
  { words: [{ t: 'YOU', at: 0.13 }, { t: 'SHOULD', at: 0.29 }, { t: 'STOP', at: 0.53 }], end: 0.85 },
  { words: [{ t: 'LEARNING', at: 0.97 }, { t: 'TO', at: 1.25 }, { t: 'BUILD', at: 1.39 }], end: 1.65 },
  { words: [{ t: 'WITH', at: 1.91 }, { t: 'AI.', at: 2.15 }], end: 2.39 },
  { words: [{ t: 'I', at: 2.57 }, { t: 'KNOW', at: 2.71 }, { t: 'HOW', at: 3.03 }], end: 3.15 },
  { words: [{ t: 'THAT', at: 3.19 }, { t: 'SOUNDS', at: 3.39 }, { t: 'COMING', at: 3.81 }], end: 4.03 },
  { words: [{ t: 'FROM', at: 4.08 }, { t: 'ME', at: 4.32 }, { t: 'BUT', at: 4.67 }], end: 4.82 },
  { words: [{ t: 'THINK', at: 4.89 }, { t: 'ABOUT', at: 5.17 }, { t: 'WHAT', at: 5.52 }], end: 5.7 },
  { words: [{ t: 'BUILDING', at: 5.78 }, { t: 'ACTUALLY', at: 6.44 }, { t: 'IS.', at: 6.94 }], end: 7.08 },
  { words: [{ t: 'WEBSITES', at: 7.44 }, { t: 'AUTOMATIONS', at: 8.34 }, { t: 'APPS', at: 9.46 }], end: 9.68 },
  { words: [{ t: 'THAT', at: 10.08 }, { t: 'IS', at: 10.28 }, { t: 'EXACTLY', at: 10.46 }], end: 11.1 },
  { words: [{ t: 'THE', at: 11.12 }, { t: 'PART', at: 11.26 }, { t: 'THAT', at: 11.62 }], end: 11.76 },
  { words: [{ t: 'AI', at: 11.86 }, { t: 'IS', at: 12.14 }, { t: 'TAKING', at: 12.24 }], end: 12.52 },
  { words: [{ t: 'OVER.', at: 12.62 }], end: 12.84 },
  { words: [{ t: 'SOMEONE', at: 13.2 }, { t: 'ELSE', at: 13.68 }, { t: 'CAN', at: 13.92 }], end: 14.08 },
  { words: [{ t: 'REBUILD', at: 14.14 }, { t: 'THAT', at: 14.68 }, { t: 'SIX', at: 15.0 }], end: 15.26 },
  { words: [{ t: 'MONTHS', at: 15.32 }, { t: 'FROM', at: 15.62 }, { t: 'NOW', at: 15.85 }], end: 16.05 },
  { words: [{ t: 'FOR', at: 16.18 }, { t: 'ALMOST', at: 16.62 }, { t: 'FREE.', at: 17.09 }], end: 17.37 },
  { words: [{ t: 'SO', at: 17.79 }, { t: 'IF', at: 18.25 }, { t: 'THE', at: 18.35 }], end: 18.45 },
  { words: [{ t: 'THING', at: 18.47 }, { t: 'THAT', at: 18.67 }, { t: 'YOU', at: 18.83 }], end: 18.99 },
  { words: [{ t: 'SELL', at: 19.05 }, { t: 'IS', at: 19.37 }, { t: 'BUILDING', at: 19.59 }], end: 20.01 },
  { words: [{ t: 'YOU', at: 20.43 }, { t: 'KIND', at: 20.69 }, { t: 'OF', at: 20.99 }], end: 21.05 },
  { words: [{ t: 'HAVE', at: 21.11 }, { t: 'A', at: 21.27 }, { t: 'PROBLEM.', at: 21.33 }], end: 21.67 },
  { words: [{ t: 'SO', at: 21.99 }, { t: 'HERE', at: 22.23 }, { t: 'ARE', at: 22.57 }], end: 22.67 },
  { words: [{ t: 'FIVE', at: 22.79 }, { t: 'WAYS', at: 23.15 }, { t: 'TO', at: 23.43 }], end: 23.55 },
  { words: [{ t: 'ACTUALLY', at: 23.73 }, { t: 'MAKE', at: 24.11 }, { t: 'MONEY', at: 24.35 }], end: 24.57 },
  { words: [{ t: 'WITH', at: 24.63 }, { t: 'AI', at: 24.87 }, { t: 'THAT', at: 25.35 }], end: 25.49 },
  { words: [{ t: "DON'T", at: 25.57 }, { t: 'HAVE', at: 25.85 }, { t: 'THAT', at: 26.03 }], end: 26.15 },
  { words: [{ t: 'PROBLEM.', at: 26.19 }], end: 26.57 },
  { words: [{ t: 'BECAUSE', at: 27.0 }, { t: 'WHEN', at: 27.55 }, { t: 'AI', at: 27.88 }], end: 28.18 },
  { words: [{ t: 'GETS', at: 28.24 }, { t: 'BETTER', at: 28.56 }, { t: 'THESE', at: 29.4 }], end: 29.66 },
  { words: [{ t: 'DO', at: 29.7 }, { t: 'NOT', at: 29.88 }, { t: 'GET', at: 30.1 }], end: 30.24 },
  { words: [{ t: 'CHEAPER.', at: 30.3 }], end: 30.7 },
  { words: [{ t: 'THEY', at: 31.16 }, { t: 'ACTUALLY', at: 31.5 }, { t: 'START', at: 31.92 }], end: 32.14 },
  { words: [{ t: 'TO', at: 32.16 }, { t: 'PAY', at: 32.3 }, { t: 'MORE.', at: 32.72 }], end: 33.02 },
  { words: [{ t: 'I', at: 33.72 }, { t: 'RANK', at: 33.9 }, { t: 'THEM', at: 34.16 }], end: 34.32 },
  { words: [{ t: 'BY', at: 34.38 }, { t: 'HOW', at: 34.66 }, { t: 'LONG', at: 34.92 }], end: 35.12 },
  { words: [{ t: 'THE', at: 35.16 }, { t: 'MONEY', at: 35.32 }, { t: 'KEEPS', at: 35.62 }], end: 35.84 },
  { words: [{ t: 'COMING.', at: 35.88 }], end: 36.18 },
  { words: [{ t: 'SO', at: 36.64 }, { t: 'THAT', at: 37.0 }, { t: 'MEANS', at: 37.26 }], end: 37.5 },
  { words: [{ t: 'THAT', at: 37.56 }, { t: 'NUMBER', at: 37.82 }, { t: 'ONE', at: 38.28 }], end: 38.41 },
  { words: [{ t: 'PAYS', at: 38.59 }, { t: 'YOU', at: 38.8 }, { t: 'THIS', at: 38.97 }], end: 39.16 },
  { words: [{ t: 'WEEK', at: 39.23 }, { t: 'BUT', at: 39.79 }, { t: 'NUMBER', at: 40.07 }], end: 40.35 },
  { words: [{ t: 'FIVE', at: 40.43 }, { t: 'CAN', at: 40.75 }, { t: 'STILL', at: 40.97 }], end: 41.25 },
  { words: [{ t: 'BE', at: 41.31 }, { t: 'PAYING', at: 41.47 }, { t: 'YOU', at: 41.81 }], end: 41.95 },
  { words: [{ t: 'FIVE', at: 42.07 }, { t: 'YEARS', at: 42.41 }, { t: 'FROM', at: 42.69 }], end: 42.85 },
  { words: [{ t: 'NOW.', at: 42.91 }], end: 43.09 },
  { words: [{ t: '2031.', at: 43.53 }], end: 43.73 },
  { words: [{ t: 'I', at: 44.01 }, { t: 'HAVE', at: 44.11 }, { t: 'BUILT', at: 44.29 }], end: 44.57 },
  { words: [{ t: 'AT', at: 44.61 }, { t: 'EVERY', at: 44.93 }, { t: 'STAGE', at: 45.25 }], end: 45.59 },
  { words: [{ t: 'FROM', at: 45.73 }, { t: 'HAND', at: 46.27 }, { t: 'CODING', at: 46.59 }], end: 46.97 },
  { words: [{ t: 'TO', at: 47.05 }, { t: 'A', at: 47.23 }, { t: 'BUSINESS', at: 47.41 }], end: 47.75 },
  { words: [{ t: 'THAT', at: 47.79 }, { t: 'CURRENTLY', at: 47.99 }, { t: 'RUNS', at: 48.47 }], end: 48.75 },
  { words: [{ t: 'COMPLETELY', at: 48.91 }, { t: 'ON', at: 49.45 }, { t: 'CLAUDE.', at: 49.57 }], end: 49.89 },
  { words: [{ t: 'AND', at: 50.37 }, { t: 'STILL', at: 50.81 }, { t: 'NO', at: 51.85 }], end: 52.05 },
  { words: [{ t: 'CLIENT', at: 52.17 }, { t: 'HAS', at: 52.63 }, { t: 'EVER', at: 53.02 }], end: 53.22 },
  { words: [{ t: 'PAID', at: 53.27 }, { t: 'ME', at: 53.55 }, { t: 'BECAUSE', at: 54.1 }], end: 54.38 },
  { words: [{ t: 'MY', at: 54.42 }, { t: 'CODE', at: 54.64 }, { t: 'WAS', at: 54.98 }], end: 55.12 },
  { words: [{ t: 'SO', at: 55.28 }, { t: 'GOOD.', at: 55.58 }], end: 55.82 },
  { words: [{ t: 'THEY', at: 56.32 }, { t: 'ACTUALLY', at: 56.64 }, { t: 'PAID', at: 57.04 }], end: 57.28 },
  { words: [{ t: 'ME', at: 57.34 }, { t: 'BECAUSE', at: 57.54 }, { t: 'I', at: 57.9 }], end: 57.98 },
  { words: [{ t: 'SAT', at: 58.04 }, { t: 'DOWN', at: 58.3 }, { t: 'WITH', at: 58.56 }], end: 58.7 },
  { words: [{ t: 'THEM.', at: 58.74 }], end: 58.9 },
  { words: [{ t: 'I', at: 59.14 }, { t: 'UNDERSTOOD', at: 59.34 }, { t: 'THEIR', at: 59.74 }], end: 59.88 },
  { words: [{ t: 'BUSINESS.', at: 59.94 }], end: 60.34 },
  { words: [{ t: 'AND', at: 60.78 }, { t: 'BECAUSE', at: 61.0 }, { t: 'I', at: 61.36 }], end: 61.42 },
  { words: [{ t: 'REALLY', at: 61.5 }, { t: 'UNDERSTOOD', at: 61.88 }, { t: 'THEIR', at: 62.34 }], end: 62.5 },
  { words: [{ t: 'PROBLEMS', at: 62.56 }, { t: 'THEY', at: 63.52 }, { t: 'ACTUALLY', at: 63.86 }], end: 64.16 },
  { words: [{ t: 'TRUSTED', at: 64.24 }, { t: 'ME', at: 64.76 }, { t: 'TO', at: 65.2 }], end: 65.32 },
  { words: [{ t: 'FIX', at: 65.42 }, { t: 'IT.', at: 65.74 }], end: 65.82 },
  { words: [{ t: 'AND', at: 66.2 }, { t: 'OBVIOUSLY', at: 66.52 }, { t: 'YES', at: 67.02 }], end: 67.3 },
  { words: [{ t: 'THE', at: 67.4 }, { t: 'CODE', at: 67.56 }, { t: 'WAS', at: 67.84 }], end: 67.98 },
  { words: [{ t: 'IMPORTANT.', at: 68.04 }], end: 68.53 },
  { words: [{ t: 'BUT', at: 69.03 }, { t: 'THAT', at: 69.19 }, { t: 'WAS', at: 69.36 }], end: 69.5 },
  { words: [{ t: 'ALMOST', at: 69.64 }, { t: 'MORE', at: 70.01 }, { t: 'LIKE', at: 70.23 }], end: 70.39 },
  { words: [{ t: 'A', at: 70.45 }, { t: 'SIDE', at: 70.61 }, { t: 'EFFECT.', at: 70.91 }], end: 71.27 },
  { words: [{ t: 'SO', at: 71.61 }, { t: 'FOR', at: 71.83 }, { t: 'EVERY', at: 72.19 }], end: 72.47 },
  { words: [{ t: 'WAY', at: 72.57 }, { t: 'YOU', at: 72.83 }, { t: 'GET', at: 72.99 }], end: 73.09 },
  { words: [{ t: 'FOUR', at: 73.21 }, { t: 'THINGS.', at: 73.53 }], end: 73.81 },
  { words: [{ t: 'WHAT', at: 74.37 }, { t: 'YOU', at: 74.59 }, { t: 'SAY', at: 74.79 }], end: 74.99 },
  { words: [{ t: 'TO', at: 75.05 }, { t: 'SELL', at: 75.23 }, { t: 'IT', at: 75.53 }], end: 75.63 },
  { words: [{ t: 'WHO', at: 76.03 }, { t: 'YOU', at: 76.25 }, { t: 'CALL', at: 76.43 }], end: 76.65 },
  { words: [{ t: 'FIRST', at: 76.73 }, { t: 'WHAT', at: 77.75 }, { t: 'TO', at: 77.97 }], end: 78.07 },
  { words: [{ t: 'CHARGE', at: 78.15 }, { t: 'AND', at: 79.03 }, { t: 'WHAT', at: 79.27 }], end: 79.43 },
  { words: [{ t: 'YOUR', at: 79.47 }, { t: 'MONDAY', at: 79.69 }, { t: 'ACTUALLY', at: 80.17 }], end: 80.51 },
  { words: [{ t: 'LOOKS', at: 80.55 }, { t: 'LIKE.', at: 80.79 }], end: 80.97 },
  { words: [{ t: 'BUT', at: 81.29 }, { t: 'ONE', at: 81.91 }, { t: 'WARNING.', at: 82.31 }], end: 82.77 },
  { words: [{ t: 'EVERY', at: 83.31 }, { t: 'STEP', at: 83.66 }, { t: 'THE', at: 84.82 }], end: 84.94 },
  { words: [{ t: 'MONEY', at: 85.06 }, { t: 'LASTS', at: 85.4 }, { t: 'LONGER.', at: 86.02 }], end: 86.4 },
  { words: [{ t: 'BUT', at: 87.02 }, { t: 'IT', at: 87.18 }, { t: 'ALSO', at: 87.3 }], end: 87.54 },
  { words: [{ t: 'ASKS', at: 87.74 }, { t: 'MORE', at: 88.1 }, { t: 'OF', at: 88.38 }], end: 88.44 },
  { words: [{ t: 'YOU.', at: 88.48 }], end: 88.64 },
  { words: [{ t: 'AND', at: 89.04 }, { t: 'NUMBER', at: 89.38 }, { t: 'FIVE', at: 89.74 }], end: 90.04 },
  { words: [{ t: 'ASKS', at: 90.28 }, { t: 'FOR', at: 90.52 }, { t: 'THE', at: 90.68 }], end: 90.74 },
  { words: [{ t: 'ONE', at: 90.94 }, { t: 'THING', at: 91.1 }, { t: 'MOST', at: 91.78 }], end: 92.04 },
  { words: [{ t: 'OF', at: 92.08 }, { t: 'YOU', at: 92.18 }, { t: 'ARE', at: 92.46 }], end: 92.54 },
  { words: [{ t: 'PROBABLY', at: 92.7 }, { t: 'NOT', at: 93.34 }, { t: 'WILLING', at: 93.6 }], end: 93.82 },
  { words: [{ t: 'TO', at: 93.86 }, { t: 'GIVE', at: 93.96 }, { t: 'UP.', at: 94.2 }], end: 94.28 },
  { words: [{ t: 'SO', at: 94.76 }, { t: "LET'S", at: 95.14 }, { t: 'START', at: 95.42 }], end: 95.75 },
  { words: [{ t: 'WHERE', at: 95.83 }, { t: 'THE', at: 96.0 }, { t: 'MONEY', at: 96.14 }], end: 96.39 },
  { words: [{ t: 'IS', at: 96.44 }, { t: 'FASTEST.', at: 96.62 }], end: 97.13 },
  { words: [{ t: 'WAY', at: 97.47 }, { t: 'ONE', at: 97.93 }, { t: 'SELL', at: 98.43 }], end: 98.73 },
  { words: [{ t: 'THE', at: 98.77 }, { t: 'DIAGNOSIS', at: 98.95 }, { t: 'NOT', at: 100.15 }], end: 100.37 },
  { words: [{ t: 'THE', at: 100.49 }, { t: 'BUILD.', at: 100.65 }], end: 100.93 },
  { words: [{ t: 'BUSINESSES', at: 101.35 }, { t: 'DO', at: 101.93 }, { t: 'NOT', at: 102.13 }], end: 102.31 },
  { words: [{ t: 'NEED', at: 102.43 }, { t: 'BUILDERS', at: 102.71 }, { t: 'ANYMORE', at: 103.11 }], end: 103.45 },
  { words: [{ t: 'BECAUSE', at: 103.89 }, { t: 'AI', at: 104.51 }, { t: 'BUILDS.', at: 104.81 }], end: 105.09 },
  { words: [{ t: 'WHAT', at: 105.61 }, { t: 'THEY', at: 105.87 }, { t: 'NEED', at: 106.15 }], end: 106.35 },
  { words: [{ t: 'IS', at: 106.41 }, { t: 'SOMEONE', at: 106.55 }, { t: 'WHO', at: 106.97 }], end: 107.11 },
  { words: [{ t: 'TELLS', at: 107.17 }, { t: 'THEM', at: 107.49 }, { t: 'WHAT', at: 108.15 }], end: 108.36 },
  { words: [{ t: 'SHOULD', at: 108.81 }, { t: 'BE', at: 109.06 }, { t: 'FIXED.', at: 109.19 }], end: 109.47 },
  { words: [{ t: 'WHAT', at: 109.81 }, { t: 'THEY', at: 110.02 }, { t: 'NEED', at: 110.28 }], end: 110.5 },
  { words: [{ t: 'IS', at: 110.58 }, { t: 'SOMEONE', at: 110.7 }, { t: 'WHO', at: 111.08 }], end: 111.22 },
  { words: [{ t: 'TELLS', at: 111.3 }, { t: 'THEM', at: 111.64 }, { t: 'WHAT', at: 111.96 }], end: 112.14 },
  { words: [{ t: 'TO', at: 112.18 }, { t: 'BUILD.', at: 112.32 }], end: 112.56 },
  { words: [{ t: 'EVERY', at: 112.9 }, { t: 'BUSINESS', at: 113.24 }, { t: 'OWNER', at: 113.7 }], end: 113.92 },
  { words: [{ t: 'KNOWS', at: 113.96 }, { t: 'THEY', at: 114.38 }, { t: 'SHOULD', at: 114.64 }], end: 114.84 },
  { words: [{ t: 'DO', at: 114.88 }, { t: 'SOMETHING', at: 115.08 }, { t: 'WITH', at: 115.6 }], end: 115.8 },
  { words: [{ t: 'AI.', at: 115.88 }], end: 116.2 },
  { words: [{ t: 'BUT', at: 116.52 }, { t: 'ALMOST', at: 116.82 }, { t: 'NOBODY', at: 117.22 }], end: 117.66 },
  { words: [{ t: 'KNOWS', at: 117.72 }, { t: 'WHERE', at: 118.12 }, { t: 'TO', at: 118.36 }], end: 118.44 },
  { words: [{ t: 'ACTUALLY', at: 118.58 }, { t: 'START.', at: 118.94 }], end: 119.3 },
  { words: [{ t: 'AND', at: 119.76 }, { t: 'THAT', at: 119.96 }, { t: 'ANSWER', at: 120.28 }], end: 120.62 },
  { words: [{ t: 'IS', at: 121.66 }, { t: 'WORTH', at: 121.84 }, { t: 'REAL', at: 122.32 }, { t: 'MONEY.', at: 122.82 }], end: 123.2 },
];

/* ================================================================== */
export const FiveWaysEdit: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  // NO constant micro-drift — it made elements feel unglued / jitter. The camera only moves on keyframed moves.
  const c = cam(frame);
  const worldStyle: React.CSSProperties = {
    position: "absolute", left: 0, top: 0, width: 0, height: 0,
    transform: `translate(${W / 2 - c.x * c.z}px, ${H / 2 - c.y * c.z}px) scale(${c.z})`,
    transformOrigin: "0 0",
  };
  const gridPos = `${W / 2 - c.x * c.z}px ${H / 2 - c.y * c.z}px`;

  const mv = moveState(frame);
  const spk = spkAt(frame);
  const fsCard = interpolate(spk.w, [0.62, 0.96], [0, 1], clamp); // 0 = card, 1 = full-screen (outro)
  const asp = spkAsp(frame); // 0 = landscape 16:9, 1 = portrait 9:16
  const spkW = spk.w * W;
  const spkH = spkW * (0.5625 + asp * (1.7778 - 0.5625)); // grow tall for portrait
  const spkRadius = W * 0.010;
  const hookBlur = interpolate(frame, [0, f(0.7)], [10, 0], { ...clamp, easing: Easing.out(Easing.quad) });
  const hookScale = interpolate(frame, [0, f(2.2)], [1.09, 1], { ...clamp, easing: Easing.bezier(0.3, 0, 0.4, 1) });
  const frameDraw = interpolate(frame, [f(0.3), f(1.4)], [0, 1], { ...clamp, easing: Easing.bezier(0.5, 0, 0.2, 1) });
  const titleIn = interpolate(frame, [f(0.4), f(0.95)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const titleOut = interpolate(frame, [f(3.9), f(4.5)], [1, 0], clamp);
  const titleP = titleIn * titleOut;
  const trustOn = frame >= f(56.79) && frame <= f(66.16);
  // register color switch — the crash + the "why they paid" beat drop to a DARK canvas
  const darkReg = Math.max(
    interpolate(frame, [f(17.3), f(17.96), f(21.44), f(22.02)], [0, 1, 1, 0], clamp),
    interpolate(frame, [f(43.51), f(44.39), f(55.39), f(56.19)], [0, 1, 1, 0], clamp),
  );

  // each way gets its own immersive colored canvas; crossfade at the section transitions
  const tealReg = interpolate(frame, [f(89.88), f(90.87), f(235.46), f(237.44)], [0, 1, 1, 0], clamp); // Way 1
  const redReg = interpolate(frame, [f(235.46), f(237.44), f(352.44), f(354.44)], [0, 1, 1, 0], clamp); // Way 2
  const ambReg = interpolate(frame, [f(352.44), f(354.44), f(456.31), f(458.3)], [0, 1, 1, 0], clamp);  // Way 3
  const indReg = interpolate(frame, [f(456.31), f(458.3), f(563.7), f(565.77)], [0, 1, 1, 0], clamp);  // Way 4
  const vioReg = interpolate(frame, [f(563.7), f(565.77)], [0, 1], clamp);                            // Way 5 + landing
  const anyEnv = Math.max(darkReg, tealReg, redReg, ambReg, indReg, vioReg);
  const MASK = "radial-gradient(ellipse 82% 76% at 50% 44%, #000 0%, rgba(0,0,0,.35) 62%, transparent 92%)";

  return (
    <AbsoluteFill style={{ background: SILVER_BG, fontFamily: SANS }}>
      {/* colored register overlays */}
      <AbsoluteFill style={{ background: RAISIN, opacity: darkReg }} />
      <AbsoluteFill style={{ background: TEAL, opacity: tealReg }} />
      <AbsoluteFill style={{ background: RED_ENV, opacity: redReg }} />
      <AbsoluteFill style={{ background: AMB_ENV, opacity: ambReg }} />
      <AbsoluteFill style={{ background: IND_ENV, opacity: indReg }} />
      <AbsoluteFill style={{ background: VIO_ENV, opacity: vioReg }} />
      <AbsoluteFill style={{ backgroundImage: `url("${GRID_URI}")`, backgroundSize: `${76 * c.z}px`, backgroundPosition: gridPos, opacity: 1 - anyEnv, maskImage: MASK, WebkitMaskImage: MASK }} />
      <AbsoluteFill style={{ backgroundImage: `url("${GRID_DARK_URI}")`, backgroundSize: `${76 * c.z}px`, backgroundPosition: gridPos, opacity: anyEnv, maskImage: MASK, WebkitMaskImage: MASK }} />

      <div style={worldStyle}>
        <SceneBuilding />
        <SceneHalfLife />
        <Sc a={16.22} b={23.12}><SceneProblem /></Sc>
        <SceneLadder />
        <Sc a={42.42} b={57.39}><SceneAuthority /></Sc>
        <SceneBoard />
        <Sc a={90.06} b={96.86}><SceneWay1Title /></Sc>
        <Sc a={96.46} b={107.43}><SceneWay1Need /></Sc>
        <Sc a={106.46} b={118.1}><SceneWayOne /></Sc>
        <Sc a={117.89} b={127.89}><SceneOffer1 /></Sc>
        <Sc a={128.09} b={175.84}><SceneNotebook /></Sc>
        <Sc a={175.42} b={199.22}><SceneReceipt1 /></Sc>
        <Sc a={198.83} b={212.24}><ScenePrice1 /></Sc>
        <Sc a={211.65} b={236.46}><SceneMonday1 /></Sc>
        {/* ---- Way 2 (rescue) ---- */}
        <Sc a={236.85} b={248.86}><SceneW2Stat /></Sc>
        <Sc a={248.45} b={264.93}><SceneW2Why /></Sc>
        <Sc a={264.43} b={278.36}><SceneW2Market /></Sc>
        <Sc a={277.86} b={288.26}><SceneW2Offer /></Sc>
        <Sc a={287.66} b={310.64}><SceneW2Who /></Sc>
        <Sc a={310.05} b={317.15}><SceneW2TwoX /></Sc>
        <Sc a={316.65} b={324.85}><SceneW2Price /></Sc>
        <Sc a={324.25} b={345.64}><SceneW2Monday /></Sc>
        {/* ---- Way 3 (niche) ---- */}
        <Sc a={353.84} b={366.41}><SceneW3Stat /></Sc>
        <Sc a={365.93} b={377.83}><SceneW3Niches /></Sc>
        <Sc a={377.33} b={386.3}><SceneW3One /></Sc>
        <Sc a={385.79} b={413.19}><SceneW3Moat /></Sc>
        <Sc a={412.69} b={432.91}><SceneW3Build /></Sc>
        <Sc a={432.42} b={443.93}><SceneW3Monday /></Sc>
        <Sc a={443.42} b={456.31}><SceneW3Handoff /></Sc>
        {/* ---- Way 4 (memory) ---- */}
        <Sc a={457.81} b={470.65}><SceneW4Ban /></Sc>
        <Sc a={470.21} b={496.35}><SceneW4Model /></Sc>
        <Sc a={495.89} b={513.26}><SceneW4Scatter /></Sc>
        <Sc a={512.77} b={526.59}><SceneW4Upgrade /></Sc>
        <Sc a={526.1} b={537.9}><SceneW4Offer /></Sc>
        <Sc a={537.4} b={549.6}><SceneW4Price /></Sc>
        <Sc a={549.11} b={564.77}><SceneW4Monday /></Sc>
        {/* ---- Way 5 (equity) + landing ---- */}
        <Sc a={564.37} b={575.41}><SceneW5Title /></Sc>
        <Sc a={574.91} b={584.91}><SceneW5Invoice /></Sc>
        <Sc a={584.41} b={603.05}><SceneW5Compound /></Sc>
        <Sc a={602.24} b={624.79}><SceneW5Investors /></Sc>
        <Sc a={624.27} b={652.53}><SceneW5TwoPrices /></Sc>
        {/* outro is now a FULL-SCREEN speaker moment with overlays (OutroOverlay), not a canvas station */}
      </div>

      {/* TRANSITION COMET — a lime accent that travels across the screen in the camera's
          direction during a station move. Transient (only while moving), so it links one
          idea to the next without leaving a persistent trail. */}
      {mv.active && (() => {
        const L = Math.hypot(mv.dx, mv.dy) || 1;
        const ux = mv.dx / L, uy = mv.dy / L;
        const span = Math.max(W, H) * 1.5;
        const hx = W / 2 - ux * span / 2 + ux * span * mv.t;
        const hy = H / 2 - uy * span / 2 + uy * span * mv.t;
        const op = interpolate(mv.t, [0, 0.18, 0.8, 1], [0, 1, 1, 0], clamp);
        const ang = (Math.atan2(uy, ux) * 180) / Math.PI;
        const tail = W * 0.22;
        return (
          <div style={{ position: "absolute", left: hx, top: hy, transform: `translate(-50%, -50%) rotate(${ang}deg)`, opacity: op * 0.85, pointerEvents: "none" }}>
            <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", width: tail, height: 5, borderRadius: 3, background: `linear-gradient(90deg, rgba(207,255,5,0) 0%, ${LIME} 100%)` }} />
            <div style={{ position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, borderRadius: "50%", background: LIME, boxShadow: `0 0 26px 7px rgba(207,255,5,0.55)` }} />
          </div>
        );
      })()}

      {/* SPEAKER CARD — lime outline is a clean border on the exact edge (thins toward full-screen) */}
      <div style={{
        position: "absolute", left: spk.x * W - spkW / 2, top: spk.y * H - spkH / 2, width: spkW, height: spkH,
        borderRadius: spkRadius * (1 - fsCard * 0.7), overflow: "hidden", transform: `rotate(${spk.r}deg)`,
        border: `${Math.max(4, W * 0.0028) * (1 - fsCard * 0.55)}px solid ${LIME}`, boxSizing: "border-box",
        boxShadow: `0 ${W * 0.006}px ${W * 0.02}px rgba(15,18,26,${0.32 * (1 - fsCard)})`,
      }}>
        <OffthreadVideo src={staticFile("fiveways/source.mp4")} style={{
          width: "100%", height: "100%", objectFit: "cover",
          transform: `scale(${frame < f(3.0) ? hookScale : 1})`,
          filter: `contrast(1.06) saturate(1.07)${hookBlur > 0.1 && frame < f(1.0) ? ` blur(${hookBlur}px)` : ""}`,
        }} />
        {frame < f(4.7) && (
          <>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "46%", background: "linear-gradient(to top, rgba(15,18,26,0.68), transparent)", opacity: titleP }} />
            <div style={{ position: "absolute", left: "5.4%", bottom: "10%", opacity: titleP, transform: `translateY(${(1 - titleIn) * W * 0.008}px)` }}>
              <div style={{ fontFamily: MONO, fontSize: W * 0.011, fontWeight: 700, letterSpacing: "0.26em", color: "rgba(255,255,255,0.72)", display: "flex", alignItems: "center", gap: W * 0.006 }}>
                <span style={{ width: W * 0.006, height: W * 0.006, background: LIME, display: "inline-block" }} />
                THE 5-YEAR PROBLEM
              </div>
              <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: W * 0.038, color: "#fff", marginTop: W * 0.006, lineHeight: 1.02 }}>
                stop learning to <span style={{ color: LIME }}>build</span>
              </div>
            </div>
          </>
        )}
      </div>

      {trustOn && <TrustOverlay />}
      {frame >= f(652.2) && <OutroOverlay />}

      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 80% 72% at 50% 46%, transparent 60%, rgba(15,18,26,0.10) 100%)" }} />

      {/* music bed — "Particle Emission" (Silver Maple), loops to cover the whole video, ducked well under the voice */}
      <Audio src={staticFile("fiveways/music.mp3")} volume={0.25} loop />

      {/* INFO-VIDEO SFX (Epidemic Sound) — subtle + sparse. Soft swish on transitions, a warm
          mallet note on positive reveals, a soft pop for quiet accents, a tick when items land.
          All sit UNDER the voice — no cinematic booms. es_swish · es_note · es_pop · es_tick */}
      {/* intro */}
      <Cue at={11.4} s="es_swish" v={0.24} d={40} />                {/* AI scan sweep */}
      <Cue at={16.8} s="es_pop" v={0.2} d={16} />                   {/* value → €0 */}
      <Cue at={20.1} s="es_pop" v={0.24} d={16} />                  {/* the crash */}
      <Cue at={22.0} s="es_swish" v={0.26} d={40} />               {/* pull back to the ladder */}
      <Cue at={26.9} s="es_swish" v={0.15} d={40} />               {/* ladder starts building */}
      <Cue at={31.4} s="es_note" v={0.3} d={45} />                 {/* "they pay MORE" */}
      <Cue at={36.4} s="es_tick" v={0.18} d={8} />                 {/* 01 · THIS WEEK */}
      <Cue at={39.4} s="es_note" v={0.32} d={45} />                {/* 05 · 2031 */}
      <Cue at={41.7} s="es_swish" v={0.24} d={40} />               {/* → authority */}
      <Cue at={89.6} s="es_swish" v={0.28} d={45} />               {/* dive into Way 1 */}
      <Cue at={90.6} s="es_note" v={0.28} d={45} />                {/* "the diagnosis" */}
      {/* Way 1 */}
      <Cue at={127.8} s="es_swish" v={0.2} d={40} />               {/* into the notebook */}
      <Cue at={175.2} s="es_swish" v={0.2} d={40} />               {/* → receipt */}
      <Cue at={203.5} s="es_note" v={0.3} d={45} />                {/* €3,000 */}
      <Cue at={211.4} s="es_swish" v={0.2} d={40} />               {/* → Monday */}
      {/* Way 2 */}
      <Cue at={236.6} s="es_swish" v={0.26} d={45} />              {/* into Way 2 */}
      <Cue at={242.0} s="es_note" v={0.3} d={45} />                {/* 95% */}
      <Cue at={287.4} s="es_swish" v={0.2} d={40} />               {/* → who to call */}
      <Cue at={316.5} s="es_note" v={0.28} d={45} />               {/* €2–5K */}
      {/* Way 3 */}
      <Cue at={353.6} s="es_swish" v={0.26} d={45} />              {/* into Way 3 */}
      <Cue at={369.0} s="es_note" v={0.3} d={45} />                {/* 10× bigger */}
      <Cue at={385.6} s="es_swish" v={0.2} d={40} />               {/* → the moat */}
      {/* Way 4 */}
      <Cue at={457.6} s="es_swish" v={0.26} d={45} />              {/* into Way 4 */}
      <Cue at={461.0} s="es_pop" v={0.22} d={16} />                {/* the "GONE" ban stamp */}
      <Cue at={539.3} s="es_note" v={0.28} d={45} />               {/* €5K + €1.5K/mo */}
      {/* Way 5 */}
      <Cue at={564.2} s="es_swish" v={0.26} d={45} />              {/* into Way 5 */}
      <Cue at={604.0} s="es_note" v={0.3} d={45} />                {/* $3B+ */}
      {/* outro */}
      <Cue at={652.6} s="es_swish" v={0.26} d={45} />              {/* push to full-screen */}
      <Cue at={656.9} s="es_note" v={0.3} d={45} />                {/* "they sell knowing" */}
      <Cue at={663.0} s="es_pop" v={0.22} d={16} />                {/* comment CTA */}
    </AbsoluteFill>
  );
};

const Cue: React.FC<{ at: number; s: string; v: number; d?: number }> = ({ at, s, v, d = 40 }) => (
  <Sequence from={f(at)} durationInFrames={d}><Audio src={staticFile(`vedit/sfx/${s}.wav`)} volume={v} /></Sequence>
);

// Scene gate with a slide-off fade — instead of hard-cutting a scene the instant its window
// ends (which makes the trailing edge vanish mid-slide), it fades out over the last ~1s while
// the camera is already panning away, so it reads as sliding + fading off, not disappearing.
const Sc: React.FC<{ a: number; b: number; children: React.ReactNode }> = ({ a, b, children }) => {
  const frame = useCurrentFrame();
  const start = f(a), end = f(b);
  if (frame < start || frame > end) return null;
  const op = interpolate(frame, [end - 24, end], [1, 0], clamp);
  return <div style={{ opacity: op }}>{children}</div>;
};
const St: React.FC<{ cx: number; cy: number; rot?: number; children: React.ReactNode }> = ({ cx, cy, rot = 0, children }) => (
  <div style={{ position: "absolute", left: cx, top: cy, transform: `translate(-50%, -50%) rotate(${rot}deg)` }}>{children}</div>
);
// Eyebrow labels removed — a mono-caps category header on every scene read as template/AI
// chrome ("as an editor I would never put it like that"). The speaker, the colored environment,
// and the central visual carry each beat now. Kept as a null component so every call site still
// compiles; meaningful on-screen text lives inside the scenes themselves, tied to what's said.
const Kicker: React.FC<{ p: number; light?: boolean; children: React.ReactNode }> = () => null;

/* ================= ICON PRIMITIVES (simple, 2-tone) ================= */
const Browser: React.FC<{ s?: number }> = ({ s = 1 }) => (
  <svg width={220 * s} height={170 * s} viewBox="0 0 220 170">
    <rect x="4" y="4" width="212" height="162" rx="14" fill="#fff" stroke={RAISIN} strokeWidth="5" />
    <path d="M4 44 H216" stroke={RAISIN} strokeWidth="5" />
    <circle cx="26" cy="24" r="6" fill={RAISIN} /><circle cx="48" cy="24" r="6" fill={RAISIN} /><circle cx="70" cy="24" r="6" fill={RAISIN} />
    <rect x="26" y="66" width="120" height="14" rx="7" fill={SILVER_SOFT} />
    <rect x="26" y="96" width="168" height="12" rx="6" fill={SILVER_SOFT} />
    <rect x="26" y="122" width="90" height="12" rx="6" fill={LIME} />
  </svg>
);
const Gear: React.FC<{ s?: number }> = ({ s = 1 }) => (
  <svg width={200 * s} height={200 * s} viewBox="0 0 200 200">
    <g stroke={RAISIN} strokeWidth="5" fill="none">
      <circle cx="100" cy="100" r="46" />
      <circle cx="100" cy="100" r="18" fill={LIME} stroke="none" />
      {Array.from({ length: 8 }).map((_, i) => { const a = (i * Math.PI) / 4; return <line key={i} x1={100 + Math.cos(a) * 52} y1={100 + Math.sin(a) * 52} x2={100 + Math.cos(a) * 72} y2={100 + Math.sin(a) * 72} strokeLinecap="round" />; })}
    </g>
  </svg>
);
const PhoneApp: React.FC<{ s?: number }> = ({ s = 1 }) => (
  <svg width={130 * s} height={210 * s} viewBox="0 0 130 210">
    <rect x="6" y="6" width="118" height="198" rx="22" fill="#fff" stroke={RAISIN} strokeWidth="5" />
    <rect x="30" y="34" width="30" height="30" rx="8" fill={LIME} /><rect x="72" y="34" width="30" height="30" rx="8" fill={SILVER_SOFT} />
    <rect x="30" y="76" width="30" height="30" rx="8" fill={SILVER_SOFT} /><rect x="72" y="76" width="30" height="30" rx="8" fill={SILVER_SOFT} />
    <rect x="30" y="118" width="72" height="12" rx="6" fill={SILVER_SOFT} /><rect x="30" y="140" width="52" height="12" rx="6" fill={SILVER_SOFT} />
  </svg>
);
const CoinStack: React.FC<{ n: number; s?: number }> = ({ n, s = 1 }) => (
  <svg width={104 * s} height={(38 + n * 22) * s} viewBox={`0 0 104 ${38 + n * 22}`}>
    {Array.from({ length: n }).map((_, i) => {
      const y = 38 + n * 22 - 30 - i * 22;
      const lime = i === n - 1;
      return (
        <g key={i}>
          <ellipse cx="52" cy={y} rx="44" ry="16" fill={lime ? LIME : "#fff"} stroke={RAISIN} strokeWidth="4.5" />
          <line x1="34" y1={y} x2="70" y2={y} stroke={RAISIN} strokeWidth="3" opacity="0.45" />
        </g>
      );
    })}
  </svg>
);
const UpArrow: React.FC<{ p: number; s?: number }> = ({ p, s = 1 }) => (
  <svg width={120 * s} height={200 * s} viewBox="0 0 120 200"><path d={`M60 ${190 - p * 150} L60 190`} stroke={LIME} strokeWidth="11" strokeLinecap="round" /><path d={`M28 ${228 - p * 150} L60 ${196 - p * 150} L92 ${228 - p * 150}`} fill="none" stroke={LIME} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" opacity={p > 0.4 ? 1 : 0} /></svg>
);

/* ================= SCENE A: WHAT AI IS EATING ================= */
const SceneBuilding: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(7.0), 12);
  const items = [
    { at: f(7.42), el: <Browser s={1.5} />, label: "WEBSITES" },
    { at: f(8.3), el: <Gear s={1.5} />, label: "AUTOMATIONS" },
    { at: f(9.44), el: <PhoneApp s={1.5} />, label: "APPS" },
  ];
  // AI scan sweeps L→R starting ~11.8s; each item it passes gets "eaten" (shrinks + fades)
  const scan = interpolate(frame, [f(11.68), f(13.22)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <St cx={A.x} cy={A.y} rot={-0.8}>
      <div style={{ width: 1800, textAlign: "center" }}>
        <Kicker p={k}>FIG. 01 · WHAT AI IS EATING</Kicker>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 120, marginTop: 70, height: 380 }}>
          {items.map((it, i) => {
            const inP = useSpring(it.at, 18);
            const eaten = Math.max(0, Math.min(1, (scan - i * 0.28) * 2.4));
            return (
              <div key={i} style={{ transform: `translateY(${(1 - inP) * 40}px) scale(${(0.7 + 0.3 * inP) * (1 - eaten * 0.7)})`, opacity: inP * (1 - eaten), filter: eaten > 0.05 ? `blur(${eaten * 6}px)` : "none" }}>
                {it.el}
                <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.18em", color: BODY, marginTop: 22 }}>{it.label}</div>
              </div>
            );
          })}
        </div>
        {/* the AI scan bar sweeping across */}
        {scan > 0.01 && scan < 0.99 && (
          <div style={{ position: "absolute", left: `${scan * 100}%`, top: 90, width: 6, height: 380, background: LIME, boxShadow: `0 0 40px 10px rgba(207,255,5,0.5)` }} />
        )}
        <div style={{ marginTop: 30, opacity: scan }}>
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 52, color: BODY }}>AI just does all of this now.</span>
        </div>
      </div>
    </St>
  );
};

/* ================= SCENE B: VALUE COLLAPSES TO €0 ================= */
const SceneHalfLife: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(13.7), 12);
  const val = Math.round(interpolate(frame, [f(14.21), f(16.9)], [5000, 0], { ...clamp, easing: Easing.in(Easing.cubic) }) / 10) * 10;
  const barH = interpolate(frame, [f(14.21), f(16.9)], [1, 0.02], { ...clamp, easing: Easing.in(Easing.cubic) });
  const monthsPass = Math.round(interpolate(frame, [f(14.21), f(16.9)], [0, 6], { ...clamp }));
  return (
    <St cx={B.x} cy={B.y} rot={0.7}>
      <div style={{ width: 1500, textAlign: "center" }}>
        <Kicker p={k}>FIG. 02 · THE VALUE OF A BUILD</Kicker>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 90, marginTop: 60, height: 460 }}>
          {/* a deflating value bar */}
          <div style={{ width: 220, height: 440, background: "rgba(15,18,26,0.06)", borderRadius: 16, display: "flex", alignItems: "flex-end", overflow: "hidden", border: `1px solid ${SILVER_SOFT}` }}>
            <div style={{ width: "100%", height: `${barH * 100}%`, background: barH > 0.15 ? RAISIN : LIME, borderRadius: 12, transition: "none" }} />
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: MONO, fontSize: 30, color: BODY, letterSpacing: "0.1em" }}>{monthsPass} MONTHS LATER</div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 200, letterSpacing: "-0.04em", color: val < 200 ? RAISIN : RAISIN, lineHeight: 1, background: val < 200 ? LIME : "transparent", padding: val < 200 ? "0 20px" : 0, borderRadius: 14, display: "inline-block" }}>€{val.toLocaleString()}</div>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 46, color: BODY, marginTop: 14 }}>anyone can rebuild it for almost nothing.</div>
          </div>
        </div>
      </div>
    </St>
  );
};

/* ================= SCENE C: THE CRASH ================= */
const SceneProblem: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(17.86), 12);
  const draw = interpolate(frame, [f(18.06), f(19.86)], [0, 1], { ...clamp, easing: EASE });
  const crash = interpolate(frame, [f(19.86), f(20.85)], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const flash = interpolate(frame, [f(20.06), f(20.36), f(21.04)], [0, 0.5, 0], clamp);
  // graph line: flat-ish then a big drop (DARK register — light line on raisin)
  const pts = "M 60 260 L 260 240 L 460 250 L 640 230";
  const dropEndY = 230 + crash * 330;
  return (
    <St cx={C.x} cy={C.y} rot={-0.9}>
      <div style={{ width: 1300, textAlign: "center" }}>
        <Kicker p={k} light>FIG. 03 · IF YOU SELL BUILDING</Kicker>
        <svg width={900} height={660} viewBox="0 0 900 660" style={{ marginTop: 30 }}>
          <line x1="60" y1="600" x2="840" y2="600" stroke="rgba(233,236,237,0.25)" strokeWidth="4" />
          <line x1="60" y1="60" x2="60" y2="600" stroke="rgba(233,236,237,0.25)" strokeWidth="4" />
          <path d={pts} fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - draw)} />
          {crash > 0.01 && <path d={`M 640 230 L ${640 + crash * 150} ${dropEndY}`} fill="none" stroke={RED} strokeWidth="10" strokeLinecap="round" />}
          {crash > 0.5 && <circle cx={640 + crash * 150} cy={dropEndY} r="18" fill={RED} />}
          {crash > 0.5 && <text x={640 + crash * 150 + 40} y={dropEndY + 8} fontFamily={MONO} fontWeight="700" fontSize="34" fill={RED}>−90%</text>}
        </svg>
        <div style={{ marginTop: 6, opacity: crash }}>
          <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 66, color: "#fff" }}>your income falls <span style={{ color: RED }}>with it.</span></span>
        </div>
      </div>
    </St>
  );
};

/* ================= SCENE LADDER: 5 mystery cards rise into a "pays longer + more" staircase ===== */
const Lock: React.FC<{ c: string; s?: number }> = ({ c, s = 44 }) => (
  <svg width={s} height={s} viewBox="0 0 44 44"><rect x="9" y="19" width="26" height="18" rx="4" fill="none" stroke={c} strokeWidth="3.5" /><path d="M14 19 v-4 a8 8 0 0 1 16 0 v4" fill="none" stroke={c} strokeWidth="3.5" /><circle cx="22" cy="27" r="2.6" fill={c} /></svg>
);
const WAY_COLORS = ["#0E7C6B", "#C0392B", "#D69A2E", "#4256C6", "#8A46C0"]; // teal · red · amber · indigo · violet
const LAD_CARDS = [
  { n: "01", when: "THIS WEEK", h: 230 },
  { n: "02", when: "", h: 330 },
  { n: "03", when: "", h: 440 },
  { n: "04", when: "", h: 560 },
  { n: "05", when: "5 YEARS · 2031", h: 690 },
];
const SceneLadder: React.FC = () => {
  const frame = useCurrentFrame();
  const AXIS = 900, X0 = 150, CW = 268, GAP = 82; // staircase geometry
  const cx = (i: number) => X0 + i * (CW + GAP);
  // title → hook → rank crossfade in the top band
  const title = useIn(f(22.4), 12) * interpolate(frame, [f(25.9), f(26.9)], [1, 0], clamp);
  const hook = interpolate(frame, [f(28.0), f(29.0), f(32.2), f(33.0)], [0, 1, 1, 0], clamp); // "pay MORE, not cheaper"
  const rank = useIn(f(32.9), 14);                    // "ranked by how long the money keeps coming"
  const axis = useIn(f(33.4), 16);
  const w1 = useSpring(f(36.4), 16, 12);              // "01 pays THIS WEEK"
  const w5 = useSpring(f(39.4), 18, 11);              // "05 still paying in 2031"
  return (
    <St cx={LAD.x} cy={LAD.y}>
      <div style={{ position: "relative", width: 1900, height: 1050 }}>
        {/* TOP BAND — highlighted title + the 5-way colour preview (structure up front) */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 190, textAlign: "center", opacity: title }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 210, letterSpacing: "-0.03em", color: RAISIN, lineHeight: 1 }}>
            <span style={{ background: LIME, color: RAISIN, padding: "0 28px", borderRadius: 24 }}>5</span> WAYS
          </div>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 60, color: BODY, marginTop: 16 }}>to make money with AI</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 26, marginTop: 50 }}>
            {WAY_COLORS.map((col, i) => {
              const p = useIn(f(23.6) + i * 4, 10);
              return (
                <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 18}px)`, width: 132, height: 88, borderRadius: 16, background: col, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: MONO, fontWeight: 700, fontSize: 32, boxShadow: "0 14px 30px -12px rgba(15,18,26,0.45)" }}>0{i + 1}</div>
              );
            })}
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 60, display: "flex", justifyContent: "center", alignItems: "center", gap: 30, opacity: hook }}>
          <span style={{ fontFamily: MONO, fontSize: 36, letterSpacing: "0.08em", color: BODY }}>AI GETS BETTER</span>
          <svg width={72} height={72}><path d="M36 62 L36 16" stroke={LIME} strokeWidth="9" strokeLinecap="round" /><path d="M16 36 L36 14 L56 36" fill="none" stroke={LIME} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 56, color: RAISIN }}>they pay <span style={{ color: RAISIN, background: LIME, padding: "2px 18px", borderRadius: 10 }}>MORE</span></span>
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 46, color: DEAD, textDecoration: "line-through" }}>not cheaper</span>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 108, textAlign: "center", opacity: rank, fontFamily: SANS, fontWeight: 700, fontSize: 52, color: RAISIN }}>
          ranked by <span style={{ color: RAISIN, background: LIME, padding: "0 14px", borderRadius: 8 }}>how long the money keeps coming</span>
        </div>

        {/* STAIRCASE — the 5 colour-coded ways, each taller (pays more) and further right (lasts longer) */}
        {LAD_CARDS.map((c, i) => {
          const grow = useSpring(f(27.0) + i * f(0.95), 22, 14);
          const emph = i === 0 ? w1 : (i === 4 ? w5 : 0); // 01 + 05 get a lime highlight ring
          const h = c.h * grow;
          return (
            <div key={i} style={{ position: "absolute", left: cx(i), bottom: 1050 - AXIS, width: CW, height: h, opacity: grow, background: WAY_COLORS[i], borderRadius: 18, border: `4px solid ${emph > 0.35 ? LIME : "transparent"}`, boxSizing: "border-box", boxShadow: emph > 0.35 ? "0 0 44px rgba(207,255,5,0.4)" : "0 18px 40px -14px rgba(15,18,26,0.4)", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "26px 0" }}>
              <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 40, color: "#fff" }}>{c.n}</div>
              <Lock c="rgba(255,255,255,0.85)" s={46} />
              {/* coin stack — bigger reward for later ways */}
              <div style={{ display: "flex", flexDirection: "column-reverse", gap: 6, alignItems: "center" }}>
                {Array.from({ length: i + 1 }).map((_, ci) => (
                  <span key={ci} style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.92)", opacity: grow > (ci + 0.5) / (i + 1) ? 1 : 0 }} />
                ))}
              </div>
            </div>
          );
        })}

        {/* TIME AXIS — this week → 2031 */}
        <div style={{ position: "absolute", left: X0 - 40, right: 60, top: AXIS + 6, height: 4, background: SILVER_SOFT, opacity: axis }} />
        <div style={{ position: "absolute", left: cx(0), width: CW, top: AXIS + 26, textAlign: "center", opacity: w1, fontFamily: SANS, fontWeight: 700, fontSize: 34, color: RAISIN }}>{LAD_CARDS[0].when}</div>
        <div style={{ position: "absolute", left: cx(4) - 60, width: CW + 120, top: AXIS + 26, textAlign: "center", opacity: w5, transform: `scale(${0.9 + 0.1 * w5})`, fontFamily: SANS, fontWeight: 700, fontSize: 38, color: RAISIN }}>{LAD_CARDS[4].when}</div>
      </div>
    </St>
  );
};

/* ================= SCENE AUTHORITY (DARK, multi-beat): the journey, then code✗ → understanding ✓ ========= */
const SceneAuthority: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(43.93), 12);
  // beat 1: the journey — HAND CODING → CLAUDE (46–51)
  const handIn = useSpring(f(44.49), 18);
  const arrowP = interpolate(frame, [f(45.51), f(47.11)], [0, 1], { ...clamp, easing: EASE });
  const claudeIn = useSpring(f(46.92), 18);
  const journeyOut = interpolate(frame, [f(48.6), f(49.39)], [1, 0], clamp); // fade the journey out
  // beat 2: the verdict — CODE ✗ vs UNDERSTANDING ✓ (51.5–58)
  const codeIn = useSpring(f(49.79), 18);
  const strike = interpolate(frame, [f(51.9), f(52.99)], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const undIn = useSpring(f(53.61), 20, 11);
  const lineIn = useIn(f(54.39), 14);
  const W_ = "#E9ECED";
  return (
    <St cx={AU.x} cy={AU.y}>
      <div style={{ width: 1800, textAlign: "center", position: "relative", height: 760 }}>
        <Kicker p={k} light>FIG. 04 · WHY THEY ACTUALLY PAID</Kicker>

        {/* BEAT 1 — the journey */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 120, display: "flex", justifyContent: "center", alignItems: "center", gap: 70, opacity: journeyOut }}>
          <div style={{ opacity: handIn, transform: `translateY(${(1 - handIn) * 24}px)` }}>
            <svg width={180} height={150} viewBox="0 0 180 150"><rect x="12" y="30" width="156" height="90" rx="12" fill="none" stroke={W_} strokeWidth="7" /><path d="M40 60 L58 75 L40 90 M78 92 H120" stroke={LIME} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: "0.14em", color: W_, marginTop: 10 }}>HAND-CODING</div>
          </div>
          <svg width={180} height={50} style={{ opacity: arrowP }}><path d={`M6 25 L ${150 * arrowP} 25`} stroke={W_} strokeWidth="7" strokeLinecap="round" /><path d={`M ${138 * arrowP} 13 L ${158 * arrowP} 25 L ${138 * arrowP} 37`} fill="none" stroke={W_} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity={arrowP > 0.85 ? 1 : 0} /></svg>
          <div style={{ opacity: claudeIn, transform: `translateY(${(1 - claudeIn) * 24}px)`, display: "flex", alignItems: "center", gap: 18 }}>
            <img src={staticFile("logos/claude.png")} style={{ width: 124, height: 124, borderRadius: 24, objectFit: "cover" }} />
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 60, color: W_ }}>CLAUDE</div>
          </div>
        </div>

        {/* BEAT 2 — the verdict: not the code, the understanding */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "flex", justifyContent: "center", alignItems: "center", gap: 140 }}>
          <div style={{ position: "relative", opacity: codeIn, transform: `scale(${0.7 + 0.3 * codeIn})` }}>
            <svg width={300} height={200} viewBox="0 0 300 200"><path d="M110 45 L52 100 L110 155 M190 45 L248 100 L190 155" fill="none" stroke={W_} strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div style={{ position: "absolute", left: "-6%", top: "50%", height: 14, width: `${strike * 112}%`, background: RED, borderRadius: 7 }} />
            <div style={{ fontFamily: MONO, fontSize: 28, letterSpacing: "0.14em", color: strike > 0.5 ? RED : W_, marginTop: 14 }}>THE CODE</div>
          </div>
          <div style={{ opacity: undIn, transform: `scale(${0.7 + 0.3 * undIn})` }}>
            <svg width={340} height={200} viewBox="0 0 340 200">
              <circle cx="170" cy="96" r="92" fill={LIME} opacity={0.16} />
              <path d="M74 122 L138 96 L170 110 L202 96 L266 122" fill="none" stroke={LIME} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M138 96 L160 134 M202 96 L180 134" stroke={LIME} strokeWidth="13" strokeLinecap="round" />
            </svg>
            <div style={{ fontFamily: MONO, fontSize: 28, letterSpacing: "0.14em", color: LIME, marginTop: 14 }}>UNDERSTANDING</div>
          </div>
        </div>

        <div style={{ position: "absolute", left: 0, right: 0, top: 520, opacity: lineIn }}>
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 56, color: W_ }}>they paid because I <span style={{ color: LIME }}>got their business</span>.</span>
        </div>
      </div>
    </St>
  );
};

/* ================= TRUST fullscreen ================= */
const TrustOverlay: React.FC = () => {
  const { width: W, height: H } = useVideoConfig();
  const frame = useCurrentFrame();
  const pScrim = useIn(f(56.79), 12);
  const pA = useIn(f(57.08), 12);
  const pB = useIn(f(61.87), 12);
  const out = interpolate(frame, [f(65.36), f(66.16)], [1, 0], clamp);
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 0.42 * H, background: "linear-gradient(to top, rgba(15,18,26,0.72), transparent)", opacity: pScrim * out }} />
      <div style={{ position: "absolute", left: 0.06 * W, bottom: 0.17 * H, opacity: pA * out }}>
        <div style={{ fontFamily: MONO, fontSize: W * 0.0095, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(255,255,255,0.66)" }}>WHAT THEY ACTUALLY BOUGHT</div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: W * 0.04, color: "#fff", marginTop: W * 0.004 }}>I understood their <span style={{ color: LIME }}>business</span>.</div>
      </div>
      <div style={{ position: "absolute", right: 0.06 * W, bottom: 0.18 * H, opacity: pB * out }}>
        <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: W * 0.028, color: RAISIN, background: LIME, padding: `${W * 0.004}px ${W * 0.013}px`, borderRadius: W * 0.004, display: "inline-block" }}>so they trusted me.</span>
      </div>
    </>
  );
};

/* ================= SCENE BOARD: four icons ================= */
const IconOffer = () => <svg width={120} height={120} viewBox="0 0 120 120"><rect x="14" y="20" width="92" height="64" rx="14" fill="#fff" stroke={RAISIN} strokeWidth="6" /><path d="M40 84 L40 104 L64 84" fill="#fff" stroke={RAISIN} strokeWidth="6" strokeLinejoin="round" /><path d="M34 46 H86 M34 62 H72" stroke={LIME} strokeWidth="7" strokeLinecap="round" /></svg>;
const IconCall = () => <svg width={120} height={120} viewBox="0 0 120 120"><path d="M40 26 C36 22 28 22 24 30 C16 46 40 82 70 96 C82 100 92 96 96 88 C98 82 96 78 90 74 L78 68 C74 66 70 68 68 72 C66 76 62 76 58 72 C50 64 48 60 46 54 C44 50 46 48 50 46 C54 44 56 40 54 36 Z" fill={LIME} stroke={RAISIN} strokeWidth="6" strokeLinejoin="round" /></svg>;
const IconPrice = () => <svg width={120} height={120} viewBox="0 0 120 120"><path d="M60 18 L102 18 L102 60 L58 104 L16 62 Z" fill="#fff" stroke={RAISIN} strokeWidth="6" strokeLinejoin="round" /><circle cx="84" cy="40" r="9" fill={RAISIN} /><text x="52" y="76" fontFamily={SANS} fontWeight="700" fontSize="40" fill={LIME} stroke={RAISIN} strokeWidth="2">€</text></svg>;
const IconMonday = () => <svg width={120} height={120} viewBox="0 0 120 120"><rect x="18" y="26" width="84" height="78" rx="12" fill="#fff" stroke={RAISIN} strokeWidth="6" /><path d="M18 46 H102 M40 20 V34 M80 20 V34" stroke={RAISIN} strokeWidth="6" strokeLinecap="round" /><path d="M40 74 L54 88 L84 58" fill="none" stroke={LIME} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const SLOTS = [
  { n: "01", label: "THE OFFER", sub: "what you say", icon: <IconOffer /> },
  { n: "02", label: "WHO TO CALL", sub: "your first client", icon: <IconCall /> },
  { n: "03", label: "THE PRICE", sub: "what to charge", icon: <IconPrice /> },
  { n: "04", label: "YOUR MOVE", sub: "on Monday", icon: <IconMonday /> },
];
const SceneBoard: React.FC = () => {
  const k = useIn(f(69.72), 12);
  return (
    <St cx={BD.x} cy={BD.y} rot={-0.7}>
      <div style={{ width: 1900, textAlign: "center" }}>
        <Kicker p={k}>EVERY WAY GETS THE SAME FOUR THINGS</Kicker>
        <div style={{ display: "flex", justifyContent: "center", gap: 44, marginTop: 60 }}>
          {SLOTS.map((s, i) => {
            const inP = useSpring(f(70.43) + i * 1.5, 18);
            return (
              <div key={s.n} style={{ width: 420, height: 460, opacity: inP, transform: `translateY(${(1 - inP) * 30}px)`, background: RAISIN, borderRadius: 22, border: `1px solid ${RAISIN2}`, padding: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, boxShadow: "0 22px 48px -16px rgba(15,18,26,.5)" }}>
                <div style={{ transform: "scale(1.6)" }}>{s.icon}</div>
                <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 26, color: LIME }}>{s.n}</div>
                <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 46, color: "#fff" }}>{s.label}</div>
                <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 30, color: "rgba(255,255,255,0.6)" }}>{s.sub}</div>
              </div>
            );
          })}
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 1 (teal) — section title ================= */
const SceneWay1Title: React.FC = () => {
  const t = useSpring(f(90.76), 22, 13);
  const t2 = useIn(f(93.88), 14);
  return (
    <St cx={W1T.x} cy={W1T.y}>
      <div style={{ width: 1700, textAlign: "center", opacity: t, transform: `translateY(${(1 - t) * 34}px)` }}>
        <Kicker p={1} light>WAY 1 · PAYS THIS WEEK</Kicker>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 150, letterSpacing: "-0.03em", color: TEAL_L, marginTop: 34, lineHeight: 1 }}>
          Sell the <span style={{ background: LIME, color: TEAL, padding: "0 22px", borderRadius: 14 }}>diagnosis</span>.
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 64, color: "rgba(233,236,237,0.65)", marginTop: 22, opacity: t2 }}>not the build.</div>
      </div>
    </St>
  );
};

/* ================= WAY 1 (teal) — they need DIRECTION, not a builder ================= */
const SceneWay1Need: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(96.66), 12);
  const b = useSpring(f(97.66), 18);
  const arrow = interpolate(frame, [f(100.01), f(101.61)], [0, 1], { ...clamp, easing: EASE });
  const need = useSpring(f(101.61), 20, 12);
  return (
    <St cx={W1N.x} cy={W1N.y}>
      <div style={{ width: 1900, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>AI ALREADY BUILDS</Kicker></div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 90, marginTop: 80 }}>
          <div style={{ opacity: b, transform: `scale(${0.75 + 0.25 * b})`, textAlign: "center" }}>
            <svg width={200} height={170} viewBox="0 0 200 170"><rect x="16" y="34" width="168" height="100" rx="12" fill="none" stroke="rgba(233,236,237,0.45)" strokeWidth="8" /><path d="M50 66 L70 84 L50 102 M92 100 H150" stroke="rgba(233,236,237,0.45)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 46, color: "rgba(233,236,237,0.5)", marginTop: 12 }}>BUILDING ✓</div>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 30, color: "rgba(233,236,237,0.4)" }}>AI does this now</div>
          </div>
          <svg width={200} height={50} style={{ opacity: arrow }}><path d={`M6 25 L ${160 * arrow} 25`} stroke={TEAL_L} strokeWidth="8" strokeLinecap="round" /><path d={`M ${148 * arrow} 12 L ${168 * arrow} 25 L ${148 * arrow} 38`} fill="none" stroke={TEAL_L} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity={arrow > 0.85 ? 1 : 0} /></svg>
          <div style={{ opacity: need, transform: `scale(${0.75 + 0.25 * need})`, textAlign: "center" }}>
            <svg width={190} height={190} viewBox="0 0 190 190"><circle cx="95" cy="95" r="78" fill="none" stroke={LIME} strokeWidth="8" /><circle cx="95" cy="95" r="46" fill="none" stroke={LIME} strokeWidth="8" /><circle cx="95" cy="95" r="15" fill={LIME} /></svg>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 46, color: TEAL_L, marginTop: 12 }}>WHAT TO FIX</div>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 30, color: LIME }}>this is worth real money</div>
          </div>
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 1 (teal) — the storefront: where to start ================= */
const SceneWayOne: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(107.05), 12);
  const shopIn = useSpring(f(107.43), 18, 13);
  const sweep = interpolate(frame, [f(108.43), f(115.0)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const dots = [{ x: 250, y: 370 }, { x: 520, y: 400 }, { x: 790, y: 360 }];
  const L = "#E9ECED";
  return (
    <St cx={W1.x} cy={W1.y}>
      <div style={{ width: 1500, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>EVERYONE KNOWS THEY SHOULD…</Kicker></div>
        <div style={{ position: "relative", width: 1040, height: 500, margin: "50px auto 0" }}>
          <svg width={1040} height={500} viewBox="0 0 1040 500" style={{ opacity: shopIn, transform: `translateY(${(1 - shopIn) * 30}px)` }}>
            <rect x="70" y="160" width="900" height="300" rx="14" fill="rgba(233,236,237,0.05)" stroke={L} strokeWidth="9" />
            <path d="M50 160 L150 80 H890 L990 160 Z" fill="rgba(233,236,237,0.09)" stroke={L} strokeWidth="9" strokeLinejoin="round" />
            <rect x="150" y="240" width="200" height="180" fill="none" stroke={L} strokeWidth="8" />
            <rect x="420" y="240" width="200" height="220" fill="none" stroke={L} strokeWidth="8" />
            <rect x="690" y="240" width="200" height="180" fill="none" stroke={L} strokeWidth="8" />
            {dots.map((d, i) => { const on = sweep > (i + 0.5) / dots.length; return <circle key={i} cx={d.x} cy={d.y} r="20" fill={RED} opacity={on ? 1 : 0} />; })}
          </svg>
          <svg width={260} height={260} viewBox="0 0 260 260" style={{ position: "absolute", left: `${sweep * 720}px`, top: 80, opacity: shopIn }}>
            <circle cx="100" cy="100" r="72" fill="rgba(207,255,5,0.14)" stroke={LIME} strokeWidth="12" />
            <path d="M152 152 L224 224" stroke={LIME} strokeWidth="18" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 52, color: L, marginTop: 30, opacity: shopIn }}>
          …nobody knows <span style={{ background: LIME, color: TEAL, fontStyle: "normal", fontFamily: SANS, fontWeight: 700, padding: "0 14px", borderRadius: 8 }}>where to start</span>.
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 1 (teal) — THE OFFER ================= */
const SceneOffer1: React.FC = () => {
  const cardIn = useSpring(f(118.82), 20, 13);
  const t1 = useSpring(f(122.0), 16);
  const t2 = useSpring(f(125.49), 16);
  return (
    <St cx={OF1.x} cy={OF1.y}>
      <div style={{ width: 1500, textAlign: "center" }}>
        <div style={{ opacity: cardIn }}><Kicker p={1} light>THE OFFER · ONE SENTENCE</Kicker></div>
        <div style={{ marginTop: 46, opacity: cardIn, transform: `translateY(${(1 - cardIn) * 30}px)`, background: "rgba(233,236,237,0.06)", border: `2px solid ${TEAL_L}`, borderRadius: 24, padding: "60px 70px" }}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 64, color: TEAL_L, lineHeight: 1.25 }}>
            "I'll find the <span style={{ color: LIME, fontStyle: "normal", fontFamily: SANS, fontWeight: 700 }}>2–3 changes</span> that save you the most time and money."
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 30, marginTop: 46 }}>
            <span style={{ opacity: t1, fontFamily: MONO, fontWeight: 700, fontSize: 32, letterSpacing: "0.1em", color: TEAL, background: LIME, padding: "12px 28px", borderRadius: 10 }}>FIXED PRICE</span>
            <span style={{ opacity: t2, fontFamily: MONO, fontWeight: 700, fontSize: 32, letterSpacing: "0.1em", color: TEAL_L, border: `2px solid ${TEAL_L}`, padding: "12px 28px", borderRadius: 10 }}>NO BUILDING YET</span>
          </div>
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 1 (teal) — THE NOTEBOOK METHOD (hero, one framed page) ================= */
const SceneNotebook: React.FC = () => {
  const frame = useCurrentFrame();
  const paperIn = useSpring(f(128.47), 22, 13);
  const CW = 1520, CH = 1460, PADX = 170, L0 = 250, LH = 92; // card + ruled-line geometry
  const lineY = (i: number) => L0 + i * LH;
  // questions — appear as asked, then STAY
  const q = [useIn(f(133.51), 10), useIn(f(135.7), 10), useIn(f(138.2), 10)];
  const hour = useIn(f(143.24), 12); // "after one hour, you notice the same problem everywhere"
  // answers (the problems) — appear exactly as he SAYS each one, then STAY
  const a = [useSpring(f(148.94), 16), useSpring(f(151.41), 16), useSpring(f(153.7), 16)];
  const overlap = interpolate(frame, [f(158.96), f(160.63)], [0, 1], clamp); // "everything runs by hand"
  const note = useIn(f(160.63), 14);
  const fixes = useSpring(f(163.44), 20, 12);
  const worth = useIn(f(170.35), 14); // "isn't this too simple to charge for? No."
  const questions = ["how does a lead come in?", "what happens on an order?", "what's still done by hand?"];
  const answers = [["orders typed over", "by hand"], ["invoices go out late", "by hand"], ["quotes take three days", "by hand"]];
  const Row: React.FC<{ i: number; p: number; children: React.ReactNode }> = ({ i, p, children }) => (
    <div style={{ position: "absolute", left: PADX, right: 80, top: lineY(i) - 52, opacity: p, transform: `translateX(${(1 - p) * -14}px)` }}>{children}</div>
  );
  return (
    <St cx={NB.x} cy={NB.y}>
      <div style={{ position: "relative", width: CW, height: CH, background: "rgba(233,236,237,0.055)", border: `2px solid rgba(233,236,237,0.4)`, borderRadius: 20, opacity: paperIn, transform: `translateY(${(1 - paperIn) * 40}px)` }}>
        {/* spiral binding along the top */}
        <svg width={CW} height={40} style={{ position: "absolute", left: 0, top: -20 }}>
          {Array.from({ length: 14 }).map((_, i) => <circle key={i} cx={90 + i * (CW - 180) / 13} cy={20} r={11} fill="none" stroke="rgba(233,236,237,0.5)" strokeWidth={5} />)}
        </svg>
        {/* red margin line + ruled lines */}
        <div style={{ position: "absolute", left: 120, top: 90, bottom: 60, width: 3, background: "rgba(192,57,43,0.7)" }} />
        <svg width={CW - PADX - 80} height={CH - 200} style={{ position: "absolute", left: PADX, top: 100, opacity: 0.13 }}>
          {Array.from({ length: 13 }).map((_, i) => <line key={i} x1={0} y1={i * LH + 60} x2={CW - PADX - 80} y2={i * LH + 60} stroke={TEAL_L} strokeWidth={2} />)}
        </svg>
        <div style={{ position: "absolute", left: PADX, top: 100, fontFamily: MONO, fontSize: 28, letterSpacing: "0.18em", color: "rgba(233,236,237,0.55)" }}>YOUR NOTEBOOK · FIRST MEETING</div>

        {/* QUESTIONS you ask (stay) */}
        {questions.map((txt, i) => (
          <Row key={i} i={i} p={q[i]}>
            <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 46, color: "rgba(233,236,237,0.9)" }}>{txt}</span>
          </Row>
        ))}
        {/* "1 HOUR LATER" — bridges the questions to the pattern you notice */}
        <div style={{ position: "absolute", left: PADX, right: 80, top: lineY(3) - 46, display: "flex", alignItems: "center", gap: 20, opacity: hour }}>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 26, letterSpacing: "0.16em", color: LIME, whiteSpace: "nowrap" }}>1 HOUR LATER</span>
          <span style={{ flex: 1, height: 2, background: "rgba(233,236,237,0.25)" }} />
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 32, color: "rgba(233,236,237,0.6)" }}>the same problem, everywhere</span>
        </div>
        {/* ANSWERS — the problems, "by hand" highlights on the overlap (stay) */}
        {answers.map(([main, bh], i) => (
          <Row key={i} i={i + 4} p={a[i]}>
            <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 46, color: TEAL_L }}>· {main} </span>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 46, color: overlap > 0.3 ? TEAL : TEAL_L, background: overlap > 0.3 ? LIME : "transparent", padding: "2px 10px", borderRadius: 6 }}>{bh}</span>
          </Row>
        ))}
        {/* the overlap verdict */}
        <div style={{ position: "absolute", left: PADX, top: lineY(7) - 48, opacity: note }}>
          <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 48, color: LIME }}>→ one problem: it's all manual.</span>
        </div>
        {/* the 2-3 fixes */}
        <div style={{ position: "absolute", left: PADX, top: lineY(9) - 40, opacity: fixes, transform: `translateY(${(1 - fixes) * 16}px)` }}>
          <div style={{ fontFamily: MONO, fontSize: 26, letterSpacing: "0.14em", color: "rgba(233,236,237,0.55)", marginBottom: 20 }}>PROPOSE 2–3 FIXES · NOT TEN</div>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
            {["auto-log orders", "auto-send invoices", "instant quotes"].map((fx, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 12, fontFamily: SANS, fontWeight: 700, fontSize: 40, color: TEAL, background: LIME, padding: "14px 28px", borderRadius: 12 }}>
                <svg width={30} height={30} viewBox="0 0 30 30"><path d="M6 16 L13 23 L25 8" fill="none" stroke={TEAL} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /></svg>{fx}
              </span>
            ))}
          </div>
        </div>
        {/* "too simple to charge for? No — this IS the job" */}
        <div style={{ position: "absolute", left: PADX, right: 80, top: lineY(11) - 30, opacity: worth, display: "flex", alignItems: "center", gap: 18 }}>
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 38, color: "rgba(233,236,237,0.55)", textDecoration: "line-through" }}>too simple to charge for?</span>
          <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 44, color: LIME }}>no — this is the whole job.</span>
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 1 (teal) — THE RECEIPT: 3 months vs 1 week ================= */
const SceneReceipt1: React.FC = () => {
  const frame = useCurrentFrame();
  // PHASE A — 3 months planned vs 1 week real (184–194)
  const planW = useSpring(f(177.12), 22, 14);
  const realW = useSpring(f(182.13), 20, 13);
  const strike = interpolate(frame, [f(183.12), f(184.23)], [0, 1], clamp);
  const done = useSpring(f(185.02), 16, 12);        // "quarter goal already finished"
  const aOut = interpolate(frame, [f(187.43), f(188.43)], [1, 0], clamp);
  // PHASE B — they didn't need tech, they needed the sentence (195.8–206)
  const bIn = interpolate(frame, [f(188.23), f(189.23)], [0, 1], clamp);
  const stopP = useSpring(f(189.23), 16, 12);        // "stop all the planning"
  const startP = useSpring(f(192.13), 16, 12);       // "just start here"
  const payP = useIn(f(195.23), 14);                 // "the sentence that saves them money"
  return (
    <St cx={RC1.x} cy={RC1.y}>
      <div style={{ width: 1800, position: "relative", height: 620 }}>
        {/* PHASE A */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 20, opacity: aOut }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 40, alignItems: "flex-start", paddingLeft: 120 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
              <div style={{ width: 300, textAlign: "right", fontFamily: SANS, fontWeight: 700, fontSize: 38, color: "rgba(233,236,237,0.7)" }}>THEY PLANNED</div>
              <div style={{ position: "relative", width: 1200 * planW, height: 120, background: "rgba(233,236,237,0.16)", border: `2px solid ${TEAL_L}`, borderRadius: 14, display: "flex", alignItems: "center", paddingLeft: 34, overflow: "hidden" }}>
                <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 56, color: TEAL_L, whiteSpace: "nowrap", opacity: interpolate(planW, [0.45, 0.8], [0, 1], clamp) }}>3 MONTHS</span>
                <div style={{ position: "absolute", left: 20, top: "48%", height: 8, width: `${strike * 96}%`, background: RED, borderRadius: 4 }} />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
              <div style={{ width: 300, textAlign: "right", fontFamily: SANS, fontWeight: 700, fontSize: 38, color: LIME }}>REAL WORK</div>
              <div style={{ width: 300 * realW, height: 120, background: LIME, borderRadius: 14, display: "flex", alignItems: "center", paddingLeft: 34, overflow: "hidden" }}>
                <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 56, color: TEAL, whiteSpace: "nowrap", opacity: interpolate(realW, [0.45, 0.8], [0, 1], clamp) }}>1 WEEK</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 44, opacity: done, transform: `scale(${0.9 + 0.1 * done})` }}>
            <span style={{ width: 54, height: 54, borderRadius: "50%", background: LIME, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width={30} height={30} viewBox="0 0 30 30"><path d="M6 16 L13 23 L25 8" fill="none" stroke={TEAL} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 46, color: TEAL_L }}>the whole quarter's goal — done in a week.</span>
          </div>
        </div>
        {/* PHASE B — the sentence they actually paid for */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 40, opacity: bIn, textAlign: "center" }}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 46, color: "rgba(233,236,237,0.6)" }}>they didn't need more tech. they needed to hear:</div>
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
            <div style={{ opacity: stopP, transform: `translateY(${(1 - stopP) * 20}px)`, fontFamily: SANS, fontWeight: 700, fontSize: 96, color: TEAL_L, lineHeight: 1 }}>stop planning.</div>
            <div style={{ opacity: startP, transform: `translateY(${(1 - startP) * 20}px)`, fontFamily: SANS, fontWeight: 700, fontSize: 96, color: TEAL, background: LIME, padding: "6px 34px", borderRadius: 16, lineHeight: 1.1 }}>just start here.</div>
          </div>
          <div style={{ marginTop: 40, opacity: payP, fontFamily: SERIF, fontStyle: "italic", fontSize: 44, color: TEAL_L }}>that one sentence is what you <span style={{ color: LIME }}>get paid for</span>.</div>
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 1 (teal) — THE PRICE ================= */
const ScenePrice1: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(199.53), 12);
  const val = Math.round(interpolate(frame, [f(204.46), f(206.47)], [0, 3000], { ...clamp, easing: Easing.out(Easing.cubic) }) / 50) * 50;
  const pop = useSpring(f(206.27), 16, 11);
  return (
    <St cx={PR1.x} cy={PR1.y}>
      <div style={{ width: 1400, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>THE PRICE</Kicker></div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 300, letterSpacing: "-0.04em", color: TEAL_L, lineHeight: 1, marginTop: 30, transform: `scale(${0.9 + 0.1 * pop})` }}>
          €{val.toLocaleString()}
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 52, color: "rgba(233,236,237,0.7)", marginTop: 10 }}>fixed. you're not selling <span style={{ textDecoration: "line-through" }}>hours</span> — you're selling the <span style={{ color: LIME, fontStyle: "normal", fontFamily: SANS, fontWeight: 700 }}>answer</span>.</div>
      </div>
    </St>
  );
};

/* ================= WAY 1 (teal) — MONDAY MOVE ================= */
const SceneMonday1: React.FC = () => {
  const c1 = useSpring(f(213.44), 18);
  const c2 = useSpring(f(219.26), 18);           // "have your notebook with you"
  const flow = useSpring(f(223.96), 18, 12);     // "give a free analysis, then upsell to the paid one"
  const upsell = useSpring(f(227.24), 16, 12);
  const hand = useIn(f(230.76), 12);
  return (
    <St cx={MO1.x} cy={MO1.y}>
      <div style={{ width: 1600, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 50, marginTop: 20 }}>
          <div style={{ opacity: c1, transform: `translateY(${(1 - c1) * 26}px)`, width: 440, background: "rgba(233,236,237,0.06)", border: `2px solid ${TEAL_L}`, borderRadius: 20, padding: 40 }}>
            <svg width={100} height={100} viewBox="0 0 110 110"><path d="M22 44 H78 V70 a18 18 0 0 1 -18 18 H40 a18 18 0 0 1 -18 -18 Z" fill="none" stroke={LIME} strokeWidth={7} strokeLinejoin="round" /><path d="M78 50 h14 a12 12 0 0 1 0 24 h-14" fill="none" stroke={LIME} strokeWidth={7} /><path d="M38 26 v-10 M52 30 v-14 M66 26 v-10" stroke={TEAL_L} strokeWidth={6} strokeLinecap="round" /></svg>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 42, color: TEAL_L, marginTop: 18 }}>coffee ×2</div>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 28, color: "rgba(233,236,237,0.6)" }}>owners you already know</div>
          </div>
          <div style={{ opacity: c2, transform: `translateY(${(1 - c2) * 26}px)`, width: 440, background: "rgba(233,236,237,0.06)", border: `2px solid ${TEAL_L}`, borderRadius: 20, padding: 40 }}>
            <svg width={100} height={100} viewBox="0 0 110 110"><rect x="24" y="18" width="62" height="80" rx="8" fill="none" stroke={LIME} strokeWidth={7} /><path d="M38 40 H72 M38 56 H72 M38 72 H60" stroke={TEAL_L} strokeWidth={6} strokeLinecap="round" /></svg>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 42, color: TEAL_L, marginTop: 18 }}>your notebook</div>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 28, color: "rgba(233,236,237,0.6)" }}>sell nothing yet — just ask</div>
          </div>
        </div>
        {/* free mini-analysis → upsell to the paid fix */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 34, marginTop: 44, opacity: flow }}>
          <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, color: TEAL_L, border: `2px solid ${TEAL_L}`, padding: "14px 30px", borderRadius: 12 }}>free mini-analysis</span>
          <svg width={110} height={44} style={{ opacity: upsell }}><path d="M6 22 H86" stroke={LIME} strokeWidth={7} strokeLinecap="round" /><path d="M74 10 L96 22 L74 34" fill="none" stroke={LIME} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span style={{ opacity: upsell, transform: `scale(${0.85 + 0.15 * upsell})`, fontFamily: SANS, fontWeight: 700, fontSize: 40, color: TEAL, background: LIME, padding: "14px 30px", borderRadius: 12 }}>paid fix · €3K</span>
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 44, color: TEAL_L, marginTop: 40, opacity: hand }}>
          money <span style={{ color: LIME }}>this week</span> — but it pays once. <span style={{ color: "rgba(233,236,237,0.6)" }}>the next way pays like a project →</span>
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 2 (red) — the MIT 95% stat ================= */
const SceneW2Stat: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(237.14), 12);
  const grid = useIn(f(237.84), 18);
  const dead = interpolate(frame, [f(240.84), f(243.46)], [0, 1], clamp); // 95 flip dead
  const num = useSpring(f(241.45), 18, 12);
  return (
    <St cx={W2T.x} cy={W2T.y}>
      <div style={{ width: 1900, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>WAY 2 · RESCUE FAILED AI</Kicker></div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 90, marginTop: 56 }}>
          {/* 100-cell grid, 95 die */}
          <svg width={620} height={620} viewBox="0 0 620 620" style={{ opacity: grid }}>
            {Array.from({ length: 100 }).map((_, i) => {
              const r = Math.floor(i / 10), col = i % 10; const isAlive = i >= 95;
              const flipped = dead > (i / 120);
              return <rect key={i} x={10 + col * 60} y={10 + r * 60} width={48} height={48} rx={8}
                fill={isAlive ? LIME : (flipped ? "rgba(122,90,98,0.35)" : RED_L)} stroke={flipped && !isAlive ? DEAD : "none"} strokeWidth={3} />;
            })}
          </svg>
          <div style={{ textAlign: "left", opacity: num }}>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 260, letterSpacing: "-0.04em", color: RED_L, lineHeight: 0.9 }}>95<span style={{ fontSize: 120 }}>%</span></div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 56, color: RED_L }}>delivered <span style={{ color: LIME }}>nothing</span></div>
            <div style={{ fontFamily: MONO, fontSize: 30, letterSpacing: "0.12em", color: "rgba(240,231,233,0.55)", marginTop: 10 }}>SOURCE · MIT</div>
          </div>
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 2 (red) — why it failed (undefined goal, arrows miss) ================= */
const SceneW2Why: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(248.66), 12);
  const targetIn = useSpring(f(249.44), 18);
  const arrows: [number, number, number, number, number][] = [
    [80, 90, 250, 210, f(250.75)], [640, 110, 470, 220, f(252.74)],
    [100, 500, 245, 375, f(254.74)], [620, 500, 470, 370, f(256.74)],
  ];
  const line = useIn(f(258.95), 16);
  return (
    <St cx={W2Y.x} cy={W2Y.y}>
      <div style={{ width: 1500, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>IT WAS NEVER THE MODEL</Kicker></div>
        <svg width={720} height={600} viewBox="0 0 720 600" style={{ display: "block", margin: "34px auto 0", overflow: "visible", opacity: targetIn }}>
          <circle cx="360" cy="290" r="200" fill="none" stroke="rgba(240,231,233,0.3)" strokeWidth="6" strokeDasharray="14 12" />
          <circle cx="360" cy="290" r="115" fill="none" stroke="rgba(240,231,233,0.3)" strokeWidth="6" strokeDasharray="14 12" />
          <text x="360" y="312" textAnchor="middle" fontFamily={MONO} fontWeight="700" fontSize="90" fill={DEAD}>?</text>
          <text x="360" y="392" textAnchor="middle" fontFamily={MONO} fontWeight="700" fontSize="24" letterSpacing="0.14em" fill="rgba(240,231,233,0.45)">NO GOAL</text>
          {arrows.map(([sx, sy, ex, ey, at], i) => {
            const p = interpolate(frame, [at, at + f(0.5)], [0, 1], clamp);
            if (p <= 0) return null;
            const cx = sx + (ex - sx) * p, cy = sy + (ey - sy) * p;
            const ang = Math.atan2(ey - sy, ex - sx);
            return (
              <g key={i} opacity={p}>
                <line x1={sx} y1={sy} x2={cx} y2={cy} stroke={LIME} strokeWidth="7" strokeLinecap="round" />
                <path d={`M ${cx - 22 * Math.cos(ang - 0.5)} ${cy - 22 * Math.sin(ang - 0.5)} L ${cx} ${cy} L ${cx - 22 * Math.cos(ang + 0.5)} ${cy - 22 * Math.sin(ang + 0.5)}`} fill="none" stroke={LIME} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            );
          })}
        </svg>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 50, color: RED_L, marginTop: 14, opacity: line }}>nobody decided what "<span style={{ color: LIME }}>working</span>" even meant.</div>
      </div>
    </St>
  );
};

/* ================= WAY 2 (red) — more power→more confusion, then the market grows ================= */
const SceneW2Market: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(264.73), 12);
  // PHASE 1 (272.3–278.5): more power → more confusion
  const power = interpolate(frame, [f(265.44), f(267.45)], [0, 1], { ...clamp, easing: EASE });
  const conf = interpolate(frame, [f(267.65), f(270.25)], [0, 1], { ...clamp, easing: EASE });
  const p1out = interpolate(frame, [f(270.65), f(271.63)], [1, 0], clamp);
  // PHASE 2 (279–286): failed projects grow every year
  const p2 = useIn(f(271.44), 12);
  const bars = [useSpring(f(272.05), 16, 13), useSpring(f(273.45), 16, 13), useSpring(f(274.85), 16, 13), useSpring(f(276.24), 16, 13)];
  const label = useIn(f(276.24), 14);
  const scribble = "M0 60 q40 -60 80 0 t80 0 t80 0 t80 0 t80 0";
  return (
    <St cx={W2M.x} cy={W2M.y}>
      <div style={{ position: "relative", width: 1700, height: 640 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: -30, textAlign: "center", opacity: k }}><Kicker p={1} light>BETTER AI WON'T FIX THIS</Kicker></div>
        {/* PHASE 1 */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 120, display: "flex", justifyContent: "center", alignItems: "center", gap: 120, opacity: p1out }}>
          <div style={{ textAlign: "center", opacity: power }}>
            <svg width={260} height={260} viewBox="0 0 260 260"><circle cx="130" cy="130" r={40 + power * 60} fill="rgba(207,255,5,0.18)" stroke={LIME} strokeWidth="8" /><path d="M130 90 v80 M90 130 h80" stroke={LIME} strokeWidth="8" strokeLinecap="round" /></svg>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 44, color: AMB_L === AMB_L ? RED_L : RED_L, marginTop: 10 }}>MORE POWER</div>
          </div>
          <svg width={90} height={44}><path d="M6 22 H80" stroke="rgba(240,231,233,0.5)" strokeWidth="6" strokeLinecap="round" /><path d="M68 10 L88 22 L68 34" fill="none" stroke="rgba(240,231,233,0.5)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <div style={{ textAlign: "center", opacity: conf }}>
            <svg width={360} height={200} viewBox="0 0 400 120" style={{ overflow: "visible" }}><path d={scribble} fill="none" stroke="#FF6B5A" strokeWidth="7" strokeLinecap="round" pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - conf)} /></svg>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 44, color: "#FF6B5A", marginTop: 10 }}>MORE CONFUSION</div>
          </div>
        </div>
        {/* PHASE 2 */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 40, opacity: p2 }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 46, height: 420 }}>
            {bars.map((p, i) => (
              <div key={i} style={{ width: 150, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 150, height: (110 + i * 100) * p, background: i === 3 ? LIME : "rgba(122,90,98,0.55)", borderRadius: "10px 10px 0 0" }} />
                <div style={{ fontFamily: MONO, fontSize: 24, color: "rgba(240,231,233,0.5)", marginTop: 14 }}>{2023 + i}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 56, color: RED_L, marginTop: 30, opacity: label }}>failed projects grow every year — <span style={{ color: LIME }}>that's your market</span>.</div>
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 2 (red) — the offer ================= */
const SceneW2Offer: React.FC = () => {
  const cardIn = useSpring(f(278.16), 20, 13);
  const t1 = useSpring(f(281.46), 16);
  const t2 = useSpring(f(283.96), 16);
  return (
    <St cx={W2O.x} cy={W2O.y}>
      <div style={{ width: 1500, textAlign: "center" }}>
        <div style={{ opacity: cardIn }}><Kicker p={1} light>THE OFFER</Kicker></div>
        <div style={{ marginTop: 46, opacity: cardIn, transform: `translateY(${(1 - cardIn) * 30}px)`, background: "rgba(240,231,233,0.06)", border: `2px solid ${RED_L}`, borderRadius: 24, padding: "56px 66px" }}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 60, color: RED_L, lineHeight: 1.25 }}>
            "Give me <span style={{ color: LIME, fontStyle: "normal", fontFamily: SANS, fontWeight: 700 }}>one job</span> AI failed at. In 30 days it runs by itself."
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 44 }}>
            <span style={{ opacity: t1, fontFamily: MONO, fontWeight: 700, fontSize: 30, color: RED_ENV, background: LIME, padding: "12px 26px", borderRadius: 10 }}>30 DAYS</span>
            <span style={{ opacity: t2, fontFamily: MONO, fontWeight: 700, fontSize: 30, color: RED_L, border: `2px solid ${RED_L}`, padding: "12px 26px", borderRadius: 10 }}>MEASURABLE</span>
          </div>
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 2 (red) — who to call: the shrug list (clean chat bubbles) ================= */
const ShrugIcon: React.FC = () => (
  <svg width={72} height={72} viewBox="0 0 72 72"><circle cx="36" cy="22" r="13" fill="none" stroke={DEAD} strokeWidth="5" /><path d="M14 58 c0 -14 10 -22 22 -22 c12 0 22 8 22 22" fill="none" stroke={DEAD} strokeWidth="5" strokeLinecap="round" /><path d="M8 44 l-6 8 M64 44 l6 8" stroke={DEAD} strokeWidth="5" strokeLinecap="round" /></svg>
);
const SceneW2Who: React.FC = () => {
  const rows = [useSpring(f(290.94), 16, 13), useSpring(f(293.96), 16, 13), useSpring(f(296.94), 16, 13)];
  const punch = useSpring(f(298.26), 18, 12);      // "that shrug is your lead list"
  const already = useIn(f(303.93), 14);            // "you're not selling the dream — fixing a purchase already made"
  const names = ["we tried ChatGPT…", "we built an n8n thing…", "we hired an agency…"];
  return (
    <St cx={W2W.x} cy={W2W.y}>
      <div style={{ width: 1500 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {names.map((n, i) => (
            <div key={i} style={{ opacity: rows[i], transform: `translateY(${(1 - rows[i]) * 18}px)`, display: "flex", alignItems: "center", gap: 26 }}>
              <ShrugIcon />
              <div style={{ background: "rgba(240,231,233,0.07)", border: `2px solid rgba(240,231,233,0.28)`, borderRadius: "6px 22px 22px 22px", padding: "16px 32px", flex: 1 }}>
                <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 44, color: RED_L }}>"{n}" </span>
                <span style={{ fontFamily: SANS, fontSize: 32, color: "rgba(240,231,233,0.45)" }}>…and shrugged.</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 34, opacity: punch, transform: `scale(${0.9 + 0.1 * punch})`, textAlign: "center", fontFamily: SANS, fontWeight: 700, fontSize: 56, color: LIME }}>that shrug is your lead list.</div>
        <div style={{ marginTop: 22, opacity: already, textAlign: "center", fontFamily: SERIF, fontStyle: "italic", fontSize: 40, color: RED_L }}>you're not selling the dream — you're <span style={{ color: LIME, fontStyle: "normal", fontFamily: SANS, fontWeight: 700 }}>fixing a purchase they already made</span>.</div>
      </div>
    </St>
  );
};

/* ================= WAY 2 (red) — 2x success ================= */
const SceneW2TwoX: React.FC = () => {
  const k = useIn(f(310.45), 10);
  const a = useSpring(f(311.03), 18);
  const b = useSpring(f(313.05), 18);
  return (
    <St cx={W2X.x} cy={W2X.y}>
      <div style={{ width: 1500, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>THE ODDS ARE ON YOUR SIDE</Kicker></div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 120, marginTop: 60 }}>
          <div style={{ opacity: a }}>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 150, color: "rgba(122,90,98,0.7)", lineHeight: 1 }}>33%</div>
            <div style={{ fontFamily: MONO, fontSize: 30, letterSpacing: "0.1em", color: "rgba(240,231,233,0.55)" }}>DIY INTERNAL</div>
          </div>
          <div style={{ opacity: b }}>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 210, color: LIME, lineHeight: 1 }}>67%</div>
            <div style={{ fontFamily: MONO, fontSize: 32, letterSpacing: "0.1em", color: RED_L }}>OUTSIDE HELP · YOU</div>
          </div>
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 48, color: RED_L, marginTop: 40, opacity: b }}>you succeed <span style={{ color: LIME }}>twice as often</span>.</div>
      </div>
    </St>
  );
};

/* ================= WAY 2 (red) — price ================= */
const SceneW2Price: React.FC = () => {
  const k = useIn(f(316.95), 10);
  const pop = useSpring(f(318.05), 16, 11);
  return (
    <St cx={W2P.x} cy={W2P.y}>
      <div style={{ width: 1400, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>THE PRICE · PER FIX</Kicker></div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 260, letterSpacing: "-0.04em", color: RED_L, lineHeight: 1, marginTop: 30, transform: `scale(${0.9 + 0.1 * pop})` }}>
          €2<span style={{ color: "rgba(240,231,233,0.5)", fontSize: 150 }}>–</span>5<span style={{ fontSize: 150 }}>K</span>
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 48, color: "rgba(240,231,233,0.7)", marginTop: 10 }}>one workflow. thirty days. measurable.</div>
      </div>
    </St>
  );
};

/* ================= WAY 2 (red) — Monday + handoff ================= */
const SceneW2Monday: React.FC = () => {
  const c1 = useSpring(f(325.95), 18);
  const msg = useSpring(f(331.84), 16, 12);      // "ask them on LinkedIn how it went"
  const reply = useSpring(f(335.05), 16, 12);    // "the answer you get is your way in"
  const wayin = useIn(f(336.64), 12);
  const hand = useIn(f(338.86), 14);
  return (
    <St cx={W2MO.x} cy={W2MO.y}>
      <div style={{ width: 1600, textAlign: "center" }}>
        <div style={{ marginTop: 10, opacity: c1, transform: `translateY(${(1 - c1) * 26}px)`, background: "rgba(240,231,233,0.06)", border: `2px solid ${RED_L}`, borderRadius: 20, padding: "40px 56px", display: "inline-block" }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 52, color: RED_L }}>list <span style={{ color: LIME }}>5 businesses</span> that tried AI and went quiet.</div>
        </div>
        {/* the LinkedIn opener → their reply → your way in */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 40, maxWidth: 1100, marginLeft: "auto", marginRight: "auto" }}>
          <div style={{ opacity: msg, transform: `translateY(${(1 - msg) * 16}px)`, alignSelf: "flex-end", background: LIME, color: RED_ENV, borderRadius: "20px 20px 6px 20px", padding: "18px 30px", fontFamily: SANS, fontWeight: 700, fontSize: 36 }}>"how did that AI thing go?"</div>
          <div style={{ opacity: reply, transform: `translateY(${(1 - reply) * 16}px)`, alignSelf: "flex-start", background: "rgba(240,231,233,0.08)", border: `2px solid rgba(240,231,233,0.3)`, color: RED_L, borderRadius: "20px 20px 20px 6px", padding: "18px 30px", fontFamily: SERIF, fontStyle: "italic", fontSize: 36 }}>"honestly… total waste of money."</div>
        </div>
        <div style={{ marginTop: 28, opacity: wayin, fontFamily: SANS, fontWeight: 700, fontSize: 44, color: LIME }}>that answer is your way in.</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 42, color: RED_L, marginTop: 34, opacity: hand }}>
          bigger checks — but you still <span style={{ color: "rgba(240,231,233,0.55)" }}>hunt each deal</span>. next, the money <span style={{ color: LIME }}>finds you →</span>
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 3 (amber) — YC launched Airbnb+Stripe → 10x bigger than SaaS ================= */
const SceneW3Stat: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(354.14), 12);
  // PHASE A — the funding tree: YC launched Airbnb & Stripe ("the school behind them")
  const yc = useSpring(f(355.94), 18, 12);
  const draw = interpolate(frame, [f(358.14), f(359.04)], [0, 1], { ...clamp, easing: EASE }); // on "behind"
  const ab = useSpring(f(358.54), 16, 12);   // "Airbnb"
  const st = useSpring(f(359.34), 16, 12);   // "and Stripe"
  const treeOut = interpolate(frame, [f(361.44), f(362.35)], [1, 0], clamp);
  // PHASE B — the claim: AI for one niche = 10x bigger than SaaS
  const claimIn = interpolate(frame, [f(362.05), f(362.93)], [0, 1], clamp);
  const saasBar = useSpring(f(362.44), 20, 13);
  const aiBar = useSpring(f(363.03), 24, 13);  // "ten times bigger"
  const tenP = useSpring(f(363.43), 18, 11);
  const AIH = 330, SAH = AIH / 10; // AI bar is literally 10x the SaaS bar
  return (
    <St cx={W3T.x} cy={W3T.y}>
      <div style={{ width: 1700, position: "relative" }}>
        <div style={{ opacity: k, textAlign: "center" }}><Kicker p={1} light>WAY 3 · OWN ONE BORING NICHE</Kicker></div>

        {/* PHASE A — funding tree */}
        <div style={{ opacity: treeOut, position: "relative", height: 560, marginTop: 30 }}>
          {/* YC logo — absolute at the tree origin x=850, the SAME coordinate base as the
              connectors (M 850) and the logos (midpoint 850). Using left:50% here mis-resolved
              against the phaseA box and pushed YC ~114px off the tree origin. */}
          <div style={{ position: "absolute", left: 750, top: 0, width: 200, opacity: yc, transform: `scale(${0.8 + 0.2 * yc})`, transformOrigin: "center top" }}>
            <div style={{ width: 200, height: 200, background: "#fff", borderRadius: 30, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 14px 34px rgba(0,0,0,.35)" }}>
              <img src={staticFile("logos/y_combinator.png")} style={{ width: "74%", height: "74%", objectFit: "contain" }} />
            </div>
          </div>
          <div style={{ position: "absolute", left: 0, top: 226, width: 1700, textAlign: "center", opacity: yc, fontFamily: MONO, fontSize: 24, letterSpacing: "0.14em", color: "rgba(241,234,218,0.6)" }}>THE STARTUP SCHOOL BEHIND</div>
          {/* connectors from YC down to the two logos — pathLength normalized so the draw is
              always clean start→end (no stray floating segment), and only rendered once drawing */}
          {draw > 0 && (
            <svg width={1700} height={560} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
              <path d="M 850 292 C 720 348, 560 372, 470 425" fill="none" stroke={LIME} strokeWidth="5" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
              <path d="M 850 292 C 980 348, 1140 372, 1230 425" fill="none" stroke={LIME} strokeWidth="5" strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
            </svg>
          )}
          {/* Airbnb (left) + Stripe (right) */}
          <div style={{ position: "absolute", left: 395, top: 425, opacity: ab, transform: `translateY(${(1 - ab) * 18}px) scale(${0.8 + 0.2 * ab})` }}>
            <div style={{ width: 150, height: 150, background: "#fff", borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 26px rgba(0,0,0,.3)" }}>
              <img src={staticFile("logos/airbnb.png")} style={{ width: "70%", height: "70%", objectFit: "contain" }} />
            </div>
          </div>
          <div style={{ position: "absolute", left: 1155, top: 425, opacity: st, transform: `translateY(${(1 - st) * 18}px) scale(${0.8 + 0.2 * st})` }}>
            <div style={{ width: 150, height: 150, background: "#fff", borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 26px rgba(0,0,0,.3)" }}>
              <img src={staticFile("logos/stripe.png")} style={{ width: "70%", height: "70%", objectFit: "contain" }} />
            </div>
          </div>
        </div>

        {/* PHASE B — 10x bigger than SaaS (two bars, AI literally 10x the SaaS bar) */}
        <div style={{ opacity: claimIn, position: "absolute", left: 0, top: 70, width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 52, color: AMB_L }}>AI for <span style={{ color: LIME }}>one industry</span> beats SaaS</div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 90, marginTop: 56, height: AIH + 130 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: 130, height: SAH * saasBar, background: "rgba(241,234,218,0.28)", borderRadius: "8px 8px 0 0" }} />
              <span style={{ fontFamily: MONO, fontSize: 26, color: "rgba(241,234,218,0.6)" }}>SaaS</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ opacity: tenP, transform: `translateY(${(1 - tenP) * 14}px)`, fontFamily: SANS, fontWeight: 700, fontSize: 84, color: LIME, lineHeight: 1 }}>10×</div>
              <div style={{ width: 170, height: AIH * aiBar, background: LIME, borderRadius: "10px 10px 0 0", boxShadow: "0 0 40px rgba(207,255,5,0.35)" }} />
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, color: AMB_L }}>AI · ONE NICHE</span>
            </div>
          </div>
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 3 (amber) — thousands of niches ================= */
const NICHES = ["DENTISTS", "TRUCKERS", "SALONS", "BAKERIES", "CLINICS", "GYMS", "PLUMBERS", "FLORISTS", "GARAGES", "LAW FIRMS", "CAFÉS", "MOVERS"];
const SceneW3Niches: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(366.28), 12);
  const grid = useIn(f(366.94), 18);
  const pick = interpolate(frame, [f(371.43), f(373.24)], [0, 1], clamp); // yours lights up
  return (
    <St cx={W3N.x} cy={W3N.y}>
      <div style={{ width: 1800, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>NO SINGLE WINNER · THOUSANDS OF SMALL ONES</Kicker></div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 24, marginTop: 56, opacity: grid, maxWidth: 1600, margin: "56px auto 0" }}>
          {NICHES.map((n, i) => {
            const mine = i === 0;
            return <span key={i} style={{ fontFamily: SANS, fontWeight: 700, fontSize: 46, color: mine && pick > 0.4 ? AMB_ENV : AMB_L, background: mine && pick > 0.4 ? LIME : "transparent", border: `2px solid ${mine && pick > 0.4 ? LIME : "rgba(241,234,218,0.3)"}`, padding: "14px 30px", borderRadius: 12, opacity: mine ? 1 : (pick > 0.4 ? 0.4 : 1) }}>{n}</span>;
          })}
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 46, color: LIME, marginTop: 40, opacity: pick }}>pick the ONE you already know.</div>
      </div>
    </St>
  );
};

/* ================= WAY 3 (amber) — become THE one ================= */
const SceneW3One: React.FC = () => {
  const k = useIn(f(377.12), 12);
  const shift = useSpring(f(379.77), 20, 12);
  return (
    <St cx={W3O.x} cy={W3O.y}>
      <div style={{ width: 1700, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>STOP BEING FOR EVERYONE</Kicker></div>
        <div style={{ marginTop: 60, fontFamily: SANS, fontWeight: 700, fontSize: 90, color: "rgba(241,234,218,0.4)", lineHeight: 1.2 }}>
          the AI person for <span style={{ textDecoration: "line-through" }}>everyone</span>
        </div>
        <div style={{ marginTop: 30, opacity: shift, transform: `scale(${0.8 + 0.2 * shift})`, fontFamily: SANS, fontWeight: 700, fontSize: 130, color: AMB_L }}>
          THE AI person for <span style={{ background: LIME, color: AMB_ENV, padding: "0 22px", borderRadius: 14 }}>ONE</span>.
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 3 (amber) — the moat ================= */
const SceneW3Moat: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(386.11), 12);
  const codeIn = useSpring(f(386.99), 16);
  const strike = interpolate(frame, [f(391.59), f(393.2)], [0, 1], clamp);
  const shield = useSpring(f(398.35), 20, 12);
  const stay = useIn(f(408.01), 14);
  return (
    <St cx={W3M.x} cy={W3M.y}>
      <div style={{ width: 1800, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>THE MOAT IS NEVER THE CODE</Kicker></div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 120, marginTop: 56 }}>
          <div style={{ position: "relative", opacity: codeIn }}>
            <svg width={240} height={170} viewBox="0 0 240 170"><path d="M90 40 L44 85 L90 130 M150 40 L196 85 L150 130" fill="none" stroke="rgba(241,234,218,0.5)" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div style={{ position: "absolute", left: "-4%", top: "50%", height: 12, width: `${strike * 108}%`, background: DEAD, borderRadius: 6 }} />
            <div style={{ fontFamily: MONO, fontSize: 26, letterSpacing: "0.14em", color: strike > 0.5 ? DEAD : "rgba(241,234,218,0.6)", marginTop: 8 }}>CODE · copied by next month</div>
          </div>
          <div style={{ opacity: shield, transform: `scale(${0.75 + 0.25 * shield})` }}>
            <svg width={220} height={230} viewBox="0 0 220 230"><path d="M110 12 L200 46 V120 C200 175 160 205 110 222 C60 205 20 175 20 120 V46 Z" fill="rgba(207,255,5,0.14)" stroke={LIME} strokeWidth="10" strokeLinejoin="round" /><path d="M70 118 L100 148 L154 88" fill="none" stroke={LIME} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <div style={{ fontFamily: MONO, fontSize: 26, letterSpacing: "0.12em", color: LIME, marginTop: 8 }}>NICHE DEPTH + WORD OF MOUTH</div>
          </div>
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 48, color: AMB_L, marginTop: 40, opacity: stay }}>models come and go — your <span style={{ color: LIME }}>name in the niche</span> stays.</div>
      </div>
    </St>
  );
};

/* ================= WAY 3 (amber) — build once, sell 10 ================= */
const SceneW3Build: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(412.99), 12);
  const build = useSpring(f(413.69), 18, 12);
  const sells = Array.from({ length: 10 }).map((_, i) => useSpring(f(418.0) + i * 3, 12, 11));
  const margin = useIn(f(427.21), 14);
  return (
    <St cx={W3B.x} cy={W3B.y}>
      <div style={{ width: 1800, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>SERVICE → PRODUCT</Kicker></div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 60, marginTop: 60 }}>
          <div style={{ opacity: build, textAlign: "center" }}>
            <div style={{ width: 260, height: 200, background: AMB_L, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 54, color: AMB_ENV }}>BUILD 1</span>
              <span style={{ fontFamily: MONO, fontSize: 30, color: AMB_ENV }}>€3–5K</span>
            </div>
          </div>
          <svg width={110} height={50}><path d="M6 25 H92" stroke={AMB_L} strokeWidth="7" strokeLinecap="round" /><path d="M80 12 L100 25 L80 38" fill="none" stroke={AMB_L} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <div style={{ display: "flex", flexWrap: "wrap", width: 620, gap: 14 }}>
            {sells.map((p, i) => (
              <div key={i} style={{ width: 110, height: 92, background: i === 0 ? "rgba(241,234,218,0.25)" : LIME, borderRadius: 10, opacity: p, transform: `scale(${0.6 + 0.4 * p})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 700, fontSize: 34, color: i === 0 ? AMB_L : AMB_ENV }}>{i === 0 ? "€" : "€"}</div>
            ))}
          </div>
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 54, color: AMB_L, marginTop: 40, opacity: margin }}>from sale #2, it's <span style={{ color: LIME }}>almost pure margin</span>.</div>
      </div>
    </St>
  );
};

/* ================= WAY 3 (amber) — Monday ================= */
const SceneW3Monday: React.FC = () => {
  const k = useIn(f(432.73), 12);
  const c1 = useSpring(f(434.01), 18);
  const boring = useSpring(f(438.61), 18, 11);
  return (
    <St cx={W3MO.x} cy={W3MO.y}>
      <div style={{ width: 1600, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>YOUR MONDAY MOVE</Kicker></div>
        <div style={{ marginTop: 50, opacity: c1, transform: `translateY(${(1 - c1) * 24}px)`, fontFamily: SANS, fontWeight: 700, fontSize: 68, color: AMB_L }}>
          write down the <span style={{ color: LIME }}>one industry</span> you know best.
        </div>
        <div style={{ marginTop: 34, opacity: boring, transform: `scale(${0.85 + 0.15 * boring})`, fontFamily: SERIF, fontStyle: "italic", fontSize: 54, color: "rgba(241,234,218,0.75)" }}>
          not the coolest. <span style={{ color: AMB_L, fontStyle: "normal", fontFamily: SANS, fontWeight: 700 }}>boring is perfect</span> — money, no competition.
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 3 (amber) — handoff + subscribe ================= */
const SceneW3Handoff: React.FC = () => {
  const frame = useCurrentFrame();
  const hand = useIn(f(443.72), 14);
  const subP = useSpring(f(453.11), 18, 12);
  const clicked = frame >= f(454.53);
  return (
    <St cx={W3H.x} cy={W3H.y}>
      <div style={{ width: 1600, textAlign: "center" }}>
        <div style={{ opacity: hand, fontFamily: SANS, fontWeight: 700, fontSize: 60, color: AMB_L }}>
          a product pays <span style={{ color: "rgba(241,234,218,0.6)" }}>when you sell</span>. the next pays <span style={{ color: LIME }}>every month →</span>
        </div>
        <div style={{ marginTop: 70, opacity: subP, transform: `translateY(${(1 - subP) * 30}px)` }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 18, background: clicked ? AMB_ENV : LIME, border: `3px solid ${LIME}`, color: clicked ? LIME : AMB_ENV, fontFamily: SANS, fontWeight: 700, fontSize: 48, padding: "20px 44px", borderRadius: 60 }}>
            {clicked ? "SUBSCRIBED ✓" : "SUBSCRIBE"}
          </span>
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 4 (indigo) — title + the Fable ban ================= */
const SceneW4Ban: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(458.11), 12);
  const cardIn = useSpring(f(460.66), 18, 12);
  const stamp = interpolate(frame, [f(462.31), f(463.76)], [0, 1], clamp);
  return (
    <St cx={W4T.x} cy={W4T.y}>
      <div style={{ width: 1700, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>WAY 4 · OWN THE MEMORY</Kicker></div>
        <div style={{ marginTop: 50, opacity: cardIn, transform: `translateY(${(1 - cardIn) * 30}px)`, background: "rgba(228,233,245,0.06)", border: `2px solid ${IND_L}`, borderRadius: 18, padding: "44px 56px", display: "flex", alignItems: "center", gap: 40, position: "relative" }}>
          <img src={staticFile("logos/anthropic.png")} style={{ width: 130, height: 130, borderRadius: 20, background: "#fff", padding: 14, objectFit: "contain", flexShrink: 0 }} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: MONO, fontSize: 28, letterSpacing: "0.16em", color: "rgba(228,233,245,0.55)" }}>THE VERGE · JUN 2026</div>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 74, color: IND_L, marginTop: 12, maxWidth: 1100 }}>US government <span style={{ color: "#FF6B5A" }}>bans</span> Anthropic's Fable 5</div>
          </div>
          <div style={{ position: "absolute", right: -30, top: -30, transform: `scale(${0.5 + 0.5 * stamp}) rotate(-8deg)`, opacity: stamp, fontFamily: SANS, fontWeight: 700, fontSize: 44, color: "#fff", background: "#C0392B", padding: "8px 26px", borderRadius: 8 }}>GONE</div>
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 46, color: "rgba(228,233,245,0.7)", marginTop: 30, opacity: stamp }}>the model my whole system ran on — overnight.</div>
      </div>
    </St>
  );
};

/* ================= WAY 4 (indigo) — the model is just the worker (swappable) ================= */
const BaseItemIcon: React.FC<{ kind: string }> = ({ kind }) => {
  const c = IND_ENV;
  const p: Record<string, React.ReactNode> = {
    clips: <><rect x="12" y="18" width="56" height="44" rx="7" fill="none" stroke={c} strokeWidth="5" /><path d="M34 30 L50 40 L34 50 Z" fill={c} /></>,
    transcripts: <><rect x="18" y="12" width="44" height="56" rx="5" fill="none" stroke={c} strokeWidth="5" /><path d="M27 28 h26 M27 40 h26 M27 52 h16" stroke={c} strokeWidth="5" strokeLinecap="round" /></>,
    numbers: <><path d="M16 60 V40 M32 60 V26 M48 60 V32 M64 60 V18" stroke={c} strokeWidth="7" strokeLinecap="round" /></>,
  };
  return <svg width={64} height={64} viewBox="0 0 80 80">{p[kind]}</svg>;
};
const SceneW4Model: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(470.45), 12);
  const baseIn = useSpring(f(471.67), 20, 13);
  // the worker swaps out seamlessly (Fable lifts out, Opus drops in) — "didn't even notice"
  const swap = interpolate(frame, [f(474.85), f(477.43)], [0, 1], { ...clamp, easing: EASE });
  const live = useIn(f(478.03), 14);           // "everything kept working" — a live status stays lit
  // the three items drop into the base ON their spoken word
  const clips = useSpring(f(481.87), 16, 12);
  const trans = useSpring(f(482.65), 16, 12);
  const nums = useSpring(f(483.71), 16, 12);
  const items = [{ p: clips, kind: "clips", t: "clips" }, { p: trans, kind: "transcripts", t: "transcripts" }, { p: nums, kind: "numbers", t: "numbers" }];
  const org = useIn(f(485.38), 14);            // "one organized place · any AI can read"
  const emph = useIn(f(490.18), 16);           // "the model is just the worker / that is the business"
  // captions crossfade so only one idea is on screen at a time
  const capLive = live * (1 - org);
  const capOrg = org * (1 - emph);
  return (
    <St cx={W4M.x} cy={W4M.y}>
      <div style={{ width: 1300, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>THE MODEL IS JUST THE WORKER</Kicker></div>

        {/* WORKER socket — swappable, sits ON TOP of the base */}
        <div style={{ position: "relative", height: 108, marginTop: 46, opacity: baseIn }}>
          <div style={{ position: "absolute", left: "50%", top: 0, transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 16, opacity: emph ? 0.45 : 1 }}>
            <span style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.12em", color: "rgba(228,233,245,0.5)" }}>WORKER</span>
            <div style={{ position: "relative", width: 300, height: 74 }}>
              {/* Fable chip lifts out */}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, border: `2px solid rgba(228,233,245,0.4)`, opacity: 1 - swap, transform: `translateY(${-swap * 46}px)`, fontFamily: MONO, fontSize: 28, color: "rgba(228,233,245,0.55)" }}>FABLE 5 ✕</div>
              {/* Opus chip drops in */}
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, border: `2px solid ${LIME}`, background: "rgba(207,255,5,0.08)", opacity: swap, transform: `translateY(${(1 - swap) * -46}px)`, fontFamily: MONO, fontSize: 28, color: LIME }}>OPUS 4.8</div>
            </div>
            <span style={{ fontFamily: MONO, fontSize: 22, color: LIME, opacity: live, display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: "50%", background: LIME, display: "inline-block" }} />live</span>
          </div>
        </div>

        {/* plug line into the base */}
        <div style={{ width: 3, height: 30, background: `rgba(228,233,245,0.4)`, margin: "0 auto", opacity: baseIn }} />

        {/* THE BASE — persistent; items drop in as spoken */}
        <div style={{ position: "relative", width: 900, margin: "0 auto", height: 220, background: emph ? LIME : "rgba(228,233,245,0.06)", border: `3px solid ${LIME}`, borderRadius: 18, opacity: baseIn, transition: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: emph ? "0 0 50px rgba(207,255,5,0.3)" : "none" }}>
          <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: "0.04em", color: emph ? IND_ENV : IND_L, marginBottom: 14 }}>{emph > 0.5 ? "THE BUSINESS — YOURS" : "YOUR BASE"}</span>
          <div style={{ display: "flex", gap: 26 }}>
            {items.map((it, i) => (
              <div key={i} style={{ opacity: it.p, transform: `translateY(${(1 - it.p) * 40}px) scale(${0.7 + 0.3 * it.p})`, width: 150, height: 96, borderRadius: 12, background: emph ? "rgba(26,22,42,0.12)" : "rgba(207,255,5,0.14)", border: `2px solid ${emph ? IND_ENV : LIME}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <BaseItemIcon kind={it.kind} />
                <span style={{ fontFamily: MONO, fontSize: 20, color: emph ? IND_ENV : IND_L }}>{it.t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* evolving caption — one idea at a time */}
        <div style={{ position: "relative", height: 70, marginTop: 30 }}>
          <div style={{ position: "absolute", inset: 0, opacity: capLive, fontFamily: SERIF, fontStyle: "italic", fontSize: 44, color: IND_L }}>you swapped the model — it <span style={{ color: LIME }}>never skipped a beat</span>.</div>
          <div style={{ position: "absolute", inset: 0, opacity: capOrg, fontFamily: SERIF, fontStyle: "italic", fontSize: 44, color: IND_L }}>one organized place — <span style={{ color: LIME }}>any AI can read it</span>.</div>
          <div style={{ position: "absolute", inset: 0, opacity: emph, fontFamily: SERIF, fontStyle: "italic", fontSize: 46, color: IND_L }}>swap the worker. the <span style={{ color: LIME }}>memory</span> is the business.</div>
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 4 (indigo) — scattered → one place ================= */
const SceneW4Scatter: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(496.15), 12);
  const gather = interpolate(frame, [f(498.87), f(509.85)], [0, 1], { ...clamp, easing: EASE });
  const answer = useIn(f(512.58), 14);
  const sources = [{ x: -560, y: -170, t: "ORDERS" }, { x: 540, y: -190, t: "EMAIL" }, { x: -600, y: 150, t: "CUSTOMERS" }, { x: 560, y: 170, t: "INVOICES" }];
  return (
    <St cx={W4S.x} cy={W4S.y}>
      <div style={{ position: "relative", width: 1700, height: 620 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: -40, textAlign: "center", opacity: k }}><Kicker p={1} light>SCATTERED DATA → ONE CLEAN LAYER</Kicker></div>
        {sources.map((s, i) => (
          <div key={i} style={{ position: "absolute", left: `calc(50% + ${s.x * (1 - gather)}px)`, top: `calc(50% + ${s.y * (1 - gather)}px)`, transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: 34, color: IND_L, background: "rgba(228,233,245,0.08)", border: `2px solid rgba(228,233,245,0.4)`, padding: "14px 26px", borderRadius: 10, opacity: 1 - gather * 0.5 }}>{s.t}</div>
        ))}
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%,-50%) scale(${0.6 + 0.4 * gather})`, opacity: gather, width: 320, height: 200, background: LIME, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 700, fontSize: 40, color: IND_ENV }}>ONE BASE</div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: -30, textAlign: "center", opacity: answer, fontFamily: SERIF, fontStyle: "italic", fontSize: 46, color: IND_L }}>now their AI can <span style={{ color: LIME }}>answer questions</span>.</div>
      </div>
    </St>
  );
};

/* ================= WAY 4 (indigo) — free upgrade ================= */
const SceneW4Upgrade: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(513.06), 12);
  const plug = useSpring(f(516.18), 18, 12);
  const genius = useIn(f(523.0), 14);
  return (
    <St cx={W4U.x} cy={W4U.y}>
      <div style={{ width: 1700, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>EVERY NEW MODEL = A FREE UPGRADE</Kicker></div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 40, marginTop: 60, opacity: plug }}>
          <span style={{ fontFamily: MONO, fontSize: 34, color: IND_L, border: `2px solid ${IND_L}`, padding: "16px 30px", borderRadius: 12 }}>NEW MODEL</span>
          <svg width={100} height={44}><path d="M6 22 H84" stroke={LIME} strokeWidth="7" strokeLinecap="round" /><path d="M72 10 L92 22 L72 34" fill="none" stroke={LIME} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 44, color: IND_ENV, background: LIME, padding: "18px 34px", borderRadius: 12 }}>WHOLE SYSTEM +1</span>
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 58, color: IND_L, marginTop: 44, opacity: genius }}>you did <span style={{ color: "rgba(228,233,245,0.5)" }}>nothing</span> — you look like a <span style={{ color: LIME }}>genius</span>.</div>
      </div>
    </St>
  );
};

/* ================= WAY 4 (indigo) — the offer, built line-by-line as spoken ================= */
const SceneW4Offer: React.FC = () => {
  const cardIn = useSpring(f(526.59), 18, 13);
  // three promises, each lands on its spoken phrase
  const l1 = useSpring(f(529.1), 16, 12);   // "all your business data → one place"
  const l2 = useSpring(f(533.92), 16, 12);   // "every new model makes it better"
  const l3 = useSpring(f(536.5), 16, 12);   // "at no extra cost"
  const rows = [
    { p: l1, k: "ALL YOUR DATA", v: "in one place your AI can use" },
    { p: l2, k: "EVERY NEW MODEL", v: "makes it better automatically" },
    { p: l3, k: "AT NO EXTRA COST", v: "you touch nothing" },
  ];
  return (
    <St cx={W4O.x} cy={W4O.y}>
      <div style={{ width: 1400, textAlign: "center" }}>
        <div style={{ opacity: cardIn }}><Kicker p={1} light>THE OFFER — WHAT YOU SAY</Kicker></div>
        <div style={{ marginTop: 40, opacity: cardIn, transform: `translateY(${(1 - cardIn) * 26}px)`, background: "rgba(228,233,245,0.05)", border: `2px solid ${IND_L}`, borderRadius: 24, padding: "44px 54px", display: "flex", flexDirection: "column", gap: 20 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ opacity: r.p, transform: `translateX(${(1 - r.p) * -30}px)`, display: "flex", alignItems: "center", gap: 24, textAlign: "left" }}>
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: LIME, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width={26} height={26} viewBox="0 0 26 26"><path d="M5 13 L11 19 L21 7" fill="none" stroke={IND_ENV} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <div>
                <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 44, color: LIME }}>{r.k}</span>
                <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 38, color: IND_L }}> — {r.v}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 4 (indigo) — price (recurring) ================= */
const SceneW4Price: React.FC = () => {
  const k = useIn(f(537.4), 10);
  const p1 = useSpring(f(538.2), 16, 11);
  const p2 = useSpring(f(541.21), 16, 11);
  return (
    <St cx={W4P.x} cy={W4P.y}>
      <div style={{ width: 1500, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>THE PRICE · RECURRING</Kicker></div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: 60, marginTop: 40 }}>
          <div style={{ opacity: p1 }}>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 180, color: IND_L, lineHeight: 1 }}>€5K</div>
            <div style={{ fontFamily: MONO, fontSize: 30, color: "rgba(228,233,245,0.6)" }}>SETUP</div>
          </div>
          <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 90, color: "rgba(228,233,245,0.4)" }}>+</span>
          <div style={{ opacity: p2 }}>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 180, color: LIME, lineHeight: 1 }}>€1.5K</div>
            <div style={{ fontFamily: MONO, fontSize: 30, color: LIME }}>EVERY MONTH</div>
          </div>
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 44, color: "rgba(228,233,245,0.7)", marginTop: 34, opacity: p2 }}>five clients = €7.5K / month. every month.</div>
      </div>
    </St>
  );
};

/* ================= WAY 4 (indigo) — Monday + handoff ================= */
const DataIcon: React.FC<{ kind: string }> = ({ kind }) => {
  const c = IND_L;
  const paths: Record<string, React.ReactNode> = {
    orders: <><rect x="14" y="20" width="52" height="44" rx="6" fill="none" stroke={c} strokeWidth="5" /><path d="M26 34 h28 M26 46 h20" stroke={c} strokeWidth="5" strokeLinecap="round" /></>,
    email: <><rect x="12" y="20" width="56" height="42" rx="6" fill="none" stroke={c} strokeWidth="5" /><path d="M14 24 L40 44 L66 24" fill="none" stroke={c} strokeWidth="5" strokeLinejoin="round" /></>,
    invoices: <><rect x="18" y="12" width="44" height="58" rx="5" fill="none" stroke={c} strokeWidth="5" /><path d="M28 30 h24 M28 42 h24 M28 54 h14" stroke={c} strokeWidth="5" strokeLinecap="round" /></>,
    planning: <><rect x="14" y="18" width="52" height="50" rx="6" fill="none" stroke={c} strokeWidth="5" /><path d="M14 32 h52 M28 12 v10 M52 12 v10" stroke={c} strokeWidth="5" strokeLinecap="round" /></>,
    customers: <><circle cx="40" cy="30" r="12" fill="none" stroke={c} strokeWidth="5" /><path d="M18 66 c0 -16 10 -24 22 -24 c12 0 22 8 22 24" fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" /></>,
  };
  return <svg width={80} height={80} viewBox="0 0 80 80">{paths[kind]}</svg>;
};
const SceneW4Monday: React.FC = () => {
  const k = useIn(f(549.4), 12);
  const items = [["orders", f(550.72)], ["email", f(551.84)], ["invoices", f(552.74)], ["planning", f(553.64)], ["customers", f(554.55)]] as const;
  const hand = useIn(f(558.35), 14);
  return (
    <St cx={W4MO.x} cy={W4MO.y}>
      <div style={{ width: 1700, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>YOUR MONDAY MOVE</Kicker></div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 56, color: IND_L, marginTop: 34 }}>list the <span style={{ color: LIME }}>5 places</span> a business hides its data.</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 30, marginTop: 50 }}>
          {items.map(([kind, at], i) => {
            const p = useSpring(at, 16, 12);
            return (
              <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 22}px)`, width: 260, background: "rgba(228,233,245,0.06)", border: `2px solid rgba(228,233,245,0.3)`, borderRadius: 16, padding: "28px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <DataIcon kind={kind} />
                <span style={{ fontFamily: MONO, fontSize: 26, letterSpacing: "0.08em", color: IND_L }}>{kind}</span>
              </div>
            );
          })}
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 46, color: IND_L, marginTop: 46, opacity: hand }}>
          money <span style={{ color: LIME }}>every month</span> — where most people stop. <span style={{ color: "rgba(228,233,245,0.55)" }}>one rung left →</span>
        </div>
      </div>
    </St>
  );
};

/* ================= WAY 5 (violet) — title ================= */
const SceneW5Title: React.FC = () => {
  const t = useSpring(f(564.77), 22, 13);
  const t2 = useIn(f(567.36), 14);
  return (
    <St cx={W5T.x} cy={W5T.y}>
      <div style={{ width: 1700, textAlign: "center", opacity: t, transform: `translateY(${(1 - t) * 34}px)` }}>
        <Kicker p={1} light>WAY 5 · COMPOUNDS FOR YEARS</Kicker>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 140, letterSpacing: "-0.03em", color: VIO_L, marginTop: 34, lineHeight: 1 }}>
          Take a <span style={{ background: LIME, color: VIO_ENV, padding: "0 22px", borderRadius: 14 }}>share</span>.
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 64, color: "rgba(236,228,245,0.65)", marginTop: 22, opacity: t2 }}>not an invoice.</div>
      </div>
    </St>
  );
};

/* ================= WAY 5 (violet) — the invoice you give up ================= */
const SceneW5Invoice: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(575.01), 12);
  const inv = useSpring(f(575.71), 18, 12);
  const strike = interpolate(frame, [f(579.21), f(580.71)], [0, 1], clamp);
  return (
    <St cx={W5I.x} cy={W5I.y}>
      <div style={{ width: 1500, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>THE ONE THING YOU GIVE UP</Kicker></div>
        <div style={{ position: "relative", display: "inline-block", marginTop: 50, opacity: inv, transform: `translateY(${(1 - inv) * 26}px)` }}>
          <svg width={280} height={340} viewBox="0 0 280 340"><rect x="20" y="12" width="240" height="316" rx="12" fill="rgba(236,228,245,0.08)" stroke={VIO_L} strokeWidth="6" /><path d="M56 70 H224 M56 118 H224 M56 166 H180" stroke={VIO_L} strokeWidth="6" strokeLinecap="round" /><text x="56" y="270" fontFamily={SANS} fontWeight="700" fontSize="52" fill={VIO_L}>€ due</text></svg>
          <div style={{ position: "absolute", left: "6%", top: "48%", height: 12, width: `${strike * 88}%`, background: "#FF6B5A", borderRadius: 6, transform: "rotate(-8deg)" }} />
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 48, color: "rgba(236,228,245,0.75)", marginTop: 30, opacity: strike }}>safe, fixed, paid in 30 days — <span style={{ color: VIO_L }}>and it pays once.</span></div>
      </div>
    </St>
  );
};

/* ================= WAY 5 (violet) — the compounding gap ================= */
const SceneW5Compound: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(584.71), 12);
  const you = useSpring(f(585.71), 18);
  const them = Array.from({ length: 4 }).map((_, i) => useSpring(f(589.21) + i * 3, 14, 12));
  const label = useIn(f(598.13), 14);
  return (
    <St cx={W5C.x} cy={W5C.y}>
      <div style={{ width: 1800, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>WHO KEEPS THE UPSIDE</Kicker></div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 120, marginTop: 60, height: 420 }}>
          <div style={{ opacity: you, textAlign: "center" }}>
            <div style={{ width: 200, height: 90, background: "rgba(236,228,245,0.22)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 700, fontSize: 40, color: VIO_L }}>€2.5K</div>
            <div style={{ fontFamily: MONO, fontSize: 26, color: "rgba(236,228,245,0.6)", marginTop: 12 }}>YOU · ONCE</div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
            {them.map((p, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ width: 130, height: (110 + i * 90) * p, background: LIME, borderRadius: "8px 8px 0 0" }} />
                <div style={{ fontFamily: MONO, fontSize: 22, color: "rgba(236,228,245,0.5)", marginTop: 10 }}>Y{i + 1}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 52, color: VIO_L, marginTop: 30, opacity: label }}>they keep <span style={{ color: LIME }}>€50K a year</span> — and it compounds forever.</div>
      </div>
    </St>
  );
};

/* ================= WAY 5 (violet) — investors buy the businesses (icons + $3B) ================= */
const BizIcon: React.FC<{ kind: string }> = ({ kind }) => {
  const c = VIO_L;
  const p: Record<string, React.ReactNode> = {
    accounting: <><rect x="16" y="14" width="48" height="52" rx="6" fill="none" stroke={c} strokeWidth="5" /><path d="M26 28 h28 M26 40 h12 M44 40 h10 M26 52 h12 M44 52 h10" stroke={c} strokeWidth="5" strokeLinecap="round" /></>,
    property: <><path d="M14 38 L40 16 L66 38 V66 H14 Z" fill="none" stroke={c} strokeWidth="5" strokeLinejoin="round" /><rect x="34" y="46" width="14" height="20" fill="none" stroke={c} strokeWidth="4" /></>,
    pest: <><circle cx="40" cy="40" r="16" fill="none" stroke={c} strokeWidth="5" /><path d="M40 24 v-8 M24 40 h-8 M56 40 h8 M40 56 v8 M28 28 l-6 -6 M52 28 l6 -6" stroke={c} strokeWidth="5" strokeLinecap="round" /></>,
  };
  return <svg width={90} height={90} viewBox="0 0 80 80">{p[kind]}</svg>;
};
const SceneW5Investors: React.FC = () => {
  const k = useIn(f(602.85), 12);
  const three = "$3B+".split("");
  const cards = [["accounting", "accounting firms", f(609.07)], ["property", "property managers", f(611.28)], ["pest", "pest control", f(613.29)]] as const;
  const punch = useSpring(f(620.05), 18, 12);
  return (
    <St cx={W5V.x} cy={W5V.y}>
      <div style={{ width: 1700, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>SILICON VALLEY ALREADY MOVED</Kicker></div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 130, color: LIME, marginTop: 10, letterSpacing: "-0.03em" }}>$3B+ <span style={{ fontSize: 44, color: "rgba(236,228,245,0.6)" }}>into boring businesses</span></div>
        <div style={{ display: "flex", justifyContent: "center", gap: 40, marginTop: 40 }}>
          {cards.map(([kind, label, at], i) => {
            const p = useSpring(at, 16, 12);
            return (
              <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 22}px)`, width: 360, background: "rgba(236,228,245,0.06)", border: `2px solid rgba(236,228,245,0.3)`, borderRadius: 16, padding: "26px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <BizIcon kind={kind} />
                <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: VIO_L }}>{label}</span>
                <span style={{ fontFamily: MONO, fontSize: 24, color: LIME }}>+ AI → 2× margins</span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 40, opacity: punch, transform: `scale(${0.92 + 0.08 * punch})`, fontFamily: SERIF, fontStyle: "italic", fontSize: 52, color: VIO_L }}>they're not selling AI — they're <span style={{ color: LIME, fontStyle: "normal", fontFamily: SANS, fontWeight: 700 }}>buying the companies</span>.</div>
      </div>
    </St>
  );
};

/* ================= WAY 5 (violet) — two prices + buy one ================= */
const SceneW5TwoPrices: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useIn(f(624.57), 12);
  const a = useSpring(f(629.65), 18, 12);      // "price one, your full fee"
  const b = useSpring(f(631.95), 18, 12);      // "price two, half the fee"
  const pct = useIn(f(634.93), 14);            // "a small % of what it earns every month"
  const coins = Array.from({ length: 6 }).map((_, i) => useSpring(f(635.73) + i * 0.5, 12, 12)); // recurring months
  const piece = useIn(f(640.42), 14);          // "owning a piece of the result, not paid once"
  const buy = useIn(f(646.32), 14);            // "buy a small boring business, keep all of it"
  const once = interpolate(frame, [f(640.42), f(641.92)], [0, 1], clamp); // Price 1 → "paid once" strike
  return (
    <St cx={W5P.x} cy={W5P.y}>
      <div style={{ width: 1800, textAlign: "center" }}>
        <div style={{ opacity: k }}><Kicker p={1} light>YOUR VERSION · NO BILLIONS NEEDED</Kicker></div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 50, marginTop: 46 }}>
          {/* PRICE 1 — full fee, paid once (dims as Price 2 wins) */}
          <div style={{ opacity: a * (1 - piece * 0.45), transform: `translateY(${(1 - a) * 24}px)`, width: 480, background: "rgba(236,228,245,0.06)", border: `2px solid rgba(236,228,245,0.4)`, borderRadius: 20, padding: "40px 44px" }}>
            <div style={{ fontFamily: MONO, fontSize: 26, color: "rgba(236,228,245,0.55)" }}>PRICE 1</div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 56, color: VIO_L, marginTop: 14 }}>full fee</div>
            <div style={{ position: "relative", display: "inline-block", marginTop: 6 }}>
              <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 32, color: "rgba(236,228,245,0.6)" }}>paid once</span>
              <div style={{ position: "absolute", left: -4, top: "52%", height: 5, width: `${once * 108}%`, background: "#FF6B5A", borderRadius: 4 }} />
            </div>
          </div>
          {/* PRICE 2 — half fee + a recurring % (the hero) */}
          <div style={{ opacity: b, transform: `translateY(${(1 - b) * 24}px) scale(${1 + piece * 0.03})`, width: 560, background: LIME, borderRadius: 20, padding: "40px 44px", boxShadow: piece > 0.2 ? "0 0 50px rgba(207,255,5,0.35)" : "none" }}>
            <div style={{ fontFamily: MONO, fontSize: 26, color: VIO_ENV }}>PRICE 2</div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 56, color: VIO_ENV, marginTop: 14 }}>half fee <span style={{ opacity: pct }}>+ a %</span></div>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 28, color: "rgba(26,14,42,0.72)", opacity: pct }}>of what it earns — every month it runs</div>
            {/* recurring income stream — one coin per month, growing */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 12, height: 120, marginTop: 20 }}>
              {coins.map((p, i) => (
                <div key={i} style={{ opacity: p, transform: `translateY(${(1 - p) * 20}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 40, height: (36 + i * 12) * p, background: VIO_ENV, borderRadius: "6px 6px 0 0" }} />
                  <span style={{ fontFamily: MONO, fontSize: 16, color: "rgba(26,14,42,0.6)" }}>M{i + 1}</span>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, color: VIO_ENV, marginTop: 8, opacity: piece }}>you own a piece of the result</div>
          </div>
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 46, color: VIO_L, marginTop: 34, opacity: buy }}>or go further — <span style={{ color: LIME }}>buy a small boring business</span> and keep all of it.</div>
      </div>
    </St>
  );
};

/* ================= OUTRO — full-screen speaker + lower-third overlays ================= */
const OutroOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W } = useVideoConfig();
  const px = (v: number) => W * v;
  const scrim = interpolate(frame, [f(652.8), f(654.2)], [0, 1], clamp);
  const seg = (a: number, b: number) => interpolate(frame, [f(a), f(a) + 9, f(b) - 8, f(b)], [0, 1, 1, 0], clamp);
  // beats, aligned to the outro VO
  const bA = seg(653.8, 656.5);                                                          // "all five get stronger every month"
  const bB = interpolate(frame, [f(656.8), f(657.7), f(662.2), f(663.0)], [0, 1, 1, 0], clamp); // "they sell knowing"
  const bC = seg(662.9, 667.1);                                                          // "drop a comment"
  const bD = seg(667.3, 671.2);                                                          // "links in the description"
  const bE = interpolate(frame, [f(671.3), f(672.2)], [0, 1], clamp);                     // "see you in the next one"
  const ch = [
    interpolate(frame, [f(658.6), f(659.3)], [0, 1], clamp),   // where to start
    interpolate(frame, [f(659.9), f(660.6)], [0, 1], clamp),   // what to fix
    interpolate(frame, [f(661.2), f(661.9)], [0, 1], clamp),   // what it's worth
  ];
  const knowings = ["where to start", "what to fix", "what it's worth"];
  const block: React.CSSProperties = { position: "absolute", left: px(0.062), bottom: px(0.11) };
  const eyebrow: React.CSSProperties = { fontFamily: SERIF, fontStyle: "italic", color: "rgba(255,255,255,0.66)" };
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "52%", background: "linear-gradient(to top, rgba(15,18,26,0.85), rgba(15,18,26,0.4) 42%, transparent)", opacity: scrim, pointerEvents: "none" }} />
      {/* A — all five get stronger */}
      <div style={{ ...block, opacity: bA }}>
        <div style={{ ...eyebrow, fontSize: px(0.026) }}>all five ideas</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: px(0.052), color: "#fff", marginTop: px(0.006) }}>get <span style={{ color: LIME }}>stronger</span> every month.</div>
      </div>
      {/* B — they sell knowing (hero) */}
      <div style={{ ...block, opacity: bB }}>
        <div style={{ ...eyebrow, fontSize: px(0.026) }}>they don't sell code.</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: px(0.07), color: "#fff", marginTop: px(0.004), lineHeight: 1 }}>they sell <span style={{ background: LIME, color: RAISIN, padding: `0 ${px(0.013)}px`, borderRadius: px(0.008) }}>knowing</span>.</div>
        <div style={{ display: "flex", gap: px(0.012), marginTop: px(0.018) }}>
          {knowings.map((t, i) => (
            <span key={i} style={{ opacity: ch[i], transform: `translateY(${(1 - ch[i]) * px(0.01)}px)`, fontFamily: MONO, fontSize: px(0.019), color: "#fff", border: `2px solid rgba(255,255,255,0.42)`, borderRadius: px(0.006), padding: `${px(0.007)}px ${px(0.013)}px` }}>{t}</span>
          ))}
        </div>
      </div>
      {/* C — leave a comment */}
      <div style={{ ...block, opacity: bC, display: "flex", alignItems: "center", gap: px(0.018) }}>
        <svg width={px(0.052)} height={px(0.052)} viewBox="0 0 60 60"><path d="M8 12 h44 a4 4 0 0 1 4 4 v22 a4 4 0 0 1 -4 4 H26 L14 52 V42 H8 a4 4 0 0 1 -4 -4 V16 a4 4 0 0 1 4 -4 Z" fill="none" stroke={LIME} strokeWidth="4" strokeLinejoin="round" /></svg>
        <div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: px(0.044), color: "#fff" }}>got a question? <span style={{ color: LIME }}>drop a comment.</span></div>
          <div style={{ ...eyebrow, fontSize: px(0.026) }}>I answer every single one.</div>
        </div>
      </div>
      {/* D — description */}
      <div style={{ ...block, opacity: bD, display: "flex", alignItems: "center", gap: px(0.018) }}>
        <svg width={px(0.052)} height={px(0.052)} viewBox="0 0 60 60"><path d="M25 35 a10 10 0 0 0 14 0 l7 -7 a10 10 0 0 0 -14 -14 l-3 3 M35 25 a10 10 0 0 0 -14 0 l-7 7 a10 10 0 0 0 14 14 l3 -3" fill="none" stroke={LIME} strokeWidth="4" strokeLinecap="round" /></svg>
        <div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: px(0.044), color: "#fff" }}>the <span style={{ color: LIME }}>deeper systems</span> are in the description.</div>
          <div style={{ ...eyebrow, fontSize: px(0.026) }}>go one level deeper on all of this.</div>
        </div>
      </div>
      {/* E — see you */}
      <div style={{ ...block, opacity: bE }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: px(0.062), color: "#fff", lineHeight: 1 }}>see you in the <span style={{ color: LIME }}>next one</span>.</div>
        <div style={{ ...eyebrow, fontSize: px(0.03), marginTop: px(0.008) }}>— Luuk</div>
      </div>
    </>
  );
};

export default FiveWaysEdit;

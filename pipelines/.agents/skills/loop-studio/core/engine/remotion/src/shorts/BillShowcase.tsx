/**
 * BillShowcase v3 — stations on the canvas + register switches.
 *
 * Luuk's v2 notes: simplify the invoice; the credentials/EXPOSED beat is its own
 * SECTION of the canvas, not part of the bill; more movement between sections;
 * switch background color when appropriate.
 *
 * World layout (stations the camera travels between):
 *   INVOICE   (150..1650, 2050..3800)  — clean bill: header, table, TOTAL DUE, footer
 *   LEAK      (~2350, 3550)            — the key station, right of the invoice; tear + EXPOSED
 *   SCATTER   (whole canvas)           — 12 keys littered wide (dark register)
 *   SPARK     (2950, 2050)             — up-then-snap chart
 *   JAPAN     (1900, 5250)             — the real photo, deep down the canvas
 *   LOCK      (1900, 5500)             — keys fly home; lime pulse
 *   CTA       (1900, 5860)             — ghost total + comment pill
 *
 * Register: light silver → DARK RAISIN from the leak through Japan ("going well
 * until it's not") → light returns at "it had to happen".
 */
import React from "react";
import {
  AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
} from "remotion";

const FPS = 30;
const f = (sec: number) => Math.round(sec * FPS);

const RAISIN = "#0F121A";
const SILVER_BG = "#E9ECED";
const SILVER_SOFT = "#D2D8DA";
const BODY = "#5A6068";
const LIME = "#CFFF05";
const RED = "#D4482E";
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const SERIF = "'Playfair Display', Georgia, serif";

const EASE = Easing.bezier(0.45, 0, 0.18, 1);
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

/* ---------------- anchors ---------------- */
const T = {
  cardOut: 72,
  rollStart: f(3.76), rollLand: f(5.14),
  zeroRows: [f(6.56), f(6.9), f(7.2)],
  redRule: f(7.38),
  keyIn: f(8.64),                    // "API" — the leak station wakes as the camera arrives
  tearAt: f(9.62),                   // "leaked"
  exposedAt: f(10.1),
  italicAt: f(11.1), italicOut: f(13.2),
  darkIn: f(8.8), darkInEnd: f(10.0),   // canvas goes dark as we enter the leak section
  scatterFrom: f(17.94),
  sparkUp: f(20.76), sparkSnap: f(22.16),
  photoAt: f(25.32), notifAt: f(26.4), pulseAt: f(27.76),
  clearAt: f(29.16),                 // light returns; world clears
  darkOutEnd: f(30.4),
  lockAt: f(36.96), keysFlyFrom: f(37.4), lockClose: f(40.3),
  ghostAt: f(40.56), pillAt: f(42.76),
  fadeOut: 1360,
};

/* ---------------- world camera: station to station ---------------- */
const CAM: [number, number, number, number][] = [
  [0, 900, 3090, 1.05],
  [70, 900, 3090, 1.05],
  [102, 900, 3230, 0.85],   // INVOICE: the total, big
  [160, 900, 3225, 0.84],
  [197, 900, 2690, 0.78],   // up the bill: the zero table
  [252, 900, 2860, 0.66],   // table + total in one frame
  [262, 900, 2865, 0.66],
  [284, 2620, 3660, 0.70],  // TRAVEL RIGHT → the leak station (canvas darkens en route)
  [310, 2700, 3700, 0.68],
  [480, 2680, 3760, 0.68],
  [545, 1900, 3500, 0.36],  // pull WAY back: keys everywhere on the dark canvas
  [693, 1900, 3480, 0.36],
  [758, 1900, 5250, 0.70],  // dive DOWN → japan
  [905, 1900, 5250, 0.70],
  [945, 1900, 5300, 0.66],  // acceptance ease (light returns)
  [1080, 1900, 5390, 0.70], // the lock
  [1240, 1900, 5405, 0.72],
  [1285, 1900, 5440, 0.72], // CTA
  [1375, 1900, 5446, 0.725],
];
function cam(frame: number) {
  const ks = CAM;
  if (frame <= ks[0][0]) { const [, x, y, z] = ks[0]; return { x, y, z }; }
  for (let i = 0; i < ks.length - 1; i++) {
    const [fa, xa, ya, za] = ks[i]; const [fb, xb, yb, zb] = ks[i + 1];
    if (frame >= fa && frame <= fb) {
      const t = EASE((frame - fa) / Math.max(1, fb - fa));
      return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, z: za + (zb - za) * t };
    }
  }
  const [, x, y, z] = ks[ks.length - 1]; return { x, y, z };
}

const gridUri = (stroke: string) => {
  const s = 76;
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'><path d='M ${s} 0 L 0 0 0 ${s}' fill='none' stroke='${stroke}' stroke-width='1'/></svg>`
    )
  );
};
const GRID_LIGHT = gridUri("rgba(15,18,26,0.10)");
const GRID_DARK = gridUri("rgba(233,236,237,0.08)");

const useIn = (at: number, dur = 16) => {
  const frame = useCurrentFrame();
  if (frame < at) return 0;
  return interpolate(frame, [at, at + dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
};

/* ---------------- stations ---------------- */
const DOC = { x: 150, y: 2050, w: 1500, h: 1750 };
const KEYST = { x: 2350, y: 3550 };            // leak station start
const KEYLAND = { x: 3150, y: 3850 };          // where the key skids to
const SPARK = { x: 2950, y: 2050 };
const JAPAN = { x: 1900, y: 5250 };
const LOCK = { x: 1900, y: 5500 };
const SCATTER: { x: number; y: number; rot: number; file: string }[] = [
  { x: 200, y: 1400, rot: -8, file: ".env" },
  { x: 1200, y: 1250, rot: 5, file: "app.ts" },
  { x: 2300, y: 1350, rot: 4, file: "config" },
  { x: 3300, y: 1500, rot: -6, file: "api.ts" },
  { x: 3500, y: 2600, rot: 7, file: "notes" },
  { x: 200, y: 4300, rot: -4, file: "index.ts" },
  { x: 950, y: 4600, rot: -5, file: "readme" },
  { x: 2050, y: 4500, rot: 6, file: ".env.local" },
  { x: 3350, y: 3200, rot: 3, file: "utils.ts" },
  { x: 3100, y: 4700, rot: -7, file: "server.ts" },
  { x: 500, y: 5500, rot: 6, file: "deploy.sh" },
  { x: 2800, y: 5600, rot: -3, file: "client" },
];

/* ---------------- karaoke ---------------- */
type CapWord = { t: string; at: number };
const CAP_LINES: { words: CapWord[]; end: number }[] = [
  { words: [{ t: "I", at: 0.0 }, { t: "AM", at: 0.2 }, { t: "HONESTLY", at: 0.32 }], end: 0.76 },
  { words: [{ t: "VERY", at: 0.76 }, { t: "ASHAMED", at: 1.18 }], end: 1.6 },
  { words: [{ t: "TO", at: 1.6 }, { t: "SAY", at: 1.84 }, { t: "THIS", at: 2.06 }], end: 2.38 },
  { words: [{ t: "BUT", at: 2.38 }, { t: "I", at: 2.54 }, { t: "RECENTLY", at: 2.88 }], end: 3.24 },
  { words: [{ t: "AND", at: 5.42 }, { t: "I", at: 6.08 }, { t: "WAS", at: 6.38 }], end: 6.56 },
  { words: [{ t: "NOT", at: 6.56 }, { t: "HAVING", at: 6.78 }], end: 7.06 },
  { words: [{ t: "ANY", at: 7.06 }, { t: "USAGE", at: 7.38 }], end: 8.3 },
  { words: [{ t: "MY", at: 8.3 }, { t: "API", at: 8.64 }, { t: "KEY", at: 9.04 }], end: 9.36 },
  { words: [{ t: "GOT", at: 9.36 }, { t: "LEAKED", at: 9.62 }], end: 9.86 },
  { words: [{ t: "SOMEWHERE", at: 9.86 }], end: 10.4 },
  { words: [{ t: "BECAUSE", at: 10.4 }, { t: "HONESTLY", at: 11.08 }], end: 11.76 },
  { words: [{ t: "WITH", at: 13.3 }, { t: "AI", at: 13.62 }], end: 14.16 },
  { words: [{ t: "IT'S", at: 14.16 }, { t: "NOW", at: 14.24 }, { t: "SO", at: 14.4 }], end: 14.76 },
  { words: [{ t: "SIMPLE", at: 14.76 }, { t: "TO", at: 15.2 }, { t: "JUST", at: 15.38 }], end: 15.66 },
  { words: [{ t: "CREATE", at: 15.66 }, { t: "SOMETHING", at: 16.0 }], end: 16.4 },
  { words: [{ t: "AND", at: 16.4 }, { t: "IT", at: 16.76 }, { t: "WORKS", at: 17.24 }], end: 17.58 },
  { words: [{ t: "AND", at: 17.58 }, { t: "YOUR", at: 17.78 }], end: 17.94 },
  { words: [{ t: "API", at: 17.94 }, { t: "KEYS", at: 18.28 }, { t: "ARE", at: 18.64 }], end: 18.86 },
  { words: [{ t: "ALL", at: 18.86 }, { t: "OVER", at: 19.22 }], end: 19.42 },
  { words: [{ t: "THE", at: 19.42 }, { t: "PLACE", at: 19.54 }], end: 19.8 },
  { words: [{ t: "AND", at: 19.8 }, { t: "IT", at: 20.32 }, { t: "IS", at: 20.62 }], end: 20.76 },
  { words: [{ t: "GOING", at: 20.76 }, { t: "WELL", at: 20.96 }], end: 21.38 },
  { words: [{ t: "UNTIL", at: 21.38 }, { t: "IT'S", at: 21.88 }], end: 22.16 },
  { words: [{ t: "NOT", at: 22.16 }, { t: "GOING", at: 22.38 }, { t: "WELL", at: 22.64 }], end: 23.08 },
  { words: [{ t: "AND", at: 23.08 }, { t: "WHEN", at: 23.3 }, { t: "I", at: 23.48 }], end: 23.66 },
  { words: [{ t: "SAW", at: 23.66 }, { t: "THAT", at: 23.88 }, { t: "INVOICE", at: 24.02 }], end: 24.52 },
  { words: [{ t: "I", at: 24.52 }, { t: "WAS", at: 24.66 }, { t: "ACTUALLY", at: 24.78 }], end: 25.1 },
  { words: [{ t: "IN", at: 25.1 }, { t: "JAPAN", at: 25.32 }], end: 25.62 },
  { words: [{ t: "ON", at: 25.62 }, { t: "MY", at: 25.9 }, { t: "HOLIDAY", at: 26.02 }], end: 26.94 },
  { words: [{ t: "I", at: 26.94 }, { t: "WAS", at: 27.3 }, { t: "SWEATING", at: 27.76 }], end: 28.24 },
  { words: [{ t: "SO", at: 28.24 }, { t: "HARD", at: 28.6 }], end: 28.92 },
  { words: [{ t: "AND", at: 28.92 }, { t: "HONESTLY", at: 29.16 }], end: 29.8 },
  { words: [{ t: "MY", at: 29.8 }, { t: "REAL", at: 29.88 }, { t: "REACTION", at: 30.28 }], end: 30.74 },
  { words: [{ t: "WAS", at: 30.74 }, { t: "IT", at: 31.08 }, { t: "HAD", at: 31.48 }], end: 31.74 },
  { words: [{ t: "TO", at: 31.74 }, { t: "HAPPEN", at: 31.9 }], end: 32.2 },
  { words: [{ t: "BECAUSE", at: 32.2 }, { t: "I", at: 32.54 }, { t: "WAS", at: 32.84 }], end: 33.0 },
  { words: [{ t: "JUST", at: 33.0 }, { t: "NOT", at: 33.26 }, { t: "TAKING", at: 33.66 }], end: 34.12 },
  { words: [{ t: "IT", at: 34.12 }, { t: "SERIOUS", at: 34.3 }, { t: "ENOUGH", at: 34.66 }], end: 35.22 },
  { words: [{ t: "SO", at: 35.22 }, { t: "PLEASE", at: 35.38 }, { t: "LEARN", at: 35.74 }], end: 36.12 },
  { words: [{ t: "FROM", at: 36.12 }, { t: "ME", at: 36.4 }], end: 36.96 },
  { words: [{ t: "BE", at: 36.96 }, { t: "CAUTIOUS", at: 37.04 }], end: 37.4 },
  { words: [{ t: "WITH", at: 37.4 }, { t: "WHAT", at: 37.7 }, { t: "YOU", at: 37.92 }], end: 38.08 },
  { words: [{ t: "DO", at: 38.08 }, { t: "AND", at: 38.32 }, { t: "WHERE", at: 38.72 }], end: 39.02 },
  { words: [{ t: "YOU", at: 39.02 }, { t: "PUT", at: 39.22 }, { t: "YOUR", at: 39.46 }], end: 39.64 },
  { words: [{ t: "API", at: 39.64 }, { t: "KEYS", at: 39.88 }], end: 40.56 },
  { words: [{ t: "THAT", at: 40.56 }, { t: "BILL", at: 40.66 }, { t: "IS", at: 40.94 }], end: 41.34 },
  { words: [{ t: "NOT", at: 41.34 }, { t: "A", at: 41.54 }, { t: "FUN", at: 41.66 }], end: 41.84 },
  { words: [{ t: "ONE", at: 41.84 }, { t: "TO", at: 42.0 }, { t: "GET", at: 42.16 }], end: 42.54 },
  { words: [{ t: "LET", at: 42.54 }, { t: "ME", at: 42.62 }, { t: "KNOW", at: 42.76 }], end: 42.88 },
  { words: [{ t: "IN", at: 42.88 }, { t: "THE", at: 42.92 }, { t: "COMMENTS", at: 43.0 }], end: 43.22 },
  { words: [{ t: "IF", at: 43.22 }, { t: "ANY", at: 43.5 }, { t: "ONE", at: 43.88 }], end: 44.06 },
  { words: [{ t: "OF", at: 44.06 }, { t: "YOU", at: 44.14 }, { t: "GUYS", at: 44.3 }], end: 44.56 },
  { words: [{ t: "EVER", at: 44.56 }, { t: "HAD", at: 45.04 }, { t: "THIS", at: 45.28 }], end: 45.6 },
];

const Sfx: React.FC<{ src: string; at: number; volume?: number; rate?: number }> = ({ src, at, volume = 0.26, rate = 1 }) => (
  <Sequence from={at} durationInFrames={f(1.4)}>
    <Audio src={staticFile(src)} volume={volume} playbackRate={rate} />
  </Sequence>
);

const fmtMoney = (v: number) => {
  const int = Math.floor(v);
  return `€${int.toLocaleString("en-US")}.${v >= 2437 ? "19" : "00"}`;
};

const KeyChip: React.FC<{ scale?: number }> = ({ scale = 1 }) => (
  <div style={{
    display: "inline-flex", alignItems: "center", gap: 12 * scale,
    padding: `${10 * scale}px ${22 * scale}px`, borderRadius: 10 * scale,
    background: "#FFFFFF", border: `1.5px solid ${SILVER_SOFT}`,
    boxShadow: "0 3px 9px rgba(15,18,26,.10), 0 14px 30px -14px rgba(15,18,26,.18)",
  }}>
    <svg width={22 * scale} height={22 * scale} viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="12" r="4.5" stroke={RAISIN} strokeWidth="2" />
      <path d="M 12.5 12 H 21 M 18 12 v 4 M 15 12 v 3" stroke={RAISIN} strokeWidth="2" strokeLinecap="round" />
    </svg>
    <span style={{ fontFamily: MONO, fontSize: 24 * scale, color: RAISIN, whiteSpace: "nowrap" }}>key_live_9f2c41</span>
  </div>
);

/* ================================================================== */
export const BillShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;

  const c0 = cam(frame);
  const c = { x: c0.x + Math.sin(frame / 38) * 4, y: c0.y + Math.cos(frame / 47) * 3, z: c0.z };
  const worldStyle: React.CSSProperties = {
    position: "absolute", left: 0, top: 0, width: 0, height: 0,
    transform: `translate(${W / 2 - c.x * c.z}px, ${H / 2 - c.y * c.z}px) scale(${c.z})`,
    transformOrigin: "0 0",
  };
  const gridPos = `${W / 2 - c.x * c.z}px ${H / 2 - c.y * c.z}px`;

  const endFade = interpolate(frame, [T.fadeOut, 1375], [1, 0], clamp);

  /* register switch: light → dark (leak…japan) → light */
  const darkP =
    interpolate(frame, [T.darkIn, T.darkInEnd], [0, 1], clamp) *
    interpolate(frame, [T.clearAt, T.darkOutEnd], [1, 0], clamp);

  /* ---------- speaker card choreography ---------- */
  const spk = (() => {
    const kf: [number, number, number, number, number][] = [
      [0, 0.5, 0.5, 0.94, 0],
      [T.cardOut, 0.5, 0.5, 0.94, 0],
      [T.cardOut + 30, 0.27, 0.16, 0.30, -2],
      [190, 0.27, 0.16, 0.30, -2],
      [228, 0.76, 0.17, 0.28, 2],
      [268, 0.76, 0.17, 0.28, 2],
      [302, 0.25, 0.15, 0.30, -1.5],
      [480, 0.25, 0.15, 0.30, -1.5],
      [540, 0.5, 0.135, 0.30, 0],
      [700, 0.5, 0.135, 0.30, 0],
      [760, 0.5, 0.125, 0.26, -1],
      [905, 0.5, 0.125, 0.26, -1],
      [922, 0.5, 0.30, 0.52, 0],
      [1048, 0.5, 0.30, 0.52, 0],
      [1092, 0.24, 0.16, 0.28, -2],
      [1240, 0.24, 0.16, 0.28, -2],
      [1282, 0.5, 0.14, 0.30, 0],
      [1375, 0.5, 0.14, 0.30, 0],
    ];
    for (let i = 0; i < kf.length - 1; i++) {
      const [fa, xa, ya, wa, ra] = kf[i]; const [fb, xb, yb, wb, rb] = kf[i + 1];
      if (frame >= fa && frame <= fb) {
        const t = EASE((frame - fa) / Math.max(1, fb - fa));
        return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, w: wa + (wb - wa) * t, r: ra + (rb - ra) * t };
      }
    }
    const [, x, y, w, r] = kf[kf.length - 1]; return { x, y, w, r };
  })();
  const spkW = spk.w * W, spkH = spkW * 16 / 9;
  const hookBlur = interpolate(frame, [0, 16], [8, 0], { ...clamp, easing: Easing.out(Easing.quad) });
  const hookScale = interpolate(frame, [0, 60], [1.05, 1], { ...clamp, easing: Easing.bezier(0.3, 0, 0.4, 1) });

  /* ---------- states ---------- */
  const docIn = useIn(T.cardOut + 8, 26);
  const rollV = interpolate(frame, [T.rollStart, T.rollLand], [0, 2437.19], { ...clamp, easing: Easing.out(Easing.cubic) });
  const landK = spring({ frame: frame - T.rollLand, fps: FPS, config: { damping: 14, stiffness: 150 }, durationInFrames: 14 });
  const totScale = frame >= T.rollLand ? 1 + 0.03 * (1 - landK) : 1;
  const totIn = useIn(T.rollStart - 6, 12);
  const ruleP = useIn(T.redRule, 22);

  const keyStIn = useIn(T.keyIn, 14);
  const tearP = interpolate(frame, [T.tearAt, T.tearAt + 24], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const exposedP = useIn(T.exposedAt, 12);
  const italicP = useIn(T.italicAt, 18) * interpolate(frame, [T.italicOut + 40, T.italicOut + 60], [1, 0], clamp);

  const sparkP = interpolate(frame, [T.sparkUp, T.sparkUp + 34], [0, 1], { ...clamp, easing: EASE });
  const snapP = interpolate(frame, [T.sparkSnap, T.sparkSnap + 8], [0, 1], { ...clamp, easing: Easing.in(Easing.cubic) });
  const sparkIn = useIn(T.sparkUp - 6, 10);

  const photoK = spring({ frame: frame - T.photoAt, fps: FPS, config: { damping: 13, stiffness: 120 }, durationInFrames: 26 });
  const photoFade = interpolate(frame, [T.clearAt - 4, T.clearAt + 26], [1, 0], clamp);
  const notifP = spring({ frame: frame - T.notifAt, fps: FPS, config: { damping: 14, stiffness: 170 }, durationInFrames: 18 });
  const pulseK = frame >= T.pulseAt ? spring({ frame: frame - T.pulseAt, fps: FPS, config: { damping: 9, stiffness: 210 }, durationInFrames: 16 }) : 1;
  const notifScale = frame >= T.pulseAt ? 1 + 0.09 * (1 - pulseK) : 1;

  const worldClear = interpolate(frame, [T.clearAt, T.clearAt + 26], [1, 0], clamp);
  const lockIn = spring({ frame: frame - T.lockAt, fps: FPS, config: { damping: 14, stiffness: 160 }, durationInFrames: 18 });
  const closeK = frame >= T.lockClose ? spring({ frame: frame - T.lockClose, fps: FPS, config: { damping: 11, stiffness: 190 }, durationInFrames: 16 }) : 0;
  const limeRing = frame >= T.lockClose ? interpolate(frame, [T.lockClose, T.lockClose + 22], [0, 1], clamp) : 0;

  const ghostP = useIn(T.ghostAt, 20);
  const pillP = spring({ frame: frame - T.pillAt, fps: FPS, config: { damping: 13, stiffness: 160 }, durationInFrames: 20 });

  /* ---------- captions ---------- */
  const sec = frame / FPS;
  const line = CAP_LINES.find((l) => sec >= l.words[0].at && sec < l.end);
  const lineKey = line ? line.words[0].at : -1;
  const linePop = line ? interpolate(sec, [line.words[0].at, line.words[0].at + 0.12], [0, 1], clamp) : 0;
  const capWhite = darkP > 0.4;

  const zeroP = [useIn(T.zeroRows[0], 10), useIn(T.zeroRows[1], 10), useIn(T.zeroRows[2], 10)];

  /* key world position (station → skid) */
  const keyX = KEYST.x + (KEYLAND.x - KEYST.x) * tearP;
  const keyY = KEYST.y + (KEYLAND.y - KEYST.y) * tearP + Math.sin(tearP * Math.PI) * -60;

  return (
    <AbsoluteFill style={{ background: SILVER_BG, fontFamily: SANS }}>
      {/* register switch: dark canvas */}
      <AbsoluteFill style={{ background: RAISIN, opacity: darkP }} />
      {/* grids, crossfading with the register */}
      <AbsoluteFill style={{
        backgroundImage: `url("${GRID_LIGHT}")`, backgroundSize: `${76 * c.z}px`, backgroundPosition: gridPos,
        opacity: 1 - darkP,
        maskImage: "radial-gradient(ellipse 85% 70% at 50% 45%, #000 0%, rgba(0,0,0,.35) 62%, transparent 94%)",
        WebkitMaskImage: "radial-gradient(ellipse 85% 70% at 50% 45%, #000 0%, rgba(0,0,0,.35) 62%, transparent 94%)",
      }} />
      <AbsoluteFill style={{
        backgroundImage: `url("${GRID_DARK}")`, backgroundSize: `${76 * c.z}px`, backgroundPosition: gridPos,
        opacity: darkP,
        maskImage: "radial-gradient(ellipse 85% 70% at 50% 45%, #000 0%, rgba(0,0,0,.35) 62%, transparent 94%)",
        WebkitMaskImage: "radial-gradient(ellipse 85% 70% at 50% 45%, #000 0%, rgba(0,0,0,.35) 62%, transparent 94%)",
      }} />

      {/* ================= THE WORLD ================= */}
      <div style={{ ...worldStyle, opacity: endFade }}>

        {/* ============ STATION: THE INVOICE (simplified, just a bill) ============ */}
        <div style={{
          position: "absolute", left: DOC.x, top: DOC.y, width: DOC.w, height: DOC.h,
          background: "#FFFFFF", borderRadius: 24, border: `1px solid ${SILVER_SOFT}`,
          boxShadow: "0 4px 12px rgba(15,18,26,.06), 0 40px 90px -30px rgba(15,18,26,.25)",
          opacity: docIn * worldClear, transform: `translateY(${(1 - docIn) * 60}px)`,
        }}>
          <div style={{ position: "absolute", left: 90, top: 78, display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: RAISIN }} />
            <span style={{ fontFamily: MONO, fontSize: 34, letterSpacing: "0.22em", color: RAISIN, fontWeight: 700 }}>CLOUD PLATFORM</span>
          </div>
          <div style={{ position: "absolute", right: 90, top: 74, textAlign: "right" }}>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 54, letterSpacing: "0.04em", color: RAISIN }}>INVOICE</div>
            <div style={{ fontFamily: MONO, fontSize: 28, color: BODY, marginTop: 6 }}>#2026-0627</div>
          </div>
          <div style={{ position: "absolute", left: 90, right: 90, top: 208, height: 2, background: SILVER_SOFT }} />
          <div style={{ position: "absolute", left: 90, top: 240, fontFamily: MONO, fontSize: 28, color: BODY }}>
            billing period · jun 01 to jun 30
          </div>
          <div style={{ position: "absolute", right: 90, top: 240, fontFamily: MONO, fontSize: 28, color: BODY }}>
            account · luuk
          </div>

          <div style={{
            position: "absolute", left: 90, right: 90, top: 336,
            display: "flex", justifyContent: "space-between",
            fontFamily: MONO, fontSize: 26, letterSpacing: "0.2em", color: BODY,
            borderBottom: `2px solid ${SILVER_SOFT}`, paddingBottom: 14,
          }}>
            <span style={{ width: 560 }}>SERVICE</span>
            <span style={{ width: 260, textAlign: "center" }}>USAGE</span>
            <span style={{ width: 300, textAlign: "right" }}>AMOUNT</span>
          </div>
          {[
            ["api calls", "0", "€0.00"],
            ["compute hours", "0", "€0.00"],
            ["storage gb", "0", "€0.00"],
          ].map(([label, usage, amount], i) => (
            <div key={label} style={{
              position: "absolute", left: 90, right: 90, top: 420 + i * 104,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              borderBottom: "1.5px solid rgba(15,18,26,0.06)", paddingBottom: 18,
              opacity: zeroP[i], transform: `translateY(${(1 - zeroP[i]) * 12}px)`,
            }}>
              <span style={{ width: 560, fontFamily: MONO, fontSize: 42, color: RAISIN }}>{label}</span>
              <span style={{ width: 260, textAlign: "center", fontFamily: MONO, fontSize: 42, fontWeight: 700, color: RAISIN }}>{usage}</span>
              <span style={{ width: 300, textAlign: "right", fontFamily: MONO, fontSize: 42, color: BODY }}>{amount}</span>
            </div>
          ))}

          <div style={{
            position: "absolute", left: DOC.w / 2 - 2, top: 760, width: 4,
            height: ruleP * 240, background: RED, opacity: 0.75 * Math.min(1, ruleP * 2),
          }} />
          {ruleP > 0.9 && (
            <div style={{
              position: "absolute", left: DOC.w / 2 + 26, top: 926, fontFamily: MONO,
              fontSize: 30, letterSpacing: "0.2em", color: RED, opacity: Math.min(1, (ruleP - 0.9) * 10),
            }}>USAGE: NONE</div>
          )}

          <div style={{
            position: "absolute", left: 90, right: 90, top: 1040,
            borderTop: `3px solid ${RAISIN}`, paddingTop: 34, textAlign: "center", opacity: totIn,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 34, color: BODY, marginBottom: 26 }}>
              <span style={{ letterSpacing: "0.32em" }}>TOTAL DUE</span>
              <span style={{ color: RED, letterSpacing: "0.14em" }}>payment due in 14 days</span>
            </div>
            <div style={{
              fontFamily: SANS, fontWeight: 700, fontSize: 236, letterSpacing: "-0.03em", color: RAISIN,
              lineHeight: 1, transform: `scale(${totScale})`, whiteSpace: "nowrap",
            }}>{fmtMoney(rollV)}</div>
            <div style={{
              display: "inline-block", marginTop: 30, padding: "10px 28px", borderRadius: 8,
              border: `2px solid ${RED}`, fontFamily: MONO, fontSize: 30, letterSpacing: "0.2em", color: RED,
              opacity: frame >= T.rollLand + 8 ? 1 : 0,
            }}>UNEXPECTED CHARGE</div>
          </div>

          <div style={{ position: "absolute", left: 90, right: 90, bottom: 90, borderTop: `2px solid ${SILVER_SOFT}`, paddingTop: 26, display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 26, color: BODY, opacity: 0.8 }}>
            <span>questions · billing@cloudplatform</span>
            <span>page 1 of 1</span>
          </div>
        </div>

        {/* ============ STATION: THE LEAK (its own section of the canvas) ============ */}
        {frame >= T.keyIn && worldClear > 0 && (
          <>
            {/* section eyebrow */}
            <div style={{
              position: "absolute", left: KEYST.x - 210, top: KEYST.y - 260,
              fontFamily: MONO, fontSize: 30, letterSpacing: "0.3em",
              color: darkP > 0.5 ? "rgba(233,236,237,0.6)" : BODY, opacity: keyStIn * worldClear,
            }}>■ THE KEY</div>

            {/* red dashed trail while it skids */}
            {tearP > 0.02 && (
              <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={10} height={10}>
                <path
                  d={`M ${KEYST.x + 210} ${KEYST.y + 30} Q ${(KEYST.x + KEYLAND.x) / 2 + 100} ${KEYST.y - 130} ${keyX + 40} ${keyY + 24}`}
                  fill="none" stroke={RED} strokeWidth={4} strokeDasharray="16 14" opacity={0.7 * worldClear}
                />
              </svg>
            )}

            {/* the key itself */}
            {frame < T.keysFlyFrom && (
              <div style={{
                position: "absolute", left: keyX, top: keyY,
                transform: `rotate(${tearP * 14}deg) scale(2.2)`, transformOrigin: "left center",
                opacity: keyStIn * worldClear * (frame > T.scatterFrom ? 0.55 : 1),
              }}>
                <KeyChip scale={1} />
              </div>
            )}

            {/* EXPOSED at the landing spot */}
            {frame >= T.exposedAt && (
              <div style={{
                position: "absolute", left: KEYLAND.x, top: KEYLAND.y + 130,
                fontFamily: MONO, fontSize: 42, fontWeight: 700, letterSpacing: "0.3em", color: RED,
                opacity: exposedP * worldClear,
              }}>EXPOSED</div>
            )}

            {/* Playfair aside, part of this section */}
            <div style={{
              position: "absolute", left: KEYST.x - 210, top: KEYST.y + 560,
              fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: 68,
              color: darkP > 0.5 ? SILVER_BG : RAISIN, opacity: italicP * worldClear,
              transform: `translateY(${(1 - italicP) * 14}px)`,
            }}>I just didn't look.</div>
          </>
        )}

        {/* ============ SCATTER (dark register) ============ */}
        {SCATTER.map((s, i) => {
          const born = T.scatterFrom + i * 4;
          if (frame < born) return null;
          const inP = interpolate(frame, [born, born + 12], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
          const flyStart = T.keysFlyFrom + i * 6;
          const flyP = interpolate(frame, [flyStart, flyStart + 26], [0, 1], { ...clamp, easing: EASE });
          const midDim = frame > f(23.08) && frame < T.lockAt ? 0.4 : 1;
          if (flyP >= 1) return null;
          const x = s.x + (LOCK.x - 210 - s.x) * flyP;
          const y = s.y + (LOCK.y - s.y) * flyP - Math.sin(flyP * Math.PI) * 160;
          const sc = (0.9 + 0.1 * inP) * (1 - flyP * 0.55);
          return (
            <div key={i} style={{
              position: "absolute", left: x, top: y,
              transform: `rotate(${s.rot * (1 - flyP)}deg) scale(${sc})`,
              opacity: inP * midDim * (1 - flyP * 0.2),
            }}>
              <div style={{
                marginBottom: 8, fontFamily: MONO, fontSize: 22,
                color: darkP > 0.5 ? "rgba(233,236,237,0.7)" : BODY, opacity: 0.9,
              }}>{s.file}</div>
              <KeyChip scale={1} />
            </div>
          );
        })}

        {/* ============ STATION: SPARKLINE ============ */}
        {frame >= T.sparkUp - 6 && frame < f(23.08) + 30 && (
          <div style={{
            position: "absolute", left: SPARK.x, top: SPARK.y, width: 900, height: 420,
            background: "#FFFFFF", borderRadius: 20, border: `1px solid ${SILVER_SOFT}`,
            boxShadow: "0 20px 44px -18px rgba(0,0,0,.4)", opacity: sparkIn * (frame > f(23.08) ? 0.4 : 1),
          }}>
            <svg width={900} height={420} style={{ display: "block" }}>
              {(() => {
                const upPts: [number, number][] = [
                  [70, 330], [230, 300], [390, 250], [550, 190], [700, 120],
                ];
                const n = Math.max(2, Math.ceil(sparkP * upPts.length));
                const shown = upPts.slice(0, n);
                let d = `M ${shown.map((p) => p.join(" ")).join(" L ")}`;
                if (snapP > 0) d += ` L ${700 + 140 * snapP} ${120 + 240 * snapP}`;
                return (
                  <>
                    <path d={d} fill="none" stroke={snapP > 0.5 ? RED : RAISIN} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
                    {snapP >= 1 && <circle cx={840} cy={360} r={12} fill={RED} />}
                  </>
                );
              })()}
            </svg>
          </div>
        )}

        {/* ============ STATION: JAPAN ============ */}
        {frame >= T.photoAt && photoFade > 0 && (
          <div style={{
            position: "absolute", left: JAPAN.x, top: JAPAN.y,
            transform: `translate(-50%, -50%) translateY(${(1 - photoK) * -420}px) rotate(${-3.5 + (1 - photoK) * 5}deg) scale(${0.92 + 0.08 * photoK})`,
            opacity: photoK * photoFade,
          }}>
            <div style={{
              padding: "30px 30px 110px 30px", background: "#FFFFFF", borderRadius: 10, position: "relative",
              boxShadow: "0 10px 26px rgba(0,0,0,.5), 0 60px 130px -28px rgba(0,0,0,.6)",
            }}>
              <div style={{ width: 1360, height: 1000, overflow: "hidden", borderRadius: 4 }}>
                <Img src={staticFile("intros/2500bill/japan.jpg")} style={{
                  width: "100%", height: "100%", objectFit: "cover",
                  transform: `scale(${1.06 + Math.min(1, Math.max(0, frame - T.photoAt) / 160) * 0.08}) translateX(${-Math.min(1, Math.max(0, frame - T.photoAt) / 160) * 26}px)`,
                }} />
              </div>
              <div style={{
                position: "absolute", left: 44, bottom: 30, fontFamily: SERIF, fontStyle: "italic",
                fontSize: 44, color: BODY,
              }}>tokyo, on holiday</div>

              {frame >= T.notifAt && (
                <div style={{
                  position: "absolute", right: -70, top: -66,
                  transform: `translateY(${(1 - notifP) * -60}px) scale(${notifScale})`,
                  opacity: notifP,
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 20,
                    padding: "22px 34px", borderRadius: 18, background: RAISIN,
                    boxShadow: "0 24px 54px -14px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,0.10)",
                  }}>
                    <span style={{ width: 16, height: 16, borderRadius: "50%", background: RED, display: "inline-block" }} />
                    <span style={{ fontFamily: MONO, fontSize: 34, color: "#fff", whiteSpace: "nowrap" }}>
                      new invoice · €2,437.19
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ STATION: THE LOCK ============ */}
        {frame >= T.lockAt && (
          <div style={{
            position: "absolute", left: LOCK.x, top: LOCK.y, transform: `translate(-50%, -50%) scale(${0.9 + 0.1 * lockIn})`,
            opacity: lockIn,
          }}>
            {limeRing > 0 && limeRing < 1 && (
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                width: 340 + limeRing * 420, height: 340 + limeRing * 420,
                transform: "translate(-50%, -50%)", borderRadius: "50%",
                border: `4px solid rgba(207,255,5,${0.75 * (1 - limeRing)})`,
              }} />
            )}
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 26,
              padding: "58px 84px", borderRadius: 26, background: RAISIN,
              boxShadow: `0 30px 70px -20px rgba(15,18,26,.55), 0 0 ${closeK * 46}px rgba(207,255,5,${closeK * 0.4})`,
            }}>
              <svg width={110} height={110} viewBox="0 0 48 48" fill="none">
                <rect x="9" y="21" width="30" height="21" rx="5" stroke={closeK > 0.5 ? LIME : "#fff"} strokeWidth="3.4" />
                <path d={closeK > 0.5 ? "M 16 21 v -5 a 8 8 0 0 1 16 0 v 5" : "M 16 21 v -5 a 8 8 0 0 1 16 0"} stroke={closeK > 0.5 ? LIME : "#fff"} strokeWidth="3.4" strokeLinecap="round" />
                <circle cx="24" cy="30.5" r="3.4" fill={closeK > 0.5 ? LIME : "#fff"} />
              </svg>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 40, letterSpacing: "0.24em", color: closeK > 0.5 ? LIME : "#fff" }}>
                {closeK > 0.5 ? "LOCKED" : "COLLECTING"}
              </span>
            </div>
          </div>
        )}

        {/* ============ STATION: CTA ============ */}
        {frame >= T.ghostAt && (
          <div style={{
            position: "absolute", left: JAPAN.x, top: 5060, transform: "translate(-50%, -50%)",
            fontFamily: SANS, fontWeight: 700, fontSize: 300, letterSpacing: "-0.03em",
            color: RAISIN, opacity: 0.07 * ghostP, whiteSpace: "nowrap",
          }}>€2,437.19</div>
        )}
        {frame >= T.pillAt && (
          <div style={{
            position: "absolute", left: JAPAN.x, top: 5860,
            transform: `translate(-50%, -50%) translateY(${(1 - pillP) * 40}px)`, opacity: pillP,
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 22,
              padding: "26px 46px", borderRadius: 60, background: "#FFFFFF",
              border: `1px solid ${SILVER_SOFT}`,
              boxShadow: "0 4px 10px rgba(15,18,26,.08), 0 30px 60px -18px rgba(15,18,26,.3)",
            }}>
              <span style={{ fontFamily: MONO, fontSize: 42, color: BODY, whiteSpace: "nowrap" }}>ever had this?</span>
              <span style={{
                width: 6, height: 48, background: LIME, display: "inline-block",
                opacity: Math.floor(frame / 14) % 2 === 0 ? 1 : 0.15,
              }} />
            </div>
          </div>
        )}
      </div>

      {/* ================= SPEAKER CARD ================= */}
      <div style={{
        position: "absolute",
        left: spk.x * W - spkW / 2, top: spk.y * H - spkH / 2, width: spkW, height: spkH,
        transform: `rotate(${spk.r}deg)`,
        borderRadius: 12, overflow: "hidden", opacity: endFade,
        boxShadow: darkP > 0.4
          ? "0 6px 22px rgba(0,0,0,0.5), 0 0 0 1px rgba(233,236,237,0.14)"
          : "0 6px 22px rgba(15,18,26,0.30), 0 0 0 1px rgba(15,18,26,0.10)",
      }}>
        <OffthreadVideo src={staticFile("intros/2500bill/source.mp4")}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            transform: `scale(${hookScale})`,
            filter: `contrast(1.05) saturate(1.06)${hookBlur > 0.1 ? ` blur(${hookBlur}px)` : ""}`,
          }} />
      </div>

      {/* ================= KARAOKE CAPTIONS ================= */}
      {line && (
        <div key={lineKey} style={{
          position: "absolute", left: u * 3, right: u * 3, top: H * 0.87 - u * 3.2, textAlign: "center",
          opacity: endFade * linePop, transform: `scale(${0.965 + 0.035 * linePop})`, pointerEvents: "none",
        }}>
          {line.words.map((w, i) => {
            const current = sec >= w.at && (i === line.words.length - 1 || sec < line.words[i + 1].at);
            return (
              <span key={i} style={{
                fontFamily: SANS, fontWeight: 800, fontSize: u * 4.7, letterSpacing: "0.005em",
                color: current ? RAISIN : capWhite ? "#FFFFFF" : RAISIN,
                background: current ? LIME : "transparent",
                textShadow: capWhite && !current ? "0 3px 16px rgba(0,0,0,0.8)" : "none",
                padding: `0 ${u * 0.7}px`, borderRadius: u * 0.55,
                margin: `0 ${u * 0.35}px`, display: "inline-block",
              }}>{w.t}</span>
            );
          })}
        </div>
      )}

      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 80% 72% at 50% 44%, transparent 62%, rgba(15,18,26,0.09) 100%)" }} />

      {frame >= T.fadeOut && <AbsoluteFill style={{ background: SILVER_BG, opacity: 1 - endFade }} />}

      {/* ---- SFX ---- */}
      <Sfx src="vedit/sfx/slide.wav" at={T.cardOut + 4} volume={0.24} />
      <Sfx src="vedit/sfx/soft.wav" at={T.rollLand} volume={0.34} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={T.zeroRows[0]} volume={0.22} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={T.zeroRows[1]} volume={0.22} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={T.zeroRows[2]} volume={0.22} />
      <Sfx src="vedit/sfx/tap.wav" at={T.redRule} volume={0.26} />
      <Sfx src="vedit/sfx/slide.wav" at={T.darkIn} volume={0.22} rate={0.9} />
      <Sfx src="vedit/sfx/slide.wav" at={T.tearAt} volume={0.3} />
      <Sfx src="vedit/sfx/tap.wav" at={T.sparkSnap} volume={0.3} rate={0.82} />
      <Sfx src="vedit/sfx/soft.wav" at={T.photoAt} volume={0.3} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={T.notifAt} volume={0.28} />
      <Sfx src="vedit/sfx/tap.wav" at={T.pulseAt} volume={0.22} rate={0.9} />
      <Sfx src="vedit/sfx/soft.wav" at={T.clearAt} volume={0.22} />
      {[0, 2, 4, 6, 8, 10].map((i) => (
        <Sfx key={i} src="vedit/sfx/tick_soft.wav" at={T.keysFlyFrom + i * 6 + 24} volume={0.18} />
      ))}
      <Sfx src="vedit/sfx/soft.wav" at={T.lockClose} volume={0.34} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={T.pillAt} volume={0.24} />
    </AbsoluteFill>
  );
};

export default BillShowcase;

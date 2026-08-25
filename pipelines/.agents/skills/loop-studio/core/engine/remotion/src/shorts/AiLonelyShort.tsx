/**
 * AiLonelyShort — bespoke 9:16 short (57.5s, 1725f @30).
 *
 * CONCEPT — THE PRESENCE ROW. One persistent element: a slim messaging-style
 * presence strip in the lower third (a row of circular slots, like a chat app's
 * online-users row). For most of the runtime only two dots are alive — `you`
 * (warm) and `claude` (cool mono, spark glyph) — amid three EMPTY dashed slots.
 * The empty slots ARE the loneliness, quietly visible the whole time.
 *
 * Beats (anchored to words.json word starts):
 *  1. 0–11.2s   strip fades on; you breathes first; claude blinks online (tick);
 *               empties draw on silently; claude pulses with "more to than my laptop"
 *  2. 11.9–14.2 hold — micro-drift only, footage acts
 *  3. 15.8–27s  you+claude drift closer; a thin line ALMOST connects (flickers,
 *               never solid) on "almost like a real connection"; empties exhale
 *               dimmer on "and that can be pretty lonely"
 *  4. 29.5–30.6 PAYOFF — three empty slots fill with warm dots (per-item ticks
 *               on "three / best / friends"); scene brightness lifts ~3%
 *  5. 33–41.4   claude steps politely to the row's end; the four humans group;
 *               a warm line connects them and SOLIDIFIES (contrast w/ beat 3);
 *               the one lime accent: the line's terminal node
 *  6. 41.5–43.4 "Claude is not that funny" — minimal `ha.` bubble off the claude
 *               dot (one quiet tap); captions pause so the joke lands alone
 *  7. 43.5–51s  strip at full brightness, all dots breathing together
 *  8. 51.3–end  comment-style input pill slides up: mono `interested?` + blinking
 *               cursor; hold; design layer fades last 10 frames, cursor blinks last
 *
 * This is the most personal short of the set — the footage carries it; the
 * design layer stays quiet. Restraint is the taste here.
 */
import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
} from "remotion";

const FPS = 30;
const f = (sec: number) => Math.round(sec * FPS);

const RAISIN = "#0F121A";
const LIME = "#CFFF05";
const SILVER = "#B5BFC2";
// warm dots: muted clay, desaturated (not orange-loud)
const WARM = "#C98D76";
const WARM_2 = "#BE917C";
const WARM_3 = "#C68A70";
const COOL = "#9FB0BA"; // claude: cool mono
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

// ---- webfont injection (same pattern as EditedVideo's serif loader) ----
let __fontsInjected = false;
const ensureFonts = () => {
  if (typeof document === "undefined" || __fontsInjected) return;
  __fontsInjected = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;500;700&display=block";
  document.head.appendChild(link);
};

const EASE = Easing.bezier(0.45, 0, 0.18, 1);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ramp = (frame: number, a: number, b: number, e: (t: number) => number = EASE) =>
  e(clamp01((frame - a) / Math.max(1, b - a)));

const Sfx: React.FC<{ src: string; at: number; volume?: number }> = ({ src, at, volume = 0.25 }) => (
  <Sequence from={at} durationInFrames={f(1.4)}>
    <Audio src={staticFile(src)} volume={volume} />
  </Sequence>
);

/* ================================================================== */
/* Timing constants — every one anchored to a word start in words.json */
/* ================================================================== */
const T = {
  stripIn: 0,                // strip fades on from the very first frame (P5: no untreated open)
  youIn: f(0.50),            // "working" underway — you breathes on first
  claudeIn: f(1.32),         // "AI" — claude blinks online (tick)
  empty1: f(2.22),           // "can"
  empty2: f(2.74),           // "be" → "pretty"
  empty3: f(3.22),           // "lonely" — the word lands on the last empty slot
  // claude pulses with his voice: "more to than my laptop"
  pulses: [f(9.76), f(10.24), f(10.5), f(10.9)],
  // beat 3 — drift closer during "entering an era ... everything we do"
  driftA: f(15.84), driftB: f(19.92),
  // almost-line flickers: "almost like a real connection because we're talking"
  almostA: f(22.54), almostB: f(25.04), almostOut: f(25.6),
  // empties exhale dimmer: "and that can be pretty lonely"
  dimAt: f(25.34),
  driftBackA: f(27.1), driftBackB: f(28.6),  // "but what I did"
  // beat 4 — fills on "three / best / friends"
  fill1: f(29.46), fill2: f(29.94), fill3: f(30.24),
  warmLiftA: f(29.46), warmLiftB: f(31.4),   // room gets warmer, ~3%
  // beat 5 — claude steps aside on "saved (me)"; humans group; warm line solidifies
  stepA: f(32.92), stepB: f(34.4),
  groupA: f(37.54), groupB: f(38.14),        // "I have real" → "connection"
  lineA: f(38.14), lineB: f(39.94),          // draws "connection" → "connection"
  lineSfx: f(39.6),
  // beat 6 — ha. bubble ("Claude is not that funny", words 41.52–42.8)
  bubbleA: f(42.2), bubbleSettle: f(42.8), bubbleOutA: f(44.4), bubbleOutB: f(45.0),
  capsMuteA: 41.52, capsMuteB: 43.4,         // seconds — captions pause for the joke
  // beat 7 — strip brightens fully, breathing syncs ("make sure to get out there")
  brightA: f(43.5), brightB: f(44.5),
  // beat 8 — CTA pill on "something (to do this for all of us)"
  ctaIn: f(51.32), ctaSfx: f(51.8),
  endFadeA: 1715, endFadeB: 1725,
};

/* ================================================================== */
/* Presence strip geometry                                             */
/* ================================================================== */
const SLOT_X = [216, 378, 540, 702, 864]; // 5 slots, centered on 540
const DOT_Y = 1478;   // dot centers
const DOT_R = 38;
const PILL = { x: 128, y: 1398, w: 824, h: 164, r: 82 };
const LABEL_Y = DOT_Y + DOT_R + 30;

type Dot = {
  x: number; born: number; color: string; label?: string;
  breathPhase: number; kind: "you" | "claude" | "friend";
};

/** All dot positions as a function of frame (drift, step, shift, group). */
function layout(frame: number) {
  // beat 3: you and claude drift a few px closer, then ease back
  const drift =
    10 * ramp(frame, T.driftA, T.driftB) * (1 - ramp(frame, T.driftBackA, T.driftBackB));
  // beat 5: claude steps from slot 1 to slot 4; friends shift one slot left
  const step = ramp(frame, T.stepA, T.stepB);
  // beat 5: the four humans nudge subtly toward each other (their center ≈ 459)
  const group = ramp(frame, T.groupA, T.groupB);
  const nudge = (x: number) => x + (459 - x) * 0.055 * group;

  const you = nudge(SLOT_X[0] + drift);
  const claude = SLOT_X[1] - drift + (SLOT_X[4] - SLOT_X[1]) * step;
  const friends = [
    nudge(SLOT_X[2] + (SLOT_X[1] - SLOT_X[2]) * step),
    nudge(SLOT_X[3] + (SLOT_X[2] - SLOT_X[3]) * step),
    nudge(SLOT_X[4] + (SLOT_X[3] - SLOT_X[4]) * step),
  ];
  return { you, claude, friends, step, drift };
}

/* ================================================================== */
/* Captions — lime karaoke, ≤3 words, cardless, above the strip        */
/* ================================================================== */
type CapWord = [string, number]; // [text, startSec]
type CapGroup = { w: CapWord[]; to: number };
const CAPS: CapGroup[] = [
  { w: [["WORKING", 0.22], ["WITH", 1.02], ["AI", 1.32]], to: 1.7 },
  { w: [["ALL", 1.7], ["DAY", 2.02]], to: 2.22 },
  { w: [["CAN", 2.22], ["BE", 2.54], ["PRETTY", 2.74]], to: 3.22 },
  { w: [["LONELY,", 3.22], ["HONESTLY.", 3.56]], to: 4.24 },
  { w: [["I'M", 4.24], ["JUST", 4.7], ["TALKING", 4.88]], to: 5.24 },
  { w: [["TO", 5.24], ["MY", 5.38], ["LAPTOP", 5.52]], to: 5.84 },
  { w: [["ALL", 5.84], ["DAY.", 6.2]], to: 6.52 },
  { w: [["LIKE", 6.52]], to: 7.4 },
  { w: [["I", 7.4], ["DON'T", 7.58], ["THINK", 7.82]], to: 8.06 },
  { w: [["THERE", 8.06], ["IS", 8.32], ["ANY", 8.44]], to: 8.74 },
  { w: [["HUMAN", 8.74], ["I'M", 9.06], ["TALKING", 9.44]], to: 9.76 },
  { w: [["MORE", 9.76], ["TO", 10.24]], to: 10.5 },
  { w: [["THAN", 10.5], ["MY", 10.78], ["LAPTOP.", 10.9]], to: 11.6 },
  { w: [["THAT", 11.88], ["IS", 12.4], ["JUST", 12.56]], to: 12.82 },
  { w: [["CRAZY", 12.82], ["TO", 13.28], ["THINK", 13.54]], to: 13.72 },
  { w: [["ABOUT,", 13.72], ["RIGHT?", 14.1]], to: 14.6 },
  { w: [["WE", 15.04], ["REALLY", 15.32], ["ARE", 15.64]], to: 15.84 },
  { w: [["ENTERING", 15.84], ["AN", 16.22], ["ERA", 16.4]], to: 16.6 },
  { w: [["WHERE", 16.6], ["OUR", 16.96], ["COMPUTERS", 17.24]], to: 17.66 },
  { w: [["ARE", 17.66], ["SO", 18.04], ["CLOSE", 18.5]], to: 18.94 },
  { w: [["TO", 18.94], ["EVERYTHING", 19.18]], to: 19.48 },
  { w: [["WE", 19.48], ["DO.", 19.7]], to: 20.0 },
  { w: [["AND", 20.0], ["I'M", 20.1], ["NOT", 21.2]], to: 21.3 },
  { w: [["EVEN", 21.3], ["TYPING", 21.46], ["ANYMORE.", 21.8]], to: 22.3 },
  { w: [["IT'S", 22.3], ["ALMOST", 22.54], ["LIKE", 22.9]], to: 23.14 },
  { w: [["A", 23.14], ["REAL", 23.26], ["CONNECTION", 23.44]], to: 23.86 },
  { w: [["BECAUSE", 23.86], ["WE'RE", 24.18], ["TALKING.", 24.64]], to: 25.34 },
  { w: [["AND", 25.34], ["THAT", 25.8], ["CAN", 26.04]], to: 26.2 },
  { w: [["BE", 26.2], ["PRETTY", 26.34], ["LONELY.", 26.6]], to: 27.1 },
  { w: [["BUT", 27.1], ["WHAT", 27.34], ["I", 27.9]], to: 28.1 },
  { w: [["DID", 28.1], ["IS", 28.26], ["I", 28.44]], to: 28.64 },
  { w: [["GOT", 28.64], ["AN", 28.82], ["OFFICE", 28.96]], to: 29.2 },
  { w: [["WITH", 29.2], ["THREE", 29.46], ["OF", 29.7]], to: 29.8 },
  { w: [["MY", 29.8], ["BEST", 29.94], ["FRIENDS", 30.24]], to: 30.62 },
  { w: [["AND", 30.62], ["HONESTLY", 31.1]], to: 32.18 },
  { w: [["THAT", 32.18], ["REALLY", 32.64], ["SAVED", 32.92]], to: 33.28 },
  { w: [["ME", 33.28]], to: 33.72 },
  { w: [["BECAUSE", 33.72], ["I", 34.84], ["NOW", 35.1]], to: 35.28 },
  { w: [["STILL", 35.28], ["WORK", 35.54], ["WITH", 35.84]], to: 36.04 },
  { w: [["AI", 36.04]], to: 36.8 },
  { w: [["BUT", 36.8], ["AT", 36.94], ["THE", 37.04]], to: 37.28 },
  { w: [["SAME", 37.28], ["TIME", 37.54]], to: 37.82 },
  { w: [["I", 37.82], ["HAVE", 37.94], ["REAL", 38.14]], to: 38.62 },
  { w: [["CONNECTION", 38.62]], to: 38.94 },
  { w: [["AND", 38.94], ["I", 39.1], ["THINK", 39.28]], to: 39.54 },
  { w: [["REAL", 39.54], ["CONNECTION", 39.94], ["IS", 40.32]], to: 40.32 },
  { w: [["MORE", 40.32], ["IMPORTANT", 40.6]], to: 40.96 },
  { w: [["THAN", 40.96], ["EVER.", 41.16]], to: 41.5 },
  // ---- captions pause here: "Claude is not that funny" — the ha. beat ----
  { w: [["MAKE", 43.5], ["SURE", 43.72], ["TO", 43.96]], to: 44.26 },
  { w: [["GET", 44.26], ["OUT", 44.64], ["THERE", 44.86]], to: 45.1 },
  { w: [["IF", 45.1], ["YOU'RE", 45.32], ["USING", 45.48]], to: 45.72 },
  { w: [["AI", 45.72], ["A", 45.98], ["LOT", 46.18]], to: 46.34 },
  { w: [["MAKE", 46.34], ["SURE", 46.88], ["TO", 47.1]], to: 47.26 },
  { w: [["GET", 47.26], ["THOSE", 47.5]], to: 47.76 },
  { w: [["ACTUAL", 47.76], ["CONTACTS", 48.22]], to: 48.74 },
  { w: [["AND", 48.74], ["HONESTLY", 49.48]], to: 49.82 },
  { w: [["I'M", 49.82], ["THINKING", 50.02], ["ABOUT", 50.26]], to: 50.54 },
  { w: [["JUST", 50.54], ["CREATING", 50.84]], to: 51.32 },
  { w: [["SOMETHING", 51.32], ["TO", 51.76], ["DO", 52.12]], to: 52.28 },
  { w: [["THIS", 52.28], ["FOR", 52.5], ["ALL", 52.78]], to: 53.1 },
  { w: [["OF", 53.1], ["US", 53.2]], to: 53.4 },
  { w: [["SO", 53.4], ["MAKE", 53.68], ["SURE", 54.54]], to: 54.76 },
  { w: [["TO", 54.76], ["LEAVE", 54.88], ["A", 55.06]], to: 55.18 },
  { w: [["COMMENT", 55.18]], to: 55.44 },
  { w: [["IF", 55.44], ["THIS", 55.66], ["IS", 55.82]], to: 55.94 },
  { w: [["SOMETHING", 55.94], ["YOU'RE", 56.22]], to: 56.6 },
  { w: [["INTERESTED", 56.6], ["IN", 56.96]], to: 57.4 },
];

const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const group = CAPS.find((g) => t >= g.w[0][1] && t < g.to);
  if (!group) return null;
  const from = f(group.w[0][1]);
  const inP = ramp(frame, from, from + 4, Easing.out(Easing.cubic));
  // current word = last word whose start has passed
  let cur = 0;
  for (let i = 0; i < group.w.length; i++) if (t >= group.w[i][1]) cur = i;
  const chars = group.w.map(([txt]) => txt).join(" ").length;
  const size = Math.min(74, chars > 15 ? (74 * 16.5) / chars : 74);
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, top: 1920 * 0.66, height: 0,
      display: "flex", justifyContent: "center", alignItems: "center",
      gap: size * 0.34, pointerEvents: "none",
      opacity: inP, transform: `translateY(${(1 - inP) * 10}px)`,
    }}>
      {group.w.map(([txt, at], i) => (
        <span key={i} style={{
          fontFamily: SANS, fontWeight: 800, fontSize: size, letterSpacing: "-0.01em",
          color: i === cur ? LIME : "#fff", whiteSpace: "nowrap",
          textShadow: "0 4px 22px rgba(0,0,0,0.85), 0 2px 8px rgba(0,0,0,0.7), 0 0 40px rgba(0,0,0,0.5)",
        }}>{txt}</span>
      ))}
    </div>
  );
};

/* ================================================================== */
/* The presence strip                                                  */
/* ================================================================== */

/** Claude spark glyph — 8 tapered spokes. */
const Spark: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    {Array.from({ length: 8 }).map((_, i) => {
      const a = (i * Math.PI) / 4;
      const r1 = 5, r2 = i % 2 === 0 ? 16 : 11;
      return (
        <line key={i}
          x1={20 + Math.cos(a) * r1} y1={20 + Math.sin(a) * r1}
          x2={20 + Math.cos(a) * r2} y2={20 + Math.sin(a) * r2}
          stroke={color} strokeWidth={4.2} strokeLinecap="round" />
      );
    })}
  </svg>
);

const AliveDot: React.FC<{
  x: number; born: number; color: string; label?: string;
  phase: number; syncP: number; frame: number; glow: number;
  pulseAmp?: number; blink?: boolean;
}> = ({ x, born, color, label, phase, syncP, frame, glow, pulseAmp = 0, blink }) => {
  if (frame < born) return null;
  const birth = spring({ frame: frame - born, fps: FPS, config: { damping: 13, stiffness: 150 }, durationInFrames: 22 });
  // breathing: own phase → common phase as the strip syncs up (beat 7)
  const ph = phase * (1 - syncP);
  const breathAmp = 0.03 * Math.min(1, (frame - born) / 30);
  const breath = 1 + breathAmp * Math.sin((frame - born) / 13 + ph * 6.28);
  // claude blinks online: two quick flickers before holding steady
  let blinkO = 1;
  if (blink) {
    const bt = frame - born;
    blinkO = bt < 3 ? 0.25 : bt < 5 ? 1 : bt < 8 ? 0.35 : 1;
  }
  const s = birth * breath * (1 + pulseAmp);
  const isClaude = !!blink;
  return (
    <>
      <div style={{
        position: "absolute", left: x - DOT_R, top: DOT_Y - DOT_R,
        width: DOT_R * 2, height: DOT_R * 2, borderRadius: "50%",
        background: color, opacity: blinkO,
        transform: `scale(${s})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 0 ${18 + glow * 14}px ${color}${glow > 0.5 ? "66" : "44"}, 0 4px 14px rgba(0,0,0,0.45)`,
      }}>
        {isClaude && <Spark size={40} color={RAISIN} />}
      </div>
      {label && (
        <div style={{
          position: "absolute", left: x - 70, top: LABEL_Y, width: 140, textAlign: "center",
          fontFamily: MONO, fontSize: 21, letterSpacing: "0.14em",
          color: SILVER, opacity: blinkO * birth * (0.62 + glow * 0.3),
        }}>{label}</div>
      )}
    </>
  );
};

const PresenceStrip: React.FC = () => {
  const frame = useCurrentFrame();
  const L = layout(frame);
  // pre-rolled so frame 0 already carries ~30% of the strip (never an untreated open)
  const stripIn = ramp(frame, T.stripIn - 12, T.stripIn + 16, Easing.out(Easing.quad));
  const syncP = ramp(frame, T.brightA, T.brightB + 30);
  const bright = ramp(frame, T.brightA, T.brightB);        // beat 7 full glow
  const warm = ramp(frame, T.warmLiftA, T.warmLiftB);      // beat 4 room lift
  const glow = 0.25 + warm * 0.3 + bright * 0.45;

  // claude voice pulse ("more to than my laptop")
  let pulse = 0;
  for (const p of T.pulses) {
    const dt = frame - p;
    if (dt >= 0 && dt < 10) pulse = Math.max(pulse, 0.12 * (1 - dt / 10));
  }
  // claude online ring (once, at blink-on)
  const ringT = clamp01((frame - T.claudeIn) / 16);

  // empty slots: draw on one by one, silent; exhale dimmer at "lonely"
  const empties = [T.empty1, T.empty2, T.empty3];
  const dimP = ramp(frame, T.dimAt, T.dimAt + 18);
  const fills = [T.fill1, T.fill2, T.fill3];

  // beat 3 almost-line: two segments reach toward each other, flicker, never meet
  const almostP = ramp(frame, T.almostA, T.almostA + 20);
  const almostOut = 1 - ramp(frame, T.almostB, T.almostOut);
  const flicker =
    0.28 + 0.3 * Math.abs(Math.sin(frame * 0.55)) * Math.abs(Math.sin(frame * 0.17 + 1.3));
  const aX1 = L.you + DOT_R + 8, aX2 = L.claude - DOT_R - 8;
  const aSpan = Math.max(0, aX2 - aX1);
  const seg = aSpan * 0.38 * almostP; // each side covers 38% — a gap always remains

  // beat 5 warm line: draws through the four humans, solidifies; lime terminal node
  const lineP = ramp(frame, T.lineA, T.lineB);
  const lineEnd = L.friends[2] + 54;
  const lineHead = L.you + (lineEnd - L.you) * lineP;
  const solid = ramp(frame, T.lineB - 6, T.lineB + 8);

  // beat 6 ha. bubble (off claude's dot at the row's end)
  const bubUp = spring({ frame: frame - T.bubbleA, fps: FPS, config: { damping: 14, stiffness: 130 }, durationInFrames: 20 });
  const bubOut = 1 - ramp(frame, T.bubbleOutA, T.bubbleOutB);
  const showBubble = frame >= T.bubbleA && bubOut > 0.01;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: stripIn }}>
      {/* pill container */}
      <div style={{
        position: "absolute", left: PILL.x, top: PILL.y, width: PILL.w, height: PILL.h,
        borderRadius: PILL.r,
        background: `rgba(13,16,23,${0.62 - warm * 0.06})`,
        border: `1px solid rgba(255,255,255,${0.08 + bright * 0.05})`,
        boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
      }} />

      {/* lines + empty slots live in one SVG, UNDER the dots */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <defs>
          {empties.map((at, i) => (
            <mask key={i} id={`alDraw${i}`}>
              <circle cx={SLOT_X[2 + i]} cy={DOT_Y} r={DOT_R - 3}
                fill="none" stroke="#fff" strokeWidth={12}
                pathLength={100} strokeDasharray={100}
                strokeDashoffset={100 * (1 - ramp(frame, at, at + 16))}
                transform={`rotate(-90 ${SLOT_X[2 + i]} ${DOT_Y})`} />
            </mask>
          ))}
        </defs>

        {/* beat 5 warm line — behind the dots, solidifies, lime terminal node */}
        {lineP > 0.01 && (
          <>
            <line x1={L.you} y1={DOT_Y} x2={lineHead} y2={DOT_Y}
              stroke={WARM} strokeWidth={3.5} strokeLinecap="round"
              opacity={0.55 + 0.35 * solid} />
            <circle cx={lineHead} cy={DOT_Y} r={7} fill={LIME}
              opacity={0.9}
              style={{ filter: `drop-shadow(0 0 ${6 + solid * 6}px ${LIME})` }} />
          </>
        )}

        {/* beat 3 almost-line — flickering, never fully connects */}
        {frame >= T.almostA && almostOut > 0.01 && aSpan > 20 && (
          <>
            <line x1={aX1} y1={DOT_Y} x2={aX1 + seg} y2={DOT_Y}
              stroke={SILVER} strokeWidth={2.5} strokeLinecap="round"
              opacity={flicker * almostOut} />
            <line x1={aX2 - seg} y1={DOT_Y} x2={aX2} y2={DOT_Y}
              stroke={SILVER} strokeWidth={2.5} strokeLinecap="round"
              opacity={flicker * almostOut * 0.85} />
          </>
        )}

        {/* empty dashed slots — the missing humans */}
        {empties.map((at, i) => {
          if (frame < at) return null;
          const fillP = ramp(frame, fills[i], fills[i] + 8);
          const exhale = 1 - dimP * 0.35;
          const o = (0.3 * exhale) * (1 - fillP);
          if (o <= 0.005) return null;
          return (
            <circle key={i} cx={SLOT_X[2 + i]} cy={DOT_Y} r={DOT_R - 3}
              fill="none" stroke="#fff" strokeWidth={2}
              strokeDasharray="6.5 9.5" opacity={o}
              mask={`url(#alDraw${i})`}
              transform={`scale(${1 - dimP * 0.02})`}
              style={{ transformOrigin: `${SLOT_X[2 + i]}px ${DOT_Y}px` }} />
          );
        })}

        {/* claude online ring pulse */}
        {ringT > 0 && ringT < 1 && (
          <circle cx={L.claude} cy={DOT_Y} r={DOT_R + ringT * 26}
            fill="none" stroke={COOL} strokeWidth={2 * (1 - ringT)} opacity={1 - ringT} />
        )}
      </svg>

      {/* alive dots */}
      <AliveDot x={L.you} born={T.youIn} color={WARM} label="you"
        phase={0} syncP={syncP} frame={frame} glow={glow} />
      <AliveDot x={L.claude} born={T.claudeIn} color={COOL} label="claude"
        phase={0.45} syncP={syncP} frame={frame} glow={glow * 0.8} pulseAmp={pulse} blink />
      {L.friends.map((x, i) => (
        <AliveDot key={i} x={x} born={fills[i]} color={[WARM, WARM_2, WARM_3][i]}
          phase={0.15 + i * 0.28} syncP={syncP} frame={frame} glow={glow} />
      ))}

      {/* beat 6 — ha. bubble, minimal */}
      {showBubble && (
        <div style={{
          position: "absolute", left: L.claude - 46, top: DOT_Y - DOT_R - 92 + (1 - bubUp) * 20,
          width: 92, height: 58, borderRadius: 15, borderBottomRightRadius: 5,
          background: "#171B24", border: "1px solid rgba(255,255,255,0.13)",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: Math.min(1, bubUp * 1.4) * bubOut,
          boxShadow: "0 6px 22px rgba(0,0,0,0.45)",
        }}>
          <span style={{ fontFamily: MONO, fontSize: 29, color: SILVER }}>ha.</span>
        </div>
      )}

      {/* beat 8 — comment-style input pill */}
      {frame >= T.ctaIn && (() => {
        const inP = ramp(frame, T.ctaIn, T.ctaIn + 16);
        const cursorOn = Math.floor(frame / 15) % 2 === 0;
        return (
          <div style={{
            position: "absolute", left: 540 - 235, top: 1608 + (1 - inP) * 40,
            width: 470, height: 90, borderRadius: 45,
            background: "rgba(13,16,23,0.68)", border: "1px solid rgba(255,255,255,0.13)",
            display: "flex", alignItems: "center", paddingLeft: 40,
            opacity: inP, boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
          }}>
            <span style={{ fontFamily: MONO, fontSize: 33, color: "rgba(255,255,255,0.55)" }}>
              interested?
            </span>
            <span style={{
              display: "inline-block", width: 3, height: 38, marginLeft: 10,
              background: "#fff", opacity: cursorOn ? 0.9 : 0,
            }} />
          </div>
        );
      })()}
    </div>
  );
};

/* ================================================================== */
/* Main composition                                                    */
/* ================================================================== */
export const AiLonelyShort: React.FC = () => {
  ensureFonts();
  const frame = useCurrentFrame();

  // micro-drift camera — never fully rests, one continuous gentle move
  const drift = {
    s: 1.06 + 0.006 * Math.sin(frame / 95),
    x: 6 * Math.sin(frame / 130),
    y: -26 + 5 * Math.cos(frame / 160),
  };
  // beat 4: the room gets warmer (~3% brightness lift, stays)
  const warm = ramp(frame, T.warmLiftA, T.warmLiftB);
  const endFade = 1 - ramp(frame, T.endFadeA, T.endFadeB, Easing.linear);

  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      {/* footage — vertical cover crop, face centered, eyes upper third */}
      <AbsoluteFill style={{
        transform: `translate(${drift.x}px, ${drift.y}px) scale(${drift.s})`,
        filter: `contrast(1.04) saturate(1.05) brightness(${1 + warm * 0.03})`,
      }}>
        <OffthreadVideo
          src={staticFile("shorts/ai-lonely/source.mp4")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>

      {/* soft grounding gradient behind the lower third, keeps the strip legible */}
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, height: 640,
        background: "linear-gradient(transparent, rgba(8,10,16,0.42))", pointerEvents: "none",
      }} />

      {/* design layer — fades out over the last 10 frames, cursor blinking last */}
      <AbsoluteFill style={{ opacity: endFade }}>
        <Captions />
        <PresenceStrip />
      </AbsoluteFill>

      {/* SFX — sparse, quiet, only where something lands (7 cues in 57s) */}
      <Sfx src="vedit/sfx/tick_soft.wav" at={T.claudeIn} volume={0.25} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={T.fill1} volume={0.22} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={T.fill2} volume={0.24} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={T.fill3} volume={0.26} />
      <Sfx src="vedit/sfx/soft.wav" at={T.lineSfx} volume={0.25} />
      <Sfx src="vedit/sfx/tap.wav" at={T.bubbleSettle - 3} volume={0.3} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={T.ctaSfx} volume={0.24} />
    </AbsoluteFill>
  );
};

export default AiLonelyShort;

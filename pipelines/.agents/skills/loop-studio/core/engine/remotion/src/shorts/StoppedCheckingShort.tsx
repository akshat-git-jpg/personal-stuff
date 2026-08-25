/**
 * StoppedCheckingShort — bespoke 9:16 short (1080x1920, 1662f @30fps, 55.4s)
 *
 * CONCEPT — THE REVIEW STACK HE STOPPED READING.
 * One environment: white "output" cards (the AI outputs he shipped without looking)
 * pile up beside him like unread mail, while a mono ledger chip counts
 * `shipped N · reviewed 0`. The stack grows, tilts under its own weight, multiplies
 * into faint ghosts, then everything fades except ONE card that finally receives a
 * lime `REVIEWED ✓` stamp. Ledger flips to `shipped 1 · reviewed 1`. "less, but good."
 *
 * Every event is anchored to a word start in words.json. Clean > aggressive:
 * the beat-4 tilt is the hardest move in the piece.
 */
import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
} from "remotion";

const FPS = 30;
const f = (sec: number) => Math.round(sec * FPS);

const RAISIN = "#0F121A";
const LIME = "#CFFF05";
const SILVER = "#B5BFC2";
const RED = "#E5484D";
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const SERIF = "'Playfair Display', Georgia, serif";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const BEZ = Easing.bezier(0.45, 0, 0.18, 1);

/* ---------------- words.json (verbatim; leading "works." bleed excluded) ---------------- */
type Word = { word: string; start: number; end: number };
const RAW: [string, number, number][] = [
  ["So", 0.54, 0.94], ["two", 0.94, 1.24], ["months", 1.24, 1.5], ["ago,", 1.5, 1.8],
  ["I", 1.82, 2.2], ["started", 2.2, 2.6], ["to", 2.6, 2.78], ["trust", 2.78, 3.12],
  ["AI", 3.12, 3.46], ["more", 3.46, 3.98], ["and", 3.98, 4.2], ["more", 4.2, 4.44],
  ["to", 4.44, 5.08], ["a", 5.08, 5.22], ["point", 5.22, 5.5], ["where", 5.5, 5.78],
  ["when", 5.78, 6.14], ["I", 6.14, 6.22], ["needed", 6.22, 6.42], ["to", 6.42, 6.6],
  ["do", 6.6, 6.72], ["something,", 6.72, 7.06], ["I", 7.08, 7.38], ["just", 7.38, 7.6],
  ["prompted", 7.6, 8.04], ["it", 8.04, 8.28], ["and", 8.28, 8.54], ["I", 8.54, 8.7],
  ["didn't", 8.7, 9.08], ["even", 9.08, 9.26], ["look", 9.26, 9.46], ["at", 9.46, 9.6],
  ["the", 9.6, 9.7], ["output.", 9.7, 10.04], ["And", 10.22, 10.48], ["I", 10.48, 10.7],
  ["know", 10.7, 10.9], ["a", 10.9, 11.04], ["lot", 11.04, 11.14], ["of", 11.14, 11.22],
  ["people", 11.22, 11.46], ["will", 11.46, 11.72], ["say", 11.72, 12.0], ["that's", 12.0, 12.34],
  ["stupid", 12.34, 12.6], ["because", 12.6, 12.98], ["it", 12.98, 13.56], ["is,", 13.56, 13.76],
  ["but", 13.8, 13.92], ["I", 13.92, 14.04], ["just", 14.04, 14.26], ["really", 14.26, 14.6],
  ["found", 14.6, 14.94], ["myself", 14.94, 15.42], ["becoming", 15.42, 16.12], ["more", 16.12, 16.56],
  ["and", 16.56, 16.68], ["more", 16.68, 16.78], ["lazy.", 16.78, 17.24], ["Like", 17.84, 17.94],
  ["even", 17.94, 18.3], ["the", 18.3, 18.46], ["effort", 18.46, 18.9], ["to", 18.9, 19.3],
  ["look", 19.3, 19.68], ["at", 19.68, 19.86], ["what", 19.86, 20.08], ["AI", 20.08, 20.34],
  ["has", 20.34, 20.7], ["done", 20.7, 21.08], ["became", 21.08, 22.12], ["something", 22.12, 22.56],
  ["that", 22.56, 22.78], ["felt", 22.78, 23.12], ["like", 23.12, 23.52], ["a", 23.52, 23.64],
  ["lot.", 23.64, 23.9], ["And", 24.04, 24.26], ["I", 24.26, 24.38], ["just", 24.38, 24.54],
  ["wanted", 24.54, 24.74], ["to", 24.74, 24.92], ["go", 24.92, 25.14], ["on", 25.14, 25.32],
  ["with", 25.32, 25.48], ["prompting.", 25.48, 26.06], ["At", 27.26, 27.76], ["one", 27.76, 28.0],
  ["moment", 28.0, 28.34], ["I", 28.34, 28.6], ["was", 28.6, 28.76], ["like", 28.76, 28.98],
  ["okay", 28.98, 29.32], ["enough", 29.32, 30.14], ["is", 30.14, 30.36], ["enough.", 30.36, 30.66],
  ["My", 32.2, 32.4], ["work", 32.4, 32.8], ["was", 32.8, 33.02], ["actually", 33.02, 33.4],
  ["getting", 33.4, 33.72], ["worse", 33.72, 34.44], ["and", 35.32, 35.8], ["I", 35.8, 36.28],
  ["felt", 36.28, 36.52], ["like", 36.52, 36.74], ["I", 36.74, 36.88], ["was", 36.88, 36.98],
  ["doing", 36.98, 37.16], ["more", 37.16, 37.6], ["but", 37.6, 38.1], ["everything", 38.1, 38.4],
  ["was", 38.4, 38.66], ["just", 38.66, 38.88], ["more", 38.88, 39.22], ["shit.", 39.22, 39.52],
  ["So", 40.2, 40.4], ["that", 40.4, 40.56], ["really", 40.56, 40.86], ["for", 40.86, 41.12],
  ["me", 41.12, 41.28], ["was", 41.28, 41.48], ["a", 41.48, 41.6], ["point", 41.6, 41.88],
  ["where", 41.88, 42.1], ["I", 42.1, 42.24], ["was", 42.24, 42.34], ["like", 42.34, 42.48],
  ["okay", 42.48, 42.68], ["I'm", 42.68, 42.82], ["gonna", 42.82, 42.96], ["step", 42.96, 43.24],
  ["back", 43.24, 43.6], ["and", 43.6, 44.52], ["I'm", 44.52, 44.88], ["gonna", 44.88, 45.02],
  ["go", 45.02, 45.24], ["for", 45.24, 45.4], ["quality", 45.4, 45.92], ["only", 45.92, 46.36],
  ["and", 46.36, 47.24], ["yes", 47.24, 47.48], ["I", 47.48, 47.62], ["want", 47.62, 47.74],
  ["to", 47.74, 47.88], ["be", 47.88, 48.02], ["as", 48.02, 48.14], ["productive", 48.14, 48.52],
  ["as", 48.52, 48.8], ["possible", 48.8, 49.18], ["but", 49.18, 49.4], ["at", 49.4, 49.6],
  ["the", 49.6, 49.7], ["end", 49.7, 49.8], ["of", 49.8, 50.0], ["the", 50.0, 50.0],
  ["day", 50.0, 50.2], ["if", 50.2, 50.66], ["I'm", 50.66, 50.82], ["shipping", 50.82, 51.06],
  ["all", 51.06, 51.38], ["these", 51.38, 51.54], ["things", 51.54, 51.84], ["and", 51.84, 52.14],
  ["they", 52.14, 52.54], ["all", 52.54, 53.1], ["suck", 53.1, 53.52],
];
const WORDS: Word[] = RAW.map(([word, start, end]) => ({ word, start, end }));

/* Captions run the whole runtime except beat 7's italic line — cut after "suck" (53.52). */
type Line = { words: Word[]; start: number; showUntil: number };
const LINES: Line[] = (() => {
  const out: { words: Word[]; start: number; showUntil: number }[] = [];
  let cur: Word[] = [];
  WORDS.forEach((w, i) => {
    cur.push(w);
    const next = WORDS[i + 1];
    const punct = /[.,!?]$/.test(w.word);
    if (cur.length >= 3 || punct || !next || next.start - w.end > 0.5) {
      out.push({ words: cur, start: cur[0].start, showUntil: 0 });
      cur = [];
    }
  });
  out.forEach((l, i) => {
    const last = l.words[l.words.length - 1];
    const next = out[i + 1];
    l.showUntil = next ? Math.min(next.start, last.end + 1.1) : last.end + 0.4;
  });
  return out;
})();

/* ---------------- event anchors (all word starts) ---------------- */
const SHIP_AT = [2.78, 4.2, 6.72, 7.6, 9.7, 24.54, 25.14, 25.48]; // trust · more · something · prompted · output · wanted · on · prompting
const ASIDE_AT = 13.56;      // "is," → "it is."
const OPEN_AT = 18.46;       // "effort" — one card half-opens
const CLOSE_AT = 21.08;      // "became" — the effort abandoned, card returns
const TILT_AT = 30.36;       // "enough." — the stack tips
const REDLINE_AT = 34.44;    // "worse" end-of-word land → red underline
const GHOSTS_AT = 37.16;     // "more" (doing more) — duplicates multiply
const DESAT_AT = 37.6;       // "but everything was just more shit" — worth less
const FADE_AT = 42.96;       // "step" — everything fades…
const MOVE_AT = 43.6;        // "and" after "back" — …except one card, coming forward
const LAND_AT = 45.4;        // "quality" — card lands centered
const STAMP_AT = 46.36;      // "and" after "only" — stamp begins, slow
const STAMP_LAND = 46.96;    // stamp LANDS → tick + ledger flips
const ITALIC_AT = 53.6;      // after "suck" — "less, but good."

/* ---------------- stack geometry ---------------- */
const CARD_W = 300, CARD_H = 168;
const BASE_X = 52, BASE_Y = 808, STEP = 62;
const JIT = [
  { x: 0, r: -1.5 }, { x: 14, r: 1.2 }, { x: -8, r: -0.8 }, { x: 10, r: 1.8 },
  { x: -4, r: -1.2 }, { x: 12, r: 0.6 }, { x: -10, r: -1.6 }, { x: 6, r: 1.0 },
];
const CHOSEN = 7; // top card = the one he finally reviews

/* beat-5 ghosts — faint duplicates in the back, both margins, never the face */
const GHOSTS: { x: number; y: number; r: number; at: number }[] = [
  { x: -24, y: 320, r: -4, at: 0 }, { x: 810, y: 260, r: 3, at: 1 },
  { x: 120, y: 210, r: 2, at: 2 }, { x: 880, y: 480, r: -3, at: 3 },
  { x: -40, y: 1060, r: 5, at: 4 }, { x: 820, y: 700, r: 2, at: 5 },
  { x: 60, y: 1180, r: -2, at: 6 }, { x: 860, y: 950, r: -5, at: 7 },
  { x: -10, y: 560, r: 3, at: 8 }, { x: 830, y: 1160, r: 4, at: 9 },
  { x: 150, y: 1300, r: -3, at: 10 }, { x: 900, y: 1330, r: 2, at: 11 },
].map((g, i) => ({ ...g, at: GHOSTS_AT + i * 0.16 }));

const Sfx: React.FC<{ src: string; at: number; volume?: number }> = ({ src, at, volume = 0.3 }) => (
  <Sequence from={at} durationInFrames={f(1.6)}>
    <Audio src={staticFile(`vedit/sfx/${src}`)} volume={volume} />
  </Sequence>
);

const GRAIN_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='240' height='240' filter='url(#n)' opacity='0.55'/></svg>`
  );

/* ---------------- output card ---------------- */
const OutputCard: React.FC<{ n: number; tagOpacity?: number; ghost?: boolean }> = ({ n, tagOpacity = 1, ghost }) => (
  <div style={{
    width: CARD_W, height: CARD_H, borderRadius: 12, background: "#fff",
    border: "1px solid rgba(15,18,26,0.08)",
    boxShadow: ghost ? "0 6px 18px rgba(0,0,0,0.25)" : "0 12px 30px rgba(0,0,0,0.38)",
    padding: "18px 20px", boxSizing: "border-box",
    display: "flex", flexDirection: "column", gap: 13,
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontFamily: MONO, fontSize: 19, fontWeight: 700, color: "#3B4252", letterSpacing: "0.02em" }}>
        output #{n}
      </span>
      <span style={{
        fontFamily: MONO, fontSize: 14, color: "#9AA3AD", background: "#EEF1F3",
        borderRadius: 6, padding: "3px 9px", opacity: tagOpacity,
      }}>unreviewed</span>
    </div>
    {[0.84, 0.62, 0.74].map((w, i) => (
      <div key={i} style={{ height: 12, width: `${w * 100}%`, background: "#E6E9EC", borderRadius: 6 }} />
    ))}
  </div>
);

/* ---------------- captions — lime karaoke, cardless ---------------- */
const Captions: React.FC<{ H: number }> = ({ H }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const line = LINES.find((l) => t >= l.start - 0.06 && t < l.showUntil);
  if (!line) return null;
  const inP = interpolate(frame, [f(line.start) - 2, f(line.start) + 4], [0, 1], { ...CLAMP, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{
      position: "absolute", left: 40, right: 40, top: H * 0.68, textAlign: "center",
      opacity: inP, transform: `translateY(${(1 - inP) * 6}px)`, pointerEvents: "none",
    }}>
      {line.words.map((w, i) => {
        const active = t >= w.start && t < w.end;
        return (
          <span key={i} style={{
            fontFamily: SANS, fontWeight: 800, fontSize: 64, textTransform: "uppercase",
            letterSpacing: "0.005em", color: active ? LIME : "#fff",
            margin: "0 11px", display: "inline-block",
            transform: active ? "scale(1.04)" : "none",
            textShadow: "0 4px 26px rgba(0,0,0,0.85), 0 2px 8px rgba(0,0,0,0.7)",
          }}>{w.word.replace(/[.,]$/, "")}</span>
        );
      })}
    </div>
  );
};

/* ---------------- ledger chip ---------------- */
const Ledger: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const appear = interpolate(frame, [f(2.2), f(2.6)], [0, 1], CLAMP);
  const flipped = frame >= f(STAMP_LAND);
  let shipped = SHIP_AT.filter((a) => t >= a).length;
  if (t > GHOSTS_AT) shipped = 8 + Math.floor(interpolate(frame, [f(GHOSTS_AT), f(39.4)], [0, 15], CLAMP));
  const reviewed = flipped ? 1 : 0;
  if (flipped) shipped = 1;
  const redline = interpolate(frame, [f(REDLINE_AT), f(REDLINE_AT) + 8], [0, 1], CLAMP)
    * (1 - interpolate(frame, [f(STAMP_LAND), f(STAMP_LAND) + 8], [0, 1], CLAMP));
  const pulse = interpolate(frame, [f(STAMP_LAND), f(STAMP_LAND) + 5, f(STAMP_LAND) + 14], [0, 1, 0], CLAMP);
  return (
    <div style={{
      position: "absolute", left: 44, top: 96, opacity: appear,
      transform: `translateY(${(1 - appear) * 8}px) scale(${1 + pulse * 0.06})`, transformOrigin: "left center",
      background: "rgba(15,18,26,0.78)", border: "1px solid rgba(255,255,255,0.14)",
      borderRadius: 10, padding: "12px 18px", fontFamily: MONO, fontSize: 26,
      color: SILVER, letterSpacing: "0.02em", pointerEvents: "none",
      boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
    }}>
      shipped <span style={{ color: "#fff", fontWeight: 700 }}>{shipped}</span>
      <span style={{ opacity: 0.5, margin: "0 10px" }}>·</span>
      <span style={{ position: "relative", display: "inline-block" }}>
        reviewed <span style={{ color: flipped ? LIME : "#fff", fontWeight: 700 }}>{reviewed}</span>
        <span style={{
          position: "absolute", left: 0, bottom: -6, height: 3, width: `${redline * 100}%`,
          background: RED, borderRadius: 2, opacity: redline,
        }} />
      </span>
    </div>
  );
};

/* ================================================================ */
export const StoppedCheckingShort: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const t = frame / FPS;

  /* ---- camera: settle in, freeze on the aside, one push (beat 5), one pull-back (the step back) ---- */
  const settle = interpolate(frame, [0, f(1.9)], [1.1, 1.035], { ...CLAMP, easing: BEZ });
  const push = interpolate(frame, [f(36.98), f(40.3)], [0, 0.05], { ...CLAMP, easing: BEZ });
  const pullBack = interpolate(frame, [f(MOVE_AT), f(46.0)], [0, 0.03], { ...CLAMP, easing: BEZ });
  const holdAmp = Math.min(
    1,
    1 - interpolate(frame, [f(12.4), f(12.9)], [0, 1], CLAMP)
      + interpolate(frame, [f(14.2), f(14.9)], [0, 1], CLAMP)
  );
  const driftX = Math.sin(frame / 53) * 5 * holdAmp;
  const driftY = Math.cos(frame / 71) * 4 * holdAmp;
  const camScale = settle + push - pullBack;

  /* ---- shared stack transforms ---- */
  const tilt = -3.5
    * interpolate(frame, [f(TILT_AT), f(TILT_AT) + 22], [0, 1], { ...CLAMP, easing: BEZ })
    * (1 - interpolate(frame, [f(MOVE_AT), f(LAND_AT)], [0, 1], { ...CLAMP, easing: BEZ }));
  const desat = interpolate(frame, [f(DESAT_AT), f(39.4)], [0, 1], CLAMP)
    * (1 - interpolate(frame, [f(43.0), f(44.6)], [0, 1], CLAMP));
  const tiltStyle: React.CSSProperties = {
    position: "absolute", inset: 0,
    transform: `rotate(${tilt}deg)`, transformOrigin: `${BASE_X + 30}px ${BASE_Y + CARD_H}px`,
  };

  /* ---- half-open card (i=4): the effort, abandoned ---- */
  const open =
    interpolate(frame, [f(OPEN_AT), f(19.6)], [0, 1], { ...CLAMP, easing: BEZ }) -
    interpolate(frame, [f(CLOSE_AT), f(22.3)], [0, 1], { ...CLAMP, easing: BEZ });

  /* ---- chosen card (i=7): down first, then swings right — one continuous move ---- */
  const mvT = interpolate(frame, [f(MOVE_AT), f(LAND_AT)], [0, 1], { ...CLAMP, easing: BEZ });
  const chosenX = (BASE_X + JIT[CHOSEN].x) + (330 - BASE_X - JIT[CHOSEN].x) * Math.pow(mvT, 2.1);
  const chosenY = (BASE_Y - CHOSEN * STEP) + (950 - (BASE_Y - CHOSEN * STEP)) * Easing.out(Easing.cubic)(mvT);
  const chosenScale = 1 + 0.4 * mvT;
  const chosenRot = JIT[CHOSEN].r * (1 - mvT);
  const stampP = interpolate(frame, [f(STAMP_AT), f(STAMP_LAND)], [0, 1], { ...CLAMP, easing: BEZ });
  const chosenFade = 1 - interpolate(frame, [1652, 1662], [0, 1], CLAMP);

  /* ---- aside "it is." (beat 2) ---- */
  const asideIn = interpolate(frame, [f(ASIDE_AT), f(ASIDE_AT) + 10], [0, 1], { ...CLAMP, easing: Easing.out(Easing.cubic) });
  const asideOut = interpolate(frame, [f(15.2), f(15.7)], [0, 1], CLAMP);

  /* ---- closer italic + fade to black (card last to leave) ---- */
  const italicIn = interpolate(frame, [f(ITALIC_AT), f(ITALIC_AT) + 16], [0, 1], { ...CLAMP, easing: Easing.out(Easing.cubic) });
  const italicFade = 1 - interpolate(frame, [1648, 1658], [0, 1], CLAMP);
  const black = interpolate(frame, [1644, 1657], [0, 1], CLAMP);
  const entrance = interpolate(frame, [0, 10], [0.7, 0], CLAMP);

  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      {/* footage — center cover crop (face centered, eyes upper third), micro-drift camera */}
      <AbsoluteFill style={{
        transform: `translate(${driftX}px, ${driftY}px) scale(${camScale})`,
        filter: "contrast(1.06) saturate(1.08)",
      }}>
        <OffthreadVideo src={staticFile("shorts/stopped-checking-ai/source.mp4")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>

      {/* ghosts — beat 5, in the back */}
      <div style={tiltStyle}>
        {GHOSTS.map((g, i) => {
          if (frame < f(g.at)) return null;
          const p = interpolate(frame, [f(g.at), f(g.at) + 6], [0, 1], CLAMP);
          const gone = 1 - interpolate(frame, [f(FADE_AT), f(FADE_AT) + 12], [0, 1], CLAMP);
          return (
            <div key={i} style={{
              position: "absolute", left: g.x, top: g.y - p * 6, width: CARD_W * 0.8,
              transform: `rotate(${g.r}deg) scale(0.8)`, transformOrigin: "top left",
              opacity: 0.16 * p * gone, filter: "grayscale(1)",
            }}>
              <OutputCard n={9 + i} ghost />
            </div>
          );
        })}
      </div>

      {/* the stack (cards 1..7 — chosen card 8 lives in its own top layer) */}
      <div style={{ ...tiltStyle, filter: `grayscale(${desat}) brightness(${1 - desat * 0.25})` }}>
        {SHIP_AT.map((at, i) => {
          if (i === CHOSEN || frame < f(at)) return null;
          const inP = interpolate(frame, [f(at), f(at) + 14], [0, 1], { ...CLAMP, easing: BEZ });
          const fade = 1 - interpolate(frame, [f(FADE_AT) + i * 3, f(FADE_AT) + i * 3 + 14], [0, 1], CLAMP);
          const isOpen = i === 4 ? open : 0;
          const x = BASE_X + JIT[i].x + (1 - inP) * -420 + 150 * isOpen;
          const y = BASE_Y - i * STEP + 300 * isOpen;
          const rot = JIT[i].r * (1 - isOpen);
          const sc = 1 + 0.26 * isOpen;
          return (
            <div key={i} style={{
              position: "absolute", left: x, top: y, opacity: inP * fade,
              transform: `rotate(${rot}deg) scale(${sc})`, transformOrigin: "top left",
              zIndex: i + (isOpen > 0.05 ? 20 : 0),
            }}>
              <OutputCard n={i + 1} />
            </div>
          );
        })}
      </div>

      {/* beat 2 aside — dry, small */}
      {frame >= f(ASIDE_AT) && (
        <div style={{
          position: "absolute", left: 76, top: 468,
          fontFamily: SERIF, fontStyle: "italic", fontSize: 44, color: "rgba(255,255,255,0.92)",
          opacity: asideIn * (1 - asideOut), transform: `translateY(${(1 - asideIn) * 6}px)`,
          textShadow: "0 3px 20px rgba(0,0,0,0.7)", pointerEvents: "none",
        }}>it is.</div>
      )}

      <Ledger />
      <Captions H={H} />

      {/* fade to black — card sits above this, last to leave */}
      <AbsoluteFill style={{ background: "#000", opacity: black, pointerEvents: "none" }} />

      {/* chosen card — top of stack, then forward for its stamp */}
      {frame >= f(SHIP_AT[CHOSEN]) && (
        <div style={tiltStyle}>
          {(() => {
            const inP = interpolate(frame, [f(SHIP_AT[CHOSEN]), f(SHIP_AT[CHOSEN]) + 14], [0, 1], { ...CLAMP, easing: BEZ });
            return (
              <div style={{
                position: "absolute", left: chosenX + (1 - inP) * -420, top: chosenY,
                opacity: inP * chosenFade,
                transform: `rotate(${chosenRot}deg) scale(${chosenScale})`, transformOrigin: "top left",
                filter: `grayscale(${desat * (1 - mvT)}) brightness(${1 - desat * (1 - mvT) * 0.25})`,
              }}>
                <div style={{ position: "relative" }}>
                  <OutputCard n={CHOSEN + 1} tagOpacity={1 - stampP} />
                  {frame >= f(STAMP_AT) && (
                    <div style={{
                      position: "absolute", left: "50%", top: "50%",
                      transform: `translate(-50%, -50%) rotate(-7deg) scale(${1.6 - 0.6 * stampP})`,
                      opacity: stampP,
                      background: RAISIN, border: `2.5px solid ${LIME}`, borderRadius: 8,
                      padding: "7px 16px", fontFamily: MONO, fontWeight: 700, fontSize: 26,
                      color: LIME, letterSpacing: "0.06em", whiteSpace: "nowrap",
                      boxShadow: "0 8px 22px rgba(0,0,0,0.35)",
                    }}>reviewed ✓</div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* beat 7 closer — "less, but good." */}
      {frame >= f(ITALIC_AT) && (
        <div style={{
          position: "absolute", left: 0, right: 0, top: 1238, textAlign: "center",
          fontFamily: SERIF, fontStyle: "italic", fontSize: 54, color: "rgba(255,255,255,0.94)",
          opacity: italicIn * italicFade, transform: `translateY(${(1 - italicIn) * 6}px)`,
          textShadow: "0 3px 24px rgba(0,0,0,0.75)", pointerEvents: "none",
        }}>less, but good.</div>
      )}

      {/* entrance treatment + vignette + grain */}
      <AbsoluteFill style={{ background: RAISIN, opacity: entrance, pointerEvents: "none" }} />
      <AbsoluteFill style={{
        pointerEvents: "none",
        background: "radial-gradient(ellipse 80% 58% at 50% 38%, transparent 55%, rgba(6,8,14,0.4) 100%)",
      }} />
      <AbsoluteFill style={{
        pointerEvents: "none", opacity: 0.05, mixBlendMode: "overlay",
        backgroundImage: `url("${GRAIN_URI}")`, backgroundSize: "135px",
        transform: `translate(${(frame % 3) * 3}px, ${(frame % 2) * -3}px)`,
      }} />

      {/* SFX — sparse, on landings */}
      <Sfx src="slide.wav" at={f(2.78) + 10} volume={0.34} />
      <Sfx src="tick_soft.wav" at={f(9.7) + 10} volume={0.26} />
      <Sfx src="slide.wav" at={f(19.2)} volume={0.28} />
      <Sfx src="soft.wav" at={f(21.55)} volume={0.28} />
      <Sfx src="soft.wav" at={f(TILT_AT) + 20} volume={0.34} />
      <Sfx src="tap.wav" at={f(REDLINE_AT) + 8} volume={0.3} />
      <Sfx src="soft.wav" at={f(LAND_AT)} volume={0.3} />
      <Sfx src="tick.wav" at={f(STAMP_LAND)} volume={0.42} />
      <Sfx src="tick_soft.wav" at={f(ITALIC_AT) + 12} volume={0.24} />
    </AbsoluteFill>
  );
};

export default StoppedCheckingShort;

/**
 * WaveIntro v2 — WORLD-CANVAS register, 9:16 (per Luuk: "I miss a sense of greatness.
 * Everything is quite small — move me to a smaller section, use the rest of the frame
 * to show things at scale.")
 *
 * Concept unchanged: BIG NUMBER, TWO DOTS. Now the disproportion is physical:
 * a $400M that does not fit the frame, next to two person marks the size of ants.
 *
 * Register (after VideoEditIntro.tsx): full-frame silver draftsman canvas + faded
 * raisin grid, world camera [frame, x, y, zoom], speaker as a rounded screen-space
 * card with its own keyframes (opens near-fullscreen, glides small, returns at close).
 *
 * Camera map (one move per intention, micro-drift on holds):
 *   f0–f36    close ON the giant number (it bleeds both edges) while the card shrinks;
 *             counter rolls f18–f40.
 *   f36–f60   THE pull-back: number revealed whole + two tiny dots tick on (f55/f63).
 *   f100–f122 dive DOWN the canvas to the stack set piece ("copying their stack").
 *   f158      chip pins; f194–f224 the SAME dots fly down the world to the chip.
 *   f225/247/267  blocks light at scale on ChatGPT / Claude / Groq; tag f280.
 *   f310–f324 settle down to frame the bubble; f326 support·ai pops (the lime moment).
 *   f350+     card grows back toward the viewer; world fades f373–f383.
 */
import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
} from "remotion";

const FPS = 30;
const f = (sec: number) => Math.round(sec * FPS);

const RAISIN = "#0F121A";
const SILVER_BG = "#E9ECED";
const SILVER_SOFT = "#D2D8DA";
const BODY = "#5A6068";
const LIME = "#CFFF05";
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const SERIF = "'Playfair Display', Georgia, serif";

const EASE = Easing.bezier(0.45, 0, 0.18, 1);
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

/* ---------------- word anchors (words.json) ---------------- */
const T = {
  rollStart: 18, rollLand: 40,          // "$400" → land as "earned" begins
  earnedBy: f(1.06),                    // "earned"
  dot1: f(1.82), dot2: f(2.1),          // "two" / "people"
  stackIn: f(4.14),                     // "copying"
  ghostFan: f(4.54),                    // "their"
  chipIn: f(5.26),                      // "Telehealth"
  dotsGlide: f(6.48),                   // "Two person team"
  label1: f(7.5), label2: f(8.24), label3: f(8.9), // ChatGPT / Claude / Groq
  tagIn: f(9.32),                       // "code"
  bubbleIn: f(10.86),                   // "created"
  fadeOut: 373,
};

/* ---------------- world camera ---------------- */
const CAM: [number, number, number, number][] = [
  [0, 700, 1150, 1.15],      // close on the number — it bleeds both edges
  [36, 730, 1170, 1.12],     // micro drift through the roll
  [60, 900, 1270, 0.66],     // THE pull-back: whole number + tiny dots
  [100, 910, 1290, 0.675],   // hold-creep through "with AI, and everyone started"
  [122, 900, 3700, 0.85],    // dive down the canvas to the stack
  [279, 905, 3715, 0.89],    // slow creep while the blocks light
  [324, 900, 3742, 0.872],   // settle down — bubble enters the frame, chip stays clear of the card
  [383, 903, 3748, 0.876],   // creep to the end
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

const GRID_URI = (() => {
  const s = 76;
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'><path d='M ${s} 0 L 0 0 0 ${s}' fill='none' stroke='rgba(15,18,26,0.10)' stroke-width='1'/></svg>`
    )
  );
})();

const useIn = (at: number, dur = 16) => {
  const frame = useCurrentFrame();
  if (frame < at) return 0;
  return interpolate(frame, [at, at + dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
};

/* ---------------- karaoke lines (garbled names corrected in TEXT only) ---------------- */
type CapWord = { t: string; at: number };
const CAP_LINES: { words: CapWord[]; end: number }[] = [
  { words: [{ t: "WITH", at: 2.48 }, { t: "AI", at: 2.8 }], end: 3.38 },
  { words: [{ t: "AND", at: 3.38 }, { t: "EVERYONE", at: 3.4 }, { t: "STARTED", at: 3.78 }], end: 4.14 },
  { words: [{ t: "COPYING", at: 4.14 }, { t: "THEIR", at: 4.54 }, { t: "STACK", at: 4.78 }], end: 5.26 },
  { words: [{ t: "TELEHEALTH", at: 5.26 }, { t: "STARTUP", at: 5.78 }], end: 6.48 },
  { words: [{ t: "TWO", at: 6.48 }, { t: "PERSON", at: 6.58 }, { t: "TEAM", at: 6.84 }], end: 7.28 },
  { words: [{ t: "THEY", at: 7.28 }, { t: "USE", at: 7.32 }, { t: "CHATGPT", at: 7.5 }], end: 8.24 },
  { words: [{ t: "CLAUDE", at: 8.24 }, { t: "AND", at: 8.46 }, { t: "GROQ", at: 8.9 }], end: 9.14 },
  { words: [{ t: "FOR", at: 9.14 }, { t: "CODE", at: 9.32 }], end: 9.64 },
  { words: [{ t: "AND", at: 9.64 }, { t: "COPY", at: 9.86 }], end: 10.36 },
  { words: [{ t: "AND", at: 10.36 }, { t: "THEY", at: 10.54 }, { t: "CREATED", at: 10.86 }], end: 11.3 },
  { words: [{ t: "AN", at: 11.3 }, { t: "AI", at: 11.46 }], end: 11.66 },
  { words: [{ t: "CUSTOMER", at: 11.66 }, { t: "SERVICE", at: 11.98 }], end: 12.4 },
];

const Sfx: React.FC<{ src: string; at: number; volume?: number }> = ({ src, at, volume = 0.26 }) => (
  <Sequence from={at} durationInFrames={f(1.4)}>
    <Audio src={staticFile(src)} volume={volume} />
  </Sequence>
);

const PersonMark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size * 1.22} viewBox="0 0 28 34" style={{ display: "block" }}>
    <circle cx="14" cy="9" r="7" fill={RAISIN} />
    <path d="M 2 32 C 2 23.5 7 19.5 14 19.5 C 21 19.5 26 23.5 26 32 Z" fill={RAISIN} />
  </svg>
);

/* ================================================================== */
export const WaveIntro: React.FC = () => {
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

  const fade = interpolate(frame, [T.fadeOut, 383], [1, 0], clamp);        // captions
  const worldFade = interpolate(frame, [368, 383], [1, 0], clamp);         // world dissolves as the card returns

  /* ---------- speaker card (screen space): near-fullscreen → small top → back at close ---------- */
  const spk = (() => {
    const kf: [number, number, number, number][] = [
      [0, 0.5, 0.5, 0.94],      // OPEN near-fullscreen, sliver of canvas at the edges
      [8, 0.5, 0.5, 0.94],
      [28, 0.5, 0.235, 0.34],   // glide to a small card upper frame — the world takes over
      [324, 0.5, 0.235, 0.34],
      [358, 0.5, 0.235, 0.34],
      [383, 0.5, 0.295, 0.45],  // come back toward the viewer at the close
    ];
    for (let i = 0; i < kf.length - 1; i++) {
      const [fa, xa, ya, wa] = kf[i]; const [fb, xb, yb, wb] = kf[i + 1];
      if (frame >= fa && frame <= fb) {
        const t = EASE((frame - fa) / Math.max(1, fb - fa));
        return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, w: wa + (wb - wa) * t };
      }
    }
    const [, x, y, w] = kf[kf.length - 1]; return { x, y, w };
  })();
  const spkW = spk.w * W, spkH = spkW * 16 / 9; // source is vertical 9:16
  const hookBlur = interpolate(frame, [0, 16], [8, 0], { ...clamp, easing: Easing.out(Easing.quad) });
  const hookScale = interpolate(frame, [0, 60], [1.06, 1], { ...clamp, easing: Easing.bezier(0.3, 0, 0.4, 1) });

  /* ---------- world set piece A: THE NUMBER ---------- */
  const rollV = Math.round(interpolate(frame, [T.rollStart, T.rollLand], [0, 400], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const numIn = interpolate(frame, [10, 20], [0, 1], clamp);
  const landK = spring({ frame: frame - T.rollLand, fps: FPS, config: { damping: 15, stiffness: 150 }, durationInFrames: 14 });
  const numScale = frame >= T.rollLand ? 1 + 0.022 * (1 - landK) : 1;
  const earnedP = useIn(T.earnedBy, 12);

  /* ---------- the two dots: beside the number → fly down to the chip ---------- */
  const glideP = interpolate(frame, [T.dotsGlide, T.dotsGlide + 30], [0, 1], { ...clamp, easing: EASE });
  const dotWorld = (i: number) => {
    const a = { x: 1500 + i * 78, y: 1520 };           // beside the giant number (tiny)
    const b = { x: 468 + i * 82, y: 3552 };            // left of the chip (clear of its raisin edge)
    return {
      x: a.x + (b.x - a.x) * glideP - Math.sin(glideP * Math.PI) * 130, // gentle arc
      y: a.y + (b.y - a.y) * glideP,
    };
  };
  const dotIn = (i: number) =>
    spring({ frame: frame - (i === 0 ? T.dot1 : T.dot2), fps: FPS, config: { damping: 13, stiffness: 180 }, durationInFrames: 16 });

  /* ---------- world set piece B: THE STACK ---------- */
  const BW = 640, BH = 110, GAP = 22, SX = 900 - BW / 2, SY = 3660;
  const LABELS = ["chatgpt", "claude", "groq"];
  const LIT = [T.label1, T.label2, T.label3];
  const chipP = spring({ frame: frame - T.chipIn, fps: FPS, config: { damping: 14, stiffness: 170 }, durationInFrames: 18 });
  const tagP = useIn(T.tagIn, 10);
  const bubbleP = spring({ frame: frame - T.bubbleIn, fps: FPS, config: { damping: 12, stiffness: 160 }, durationInFrames: 20 });
  const ghostOffsets = [
    { dx: 70, dy: -46, o: 0.30 },
    { dx: 140, dy: -92, o: 0.17 },
    { dx: 210, dy: -138, o: 0.08 },
  ];

  /* ---------- captions (SCREEN space, bottom, clear of card + set pieces) ---------- */
  const sec = frame / FPS;
  const line = CAP_LINES.find((l) => sec >= l.words[0].at && sec < l.end);
  const lineKey = line ? line.words[0].at : -1;
  const linePop = line ? interpolate(sec, [line.words[0].at, line.words[0].at + 0.12], [0, 1], clamp) : 0;

  return (
    <AbsoluteFill style={{ background: SILVER_BG, fontFamily: SANS }}>
      {/* parallaxed faded grid */}
      <AbsoluteFill style={{
        backgroundImage: `url("${GRID_URI}")`,
        backgroundSize: `${76 * c.z}px`,
        backgroundPosition: `${W / 2 - c.x * c.z}px ${H / 2 - c.y * c.z}px`,
        maskImage: "radial-gradient(ellipse 85% 70% at 50% 45%, #000 0%, rgba(0,0,0,.35) 62%, transparent 94%)",
        WebkitMaskImage: "radial-gradient(ellipse 85% 70% at 50% 45%, #000 0%, rgba(0,0,0,.35) 62%, transparent 94%)",
      }} />

      {/* ================= THE WORLD ================= */}
      <div style={{ ...worldStyle, opacity: worldFade }}>
        {/* --- A. the giant number --- */}
        <div style={{
          position: "absolute", left: 900, top: 1010, whiteSpace: "nowrap",
          transform: `translateX(-50%) scale(${numScale})`, transformOrigin: "center 70%",
          opacity: numIn, lineHeight: 1,
        }}>
          <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 480, letterSpacing: "-0.045em", color: RAISIN }}>
            ${rollV}<span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 600 }}>M</span>
          </span>
        </div>
        {/* EARNED BY — small mono, up-left of the number */}
        <div style={{
          position: "absolute", left: 170, top: 900, whiteSpace: "nowrap",
          fontFamily: MONO, fontSize: 30, fontWeight: 700, letterSpacing: "0.32em", color: BODY,
          opacity: earnedP, transform: `translateY(${(1 - earnedP) * 14}px)`,
        }}>EARNED BY</div>
        {/* two people — tiny label under the dots' start position */}
        {frame >= T.dot2 && glideP < 0.05 && (
          <div style={{
            position: "absolute", left: 1468, top: 1608, whiteSpace: "nowrap",
            fontFamily: MONO, fontSize: 24, letterSpacing: "0.2em", color: BODY,
            opacity: dotIn(1) * (1 - glideP * 20),
          }}>TWO PEOPLE</div>
        )}

        {/* --- B. ghost copies of the stack (behind) --- */}
        {frame >= T.ghostFan &&
          ghostOffsets.map((g, gi) => {
            const born = T.ghostFan + gi * 7;
            if (frame < born) return null;
            const p = interpolate(frame, [born, born + 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
            return (
              <div key={gi} style={{ position: "absolute", left: SX + g.dx * p, top: SY + g.dy * p, opacity: g.o * p }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    width: BW, height: BH, marginBottom: GAP, boxSizing: "border-box",
                    borderRadius: 16, border: `2px solid rgba(15,18,26,0.55)`,
                  }} />
                ))}
              </div>
            );
          })}

        {/* --- B. the stack, at scale --- */}
        {frame >= T.stackIn &&
          [0, 1, 2].map((i) => {
            const born = T.stackIn + i * 4;
            const p = spring({ frame: frame - born, fps: FPS, config: { damping: 14, stiffness: 160 }, durationInFrames: 18 });
            const lit = frame >= LIT[i];
            const litK = spring({ frame: frame - LIT[i], fps: FPS, config: { damping: 12, stiffness: 190 }, durationInFrames: 14 });
            return (
              <div key={i} style={{
                position: "absolute", left: SX, top: SY + i * (BH + GAP), width: BW, height: BH,
                boxSizing: "border-box", borderRadius: 16,
                background: lit ? RAISIN : "#FFFFFF",
                border: `1.5px solid ${lit ? RAISIN : SILVER_SOFT}`,
                boxShadow: lit
                  ? "0 18px 40px -12px rgba(15,18,26,0.45)"
                  : "0 2px 6px rgba(15,18,26,.07), 0 16px 34px -14px rgba(15,18,26,.20)",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: p, transform: `translateY(${(1 - p) * 26}px) scale(${lit ? 1 + 0.03 * (1 - litK) : 1})`,
              }}>
                <span style={{ position: "absolute", left: 20, top: 12, fontFamily: MONO, fontSize: 20, color: lit ? "rgba(255,255,255,0.45)" : "rgba(15,18,26,0.30)" }}>0{i + 1}</span>
                {lit && (
                  <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 52, letterSpacing: "0.1em", color: "#fff", opacity: litK }}>
                    {LABELS[i]}
                  </span>
                )}
              </div>
            );
          })}

        {/* --- B. chip: telehealth · 2 people --- */}
        {frame >= T.chipIn && (
          <div style={{
            position: "absolute", left: 900, top: 3580, whiteSpace: "nowrap",
            transform: `translate(-50%, -50%) translateY(${(1 - chipP) * 20}px)`, opacity: chipP,
          }}>
            <div style={{
              padding: "14px 30px", borderRadius: 12, background: RAISIN,
              fontFamily: MONO, fontSize: 32, letterSpacing: "0.1em", color: SILVER_BG,
              boxShadow: "0 14px 34px -10px rgba(15,18,26,.4)",
            }}>telehealth · 2 people</div>
          </div>
        )}

        {/* --- tag: code + copy --- */}
        {frame >= T.tagIn && (
          <div style={{
            position: "absolute", left: 900, top: 4108, whiteSpace: "nowrap",
            transform: `translateX(-50%) translateY(${(1 - tagP) * 12}px)`,
            fontFamily: MONO, fontSize: 28, letterSpacing: "0.24em", color: BODY, opacity: tagP,
          }}>code + copy</div>
        )}

        {/* --- C. the closer: support · ai bubble (the one lime moment) --- */}
        {frame >= T.bubbleIn && (
          <div style={{
            position: "absolute", left: 900, top: 4290, whiteSpace: "nowrap",
            transform: `translate(-50%, -50%) translateY(${(1 - bubbleP) * 30}px) scale(${0.88 + 0.12 * bubbleP})`,
            opacity: bubbleP,
          }}>
            <div style={{ position: "relative" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 26,
                padding: "22px 38px", borderRadius: 30, background: "#FFFFFF",
                border: `1px solid ${SILVER_SOFT}`,
                boxShadow: "0 4px 10px rgba(15,18,26,.08), 0 26px 54px -16px rgba(15,18,26,.3)",
              }}>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 40, letterSpacing: "0.1em", color: RAISIN }}>support · ai</span>
                <span style={{ display: "flex", gap: 12 }}>
                  {[0, 1, 2].map((i) => {
                    const ph = (frame - T.bubbleIn) / 9 - i * 0.55;
                    const pulse = 0.35 + 0.65 * Math.max(0, Math.sin(ph * Math.PI));
                    return (
                      <span key={i} style={{
                        width: 22, height: 22, borderRadius: "50%",
                        background: LIME, opacity: pulse, transform: `scale(${0.75 + 0.35 * pulse})`,
                        boxShadow: `0 0 ${16 * pulse}px rgba(207,255,5,${0.5 * pulse})`,
                        border: "1px solid rgba(15,18,26,0.18)",
                      }} />
                    );
                  })}
                </span>
              </div>
              <div style={{
                position: "absolute", left: 44, bottom: -14, width: 32, height: 32,
                background: "#FFFFFF", borderRight: `1px solid ${SILVER_SOFT}`, borderBottom: `1px solid ${SILVER_SOFT}`,
                transform: "rotate(45deg)", borderRadius: 5,
              }} />
            </div>
          </div>
        )}

        {/* --- the two person dots (world elements; the continuity thread) --- */}
        {[0, 1].map((i) => {
          if (frame < (i === 0 ? T.dot1 : T.dot2)) return null;
          const p = dotIn(i);
          const pos = dotWorld(i);
          return (
            <div key={i} style={{
              position: "absolute", left: pos.x, top: pos.y,
              opacity: p, transform: `scale(${0.5 + 0.5 * p})`,
              filter: "drop-shadow(0 6px 12px rgba(15,18,26,0.28))",
            }}>
              <PersonMark size={48} />
            </div>
          );
        })}
      </div>

      {/* ================= SPEAKER CARD (screen space) ================= */}
      <div style={{
        position: "absolute",
        left: spk.x * W - spkW / 2, top: spk.y * H - spkH / 2, width: spkW, height: spkH,
        borderRadius: 12, overflow: "hidden",
        boxShadow: "0 6px 22px rgba(15,18,26,0.30), 0 0 0 1px rgba(15,18,26,0.10)",
      }}>
        <OffthreadVideo src={staticFile("intros/wave_scene1/source.mp4")}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            transform: `scale(${hookScale})`,
            filter: `contrast(1.05) saturate(1.06)${hookBlur > 0.1 ? ` blur(${hookBlur}px)` : ""}`,
          }} />
      </div>

      {/* ================= KARAOKE CAPTIONS (screen space, bottom) ================= */}
      {line && (
        <div key={lineKey} style={{
          position: "absolute", left: u * 3, right: u * 3, top: H * 0.87 - u * 3.2, textAlign: "center",
          opacity: fade * linePop, transform: `scale(${0.965 + 0.035 * linePop})`, pointerEvents: "none",
        }}>
          {line.words.map((w, i) => {
            const current = sec >= w.at && (i === line.words.length - 1 || sec < line.words[i + 1].at);
            return (
              <span key={i} style={{
                fontFamily: SANS, fontWeight: 800, fontSize: u * 4.7, letterSpacing: "0.005em",
                color: RAISIN, background: current ? LIME : "transparent",
                padding: `0 ${u * 0.7}px`, borderRadius: u * 0.55,
                margin: `0 ${u * 0.35}px`, display: "inline-block",
              }}>{w.t}</span>
            );
          })}
        </div>
      )}

      {/* soft edge vignette on the canvas */}
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 80% 72% at 50% 44%, transparent 62%, rgba(15,18,26,0.09) 100%)" }} />

      {/* ---- SFX: 8 cues, on landings ---- */}
      <Sfx src="vedit/sfx/soft.wav" at={T.rollLand} volume={0.3} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={T.dot1} volume={0.24} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={T.dot2} volume={0.24} />
      <Sfx src="vedit/sfx/slide.wav" at={T.ghostFan} volume={0.28} />
      <Sfx src="vedit/sfx/tick.wav" at={T.label1} volume={0.24} />
      <Sfx src="vedit/sfx/tick.wav" at={T.label2} volume={0.24} />
      <Sfx src="vedit/sfx/tick.wav" at={T.label3} volume={0.24} />
      <Sfx src="vedit/sfx/soft.wav" at={T.bubbleIn} volume={0.3} />
    </AbsoluteFill>
  );
};

export default WaveIntro;

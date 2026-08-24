/**
 * LeftLovableShort — bespoke 9:16 short (1404f @30fps, 1080x1920)
 * Concept: THE STACK WITH A SWAPPABLE SOCKET.
 * Three fixed base blocks (data / routines / skills) + one dashed socket above them
 * where the current tool block sits. Tools swap; the base is his.
 *
 * Beats (anchored to shorts/left-lovable/words.json):
 *  1. 0–5.9s    stack draws on bottom-up, Lovable clicks into the socket at "all in",
 *               dims in place at "don't even use it anymore"
 *  2. 7.9–14.2s price tag pins to the dim Lovable block, strike draws at "took"
 *  3. 15.7–17.2s THE SWAP — Lovable lifts out, Claude seats. Camera follows, seat tick.
 *  4. 20.5–25s  lime threads grow down from Claude into all three base blocks, pulse
 *               once at "game changer" (the lime moment)
 *  5. 26.9–31.9s Claude half-lifts and hovers; socket dashes go hot (the socket is the
 *               lesson); Playfair aside "even this one." at "even not with Claude"
 *  6. 32–43.8s  Claude re-seats at "get a stack", then lifts away and a dashed ghost
 *               block seats exactly on "switch"; base blocks brighten at "stuck"
 *  7. 44.7s+    settle; "the stack is yours." Fade last 10 frames.
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
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const SERIF = "'Playfair Display', Georgia, serif";

/* ------------------------------------------------------------------ */
/* Stack geometry (1080x1920 space)                                    */
/* ------------------------------------------------------------------ */
const SX = 66;            // stack left
const BW = 336;           // block width
const BH = 74;            // block height
const GAP = 12;
const SOCKET_Y = 1318;    // top of the tool block when seated
const SKILLS_Y = SOCKET_Y + BH + GAP;      // 1404
const ROUTINES_Y = SKILLS_Y + BH + GAP;    // 1490
const DATA_Y = ROUTINES_Y + BH + GAP;      // 1576
const DROP = 170;         // entry/exit travel for tool blocks

/* ------------------------------------------------------------------ */
/* Timing anchors (from words.json)                                    */
/* ------------------------------------------------------------------ */
const T = {
  baseIn: [f(0.4), f(0.9), f(1.4)],   // data, routines, skills
  socketIn: f(1.9),
  lovIn: f(2.32),                      // "all in"
  dimA: f(4.58), dimB: f(5.5),         // "don't ... anymore"
  tagIn: f(7.92),                      // "told"
  strikeA: f(12.86), strikeB: f(13.3), // "took"
  lovOut: f(15.66),                    // "but Claude"
  clIn: f(16.74),                      // second "Claude" — lands ~f(17.2) with the tick
  thr: [f(20.46), f(20.96), f(21.46)], // "whole context it has"
  pulse: f(24.44),                     // "game changer"
  liftA: f(26.88), liftB: f(27.5),     // "never put"
  hotAt: f(27.4),
  asideA: f(30.04), asideB: f(31.9),   // "even not with Claude"
  reseatA: f(31.98), reseatB: f(32.45),// "get a stack"
  clOutA: f(38.42), clOutB: f(39.4),   // "something like that happens"
  ghIn: f(39.7),
  brightAt: f(42.7),                   // "stuck"
  closerAt: f(45.35),                  // "that is worth something" — delayed past the last caption's fade-out so the two never overlap
};

/* ------------------------------------------------------------------ */
/* Camera                                                              */
/* ------------------------------------------------------------------ */
const CAM: [number, number, number, number][] = [
  [0, 1.10, 0, 12],
  [75, 1.03, 0, 0],
  [469, 1.03, 0, 0],
  [516, 1.095, 66, -46],   // one move: follow the swap down-left, peaks on the seat
  [558, 1.095, 66, -46],
  [614, 1.03, 0, 0],
  [1290, 1.03, 0, 0],
  [1403, 1.06, 0, -18],    // slow closer push
];
function cam(frame: number) {
  const ks = CAM;
  if (frame <= ks[0][0]) return { s: ks[0][1], x: ks[0][2], y: ks[0][3] };
  for (let i = 0; i < ks.length - 1; i++) {
    const [fa, sa, xa, ya] = ks[i]; const [fb, sb, xb, yb] = ks[i + 1];
    if (frame >= fa && frame <= fb) {
      const t = Easing.bezier(0.4, 0, 0.2, 1)((frame - fa) / Math.max(1, fb - fa));
      return { s: sa + (sb - sa) * t, x: xa + (xb - xa) * t, y: ya + (yb - ya) * t };
    }
  }
  const [, s, x, y] = ks[ks.length - 1]; return { s, x, y };
}

const Sfx: React.FC<{ src: string; at: number; volume?: number }> = ({ src, at, volume = 0.3 }) => (
  <Sequence from={at} durationInFrames={f(1.4)}>
    <Audio src={staticFile(`vedit/sfx/${src}`)} volume={volume} />
  </Sequence>
);

const GRAIN_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='240' height='240' filter='url(#n)' opacity='0.55'/></svg>`
  );

/* ------------------------------------------------------------------ */
/* Claude block position (shared by block + threads)                   */
/* ------------------------------------------------------------------ */
function claudeState(frame: number, fps: number) {
  // entrance (spring seat with a small settle)
  const sp = spring({ frame: frame - T.clIn, fps, config: { damping: 13, stiffness: 110 }, durationInFrames: 30 });
  let y = SOCKET_Y - DROP * (1 - sp);
  const inO = interpolate(frame, [T.clIn, T.clIn + 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // half-lift + hover, then re-seat
  const liftUp = interpolate(frame, [T.liftA, T.liftB], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const reseat = interpolate(frame, [T.reseatA, T.reseatB], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const lift = liftUp * reseat;
  const bob = lift > 0.4 ? Math.sin(frame / 8.5) * 3.5 * lift : 0;
  y -= 56 * lift + bob;
  // departure
  const out = interpolate(frame, [T.clOutA, T.clOutB], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  y -= 320 * out;
  const outO = interpolate(out, [0, 0.5], [1, 0], { extrapolateRight: "clamp" });
  return { y, opacity: inO * outO, gone: frame < T.clIn || out >= 1 };
}

/* ------------------------------------------------------------------ */
/* THE STACK (persistent element)                                      */
/* ------------------------------------------------------------------ */
const Stack: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bright = interpolate(frame, [T.brightAt, T.brightAt + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hot = interpolate(frame, [T.hotAt, T.hotAt + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const baseBlock = (label: string, top: number, inAt: number) => {
    if (frame < inAt) return null;
    const p = spring({ frame: frame - inAt, fps, config: { damping: 15, stiffness: 150 }, durationInFrames: 20 });
    return (
      <div key={label} style={{
        position: "absolute", left: SX, top: top + (1 - p) * 26, width: BW, height: BH,
        background: "rgba(15,18,26,0.93)", borderRadius: 10,
        border: `1px solid rgba(255,255,255,${0.16 + bright * 0.22})`,
        boxShadow: `0 10px 30px rgba(0,0,0,0.45)${bright > 0 ? `, 0 0 ${18 * bright}px rgba(207,255,5,${0.14 * bright})` : ""}`,
        opacity: p, display: "flex", alignItems: "center", paddingLeft: 26, boxSizing: "border-box",
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 26, letterSpacing: "0.2em",
          color: bright > 0.5 ? "#E9ECED" : SILVER,
        }}>{label}</span>
      </div>
    );
  };

  /* ---- socket (dashed outline) ---- */
  const socketP = interpolate(frame, [T.socketIn, T.socketIn + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const socket = frame >= T.socketIn && (
    <div style={{
      position: "absolute", left: SX - 8, top: SOCKET_Y - 8, width: BW + 16, height: BH + 16,
      borderRadius: 13, border: `2px dashed ${hot > 0.5 ? LIME : `rgba(233,236,237,${0.55 + hot * 0.4})`}`,
      opacity: socketP * (0.75 + hot * 0.25), boxSizing: "border-box",
      boxShadow: hot > 0 ? `0 0 ${16 * hot}px rgba(207,255,5,${0.22 * hot}), inset 0 0 ${12 * hot}px rgba(207,255,5,${0.10 * hot})` : "none",
      transform: `scale(${0.96 + 0.04 * socketP})`,
    }} />
  );

  /* ---- Lovable block ---- */
  const lovSp = spring({ frame: frame - T.lovIn, fps, config: { damping: 13, stiffness: 120 }, durationInFrames: 26 });
  const lovInO = interpolate(frame, [T.lovIn, T.lovIn + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lovOutP = interpolate(frame, [T.lovOut, T.lovOut + 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const lovY = SOCKET_Y - DROP * (1 - lovSp) - 300 * lovOutP;
  const lovX = SX + 34 * lovOutP;
  const lovO = lovInO * interpolate(lovOutP, [0, 0.5], [1, 0], { extrapolateRight: "clamp" });
  const dim = interpolate(frame, [T.dimA, T.dimB], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const strike = interpolate(frame, [T.strikeA, T.strikeB], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const tagP = frame < T.tagIn ? 0 : spring({ frame: frame - T.tagIn, fps, config: { damping: 14, stiffness: 160 }, durationInFrames: 18 });

  const lovable = frame >= T.lovIn && lovO > 0.01 && (
    <div style={{ position: "absolute", left: lovX, top: lovY, width: BW, height: BH, opacity: lovO }}>
      <div style={{
        width: "100%", height: "100%", background: "#F2F4F5", borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
        boxShadow: "0 12px 34px rgba(0,0,0,0.5)",
        filter: `grayscale(${dim}) brightness(${1 - 0.3 * dim})`,
        opacity: 1 - 0.42 * dim,
      }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: SILVER, display: "inline-block" }} />
        <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: RAISIN, letterSpacing: "-0.01em" }}>Lovable</span>
      </div>
      {/* price tag */}
      {frame >= T.tagIn && (
        <div style={{
          position: "absolute", left: BW - 44, top: -30, transform: `rotate(3.5deg) scale(${0.7 + 0.3 * tagP})`,
          transformOrigin: "left bottom", opacity: tagP,
        }}>
          <div style={{
            position: "relative", background: RAISIN, border: "1px solid rgba(255,255,255,0.22)",
            borderRadius: 7, padding: "8px 14px", boxShadow: "0 8px 22px rgba(0,0,0,0.5)",
            fontFamily: MONO, fontSize: 22, color: SILVER, whiteSpace: "nowrap",
          }}>
            1-year plan · €300
            <span style={{
              position: "absolute", left: "-2%", top: "50%", height: 2.5, width: `${strike * 104}%`,
              background: "#fff", borderRadius: 2, opacity: 0.92,
            }} />
          </div>
          <span style={{
            position: "absolute", left: -5, top: -5, width: 9, height: 9, borderRadius: 5,
            background: SILVER, boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
          }} />
        </div>
      )}
    </div>
  );

  /* ---- Claude block ---- */
  const cl = claudeState(frame, fps);
  const claude = !cl.gone && cl.opacity > 0.01 && (
    <div style={{
      position: "absolute", left: SX, top: cl.y, width: BW, height: BH, opacity: cl.opacity,
      background: "#F2F4F5", borderRadius: 10,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
      boxShadow: "0 12px 34px rgba(0,0,0,0.5)",
    }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: LIME, display: "inline-block" }} />
      <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: RAISIN, letterSpacing: "-0.01em" }}>Claude</span>
    </div>
  );

  /* ---- ghost block (the future tool) ---- */
  const ghSp = frame < T.ghIn ? 0 : spring({ frame: frame - T.ghIn, fps, config: { damping: 13, stiffness: 115 }, durationInFrames: 27 });
  const ghInO = interpolate(frame, [T.ghIn, T.ghIn + 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ghost = frame >= T.ghIn && (
    <div style={{
      position: "absolute", left: SX, top: SOCKET_Y - DROP * (1 - ghSp), width: BW, height: BH,
      borderRadius: 10, border: "2.5px dashed rgba(233,236,237,0.85)",
      background: "rgba(233,236,237,0.11)", opacity: ghInO * 0.95, boxSizing: "border-box",
      boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
    }} />
  );

  /* ---- context threads (the lime moment) ---- */
  const clBottom = cl.y + BH;
  const thrFade = interpolate(frame, [T.clOutA, T.clOutA + 21], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulse = interpolate(frame, [T.pulse, T.pulse + 7, T.pulse + 16], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const THREADS: { x: number; targetY: number; at: number }[] = [
    { x: SX + BW * 0.28, targetY: DATA_Y + BH / 2, at: T.thr[2] },
    { x: SX + BW * 0.5, targetY: ROUTINES_Y + BH / 2, at: T.thr[1] },
    { x: SX + BW * 0.72, targetY: SKILLS_Y + BH / 2, at: T.thr[0] },
  ];
  const threads = frame >= T.thr[0] && thrFade > 0.01 && !cl.gone && (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {THREADS.map((th, i) => {
        if (frame < th.at) return null;
        const d = interpolate(frame, [th.at, th.at + 15], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
        const y2 = clBottom + (th.targetY - clBottom) * d;
        const o = thrFade * (0.8 + 0.2 * pulse) * cl.opacity;
        return (
          <g key={i} opacity={o}>
            <line x1={th.x} y1={clBottom - 2} x2={th.x} y2={y2} stroke={LIME}
              strokeWidth={3 + pulse * 2.4} strokeLinecap="round" />
            {pulse > 0 && (
              <line x1={th.x} y1={clBottom - 2} x2={th.x} y2={y2} stroke={LIME}
                strokeWidth={9} strokeLinecap="round" opacity={0.22 * pulse} />
            )}
            {d >= 1 && <circle cx={th.x} cy={th.targetY} r={5 + pulse * 2.5} fill={LIME} />}
          </g>
        );
      })}
    </svg>
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {baseBlock("data", DATA_Y, T.baseIn[0])}
      {baseBlock("routines", ROUTINES_Y, T.baseIn[1])}
      {baseBlock("skills", SKILLS_Y, T.baseIn[2])}
      {socket}
      {threads}
      {ghost}
      {lovable}
      {claude}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Captions — lime karaoke, cardless                                   */
/* words.json corrected: whisper heard "love war" for "Lovable";       */
/* leading junk tokens dropped; trailing line carried by the closer.   */
/* ------------------------------------------------------------------ */
type W = { t: string; s: number; e: number };
const RAW: W[] = [
  { t: "SIX", s: 0.96, e: 1.34 }, { t: "MONTHS", s: 1.34, e: 1.62 }, { t: "AGO", s: 1.62, e: 1.9 },
  { t: "I", s: 1.9, e: 2.16 }, { t: "WAS", s: 2.16, e: 2.32 }, { t: "ALL IN", s: 2.32, e: 2.6 },
  { t: "LOVABLE", s: 2.6, e: 3.28 },
  { t: "BUT", s: 3.64, e: 3.86 }, { t: "NOW", s: 3.86, e: 4.18 }, { t: "I", s: 4.18, e: 4.58 },
  { t: "DON'T", s: 4.58, e: 4.74 }, { t: "EVEN", s: 4.74, e: 4.94 }, { t: "USE", s: 4.94, e: 5.3 },
  { t: "IT", s: 5.3, e: 5.42 }, { t: "ANYMORE.", s: 5.42, e: 5.68 },
  { t: "AND", s: 5.92, e: 6.08 }, { t: "TO", s: 6.08, e: 6.44 }, { t: "BE", s: 6.44, e: 6.58 },
  { t: "COMPLETELY", s: 6.58, e: 7.02 }, { t: "HONEST,", s: 7.02, e: 7.34 },
  { t: "I", s: 7.78, e: 7.92 }, { t: "TOLD", s: 7.92, e: 8.14 }, { t: "A", s: 8.14, e: 8.28 },
  { t: "LOT", s: 8.28, e: 8.4 }, { t: "OF", s: 8.4, e: 8.5 }, { t: "PEOPLE", s: 8.5, e: 8.74 },
  { t: "THAT", s: 8.74, e: 9.02 }, { t: "I", s: 9.02, e: 9.4 }, { t: "WAS", s: 9.4, e: 9.54 },
  { t: "GOING", s: 9.54, e: 9.68 }, { t: "TO", s: 9.68, e: 9.76 }, { t: "USE", s: 9.76, e: 9.92 },
  { t: "LOVABLE", s: 9.92, e: 10.36 }, { t: "FOR", s: 10.36, e: 10.56 }, { t: "A", s: 10.56, e: 10.74 },
  { t: "VERY", s: 10.74, e: 10.9 }, { t: "LONG", s: 10.9, e: 11.12 }, { t: "TIME.", s: 11.12, e: 11.4 },
  { t: "I", s: 11.62, e: 11.68 }, { t: "ALMOST", s: 11.68, e: 12.86 }, { t: "TOOK", s: 12.86, e: 13.16 },
  { t: "THE", s: 13.16, e: 13.38 }, { t: "ONE", s: 13.38, e: 13.64 }, { t: "YEAR", s: 13.64, e: 13.8 },
  { t: "PLAN.", s: 13.8, e: 14.18 },
  { t: "BUT", s: 15.66, e: 15.74 }, { t: "CLAUDE", s: 15.74, e: 16.12 }, { t: "CAME", s: 16.12, e: 16.32 },
  { t: "AND", s: 16.32, e: 16.74 }, { t: "CLAUDE", s: 16.74, e: 17.06 }, { t: "IS", s: 17.06, e: 17.16 },
  { t: "JUST", s: 17.16, e: 17.48 }, { t: "SO", s: 17.48, e: 18.56 }, { t: "MUCH", s: 18.56, e: 18.74 },
  { t: "BETTER", s: 18.74, e: 19.02 }, { t: "THAN", s: 19.02, e: 19.26 }, { t: "ME.", s: 19.26, e: 19.4 },
  { t: "AND", s: 19.94, e: 20.2 }, { t: "THE", s: 20.2, e: 20.46 }, { t: "WHOLE", s: 20.46, e: 20.76 },
  { t: "CONTEXT", s: 20.76, e: 21.32 }, { t: "IT", s: 21.32, e: 21.62 }, { t: "HAS", s: 21.62, e: 21.84 },
  { t: "ABOUT", s: 21.84, e: 22.14 }, { t: "ME", s: 22.14, e: 22.36 }, { t: "HAS", s: 22.36, e: 23.68 },
  { t: "REALLY", s: 23.68, e: 24.08 }, { t: "BEEN", s: 24.08, e: 24.3 }, { t: "A", s: 24.3, e: 24.44 },
  { t: "GAME", s: 24.44, e: 24.62 }, { t: "CHANGER.", s: 24.62, e: 24.96 },
  { t: "SO,", s: 24.96, e: 25.38 }, { t: "THE", s: 25.48, e: 25.56 }, { t: "LESSON", s: 25.56, e: 25.88 },
  { t: "THAT", s: 25.88, e: 26.06 }, { t: "I", s: 26.06, e: 26.18 }, { t: "GOT", s: 26.18, e: 26.32 },
  { t: "HERE", s: 26.32, e: 26.56 }, { t: "IS", s: 26.56, e: 26.88 },
  { t: "NEVER", s: 26.88, e: 27.2 }, { t: "PUT", s: 27.2, e: 27.5 }, { t: "ALL", s: 27.5, e: 27.76 },
  { t: "OF", s: 27.76, e: 27.86 }, { t: "YOUR", s: 27.86, e: 27.96 }, { t: "MONEY", s: 27.96, e: 28.22 },
  { t: "ON", s: 28.22, e: 28.72 }, { t: "ONE", s: 28.72, e: 28.96 }, { t: "TOOL.", s: 28.96, e: 29.28 },
  { t: "EVEN", s: 30.04, e: 30.52 }, { t: "NOT", s: 30.52, e: 30.74 }, { t: "WITH", s: 30.74, e: 30.92 },
  { t: "CLAUDE.", s: 30.92, e: 31.34 },
  { t: "GET", s: 31.98, e: 32.24 }, { t: "A", s: 32.24, e: 32.4 }, { t: "STACK", s: 32.4, e: 32.74 },
  { t: "WHERE", s: 32.74, e: 33.94 }, { t: "WHEN", s: 33.94, e: 34.36 }, { t: "ANYTHING", s: 34.36, e: 34.74 },
  { t: "HAPPENS", s: 34.74, e: 35.12 }, { t: "IN", s: 35.12, e: 35.32 }, { t: "THE", s: 35.32, e: 35.42 },
  { t: "FUTURE", s: 35.42, e: 35.66 }, { t: "AND", s: 35.66, e: 35.98 }, { t: "WE", s: 35.98, e: 36.26 },
  { t: "HAVE", s: 36.26, e: 36.38 }, { t: "NO", s: 36.38, e: 36.58 }, { t: "IDEA", s: 36.58, e: 36.86 },
  { t: "WHAT", s: 36.86, e: 37.04 }, { t: "THAT", s: 37.04, e: 37.18 }, { t: "HAPPENS,", s: 37.18, e: 37.56 },
  { t: "BUT", s: 37.96, e: 38.12 }, { t: "WHENEVER", s: 38.12, e: 38.42 }, { t: "SOMETHING", s: 38.42, e: 38.9 },
  { t: "LIKE", s: 38.9, e: 39.14 }, { t: "THAT", s: 39.14, e: 39.28 }, { t: "HAPPENS,", s: 39.28, e: 39.66 },
  { t: "YOU", s: 39.88, e: 40.16 }, { t: "CAN", s: 40.16, e: 40.3 }, { t: "JUST", s: 40.3, e: 40.48 },
  { t: "SWITCH", s: 40.48, e: 40.88 },
  { t: "WITHOUT", s: 42.15, e: 42.7 }, { t: "BEING", s: 42.7, e: 43.0 }, { t: "STUCK", s: 43.0, e: 43.32 },
  { t: "IN", s: 43.32, e: 43.54 }, { t: "ONE", s: 43.54, e: 43.84 }, { t: "SOFTWARE", s: 43.84, e: 44.4 },
];

type Group = { words: W[]; s: number; e: number };
const GROUPS: Group[] = (() => {
  const gs: Group[] = [];
  let cur: W[] = [];
  for (let i = 0; i < RAW.length; i++) {
    const w = RAW[i];
    cur.push(w);
    const next = RAW[i + 1];
    const punct = /[.,!?]$/.test(w.t);
    if (cur.length >= 3 || !next || punct || next.s - w.e > 0.55) {
      gs.push({ words: cur, s: cur[0].s, e: cur[cur.length - 1].e });
      cur = [];
    }
  }
  return gs;
})();

const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  let g: Group | null = null;
  for (let i = 0; i < GROUPS.length; i++) {
    const cand = GROUPS[i];
    const next = GROUPS[i + 1];
    const end = Math.min(next ? next.s : cand.e + 0.8, cand.e + 0.8);
    if (t >= cand.s - 0.06 && t < end) { g = cand; break; }
  }
  if (!g) return null;
  const pop = interpolate(frame, [f(g.s) - 2, f(g.s) + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{
      position: "absolute", left: 40, right: 40, top: 1920 * 0.54,
      display: "flex", justifyContent: "center", gap: 20, pointerEvents: "none",
      opacity: pop, transform: `translateY(${(1 - pop) * 10}px)`,
    }}>
      {g.words.map((w, i) => {
        const active = t >= w.s && t < w.e;
        return (
          <span key={i} style={{
            fontFamily: SANS, fontWeight: 800, fontSize: 58, letterSpacing: "0.01em",
            color: active ? LIME : "#fff",
            transform: active ? "scale(1.06)" : "scale(1)",
            display: "inline-block", whiteSpace: "nowrap",
            textShadow: "0 3px 14px rgba(0,0,0,0.92), 0 10px 44px rgba(0,0,0,0.75)",
          }}>{w.t}</span>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Playfair asides                                                     */
/* ------------------------------------------------------------------ */
const Asides: React.FC = () => {
  const frame = useCurrentFrame();
  const asideO =
    interpolate(frame, [T.asideA, T.asideA + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) *
    interpolate(frame, [T.asideB - 8, T.asideB], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const closerP = interpolate(frame, [T.closerAt, T.closerAt + 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {asideO > 0 && (
        <div style={{
          position: "absolute", left: SX + BW + 30, top: SOCKET_Y - 44,
          fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: 40,
          color: "#E9ECED", opacity: asideO, transform: `translateY(${(1 - asideO) * 8}px)`,
          textShadow: "0 3px 18px rgba(0,0,0,0.8)", whiteSpace: "nowrap",
        }}>even this one.</div>
      )}
      {frame >= T.closerAt && (
        <div style={{
          position: "absolute", left: 0, right: 0, top: 1920 * 0.545, textAlign: "center",
          fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: 62,
          color: "#fff", opacity: closerP, transform: `translateY(${(1 - closerP) * 12}px)`,
          textShadow: "0 4px 22px rgba(0,0,0,0.85)",
        }}>
          the stack is <span style={{ color: LIME }}>yours.</span>
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */
export const LeftLovableShort: React.FC = () => {
  const frame = useCurrentFrame();
  const c = cam(frame);
  const driftX = Math.sin(frame / 43) * 3 + Math.sin(frame / 17) * 0.8;
  const driftY = Math.cos(frame / 53) * 3;
  const openO = interpolate(frame, [0, 16], [0.55, 0], { extrapolateRight: "clamp" });
  const fadeO = interpolate(frame, [1392, 1403], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      <AbsoluteFill style={{
        transform: `translate(${c.x + driftX}px, ${c.y + driftY}px) scale(${c.s})`,
        filter: "contrast(1.05) saturate(1.06)",
      }}>
        <OffthreadVideo
          src={staticFile("shorts/left-lovable/source.mp4")}
          volume={(fr) => interpolate(fr, [1384, 1402], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>

      {/* gentle bottom scrim so the stack reads over the desk */}
      <AbsoluteFill style={{
        pointerEvents: "none",
        background: "linear-gradient(transparent 58%, rgba(8,10,16,0.34) 78%, rgba(8,10,16,0.5) 100%)",
      }} />

      <Stack />
      <Captions />
      <Asides />

      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 80% 68% at 50% 40%, transparent 58%, rgba(6,8,14,0.4) 100%)" }} />
      <AbsoluteFill style={{
        pointerEvents: "none", opacity: 0.045, mixBlendMode: "overlay",
        backgroundImage: `url("${GRAIN_URI}")`, backgroundSize: "132px",
        transform: `translate(${(frame % 3) * 3}px, ${(frame % 2) * -3}px)`,
      }} />

      {/* opening settle + final fade */}
      <AbsoluteFill style={{ background: RAISIN, opacity: openO, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "#000", opacity: fadeO, pointerEvents: "none" }} />

      {/* SFX — landings only, sparse (9 moments) */}
      <Sfx src="tick_soft.wav" at={22} volume={0.24} />
      <Sfx src="tick_soft.wav" at={52} volume={0.26} />
      <Sfx src="tick.wav" at={88} volume={0.38} />
      <Sfx src="tick_soft.wav" at={400} volume={0.26} />
      <Sfx src="slide.wav" at={470} volume={0.26} />
      <Sfx src="tick.wav" at={516} volume={0.48} />
      <Sfx src="soft.wav" at={T.pulse} volume={0.28} />
      <Sfx src="tick_soft.wav" at={974} volume={0.24} />
      <Sfx src="tick_soft.wav" at={1218} volume={0.3} />
    </AbsoluteFill>
  );
};

export default LeftLovableShort;

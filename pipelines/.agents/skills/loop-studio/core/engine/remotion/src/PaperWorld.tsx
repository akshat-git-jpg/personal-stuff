/**
 * PaperWorld — the NEW look: a hand-drawn PAPER world. Editorial, back-to-school, but premium.
 * Ink drawn live on warm paper, highlighter, handwriting, marginalia. Concept: a business is a
 * living stream a dead file can't hold. This sets the visual language for the whole notebook world.
 * Clean editorial composition: clear headline zone (top), the file (left), events flow (right band).
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { CAVEAT, KALAM, FRAUNCES, HMONO } from "./bb/fonts";

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const PAPER = "#EFE7D3";
const INK = "#2B2926";
const PENCIL = "#8A806C";
const RED = "#C0392B";
const LIME = "#CFFF05";
const EASE = Easing.bezier(0.4, 0, 0.15, 1);

const PAPERTEX = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='p'><feTurbulence type='fractalNoise' baseFrequency='0.012 0.02' numOctaves='3' seed='7'/><feColorMatrix type='saturate' values='0'/></filter><rect width='300' height='300' filter='url(#p)' opacity='0.5'/></svg>`);
const GRAIN = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(#g)' opacity='0.5'/></svg>`);

const Draw: React.FC<{ d: string; at: number; dur: number; w: number; color?: string; len?: number }> = ({ d, at, dur, w, color = INK, len = 2600 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.6, 0, 0.35, 1) });
  return <path d={d} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} />;
};

export const PaperWorld: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  const t = frame / FPS;
  const drift = { x: Math.sin(frame / 80) * u * 0.14, y: Math.cos(frame / 100) * u * 0.1, s: 1.008 + interpolate(frame, [0, f(10)], [0, 0.016], { extrapolateRight: "clamp" }) };
  const open = interpolate(frame, [0, f(0.6)], [1, 0], { extrapolateRight: "clamp" });
  const fade = (a: number, b: number) => interpolate(frame, [f(a), f(b)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const headWrite = interpolate(frame, [f(0.3), f(1.5)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.linear });
  const markP = interpolate(frame, [f(1.2), f(1.7)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });

  const NOTES = [
    { txt: "new order #4471", at: 2.5, x: 0.50, y: 0.40, rot: -3, money: true },
    { txt: "payout €3,900", at: 3.1, x: 0.80, y: 0.37, rot: 3, money: true },
    { txt: "DM · “still there?”", at: 3.7, x: 0.55, y: 0.58, rot: -2 },
    { txt: "€1,240 paid", at: 4.3, x: 0.83, y: 0.56, rot: 2.5, money: true },
    { txt: "+3 subscribers", at: 5.0, x: 0.61, y: 0.76, rot: -1.5 },
    { txt: "5★ review", at: 5.6, x: 0.87, y: 0.75, rot: 2 },
  ];
  const tally = Math.floor(interpolate(t, [2, 9], [12480, 36980], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <AbsoluteFill style={{ backgroundImage: `url("${PAPERTEX}")`, backgroundSize: `${u * 34}px`, mixBlendMode: "multiply", opacity: 0.42 }} />
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(circle, rgba(70,58,34,0.08) 1.4px, transparent 1.6px)`, backgroundSize: `${u * 3.2}px ${u * 3.2}px`, opacity: 0.6 }} />
      <AbsoluteFill style={{ backgroundImage: `url("${GRAIN}")`, backgroundSize: `${u * 9}px`, mixBlendMode: "multiply", opacity: 0.05 }} />

      <AbsoluteFill style={{ transform: `translate(${drift.x}px,${drift.y}px) scale(${drift.s})` }}>
        {/* marginalia */}
        <div style={{ position: "absolute", left: "5%", top: "7%", fontFamily: HMONO, fontSize: u * 1.15, letterSpacing: "0.24em", color: PENCIL }}>FIG.&nbsp;1 — YOUR&nbsp;BUSINESS</div>

        {/* running tally */}
        <div style={{ position: "absolute", right: "6%", top: "9%", textAlign: "right", opacity: fade(1.8, 2.4) }}>
          <div style={{ fontFamily: HMONO, fontSize: u * 1.05, letterSpacing: "0.2em", color: PENCIL }}>TODAY</div>
          <div style={{ fontFamily: CAVEAT, fontWeight: 700, fontSize: u * 5, color: INK }}>€{tally.toLocaleString()}</div>
        </div>

        {/* HEADLINE — clear top zone, inline highlighter + underline */}
        <div style={{ position: "absolute", left: "6%", top: "15%", fontFamily: CAVEAT, fontWeight: 700, fontSize: u * 7.6, color: INK, lineHeight: 1, opacity: fade(0.3, 0.9), clipPath: `inset(0 ${(1 - headWrite) * 100}% -20% 0)` }}>
          your business{" "}
          <span style={{ position: "relative", display: "inline-block" }}>
            <span style={{ position: "absolute", left: -u * 0.4, right: -u * 0.4, top: "24%", bottom: "10%", background: LIME, opacity: 0.5, mixBlendMode: "multiply", borderRadius: u * 0.3, transform: `scaleX(${markP}) rotate(-1.2deg)`, transformOrigin: "left center" }} />
            <span style={{ position: "relative" }}>never stops.</span>
            <svg width="100%" height={u * 2} viewBox="0 0 200 12" preserveAspectRatio="none" style={{ position: "absolute", left: 0, bottom: -u * 1.4, overflow: "visible" }}>
              <Draw d="M2 8 Q 50 2, 100 7 T 198 5" at={f(1.55)} dur={f(0.5)} w={2.2} len={220} />
            </svg>
          </span>
        </div>

        {/* the ink STREAM river running left→right through the file */}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <Draw d={`M ${u * 6} ${u * 30} C ${u * 30} ${u * 26}, ${u * 60} ${u * 36}, ${u * 96} ${u * 29}`} at={f(2.0)} dur={f(1.6)} w={u * 0.42} color={PENCIL} len={u * 100} />
          {[24, 42, 62, 82].map((x, i) => <Draw key={x} d={`M ${u * x} ${u * (29 - Math.sin(i) * 1.6)} l ${u * 1.4} ${-u * 1.0}`} at={f(2.6 + i * 0.18)} dur={f(0.2)} w={u * 0.28} color={PENCIL} len={u * 3} />)}
        </svg>

        {/* the DEAD FILE — center-left, drawn, on the stream */}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <g transform={`translate(${u * 9} ${u * 20})`}>
            <Draw d={`M 0 6 q 0 -6 6 -6 l ${u * 11} 0 l ${u * 4} ${u * 4} l 0 ${u * 15} q 0 6 -6 6 l ${-u * 13} 0 q -6 0 -6 -6 z`} at={f(2.2)} dur={f(1.0)} w={u * 0.42} len={u * 60} />
            <Draw d={`M ${u * 15} 2 l 0 ${u * 4} l ${u * 4} 0`} at={f(2.6)} dur={f(0.3)} w={u * 0.42} len={u * 10} />
            {[0, 1, 2, 3].map((i) => <Draw key={i} d={`M ${u * 2.5} ${u * (5 + i * 3)} l ${u * (i % 2 ? 8 : 11)} 0`} at={f(3.0 + i * 0.12)} dur={f(0.2)} w={u * 0.28} color={PENCIL} len={u * 12} />)}
          </g>
        </svg>
        <div style={{ position: "absolute", left: "9%", top: `${(20 - 3.4) / 56.25 * 100}%`, fontFamily: KALAM, fontSize: u * 1.9, color: PENCIL, opacity: fade(3.2, 3.8) }}>business.md</div>

        {/* flowing event NOTES — clean right band */}
        {NOTES.map((n, i) => {
          const inP = interpolate(frame, [f(n.at), f(n.at + 0.4)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
          if (inP <= 0) return null;
          const fl = Math.sin((frame / 42) + i) * u * 0.5;
          return (
            <div key={i} style={{ position: "absolute", left: `${n.x * 100}%`, top: `calc(${n.y * 100}% + ${fl}px)`, transform: `translate(-50%,-50%) rotate(${n.rot}deg) scale(${0.92 + 0.08 * inP})`, opacity: inP }}>
              <div style={{ fontFamily: KALAM, fontSize: u * 2.0, color: INK, background: "rgba(255,252,244,0.72)", border: `${u * 0.12}px solid ${INK}`, borderRadius: u * 0.6, padding: `${u * 0.5}px ${u * 1.2}px`, boxShadow: `${u * 0.3}px ${u * 0.5}px 0 rgba(43,41,38,0.13)`, whiteSpace: "nowrap" }}>
                {n.money && <span style={{ display: "inline-block", width: u * 0.7, height: u * 0.7, borderRadius: "50%", background: LIME, marginRight: u * 0.6, verticalAlign: "middle" }} />}
                {n.txt}
              </div>
            </div>
          );
        })}

        {/* the file can't keep up — red pen circle + note */}
        {frame >= f(6.2) && (
          <>
            <svg width={W} height={H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <Draw d={`M ${u * 7} ${u * 21} C ${u * 5.5} ${u * 34}, ${u * 27} ${u * 37}, ${u * 27} ${u * 24} C ${u * 27} ${u * 19.5}, ${u * 13} ${u * 19}, ${u * 7} ${u * 22.5}`} at={f(6.2)} dur={f(0.7)} w={u * 0.42} color={RED} len={u * 70} />
            </svg>
            <div style={{ position: "absolute", left: "5%", top: `${(40) / 56.25 * 100}%`, fontFamily: CAVEAT, fontWeight: 700, fontSize: u * 3.2, color: RED, transform: "rotate(-4deg)", opacity: fade(6.7, 7.2) }}>can’t keep up!</div>
          </>
        )}

        {/* editorial serif counterpoint — clear bottom */}
        {frame >= f(8.0) && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: "7%", textAlign: "center", opacity: fade(8.0, 8.6) }}>
            <span style={{ fontFamily: FRAUNCES, fontStyle: "italic", fontSize: u * 2.5, color: INK }}>a file only holds a moment — a business is all of them.</span>
          </div>
        )}
      </AbsoluteFill>

      <AbsoluteFill style={{ pointerEvents: "none", boxShadow: `inset 0 0 ${u * 14}px rgba(60,48,28,0.26)` }} />
      <AbsoluteFill style={{ background: PAPER, opacity: open, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default PaperWorld;

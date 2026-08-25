/**
 * BusinessAlive — hero proof of the CORRECTED direction: full-creativity, cinematic concept
 * visualization (NOT text slides, NOT colour-coded sections). One cohesive dark filmic world.
 * The concept: a real business is ALIVE — a constant stream of orders, payments, messages, numbers
 * moving in depth — and a dead markdown file sitting in the middle catches none of it, then freezes.
 * Grammar carries from the intro: raisin void, lime only on the living/money things, grade + grain
 * + vignette + 2.39 letterbox, settle-camera with parallax depth.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const RAISIN = "#0C0F16";
const RAISIN2 = "#141A26";
const LIME = "#CFFF05";
const SILVER = "#AEB7BC";
const STEEL = "#5A6470";
const SANS = "'Space Grotesk','Helvetica Neue',sans-serif";
const MONO = "'JetBrains Mono','SF Mono',Menlo,monospace";
const SERIF = "'Playfair Display',Georgia,serif";
const EASE = Easing.bezier(0.4, 0, 0.15, 1);
const BARH = 0.11;

type Chip = { t: string; lane: number; depth: number; spd: number; off: number; money?: boolean };
const CHIPS: Chip[] = [
  { t: "NEW ORDER  #4471", lane: 0.20, depth: 0.95, spd: 10, off: 0.05, money: true },
  { t: "DM · “still available?”", lane: 0.32, depth: 0.55, spd: 7, off: 0.55 },
  { t: "€1,240 paid", lane: 0.71, depth: 1.0, spd: 11, off: 0.2, money: true },
  { t: "+3 subscribers", lane: 0.14, depth: 0.4, spd: 6, off: 0.8 },
  { t: "Invoice #88 sent", lane: 0.80, depth: 0.6, spd: 8, off: 0.68 },
  { t: "Refund requested", lane: 0.86, depth: 0.85, spd: 9.5, off: 0.35 },
  { t: "Call booked", lane: 0.26, depth: 0.75, spd: 8.5, off: 0.9, money: true },
  { t: "5★ review", lane: 0.66, depth: 0.45, spd: 6.5, off: 0.05 },
  { t: "Cart abandoned", lane: 0.78, depth: 0.35, spd: 5.5, off: 0.45 },
  { t: "New signup", lane: 0.11, depth: 0.9, spd: 10.5, off: 0.3 },
  { t: "Support ticket", lane: 0.36, depth: 0.3, spd: 5, off: 0.15 },
  { t: "Payout  €3,900", lane: 0.60, depth: 0.98, spd: 11.5, off: 0.62, money: true },
  { t: "Reply sent", lane: 0.24, depth: 0.5, spd: 7.2, off: 0.42 },
  { t: "Content published", lane: 0.84, depth: 0.5, spd: 7, off: 0.12 },
  { t: "Meeting · 3pm", lane: 0.16, depth: 0.65, spd: 8, off: 0.5 },
  { t: "€680 paid", lane: 0.73, depth: 0.7, spd: 9, off: 0.95, money: true },
];

export const BusinessAlive: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  const t = frame / FPS;

  const cam = 1.02 + interpolate(frame, [0, f(9)], [0, 0.06], { extrapolateRight: "clamp", easing: Easing.linear });
  const dx = Math.sin(frame / 90) * 0.12, dy = Math.cos(frame / 120) * 0.1;
  const open = interpolate(frame, [0, f(0.7)], [1, 0], { extrapolateRight: "clamp" });

  // the file freezes ~5.4s
  const freeze = interpolate(frame, [f(5.2), f(6.4)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const streamDim = 1 - 0.35 * freeze;

  // live revenue counter woven into the stream
  const rev = Math.floor(interpolate(frame, [0, f(9)], [18420, 41960], { extrapolateRight: "clamp" }));

  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      <AbsoluteFill style={{ transform: `translate(${dx * u}px,${dy * u}px) scale(${cam})` }}>
        {/* void gradient */}
        <AbsoluteFill style={{ background: "radial-gradient(ellipse 70% 60% at 50% 46%, #182234 0%, #0a0d14 74%)" }} />
        {/* faint depth grid */}
        <AbsoluteFill style={{ backgroundImage: `linear-gradient(rgba(174,183,188,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(174,183,188,0.045) 1px,transparent 1px)`, backgroundSize: `${u * 5}px ${u * 5}px`, maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%,#000 30%,transparent 78%)", WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%,#000 30%,transparent 78%)" }} />

        {/* THE STREAM — living business events flowing in depth */}
        {CHIPS.map((c, i) => {
          const span = W * 1.5;
          const x = ((t * c.spd * (0.35 + c.depth) * u * 1.4 + c.off * span) % span) - W * 0.25;
          const sc = 0.42 + c.depth * 0.95;
          const blur = (1 - c.depth) * u * 0.32;
          const op = (0.18 + c.depth * 0.62) * streamDim;
          const near = c.depth > 0.8;
          return (
            <div key={i} style={{
              position: "absolute", left: x, top: `${c.lane * 100}%`,
              transform: `scale(${sc})`, transformOrigin: "left center", filter: `blur(${blur}px)`, opacity: op,
              display: "flex", alignItems: "center", gap: u * 0.7,
              background: near ? "rgba(20,26,38,0.82)" : "rgba(18,22,32,0.5)",
              border: `1px solid ${c.money ? "rgba(207,255,5,0.4)" : "rgba(174,183,188,0.18)"}`,
              borderRadius: u * 0.7, padding: `${u * 0.7}px ${u * 1.2}px`, whiteSpace: "nowrap",
              boxShadow: near ? `0 ${u * 0.8}px ${u * 2}px rgba(0,0,0,0.5)` : "none",
            }}>
              {c.money && <div style={{ width: u * 0.55, height: u * 0.55, borderRadius: "50%", background: LIME, boxShadow: `0 0 ${u * 0.5}px ${LIME}` }} />}
              <span style={{ fontFamily: MONO, fontSize: u * 1.35, color: c.money ? LIME : "#DCE2E4", letterSpacing: "0.02em" }}>{c.t}</span>
            </div>
          );
        })}

        {/* THE DEAD FILE — static in the middle, catches nothing, then freezes */}
        <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
          <div style={{ position: "relative", width: u * 20, height: u * 26 }}>
            {/* filename tab */}
            <div style={{ position: "absolute", top: -u * 2.6, left: 0, fontFamily: MONO, fontSize: u * 1.2, color: STEEL, letterSpacing: "0.1em" }}>business.md</div>
            {/* doc */}
            <div style={{
              position: "absolute", inset: 0, borderRadius: u * 0.8,
              background: "linear-gradient(160deg,#1A2130,#0E131C)", border: `1px solid ${STEEL}`,
              boxShadow: `0 ${u * 1.4}px ${u * 4}px rgba(0,0,0,0.6)`, filter: `grayscale(${freeze * 0.6}) brightness(${1 - freeze * 0.15})`, overflow: "hidden",
            }}>
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} style={{ position: "absolute", left: u * 1.6, top: u * (2 + i * 2.5), width: u * (i % 3 === 0 ? 9 : 15), height: u * 0.5, borderRadius: u * 0.2, background: STEEL, opacity: 0.4 }} />
              ))}
            </div>
            {/* frost / ice overlay */}
            {freeze > 0.02 && (
              <div style={{ position: "absolute", inset: 0, borderRadius: u * 0.8, opacity: freeze, background: "linear-gradient(150deg, rgba(190,220,235,0.22), rgba(140,180,210,0.06) 60%)", mixBlendMode: "screen" }}>
                <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
                  <path d="M 20 10 L 60 90 M 60 90 L 120 40 M 60 90 L 40 200" stroke="rgba(210,235,245,0.5)" strokeWidth={u * 0.12} fill="none" />
                </svg>
              </div>
            )}
            {freeze > 0.5 && <div style={{ position: "absolute", top: u * 27, left: 0, right: 0, textAlign: "center", fontFamily: MONO, fontSize: u * 1.15, letterSpacing: "0.24em", color: "#9DC3D6", opacity: (freeze - 0.5) * 2 }}>FROZEN</div>}
          </div>
        </div>

        {/* one live counter, top-left — the pulse */}
        <div style={{ position: "absolute", left: u * 5, top: `${BARH * 100 + 4}%`, opacity: 0.9 }}>
          <div style={{ fontFamily: MONO, fontSize: u * 1.05, letterSpacing: "0.28em", color: STEEL, marginBottom: u * 0.5 }}>REVENUE · TODAY</div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 3.4, color: LIME, letterSpacing: "-0.01em" }}>€{rev.toLocaleString()}</div>
        </div>

        {/* minimal closing line — the visual already made the point */}
        {frame >= f(6.6) && (() => {
          const p = interpolate(frame, [f(6.6), f(7.2)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
          return (
            <div style={{ position: "absolute", left: 0, right: 0, top: `${(1 - BARH) * 100 - 12}%`, textAlign: "center", opacity: p, transform: `translateY(${(1 - p) * u}px)` }}>
              <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 3.0, color: "#E7ECEE" }}>a business doesn’t fit in a file.</span>
            </div>
          );
        })()}
      </AbsoluteFill>

      {/* cinematic finish */}
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 82% 76% at 50% 48%, transparent 46%, rgba(0,0,0,0.66) 100%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: `${BARH * 100}%`, background: "#000" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${BARH * 100}%`, background: "#000" }} />
      <AbsoluteFill style={{ background: "#000", opacity: open, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default BusinessAlive;

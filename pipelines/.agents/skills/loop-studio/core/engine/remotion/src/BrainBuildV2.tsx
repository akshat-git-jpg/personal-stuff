/**
 * BrainBuildV2 — the "Business Brain" machine explained in the DIGESTIBLE 5-Ways language.
 * Reference standard (Luuk's "5 Ways to Make Money with AI"): solid section-colored background,
 * ONE idea per screen with huge negative space, simple line-icons + editorial type + a single lime
 * accent, speaker inset top-right in a lime-bordered card. Calm, premium, one thing at a time —
 * the opposite of a busy diagram. Here the machine is built ONE PIECE AT A TIME, then assembled
 * into one clean linear row: "a business brain."
 */
import React from "react";
import {
  AbsoluteFill, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig, staticFile, Easing,
} from "remotion";

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const INK = "#EAF0F1";
const SILVER = "#9AA6AC";
const LINE = "#D6DBDD";
const LIME = "#CFFF05";
const SANS = "'Space Grotesk','Helvetica Neue',sans-serif";
const MONO = "'JetBrains Mono','SF Mono',Menlo,monospace";
const SERIF = "'Playfair Display',Georgia,serif";
const EASE = Easing.bezier(0.4, 0, 0.15, 1);

const STAGES = [
  { id: "db", label: "ONE DATABASE", sub: "the core", at: 0.6, out: 3.6 },
  { id: "loops", label: "SMALL LOOPS", sub: "they fill it, automatically", at: 3.6, out: 6.6 },
  { id: "files", label: "SKILL FILES", sub: "the recipes, on top", at: 6.6, out: 9.4 },
  { id: "dash", label: "ONE DASHBOARD", sub: "the whole business, one screen", at: 9.4, out: 12.0 },
  { id: "model", label: "THE MODEL", sub: "comes last — least important", at: 12.0, out: 14.4 },
];
const ASSEMBLE = 14.4;
const END = 18;

export const BrainBuildV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  const openFade = interpolate(frame, [0, f(0.6)], [1, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily: SANS, background: "radial-gradient(ellipse 72% 64% at 40% 42%, #18293f 0%, #0e1a2c 68%)" }}>
      {/* section eyebrow (the color + this tag carry the structure) */}
      <div style={{ position: "absolute", left: u * 5, top: u * 6, display: "flex", alignItems: "center", gap: u * 0.8, opacity: interpolate(frame, [f(0.3), f(1)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        <div style={{ width: u * 2.2, height: u * 0.28, background: LIME }} />
        <span style={{ fontFamily: MONO, fontSize: u * 1.15, letterSpacing: "0.3em", color: SILVER }}>HOW&nbsp;IT'S&nbsp;BUILT</span>
      </div>

      {/* one featured piece at a time */}
      {STAGES.map((s) => <Featured key={s.id} s={s} u={u} W={W} H={H} frame={frame} />)}

      {/* assembled payoff — one clean linear row */}
      <Assembled u={u} W={W} H={H} frame={frame} />

      {/* speaker inset, top-right, lime-bordered */}
      <div style={{ position: "absolute", right: u * 4, top: u * 4.5, width: u * 24, aspectRatio: "16/9", borderRadius: u * 1.1, overflow: "hidden", border: `${u * 0.28}px solid ${LIME}`, boxShadow: `0 ${u}px ${u * 2.6}px rgba(0,0,0,0.5), 0 0 ${u * 1.4}px rgba(207,255,5,0.25)` }}>
        <OffthreadVideo src={staticFile("intros/businessbrain/speaker_inset.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 90% 85% at 42% 48%, transparent 55%, rgba(0,0,0,0.5) 100%)" }} />
      <AbsoluteFill style={{ background: "#0e1a2c", opacity: openFade, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

const Featured: React.FC<{ s: typeof STAGES[number]; u: number; W: number; H: number; frame: number }> = ({ s, u, W, H, frame }) => {
  const inn = interpolate(frame, [f(s.at), f(s.at + 0.5)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const out = interpolate(frame, [f(s.out - 0.4), f(s.out)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = Math.min(inn, out);
  if (op <= 0) return null;
  const cx = W * 0.34, cy = H * 0.5;
  return (
    <div style={{ position: "absolute", left: cx, top: cy, transform: `translate(-50%,-50%) translateY(${(1 - inn) * u * 1.0}px)`, opacity: op, textAlign: "center" }}>
      <div style={{ height: u * 20, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon id={s.id} u={u} frame={frame} p={inn} /></div>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 2.9, letterSpacing: "0.02em", color: INK, marginTop: u * 1.4 }}>{s.label}</div>
      <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 1.7, color: LIME, opacity: 0.9, marginTop: u * 0.5 }}>{s.sub}</div>
    </div>
  );
};

const Assembled: React.FC<{ u: number; W: number; H: number; frame: number }> = ({ u, W, H, frame }) => {
  if (frame < f(ASSEMBLE) - 4) return null;
  const t = interpolate(frame, [f(ASSEMBLE), f(ASSEMBLE + 1.1)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const ids = ["db", "loops", "files", "dash", "model"];
  const labels = ["DATABASE", "LOOPS", "FILES", "DASHBOARD", "MODEL"];
  const n = ids.length;
  const rowY = H * 0.46, gap = W * 0.155, x0 = W * 0.5 - gap * (n - 1) / 2;
  const head = interpolate(frame, [f(ASSEMBLE + 0.9), f(ASSEMBLE + 1.4)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  return (
    <AbsoluteFill style={{ opacity: t }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {ids.slice(0, -1).map((_, i) => {
          const x1 = x0 + gap * i + u * 3.4, x2 = x0 + gap * (i + 1) - u * 3.4;
          const dp = interpolate(frame, [f(ASSEMBLE + 0.3 + i * 0.12), f(ASSEMBLE + 0.6 + i * 0.12)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
          return <line key={i} x1={x1} y1={rowY} x2={x1 + (x2 - x1) * dp} y2={rowY} stroke={SILVER} strokeWidth={u * 0.1} opacity={0.6} strokeLinecap="round" />;
        })}
      </svg>
      {ids.map((id, i) => {
        const ap = interpolate(frame, [f(ASSEMBLE + i * 0.12), f(ASSEMBLE + 0.45 + i * 0.12)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
        return (
          <div key={id} style={{ position: "absolute", left: x0 + gap * i, top: rowY, transform: `translate(-50%,-50%) scale(${0.8 + 0.2 * ap})`, opacity: ap, textAlign: "center" }}>
            <div style={{ height: u * 7, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon id={id} u={u} frame={frame} p={ap} mini /></div>
            <div style={{ fontFamily: MONO, fontSize: u * 0.92, letterSpacing: "0.12em", color: SILVER, marginTop: u * 0.8 }}>{labels[i]}</div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: H * 0.68, textAlign: "center", opacity: head, transform: `translateY(${(1 - head) * u}px)` }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 3.6, letterSpacing: "-0.02em", color: INK }}>
          This is a <span style={{ color: LIME }}>business brain.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Icon: React.FC<{ id: string; u: number; frame: number; p: number; mini?: boolean }> = ({ id, u, frame, p, mini }) => {
  const S = mini ? u * 6 : u * 15;
  const sw = mini ? 2.4 : 3.0;
  if (id === "db") {
    return (
      <svg width={S} height={S} viewBox="0 0 100 100">
        <ellipse cx="50" cy="26" rx="30" ry="11" fill="none" stroke={LINE} strokeWidth={sw} />
        <path d="M20 26 V74 A30 11 0 0 0 80 74 V26" fill="none" stroke={LINE} strokeWidth={sw} />
        <path d="M20 50 A30 11 0 0 0 80 50" fill="none" stroke={LINE} strokeWidth={sw} opacity={0.5} />
        <line x1="30" y1="40" x2="62" y2="40" stroke={LIME} strokeWidth={sw * 1.2} strokeLinecap="round" opacity={p} />
      </svg>
    );
  }
  if (id === "loops") {
    return (
      <svg width={S} height={S} viewBox="0 0 100 100" style={{ transform: `rotate(${frame * 1.4}deg)` }}>
        <path d="M50 18 A32 32 0 1 1 22 34" fill="none" stroke={LINE} strokeWidth={sw} strokeLinecap="round" />
        <path d="M50 8 L50 24 L64 16" fill="none" stroke={LIME} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (id === "files") {
    return (
      <svg width={S} height={S} viewBox="0 0 100 100">
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${18 + i * 9} ${20 + i * 8})`}>
            <rect x="0" y="0" width="46" height="34" rx="4" fill="none" stroke={LINE} strokeWidth={sw} />
            <line x1="8" y1="12" x2="30" y2="12" stroke={i === 2 ? LIME : SILVER} strokeWidth={sw * 0.8} strokeLinecap="round" opacity={i === 2 ? p : 0.5} />
            <line x1="8" y1="22" x2="38" y2="22" stroke={SILVER} strokeWidth={sw * 0.7} strokeLinecap="round" opacity={0.35} />
          </g>
        ))}
      </svg>
    );
  }
  if (id === "dash") {
    return (
      <svg width={S} height={S} viewBox="0 0 100 100">
        <rect x="16" y="24" width="68" height="52" rx="6" fill="none" stroke={LINE} strokeWidth={sw} />
        <line x1="16" y1="37" x2="84" y2="37" stroke={LINE} strokeWidth={sw * 0.7} opacity={0.6} />
        {[22, 26, 30].map((cx) => <circle key={cx} cx={cx} cy="30.5" r="1.6" fill={SILVER} />)}
        <polyline points="26,64 40,56 52,60 66,44 76,50" fill="none" stroke={LIME} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={p} />
      </svg>
    );
  }
  if (id === "model") {
    return (
      <svg width={S} height={S} viewBox="0 0 100 100" style={{ transform: `rotate(${frame * 0.5}deg)` }}>
        {Array.from({ length: 11 }).map((_, i) => {
          const a = (i / 11) * Math.PI * 2 - Math.PI / 2, inn = 10, out = 30 + 9 * Math.abs(Math.sin(i * 1.7));
          return <line key={i} x1={50 + Math.cos(a) * inn} y1={50 + Math.sin(a) * inn} x2={50 + Math.cos(a) * out} y2={50 + Math.sin(a) * out} stroke={SILVER} strokeWidth={sw * 1.4} strokeLinecap="round" />;
        })}
      </svg>
    );
  }
  return null;
};

export default BrainBuildV2;

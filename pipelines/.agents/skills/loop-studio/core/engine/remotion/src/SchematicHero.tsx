/**
 * SchematicHero — the bespoke THROUGHLINE object for the "Business Brain" longform.
 * An empty five-slot blueprint of the Business Brain, drawn in the intro's draftsman language.
 * Proof-of-concept: it fills one slot at a time exactly as the script earns each part
 * (① DATABASE core lights lime first → ② LOOPS → ③ SKILL FILES → ④ DASHBOARD → ⑤ MODEL last),
 * then assembles into the running machine and reveals "A BUSINESS BRAIN".
 * Same grammar as BusinessBrainIntro: raisin draftsman grid, Space Grotesk / JetBrains mono,
 * lime only on the living/true things, grain + vignette, settle-camera.
 */
import React from "react";
import {
  AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Easing,
} from "remotion";

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const RAISIN = "#0F121A";
const RAISIN2 = "#151A26";
const LIME = "#CFFF05";
const SILVER = "#B5BFC2";
const STEEL = "#5A6068";
const SANS = "'Space Grotesk','Helvetica Neue',sans-serif";
const MONO = "'JetBrains Mono','SF Mono',Menlo,monospace";
const EASE = Easing.bezier(0.45, 0, 0.18, 1);

type Mod = { id: string; num: string; label: string; sub: string; x: number; y: number; at: number; lime?: boolean };
const MODS: Mod[] = [
  { id: "db", num: "01", label: "DATABASE", sub: "the core", x: 50, y: 50, at: 1.5, lime: true },
  { id: "loops", num: "02", label: "LOOPS", sub: "fill it automatically", x: 24.5, y: 50, at: 3.1 },
  { id: "files", num: "03", label: "SKILL FILES", sub: "the recipes", x: 50, y: 21, at: 4.5 },
  { id: "dash", num: "04", label: "DASHBOARD", sub: "one screen", x: 75.5, y: 50, at: 5.9 },
  { id: "model", num: "05", label: "MODEL", sub: "last · least important", x: 50, y: 79, at: 7.1 },
];
const ASSEMBLED = 8.2;
const PAYOFF = 8.8;
const END = 11.5;

const GRAIN = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='240' height='240' filter='url(#n)' opacity='0.5'/></svg>`
);

const Spark: React.FC<{ s: number; c: string; frame: number }> = ({ s, c, frame }) => (
  <svg width={s} height={s} viewBox="0 0 100 100" style={{ transform: `rotate(${frame * 0.5}deg)` }}>
    {Array.from({ length: 11 }).map((_, i) => {
      const a = (i / 11) * Math.PI * 2 - Math.PI / 2, inn = 8, out = 34 + 10 * Math.abs(Math.sin(i * 1.7));
      return <line key={i} x1={50 + Math.cos(a) * inn} y1={50 + Math.sin(a) * inn} x2={50 + Math.cos(a) * out} y2={50 + Math.sin(a) * out} stroke={c} strokeWidth={5.2} strokeLinecap="round" />;
    })}
  </svg>
);

export const SchematicHero: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  const cx = W / 2, cy = H / 2;

  // camera: defocus→settle in, gentle push, micro drift, small pull-back at payoff
  const settle = interpolate(frame, [0, f(1.0)], [0.9, 1], { extrapolateRight: "clamp", easing: EASE });
  const push = interpolate(frame, [f(1), f(ASSEMBLED)], [1.0, 1.05], { extrapolateRight: "clamp", easing: Easing.linear });
  const pull = interpolate(frame, [f(ASSEMBLED), f(PAYOFF)], [0, -0.09], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const scale = settle * (push + pull);
  const dx = Math.sin(frame / 90) * 0.12, dy = Math.cos(frame / 110) * 0.1;
  const openFade = interpolate(frame, [0, f(0.7)], [1, 0], { extrapolateRight: "clamp" });

  const px = (m: Mod) => (m.x / 100) * W;
  const py = (m: Mod) => (m.y / 100) * H;
  const ig = (m: Mod) => interpolate(frame, [f(m.at), f(m.at + 0.55)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const assembled = interpolate(frame, [f(ASSEMBLED), f(ASSEMBLED + 0.8)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });

  const CW = u * 15.5, CH = u * 9.5; // satellite card
  const DBW = u * 17.5, DBH = u * 11; // core card

  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      <AbsoluteFill style={{ transform: `translate(${dx * u}px,${dy * u}px) scale(${scale})` }}>
        {/* draftsman grid */}
        <AbsoluteFill style={{
          backgroundImage: `linear-gradient(rgba(181,191,194,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(181,191,194,0.06) 1px,transparent 1px)`,
          backgroundSize: `${u * 4}px ${u * 4}px`,
          maskImage: "radial-gradient(ellipse 72% 66% at 50% 50%,#000 45%,transparent 82%)",
          WebkitMaskImage: "radial-gradient(ellipse 72% 66% at 50% 50%,#000 45%,transparent 82%)",
        }} />

        {/* WIRES core↔satellites */}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <defs><filter id="wg"><feGaussianBlur stdDeviation={u * 0.25} result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
          {MODS.slice(1).map((m) => {
            const p = ig(m);
            const x2 = cx + (px(m) - cx) * 0.78, y2 = cy + (py(m) - cy) * 0.78;
            const x1 = cx + (px(m) - cx) * 0.16, y1 = cy + (py(m) - cy) * 0.16;
            const cxp = x1 + (x2 - x1) * p, cyp = y1 + (y2 - y1) * p;
            const lit = m.lime ? LIME : SILVER;
            return (
              <g key={m.id}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={STEEL} strokeWidth={u * 0.1} strokeDasharray={`${u * 0.9} ${u * 0.7}`} opacity={0.4} />
                <line x1={x1} y1={y1} x2={cxp} y2={cyp} stroke={lit} strokeWidth={u * 0.13} opacity={0.7 * p} strokeLinecap="round" />
                {/* assembled: data pulses flow along wires */}
                {assembled > 0 && Array.from({ length: 3 }).map((_, k) => {
                  const t = ((frame / 40) + k / 3) % 1;
                  return <circle key={k} cx={x1 + (x2 - x1) * t} cy={y1 + (y2 - y1) * t} r={u * 0.28} fill={LIME} opacity={assembled * (1 - Math.abs(t - 0.5) * 1.2)} filter="url(#wg)" />;
                })}
              </g>
            );
          })}
        </svg>

        {/* SATELLITE MODULES */}
        {MODS.slice(1).map((m) => <ModuleCard key={m.id} m={m} p={ig(m)} frame={frame} u={u} W={W} H={H} cw={CW} ch={CH} px={px(m)} py={py(m)} />)}
        {/* CORE (database) on top */}
        <ModuleCard m={MODS[0]} p={ig(MODS[0])} frame={frame} u={u} W={W} H={H} cw={DBW} ch={DBH} px={cx} py={cy} core />

        {/* title tag */}
        <div style={{ position: "absolute", left: u * 5, top: u * 5, display: "flex", alignItems: "center", gap: u * 0.8, opacity: interpolate(frame, [f(0.4), f(1.1)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
          <div style={{ width: u * 0.7, height: u * 0.7, transform: "rotate(45deg)", border: `${u * 0.12}px solid ${LIME}` }} />
          <span style={{ fontFamily: MONO, fontSize: u * 1.1, letterSpacing: "0.28em", color: SILVER }}>THE&nbsp;BUSINESS&nbsp;BRAIN</span>
          <span style={{ fontFamily: MONO, fontSize: u * 1.1, letterSpacing: "0.2em", color: STEEL }}>· FIG.&nbsp;01</span>
        </div>

        {/* payoff caption */}
        {frame >= f(PAYOFF) - 4 && (() => {
          const p = spring({ frame: frame - f(PAYOFF), fps: FPS, config: { damping: 15, stiffness: 150 }, durationInFrames: 20 });
          return (
            <div style={{ position: "absolute", left: 0, right: 0, top: "84%", textAlign: "center", opacity: p, transform: `translateY(${(1 - p) * u * 1.2}px)` }}>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 3.4, letterSpacing: "-0.02em", color: "#fff", textShadow: "0 4px 30px rgba(0,0,0,0.8)" }}>
                A <span style={{ color: LIME }}>business brain.</span>
              </div>
            </div>
          );
        })()}
      </AbsoluteFill>

      {/* vignette + grain */}
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 80% 74% at 50% 50%,transparent 46%,rgba(0,0,0,0.6) 100%)" }} />
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.05, mixBlendMode: "overlay", backgroundImage: `url("${GRAIN}")`, backgroundSize: `${u * 12}px`, transform: `translate(${(frame % 3) * 3}px,${(frame % 2) * -3}px)` }} />
      <AbsoluteFill style={{ background: "#000", opacity: openFade, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

const ModuleCard: React.FC<{ m: Mod; p: number; frame: number; u: number; W: number; H: number; cw: number; ch: number; px: number; py: number; core?: boolean }> = ({ m, p, frame, u, cw, ch, px, py, core }) => {
  const lit = m.lime ? LIME : SILVER;
  const pop = core ? 1 : 0.94 + 0.06 * p;
  return (
    <div style={{ position: "absolute", left: px - cw / 2, top: py - ch / 2, width: cw, height: ch, transform: `scale(${pop})` }}>
      {/* unlit dashed placeholder */}
      <div style={{ position: "absolute", inset: 0, borderRadius: u * 0.9, border: `${u * 0.12}px dashed ${STEEL}`, opacity: 0.5 * (1 - p) + 0.15 }} />
      {/* lit card */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: u * 0.9, background: `linear-gradient(160deg,${RAISIN2},${RAISIN})`,
        border: `${u * 0.12}px solid ${lit}`, opacity: p,
        boxShadow: `0 ${u * 0.8}px ${u * 2.4}px rgba(0,0,0,0.5), 0 0 ${u * 1.6}px ${m.lime ? "rgba(207,255,5,0.28)" : "rgba(181,191,194,0.14)"}`,
        overflow: "hidden",
      }}>
        <Inner id={m.id} u={u} frame={frame} p={p} lit={lit} />
      </div>
      {/* numeral badge */}
      <div style={{ position: "absolute", left: -u * 0.6, top: -u * 0.6, width: u * 2.4, height: u * 2.4, borderRadius: "50%", background: m.lime ? LIME : RAISIN2, border: `${u * 0.1}px solid ${lit}`, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.35 + 0.65 * p }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.1, color: m.lime ? RAISIN : lit }}>{m.num}</span>
      </div>
      {/* label + sub */}
      <div style={{ position: "absolute", left: 0, top: ch + u * 0.7, width: cw, textAlign: "center" }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 1.55, letterSpacing: "0.02em", color: p > 0.5 ? "#fff" : STEEL }}>{m.label}</div>
        <div style={{ fontFamily: MONO, fontSize: u * 0.98, letterSpacing: "0.14em", color: m.lime ? LIME : SILVER, opacity: 0.7 * p, marginTop: u * 0.2 }}>{m.sub}</div>
      </div>
    </div>
  );
};

const Inner: React.FC<{ id: string; u: number; frame: number; p: number; lit: string }> = ({ id, u, frame, p, lit }) => {
  if (p < 0.05) return null;
  if (id === "db") {
    // streaming rows, newest lands lime + a live counter
    return (
      <div style={{ position: "absolute", inset: u * 1.0, opacity: p }}>
        {Array.from({ length: 5 }).map((_, i) => {
          const y = ((i * u * 1.5) + (frame % 45) / 45 * u * 1.5);
          const newest = i === 0;
          return <div key={i} style={{ position: "absolute", left: 0, right: u * 3, top: y, height: u * 0.55, borderRadius: u * 0.15, background: newest ? LIME : STEEL, opacity: newest ? 0.9 : 0.4 - i * 0.06 }} />;
        })}
        <div style={{ position: "absolute", right: u * 0.6, bottom: u * 0.4, fontFamily: MONO, fontSize: u * 0.95, color: LIME }}>{2148 + (frame % 1000)}</div>
      </div>
    );
  }
  if (id === "loops") {
    return (
      <svg style={{ position: "absolute", inset: 0, opacity: p }} width="100%" height="100%" viewBox="0 0 100 60">
        <g transform="translate(50 30)">
          {[0, 1, 2].map((k) => (
            <path key={k} d="M -14 0 A 14 14 0 1 1 0 14" fill="none" stroke={lit} strokeWidth="2.4" strokeLinecap="round" opacity={0.5 + 0.3 * k} transform={`rotate(${frame * (2 + k) + k * 120})`} />
          ))}
          <path d="M 12 -3 L 0 14 L 16 12" fill="none" stroke={lit} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" transform={`rotate(${frame * 2})`} />
        </g>
      </svg>
    );
  }
  if (id === "files") {
    return (
      <div style={{ position: "absolute", inset: u * 1.0, opacity: p }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ position: "absolute", left: i * u * 0.9, top: i * u * 0.7, width: u * 6.5, height: u * 4.2, borderRadius: u * 0.4, background: RAISIN2, border: `1px solid ${STEEL}` }}>
            <div style={{ position: "absolute", left: u * 0.6, top: u * 0.6, width: u * 3, height: u * 0.4, background: STEEL, opacity: 0.6 }} />
            <div style={{ position: "absolute", left: u * 0.6, top: u * 1.4, width: u * 4.4, height: u * 0.3, background: STEEL, opacity: 0.35 }} />
          </div>
        ))}
      </div>
    );
  }
  if (id === "dash") {
    const pts = [0, 1, 2, 3, 4, 5, 6].map((i) => [i / 6 * 100, 45 - Math.abs(Math.sin(i * 1.1)) * 30]);
    return (
      <svg style={{ position: "absolute", inset: u * 1.0, opacity: p }} width="90%" height="70%" viewBox="0 0 100 50">
        <polyline points={pts.map((a) => a.join(",")).join(" ")} fill="none" stroke={LIME} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
        {[68, 80, 92].map((x, i) => <rect key={i} x={x} y={30 - i * 6} width="6" height={18 + i * 6} fill={STEEL} opacity={0.5} />)}
      </svg>
    );
  }
  if (id === "model") {
    return <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: p }}><Spark s={u * 5.5} c={SILVER} frame={frame} /></div>;
  }
  return null;
};

export default SchematicHero;

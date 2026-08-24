/**
 * BakeoffE — "THREE MODES" (dark register). The footage moves between three registers, driven by
 * a single framing value fr (0 = full-bleed footage with graphic OVERLAYS, 1 = framed lime-offset
 * panel inside the graphics world; graphics own the frame when the panel is tiny/gone):
 *   FULL FOOTAGE + overlays  (hook)  → PANEL in world (stream/file) → FULL GRAPHICS (burst, photo/movie)
 *   → FULL FOOTAGE + overlays (aside) → PANEL (new order) → FULL FOOTAGE (close).
 * Footage plays from 0 (same take as the narration → lip sync). Voice only; SFX+music in post.
 * Narration 85.7–113.5s.
 */
import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  FPS, f, EASE, EASE_OVER,
  RAISIN, RAISIN_DEEP, SILVER, SILVER_SOFT, SILVER_MID, BODY, LIME, WHITE,
  SANS, MONO, SERIF, useAmbient,
} from "./bb2/engine";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

type SK = { t: number; x: number; y: number; s: number; dim: number; fr: number };
const skf = (kfs: SK[], frame: number): SK => {
  let a = kfs[0];
  for (let i = 1; i < kfs.length; i++) {
    const b = kfs[i];
    if (frame <= f(b.t)) {
      const p = interpolate(frame, [f(a.t), f(b.t)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OVER });
      const L = (k: keyof SK) => (a[k] as number) + ((b[k] as number) - (a[k] as number)) * p;
      return { t: 0, x: L("x"), y: L("y"), s: L("s"), dim: L("dim"), fr: L("fr") };
    }
    a = b;
  }
  return a;
};

const LABELS = ["new order #4471", "payout €3,900", "DM: still there?", "+3 subscribers", "5★ review", "€1,240 paid", "refund request", "invoice sent"];

const Card: React.FC<{ x: number; y: number; u: number; label: string; money?: boolean; scale?: number; rot?: number; opacity?: number }> = ({ x, y, u, label, money, scale = 1, rot = 0, opacity = 1 }) => (
  <div style={{ position: "absolute", left: x + "%", top: y + "%", transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${scale})`, opacity }}>
    <div style={{ position: "relative", display: "inline-block" }}>
      <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.5, transform: `translate(${u * 0.4}px,${u * 0.4}px)`, opacity: money ? 0.95 : 0.35 }} />
      <div style={{ position: "relative", background: RAISIN_DEEP, border: `${u * 0.11}px solid ${money ? LIME : SILVER_MID}`, borderRadius: u * 0.5, padding: `${u * 0.4}px ${u * 0.8}px`, display: "flex", alignItems: "center", gap: u * 0.5, boxShadow: `0 ${u * 0.6}px ${u * 1.4}px rgba(0,0,0,0.5)` }}>
        <span style={{ width: u * 0.5, height: u * 0.5, background: money ? LIME : "transparent", border: `${u * 0.1}px solid ${money ? LIME : SILVER_MID}`, flexShrink: 0 }} />
        <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: u * 1.1, color: SILVER, whiteSpace: "nowrap" }}>{label}</span>
      </div>
    </div>
  </div>
);

/* PHOTO — a polaroid holding ONE frozen, grey snapshot of the business (static bars) */
const PhotoCard: React.FC<{ u: number }> = ({ u }) => {
  const bars = [0.5, 0.78, 0.42, 0.66];
  return (
    <div style={{ background: "#e7eaec", padding: `${u * 0.7}px ${u * 0.7}px ${u * 2.6}px`, borderRadius: u * 0.25, boxShadow: `0 ${u * 1.2}px ${u * 2.6}px rgba(0,0,0,0.55)`, transform: "rotate(-2.5deg)" }}>
      <div style={{ width: u * 17, height: u * 11.5, background: "#20242e", position: "relative", overflow: "hidden", filter: "saturate(0.25) brightness(0.82)", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: u * 0.9, padding: `0 ${u * 1.4}px ${u * 1.2}px` }}>
        {bars.map((h, i) => <div key={i} style={{ width: u * 2.1, height: `${h * 100}%`, background: SILVER_MID }} />)}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: u * 0.8, borderTop: `${u * 0.12}px solid #3a4152` }} />
      </div>
      <div style={{ marginTop: u * 0.7, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.85, letterSpacing: "0.08em", color: "#5a6068", textAlign: "center" }}>MON · 10:04</div>
    </div>
  );
};

/* MOVIE — a filmstrip of the SAME business, bars growing, scrolling past (alive) */
const Filmstrip: React.FC<{ u: number; t: number }> = ({ u, t }) => {
  const FRAME_W = 6.6, GAP = 0.6, N = 10;
  const period = (FRAME_W + GAP) * u;
  const scroll = (t * u * 7) % period;
  return (
    <div style={{ position: "relative", width: u * 24, height: u * 14, background: "#0d1017", border: `${u * 0.16}px solid ${LIME}`, borderRadius: u * 0.4, overflow: "hidden", boxShadow: `0 0 ${u * 2.6}px ${LIME}55` }}>
      {/* sprocket rails */}
      {[0, 1].map((row) => (
        <div key={row} style={{ position: "absolute", left: -period, right: 0, [row ? "bottom" : "top"]: u * 0.35, height: u * 1.0, display: "flex", gap: u * 0.75, transform: `translateX(${-scroll}px)` }}>
          {Array.from({ length: 30 }).map((_, i) => <div key={i} style={{ width: u * 1.0, height: u * 1.0, background: "#e7eaec", borderRadius: u * 0.15, flexShrink: 0 }} />)}
        </div>
      ))}
      {/* frames (bars grow across frames = business over time) */}
      <div style={{ position: "absolute", top: u * 1.9, bottom: u * 1.9, left: -period, display: "flex", gap: GAP * u, transform: `translateX(${-scroll}px)` }}>
        {Array.from({ length: N + 2 }).map((_, i) => {
          const g = 0.28 + ((i * 0.11) % 0.66);
          return (
            <div key={i} style={{ width: FRAME_W * u, height: "100%", background: "#161b26", flexShrink: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: u * 0.35, padding: `0 ${u * 0.7}px ${u * 0.5}px` }}>
              {[g * 0.7, g, g * 0.85].map((h, j) => <div key={j} style={{ width: u * 1.0, height: `${Math.min(0.92, h) * 100}%`, background: LIME }} />)}
            </div>
          );
        })}
      </div>
      {/* play badge */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: u * 3.4, height: u * 3.4, borderRadius: "50%", background: "rgba(13,16,23,0.55)", border: `${u * 0.13}px solid ${SILVER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 0, height: 0, borderTop: `${u * 0.85}px solid transparent`, borderBottom: `${u * 0.85}px solid transparent`, borderLeft: `${u * 1.3}px solid ${SILVER}`, marginLeft: u * 0.35 }} />
        </div>
      </div>
    </div>
  );
};

/* footage that morphs full-bleed <-> framed panel via fr */
const FootageLayer: React.FC<{ sk: SK; u: number }> = ({ sk, u }) => {
  const { width: W, height: H } = useVideoConfig();
  const fr = clamp01(sk.fr);
  const panelW = W * 0.4 * sk.s, panelH = panelW * 9 / 16;
  const w = lerp(W, panelW, fr), h = lerp(H, panelH, fr);
  const cx = lerp(50, sk.x, fr), cy = lerp(50, sk.y, fr);
  const bright = 1 - sk.dim;
  return (
    <div style={{ position: "absolute", left: cx + "%", top: cy + "%", transform: "translate(-50%,-50%)", pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: -h * 0.25, background: `radial-gradient(ellipse, ${LIME}18 0%, transparent 68%)`, opacity: fr * bright }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, background: LIME, borderRadius: u * 0.9 * fr, transform: `translate(${u * 0.9 * fr}px,${u * 0.9 * fr}px)`, opacity: (0.9 * bright + 0.25) * fr }} />
      <div style={{ position: "relative", width: w, height: h, borderRadius: u * 0.9 * fr, overflow: "hidden", border: `${u * 0.16 * fr}px solid ${SILVER}`, boxShadow: `0 ${u * 1.2 * fr}px ${u * 3 * fr}px rgba(0,0,0,0.6)` }}>
        <OffthreadVideo src={staticFile("footage/bakeoff.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: `brightness(${0.55 + 0.45 * bright}) contrast(1.04) saturate(1.03)` }} />
        <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 ${u * 3}px rgba(0,0,0,0.4)` }} />
      </div>
    </div>
  );
};

export const BakeoffE: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  const amb = useAmbient();

  const SKF: SK[] = [
    { t: 0.0, x: 50, y: 50, s: 1, dim: 0, fr: 0 },   // FULL footage — hook
    { t: 2.6, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 3.5, x: 76, y: 52, s: 0.94, dim: 0.05, fr: 1 }, // → PANEL as stream reveals
    { t: 6.0, x: 76, y: 52, s: 0.94, dim: 0.05, fr: 1 },
    { t: 6.5, x: 79, y: 53, s: 0.9, dim: 0.14, fr: 1 },
    { t: 9.1, x: 79, y: 53, s: 0.9, dim: 0.18, fr: 1 },
    { t: 9.7, x: 90, y: 60, s: 0.5, dim: 0.55, fr: 1 },  // BURST — footage tiny at edge
    { t: 11.0, x: 90, y: 60, s: 0.5, dim: 0.55, fr: 1 },
    { t: 11.9, x: 87, y: 72, s: 0.44, dim: 0.3, fr: 1 }, // photo/movie — tiny corner
    { t: 15.0, x: 87, y: 72, s: 0.44, dim: 0.3, fr: 1 },
    { t: 15.7, x: 50, y: 50, s: 1, dim: 0, fr: 0 },      // FULL footage — aside (direct address)
    { t: 21.0, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
    { t: 22.1, x: 74, y: 52, s: 0.94, dim: 0.05, fr: 1 }, // → PANEL, new order
    { t: 24.8, x: 74, y: 52, s: 0.94, dim: 0.05, fr: 1 },
    { t: 25.6, x: 50, y: 50, s: 1, dim: 0, fr: 0 },      // FULL footage — close
    { t: 27.8, x: 50, y: 50, s: 1, dim: 0, fr: 0 },
  ];
  const sk = skf(SKF, frame);
  const full = 1 - clamp01(sk.fr); // 1 when footage is full-bleed

  /* graphics world */
  const streamOn = clamp01((t - 2.6) / 0.8) * (1 - clamp01((t - 10.0) / 0.8));
  const riders: { born: number; label: string; money: boolean }[] = [];
  for (let i = 0; i < 14; i++) { const born = 3.0 + i * 1.25; if (born > t || born > 8.6) break; riders.push({ born, label: LABELS[i % LABELS.length], money: i % 3 !== 1 }); }
  const TRAVERSE = 6.5;
  const ridersClear = 1 - clamp01((t - 10.0) / 0.6);
  const streamY = (p: number) => 74 - p * 8 + Math.sin(p * 7) * 2;
  const streamX = (p: number) => -6 + p * 60;

  const FILE = { x: 30, y: 52 };
  const impacts = [6.5, 7.3, 8.1, 8.9];
  let squash = 0;
  for (const it of impacts) { const dt = t - it; if (dt > 0 && dt < 0.32) squash = Math.max(squash, Math.sin((1 - dt / 0.32) * Math.PI) * 0.1); }
  const burstP = clamp01((t - 9.6) / 0.5);
  const frozen = t > 9.6;
  const DEBRIS = Array.from({ length: 6 }, (_, i) => ({ ang: (i / 6) * Math.PI * 2 + 0.5, spd: 26 + (i % 3) * 9, rot: (i % 2 ? 1 : -1) * (55 + i * 10) }));
  const fileVis = 1 - clamp01((t - 10.9) / 0.6); // file leaves before photo/movie beat

  const MSG = "am i missing something? tell me below";
  const typed = MSG.slice(0, Math.max(0, Math.floor((t - 16.4) * 13)));

  const shakeT = t - 9.6;
  const shake = shakeT > 0 && shakeT < 0.5 ? Math.sin(shakeT * 60) * (1 - shakeT / 0.5) * u * 0.6 : 0;

  const GRAIN = "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(#g)' opacity='0.5'/></svg>`);

  const marker = (word: string, at: number) => (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ position: "absolute", left: -u * 0.3, right: -u * 0.3, top: "14%", bottom: "10%", background: LIME, transform: `scaleX(${clamp01((t - at) / 0.4)}) rotate(-1.5deg)`, transformOrigin: "left center" }} />
      <span style={{ position: "relative", color: clamp01((t - at) / 0.4) > 0.4 ? RAISIN : SILVER }}>{word}</span>
    </span>
  );

  return (
    <AbsoluteFill style={{ background: RAISIN, overflow: "hidden" }}>
      <Audio src={staticFile("intros/businessbrain/bakeoff_voice.m4a")} />

      <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 60% at 40% 46%, ${RAISIN_DEEP} 0%, ${RAISIN} 68%)` }} />
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${SILVER}0a 1px,transparent 1px),linear-gradient(90deg,${SILVER}0a 1px,transparent 1px)`, backgroundSize: `${u * 3.4}px ${u * 3.4}px`, maskImage: "radial-gradient(ellipse 80% 70% at 42% 55%, #000 30%, transparent 85%)", WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 42% 55%, #000 30%, transparent 85%)", opacity: sk.fr }} />

      {/* graphics world (behind footage panel; hidden when footage is full) */}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${shake}px,${shake * 0.5}px)`, opacity: clamp01(sk.fr * 1.4) }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <defs><linearGradient id="wE" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={LIME} stopOpacity="0" /><stop offset="0.2" stopColor={LIME} stopOpacity="0.9" /><stop offset="1" stopColor={LIME} stopOpacity="0.9" /></linearGradient></defs>
          {streamOn > 0 && (
            <path d={(() => { let d = `M ${streamX(0) / 100 * W} ${streamY(0) / 100 * H}`; for (let p = 0.02; p <= 1; p += 0.02) d += ` L ${streamX(p) / 100 * W} ${streamY(p) / 100 * H}`; return d; })()}
              stroke="url(#wE)" strokeWidth={u * 0.32} fill="none" strokeLinecap="round" strokeDasharray={`${u * 2.2} ${u * 1.3}`} strokeDashoffset={-t * u * 7} opacity={streamOn} style={{ filter: `drop-shadow(0 0 ${u * 0.7}px ${LIME}aa)` }} />
          )}
        </svg>
        {riders.map((r, i) => {
          const p = (t - r.born) / TRAVERSE; if (p <= 0 || p >= 0.78) return null;
          const x = streamX(p), y = streamY(p); if (x > 44) return null;
          const vis = clamp01((p - 0.06) / 0.1) * (1 - clamp01((p - 0.6) / 0.15)) * ridersClear; if (vis <= 0) return null;
          return <Card key={`r${i}`} x={x} y={y + amb.bob(i * 0.4, 0.5)} u={u} label={r.label} money={r.money} scale={0.66 + p * 0.28} rot={amb.drift(i * 0.5, 2.4)} opacity={vis} />;
        })}
        <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity: fileVis }}>
          <g transform={`translate(${FILE.x / 100 * W} ${FILE.y / 100 * H}) scale(${(1 + squash * 0.5) * u * 0.82},${(1 - squash) * u * 0.82}) translate(-7.5 -9.5)`}>
            {(() => { const c = frozen ? SILVER_MID : SILVER; const dash = interpolate(t, [3.5, 4.3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); const crk = clamp01((t - 9.6) / 0.4);
              return (<>
                <path d="M 0 1.5 q 0 -1.5 1.5 -1.5 l 9 0 l 5 5 l 0 12 q 0 1.5 -1.5 1.5 l -13 0 q -1.5 0 -1.5 -1.5 z" fill={frozen ? "#1b2030" : "#12151d"} stroke={c} strokeWidth={0.38} strokeDasharray={64} strokeDashoffset={64 * (1 - dash)} />
                <path d="M 10.5 0 l 0 5 l 5 0" fill="none" stroke={c} strokeWidth={0.38} strokeDasharray={11} strokeDashoffset={11 * (1 - dash)} />
                <path d="M 2.6 8 l 8.5 0 M 2.6 10.5 l 9.5 0 M 2.6 13 l 7 0 M 2.6 15.5 l 8.5 0" stroke={frozen ? "#39415a" : BODY} strokeWidth={0.26} opacity={dash} />
                {/* CRACK — a branching fracture that draws across the file at the burst */}
                {frozen && crk > 0 && (() => { const S = (d: string, len: number) => <path d={d} stroke={SILVER} strokeWidth={0.4} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - crk)} />;
                  return (<g>
                    {S("M 6.8 -1 L 5.2 4 L 8.6 6.4 L 4.4 11 L 6.6 15 L 4.6 19.5", 30)}
                    {S("M 5.2 4 L 1.3 3.1", 5)}
                    {S("M 8.6 6.4 L 12.7 4.8", 5)}
                    {S("M 4.4 11 L 0.6 12.6", 5)}
                    {S("M 6.6 15 L 10.6 16.4", 5)}
                  </g>); })()}
              </>); })()}
          </g>
          {burstP > 0 && burstP < 1 && <circle cx={FILE.x / 100 * W} cy={FILE.y / 100 * H} r={burstP * 14 * u} fill="none" stroke={LIME} strokeWidth={(1 - burstP) * 1.3 * u} opacity={1 - burstP} />}
        </svg>
        {/* filename — a caption under the file, sized to fit its width */}
        <div style={{ position: "absolute", left: `${FILE.x}%`, top: `${FILE.y + 10.5}%`, transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.2, letterSpacing: "0.02em", color: frozen ? SILVER_MID : SILVER_SOFT, opacity: interpolate(t, [3.8, 4.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * (1 - clamp01((t - 10.4) / 0.6)) }}>business.md</div>
        {impacts.map((it, k) => {
          const start = it - 0.6; if (t < start || t > it + 0.1) return null;
          const p = clamp01((t - start) / 0.6);
          const sx = streamX(0.36), sy = streamY(0.36), ex = FILE.x, ey = FILE.y - 2, mx = (sx + ex) / 2, my = Math.min(sy, ey) - 8;
          const bz = (a: number, b: number, c: number) => (1 - p) * (1 - p) * a + 2 * (1 - p) * p * b + p * p * c;
          return <Card key={`d${k}`} x={bz(sx, mx, ex)} y={bz(sy, my, ey)} u={u} label={LABELS[(k * 3 + 1) % LABELS.length]} money={k % 2 === 0} scale={0.95 - p * 0.4} rot={p * -12} />;
        })}
        {burstP > 0 && DEBRIS.map((d, i) => { const dt = t - 9.6; if (dt > 1.1) return null;
          const x = FILE.x + Math.cos(d.ang) * d.spd * dt, y = FILE.y + Math.sin(d.ang) * d.spd * dt * 0.85 + 26 * dt * dt;
          return <Card key={`b${i}`} x={x} y={y} u={u} label={LABELS[i % LABELS.length]} money={i % 2 === 0} scale={0.44} rot={d.rot * dt} opacity={(1 - dt / 1.1) * 0.9} />; })}

        {/* photo vs movie — same business: one frozen grey snapshot vs a scrolling film of it changing */}
        {t > 11.5 && t < 15.4 && (() => { const on = clamp01((t - 11.6) / 0.5) * (1 - clamp01((t - 15.0) / 0.4));
          const inL = clamp01((t - 11.7) / 0.5), inR = clamp01((t - 12.5) / 0.5);
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on }}>
              {/* PHOTO */}
              <div style={{ position: "absolute", left: "27%", top: "45%", transform: `translate(-50%,-50%) translateY(${(1 - inL) * u}px)`, opacity: inL, display: "flex", flexDirection: "column", alignItems: "center", gap: u * 1.3 }}>
                <PhotoCard u={u} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.9, color: SILVER, textTransform: "uppercase" }}>A FILE = A PHOTO</div>
                  <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 1.6, color: BODY, marginTop: u * 0.2 }}>one frozen moment</div>
                </div>
              </div>
              {/* MOVIE */}
              <div style={{ position: "absolute", left: "58%", top: "45%", transform: `translate(-50%,-50%) translateY(${(1 - inR) * u}px)`, opacity: inR, display: "flex", flexDirection: "column", alignItems: "center", gap: u * 1.3 }}>
                <Filmstrip u={u} t={t} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.9, color: SILVER, textTransform: "uppercase" }}>A BUSINESS = A {marker("MOVIE", 13.4)}</div>
                  <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 1.6, color: BODY, marginTop: u * 0.2 }}>always moving</div>
                </div>
              </div>
            </div>
          ); })()}

        {/* unanswered new order (panel beat) */}
        {t > 22.0 && t < 25.2 && (() => { const dt = t - 22.2; const drop = clamp01(dt / 0.5); const bounce = dt > 0.5 && dt < 0.8 ? -Math.sin((dt - 0.5) / 0.3 * Math.PI) * 2 : 0;
          return (<>
            <Card x={31} y={30 + drop * drop * 22 + bounce} u={u} label="new order €1,850" money scale={1.05} rot={-3} opacity={clamp01(dt / 0.3)} />
            {dt > 1.0 && <div style={{ position: "absolute", left: "31%", top: "66%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.1em", color: LIME, opacity: clamp01((dt - 1.0) / 0.4) * (1 - clamp01((dt - 2.6) / 0.4)) }}>who types it in?</div>}
          </>); })()}
      </div>

      {/* edge scrims — only during full-footage so overlay text reads */}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(8,10,14,0.55) 0%, transparent 26%, transparent 62%, rgba(8,10,14,0.72) 100%)`, opacity: full, pointerEvents: "none" }} />

      {/* ===== FOOTAGE ===== */}
      <FootageLayer sk={sk} u={u} />

      {/* ===== overlays ON footage / graphics ===== */}
      {/* hook cards floating up over full footage */}
      {[{ at: 1.5, x: 22, l: "new order #4471", m: true }, { at: 2.0, x: 78, l: "€1,240 paid", m: true }, { at: 2.4, x: 30, l: "DM: still there?", m: false }].map((c, i) => {
        const dt = t - c.at; if (dt < 0 || dt > 2.2) return null;
        const rise = clamp01(dt / 0.5);
        return <Card key={`h${i}`} x={c.x} y={78 - rise * 8 + amb.bob(i, 0.6)} u={u} label={c.l} money={c.m} scale={0.9} rot={(i - 1) * 2} opacity={clamp01(dt / 0.3) * (1 - clamp01((dt - 1.4) / 0.6)) * full} />;
      })}

      {/* headlines (top-left; readable over full footage via scrim, and in graphics) */}
      {t > 0.8 && t < 5.6 && (
        <div style={{ position: "absolute", left: "6%", top: "13%", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 3.7, letterSpacing: "-0.02em", color: SILVER, textTransform: "uppercase", opacity: clamp01((t - 0.8) / 0.4) * (1 - clamp01((t - 5.2) / 0.4)) }}>NOT A DOCUMENT.</div>
      )}
      {t > 3.0 && t < 9.4 && (
        <div style={{ position: "absolute", left: "6%", top: "20.5%", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 3.7, letterSpacing: "-0.02em", color: SILVER, textTransform: "uppercase", opacity: clamp01((t - 3.0) / 0.4) * (1 - clamp01((t - 9.0) / 0.4)) }}>IT'S A {marker("STREAM.", 3.9)}</div>
      )}

      {/* CAN'T HOLD IT */}
      {frozen && t < 11.2 && (() => { const p = interpolate(frame, [f(9.9), f(9.9) + 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OVER });
        return (
          <div style={{ position: "absolute", left: `${FILE.x}%`, top: "72%", transform: `translate(-50%,-50%) scale(${0.6 + 0.4 * p})`, opacity: p * (1 - clamp01((t - 10.8) / 0.4)) }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <div style={{ position: "absolute", inset: 0, background: LIME, transform: `translate(${u * 0.4}px,${u * 0.4}px)` }} />
              <div style={{ position: "relative", background: RAISIN, border: `${u * 0.1}px solid ${LIME}`, padding: `${u * 0.5}px ${u * 1.0}px` }}>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.12em", color: LIME }}>✕ CAN'T HOLD IT</span>
              </div>
            </div>
          </div>
        ); })()}

      {/* comment lower-third — OVER full footage (aside) */}
      {t > 15.9 && t < 21.4 && (() => { const on = clamp01((t - 16.0) / 0.5) * (1 - clamp01((t - 21.0) / 0.4));
        return (
          <div style={{ position: "absolute", left: "8%", top: "78%", transform: "translate(0,-50%)", opacity: on }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.8, transform: `translate(${u * 0.5}px,${u * 0.5}px)` }} />
              <div style={{ position: "relative", background: WHITE, border: `${u * 0.12}px solid ${RAISIN}`, borderRadius: u * 0.8, padding: `${u * 0.9}px ${u * 1.3}px`, display: "flex", alignItems: "center", gap: u * 0.8, width: u * 33 }}>
                <div style={{ width: u * 2, height: u * 2, borderRadius: "50%", border: `${u * 0.12}px solid ${RAISIN}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: SANS, fontWeight: 800, fontSize: u * 1, color: RAISIN }}>?</div>
                <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: u * 1.25, color: RAISIN, whiteSpace: "nowrap" }}>{typed}{Math.floor(t * 2.4) % 2 === 0 && t < 20.6 && <span style={{ display: "inline-block", width: u * 0.55, height: u * 1.3, background: LIME, verticalAlign: "-15%" }} />}</span>
              </div>
            </div>
          </div>
        ); })()}

      {/* closing line — lower-third over full footage */}
      {t > 25.6 && (
        <div style={{ position: "absolute", left: "8%", top: "80%", whiteSpace: "nowrap" }}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 2.0, color: SILVER, opacity: clamp01((t - 25.7) / 0.5) }}>the business keeps moving.</div>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 2.0, color: LIME, opacity: clamp01((t - 26.5) / 0.5), marginTop: u * 0.4 }}>the file doesn't.</div>
        </div>
      )}

      <AbsoluteFill style={{ backgroundImage: `url("${GRAIN}")`, backgroundSize: `${u * 9}px`, mixBlendMode: "overlay", opacity: 0.05, pointerEvents: "none" }} />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 16}px rgba(0,0,0,0.5)`, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default BakeoffE;

/**
 * BakeoffD — "FOOTAGE PANEL IN THE WORLD" (dark register + real footage as a lime-offset card).
 * The talking-head clip (studio bg kept) rides inside a brand lime-offset panel that the camera
 * moves THROUGH the world: hero on the hook, steps aside as the stream reveals, dims to the edge on
 * the burst, corner-inset for photo-vs-movie, returns HERO for the direct-address aside, closes.
 * Footage plays from 0 (same take as the narration → lips stay in sync). Voice only; SFX+music in post.
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

type SK = { t: number; x: number; y: number; s: number; dim: number };
const skf = (kfs: SK[], frame: number): SK => {
  let a = kfs[0];
  for (let i = 1; i < kfs.length; i++) {
    const b = kfs[i];
    if (frame <= f(b.t)) {
      const p = interpolate(frame, [f(a.t), f(b.t)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OVER });
      return { t: 0, x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, s: a.s + (b.s - a.s) * p, dim: a.dim + (b.dim - a.dim) * p };
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

/* the footage as a brand lime-offset panel */
const FootagePanel: React.FC<{ sk: SK; u: number }> = ({ sk, u }) => {
  const { width: W } = useVideoConfig();
  const w = W * 0.4 * sk.s;
  const h = w * 9 / 16;
  const bright = 1 - sk.dim;
  return (
    <div style={{ position: "absolute", left: sk.x + "%", top: sk.y + "%", transform: "translate(-50%,-50%)", pointerEvents: "none" }}>
      {/* soft lime glow to seat it in the world */}
      <div style={{ position: "absolute", inset: -h * 0.25, background: `radial-gradient(ellipse, ${LIME}18 0%, transparent 68%)`, opacity: bright }} />
      {/* lime hard-offset block (brand device) */}
      <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, background: LIME, borderRadius: u * 0.9, transform: `translate(${u * 0.9}px,${u * 0.9}px)`, opacity: 0.9 * bright + 0.25 }} />
      {/* the panel */}
      <div style={{ position: "relative", width: w, height: h, borderRadius: u * 0.9, overflow: "hidden", border: `${u * 0.16}px solid ${SILVER}`, boxShadow: `0 ${u * 1.2}px ${u * 3}px rgba(0,0,0,0.6)` }}>
        <OffthreadVideo src={staticFile("footage/bakeoff.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: `brightness(${0.55 + 0.45 * bright}) contrast(1.04) saturate(1.03)` }} />
        {/* subtle inner vignette so it reads as a screen */}
        <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 ${u * 3}px rgba(0,0,0,0.4)` }} />
      </div>
    </div>
  );
};

export const BakeoffD: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  const amb = useAmbient();

  /* footage-panel path through the world */
  const SKF: SK[] = [
    { t: 0.0, x: 60, y: 50, s: 1.16, dim: 0 },
    { t: 2.3, x: 60, y: 50, s: 1.16, dim: 0 },
    { t: 3.3, x: 76, y: 52, s: 0.94, dim: 0.05 },
    { t: 6.0, x: 76, y: 52, s: 0.94, dim: 0.05 },
    { t: 6.5, x: 79, y: 53, s: 0.9, dim: 0.12 },
    { t: 9.1, x: 79, y: 53, s: 0.9, dim: 0.16 },
    { t: 9.7, x: 90, y: 58, s: 0.66, dim: 0.5 },   // burst: shrink to edge
    { t: 11.0, x: 90, y: 58, s: 0.66, dim: 0.5 },
    { t: 11.9, x: 85, y: 71, s: 0.52, dim: 0.2 },  // movie: corner inset
    { t: 15.0, x: 85, y: 71, s: 0.52, dim: 0.2 },
    { t: 15.7, x: 50, y: 49, s: 1.18, dim: 0 },    // aside: hero, direct address
    { t: 21.0, x: 50, y: 49, s: 1.18, dim: 0 },
    { t: 22.1, x: 74, y: 52, s: 0.94, dim: 0.05 },
    { t: 24.8, x: 74, y: 52, s: 0.94, dim: 0.05 },
    { t: 25.5, x: 63, y: 51, s: 1.06, dim: 0 },    // close
    { t: 27.8, x: 63, y: 51, s: 1.06, dim: 0 },
  ];
  const sk = skf(SKF, frame);

  /* stream (behind panel), lower-left band — lives only in its beat */
  const streamOn = clamp01((t - 2.6) / 0.8) * (1 - clamp01((t - 10.0) / 0.8));
  const riders: { born: number; label: string; money: boolean }[] = [];
  for (let i = 0; i < 14; i++) { const born = 2.8 + i * 1.25; if (born > t || born > 8.6) break; riders.push({ born, label: LABELS[i % LABELS.length], money: i % 3 !== 1 }); }
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
  const DEBRIS = Array.from({ length: 9 }, (_, i) => ({ ang: (i / 9) * Math.PI * 2 + 0.3, spd: 15 + (i % 3) * 6, rot: (i % 2 ? 1 : -1) * (150 + i * 20) }));

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
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${SILVER}0a 1px,transparent 1px),linear-gradient(90deg,${SILVER}0a 1px,transparent 1px)`, backgroundSize: `${u * 3.4}px ${u * 3.4}px`, maskImage: "radial-gradient(ellipse 80% 70% at 42% 55%, #000 30%, transparent 85%)", WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 42% 55%, #000 30%, transparent 85%)" }} />

      {/* world graphics (behind panel) */}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${shake}px,${shake * 0.5}px)` }}>
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <linearGradient id="wD" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={LIME} stopOpacity="0" /><stop offset="0.2" stopColor={LIME} stopOpacity="0.9" /><stop offset="1" stopColor={LIME} stopOpacity="0.9" /></linearGradient>
          </defs>
          {streamOn > 0 && (
            <path d={(() => { let d = `M ${streamX(0) / 100 * W} ${streamY(0) / 100 * H}`; for (let p = 0.02; p <= 1; p += 0.02) d += ` L ${streamX(p) / 100 * W} ${streamY(p) / 100 * H}`; return d; })()}
              stroke="url(#wD)" strokeWidth={u * 0.32} fill="none" strokeLinecap="round" strokeDasharray={`${u * 2.2} ${u * 1.3}`} strokeDashoffset={-t * u * 7} opacity={streamOn} style={{ filter: `drop-shadow(0 0 ${u * 0.7}px ${LIME}aa)` }} />
          )}
        </svg>
        {riders.map((r, i) => {
          const p = (t - r.born) / TRAVERSE; if (p <= 0 || p >= 0.78) return null;
          const x = streamX(p), y = streamY(p); if (x > 44) return null;
          const vis = clamp01((p - 0.06) / 0.1) * (1 - clamp01((p - 0.6) / 0.15)) * ridersClear; if (vis <= 0) return null;
          return <Card key={`r${i}`} x={x} y={y + amb.bob(i * 0.4, 0.5)} u={u} label={r.label} money={r.money} scale={0.66 + p * 0.28} rot={amb.drift(i * 0.5, 2.4)} opacity={vis} />;
        })}

        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <g transform={`translate(${FILE.x / 100 * W} ${FILE.y / 100 * H}) scale(${(1 + squash * 0.5) * u * 0.62},${(1 - squash) * u * 0.62}) translate(-8 -9)`}>
            {(() => { const c = frozen ? SILVER_MID : SILVER; const dash = interpolate(t, [3.3, 4.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              return (<>
                <path d="M 0 1.5 q 0 -1.5 1.5 -1.5 l 9 0 l 5.5 5.5 l 0 11 q 0 1.5 -1.5 1.5 l -13 0 q -1.5 0 -1.5 -1.5 z" fill={frozen ? "#161a24" : "#12151d"} stroke={c} strokeWidth={0.4} strokeDasharray={62} strokeDashoffset={62 * (1 - dash)} />
                <path d="M 10.5 0 l 0 5.5 l 5.5 0" fill="none" stroke={c} strokeWidth={0.4} strokeDasharray={12} strokeDashoffset={12 * (1 - dash)} />
                <path d="M 2.6 8 l 8 0 M 2.6 10.8 l 10 0 M 2.6 13.6 l 7 0" stroke={frozen ? SILVER_MID : BODY} strokeWidth={0.26} opacity={dash} />
                {frozen && <path d="M 8 6 l -3.5 -3 M 8 6 l 4 -2 M 8 6 l -2 4.5 M 8 6 l 3.6 3.4" stroke={LIME} strokeWidth={0.3} fill="none" strokeLinecap="round" opacity={burstP} />}
              </>); })()}
          </g>
          {burstP > 0 && burstP < 1 && <circle cx={FILE.x / 100 * W} cy={FILE.y / 100 * H} r={burstP * 14 * u} fill="none" stroke={LIME} strokeWidth={(1 - burstP) * 1.3 * u} opacity={1 - burstP} />}
        </svg>
        <div style={{ position: "absolute", left: `${FILE.x}%`, top: `${FILE.y - 8}%`, transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, letterSpacing: "0.06em", color: BODY, opacity: interpolate(t, [3.6, 4.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>business.md</div>

        {impacts.map((it, k) => {
          const start = it - 0.6; if (t < start || t > it + 0.1) return null;
          const p = clamp01((t - start) / 0.6);
          const sx = streamX(0.36), sy = streamY(0.36), ex = FILE.x, ey = FILE.y - 2, mx = (sx + ex) / 2, my = Math.min(sy, ey) - 8;
          const bz = (a: number, b: number, c: number) => (1 - p) * (1 - p) * a + 2 * (1 - p) * p * b + p * p * c;
          return <Card key={`d${k}`} x={bz(sx, mx, ex)} y={bz(sy, my, ey)} u={u} label={LABELS[(k * 3 + 1) % LABELS.length]} money={k % 2 === 0} scale={0.95 - p * 0.4} rot={p * -12} />;
        })}
        {burstP > 0 && DEBRIS.map((d, i) => { const dt = t - 9.6; if (dt > 1.3) return null;
          const x = FILE.x + Math.cos(d.ang) * d.spd * dt, y = FILE.y + Math.sin(d.ang) * d.spd * dt * 0.8 + 24 * dt * dt;
          return <Card key={`b${i}`} x={x} y={y} u={u} label={LABELS[i % LABELS.length]} money={i % 2 === 0} scale={0.6} rot={d.rot * dt} opacity={1 - dt / 1.3} />; })}
      </div>

      {/* ===== FOOTAGE PANEL ===== */}
      <FootagePanel sk={sk} u={u} />

      {/* ===== foreground graphics ===== */}
      {t > 0.8 && t < 5.6 && (
        <div style={{ position: "absolute", left: "6%", top: "17%", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 3.7, letterSpacing: "-0.02em", color: SILVER, textTransform: "uppercase", opacity: clamp01((t - 0.8) / 0.4) * (1 - clamp01((t - 5.2) / 0.4)) }}>NOT A DOCUMENT.</div>
      )}
      {t > 3.0 && t < 9.4 && (
        <div style={{ position: "absolute", left: "6%", top: "24.5%", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 800, fontSize: u * 3.7, letterSpacing: "-0.02em", color: SILVER, textTransform: "uppercase", opacity: clamp01((t - 3.0) / 0.4) * (1 - clamp01((t - 9.0) / 0.4)) }}>IT'S A {marker("STREAM.", 3.9)}</div>
      )}

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

      {t > 11.5 && t < 15.4 && (() => { const on = clamp01((t - 11.6) / 0.5) * (1 - clamp01((t - 15.0) / 0.4));
        return (
          <div style={{ position: "absolute", inset: 0, opacity: on }}>
            <div style={{ position: "absolute", left: "27%", top: "44%", transform: "translate(-50%,-50%)" }}>
              <div style={{ width: u * 20, height: u * 15, background: "#14171f", border: `${u * 0.14}px solid ${SILVER_MID}`, position: "relative" }}>
                {[0, 1, 2].map((i) => <Card key={i} x={30 + i * 20} y={35 + (i % 2) * 26} u={u * 0.62} label={["order", "DM", "€90"][i]} money={i !== 1} scale={0.5} />)}
              </div>
              <div style={{ marginTop: u * 0.8, fontFamily: SANS, fontWeight: 800, fontSize: u * 1.8, color: SILVER, textTransform: "uppercase", textAlign: "center" }}>A FILE = A PHOTO</div>
            </div>
            <div style={{ position: "absolute", left: "55%", top: "44%", transform: "translate(-50%,-50%)" }}>
              <div style={{ width: u * 22, height: u * 15, background: "#14171f", border: `${u * 0.16}px solid ${LIME}`, position: "relative", overflow: "hidden", boxShadow: `0 0 ${u * 2}px ${LIME}55` }}>
                {[0, 1, 2].map((i) => { const lx = 8 + ((t * 20 + i * 34) % 92); return <Card key={i} x={lx} y={32 + (i % 2) * 30 + amb.bob(i, 6)} u={u * 0.62} label={["order", "DM", "€90"][i]} money={i !== 1} scale={0.5} />; })}
              </div>
              <div style={{ marginTop: u * 0.8, fontFamily: SANS, fontWeight: 800, fontSize: u * 1.8, color: SILVER, textTransform: "uppercase", textAlign: "center" }}>A BUSINESS = {marker("A MOVIE", 13.6)}</div>
            </div>
          </div>
        ); })()}

      {t > 15.9 && t < 21.4 && (() => { const on = clamp01((t - 16.0) / 0.5) * (1 - clamp01((t - 21.0) / 0.4));
        return (
          <div style={{ position: "absolute", left: "26%", top: "73%", transform: "translate(-50%,-50%)", opacity: on }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.8, transform: `translate(${u * 0.5}px,${u * 0.5}px)` }} />
              <div style={{ position: "relative", background: WHITE, border: `${u * 0.12}px solid ${RAISIN}`, borderRadius: u * 0.8, padding: `${u * 0.9}px ${u * 1.3}px`, display: "flex", alignItems: "center", gap: u * 0.8, width: u * 33 }}>
                <div style={{ width: u * 2, height: u * 2, borderRadius: "50%", border: `${u * 0.12}px solid ${RAISIN}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: SANS, fontWeight: 800, fontSize: u * 1, color: RAISIN }}>?</div>
                <span style={{ fontFamily: MONO, fontWeight: 500, fontSize: u * 1.25, color: RAISIN, whiteSpace: "nowrap" }}>{typed}{Math.floor(t * 2.4) % 2 === 0 && t < 20.6 && <span style={{ display: "inline-block", width: u * 0.55, height: u * 1.3, background: LIME, verticalAlign: "-15%" }} />}</span>
              </div>
            </div>
          </div>
        ); })()}

      {t > 22.0 && t < 25.2 && (() => { const dt = t - 22.2; const drop = clamp01(dt / 0.5); const bounce = dt > 0.5 && dt < 0.8 ? -Math.sin((dt - 0.5) / 0.3 * Math.PI) * 2 : 0;
        return (<>
          <Card x={31} y={30 + drop * drop * 22 + bounce} u={u} label="new order €1,850" money scale={1.05} rot={-3} opacity={clamp01(dt / 0.3)} />
          {dt > 1.0 && <div style={{ position: "absolute", left: "31%", top: "66%", transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.1em", color: LIME, opacity: clamp01((dt - 1.0) / 0.4) * (1 - clamp01((dt - 2.6) / 0.4)) }}>who types it in?</div>}
        </>); })()}

      {t > 25.4 && (
        <div style={{ position: "absolute", left: "6%", top: "80%", whiteSpace: "nowrap" }}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 2.0, color: SILVER, opacity: clamp01((t - 25.4) / 0.5) }}>the business keeps moving.</div>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * 2.0, color: LIME, opacity: clamp01((t - 26.3) / 0.5), marginTop: u * 0.4 }}>the file doesn't.</div>
        </div>
      )}

      <AbsoluteFill style={{ backgroundImage: `url("${GRAIN}")`, backgroundSize: `${u * 9}px`, mixBlendMode: "overlay", opacity: 0.05, pointerEvents: "none" }} />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 16}px rgba(0,0,0,0.55)`, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export default BakeoffD;

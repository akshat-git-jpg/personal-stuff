/**
 * scene.tsx — shared, proven primitives for the Business Brain film (Motion Grammar v2).
 * Extracted from the approved BakeoffE proof: mode-morphing footage layer, event cards, the
 * photo/filmstrip analogy pair, the markdown-file drawing, the lime marker, and the SK keyframer.
 * Everything here is LOCKED brand + verified to read. Acts compose these.
 */
import React from "react";
import { Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  FPS, f, EASE, EASE_OVER,
  RAISIN, RAISIN_DEEP, STEEL, SILVER, SILVER_SOFT, SILVER_MID, BODY, LIME, WHITE,
  WELL, PANEL_DEEP, PANEL, PANEL_RAISED, CARD, BORDER, PAPER,
  SANS, MONO, SERIF, useAmbient,
} from "./engine";

export * from "./engine";
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/* ---- SK keyframer: footage framing/position over time ---- */
export type SK = { t: number; x: number; y: number; s: number; dim: number; fr: number };
export const skf = (kfs: SK[], frame: number): SK => {
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

/* ---- event card (lime hard-offset) ---- */
export const Card: React.FC<{ x: number; y: number; u: number; label: string; money?: boolean; scale?: number; rot?: number; opacity?: number }> = ({ x, y, u, label, money, scale = 1, rot = 0, opacity = 1 }) => (
  <div style={{ position: "absolute", left: x + "%", top: y + "%", transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${scale})`, opacity }}>
    <div style={{ position: "relative", display: "inline-block" }}>
      <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.5, transform: `translate(${u * 0.4}px,${u * 0.4}px)`, opacity: money ? 0.95 : 0.35 }} />
      <div style={{ position: "relative", background: money ? RAISIN_DEEP : CARD, border: `${u * 0.11}px solid ${money ? LIME : SILVER_MID}`, borderRadius: u * 0.5, padding: `${u * 0.4}px ${u * 0.8}px`, display: "flex", alignItems: "center", gap: u * 0.5, boxShadow: `0 ${u * 0.6}px ${u * 1.4}px rgba(0,0,0,0.5)` }}>
        {(() => {
          const l = label.toLowerCase();
          const ic = /payout|paid|invoice|refund|€|order/.test(l) ? "lucide-banknote" : /dm|msg|message|still there|review/.test(l) ? "lucide-message-circle" : /sub|visit/.test(l) ? "lucide-users" : null;
          return ic ? <Img src={staticFile(`logos/${ic}-${money ? "lime" : "silver"}.svg`)} style={{ width: u * 1.05, height: u * 1.05, flexShrink: 0 }} />
            : <span style={{ width: u * 0.5, height: u * 0.5, background: money ? LIME : "rgba(231,233,238,0.14)", border: `${u * 0.1}px solid ${money ? LIME : SILVER_MID}`, flexShrink: 0 }} />;
        })()}
        <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: u * 1.1, color: SILVER, whiteSpace: "nowrap" }}>{label}</span>
      </div>
    </div>
  </div>
);

/* ---- lime marker highlight on one headline word ----
   Two-layer wipe so text is NEVER dark-on-dark: base layer = silver text (always legible);
   overlay = lime plate + raisin text clipped TOGETHER by the wipe. */
export const Marker: React.FC<{ children: React.ReactNode; u: number; t: number; at: number; base?: string }> = ({ children, u, t, at, base = SILVER }) => {
  const p = clamp01((t - at) / 0.4);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ position: "relative", color: base }}>{children}</span>
      <span style={{ position: "absolute", inset: 0, clipPath: `inset(-12% ${(1 - p) * 104 - 2}% -8% -2%)` }}>
        <span style={{ position: "absolute", left: -u * 0.35, right: -u * 0.35, top: "-6%", bottom: "-2%", background: LIME, transform: "rotate(-1.2deg)" }} />
        <span style={{ position: "relative", color: RAISIN, textShadow: "none" }}>{children}</span>
      </span>
    </span>
  );
};

/* ---- footage that morphs full-bleed <-> framed lime-offset panel via fr ---- */
export const FootageLayer: React.FC<{ sk: SK; u: number; src: string; zoom?: number; seams?: number[] }> = ({ sk, u, src, zoom = 1, seams }) => {
  const { width: W, height: H, fps } = useVideoConfig();
  const t = useCurrentFrame() / fps;
  // SEAM SOFTENER: the footage is a concatenated cut, so the talking head hard-SNAPS to a new
  // pose at every take-change. Mask each snap with a short blur pulse + an incoming punch-settle
  // so it reads as an intentional cut, not a jump. (2026-07-19 — Luuk: "rough cuts, esp. at the end".)
  let seamBlur = 0, seamScale = 1;
  for (const s of seams || []) {
    const d = t - s;
    seamBlur = Math.max(seamBlur, Math.max(0, 1 - Math.abs(d) / 0.06));       // ±0.06s triangular pulse
    if (d >= 0 && d < 0.2) seamScale = Math.max(seamScale, 1 + 0.03 * (1 - d / 0.2)); // new take pops in ~3% and settles
  }
  const fr = clamp01(sk.fr);
  // Aspect-aware face-cam panel: a PORTRAIT comp gets a PORTRAIT panel that MATCHES the
  // 9:16 footage (so objectFit:cover never crops the face out); a 16:9 comp keeps the
  // landscape panel it was designed with. (Shorts fix, 2026-07-18 — face must stay whole.)
  const portrait = H > W;
  const panelW = W * (portrait ? 0.5 : 0.4) * sk.s;
  const panelH = panelW * (portrait ? 16 / 9 : 9 / 16);
  const w = lerp(W, panelW, fr), h = lerp(H, panelH, fr);
  const cx = lerp(50, sk.x, fr), cy = lerp(50, sk.y, fr);
  const bright = 1 - sk.dim;
  if (bright <= 0.02 && fr > 0.99) return null;
  return (
    <div style={{ position: "absolute", left: cx + "%", top: cy + "%", transform: "translate(-50%,-50%)", pointerEvents: "none", opacity: clamp01(bright * 1.5) }}>
      <div style={{ position: "absolute", inset: -h * 0.25, background: `radial-gradient(ellipse, ${LIME}18 0%, transparent 68%)`, opacity: fr * bright }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, background: LIME, borderRadius: u * 0.5 * fr, transform: `translate(${u * 0.35 * fr}px,${u * 0.35 * fr}px)`, opacity: (0.9 * bright + 0.25) * fr }} />
      <div style={{ position: "relative", width: w, height: h, borderRadius: u * 0.5 * fr, overflow: "hidden", border: `${u * 0.1 * fr}px solid ${SILVER}`, boxShadow: `0 ${u * 0.45 * fr}px ${u * 1.2 * fr}px rgba(0,0,0,0.45)` }}>
        {/* objectPosition top-weighted so the FACE (upper third of the portrait frame) is always kept */}
        <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 28%", transform: `scale(${zoom * seamScale})`, transformOrigin: "center 30%", filter: `brightness(${0.55 + 0.45 * bright}) contrast(1.04) saturate(1.03)${seamBlur > 0.01 ? ` blur(${(u * 0.9 * seamBlur).toFixed(2)}px)` : ""}` }} />
        <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 ${u * 3}px rgba(0,0,0,0.4)` }} />
      </div>
    </div>
  );
};

/* ---- markdown-file drawing (folded corner, filename label, optional fracture) ---- */
export const FileGraphic: React.FC<{ x: number; y: number; u: number; W: number; H: number; scale?: number; frozen?: boolean; crack?: number; draw?: number; squash?: number; name?: string }> = ({ x, y, u, W, H, scale = 0.82, frozen, crack = 0, draw = 1, squash = 0, name = "business.md" }) => {
  const c = frozen ? SILVER_MID : SILVER;
  return (
    <>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(${x / 100 * W} ${y / 100 * H}) scale(${(1 + squash * 0.5) * u * scale},${(1 - squash) * u * scale}) translate(-7.5 -9.5)`}>
          <path d="M 0 1.5 q 0 -1.5 1.5 -1.5 l 9 0 l 5 5 l 0 12 q 0 1.5 -1.5 1.5 l -13 0 q -1.5 0 -1.5 -1.5 z" fill={frozen ? PANEL_RAISED : PANEL_DEEP} stroke={c} strokeWidth={0.38} strokeDasharray={64} strokeDashoffset={64 * (1 - draw)} />
          <path d="M 10.5 0 l 0 5 l 5 0" fill="none" stroke={c} strokeWidth={0.38} strokeDasharray={11} strokeDashoffset={11 * (1 - draw)} />
          <path d="M 2.6 8 l 8.5 0 M 2.6 10.5 l 9.5 0" stroke={frozen ? BORDER : SILVER_MID} strokeWidth={0.26} opacity={draw} />
          {/* official markdown mark — the file must READ as .md at a glance */}
          <g transform="translate(2.6 12.6) scale(0.0206)" opacity={draw}>
            <path d="M193 128H15a15 15 0 0 1-15-15V15A15 15 0 0 1 15 0h178a15 15 0 0 1 15 15v98a15 15 0 0 1-15 15zM50 98V59l20 25 20-25v39h20V30H90L70 55 50 30H30v68zm134-34h-20V30h-20v34h-20l30 35z" fill={frozen ? BORDER : c} />
          </g>
          {crack > 0 && (() => { const S = (d: string, len: number) => <path key={d} d={d} stroke={SILVER} strokeWidth={0.4} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - crack)} />;
            return [S("M 6.8 0.4 L 5.2 4 L 8.6 6.4 L 4.4 11 L 6.6 14.5 L 5.2 17", 28), S("M 5.2 4 L 1.6 3.2", 5), S("M 8.6 6.4 L 12.4 5.0", 5), S("M 4.4 11 L 1.0 12.4", 5), S("M 6.6 14.5 L 10.2 15.6", 5)]; })()}
        </g>
      </svg>
      {name && <div style={{ position: "absolute", left: `${x}%`, top: `${y + 10.5 * scale / 0.82}%`, transform: "translate(-50%,-50%)", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.2 * scale / 0.82, letterSpacing: "0.02em", color: frozen ? SILVER_MID : SILVER_SOFT, opacity: draw }}>{name}</div>}
    </>
  );
};

/* ---- PHOTO: frozen grey polaroid of static bars ---- */
export const PhotoCard: React.FC<{ u: number }> = ({ u }) => {
  const bars = [0.5, 0.78, 0.42, 0.66];
  return (
    <div style={{ background: PAPER, padding: `${u * 0.7}px ${u * 0.7}px ${u * 2.6}px`, borderRadius: u * 0.25, boxShadow: `0 ${u * 1.2}px ${u * 2.6}px rgba(0,0,0,0.55)`, transform: "rotate(-2.5deg)" }}>
      <div style={{ width: u * 17, height: u * 11.5, background: PANEL_RAISED, position: "relative", overflow: "hidden", filter: "saturate(0.25) brightness(0.82)", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: u * 0.9, padding: `0 ${u * 1.4}px ${u * 1.2}px` }}>
        {bars.map((h, i) => <div key={i} style={{ width: u * 2.1, height: `${h * 100}%`, background: SILVER_MID }} />)}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: u * 0.8, borderTop: `${u * 0.12}px solid ${BORDER}` }} />
      </div>
      <div style={{ marginTop: u * 0.7, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.85, letterSpacing: "0.08em", color: BODY, textAlign: "center" }}>MON · 10:04</div>
    </div>
  );
};

/* ---- MOVIE: scrolling filmstrip of bars growing over time ---- */
export const Filmstrip: React.FC<{ u: number; t: number }> = ({ u, t }) => {
  const FRAME_W = 6.6, GAP = 0.6, N = 10;
  const period = (FRAME_W + GAP) * u;
  const scroll = (t * u * 7) % period;
  return (
    <div style={{ position: "relative", width: u * 24, height: u * 14, background: WELL, border: `${u * 0.16}px solid ${LIME}`, borderRadius: u * 0.4, overflow: "hidden", boxShadow: `0 0 ${u * 2.6}px ${LIME}55` }}>
      {[0, 1].map((row) => (
        <div key={row} style={{ position: "absolute", left: -period, right: 0, [row ? "bottom" : "top"]: u * 0.35, height: u * 1.0, display: "flex", gap: u * 0.75, transform: `translateX(${-scroll}px)` }}>
          {Array.from({ length: 30 }).map((_, i) => <div key={i} style={{ width: u * 1.0, height: u * 1.0, background: PAPER, borderRadius: u * 0.15, flexShrink: 0 }} />)}
        </div>
      ))}
      <div style={{ position: "absolute", top: u * 1.9, bottom: u * 1.9, left: -period, display: "flex", gap: GAP * u, transform: `translateX(${-scroll}px)` }}>
        {Array.from({ length: N + 2 }).map((_, i) => {
          const g = 0.28 + ((i * 0.11) % 0.66);
          return (
            <div key={i} style={{ width: FRAME_W * u, height: "100%", background: PANEL, flexShrink: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: u * 0.35, padding: `0 ${u * 0.7}px ${u * 0.5}px` }}>
              {[g * 0.7, g, g * 0.85].map((h, j) => <div key={j} style={{ width: u * 1.0, height: `${Math.min(0.92, h) * 100}%`, background: LIME }} />)}
            </div>
          );
        })}
      </div>
      {/* edge mattes: keep scrolling lime bars from ever touching the lime border */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: u * 0.55, background: WELL }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: u * 0.55, background: WELL }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: u * 3.4, height: u * 3.4, borderRadius: "50%", background: "rgba(13,16,23,0.55)", border: `${u * 0.13}px solid ${SILVER}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 0, height: 0, borderTop: `${u * 0.85}px solid transparent`, borderBottom: `${u * 0.85}px solid transparent`, borderLeft: `${u * 1.3}px solid ${SILVER}`, marginLeft: u * 0.35 }} />
        </div>
      </div>
    </div>
  );
};


/* ---- light register: the silver worksheet page (System v1 light) ---- */
export const LightBg: React.FC<{ u: number; opacity?: number }> = ({ u, opacity = 1 }) => (
  <div style={{ position: "absolute", inset: 0, opacity, pointerEvents: "none" }}>
    <div style={{ position: "absolute", inset: 0, background: SILVER }} />
    <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${RAISIN}0d 1px,transparent 1px),linear-gradient(90deg,${RAISIN}0d 1px,transparent 1px)`, backgroundSize: `${u * 3.2}px ${u * 3.2}px`, maskImage: "radial-gradient(ellipse 82% 78% at 50% 50%, #000 42%, transparent 96%)", WebkitMaskImage: "radial-gradient(ellipse 82% 78% at 50% 50%, #000 42%, transparent 96%)" }} />
    <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 ${u * 12}px rgba(15,18,26,0.08)` }} />
  </div>
);

/* ---- background atmosphere for the dark register ---- */
export const DarkBg: React.FC<{ u: number; gridOpacity?: number }> = ({ u, gridOpacity = 1 }) => {
  const GRAIN = "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(#g)' opacity='0.5'/></svg>`);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 60% at 40% 46%, ${RAISIN_DEEP} 0%, ${RAISIN} 68%)` }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${SILVER}0a 1px,transparent 1px),linear-gradient(90deg,${SILVER}0a 1px,transparent 1px)`, backgroundSize: `${u * 3.4}px ${u * 3.4}px`, maskImage: "radial-gradient(ellipse 80% 70% at 42% 55%, #000 30%, transparent 85%)", WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 42% 55%, #000 30%, transparent 85%)", opacity: gridOpacity }} />
    </>
  );
};
export const GRAIN_URL = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(#g)' opacity='0.5'/></svg>`);

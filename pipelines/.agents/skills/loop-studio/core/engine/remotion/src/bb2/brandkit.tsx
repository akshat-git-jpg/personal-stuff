/**
 * brandkit.tsx — the shared house helpers for the personal-brand video set (intro / tutorial / outro).
 * Extracted verbatim from the finished BrandIntro so every part matches: the lime-offset Asset card,
 * the HL+Marker headline, the burned Cap, the Eyebrow, the LAND physics, and the SFX layer.
 * BrandIntro keeps its own copies (frozen at v19); NEW parts import from here so they can't drift.
 */
import React from "react";
import { Img, OffthreadVideo, staticFile, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp01, EASE, EASE_OVER, lerp, RAISIN, SILVER, SILVER_MID, BODY, LIME, SANS, MONO, type SK } from "./scene";

export const FPS = 30;
/** the video's accent. Intro = LIME (Luuk). The whole Nout section is MAGENTA — HIS brand. */
export const MAGENTA = "#FE019D";
export const ip = (t: number, a: number, b: number, ease = EASE) =>
  interpolate(t, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
export const land = (t: number, at: number) => ({
  p: ip(t, at, at + 0.22, EASE_OVER),
  flare: clamp01(1 - (t - at) / 0.1),
});

export const HL: React.FC<{ u: number; t: number; at: number; out?: number; ink: string; size?: number;
  top?: boolean; children: React.ReactNode }> = ({ u, t, at, out, ink, size = 2.9, top, children }) => (
  <div style={{
    position: "absolute", left: "50%", top: top ? "11%" : "88%", transform: "translate(-50%,-50%)",
    whiteSpace: "nowrap", textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: u * size,
    letterSpacing: "-0.02em", color: ink, textTransform: "uppercase",
    textShadow: ink === RAISIN ? "none" : "0 2px 18px rgba(0,0,0,0.55)",
    opacity: clamp01((t - at) / 0.4) * (out ? 1 - clamp01((t - out) / 0.4) : 1),
  }}>{children}</div>
);

export const Eyebrow: React.FC<{ u: number; t: number; at: number; ink: string; out?: number;
  x?: string; y?: string; accent?: string; children: React.ReactNode }> =
({ u, t, at, ink, out, x = "6%", y = "8.5%", accent = LIME, children }) => (
  <div style={{
    position: "absolute", left: x, top: y, display: "flex", alignItems: "center", gap: u * 0.6,
    opacity: clamp01((t - at) / 0.35) * (out ? 1 - clamp01((t - out) / 0.35) : 1),
    fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.22em",
    color: ink === RAISIN ? BODY : SILVER_MID,
  }}>
    <span style={{ width: u * 0.75, height: u * 0.75, background: accent }} />{children}
  </div>
);

export const Cap: React.FC<{ u: number; t: number; at: number; out: number; ink: string;
  pre: string; hot: string; post?: string; y?: string; accent?: string }> =
({ u, t, at, out, ink, pre, hot, post = "", y = "79%", accent = LIME }) => {
  const o = clamp01((t - at) / 0.18) * (1 - clamp01((t - out) / 0.18));
  if (o <= 0.01) return null;
  return (
    <div style={{
      position: "absolute", left: "50%", top: y, transform: "translate(-50%,-50%)",
      fontFamily: SANS, fontWeight: 700, fontSize: u * 1.62, letterSpacing: "-0.01em",
      color: ink, opacity: o, whiteSpace: "nowrap",
      textShadow: ink === RAISIN ? "none" : "0 2px 14px rgba(0,0,0,0.8)",
    }}>
      {pre}<span style={{ color: accent }}>{hot}</span>{post}
    </div>
  );
};

export const Asset: React.FC<{ x: number; y: number; u: number; w: number; ar: number; src: string;
  t: number; at: number; out?: number; rot?: number; grey?: number; dim?: number; scale?: number; dir?: string; accent?: string }> =
({ x, y, u, w, ar, src, t, at, out, rot = 0, grey = 0, dim = 0, scale = 1, dir = "brandoutro", accent = LIME }) => {
  const { p, flare } = land(t, at);
  const outP = out ? 1 - clamp01((t - out) / 0.2) : 1;
  if (p <= 0.001 || outP <= 0.001) return null;
  const W = u * w, H = W / ar;
  return (
    <div style={{
      position: "absolute", left: x + "%", top: y + "%",
      transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${(0.94 + 0.06 * p) * scale})`,
      opacity: p * (1 - dim) * outP,
    }}>
      <div style={{ position: "absolute", inset: 0, background: accent, borderRadius: u * 0.5, transform: `translate(${u * 0.35}px,${u * 0.35}px)`, opacity: 0.9 }} />
      <div style={{
        position: "relative", width: W, height: H, overflow: "hidden", borderRadius: u * 0.5,
        border: `${u * 0.1}px solid ${flare > 0.02 ? accent : SILVER_MID}`,
        boxShadow: `0 ${u * 0.45}px ${u * 1.2}px rgba(0,0,0,0.45)`,
      }}>
        <Img src={staticFile(`${dir}/${src}`)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: grey ? `saturate(${1 - grey})` : undefined }} />
      </div>
    </div>
  );
};

/** house SUBSCRIBE button — a lime pill with a cursor that clicks and flips to SUBSCRIBED */
export const SubscribeBtn: React.FC<{ u: number; t: number; at: number; x?: string; y?: string; accent?: string }> =
({ u, t, at, x = "50%", y = "62%", accent = LIME }) => {
  const p = ip(t, at, at + 0.3, EASE_OVER);
  if (p <= 0.01) return null;
  const clicked = t > at + 0.9;
  const cur = ip(t, at + 0.35, at + 0.85);          // cursor slides in to click
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) scale(${0.9 + 0.1 * p})`, opacity: p }}>
      <div style={{
        display: "flex", alignItems: "center", gap: u * 0.9, padding: `${u * 0.85}px ${u * 2.2}px`,
        background: clicked ? RAISIN : accent, border: `${u * 0.14}px solid ${accent}`, borderRadius: u * 0.7,
        boxShadow: `0 ${u * 0.5}px ${u * 1.4}px rgba(0,0,0,0.5)`,
        fontFamily: SANS, fontWeight: 800, fontSize: u * 1.7, letterSpacing: "0.02em",
        color: clicked ? accent : RAISIN, textTransform: "uppercase",
      }}>
        {clicked ? "✓ SUBSCRIBED" : "SUBSCRIBE"}
      </div>
      {/* cursor */}
      {!clicked && cur > 0.01 && (
        <svg viewBox="0 0 24 24" style={{ position: "absolute", left: `${60 - 30 * (1 - cur)}%`, top: "70%", width: u * 2.6, height: u * 2.6, filter: "drop-shadow(0 2px 3px rgba(0,0,0,.6))" }}>
          <path d="M4 2 L4 18 L8.5 13.5 L11.5 20 L14 19 L11 12.5 L17 12.5 Z" fill="#fff" stroke="#111" strokeWidth={1.2} />
        </svg>
      )}
    </div>
  );
};

/** MarkerC — the two-layer wipe, accent-parameterised (scene's Marker is lime-only). */
export const MarkerC: React.FC<{ children: React.ReactNode; u: number; t: number; at: number;
  base?: string; accent?: string }> = ({ children, u, t, at, base = SILVER, accent = LIME }) => {
  const p = clamp01((t - at) / 0.4);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ position: "relative", color: base }}>{children}</span>
      <span style={{ position: "absolute", inset: 0, clipPath: `inset(-12% ${(1 - p) * 104 - 2}% -8% -2%)` }}>
        <span style={{ position: "absolute", left: -u * 0.35, right: -u * 0.35, top: "-6%", bottom: "-2%", background: accent, transform: "rotate(-1.2deg)" }} />
        <span style={{ position: "relative", color: RAISIN, textShadow: "none" }}>{children}</span>
      </span>
    </span>
  );
};

/** FootageC — the head panel, accent-parameterised (copy of scene FootageLayer, magenta-ready). */
export const FootageC: React.FC<{ sk: SK; u: number; src: string; accent?: string }> = ({ sk, u, src, accent = LIME }) => {
  const { width: W, height: H, fps } = useVideoConfig();
  useCurrentFrame(); useVideoConfig(); void fps;
  const fr = clamp01(sk.fr);
  const panelW = W * 0.4 * sk.s, panelH = panelW * 9 / 16;
  const w = lerp(W, panelW, fr), h = lerp(H, panelH, fr);
  const cx = lerp(50, sk.x, fr), cy = lerp(50, sk.y, fr);
  const bright = 1 - sk.dim;
  if (bright <= 0.02 && fr > 0.99) return null;
  return (
    <div style={{ position: "absolute", left: cx + "%", top: cy + "%", transform: "translate(-50%,-50%)", pointerEvents: "none", opacity: clamp01(bright * 1.5) }}>
      <div style={{ position: "absolute", inset: -h * 0.25, background: `radial-gradient(ellipse, ${accent}18 0%, transparent 68%)`, opacity: fr * bright }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, background: accent, borderRadius: u * 0.5 * fr, transform: `translate(${u * 0.35 * fr}px,${u * 0.35 * fr}px)`, opacity: (0.9 * bright + 0.25) * fr }} />
      <div style={{ position: "relative", width: w, height: h, borderRadius: u * 0.5 * fr, overflow: "hidden", border: `${u * 0.1 * fr}px solid ${SILVER}`, boxShadow: `0 ${u * 0.45 * fr}px ${u * 1.2 * fr}px rgba(0,0,0,0.45)` }}>
        <OffthreadVideo src={staticFile(src)} muted style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 28%", filter: `brightness(${0.55 + 0.45 * bright}) contrast(1.04) saturate(1.03)` }} />
        <div style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 ${u * 3}px rgba(0,0,0,0.4)` }} />
      </div>
    </div>
  );
};

/** SiteScroll — a real website scrolling inside a browser-chrome card (a live screen-recording feel). */
export const SiteScroll: React.FC<{ u: number; t: number; at: number; src: string; dir: string;
  x: number; y: number; w: number; imgAr: number; accent?: string; scrollFrom?: number; scrollDur?: number }> =
({ u, t, at, src, dir, x, y, w, imgAr, accent = LIME, scrollFrom = 0.5, scrollDur = 4.5 }) => {
  const inP = ip(t, at, at + 0.3, EASE_OVER);
  if (inP <= 0.01) return null;
  const cardW = u * w, cardH = cardW * 9 / 16;                 // the browser window is 16:9
  const barH = u * 1.6;                                        // chrome bar
  const viewH = cardH - barH;
  const imgH = cardW / imgAr;                                  // full page height at card width
  const maxScroll = Math.max(0, imgH - viewH);
  const sc = ip(t, at + scrollFrom, at + scrollFrom + scrollDur);
  const off = -sc * maxScroll;
  return (
    <div style={{ position: "absolute", left: x + "%", top: y + "%", transform: `translate(-50%,-50%) scale(${0.94 + 0.06 * inP})`, opacity: inP }}>
      <div style={{ position: "absolute", inset: 0, background: accent, borderRadius: u * 0.6, transform: `translate(${u * 0.35}px,${u * 0.35}px)`, opacity: 0.9 }} />
      <div style={{ position: "relative", width: cardW, height: cardH, borderRadius: u * 0.6, overflow: "hidden", border: `${u * 0.1}px solid ${accent}`, boxShadow: `0 ${u * 0.6}px ${u * 1.6}px rgba(0,0,0,0.55)` }}>
        {/* browser chrome bar */}
        <div style={{ height: barH, background: "#1b2030", display: "flex", alignItems: "center", gap: u * 0.4, padding: `0 ${u * 0.8}px` }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => <div key={c} style={{ width: u * 0.4, height: u * 0.4, borderRadius: "50%", background: c }} />)}
          <div style={{ marginLeft: u * 0.6, flex: 1, height: barH * 0.5, borderRadius: barH, background: "#0f1219", color: "#8892a6", fontFamily: MONO, fontSize: u * 0.7, display: "flex", alignItems: "center", paddingLeft: u * 0.8, letterSpacing: "0.04em" }}>noutalleman.com</div>
        </div>
        <div style={{ position: "relative", width: "100%", height: viewH, overflow: "hidden", background: "#fff" }}>
          <Img src={staticFile(`${dir}/${src}`)} style={{ position: "absolute", left: 0, top: off, width: "100%", height: imgH, display: "block" }} />
        </div>
      </div>
    </div>
  );
};

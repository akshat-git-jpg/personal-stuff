/**
 * Brand.tsx — BuildLoop System v1 shared primitives for the Business Brain film.
 * The whole film is one silver graph-paper "worksheet world". Every board is built from these.
 * Extracted from the approved BrandBoard.tsx look. LOCKED palette raisin+silver+lime, no cream/navy.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { SANS, MONO, SERIF, RAISIN, SILVER, SILVER_SOFT, BODY, LIME, WHITE } from "./brandfonts";

export { SANS, MONO, SERIF, RAISIN, SILVER, SILVER_SOFT, BODY, LIME, WHITE };
export const FPS = 30;
export const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
export const EASE_DRAW = Easing.bezier(0.6, 0, 0.35, 1);
export const f = (s: number) => Math.round(s * FPS);

export const useU = () => useVideoConfig().width / 100;
export const useFade = () => {
  const frame = useCurrentFrame();
  return (a: number, b: number) => interpolate(frame, [f(a), f(b)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
};

const GRAIN = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='200' height='200' filter='url(#g)' opacity='0.5'/></svg>`);

/** The page: silver canvas + faded draftsman grid + grain + a soft vignette, with a fast open-wipe. */
export const Page: React.FC<{ children: React.ReactNode; wipe?: boolean }> = ({ children, wipe = true }) => {
  const u = useU();
  const frame = useCurrentFrame();
  const open = wipe ? interpolate(frame, [0, f(0.5)], [1, 0], { extrapolateRight: "clamp" }) : 0;
  return (
    <AbsoluteFill style={{ background: SILVER, fontFamily: SANS }}>
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${RAISIN}0d 1px,transparent 1px),linear-gradient(90deg,${RAISIN}0d 1px,transparent 1px)`, backgroundSize: `${u * 3.2}px ${u * 3.2}px`, maskImage: "radial-gradient(ellipse 82% 78% at 50% 50%, #000 42%, transparent 96%)", WebkitMaskImage: "radial-gradient(ellipse 82% 78% at 50% 50%, #000 42%, transparent 96%)" }} />
      <AbsoluteFill style={{ backgroundImage: `url("${GRAIN}")`, backgroundSize: `${u * 9}px`, mixBlendMode: "multiply", opacity: 0.04 }} />
      {children}
      <AbsoluteFill style={{ pointerEvents: "none", boxShadow: `inset 0 0 ${u * 12}px rgba(15,18,26,0.08)` }} />
      {wipe && <AbsoluteFill style={{ background: SILVER, opacity: open, pointerEvents: "none" }} />}
    </AbsoluteFill>
  );
};

/** A draw-on ink stroke (SVG dash animation). Times are in seconds, local to the sequence. */
export const Draw: React.FC<{ d: string; at: number; dur: number; w: number; color?: string; len?: number; cap?: "round" | "butt" }> = ({ d, at, dur, w, color = RAISIN, len = 2600, cap = "round" }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [f(at), f(at + dur)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_DRAW });
  return <path d={d} stroke={color} strokeWidth={w} fill="none" strokeLinecap={cap} strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} />;
};

/** Full-frame SVG layer in page units (100 wide x 56.25 tall for 16:9). Children draw in unit coords via the `u` scale. */
export const InkLayer: React.FC<{ children: React.ReactNode; opacity?: number }> = ({ children, opacity = 1 }) => {
  const { width: W, height: H } = useVideoConfig();
  return <svg width={W} height={H} viewBox={`0 0 100 56.25`} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity }}>{children}</svg>;
};

/** Hard lime-offset card — the brand's signature move. off/pad are in px (use u*n). */
export const Offset: React.FC<{ children: React.ReactNode; u: number; radius?: number; off?: number; bg?: string; border?: string; pad?: string; borderW?: number }> = ({ children, u, radius = 12, off = 7, bg = WHITE, border = RAISIN, pad, borderW }) => (
  <div style={{ position: "relative", display: "inline-block" }}>
    <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: radius, transform: `translate(${off}px,${off}px)` }} />
    <div style={{ position: "relative", background: bg, border: `${borderW ?? u * 0.14}px solid ${border}`, borderRadius: radius, padding: pad }}>{children}</div>
  </div>
);

/** Number badge: raisin tile + lime italic numeral (worksheet FIG numbering). */
export const NumBadge: React.FC<{ n: string; u: number; delay?: number }> = ({ n, u, delay = 0 }) => {
  const fade = useFade();
  return (
    <div style={{ opacity: fade(delay, delay + 0.4) }}>
      <Offset u={u} radius={0} off={5} bg={RAISIN} border={RAISIN} pad={`${u * 0.5}px ${u * 1.15}px`}>
        <span style={{ fontFamily: SANS, fontWeight: 900, fontStyle: "italic", fontSize: u * 1.8, color: LIME }}>{n}</span>
      </Offset>
    </div>
  );
};

/** Mono eyebrow with a lime square bullet. */
export const MonoEyebrow: React.FC<{ text: string; u: number; delay?: number; color?: string }> = ({ text, u, delay = 0, color = BODY }) => {
  const fade = useFade();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: u * 0.8, opacity: fade(delay, delay + 0.4) }}>
      <span style={{ width: u * 0.85, height: u * 0.85, background: LIME }} />
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.22em", color }}>{text}</span>
    </span>
  );
};

/** A headline word wrapped in a lime marker that sweeps in behind it. */
export const Marker: React.FC<{ children: React.ReactNode; u: number; at?: number; dur?: number }> = ({ children, u, at = 1.1, dur = 0.6 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [f(at), f(at + dur)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span style={{ position: "absolute", left: -u * 0.5, right: -u * 0.5, top: "16%", bottom: "12%", background: LIME, transform: `scaleX(${p}) rotate(-1.5deg)`, transformOrigin: "left center", zIndex: 0 }} />
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  );
};

/** UPPERCASE Space Grotesk headline with an optional lime marker on markerWord. Stacks long headlines. */
export const Headline: React.FC<{ text: string; markerWord?: string; u: number; size?: number; delay?: number; color?: string; align?: "left" | "center" }> = ({ text, markerWord, u, size = 6.2, delay = 0.2, color = RAISIN, align = "left" }) => {
  const fade = useFade();
  const words = text.split(" ");
  const mw = markerWord ? markerWord.replace(/[.,?!]/g, "").toLowerCase() : "";
  const firstMarkIdx = mw ? words.findIndex((w) => w.replace(/[.,?!]/g, "").toLowerCase() === mw) : -1;
  return (
    <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * size, letterSpacing: "-0.03em", color, lineHeight: 0.98, textTransform: "uppercase", opacity: fade(delay, delay + 0.6), textAlign: align }}>
      {words.map((w, i) => {
        const isMark = i === firstMarkIdx;
        return (
          <React.Fragment key={i}>
            {isMark ? <Marker u={u} at={delay + 0.9}>{w}</Marker> : w}
            {i < words.length - 1 ? " " : ""}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/** Playfair italic counterpoint line. */
export const Counterpoint: React.FC<{ text: string; u: number; delay?: number; size?: number; color?: string; align?: "left" | "center" }> = ({ text, u, delay = 1.4, size = 2.2, color = BODY, align = "left" }) => {
  const fade = useFade();
  return <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: u * size, color, opacity: fade(delay, delay + 0.6), textAlign: align }}>{text}</div>;
};

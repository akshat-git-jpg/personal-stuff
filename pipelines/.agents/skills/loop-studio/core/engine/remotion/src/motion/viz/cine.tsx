import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { EASE, clamp, LIME, breath } from "../kit";

/**
 * Cinematic motion for OVERLAY elements. Overlays can't use the camera rig (the
 * footage is underneath), so the cinematic feel comes from the element: a
 * motion-blur + rise + scale entrance that settles on the brand EASE, HOLDS
 * rock-steady (settle-and-hold), then LEAVES with a blur-drift exit — same law
 * as full-screen takeovers. Plus a breathing radial-bloom glow.
 */

/** blur + rise + scale entrance → settle → hold → (optional) blur-drift exit.
    Pass `dur` (the scene length, from useVideoConfig) to enable the exit. */
export function cineReveal(
  frame: number, start: number, len = 15, rise = 32, dur?: number, exitLen = 12,
): React.CSSProperties {
  const p = interpolate(frame, [start, start + len], [0, 1], {
    easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  // exit: last `exitLen` frames drift up + blur + soften (0 when no dur given)
  const q = dur ? clamp((frame - (dur - exitLen)) / exitLen, 0, 1) : 0;
  const ry = (1 - p) * rise - q * 22;
  const sc = (0.94 + p * 0.06) * (1 - q * 0.04);
  const bl = Math.max((1 - p) * 7, q * 7);
  return {
    opacity: clamp(p * 1.5, 0, 1) * (1 - q * 0.9),
    transform: `translateY(${ry}px) scale(${sc})`,
    filter: bl > 0.15 ? `blur(${bl}px)` : undefined,
    willChange: "transform, filter, opacity",
  };
}

/** radial bloom behind a lime element (never a text-shadow box → hard halo).
    Breathes slowly during the hold so overlays feel alive, not frozen. */
export const Glow: React.FC<{ p?: number; color?: string; spread?: number; children: React.ReactNode }> = ({
  p = 1, color = LIME, spread = 90, children,
}) => {
  const frame = useCurrentFrame();
  const b = breath(frame, 70, 0.12); // glow-only breath — no text geometry moves
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span
        aria-hidden
        style={{
          position: "absolute", inset: -spread,
          background: `radial-gradient(closest-side, ${color}4d, transparent 72%)`,
          opacity: clamp(p, 0, 1) * 0.95 * b, filter: "blur(6px)",
          transform: `scale(${b})`, zIndex: 0,
        }}
      />
      <span style={{ position: "relative", zIndex: 1 }}>{children}</span>
    </span>
  );
};

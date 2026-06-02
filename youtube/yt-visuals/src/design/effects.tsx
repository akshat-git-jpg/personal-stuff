// Shared motion effects — used by section dividers and title cards.
// All driven by useCurrentFrame() so they render frame-deterministic.

import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { colors } from "./theme";

// =============================================================================
// Light streaks — short bright lines that fly across during the entrance window.
// =============================================================================
export const Streaks: React.FC<{ delay?: number; streaks?: number }> = ({
  delay = 0,
  streaks = 3,
}) => {
  const frame = useCurrentFrame();
  const defs = [
    { y: 280, len: 380, angle: -8, off: 4, color: colors.accentSolid },
    { y: 520, len: 460, angle: 6, off: 10, color: "#ffffff" },
    { y: 760, len: 320, angle: -10, off: 16, color: colors.accentSolid },
    { y: 140, len: 300, angle: 4, off: 22, color: "#ffffff" },
    { y: 900, len: 400, angle: -6, off: 28, color: colors.accentSolid },
  ].slice(0, streaks);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {defs.map((s, i) => {
        const progress = interpolate(frame - delay - s.off, [0, 28], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        });
        const x = interpolate(progress, [0, 1], [-500, 2200]);
        const opacity = interpolate(progress, [0, 0.4, 1], [0, 1, 0]);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: s.y,
              left: x,
              width: s.len,
              height: 2,
              background: `linear-gradient(90deg, transparent, ${s.color}, transparent)`,
              transform: `rotate(${s.angle}deg)`,
              opacity,
              filter: "blur(0.5px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// =============================================================================
// Particles — drifting points of light. Each loops independently.
// =============================================================================
const PARTICLES = Array.from({ length: 22 }).map((_, i) => {
  const h = (i * 9301 + 49297) % 233280;
  const r = h / 233280;
  return {
    startX: r * 1920,
    startY: ((h * 7) % 233280) / 233280 * 1080,
    drift: 80 + (((h * 11) % 233280) / 233280) * 180,
    size: 2 + (((h * 13) % 233280) / 233280) * 5,
    glow: ((h * 17) % 233280) / 233280 > 0.5 ? colors.accentSolid : "#ffffff",
    duration: 70 + (((h * 19) % 233280) / 233280) * 80,
    delay: (((h * 23) % 233280) / 233280) * 40,
  };
});

export const Particles: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {PARTICLES.map((p, i) => {
        const t = (((frame - p.delay) % p.duration) + p.duration) / p.duration;
        const tNorm = t % 1;
        const y = p.startY - tNorm * p.drift;
        const opacity = Math.sin(tNorm * Math.PI) * 0.6;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: p.startX,
              top: y,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: p.glow,
              boxShadow: `0 0 ${p.size * 3}px ${p.glow}`,
              opacity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// =============================================================================
// Aurora blobs — large soft color clouds that drift slowly (continuous).
// =============================================================================
export const AuroraBlobs: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps; // seconds

  // Warm-palette-friendly aurora: amber + ember + faint gold drift.
  const blobs = [
    {
      baseX: 300,
      baseY: 200,
      ampX: 80,
      ampY: 40,
      phase: 0,
      color: colors.accentFrom,   // bright orange
      size: 600,
      opacity: 0.28,
    },
    {
      baseX: 1600,
      baseY: 800,
      ampX: 100,
      ampY: 60,
      phase: 1.2,
      color: colors.win,          // gold
      size: 560,
      opacity: 0.18,
    },
    {
      baseX: 1200,
      baseY: 400,
      ampX: 140,
      ampY: 70,
      phase: 2.4,
      color: colors.accentTo,     // burnt orange
      size: 520,
      opacity: 0.22,
    },
  ];

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {blobs.map((b, i) => {
        const x = b.baseX + Math.sin(t * 0.3 + b.phase) * b.ampX;
        const y = b.baseY + Math.cos(t * 0.25 + b.phase) * b.ampY;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - b.size / 2,
              top: y - b.size / 2,
              width: b.size,
              height: b.size,
              background: `radial-gradient(circle, ${b.color} 0%, transparent 60%)`,
              opacity: b.opacity,
              filter: "blur(60px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// =============================================================================
// Lens vignette — subtle darkening at the edges. Pulls focus to center.
// =============================================================================
export const LensVignette: React.FC<{ strength?: number }> = ({ strength = 0.5 }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,${strength}) 100%)`,
    }}
  />
);

// =============================================================================
// Breathing gradient — the base ApplePro radial gradient slowly scaling/shifting.
// Use INSTEAD of ApplePro background for variants that want continuous BG motion.
// =============================================================================
export const BreathingBackdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // Gentle scale up/down over ~8s cycle
  const scale = 1 + Math.sin(t * 0.4) * 0.06;
  const posX = 30 + Math.sin(t * 0.25) * 8; // %
  const posY = 20 + Math.cos(t * 0.3) * 6; // %
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at ${posX}% ${posY}%, ${colors.bgGradientFrom} 0%, ${colors.bgGradientTo} 60%)`,
        transform: `scale(${scale})`,
        transformOrigin: "center",
      }}
    />
  );
};

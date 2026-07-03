// Three motion-heavy TitleCard variants for side-by-side comparison.
// Layout (heading + 6+6+3 chip grid) is identical across all three —
// what changes is the motion treatment of the background, title, and chips.

import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ApplePro, SlideFrame } from "../design/primitives";
import { colors, motion, spacing, type } from "../design/theme";
import { fontFamily } from "../design/font";
import { AuroraBlobs, BreathingBackdrop, LensVignette, Particles, Streaks } from "../design/effects";
import type { TitleData } from "../schema";

const CHIP_SIZE = 220;
const LOGO_INSET = 26;

// Common chip — the visual stays identical across variants; only the motion
// wrapping it changes.
const Chip: React.FC<{ name: string; icon?: string; style?: React.CSSProperties }> = ({
  name,
  icon,
  style,
}) => {
  const base: React.CSSProperties = {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    borderRadius: 36,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: LOGO_INSET,
    flexShrink: 0,
    boxShadow: "0 0 40px rgba(255,255,255,0.10)",
    ...style,
  };
  if (icon) {
    return (
      <div style={base}>
        <Img
          src={staticFile(icon)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        ...base,
        padding: "0 48px",
        width: "auto",
        fontSize: 36,
        fontWeight: 700,
        color: "#0a0805",
      }}
    >
      {name}
    </div>
  );
};

// =============================================================================
// A. Storm + Spring Pop  (matches section D — consistent video identity)
// =============================================================================
export const TitleCardA: React.FC<TitleData> = ({ title, platforms }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title: elastic spring with overshoot
  const titleSpring = spring({
    frame: frame - 4,
    fps,
    config: { damping: 10, stiffness: 100, mass: 0.6 },
  });
  const titleScale = interpolate(titleSpring, [0, 1], [1.18, 1]);
  const titleOpacity = interpolate(titleSpring, [0, 0.3, 1], [0, 0.6, 1]);

  return (
    <ApplePro>
      <Streaks delay={6} streaks={4} />
      <Particles />
      <SlideFrame>
        <div
          style={{
            fontFamily,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: spacing.blockGap,
            maxWidth: 1700,
            width: "100%",
          }}
        >
          <div
            style={{
              ...type.title,
              color: colors.textPrimary,
              margin: 0,
              lineHeight: 1.04,
              textAlign: "center",
              transform: `scale(${titleScale})`,
              opacity: titleOpacity,
              textShadow: `0 0 32px rgba(167,139,250,0.35)`,
            }}
          >
            {title}
          </div>

          {platforms && platforms.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                rowGap: 32,
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: 8,
              }}
            >
              {platforms.map((p, i) => {
                const chipSpring = spring({
                  frame: frame - (28 + i * 4),
                  fps,
                  config: { damping: 11, stiffness: 110, mass: 0.5 },
                });
                const scale = interpolate(chipSpring, [0, 1], [0.6, 1]);
                const opacity = interpolate(chipSpring, [0, 0.4, 1], [0, 0.7, 1]);
                return (
                  <div key={i} style={{ transform: `scale(${scale})`, opacity }}>
                    <Chip name={p.name} icon={p.icon} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SlideFrame>
    </ApplePro>
  );
};

// =============================================================================
// B. Aurora Flow + Wave Reveal
//    Continuously drifting aurora + a vertical light bar that wipes the chips
//    in left-to-right as it passes their X position.
// =============================================================================
export const TitleCardB: React.FC<TitleData> = ({ title, platforms }) => {
  const frame = useCurrentFrame();

  // Light bar sweep: starts at x=-200, ends at x=2200 over a fixed window.
  const SWEEP_START = 24;
  const SWEEP_END = 80;
  const sweepProgress = interpolate(frame, [SWEEP_START, SWEEP_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });
  const barX = interpolate(sweepProgress, [0, 1], [-200, 2200]);

  // Title gradient shimmer cycles continuously
  const shimmer = (frame / 30) * Math.PI;
  const shimmerProgress = (Math.sin(shimmer) + 1) / 2;

  // Estimate each chip's centerX so we can reveal it as the bar passes.
  // Chips wrap at 6 per row (with our 220px chip + 28px gap inside 1640px usable).
  const chipPositions: number[] = [];
  if (platforms) {
    const PER_ROW = 6;
    const CHIP_W = 220 + 28;
    for (let i = 0; i < platforms.length; i++) {
      const row = Math.floor(i / PER_ROW);
      const col = i % PER_ROW;
      const rowCount = Math.min(PER_ROW, platforms.length - row * PER_ROW);
      const rowWidth = rowCount * CHIP_W - 28;
      const xStart = 960 - rowWidth / 2;
      chipPositions.push(xStart + col * CHIP_W + 110); // center of chip
    }
  }

  return (
    <ApplePro>
      <AuroraBlobs />
      <SlideFrame>
        <div
          style={{
            fontFamily,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: spacing.blockGap,
            maxWidth: 1700,
            width: "100%",
          }}
        >
          {/* Title: appears immediately, gradient shimmer cycles on first word */}
          <div
            style={{
              ...type.title,
              margin: 0,
              lineHeight: 1.04,
              textAlign: "center",
              opacity: interpolate(frame, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              transform: `translateY(${interpolate(frame, [0, 18], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
            }}
          >
            <span
              style={{
                background: `linear-gradient(${90 + shimmerProgress * 60}deg, ${colors.accentFrom} 0%, #ffffff 50%, ${colors.accentTo} 100%)`,
                backgroundSize: "200% 100%",
                backgroundPosition: `${shimmerProgress * 100}% 0%`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: colors.textPrimary,
              }}
            >
              {title}
            </span>
          </div>

          {platforms && platforms.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                rowGap: 32,
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: 8,
                position: "relative",
              }}
            >
              {platforms.map((p, i) => {
                // Reveal chip when the bar has passed its centerX.
                const cx = chipPositions[i] ?? 0;
                const distFromBar = barX - cx;
                const reveal = interpolate(distFromBar, [-100, 100], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                return (
                  <div
                    key={i}
                    style={{
                      transform: `scale(${interpolate(reveal, [0, 1], [0.85, 1])})`,
                      opacity: reveal,
                    }}
                  >
                    <Chip name={p.name} icon={p.icon} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SlideFrame>
      {/* Light bar — sweeps across, glowing */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: barX,
            width: 8,
            background: `linear-gradient(180deg, transparent 0%, ${colors.accentSolid} 40%, #ffffff 50%, ${colors.accentSolid} 60%, transparent 100%)`,
            boxShadow: `0 0 80px ${colors.accentSolid}, 0 0 40px #ffffff`,
            opacity: interpolate(sweepProgress, [0, 0.05, 0.95, 1], [0, 1, 1, 0]),
          }}
        />
      </AbsoluteFill>
    </ApplePro>
  );
};

// =============================================================================
// C. Cinematic Camera + Floating Chips
//    Breathing background, title scales in with depth shadow,
//    chips continuously bob at offset phases. Lens vignette adds focus.
// =============================================================================
export const TitleCardC: React.FC<TitleData> = ({ title, platforms }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Title entrance: scale-in from 0.92 → 1 with eased fade
  const titleProgress = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const titleScale = interpolate(titleProgress, [0, 1], [0.92, 1]);

  return (
    <>
      <BreathingBackdrop />
      <LensVignette strength={0.45} />
      <SlideFrame>
        <div
          style={{
            fontFamily,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: spacing.blockGap,
            maxWidth: 1700,
            width: "100%",
          }}
        >
          <div
            style={{
              ...type.title,
              color: colors.textPrimary,
              margin: 0,
              lineHeight: 1.04,
              textAlign: "center",
              transform: `scale(${titleScale})`,
              opacity: titleProgress,
              textShadow: `0 12px 40px rgba(167,139,250,${0.18 + Math.sin(t * 0.6) * 0.12}), 0 0 16px rgba(255,255,255,0.08)`,
            }}
          >
            {title}
          </div>

          {platforms && platforms.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                rowGap: 32,
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: 8,
              }}
            >
              {platforms.map((p, i) => {
                // Cascade entrance
                const entrance = interpolate(
                  frame - (motion.staggerFrames * 3 + i * 3),
                  [0, 24],
                  [0, 1],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                  },
                );
                // Continuous bob — each chip at a different phase
                const phase = (i * 0.55) % (Math.PI * 2);
                const bobY = Math.sin(t * 1.1 + phase) * 5;
                const bobScale = 1 + Math.sin(t * 0.9 + phase) * 0.01;
                const entryY = interpolate(entrance, [0, 1], [22, 0]);
                return (
                  <div
                    key={i}
                    style={{
                      transform: `translateY(${entryY + bobY}px) scale(${bobScale})`,
                      opacity: entrance,
                    }}
                  >
                    <Chip name={p.name} icon={p.icon} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SlideFrame>
    </>
  );
};

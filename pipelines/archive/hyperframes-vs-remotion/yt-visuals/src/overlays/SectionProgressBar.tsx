// Thin top-bar overlay: "SECTION 02 / 05 · HOSTINGER" + animated progress fill.
// Rendered with alpha channel (transparent background) so the editor can place
// it on top of a screen recording in their NLE.

import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { colors, fonts } from "../design/theme";

export type SectionProgressBarProps = {
  sectionNumber: number;   // 1-indexed
  totalSections: number;
  platformName: string;
};

const BAR_HEIGHT = 72;
const PROGRESS_HEIGHT = 4;
const PAD_X = 64;

export const SectionProgressBar: React.FC<SectionProgressBarProps> = ({
  sectionNumber,
  totalSections,
  platformName,
}) => {
  const frame = useCurrentFrame();

  // Entry: slide down from above + fade in (0–15f, ~0.5s)
  const entry = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const yOffset = (1 - entry) * -(BAR_HEIGHT + 16);

  // Progress fill: sweeps from 0% to target after entry settles (15–45f, ~1s)
  const fillTarget = sectionNumber / totalSections;
  const fillProgress = interpolate(frame, [15, 45], [0, fillTarget], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Idle glow: subtle pulse on the progress fill once it settles
  const glowMix = frame > 45 ? (Math.sin((frame - 45) * 0.08) + 1) / 2 : 0;
  const glowRadius = 8 + glowMix * 10;

  // Zero-pad numbers: "02 / 05"
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: BAR_HEIGHT,
          transform: `translateY(${yOffset}px)`,
          opacity: entry,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: `0 ${PAD_X}px`,
          background:
            "linear-gradient(to bottom, rgba(10, 8, 5, 0.92), rgba(10, 8, 5, 0.72))",
          borderBottom: `1px solid ${colors.divider}`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          fontFamily: fonts.family,
        }}
      >
        {/* Top progress fill */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: PROGRESS_HEIGHT,
            width: `${fillProgress * 100}%`,
            background: `linear-gradient(90deg, ${colors.accentFrom}, ${colors.win})`,
            boxShadow: `0 0 ${glowRadius}px ${colors.accentGlow}`,
            transformOrigin: "left center",
          }}
        />

        {/* Left: section indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: colors.textSecondary,
            ...fonts.tabular,
          }}
        >
          <span>Section</span>
          <span style={{ color: colors.accentSolid, fontWeight: 700 }}>
            {pad(sectionNumber)}
          </span>
          <span style={{ color: colors.textDim }}>/</span>
          <span>{pad(totalSections)}</span>
        </div>

        {/* Right: current platform */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          {/* small pulsing dot */}
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: colors.accentSolid,
              boxShadow: `0 0 ${6 + glowMix * 6}px ${colors.accentSolid}`,
            }}
          />
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: -0.3,
              color: colors.textPrimary,
              textTransform: "uppercase",
            }}
          >
            {platformName}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

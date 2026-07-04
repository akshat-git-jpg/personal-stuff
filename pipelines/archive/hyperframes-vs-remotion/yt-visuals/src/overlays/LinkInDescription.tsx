// Mid-frame centered pill that nudges viewers to the description.
// Self-contained lifecycle: slides up + fades in → holds with subtle glow
// breathing → fades out + slides down slightly. ~4s total.

import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fonts } from "../design/theme";

export type LinkInDescriptionProps = {
  message?: string; // default: "Link in description"
};

export const LinkInDescription: React.FC<LinkInDescriptionProps> = ({
  message = "Link in description",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Entry: 0–15f — fade in, slide up from below, scale up slightly.
  const enter = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Exit: last 15f — fade out + slight slide down.
  const exit = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.4, 0, 1, 1),
    },
  );

  const opacity = Math.min(enter, exit);
  const enterY = (1 - enter) * 22;       // slide up 22px
  const exitY = (1 - exit) * 10;         // slide down 10px on exit
  const scale = 0.94 + enter * 0.06;     // 0.94 → 1.0

  // Subtle border-glow breathing during hold.
  const glow = (Math.sin(frame * 0.06) + 1) / 2; // 0..1
  const glowOpacity = 0.22 + glow * 0.15;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "70%",
          display: "flex",
          justifyContent: "center",
          fontFamily: fonts.family,
        }}
      >
        <div
          style={{
            opacity,
            transform: `translateY(${enterY + exitY}px) scale(${scale})`,
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: "22px 40px",
            background:
              "linear-gradient(180deg, rgba(20, 12, 4, 0.94), rgba(10, 6, 2, 0.90))",
            border: `1.5px solid rgba(251, 146, 60, ${0.5 + glow * 0.25})`,
            borderRadius: 999,
            boxShadow: `0 0 ${28 + glow * 14}px rgba(251, 146, 60, ${glowOpacity}), 0 8px 28px rgba(0,0,0,0.55)`,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 4 L12 18 M6 13 L12 19 L18 13"
              stroke={colors.accentSolid}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: 0.3,
              color: colors.textPrimary,
              whiteSpace: "nowrap",
            }}
          >
            {message}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

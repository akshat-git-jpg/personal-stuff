import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ApplePro, Eyebrow, FadeSlideIn, SlideFrame } from "../design/primitives";
import { colors, motion, spacing } from "../design/theme";
import { fontFamily } from "../design/font";
import type { VerdictData } from "../schema";

export const Verdict: React.FC<VerdictData> = ({ eyebrow, winner, reason }) => {
  const frame = useCurrentFrame();
  // A slow-breathing glow behind the winner name. Subtle, not distracting.
  const glowPulse = interpolate(
    Math.sin((frame / 30) * Math.PI * 0.5),
    [-1, 1],
    [0.45, 0.75],
  );
  return (
    <ApplePro>
      {/* Soft radial glow that pulses behind the winner */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 45%, ${colors.accentGlow} 0%, transparent 45%)`,
          opacity: glowPulse,
        }}
      />
      <SlideFrame>
        <div
          style={{
            fontFamily,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: spacing.itemGap,
            maxWidth: 1400,
            textAlign: "center",
          }}
        >
          <Eyebrow delay={0}>{eyebrow}</Eyebrow>
          <FadeSlideIn delay={motion.staggerFrames * 3} yOffset={32}>
            <div
              style={{
                fontSize: 168,
                fontWeight: 700,
                letterSpacing: -5,
                lineHeight: 1.02,
                background: `linear-gradient(135deg, ${colors.accentFrom} 0%, ${colors.textPrimary} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                color: colors.textPrimary,
              }}
            >
              {winner}
            </div>
          </FadeSlideIn>
          {reason && (
            <FadeSlideIn delay={motion.staggerFrames * 6} yOffset={16}>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 400,
                  color: colors.textSecondary,
                  maxWidth: 1000,
                  lineHeight: 1.35,
                  marginTop: 14,
                }}
              >
                {reason}
              </div>
            </FadeSlideIn>
          )}
        </div>
      </SlideFrame>
    </ApplePro>
  );
};

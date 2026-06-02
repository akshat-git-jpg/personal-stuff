import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { ApplePro, Eyebrow, FadeSlideIn, SlideFrame } from "../design/primitives";
import { colors, motion, spacing } from "../design/theme";
import { fontFamily } from "../design/font";
import type { CtaData } from "../schema";

export const CtaDiscount: React.FC<CtaData> = ({ eyebrow, code, discount, cta }) => {
  const frame = useCurrentFrame();
  // A slow bobbing arrow that draws the eye to the description.
  const bob = interpolate(
    Math.sin((frame / 30) * Math.PI * 1.0),
    [-1, 1],
    [-8, 8],
  );

  return (
    <ApplePro>
      <SlideFrame>
        <div
          style={{
            fontFamily,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: spacing.itemGap,
            textAlign: "center",
          }}
        >
          {discount && (
            <FadeSlideIn delay={0} yOffset={8}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  color: colors.textTertiary,
                  letterSpacing: 0.4,
                }}
              >
                {discount}
              </div>
            </FadeSlideIn>
          )}

          <Eyebrow delay={motion.staggerFrames * 2}>{eyebrow}</Eyebrow>

          <FadeSlideIn delay={motion.staggerFrames * 4} yOffset={28}>
            <div
              style={{
                fontSize: 200,
                fontWeight: 700,
                letterSpacing: 12,
                background: `linear-gradient(135deg, ${colors.accentFrom} 0%, ${colors.accentTo} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                lineHeight: 1,
              }}
            >
              {code}
            </div>
          </FadeSlideIn>

          <FadeSlideIn delay={motion.staggerFrames * 8} yOffset={12}>
            <div
              style={{
                marginTop: 30,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 500,
                  color: colors.textSecondary,
                  letterSpacing: 0.4,
                }}
              >
                {cta}
              </div>
              <div
                style={{
                  fontSize: 52,
                  color: colors.accentSolid,
                  transform: `translateY(${bob}px)`,
                  lineHeight: 1,
                }}
              >
                ↓
              </div>
            </div>
          </FadeSlideIn>
        </div>
      </SlideFrame>
    </ApplePro>
  );
};

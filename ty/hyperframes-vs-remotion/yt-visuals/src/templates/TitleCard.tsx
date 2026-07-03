import React from "react";
import { Img, staticFile } from "remotion";
import { ApplePro, Eyebrow, FadeSlideIn, SlideFrame } from "../design/primitives";
import { colors, motion, spacing, type } from "../design/theme";
import { fontFamily } from "../design/font";
import type { TitleData } from "../schema";

// Logos float in white chips, sized to dominate the slide. No "vs" separator —
// the lineup is read as a grid, not a bracket.
const CHIP_SIZE = 220;
const LOGO_INSET = 26;

const LogoChip: React.FC<{ name: string; icon?: string }> = ({ name, icon }) => {
  if (icon) {
    return (
      <div
        style={{
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
        }}
      >
        <Img
          src={staticFile(icon)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </div>
    );
  }
  return (
    <div
      style={{
        height: CHIP_SIZE,
        borderRadius: 36,
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 48px",
        fontSize: 36,
        fontWeight: 700,
        letterSpacing: -0.5,
        color: "#0a0805",
        flexShrink: 0,
        boxShadow: "0 0 40px rgba(255,255,255,0.10)",
      }}
    >
      {name}
    </div>
  );
};

export const TitleCard: React.FC<TitleData> = ({ category, title, subtitle, platforms }) => {
  const platformsCount = platforms?.length ?? 0;

  return (
    <ApplePro>
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
          {category && <Eyebrow delay={0}>{category}</Eyebrow>}

          <FadeSlideIn delay={category ? motion.staggerFrames * 2 : 0}>
            <h1
              style={{
                ...type.title,
                color: colors.textPrimary,
                margin: 0,
                lineHeight: 1.04,
                textAlign: "center",
              }}
            >
              {title}
            </h1>
          </FadeSlideIn>

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
                const PLATFORM_STAGGER = 4;
                const baseDelay = motion.staggerFrames * (category ? 5 : 3);
                const logoDelay = baseDelay + i * PLATFORM_STAGGER;
                return (
                  <FadeSlideIn key={i} delay={logoDelay} yOffset={22}>
                    <LogoChip name={p.name} icon={p.icon} />
                  </FadeSlideIn>
                );
              })}
            </div>
          )}

          {subtitle && (
            <FadeSlideIn
              delay={
                platformsCount
                  ? motion.staggerFrames * (category ? 5 : 3) + platformsCount * 4 + 6
                  : motion.staggerFrames * 5
              }
            >
              <p
                style={{
                  ...type.subtitle,
                  color: colors.textSecondary,
                  margin: 0,
                  maxWidth: 1300,
                  textAlign: "center",
                }}
              >
                {subtitle}
              </p>
            </FadeSlideIn>
          )}
        </div>
      </SlideFrame>
    </ApplePro>
  );
};

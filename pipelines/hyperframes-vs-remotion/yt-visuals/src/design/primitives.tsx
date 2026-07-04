import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { colors, motion, spacing } from "./theme";

// Apple-style background: deep radial gradient (indigo → black), heavy negative space.
// Used by every template as the bottom layer.
export const ApplePro: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 30% 20%, ${colors.bgGradientFrom} 0%, ${colors.bgGradientTo} 60%)`,
        color: colors.textPrimary,
        overflow: "hidden",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// Centered slide content with consistent edge padding.
export const SlideFrame: React.FC<{
  children: React.ReactNode;
  align?: "center" | "left" | "top-left";
}> = ({ children, align = "center" }) => {
  const justifyContent = align === "top-left" ? "flex-start" : "center";
  const alignItems = align === "center" ? "center" : "flex-start";
  return (
    <AbsoluteFill
      style={{
        padding: spacing.framePadding,
        justifyContent,
        alignItems,
        display: "flex",
        flexDirection: "column",
        gap: spacing.blockGap,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// Fade + slide-up entrance. Used for every text element.
// Stagger lets a sequence of children appear one after the other.
export const FadeSlideIn: React.FC<{
  delay?: number; // frames
  duration?: number; // frames
  yOffset?: number; // px translated from
  children: React.ReactNode;
  as?: React.ElementType;
  style?: React.CSSProperties;
}> = ({
  delay = 0,
  duration = motion.enterDuration,
  yOffset = 18,
  children,
  as: Tag = "div",
  style,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - delay, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: motion.enterEase,
  });
  const opacity = progress;
  const translateY = interpolate(progress, [0, 1], [yOffset, 0]);
  return (
    <Tag
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
};

// A number that counts up from 0 to `value`. Useful for prices, scores.
// Hold for the full slide after the count-up completes.
export const NumberTicker: React.FC<{
  value: number;
  delay?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  style?: React.CSSProperties;
}> = ({
  value,
  delay = 0,
  duration = motion.numberCountFrames,
  prefix = "",
  suffix = "",
  decimals = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame - delay, [0, duration], [0, value], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: motion.enterEase,
  });
  const display = decimals > 0 ? progress.toFixed(decimals) : Math.round(progress).toString();
  return (
    <span style={style}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
};

// A bar that grows from 0 to a target height in px. Apple-style soft glow.
export const GrowingBar: React.FC<{
  targetHeight: number; // px
  delay?: number;
  duration?: number;
  width?: number | string;
  glow?: boolean;
}> = ({ targetHeight, delay = 0, duration = motion.numberCountFrames, width = "100%", glow = true }) => {
  const frame = useCurrentFrame();
  const height = interpolate(frame - delay, [0, duration], [0, targetHeight], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: motion.enterEase,
  });
  return (
    <div
      style={{
        width,
        height,
        background: `linear-gradient(180deg, ${colors.accentFrom} 0%, ${colors.accentTo} 100%)`,
        borderRadius: "6px 6px 0 0",
        boxShadow: glow ? `0 0 48px ${colors.accentGlow}` : "none",
      }}
    />
  );
};

// Eyebrow label — small, uppercase, wide letter-spacing. Used above titles.
export const Eyebrow: React.FC<{
  children: React.ReactNode;
  accent?: boolean;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ children, accent = true, delay = 0, style }) => {
  return (
    <FadeSlideIn delay={delay} yOffset={8}>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: 6,
          textTransform: "uppercase",
          color: accent ? colors.accentSolid : colors.textTertiary,
          ...style,
        }}
      >
        {children}
      </div>
    </FadeSlideIn>
  );
};

// Hairline horizontal divider — subtle, full-width inside the parent.
export const Hairline: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
  <div style={{ height: 1, background: colors.divider, width: "100%", ...style }} />
);

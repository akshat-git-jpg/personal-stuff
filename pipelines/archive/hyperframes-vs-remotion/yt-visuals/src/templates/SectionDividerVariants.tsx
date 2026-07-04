// Three motion-heavy SectionDivider variants for side-by-side comparison.
// Pick one, then we replace src/templates/SectionDivider.tsx with the winner.

import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ApplePro, SlideFrame } from "../design/primitives";
import { colors } from "../design/theme";
import { fontFamily } from "../design/font";
import type { SectionData } from "../schema";

// =============================================================================
// B. Rapid Counter + Scale
//    Big number flickers 00 → 01 → 02 → 03 → 04 (each digit ~4 frames),
//    then scales down to settled size. Title slides up underneath.
// =============================================================================
export const SectionDividerB: React.FC<SectionData> = ({ number, title }) => {
  const frame = useCurrentFrame();
  const target = parseInt(number, 10) || 4;

  // Counter: 4 frames per digit, then hold final
  const COUNTER_FRAMES_PER_STEP = 4;
  const counterStart = 6;
  const counterStepsTotal = target + 1;
  const counterEnd = counterStart + COUNTER_FRAMES_PER_STEP * counterStepsTotal;
  const displayed = Math.min(
    Math.max(0, Math.floor((frame - counterStart) / COUNTER_FRAMES_PER_STEP)),
    target,
  );
  const displayStr = String(displayed).padStart(2, "0");

  // Number scale: starts 3x during counter, settles to 1x
  const scale = interpolate(frame, [counterEnd, counterEnd + 24], [2.4, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Title slides up after counter settles
  const titleStart = counterEnd + 16;
  const titleProgress = interpolate(frame - titleStart, [0, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Dots ripple in after title
  const dotsStart = titleStart + 16;

  return (
    <ApplePro>
      <SlideFrame>
        <div
          style={{
            fontFamily,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 220,
              fontWeight: 800,
              lineHeight: 0.9,
              letterSpacing: -10,
              background: `linear-gradient(180deg, #ffffff 0%, ${colors.accentSolid} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              transform: `scale(${scale})`,
              transformOrigin: "center",
              fontFeatureSettings: '"tnum"',
            }}
          >
            {displayStr}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 6,
              color: colors.textTertiary,
              textTransform: "uppercase",
              marginTop: -6,
              opacity: interpolate(frame, [counterEnd - 6, counterEnd + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            Section
          </div>
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              letterSpacing: -2,
              color: colors.textPrimary,
              marginTop: 14,
              opacity: titleProgress,
              transform: `translateY(${interpolate(titleProgress, [0, 1], [20, 0])}px)`,
            }}
          >
            {title}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 18 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const dotDelay = dotsStart + i * 4;
              const dotOpacity = interpolate(frame - dotDelay, [0, 12], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const isActive = i === target - 1;
              return (
                <div
                  key={i}
                  style={{
                    width: isActive ? 12 : 8,
                    height: isActive ? 12 : 8,
                    borderRadius: "50%",
                    background: isActive ? colors.accentSolid : "rgba(255,255,255,0.25)",
                    boxShadow: isActive ? `0 0 16px ${colors.accentSolid}` : "none",
                    opacity: dotOpacity,
                  }}
                />
              );
            })}
          </div>
        </div>
      </SlideFrame>
    </ApplePro>
  );
};

// =============================================================================
// C. 3D Card Flip + Float
//    Card flies in from below with rotateX → 0, lands with spring bounce.
//    Then continuous gentle Y float.
// =============================================================================
export const SectionDividerC: React.FC<SectionData> = ({ number, title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring entrance with overshoot
  const entrance = spring({
    frame: frame - 4,
    fps,
    config: { damping: 12, stiffness: 110, mass: 0.7 },
  });
  // Rotation 60 → 0 deg
  const rotateX = interpolate(entrance, [0, 1], [60, 0]);
  // Translate Y 220 → 0
  const translateY = interpolate(entrance, [0, 1], [220, 0]);
  const opacity = interpolate(entrance, [0, 0.4, 1], [0, 0.6, 1]);

  // Continuous float after entrance
  const floatStart = 30;
  const floatY = frame > floatStart
    ? Math.sin(((frame - floatStart) / fps) * Math.PI * 0.6) * 8
    : 0;

  // Underground glow that ignites on land
  const glowIntensity = interpolate(entrance, [0.7, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <ApplePro>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 70%, ${colors.accentGlow} 0%, transparent 35%)`,
          opacity: glowIntensity * 0.7,
        }}
      />
      <SlideFrame>
        <div
          style={{
            perspective: 1600,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontFamily,
              display: "flex",
              alignItems: "center",
              gap: 36,
              padding: "44px 64px",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 32,
              background: "rgba(255,255,255,0.04)",
              boxShadow: `0 32px 96px rgba(167,139,250,${0.3 * glowIntensity}), 0 0 80px rgba(167,139,250,${0.22 * glowIntensity})`,
              backdropFilter: "blur(20px)",
              transform: `translateY(${translateY + floatY}px) rotateX(${rotateX}deg)`,
              transformOrigin: "center bottom",
              opacity,
            }}
          >
            <div
              style={{
                fontSize: 180,
                fontWeight: 700,
                lineHeight: 0.85,
                letterSpacing: -8,
                background: `linear-gradient(135deg, ${colors.accentFrom} 0%, ${colors.accentTo} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                fontFeatureSettings: '"tnum"',
              }}
            >
              {number}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                paddingLeft: 28,
                borderLeft: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: 6,
                  color: colors.textTertiary,
                  textTransform: "uppercase",
                }}
              >
                Section
              </div>
              <div
                style={{
                  fontSize: 52,
                  fontWeight: 700,
                  letterSpacing: -2,
                  color: colors.textPrimary,
                  lineHeight: 1,
                  maxWidth: 540,
                }}
              >
                {title}
              </div>
            </div>
          </div>
        </div>
      </SlideFrame>
    </ApplePro>
  );
};

// =============================================================================
// D. Particle Storm + Elastic Pop
//    Light streaks drift across, title scales in with elastic overshoot,
//    accent line draws + pulses underneath. Particles drift the whole hold.
// =============================================================================

// Pre-generated particle positions (seeded so they're stable across frames).
const PARTICLES = Array.from({ length: 18 }).map((_, i) => {
  // Use a deterministic hash for reproducibility
  const h = (i * 9301 + 49297) % 233280;
  const r = h / 233280;
  return {
    startX: r * 1920,
    startY: ((h * 7) % 233280 / 233280) * 1080,
    drift: 80 + ((h * 11) % 233280 / 233280) * 160,
    size: 2 + ((h * 13) % 233280 / 233280) * 5,
    glow: ((h * 17) % 233280 / 233280) > 0.5 ? colors.accentSolid : "#ffffff",
    duration: 60 + ((h * 19) % 233280 / 233280) * 60,
    delay: ((h * 23) % 233280 / 233280) * 40,
  };
});

const Streaks: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Light streaks during entrance */}
      {[
        { y: 280, len: 380, angle: -8, delay: 4, color: colors.accentSolid },
        { y: 520, len: 460, angle: 6, delay: 10, color: "#ffffff" },
        { y: 760, len: 320, angle: -10, delay: 16, color: colors.accentSolid },
      ].map((s, i) => {
        const progress = interpolate(frame - s.delay, [0, 28], [0, 1], {
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

      {/* Continuous drifting particles */}
      {PARTICLES.map((p, i) => {
        const t = ((frame - p.delay) % p.duration) / p.duration;
        const y = p.startY - t * p.drift;
        const opacity = Math.sin(t * Math.PI) * 0.6;
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

export const SectionDividerD: React.FC<SectionData> = ({ number, title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Elastic spring on title with overshoot
  const titleSpring = spring({
    frame: frame - 8,
    fps,
    config: { damping: 9, stiffness: 100, mass: 0.6 },
  });
  const titleScale = interpolate(titleSpring, [0, 1], [1.4, 1]);
  const titleOpacity = interpolate(titleSpring, [0, 0.3, 1], [0, 0.5, 1]);

  // Eyebrow entrance
  const eyebrowOpacity = interpolate(frame, [4, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Accent line draws + pulses
  const lineDraw = interpolate(frame, [28, 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const linePulse =
    frame > 52 ? 0.8 + Math.sin(((frame - 52) / fps) * Math.PI * 1.4) * 0.2 : 1;

  return (
    <ApplePro>
      <Streaks />
      <SlideFrame>
        <div
          style={{
            fontFamily,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 6,
              color: colors.accentSolid,
              textTransform: "uppercase",
              opacity: eyebrowOpacity,
            }}
          >
            Section · {number}
          </div>
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: -3,
              color: colors.textPrimary,
              lineHeight: 1.02,
              textShadow: `0 0 40px rgba(167,139,250,0.45)`,
              transform: `scale(${titleScale})`,
              opacity: titleOpacity,
              marginTop: 18,
            }}
          >
            {title}
          </div>
          <div
            style={{
              width: 160 * lineDraw,
              height: 3,
              background: `linear-gradient(90deg, transparent, ${colors.accentSolid}, transparent)`,
              boxShadow: `0 0 20px ${colors.accentSolid}`,
              marginTop: 28,
              opacity: linePulse,
            }}
          />
        </div>
      </SlideFrame>
    </ApplePro>
  );
};

// Three verdict variants for side-by-side comparison: trophy / report-card / badges.
// Each hardcodes extra mockup data not yet in VerdictSchema.

import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ApplePro, SlideFrame } from "../design/primitives";
import { colors } from "../design/theme";
import { fontFamily } from "../design/font";
import type { VerdictData } from "../schema";

const WINNER_ICON = "logos/hostinger.svg";

// =============================================================================
// 1. Trophy Ceremony
//    Gold-edged background. Trophy drops in, bounces. Winner card lifts up.
//    Continuous gold pulse + confetti.
// =============================================================================

// Pre-generated confetti positions
const CONFETTI = Array.from({ length: 40 }).map((_, i) => {
  const h = (i * 9301 + 49297) % 233280;
  const r = h / 233280;
  return {
    startX: r * 1920,
    startY: -50 - ((h * 7) % 233280) / 233280 * 200,
    fallSpeed: 1.5 + (((h * 11) % 233280) / 233280) * 2.5,
    swayPhase: (((h * 13) % 233280) / 233280) * Math.PI * 2,
    color: ["#facc15", "#fb923c", "#fff", "#c2410c"][Math.floor((((h * 17) % 233280) / 233280) * 4)],
    size: 6 + (((h * 19) % 233280) / 233280) * 6,
    rotation: (((h * 23) % 233280) / 233280) * 360,
  };
});

const Confetti: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {CONFETTI.map((c, i) => {
        const y = c.startY + frame * c.fallSpeed;
        const sway = Math.sin(t * 1.2 + c.swayPhase) * 30;
        const rot = c.rotation + frame * 2;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: c.startX + sway,
              top: y,
              width: c.size,
              height: c.size * 0.6,
              background: c.color,
              transform: `rotate(${rot}deg)`,
              opacity: 0.85,
              borderRadius: 2,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const VerdictTrophy: React.FC<VerdictData> = ({ eyebrow, winner, reason }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Trophy drops in with spring bounce
  const trophySpring = spring({
    frame: frame - 6,
    fps,
    config: { damping: 8, stiffness: 90, mass: 0.7 },
  });
  const trophyY = interpolate(trophySpring, [0, 1], [-200, 0]);
  const trophyScale = interpolate(trophySpring, [0, 1], [0.4, 1]);
  const trophyOpacity = interpolate(trophySpring, [0, 0.3, 1], [0, 0.6, 1]);

  // Winner card slides up
  const cardSpring = spring({
    frame: frame - 30,
    fps,
    config: { damping: 13, stiffness: 100, mass: 0.6 },
  });
  const cardY = interpolate(cardSpring, [0, 1], [80, 0]);
  const cardOpacity = interpolate(cardSpring, [0, 1], [0, 1]);

  // Reason fades in
  const reasonOpacity = interpolate(frame, [50, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Continuous gold pulse on the card
  const goldPulse = 0.7 + Math.sin(t * 1.5) * 0.3;

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 100%, rgba(250,204,21,0.25) -10%, #3a1f08 30%, #0a0805 75%)",
        color: colors.textPrimary,
      }}
    >
      <Confetti />
      <SlideFrame>
        <div
          style={{
            fontFamily,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          {/* Trophy */}
          <div
            style={{
              fontSize: 160,
              lineHeight: 1,
              transform: `translateY(${trophyY}px) scale(${trophyScale})`,
              opacity: trophyOpacity,
              filter: `drop-shadow(0 0 ${24 * goldPulse}px #facc15)`,
            }}
          >
            🏆
          </div>

          {/* Eyebrow */}
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 8,
              color: "#facc15",
              textTransform: "uppercase",
              opacity: interpolate(frame, [24, 40], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              textShadow: `0 0 ${14 * goldPulse}px #facc15`,
            }}
          >
            {eyebrow} · 2026
          </div>

          {/* Winner card */}
          <div
            style={{
              background: "#ffffff",
              padding: "26px 44px",
              borderRadius: 22,
              display: "flex",
              alignItems: "center",
              gap: 22,
              boxShadow: `0 24px 60px rgba(250,204,21,${0.35 * goldPulse}), 0 0 ${48 * goldPulse}px rgba(250,204,21,${0.28 * goldPulse})`,
              transform: `translateY(${cardY}px)`,
              opacity: cardOpacity,
            }}
          >
            <div
              style={{
                width: 84,
                height: 84,
                background: "#fff",
                borderRadius: 16,
                padding: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Img
                src={staticFile(WINNER_ICON)}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
            <div
              style={{
                fontSize: 64,
                fontWeight: 800,
                color: "#0a0805",
                letterSpacing: -2,
                lineHeight: 1,
              }}
            >
              {winner}
            </div>
          </div>

          {reason && (
            <div
              style={{
                fontSize: 24,
                color: colors.textSecondary,
                marginTop: 12,
                textAlign: "center",
                maxWidth: 1000,
                lineHeight: 1.4,
                opacity: reasonOpacity,
              }}
            >
              {reason}
            </div>
          )}
        </div>
      </SlideFrame>
    </AbsoluteFill>
  );
};

// =============================================================================
// 6. Report Card / Grading
//    Glass card with letter grade (A+) in gold + sub-grades for each axis.
// =============================================================================

const REPORT_SUBGRADES = [
  { subject: "Setup", grade: "A+", color: "#facc15" },
  { subject: "Price", grade: "A+", color: "#facc15" },
  { subject: "Performance", grade: "A", color: "#fb923c" },
  { subject: "Support", grade: "A+", color: "#facc15" },
  { subject: "Scale", grade: "A", color: "#fb923c" },
  { subject: "Ease of use", grade: "A+", color: "#facc15" },
];

export const VerdictReportCard: React.FC<VerdictData> = ({ eyebrow, winner, reason }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // Card entrance
  const cardSpring = spring({
    frame: frame - 4,
    fps,
    config: { damping: 14, stiffness: 110, mass: 0.6 },
  });
  const cardY = interpolate(cardSpring, [0, 1], [30, 0]);
  const cardOpacity = interpolate(cardSpring, [0, 0.4, 1], [0, 0.7, 1]);

  // Big grade scales in with spring
  const gradeSpring = spring({
    frame: frame - 22,
    fps,
    config: { damping: 9, stiffness: 100, mass: 0.5 },
  });
  const gradeScale = interpolate(gradeSpring, [0, 1], [0.2, 1]);
  const gradeOpacity = interpolate(gradeSpring, [0, 0.4, 1], [0, 0.7, 1]);

  // Grade glow pulses
  const gradeGlow = 0.6 + Math.sin(t * 1.4) * 0.3;

  return (
    <ApplePro>
      <SlideFrame>
        <div style={{ fontFamily, width: "100%", maxWidth: 1400 }}>
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 28,
              padding: "44px 56px",
              backdropFilter: "blur(20px)",
              transform: `translateY(${cardY}px)`,
              opacity: cardOpacity,
              boxShadow: `0 24px 80px rgba(0,0,0,0.4), 0 0 ${40 * gradeGlow}px rgba(250,204,21,${0.12 * gradeGlow})`,
            }}
          >
            {/* Header row: tool name + big grade */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 36 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: 6,
                    color: colors.accentSolid,
                    textTransform: "uppercase",
                  }}
                >
                  {eyebrow} · 2026 Report Card
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 8 }}>
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      background: "#fff",
                      borderRadius: 16,
                      padding: 10,
                      display: "flex",
                    }}
                  >
                    <Img
                      src={staticFile(WINNER_ICON)}
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 68,
                      fontWeight: 800,
                      color: colors.textPrimary,
                      letterSpacing: -2.5,
                      lineHeight: 1,
                    }}
                  >
                    {winner}
                  </div>
                </div>
              </div>

              <div
                style={{
                  fontSize: 220,
                  fontWeight: 900,
                  lineHeight: 0.85,
                  background: "linear-gradient(135deg, #facc15 0%, #fb923c 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  letterSpacing: -10,
                  transform: `scale(${gradeScale})`,
                  opacity: gradeOpacity,
                  textShadow: `0 0 ${48 * gradeGlow}px rgba(250,204,21,${0.5 * gradeGlow})`,
                  filter: `drop-shadow(0 0 ${28 * gradeGlow}px rgba(250,204,21,${0.4 * gradeGlow}))`,
                }}
              >
                A+
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.12)", margin: "28px 0" }} />

            {/* Sub-grades */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 28,
              }}
            >
              {REPORT_SUBGRADES.map((sg, i) => {
                const delay = 46 + i * 6;
                const subOpacity = interpolate(frame - delay, [0, 16], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const subY = interpolate(subOpacity, [0, 1], [12, 0]);
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 16,
                      padding: "14px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      opacity: subOpacity,
                      transform: `translateY(${subY}px)`,
                    }}
                  >
                    <div style={{ fontSize: 22, color: colors.textSecondary, fontWeight: 500 }}>
                      {sg.subject}
                    </div>
                    <div
                      style={{
                        fontSize: 38,
                        fontWeight: 800,
                        color: sg.color,
                        letterSpacing: -1,
                        textShadow: `0 0 18px ${sg.color}66`,
                      }}
                    >
                      {sg.grade}
                    </div>
                  </div>
                );
              })}
            </div>

            {reason && (
              <div
                style={{
                  marginTop: 36,
                  fontSize: 22,
                  fontStyle: "italic",
                  color: colors.textSecondary,
                  lineHeight: 1.5,
                  opacity: interpolate(frame, [88, 110], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                  paddingLeft: 18,
                  borderLeft: `3px solid ${colors.accentSolid}`,
                }}
              >
                "{reason}"
              </div>
            )}
          </div>
        </div>
      </SlideFrame>
    </ApplePro>
  );
};

// =============================================================================
// 8. Achievement Badges
//    Winner card + 5 colored achievement badges popping in one by one.
// =============================================================================

const BADGES = [
  { icon: "🏆", label: "BEST PRICE", color: "#facc15" },
  { icon: "⚡", label: "FASTEST SETUP", color: "#fde047" },
  { icon: "🎯", label: "BUILT FOR N8N", color: "#fef3c7" },
  { icon: "💬", label: "24/7 SUPPORT", color: "#fb923c" },
  { icon: "🚀", label: "PRODUCTION READY", color: "#c2410c" },
];

export const VerdictBadges: React.FC<VerdictData> = ({ eyebrow, winner, reason }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Card entrance
  const cardSpring = spring({
    frame: frame - 4,
    fps,
    config: { damping: 13, stiffness: 110, mass: 0.6 },
  });
  const cardOpacity = interpolate(cardSpring, [0, 1], [0, 1]);
  const cardX = interpolate(cardSpring, [0, 1], [-30, 0]);

  return (
    <ApplePro>
      <SlideFrame>
        <div
          style={{
            fontFamily,
            display: "flex",
            alignItems: "center",
            gap: 64,
            width: "100%",
            maxWidth: 1700,
          }}
        >
          {/* Left: winner card */}
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: 18,
              opacity: cardOpacity,
              transform: `translateX(${cardX}px)`,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 6,
                color: colors.accentSolid,
                textTransform: "uppercase",
              }}
            >
              {eyebrow}
            </div>
            <div
              style={{
                width: 280,
                height: 280,
                background: "#ffffff",
                borderRadius: 32,
                padding: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 24px 80px rgba(167,139,250,0.35), 0 0 48px rgba(167,139,250,0.22)`,
              }}
            >
              <Img
                src={staticFile(WINNER_ICON)}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
            <div
              style={{
                fontSize: 64,
                fontWeight: 800,
                color: colors.textPrimary,
                letterSpacing: -2.5,
                lineHeight: 1,
              }}
            >
              {winner}
            </div>
            {reason && (
              <div
                style={{
                  fontSize: 20,
                  color: colors.textSecondary,
                  lineHeight: 1.4,
                  maxWidth: 340,
                }}
              >
                {reason}
              </div>
            )}
          </div>

          {/* Right: achievement badges */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 5,
                color: colors.textTertiary,
                textTransform: "uppercase",
                marginBottom: 4,
                opacity: interpolate(frame, [20, 34], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              Why it wins
            </div>
            {BADGES.map((b, i) => {
              const delay = 32 + i * 10;
              const badgeSpring = spring({
                frame: frame - delay,
                fps,
                config: { damping: 10, stiffness: 110, mass: 0.5 },
              });
              const badgeOpacity = interpolate(badgeSpring, [0, 0.3, 1], [0, 0.6, 1]);
              const badgeScale = interpolate(badgeSpring, [0, 1], [0.7, 1]);
              const badgeX = interpolate(badgeSpring, [0, 1], [20, 0]);
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 18,
                    padding: "16px 24px",
                    background: `${b.color}1c`,
                    border: `1px solid ${b.color}66`,
                    borderRadius: 16,
                    opacity: badgeOpacity,
                    transform: `translateX(${badgeX}px) scale(${badgeScale})`,
                    boxShadow: `0 8px 24px ${b.color}20`,
                  }}
                >
                  <div style={{ fontSize: 38, lineHeight: 1 }}>{b.icon}</div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      color: b.color,
                      letterSpacing: 1.5,
                    }}
                  >
                    {b.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </SlideFrame>
    </ApplePro>
  );
};

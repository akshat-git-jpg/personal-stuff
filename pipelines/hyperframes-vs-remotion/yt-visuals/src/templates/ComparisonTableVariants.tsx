// Three motion-heavy ComparisonTable variants for side-by-side comparison.
// Pick one, then it replaces the production ComparisonTable.

import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ApplePro, SlideFrame } from "../design/primitives";
import { colors, fonts, spacing } from "../design/theme";
import { fontFamily } from "../design/font";
import { AuroraBlobs, BreathingBackdrop, LensVignette, Particles, Streaks } from "../design/effects";
import type { ComparisonData } from "../schema";

// Cell renderer — same style across all variants.
const Cell: React.FC<{
  value: string;
  isWinnerCol: boolean;
  style?: React.CSSProperties;
}> = ({ value, isWinnerCol, style }) => {
  const isCheck = value === "✓" || value.toLowerCase() === "yes";
  const isCross = value === "✗" || value.toLowerCase() === "no";
  const color = isCheck ? colors.win : isCross ? colors.cross : colors.textPrimary;
  return (
    <div
      style={{
        textAlign: "center",
        fontSize: 32,
        fontWeight: isWinnerCol && !isCross ? 700 : 500,
        color,
        ...fonts.tabular,
        ...style,
      }}
    >
      {value}
    </div>
  );
};

// =============================================================================
// A. Storm + Cascade  (consistent with section D & title A)
//    Particles + streaks. Header springs in. Rows stagger reveal,
//    cells within each row stagger left → right. Winner column glow pulses.
// =============================================================================
export const ComparisonTableA: React.FC<ComparisonData> = ({
  eyebrow,
  tools,
  rows,
  winnerColumn,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const gridTemplate = `1.4fr ${tools.map(() => "1fr").join(" ")}`;

  // Winner column glow pulse — continuous
  const glowPulse =
    winnerColumn !== undefined
      ? 0.5 + Math.sin((frame / fps) * Math.PI * 0.8) * 0.3
      : 0;

  // Header spring
  const headerSpring = spring({
    frame: frame - 8,
    fps,
    config: { damping: 11, stiffness: 110, mass: 0.55 },
  });
  const headerOpacity = interpolate(headerSpring, [0, 0.3, 1], [0, 0.6, 1]);
  const headerY = interpolate(headerSpring, [0, 1], [-18, 0]);

  return (
    <ApplePro>
      <Streaks delay={2} streaks={3} />
      <Particles />
      <SlideFrame align="top-left">
        <div
          style={{
            fontFamily,
            display: "flex",
            flexDirection: "column",
            gap: spacing.blockGap,
            width: "100%",
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 6,
              color: colors.accentSolid,
              textTransform: "uppercase",
              opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            {eyebrow}
          </div>

          {/* Header row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: gridTemplate,
              gap: 24,
              paddingBottom: 18,
              opacity: headerOpacity,
              transform: `translateY(${headerY}px)`,
              position: "relative",
            }}
          >
            <div />
            {tools.map((tool, i) => (
              <div
                key={i}
                style={{
                  textAlign: "center",
                  fontSize: 30,
                  fontWeight: winnerColumn === i ? 700 : 600,
                  color: winnerColumn === i ? colors.accentSolid : colors.textPrimary,
                  letterSpacing: -0.5,
                  textShadow:
                    winnerColumn === i ? `0 0 ${20 * glowPulse}px ${colors.accentSolid}` : "none",
                }}
              >
                {tool}
              </div>
            ))}
          </div>

          {/* Hairline draws across */}
          <div
            style={{
              height: 1,
              background: colors.divider,
              width: `${interpolate(frame, [16, 36], [0, 100], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              })}%`,
            }}
          />

          {/* Rows */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {rows.map((row, ri) => {
              const rowSpring = spring({
                frame: frame - (40 + ri * 8),
                fps,
                config: { damping: 12, stiffness: 110, mass: 0.5 },
              });
              const rowOpacity = interpolate(rowSpring, [0, 0.3, 1], [0, 0.5, 1]);
              const rowY = interpolate(rowSpring, [0, 1], [16, 0]);
              return (
                <div
                  key={ri}
                  style={{
                    display: "grid",
                    gridTemplateColumns: gridTemplate,
                    gap: 24,
                    padding: "22px 0",
                    borderBottom: `1px solid ${colors.divider}`,
                    alignItems: "center",
                    opacity: rowOpacity,
                    transform: `translateY(${rowY}px)`,
                  }}
                >
                  <div style={{ fontSize: 26, fontWeight: 500, color: colors.textSecondary }}>
                    {row.feature}
                  </div>
                  {row.values.map((v, ci) => {
                    // Per-cell stagger within the row
                    const cellDelay = 40 + ri * 8 + ci * 3;
                    const cellOpacity = interpolate(frame - cellDelay, [0, 16], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    });
                    const isWinner = winnerColumn === ci;
                    return (
                      <Cell
                        key={ci}
                        value={v}
                        isWinnerCol={isWinner}
                        style={{
                          opacity: cellOpacity,
                          textShadow:
                            isWinner && (v === "✓" || (!["✗", "—"].includes(v)))
                              ? `0 0 ${16 * glowPulse}px ${colors.accentSolid}`
                              : "none",
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </SlideFrame>
    </ApplePro>
  );
};

// =============================================================================
// B. Light Bar Scan
//    A horizontal light bar scans top → bottom across the table,
//    revealing rows as it passes. After scan, winner column pulses.
// =============================================================================
export const ComparisonTableB: React.FC<ComparisonData> = ({
  eyebrow,
  tools,
  rows,
  winnerColumn,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const gridTemplate = `1.4fr ${tools.map(() => "1fr").join(" ")}`;

  // Scan timing — header appears, then bar scans through rows
  const SCAN_START = 28;
  const SCAN_END = SCAN_START + 48; // 1.6s scan
  const scanProgress = interpolate(frame, [SCAN_START, SCAN_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });
  // Estimate row Y positions for reveal logic (row index → estimated Y in canvas)
  const rowReveal = (ri: number) => {
    const fraction = (ri + 1) / rows.length;
    return interpolate(scanProgress, [Math.max(0, fraction - 0.15), fraction], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  };

  // After scan, winner column pulses
  const postScanT = Math.max(0, (frame - SCAN_END) / fps);
  const glowPulse = 0.4 + Math.sin(postScanT * Math.PI * 1.0) * 0.3;

  return (
    <ApplePro>
      <AuroraBlobs />
      <SlideFrame align="top-left">
        <div
          style={{
            fontFamily,
            display: "flex",
            flexDirection: "column",
            gap: spacing.blockGap,
            width: "100%",
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 6,
              color: colors.accentSolid,
              textTransform: "uppercase",
              opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            {eyebrow}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: gridTemplate,
              gap: 24,
              paddingBottom: 18,
              opacity: interpolate(frame, [12, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            <div />
            {tools.map((tool, i) => (
              <div
                key={i}
                style={{
                  textAlign: "center",
                  fontSize: 30,
                  fontWeight: winnerColumn === i ? 700 : 600,
                  color: winnerColumn === i ? colors.accentSolid : colors.textPrimary,
                  letterSpacing: -0.5,
                  textShadow: winnerColumn === i ? `0 0 ${20 * glowPulse}px ${colors.accentSolid}` : "none",
                }}
              >
                {tool}
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: colors.divider, width: "100%" }} />

          <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
            {rows.map((row, ri) => {
              const reveal = rowReveal(ri);
              return (
                <div
                  key={ri}
                  style={{
                    display: "grid",
                    gridTemplateColumns: gridTemplate,
                    gap: 24,
                    padding: "22px 0",
                    borderBottom: `1px solid ${colors.divider}`,
                    alignItems: "center",
                    opacity: reveal,
                    transform: `translateX(${interpolate(reveal, [0, 1], [-30, 0])}px)`,
                  }}
                >
                  <div style={{ fontSize: 26, fontWeight: 500, color: colors.textSecondary }}>
                    {row.feature}
                  </div>
                  {row.values.map((v, ci) => {
                    const isWinner = winnerColumn === ci;
                    return (
                      <Cell
                        key={ci}
                        value={v}
                        isWinnerCol={isWinner}
                        style={{
                          textShadow:
                            isWinner && (v === "✓" || !["✗", "—"].includes(v))
                              ? `0 0 ${16 * glowPulse}px ${colors.accentSolid}`
                              : "none",
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </SlideFrame>

      {/* Scanning light bar (during the scan window) */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {scanProgress > 0 && scanProgress < 1 && (
          <div
            style={{
              position: "absolute",
              left: 80,
              right: 80,
              top: `${15 + scanProgress * 70}%`,
              height: 4,
              background: `linear-gradient(90deg, transparent, ${colors.accentSolid} 30%, #ffffff 50%, ${colors.accentSolid} 70%, transparent)`,
              boxShadow: `0 0 32px ${colors.accentSolid}, 0 0 18px #ffffff`,
              opacity: interpolate(scanProgress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]),
            }}
          />
        )}
      </AbsoluteFill>
    </ApplePro>
  );
};

// =============================================================================
// C. Spotlight Winner
//    Calm reveal (rows mostly fade). A spotlight stays on the winner column
//    the whole hold — gently moving. Best when the verdict is the takeaway.
// =============================================================================
export const ComparisonTableC: React.FC<ComparisonData> = ({
  eyebrow,
  tools,
  rows,
  winnerColumn,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const gridTemplate = `1.4fr ${tools.map(() => "1fr").join(" ")}`;

  // Spotlight gentle movement
  const spotlightShift = Math.sin(t * 0.4) * 12;
  const spotlightBreath = 0.6 + Math.sin(t * 0.5) * 0.2;

  // Estimate winner column X for spotlight positioning
  // Grid: 1.4fr + N * 1fr → first col is 1.4/(1.4+N), each tool col is 1/(1.4+N)
  const totalShares = 1.4 + tools.length;
  let winnerLeft = 50; // %
  if (winnerColumn !== undefined) {
    const labelShare = 1.4 / totalShares;
    const toolShare = 1 / totalShares;
    winnerLeft = (labelShare + (winnerColumn + 0.5) * toolShare) * 100;
  }

  return (
    <>
      <BreathingBackdrop />
      <LensVignette strength={0.4} />

      {/* Spotlight on winner column */}
      {winnerColumn !== undefined && (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <div
            style={{
              position: "absolute",
              left: `${winnerLeft + spotlightShift / 100}%`,
              top: "50%",
              width: 420,
              height: 760,
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(ellipse, ${colors.accentFrom} 0%, transparent 70%)`,
              opacity: 0.22 * spotlightBreath,
              filter: "blur(40px)",
            }}
          />
        </AbsoluteFill>
      )}

      <SlideFrame align="top-left">
        <div
          style={{
            fontFamily,
            display: "flex",
            flexDirection: "column",
            gap: spacing.blockGap,
            width: "100%",
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: 6,
              color: colors.accentSolid,
              textTransform: "uppercase",
              opacity: interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}
          >
            {eyebrow}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: gridTemplate,
              gap: 24,
              paddingBottom: 18,
              opacity: interpolate(frame, [10, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              transform: `translateY(${interpolate(frame, [10, 30], [12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
            }}
          >
            <div />
            {tools.map((tool, i) => (
              <div
                key={i}
                style={{
                  textAlign: "center",
                  fontSize: 30,
                  fontWeight: winnerColumn === i ? 700 : 600,
                  color: winnerColumn === i ? colors.accentSolid : colors.textPrimary,
                  letterSpacing: -0.5,
                }}
              >
                {tool}
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: colors.divider, width: "100%" }} />

          <div style={{ display: "flex", flexDirection: "column" }}>
            {rows.map((row, ri) => {
              const reveal = interpolate(
                frame - (24 + ri * 5),
                [0, 22],
                [0, 1],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                },
              );
              return (
                <div
                  key={ri}
                  style={{
                    display: "grid",
                    gridTemplateColumns: gridTemplate,
                    gap: 24,
                    padding: "22px 0",
                    borderBottom: `1px solid ${colors.divider}`,
                    alignItems: "center",
                    opacity: reveal,
                    transform: `translateY(${interpolate(reveal, [0, 1], [10, 0])}px)`,
                  }}
                >
                  <div style={{ fontSize: 26, fontWeight: 500, color: colors.textSecondary }}>
                    {row.feature}
                  </div>
                  {row.values.map((v, ci) => (
                    <Cell key={ci} value={v} isWinnerCol={winnerColumn === ci} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </SlideFrame>
    </>
  );
};

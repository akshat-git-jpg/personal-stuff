import React from "react";
import { ApplePro, Eyebrow, FadeSlideIn, Hairline, SlideFrame } from "../design/primitives";
import { colors, fonts, motion, spacing } from "../design/theme";
import { fontFamily } from "../design/font";
import type { ComparisonData } from "../schema";

const Cell: React.FC<{ value: string; isWinner: boolean }> = ({ value, isWinner }) => {
  // ✓ in mint (or brighter mint if winner column), ✗ in dim white, else literal value.
  const isCheck = value === "✓" || value.toLowerCase() === "yes";
  const isCross = value === "✗" || value.toLowerCase() === "no";
  const color = isCheck ? colors.win : isCross ? colors.cross : colors.textPrimary;
  return (
    <div
      style={{
        textAlign: "center",
        fontSize: 32,
        fontWeight: isWinner && !isCross ? 700 : 500,
        color,
        ...fonts.tabular,
      }}
    >
      {value}
    </div>
  );
};

export const ComparisonTable: React.FC<ComparisonData> = ({ eyebrow, tools, rows, winnerColumn }) => {
  // Grid: first column for feature label (1.4fr), rest 1fr equal.
  const gridTemplate = `1.4fr ${tools.map(() => "1fr").join(" ")}`;
  return (
    <ApplePro>
      <SlideFrame align="top-left">
        <div style={{ fontFamily, display: "flex", flexDirection: "column", gap: spacing.blockGap, width: "100%" }}>
          <Eyebrow delay={0}>{eyebrow}</Eyebrow>

          {/* Header row: tool names */}
          <FadeSlideIn delay={motion.staggerFrames * 2}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: gridTemplate,
                gap: 24,
                paddingBottom: 18,
              }}
            >
              <div /> {/* empty cell over feature column */}
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
          </FadeSlideIn>

          <Hairline />

          {/* Rows reveal one at a time */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {rows.map((row, ri) => {
              const delay = motion.staggerFrames * 4 + ri * motion.staggerFrames * 2;
              return (
                <FadeSlideIn key={ri} delay={delay} yOffset={16}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: gridTemplate,
                      gap: 24,
                      padding: "22px 0",
                      borderBottom: `1px solid ${colors.divider}`,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 26,
                        fontWeight: 500,
                        color: colors.textSecondary,
                      }}
                    >
                      {row.feature}
                    </div>
                    {row.values.map((v, ci) => (
                      <Cell key={ci} value={v} isWinner={winnerColumn === ci} />
                    ))}
                  </div>
                </FadeSlideIn>
              );
            })}
          </div>
        </div>
      </SlideFrame>
    </ApplePro>
  );
};

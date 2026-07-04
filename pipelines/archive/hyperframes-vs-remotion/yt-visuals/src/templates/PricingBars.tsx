import React from "react";
import { ApplePro, Eyebrow, FadeSlideIn, GrowingBar, NumberTicker, SlideFrame } from "../design/primitives";
import { colors, fonts, motion, spacing, type } from "../design/theme";
import { fontFamily } from "../design/font";
import type { PricingData } from "../schema";

const MAX_BAR_HEIGHT = 460;

export const PricingBars: React.FC<PricingData> = ({ eyebrow, unit, items }) => {
  const maxValue = Math.max(...items.map((i) => i.value));
  return (
    <ApplePro>
      <SlideFrame align="top-left">
        <div style={{ fontFamily, display: "flex", flexDirection: "column", gap: spacing.blockGap, width: "100%" }}>
          <Eyebrow delay={0}>{eyebrow}</Eyebrow>

          <div style={{ display: "flex", gap: 56, alignItems: "flex-end", justifyContent: "center", minHeight: 600 }}>
            {items.map((item, i) => {
              const delay = motion.staggerFrames * 2 + i * motion.staggerFrames * 2;
              const targetH = (item.value / maxValue) * MAX_BAR_HEIGHT;
              const decimals = item.value % 1 === 0 ? 0 : 2;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    maxWidth: 220,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 22,
                  }}
                >
                  <FadeSlideIn delay={delay} yOffset={12}>
                    <div
                      style={{
                        ...type.midNumber,
                        ...fonts.tabular,
                        color: item.winner ? colors.accentSolid : colors.textPrimary,
                      }}
                    >
                      {unit}
                      <NumberTicker
                        value={item.value}
                        delay={delay}
                        duration={motion.numberCountFrames}
                        decimals={decimals}
                      />
                    </div>
                    {item.note && (
                      <div style={{ fontSize: 18, color: colors.textTertiary, marginTop: 4, textAlign: "center" }}>
                        {item.note}
                      </div>
                    )}
                  </FadeSlideIn>

                  <GrowingBar targetHeight={targetH} delay={delay} duration={motion.numberCountFrames} glow={item.winner} />

                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: item.winner ? 600 : 500,
                      color: item.winner ? colors.textPrimary : colors.textSecondary,
                      letterSpacing: 0.4,
                      textAlign: "center",
                      marginTop: 8,
                    }}
                  >
                    {item.label}
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

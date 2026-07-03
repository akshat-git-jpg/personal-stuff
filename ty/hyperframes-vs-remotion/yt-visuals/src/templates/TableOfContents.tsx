import React from "react";
import { ApplePro, Eyebrow, FadeSlideIn, SlideFrame } from "../design/primitives";
import { colors, fonts, motion, spacing } from "../design/theme";
import { fontFamily } from "../design/font";
import type { TocData } from "../schema";

export const TableOfContents: React.FC<TocData> = ({ eyebrow, items }) => {
  return (
    <ApplePro>
      <SlideFrame>
        <div style={{ fontFamily, display: "flex", flexDirection: "column", gap: spacing.blockGap, maxWidth: 1400 }}>
          <Eyebrow delay={0}>{eyebrow}</Eyebrow>
          <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: spacing.itemGap }}>
            {items.map((item, i) => {
              const delay = motion.staggerFrames * 2 + i * motion.staggerFrames * 2;
              const numStr = String(i + 1).padStart(2, "0");
              return (
                <FadeSlideIn key={i} delay={delay} yOffset={24} as="li">
                  <div style={{ display: "flex", alignItems: "baseline", gap: 36 }}>
                    <span
                      style={{
                        ...fonts.tabular,
                        fontSize: 36,
                        fontWeight: 500,
                        color: colors.accentSolid,
                        minWidth: 64,
                      }}
                    >
                      {numStr}
                    </span>
                    <span
                      style={{
                        fontSize: 52,
                        fontWeight: 600,
                        letterSpacing: -1.5,
                        color: colors.textPrimary,
                        lineHeight: 1.1,
                      }}
                    >
                      {item.label}
                    </span>
                  </div>
                </FadeSlideIn>
              );
            })}
          </ol>
        </div>
      </SlideFrame>
    </ApplePro>
  );
};

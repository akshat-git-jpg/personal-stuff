import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import {
  SingleObjectStage, Eyebrow, Headline, Counterpoint, Offset, clamp, rev,
  RAISIN, STEEL, LIME, SANS, R_INK,
} from "../kit";
import { BgKey } from "../tokens";

export type HeroProps = {
  eyebrow: string;
  headlineWords: string[];   // UPPERCASE words, e.g. ["EVERY","CONCEPT,","MADE","VISUAL."]
  markIndex?: number;        // which word gets the lime highlighter marker (default last)
  counterpoint?: string;     // Playfair italic line under the headline
  buttonLabel?: string;      // optional CTA, e.g. "Press play →"
  bg?: BgKey;                // default "grid-dark"
};

export const Hero: React.FC<HeroProps> = ({
  eyebrow, headlineWords, markIndex, counterpoint, buttonLabel, bg,
}) => {
  const frame = useCurrentFrame();
  const btnP = rev(frame, 74, 18);
  const btnRise = interpolate(btnP, [0, 1], [20, 0]);

  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} stable>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
          <Headline
            words={headlineWords}
            size={120}
            markIndex={markIndex ?? headlineWords.length - 1}
            delay={8}
            align="center"
          />
          {counterpoint && <Counterpoint delay={50}>{counterpoint}</Counterpoint>}
          {buttonLabel && (
            <div style={{ marginTop: 16, opacity: clamp(btnP * 1.6, 0, 1), transform: `translateY(${btnRise}px)` }}>
              <Offset color={STEEL} dx={8} dy={8} radius={R_INK} p={rev(frame, 74, 16)}>
                <div
                  style={{
                    background: LIME,
                    color: RAISIN,
                    fontFamily: SANS,
                    fontWeight: 700,
                    fontSize: 26,
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                    padding: "20px 34px",
                    borderRadius: R_INK,
                  }}
                >
                  {buttonLabel}
                </div>
              </Offset>
            </div>
          )}
        </div>
      </SingleObjectStage>
    </>
  );
};

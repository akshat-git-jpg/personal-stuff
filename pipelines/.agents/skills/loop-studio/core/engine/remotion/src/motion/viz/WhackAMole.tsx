import React from "react";
import { useCurrentFrame } from "remotion";
import {
  SingleObjectStage, Eyebrow, clamp,
  LIME, STEEL, WHITE, RAISIN, SILVER_MID, SANS, MONO,
} from "../kit";
import { BgKey } from "../tokens";

/**
 * whackAMole — a row of blocks: one gets "fixed" (lime ✓) while another "breaks"
 * (amber-ish warning), cycling. Concept: "you fix one thing, another breaks."
 */
export type WhackAMoleProps = {
  eyebrow: string;
  label?: string;
  count?: number;
  bg?: BgKey;
};

const BW = 150, BH = 150, GAP = 26;

export const WhackAMole: React.FC<WhackAMoleProps> = ({ eyebrow, label = "fix one → another breaks", count = 5, bg }) => {
  const frame = useCurrentFrame();
  const step = Math.floor(frame / 22);
  const fixed = step % count;
  const broken = (step + 2) % count;
  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} move="push-in">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 44 }}>
          <div style={{ display: "flex", gap: GAP }}>
            {[...Array(count)].map((_, i) => {
              const isFixed = i === fixed;
              const isBroken = i === broken;
              const pop = clamp((frame - step * 22) / 8, 0, 1);
              const bump = (isFixed || isBroken) ? (1 - Math.abs(pop - 0.5) * 2) * 14 : 0;
              return (
                <div key={i} style={{
                  width: BW, height: BH, borderRadius: 16,
                  background: RAISIN,
                  border: `2px solid ${isFixed ? LIME : isBroken ? "#7a86ad" : STEEL}`,
                  boxShadow: isFixed ? `0 0 20px ${LIME}66` : "none",
                  opacity: isBroken ? 0.9 : isFixed ? 1 : 0.6,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transform: `translateY(${-bump}px)`,
                  color: isFixed ? LIME : isBroken ? "#aab3d0" : STEEL,
                  fontFamily: SANS, fontWeight: 900, fontSize: 70,
                }}>{isFixed ? "✓" : isBroken ? "!" : "·"}</div>
              );
            })}
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 40, color: WHITE, letterSpacing: "-0.02em" }}>{label}</div>
        </div>
      </SingleObjectStage>
    </>
  );
};

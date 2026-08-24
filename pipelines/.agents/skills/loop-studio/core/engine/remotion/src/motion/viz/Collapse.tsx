import React from "react";
import { useCurrentFrame } from "remotion";
import {
  SingleObjectStage, Eyebrow, clamp, rev,
  LIME, STEEL, SILVER_MID, WHITE, RAISIN, SANS, MONO,
} from "../kit";
import { BgKey } from "../tokens";

/**
 * collapse — a tower of code blocks stacks up, then the top blocks crack and
 * topple. Concept: "vibe coding cliff — you keep stacking and it breaks."
 */
export type CollapseProps = {
  eyebrow: string;
  label: string;      // e.g. "200 PROMPTS DEEP"
  sub?: string;       // e.g. "2 hours became 2 days"
  bg?: BgKey;
};

const NB = 8, BW = 320, BH = 46, GAP = 8, CRACK = 66, FALLEN = 3;

export const Collapse: React.FC<CollapseProps> = ({ eyebrow, label, sub, bg }) => {
  const frame = useCurrentFrame();
  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} move="push-in" designW={1080} designH={1480}>
        <div style={{ position: "relative", width: BW + 260, height: NB * (BH + GAP) + 60, display: "flex", flexDirection: "column-reverse", alignItems: "center", gap: GAP }}>
          {[...Array(NB)].map((_, i) => {
            const ap = rev(frame, 6 + i * 6, 8);
            const top = i >= NB - FALLEN;
            const fall = top ? clamp((frame - CRACK - (i - (NB - FALLEN)) * 4) / 26, 0, 1) : 0;
            const rot = top ? fall * (i % 2 ? 24 : -20) : 0;
            return (
              <div key={i} style={{
                width: BW, height: BH, background: top ? "#586184" : "#2b3247", border: `1px solid ${top ? "#7a86ad" : "#3f486a"}`,
                borderRadius: 6, opacity: ap * (1 - fall * 0.75),
                transform: `translate(${fall * (i % 2 ? 80 : -66)}px, ${fall * 280}px) rotate(${rot}deg) scale(${0.9 + ap * 0.1})`,
                display: "flex", alignItems: "center", gap: 14, paddingLeft: 20,
              }}>
                <div style={{ width: 11, height: 11, background: top ? SILVER_MID : LIME, borderRadius: 2 }} />
                <div style={{ width: 90 + ((i * 17) % 120), height: 6, background: "#39415a", borderRadius: 3 }} />
              </div>
            );
          })}
          {frame > CRACK - 6 && (
            <div style={{ position: "absolute", top: FALLEN * (BH + GAP) - 4, left: -40, width: BW + 340, height: 3, background: LIME, opacity: clamp((frame - CRACK + 6) / 10, 0, 1) * 0.9, boxShadow: `0 0 12px ${LIME}`, transform: "rotate(-0.6deg)" }} />
          )}
        </div>
      </SingleObjectStage>
      <div style={{ position: "absolute", right: 96, bottom: 110, textAlign: "right", maxWidth: 520 }}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 54, color: WHITE, letterSpacing: "-0.02em", lineHeight: 1.02 }}>{label}</div>
        {sub && <div style={{ fontFamily: MONO, fontSize: 20, color: SILVER_MID, marginTop: 10 }}>{sub}</div>}
      </div>
    </>
  );
};

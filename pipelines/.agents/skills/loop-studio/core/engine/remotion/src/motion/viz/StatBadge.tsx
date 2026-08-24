import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Tilt, rev, LIME, WHITE, SILVER_MID, MONO, SANS } from "../kit";
import { cineReveal, Glow } from "./cine";

/**
 * statBadge — OVERLAY device with cinematic motion: the value blur-rises and
 * scales in, the lime bar draws up with a bloom, a slight depth tilt, settle-and-
 * hold. Reference #2's floating "$116 PER BARREL" callout. Transparent.
 */
export type StatBadgeProps = {
  value: string;
  label: string;
  kicker?: string;
  anchor?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
};

const POS: Record<string, React.CSSProperties> = {
  "top-right": { top: 130, right: 120 },
  "top-left": { top: 130, left: 120 },
  "bottom-right": { bottom: 150, right: 120 },
  "bottom-left": { bottom: 150, left: 120 },
};

export const StatBadge: React.FC<StatBadgeProps> = ({ value, label, kicker, anchor = "top-right" }) => {
  const frame = useCurrentFrame();
  const right = anchor.includes("right");
  const barDraw = rev(frame, 4, 12);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", ...POS[anchor] }}>
        <Tilt ry={right ? 6 : -6} rx={3}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: right ? "flex-end" : "flex-start", textAlign: right ? "right" : "left" }}>
            {kicker && (
              <div style={{ ...cineReveal(frame, 2, 12, 14), fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: "0.16em", color: LIME, textTransform: "uppercase", marginBottom: 10, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>{kicker}</div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 18, flexDirection: right ? "row" : "row-reverse" }}>
              <div style={{ width: 18, height: 70, background: LIME, borderRadius: 3, boxShadow: `0 0 18px ${LIME}, 0 0 5px ${LIME}`, transformOrigin: "bottom", transform: `scaleY(${barDraw})` }} />
              <div style={{ ...cineReveal(frame, 6, 16, 24) }}>
                <Glow spread={90}>
                  <div style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 112, letterSpacing: "-0.03em", color: WHITE, lineHeight: 0.92, textShadow: "0 4px 26px rgba(0,0,0,0.7)" }}>{value}</div>
                </Glow>
              </div>
            </div>
            <div style={{ ...cineReveal(frame, 14, 14, 16), fontFamily: MONO, fontSize: 22, fontWeight: 700, letterSpacing: "0.1em", color: SILVER_MID, textTransform: "uppercase", marginTop: 12, textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>{label}</div>
          </div>
        </Tilt>
      </div>
    </AbsoluteFill>
  );
};

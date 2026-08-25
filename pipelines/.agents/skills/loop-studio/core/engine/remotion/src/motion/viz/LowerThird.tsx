import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Tilt, rev, LIME, WHITE, SILVER_MID, SANS, MONO } from "../kit";
import { cineReveal } from "./cine";

/**
 * lowerThird — OVERLAY device with cinematic motion: blur-rises into place, the
 * lime bar draws up with a bloom, slight depth tilt, settle-and-hold. The
 * workhorse name/section tag over the speaker. Transparent.
 */
export type LowerThirdProps = {
  kicker?: string;
  title: string;
  subtitle?: string;
  anchor?: "bottom-left" | "bottom-right";
};

export const LowerThird: React.FC<LowerThirdProps> = ({ kicker, title, subtitle, anchor = "bottom-left" }) => {
  const frame = useCurrentFrame();
  const barH = rev(frame, 3, 14);
  const left = anchor === "bottom-left";
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(0deg, rgba(15,18,26,0.72) 0%, rgba(15,18,26,0) 26%)" }} />
      <div style={{ position: "absolute", bottom: 110, [left ? "left" : "right"]: 120 }}>
        <Tilt ry={left ? -4 : 4} rx={2}>
          <div style={{ display: "flex", alignItems: "stretch", gap: 22, flexDirection: left ? "row" : "row-reverse" }}>
            <div style={{ width: 7, background: LIME, borderRadius: 4, transformOrigin: "bottom", transform: `scaleY(${barH})`, boxShadow: `0 0 16px ${LIME}, 0 0 5px ${LIME}` }} />
            <div style={{ textAlign: left ? "left" : "right" }}>
              {kicker && (
                <div style={{ ...cineReveal(frame, 4, 13, 16), fontFamily: MONO, fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: LIME, textTransform: "uppercase", marginBottom: 8, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>{kicker}</div>
              )}
              <div style={{ ...cineReveal(frame, 7, 15, 24), fontFamily: SANS, fontWeight: 700, fontSize: 56, letterSpacing: "-0.02em", color: WHITE, lineHeight: 1.04, textShadow: "0 3px 20px rgba(0,0,0,0.75)" }}>{title}</div>
              {subtitle && (
                <div style={{ ...cineReveal(frame, 13, 14, 16), fontFamily: MONO, fontSize: 20, color: SILVER_MID, marginTop: 10, letterSpacing: "0.02em", textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>{subtitle}</div>
              )}
            </div>
          </div>
        </Tilt>
      </div>
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { clamp, rev, StatValue, LIME, WHITE, SILVER_MID, MONO } from "../kit";
import { cineReveal } from "./cine";

/**
 * cornerCounter — OVERLAY: a small live counter ticking up in a corner + label.
 * Cinematic entrance. Transparent — sits over the speaker.
 */
export type CornerCounterProps = {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  anchor?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
};

const POS: Record<string, React.CSSProperties> = {
  "top-right": { top: 130, right: 120, alignItems: "flex-end" },
  "top-left": { top: 130, left: 120, alignItems: "flex-start" },
  "bottom-right": { bottom: 150, right: 120, alignItems: "flex-end" },
  "bottom-left": { bottom: 150, left: 120, alignItems: "flex-start" },
};

export const CornerCounter: React.FC<CornerCounterProps> = ({ value, suffix = "", prefix = "", label, anchor = "top-right" }) => {
  const frame = useCurrentFrame();
  const cp = rev(frame, 8, 60);
  const shown = Math.round(value * cp);
  const right = anchor.includes("right");
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", ...POS[anchor], display: "flex", flexDirection: "column", textAlign: right ? "right" : "left", ...cineReveal(frame, 2, 14, 20) }}>
        <StatValue size={84} color={WHITE}>{prefix}{shown.toLocaleString("en-US")}{suffix}</StatValue>
        <div style={{ fontFamily: MONO, fontSize: 19, fontWeight: 700, letterSpacing: "0.1em", color: LIME, textTransform: "uppercase", marginTop: 6, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>{label}</div>
      </div>
    </AbsoluteFill>
  );
};

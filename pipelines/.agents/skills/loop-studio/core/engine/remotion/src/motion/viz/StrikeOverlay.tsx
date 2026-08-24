import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Tilt, rev, LIME, WHITE, SILVER_MID, SANS, MONO } from "../kit";
import { cineReveal, Glow } from "./cine";

/**
 * strikeOverlay — OVERLAY device with full cinematic motion (blur-rise reveals,
 * depth tilt, glowing strike, settle-and-hold). Transparent + anchored so the
 * speaker stays visible. Reference #5 (crossed-out text beside the talking head).
 */
export type StrikeOverlayProps = {
  eyebrow?: string;
  items: string[];
  replacedBy?: string;
  anchor?: "left" | "right";
};

const PER = 17;

export const StrikeOverlay: React.FC<StrikeOverlayProps> = ({ eyebrow, items, replacedBy, anchor = "left" }) => {
  const frame = useCurrentFrame();
  const left = anchor === "left";
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: left
        ? "linear-gradient(90deg, rgba(15,18,26,0.86) 0%, rgba(15,18,26,0.55) 32%, rgba(15,18,26,0) 56%)"
        : "linear-gradient(270deg, rgba(15,18,26,0.86) 0%, rgba(15,18,26,0.55) 32%, rgba(15,18,26,0) 56%)" }} />
      <div style={{ position: "absolute", [left ? "left" : "right"]: 100, top: "50%", transform: "translateY(-50%)" }}>
        <Tilt ry={left ? -5 : 5} rx={2}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "flex-start" }}>
            {eyebrow && (
              <div style={{ ...cineReveal(frame, 2, 14, 18), fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: LIME, textTransform: "uppercase", marginBottom: 6 }}>{eyebrow}</div>
            )}
            {items.map((it, i) => {
              const st = rev(frame, 14 + i * PER, 11);
              const struck = st > 0.02;
              return (
                <div key={i} style={{ position: "relative", display: "inline-block", ...cineReveal(frame, 8 + i * PER, 14) }}>
                  <span style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 58, letterSpacing: "-0.02em", color: struck ? SILVER_MID : WHITE, textShadow: "0 2px 22px rgba(0,0,0,0.6)" }}>{it}</span>
                  <div style={{ position: "absolute", left: -4, top: "54%", height: 6, width: `calc(${st * 100}% + 8px)`, background: LIME, transform: "translateY(-50%) rotate(-1.4deg)", borderRadius: 3, boxShadow: `0 0 16px ${LIME}, 0 0 4px ${LIME}` }} />
                </div>
              );
            })}
            {replacedBy && (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 14, ...cineReveal(frame, 16 + items.length * PER, 16, 22) }}>
                <span style={{ fontFamily: MONO, fontSize: 28, fontWeight: 700, color: SILVER_MID }}>→</span>
                <Glow spread={70}>
                  <span style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 66, letterSpacing: "-0.02em", color: LIME }}>{replacedBy}</span>
                </Glow>
              </div>
            )}
          </div>
        </Tilt>
      </div>
    </AbsoluteFill>
  );
};

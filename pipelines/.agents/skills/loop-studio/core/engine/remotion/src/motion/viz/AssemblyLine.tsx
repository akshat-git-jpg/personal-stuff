import React from "react";
import { useCurrentFrame } from "remotion";
import {
  SingleObjectStage, Eyebrow, NumberBadge, clamp, rev,
  LIME, STEEL, WHITE, RAISIN, SILVER_MID, SANS, MONO, R_SURFACE,
} from "../kit";
import { BgKey } from "../tokens";

/**
 * assemblyLine — a piece rides a conveyor through numbered stations, each lighting
 * up as it passes. Concept: "the editing system: cut → b-roll → finish."
 */
export type AssemblyLineProps = {
  eyebrow: string;
  stations: string[];
  bg?: BgKey;
};

const W = 1400, Y = 360;

export const AssemblyLine: React.FC<AssemblyLineProps> = ({ eyebrow, stations, bg }) => {
  const frame = useCurrentFrame();
  const n = stations.length;
  const x0 = 160, x1 = W - 160;
  const px = (i: number) => x0 + (i / (n - 1)) * (x1 - x0);
  const prog = rev(frame, 18, 26 * n);       // 0..1 across the line
  const pieceX = x0 + prog * (x1 - x0);
  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} move="push-in">
        <div style={{ position: "relative", width: W, height: 560 }}>
          <svg width={W} height={560} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <line x1={x0} y1={Y} x2={x1} y2={Y} stroke={STEEL} strokeWidth={4} />
            <line x1={x0} y1={Y} x2={pieceX} y2={Y} stroke={LIME} strokeWidth={4} />
          </svg>
          {stations.map((s, i) => {
            const active = pieceX >= px(i) - 6;
            return (
              <div key={i} style={{ position: "absolute", left: px(i), top: Y, transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: rev(frame, 8 + i * 6, 10) }}>
                <div style={{ transform: active ? "scale(1)" : "scale(0.9)", filter: active ? `drop-shadow(0 0 14px ${LIME}66)` : "grayscale(0.6) opacity(0.7)", transition: "none" }}>
                  <NumberBadge size={72}>{String(i + 1).padStart(2, "0")}</NumberBadge>
                </div>
                <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 26, color: active ? WHITE : SILVER_MID, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{s}</div>
              </div>
            );
          })}
          {/* the traveling piece */}
          <div style={{ position: "absolute", left: pieceX, top: Y, transform: "translate(-50%,-50%)" }}>
            <div style={{ width: 34, height: 34, background: LIME, borderRadius: 6, boxShadow: `0 0 16px ${LIME}`, transform: `rotate(${prog * 90}deg)` }} />
          </div>
        </div>
      </SingleObjectStage>
    </>
  );
};

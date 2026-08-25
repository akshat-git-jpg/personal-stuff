import React from "react";
import { useCurrentFrame } from "remotion";
import {
  SingleObjectStage, Eyebrow, clamp, rev, StatValue,
  LIME, STEEL, WHITE, SILVER_MID, SANS, MONO,
} from "../kit";
import { BgKey } from "../tokens";

/**
 * grindClock — tick marks fill around a clock ring; the "after midnight" sector
 * lights lime. Center counter races to the session total. Concept: "AI made me
 * busier, not freer — 1,880 sessions, 77 after midnight."
 */
export type GrindClockProps = {
  eyebrow: string;
  total: number;
  afterMidnight?: number;
  label?: string;
  bg?: BgKey;
};

const N = 48, RIN = 210, ROUT = 250;

export const GrindClock: React.FC<GrindClockProps> = ({ eyebrow, total, afterMidnight = 0, label = "sessions", bg }) => {
  const frame = useCurrentFrame();
  const cp = rev(frame, 12, 70);
  const shown = Math.round(total * cp);
  const midCount = Math.round((N * afterMidnight) / Math.max(total, 1)) + (afterMidnight ? 4 : 0);
  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} stable>
        <div style={{ position: "relative", width: ROUT * 2 + 40, height: ROUT * 2 + 40 }}>
          <svg width={ROUT * 2 + 40} height={ROUT * 2 + 40} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <g transform={`translate(${ROUT + 20}, ${ROUT + 20})`}>
              {[...Array(N)].map((_, i) => {
                const a = (i / N) * Math.PI * 2 - Math.PI / 2;
                const on = rev(frame, 14 + i * 1.1, 6);
                // "after midnight" = ticks nearest the top (12 o'clock)
                const dist = Math.min(i, N - i);
                const isMid = dist < midCount / 2;
                const col = isMid ? LIME : STEEL;
                return (
                  <line key={i}
                    x1={RIN * Math.cos(a)} y1={RIN * Math.sin(a)} x2={ROUT * Math.cos(a)} y2={ROUT * Math.sin(a)}
                    stroke={col} strokeWidth={6} strokeLinecap="round" opacity={0.25 + on * 0.75}
                    style={{ filter: isMid && on > 0.5 ? `drop-shadow(0 0 5px ${LIME})` : undefined }}
                  />
                );
              })}
            </g>
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <StatValue size={100} color={WHITE}>{shown.toLocaleString("en-US")}</StatValue>
            <div style={{ fontFamily: MONO, fontSize: 20, color: SILVER_MID, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
            {afterMidnight ? <div style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 30, color: LIME, marginTop: 18 }}>{afterMidnight} after midnight</div> : null}
          </div>
        </div>
      </SingleObjectStage>
    </>
  );
};

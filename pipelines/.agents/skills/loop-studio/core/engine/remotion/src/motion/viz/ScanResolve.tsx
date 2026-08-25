import React from "react";
import { useCurrentFrame } from "remotion";
import {
  SingleObjectStage, Eyebrow, clamp, rev, StatValue,
  LIME, STEEL, WHITE, SILVER_MID, MONO,
} from "../kit";
import { BgKey } from "../tokens";

/**
 * scanResolve — a grid of dim profile dots; a lime scan line sweeps down, lighting
 * each row as it "resolves". Counter races to the total. Concept: "Apify found all
 * 4,000 of them."
 */
export type ScanResolveProps = {
  eyebrow: string;
  total: number;
  label?: string;
  cols?: number;
  rows?: number;
  bg?: BgKey;
};

const CELL = 20, GAP = 12;

export const ScanResolve: React.FC<ScanResolveProps> = ({ eyebrow, total, label = "profiles resolved", cols = 30, rows = 12, bg }) => {
  const frame = useCurrentFrame();
  const sweep = rev(frame, 16, 72);         // 0..1 top->bottom
  const gridW = cols * CELL + (cols - 1) * GAP;
  const gridH = rows * CELL + (rows - 1) * GAP;
  const cp = sweep;
  const shown = Math.round(total * cp);
  const scanY = sweep * gridH;
  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} stable>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 30 }}>
          <div style={{ width: gridW }}>
            <StatValue size={92} color={LIME}>{shown.toLocaleString("en-US")}</StatValue>
            <div style={{ fontFamily: MONO, fontSize: 18, color: SILVER_MID, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
          </div>
          <div style={{ position: "relative", width: gridW, height: gridH }}>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${CELL}px)`, gap: GAP }}>
              {Array.from({ length: cols * rows }).map((_, i) => {
                const row = Math.floor(i / cols);
                const rowY = row * (CELL + GAP);
                const lit = scanY >= rowY;
                return <div key={i} style={{ width: CELL, height: CELL, borderRadius: "50%", background: lit ? LIME : STEEL, opacity: lit ? 1 : 0.4 }} />;
              })}
            </div>
            {/* the scan line */}
            {sweep < 0.999 && <div style={{ position: "absolute", left: -10, top: scanY, width: gridW + 20, height: 3, background: LIME, boxShadow: `0 0 14px ${LIME}` }} />}
          </div>
        </div>
      </SingleObjectStage>
    </>
  );
};

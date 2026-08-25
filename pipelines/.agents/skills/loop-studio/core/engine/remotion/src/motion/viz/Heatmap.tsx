import React from "react";
import { useCurrentFrame } from "remotion";
import {
  SingleObjectStage, rev, Flash,
  LIME, STEEL, WHITE, SILVER_MID, MONO, StatValue,
} from "../kit";
import { BgKey } from "../tokens";

/**
 * heatmap — a run-density grid (GitHub-contribution style). Cells fill in one by
 * one, almost all lime (success), a few steel (the failures), while a counter
 * races to the total. Concept: "15,380 runs at 99%" shown as volume + reliability,
 * not a number on a card. Distinct from any chart in the kit.
 */
export type HeatmapProps = {
  eyebrow: string;
  total: number;        // e.g. 15380
  unit?: string;        // e.g. "agent runs"
  successPct?: number;  // e.g. 99
  cols?: number;
  rows?: number;
  bg?: BgKey;
};

const CELL = 22;
const GAP = 7;

export const Heatmap: React.FC<HeatmapProps> = ({
  eyebrow, total, unit = "runs", successPct = 99, cols = 28, rows = 11, bg,
}) => {
  const frame = useCurrentFrame();
  const N = cols * rows;
  const failN = Math.max(0, Math.round((N * (100 - successPct)) / 100));
  const fails = new Set<number>();
  if (failN > 0) {
    const step = Math.floor(N / (failN + 1));
    for (let k = 1; k <= failN; k++) fails.add(k * step + 13); // scattered, deterministic
  }
  const cp = rev(frame, 12, 72);
  const shown = Math.round(total * cp);
  const gridW = cols * CELL + (cols - 1) * GAP;

  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} stable>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 34 }}>
          {/* stat header */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 48, width: gridW }}>
            <div>
              <StatValue size={92} color={WHITE}>{shown.toLocaleString("en-US")}</StatValue>
              <div style={{ fontFamily: MONO, fontSize: 18, color: SILVER_MID, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{unit} · 7 days</div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <StatValue size={92} color={LIME}>{successPct}%</StatValue>
              <div style={{ fontFamily: MONO, fontSize: 18, color: SILVER_MID, marginTop: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>success</div>
            </div>
          </div>
          {/* the density grid */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${CELL}px)`, gap: GAP }}>
            {Array.from({ length: N }).map((_, i) => {
              const a = rev(frame, 18 + i * 0.16, 7);
              const isFail = fails.has(i);
              return (
                <div
                  key={i}
                  style={{
                    width: CELL, height: CELL, borderRadius: 4,
                    background: isFail ? STEEL : LIME,
                    opacity: a * (isFail ? 0.9 : 1),
                    transform: `scale(${0.4 + a * 0.6})`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </SingleObjectStage>
      <Flash hit={84} len={12} peak={0.28} />
    </>
  );
};

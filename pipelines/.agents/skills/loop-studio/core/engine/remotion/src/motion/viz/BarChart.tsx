import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import {
  SingleObjectStage, Tilt, Eyebrow, clamp, rev,
  WHITE, SILVER_SOFT, STEEL, LIME, RAISIN, BODY, MONO, SANS, R_SURFACE, R_INK,
} from "../kit";
import { SHADOW_CARD, BgKey } from "../tokens";

export type BarChartProps = {
  eyebrow: string;
  bars: { label: string; value: number }[]; // 3-7 bars
  yMax?: number;   // default = max(values) * 1.2
  bg?: BgKey;      // default "grid-light"
};

export const BarChart: React.FC<BarChartProps> = ({ eyebrow, bars, yMax, bg }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const values = bars.map((b) => b.value);
  const max = yMax ?? Math.ceil(Math.max(...values) * 1.2);
  const winner = values.reduce((a, v, i) => (v > values[a] ? i : a), 0);

  const chartH = 440;
  const barW = 120;
  const gap = 40;

  const ry = -6; // CONSTANT tilt — animated tilt jitters text. Fixed angle = stable.

  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-light"} stable>
        <Tilt ry={ry} rx={3}>
          <div
            style={{
              background: WHITE,
              border: `1px solid ${SILVER_SOFT}`,
              borderRadius: R_SURFACE,
              boxShadow: SHADOW_CARD,
              padding: "50px 60px 40px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end", gap, height: chartH }}>
              {bars.map((b, i) => {
                const p = rev(frame, 12 + i * 7, 26);
                const h = (b.value / max) * chartH * p;
                const val = Math.round(b.value * p);
                const isWin = i === winner;
                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      height: chartH,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: SANS,
                        fontWeight: 700,
                        fontStyle: "italic",
                        fontSize: 34,
                        color: isWin ? RAISIN : BODY,
                        marginBottom: 10,
                        opacity: clamp(p * 2, 0, 1),
                      }}
                    >
                      {val}
                    </div>
                    <div
                      style={{
                        width: barW,
                        height: h,
                        background: isWin ? LIME : STEEL,
                        borderRadius: R_INK,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div style={{ height: 3, background: RAISIN }} />
            <div style={{ display: "flex", gap, marginTop: 16 }}>
              {bars.map((b, i) => (
                <div
                  key={i}
                  style={{
                    width: barW,
                    textAlign: "center",
                    fontFamily: MONO,
                    fontSize: 16,
                    color: BODY,
                    letterSpacing: "0.05em",
                  }}
                >
                  {b.label}
                </div>
              ))}
            </div>
          </div>
        </Tilt>
      </SingleObjectStage>
    </>
  );
};

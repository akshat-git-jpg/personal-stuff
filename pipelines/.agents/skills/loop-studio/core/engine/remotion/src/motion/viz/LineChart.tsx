import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import {
  SingleObjectStage, Tilt, Eyebrow, MonotonicCounter, clamp, lerp, rev,
  WHITE, RAISIN, BODY, LIME, SILVER_SOFT, MONO, SANS, R_SURFACE,
} from "../kit";
import { SHADOW_CARD } from "../tokens";
import { BgKey } from "../tokens";

export type LineChartProps = {
  eyebrow: string;
  title: string;
  points: number[];      // raw values (e.g. [12,14,13,...])
  xLabels: string[];     // one per point (e.g. ["JAN","FEB",...])
  yMax: number;          // top of the y axis
  prefix?: string;       // e.g. "€"
  suffix?: string;       // e.g. "k"
  bg?: BgKey;            // default grid-light
};

export const LineChart: React.FC<LineChartProps> = ({
  eyebrow, title, points, xLabels, yMax, prefix = "", suffix = "", bg = "grid-light",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const n = points.length;
  const CW = 940, CH = 360;
  const norm = points.map((v) => clamp(v / yMax, 0, 1));
  const p = rev(frame, 10, Math.round(durationInFrames * 0.5));
  const X = (i: number) => (i / (n - 1)) * CW;
  const Y = (v: number) => CH - v * CH;
  const line = norm.map((v, i) => `${i === 0 ? "M" : "L"} ${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const area = `${line} L ${CW} ${CH} L 0 ${CH} Z`;
  const tx = p * CW;
  const idx = p * (n - 1);
  const tv = lerp(norm[Math.min(n - 2, Math.floor(idx))], norm[Math.min(n - 1, Math.floor(idx) + 1)], idx - Math.floor(idx));
  const ty = Y(tv);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const ry = -5; // CONSTANT tilt — an animated tilt re-rasterizes text every frame (jitter). Fixed angle = stable.

  return (
    <>
      <SingleObjectStage bg={bg} stable>
        <Tilt ry={ry} rx={4}>
          <div style={{ background: WHITE, border: `1px solid ${SILVER_SOFT}`, borderRadius: R_SURFACE, boxShadow: SHADOW_CARD, padding: "44px 52px 52px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 }}>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, color: RAISIN, textTransform: "uppercase", letterSpacing: "-0.02em" }}>{title}</div>
              <MonotonicCounter series={norm} p={p} scale={yMax} prefix={prefix} suffix={suffix} size={40} color={RAISIN} />
            </div>
            {/* ALL axis text is HTML — never SVG <text>. Under the camera's scale +
                3D tilt, SVG text jitters sub-pixel ("moving up and down") and can
                drop out frame-to-frame in headless Chromium. The SVG holds only
                shapes (gridlines, area, line, tracker). */}
            <div style={{ display: "flex" }}>
              {/* y-axis labels, aligned to the gridlines */}
              <div style={{ position: "relative", width: 46, height: CH }}>
                {ticks.map((g) => (
                  <span
                    key={g}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: CH - g * CH,
                      transform: "translateY(-50%)",
                      fontFamily: MONO,
                      fontSize: 16,
                      color: BODY,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {Math.round(g * yMax)}
                  </span>
                ))}
              </div>
              {/* plot */}
              <div style={{ position: "relative" }}>
                <svg width={CW} height={CH} style={{ display: "block", overflow: "visible" }}>
                  <defs>
                    <linearGradient id="lc-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={LIME} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={LIME} stopOpacity={0} />
                    </linearGradient>
                    <clipPath id="lc-reveal"><rect x={0} y={-40} width={tx} height={CH + 80} /></clipPath>
                  </defs>
                  {ticks.map((g) => (
                    <line key={g} x1={0} x2={CW} y1={CH - g * CH} y2={CH - g * CH} stroke={SILVER_SOFT} strokeWidth={1} />
                  ))}
                  <g clipPath="url(#lc-reveal)">
                    <path d={area} fill="url(#lc-grad)" />
                    <path d={line} fill="none" stroke={RAISIN} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                  {p > 0.02 && p < 0.999 && (
                    <>
                      <line x1={tx} y1={0} x2={tx} y2={CH} stroke={LIME} strokeWidth={2} strokeDasharray="4 5" />
                      <circle cx={tx} cy={ty} r={8} fill={LIME} stroke={RAISIN} strokeWidth={2} />
                    </>
                  )}
                </svg>
                {/* x-axis labels (HTML) */}
                <div style={{ position: "relative", width: CW, height: 22, marginTop: 10 }}>
                  {xLabels.map((m, i) => (
                    <span
                      key={i}
                      style={{
                        position: "absolute",
                        left: X(i),
                        transform: i === 0 ? "translateX(0)" : i === n - 1 ? "translateX(-100%)" : "translateX(-50%)",
                        fontFamily: MONO,
                        fontSize: 16,
                        color: BODY,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Tilt>
      </SingleObjectStage>
    </>
  );
};

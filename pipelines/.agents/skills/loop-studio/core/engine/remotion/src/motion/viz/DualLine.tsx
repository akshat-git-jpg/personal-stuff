import React from "react";
import { useCurrentFrame } from "remotion";
import {
  SingleObjectStage, Eyebrow, Offset, clamp, rev,
  RAISIN, LIME, STEEL, SILVER_SOFT, SILVER_MID, BODY, WHITE, SANS, MONO, R_SURFACE,
} from "../kit";
import { SHADOW_CARD, BgKey } from "../tokens";

/**
 * dualLine — two series on one chart: A (lime, the hero) vs B (steel, the trend
 * line). Both draw in; the GAP between them is the story. For "momentum vs
 * revenue", "speed vs security", "CPI vs trend". Distinct from the single lineChart.
 */
type Series = { label: string; points: number[] };
export type DualLineProps = {
  eyebrow: string;
  title: string;
  a: Series;       // lime
  b: Series;       // steel
  xLabels: string[];
  yMax: number;
  yMin?: number;
  bg?: BgKey;
};

const W = 1180, H = 600;
const PAD = { l: 96, r: 56, t: 128, b: 78 };

export const DualLine: React.FC<DualLineProps> = ({ eyebrow, title, a, b, xLabels, yMax, yMin = 0, bg }) => {
  const frame = useCurrentFrame();
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const n = Math.max(a.points.length, b.points.length);
  const X = (i: number) => PAD.l + (i / (n - 1)) * plotW;
  const Y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * plotH;
  const path = (pts: number[]) => pts.map((v, i) => `${i === 0 ? "M" : "L"} ${X(i)} ${Y(v)}`).join(" ");
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((t) => yMin + t * (yMax - yMin));

  const drawA = rev(frame, 16, 60);
  const drawB = rev(frame, 10, 60);
  const LEN = 4200; // generous dash length for draw-in

  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-light"} stable designW={1260} designH={700}>
        <Offset color={LIME} dx={14} dy={14} radius={R_SURFACE} p={rev(frame, 6, 22)}>
          <div style={{ width: W, height: H, background: WHITE, border: `1px solid ${SILVER_SOFT}`, borderRadius: R_SURFACE, boxShadow: SHADOW_CARD, position: "relative" }}>
            {/* title + legend */}
            <div style={{ position: "absolute", left: PAD.l, top: 44, fontFamily: SANS, fontWeight: 700, fontSize: 30, color: RAISIN, letterSpacing: "-0.01em" }}>{title}</div>
            <div style={{ position: "absolute", right: PAD.r, top: 46, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
              {[{ c: LIME, l: a.label }, { c: STEEL, l: b.label }].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 26, height: 5, background: s.c, borderRadius: 3 }} />
                  <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", color: BODY, textTransform: "uppercase" }}>{s.l}</span>
                </div>
              ))}
            </div>
            <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
              {gridVals.map((gv, i) => (
                <g key={i}>
                  <line x1={PAD.l} y1={Y(gv)} x2={W - PAD.r} y2={Y(gv)} stroke={SILVER_SOFT} strokeWidth={1} />
                  <text x={PAD.l - 16} y={Y(gv) + 5} textAnchor="end" fontFamily="JetBrains Mono" fontSize={16} fill={BODY}>{Math.round(gv)}</text>
                </g>
              ))}
              {xLabels.map((lb, i) => (
                <text key={i} x={X(i)} y={H - PAD.b + 34} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={16} fill={BODY}>{lb}</text>
              ))}
              {/* B (steel) under A */}
              <path d={path(b.points)} fill="none" stroke={STEEL} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round"
                strokeDasharray={LEN} strokeDashoffset={(1 - drawB) * LEN} />
              {/* A (lime) hero */}
              <path d={path(a.points)} fill="none" stroke={LIME} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round"
                strokeDasharray={LEN} strokeDashoffset={(1 - drawA) * LEN} />
              {/* leading dots */}
              {drawA > 0.99 && <circle cx={X(n - 1)} cy={Y(a.points[a.points.length - 1])} r={9} fill={LIME} stroke={RAISIN} strokeWidth={3} />}
            </svg>
          </div>
        </Offset>
      </SingleObjectStage>
    </>
  );
};

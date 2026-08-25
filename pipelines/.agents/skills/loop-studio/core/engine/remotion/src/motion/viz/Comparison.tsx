import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  ComparisonStage, rev, StatValue,
  SILVER, SILVER_SOFT, SILVER_MID, BODY, RAISIN, STEEL, LIME, WHITE, MONO, SANS, R_SURFACE,
} from "../kit";

export type ComparisonSide = { label: string; stat: string; sub: string };
export type ComparisonProps = {
  left: ComparisonSide;   // the "before" / manual side (silver)
  right: ComparisonSide;  // the "after" / automated side (raisin + lime)
  tasks?: number;         // clutter chips on the left (default 5)
};

/* LAW: a comparison stays framed. ComparisonStage has no camera. Motion is the
   divider wipe + each side's content revealing in. */
export const Comparison: React.FC<ComparisonProps> = ({ left, right, tasks = 5 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const wipe = rev(frame, 8, 22);
  const leftIn = rev(frame, 10, 20);
  const rightIn = rev(frame, 30, 24);
  const loop = rev(frame, 32, 40);
  const chips = Array.from({ length: tasks }, (_, i) => ({
    x: 80 + (i % 2) * 150, y: 240 + i * 90, w: 160 + (i % 3) * 40, r: [-3, 2, -1, 4, -2][i % 5],
  }));

  return (
    <ComparisonStage>
      <AbsoluteFill style={{ display: "flex", flexDirection: "row" }}>
        {/* LEFT — manual (silver) */}
        <div style={{ width: width / 2, height, background: SILVER, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${SILVER_SOFT} 1px, transparent 1px), linear-gradient(90deg, ${SILVER_SOFT} 1px, transparent 1px)`, backgroundSize: "60px 60px", opacity: 0.5 }} />
          <div style={{ position: "absolute", left: 70, top: 90, opacity: leftIn }}>
            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, letterSpacing: "0.2em", color: BODY }}>{left.label}</div>
          </div>
          {chips.map((c, i) => {
            const s = rev(frame, 16 + i * 4, 14);
            return (
              <div key={i} style={{ position: "absolute", left: c.x, top: c.y, width: c.w * s, height: 40, background: WHITE, border: `1px solid ${SILVER_SOFT}`, borderRadius: R_SURFACE, transform: `rotate(${c.r}deg)`, opacity: s, display: "flex", alignItems: "center", paddingLeft: 14, gap: 10, overflow: "hidden" }}>
                <span style={{ width: 16, height: 16, border: `2px solid ${BODY}`, display: "inline-block" }} />
                <span style={{ width: c.w * 0.5, height: 8, background: SILVER_SOFT, display: "inline-block" }} />
              </div>
            );
          })}
          <div style={{ position: "absolute", left: 70, bottom: 90, opacity: leftIn }}>
            <StatValue size={96} color={RAISIN}>{left.stat}</StatValue>
            <div style={{ fontFamily: MONO, fontSize: 22, color: BODY, marginTop: 6 }}>{left.sub}</div>
          </div>
        </div>

        {/* RIGHT — automated (raisin) */}
        <div style={{ width: width / 2, height, background: RAISIN, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${STEEL}55 1px, transparent 1px), linear-gradient(90deg, ${STEEL}55 1px, transparent 1px)`, backgroundSize: "60px 60px", opacity: 0.4 }} />
          <div style={{ position: "absolute", right: 70, top: 90, textAlign: "right", opacity: rightIn }}>
            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, letterSpacing: "0.2em", color: LIME }}>{right.label}</div>
          </div>
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
            <svg width={300} height={300} style={{ marginTop: -40 }}>
              <circle cx={150} cy={150} r={110} fill="none" stroke={STEEL} strokeWidth={14} />
              <circle cx={150} cy={150} r={110} fill="none" stroke={LIME} strokeWidth={14} strokeLinecap="round" strokeDasharray={691} strokeDashoffset={691 * (1 - loop)} transform="rotate(-90 150 150)" />
              {(() => { const a = (-90 + 360 * loop) * (Math.PI / 180); return <circle cx={150 + 110 * Math.cos(a)} cy={150 + 110 * Math.sin(a)} r={11} fill={LIME} />; })()}
            </svg>
          </AbsoluteFill>
          <div style={{ position: "absolute", right: 70, bottom: 90, textAlign: "right" }}>
            <StatValue size={96} color={LIME}>{right.stat}</StatValue>
            <div style={{ fontFamily: MONO, fontSize: 22, color: SILVER_MID, marginTop: 6 }}>{right.sub}</div>
          </div>
        </div>

        {/* divider + VS */}
        <div style={{ position: "absolute", left: width / 2 - 3, top: 0, width: 6, height: height * wipe, background: LIME }} />
        {wipe > 0.9 && (
          <div style={{ position: "absolute", left: width / 2, top: height / 2, transform: "translate(-50%,-50%)" }}>
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, background: RAISIN, transform: "translate(6px,6px)" }} />
              <div style={{ position: "relative", background: LIME, color: RAISIN, fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 34, padding: "10px 20px" }}>VS</div>
            </div>
          </div>
        )}
      </AbsoluteFill>
    </ComparisonStage>
  );
};

import React from "react";
import { useCurrentFrame } from "remotion";
import {
  SingleObjectStage, Eyebrow, clamp, rev,
  LIME, STEEL, SILVER_MID, WHITE, RAISIN, SANS, MONO,
} from "../kit";
import { BgKey } from "../tokens";

/**
 * whileYouSleep — a moon crosses an arc to a rising sun while task rows check off
 * one by one. Concept: "Claude fixes it before I wake up." Distinct night→dawn device.
 */
export type WhileYouSleepProps = {
  eyebrow: string;
  tasks: string[];      // done overnight
  label?: string;
  bg?: BgKey;
};

const SZ = 940;

export const WhileYouSleep: React.FC<WhileYouSleepProps> = ({ eyebrow, tasks, label, bg }) => {
  const frame = useCurrentFrame();
  const p = clamp((frame - 10) / 96, 0, 1);
  const cx = SZ / 2, R = 300, cy = 350;
  const th = Math.PI * (1 - p);
  const tx = cx + R * Math.cos(th);
  const ty = cy - R * Math.sin(th);
  const dawn = p > 0.72;
  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} move="push-in">
        <div style={{ position: "relative", width: SZ, height: 740 }}>
          <svg width={SZ} height={740} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`} fill="none" stroke={STEEL} strokeWidth={2.5} strokeDasharray="5 9" />
            <line x1={cx - R - 50} y1={cy} x2={cx + R + 50} y2={cy} stroke={STEEL} strokeWidth={2} />
            {dawn && [...Array(8)].map((_, i) => {
              const a = (i * Math.PI) / 4;
              return <line key={i} x1={tx + Math.cos(a) * 32} y1={ty + Math.sin(a) * 32} x2={tx + Math.cos(a) * 50} y2={ty + Math.sin(a) * 50} stroke={LIME} strokeWidth={4} strokeLinecap="round" />;
            })}
            <circle cx={tx} cy={ty} r={27} fill={dawn ? LIME : "#C9D2D6"} style={{ filter: dawn ? `drop-shadow(0 0 14px ${LIME})` : undefined }} />
            {!dawn && <circle cx={tx + 10} cy={ty - 6} r={22} fill={RAISIN} />}
          </svg>
          <div style={{ position: "absolute", top: 420, left: cx - 270, width: 540, display: "flex", flexDirection: "column", gap: 16 }}>
            {tasks.map((t, i) => {
              const done = rev(frame, 28 + i * 18, 10);
              const on = done > 0.5;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, opacity: 0.35 + done * 0.65 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 8, background: on ? LIME : "transparent", border: `2px solid ${on ? LIME : STEEL}`, display: "flex", alignItems: "center", justifyContent: "center", color: RAISIN, fontWeight: 900, fontSize: 21, boxShadow: on ? `0 0 12px ${LIME}66` : undefined }}>{on ? "✓" : ""}</span>
                  <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 30, color: on ? WHITE : SILVER_MID }}>{t}</span>
                </div>
              );
            })}
          </div>
          {label && <div style={{ position: "absolute", top: 680, width: SZ, textAlign: "center", fontFamily: MONO, fontSize: 18, color: SILVER_MID, letterSpacing: "0.12em", textTransform: "uppercase" }}>{label}</div>}
        </div>
      </SingleObjectStage>
    </>
  );
};

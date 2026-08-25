import React from "react";
import { useCurrentFrame, spring } from "remotion";
import {
  SingleObjectStage, Eyebrow, clamp, lerp, rev,
  LIME, STEEL, WHITE, RAISIN, SILVER_MID, SANS, MONO,
} from "../kit";
import { BgKey } from "../tokens";

/**
 * orchestra — scattered agent dots (half "alone", dim) get wired to a central
 * orchestrator and light up in sync. Concept: "orchestration beats agent count —
 * 12 agents, half work alone."
 */
export type OrchestraProps = {
  eyebrow: string;
  hub: string;
  agents?: number;
  caption?: string;
  bg?: BgKey;
};

const G = 1160, CX = G / 2, CY = G / 2, R = 380;

export const Orchestra: React.FC<OrchestraProps> = ({ eyebrow, hub, agents = 12, caption, bg }) => {
  const frame = useCurrentFrame();
  const wire = rev(frame, 40, 40); // fraction of agents wired so far
  const dots = [...Array(agents)].map((_, i) => {
    const a = (-90 + (i * 360) / agents) * (Math.PI / 180);
    const jitter = (i % 3 - 1) * 26;
    return { x: CX + (R + jitter) * Math.cos(a), y: CY + (R + jitter) * Math.sin(a), lit: (i / agents) < wire };
  });
  const hubP = clamp(spring({ frame: frame - 2, fps: 30, config: { damping: 13, stiffness: 140 } }), 0, 1);
  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} move="reveal-out">
        <div style={{ position: "relative", width: G, height: G }}>
          <svg width={G} height={G} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            {dots.map((d, i) => d.lit && (
              <line key={i} x1={CX} y1={CY} x2={lerp(CX, d.x, clamp((wire - i / agents) * 6, 0, 1))} y2={lerp(CY, d.y, clamp((wire - i / agents) * 6, 0, 1))} stroke={LIME} strokeWidth={2.5} opacity={0.7} />
            ))}
            {dots.map((d, i) => (
              <circle key={`d${i}`} cx={d.x} cy={d.y} r={16} fill={d.lit ? LIME : RAISIN} stroke={d.lit ? LIME : STEEL} strokeWidth={2.5} opacity={d.lit ? 1 : 0.55}
                style={{ filter: d.lit ? `drop-shadow(0 0 8px ${LIME})` : undefined }} />
            ))}
          </svg>
          <div style={{ position: "absolute", left: CX, top: CY, transform: `translate(-50%,-50%) scale(${0.6 + hubP * 0.4})` }}>
            <div style={{ width: 250, height: 116, background: RAISIN, border: `2px solid ${LIME}`, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 24px ${LIME}55` }}>
              <span style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 32, color: LIME, letterSpacing: "-0.02em" }}>{hub}</span>
            </div>
          </div>
        </div>
      </SingleObjectStage>
    </>
  );
};

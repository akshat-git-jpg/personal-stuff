import React from "react";
import { useCurrentFrame, spring } from "remotion";
import {
  SingleObjectStage, Eyebrow, clamp, lerp, rev,
  LIME, STEEL, WHITE, RAISIN, SILVER_SOFT, SILVER_MID, SANS, MONO, R_SURFACE, R_INK,
} from "../kit";
import { BgKey } from "../tokens";

/**
 * brainBuild — labeled "brain" node at center; file nodes fly in around it and
 * wire IN with pulses traveling inward. The center brightens as more connect.
 * Concept: "context engineering — build your business a brain."
 */
export type BrainBuildProps = {
  eyebrow: string;
  center: string;        // e.g. "BUSINESS BRAIN"
  files: string[];       // e.g. ["MEMORY.md","KNOWLEDGE","ME-CONTEXT","STORY BANK"]
  bg?: BgKey;
};

const G = 1140, CX = G / 2, CY = G / 2, R = 360;

export const BrainBuild: React.FC<BrainBuildProps> = ({ eyebrow, center, files, bg }) => {
  const frame = useCurrentFrame();
  const n = Math.max(1, files.length);
  const nodes = files.map((label, i) => {
    const a = (-90 + (i * 360) / n) * (Math.PI / 180);
    return { label, x: CX + R * Math.cos(a), y: CY + R * Math.sin(a), connect: rev(frame, 16 + i * 6, 20) };
  });
  const connected = nodes.filter((nd) => nd.connect > 0.95).length;
  const brainP = clamp(spring({ frame: frame - 2, fps: 30, config: { damping: 13, stiffness: 130 } }), 0, 1);
  const glow = 8 + connected * 6;

  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} move="reveal-out">
        <div style={{ position: "relative", width: G, height: G }}>
          <svg width={G} height={G} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            {nodes.map((nd, i) => (
              <line key={`l${i}`} x1={nd.x} y1={nd.y} x2={lerp(nd.x, CX, nd.connect)} y2={lerp(nd.y, CY, nd.connect)} stroke={STEEL} strokeWidth={2.5} />
            ))}
            {nodes.map((nd, i) => {
              if (nd.connect < 0.99) return null;
              const t = ((frame + i * 9) % 40) / 40;
              return <circle key={`p${i}`} cx={lerp(nd.x, CX, t)} cy={lerp(nd.y, CY, t)} r={5} fill={LIME} />;
            })}
          </svg>
          {/* file nodes */}
          {nodes.map((nd, i) => (
            <div key={i} style={{ position: "absolute", left: nd.x, top: nd.y, transform: "translate(-50%,-50%)", opacity: rev(frame, 12 + i * 6, 10) }}>
              <div style={{ background: RAISIN, border: `1px solid ${STEEL}`, borderRadius: R_SURFACE, padding: "12px 20px", fontFamily: MONO, fontSize: 20, fontWeight: 700, color: WHITE, whiteSpace: "nowrap" }}>{nd.label}</div>
            </div>
          ))}
          {/* center brain */}
          <div style={{ position: "absolute", left: CX, top: CY, transform: `translate(-50%,-50%) scale(${0.6 + brainP * 0.4})` }}>
            <div style={{ position: "relative" }}>
              <div aria-hidden style={{ position: "absolute", inset: -60, background: `radial-gradient(closest-side, ${LIME}${connected ? "40" : "18"}, transparent 70%)`, filter: "blur(8px)" }} />
              <div style={{ position: "relative", width: 260, height: 130, background: RAISIN, border: `2px solid ${LIME}`, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 ${glow}px ${LIME}66`, textAlign: "center" }}>
                <span style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 34, color: LIME, letterSpacing: "-0.02em", padding: "0 16px" }}>{center}</span>
              </div>
            </div>
          </div>
        </div>
      </SingleObjectStage>
    </>
  );
};

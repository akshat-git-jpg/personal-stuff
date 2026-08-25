import React from "react";
import { useCurrentFrame, spring } from "remotion";
import {
  SingleObjectStage, Eyebrow, clamp, lerp, rev,
  RAISIN, RAISIN_DEEP, STEEL, SILVER, LIME, WHITE, SANS, MONO, R_SURFACE, R_INK,
} from "../kit";
import { BgKey } from "../tokens";

export type NetworkProps = {
  eyebrow: string;
  hub: string;          // central node label, e.g. "Command"
  nodes: string[];      // 3-8 satellite labels
  bg?: BgKey;           // default "grid-dark"
};

/* graph laid out in a fixed square group; the stage centers it and owns the camera */
const GROUP = 1120;
const CX = GROUP / 2; // 560
const CY = GROUP / 2; // 560
const R = 340;

export const Network: React.FC<NetworkProps> = ({ eyebrow, hub, nodes, bg }) => {
  const frame = useCurrentFrame();
  const n = Math.max(1, nodes.length);
  const sats = nodes.map((label, i) => {
    const a = (-90 + (i * 360) / n) * (Math.PI / 180);
    return { label, x: CX + R * Math.cos(a), y: CY + R * Math.sin(a) };
  });

  const hubSpring = clamp(spring({ frame: frame - 2, fps: 30, config: { damping: 13, stiffness: 140 } }), 0, 1);

  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} move="reveal-out" designW={830} designH={780}>
        <div style={{ position: "relative", width: GROUP, height: GROUP }}>
          {/* steel links + traveling lime data pulses */}
          <svg width={GROUP} height={GROUP} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            {sats.map((s, i) => {
              const draw = rev(frame, 14 + i * 5, 22);
              return (
                <line
                  key={`l-${i}`}
                  x1={CX}
                  y1={CY}
                  x2={lerp(CX, s.x, draw)}
                  y2={lerp(CY, s.y, draw)}
                  stroke={STEEL}
                  strokeWidth={2.5}
                />
              );
            })}
            {sats.map((s, i) => {
              const drawnAt = 14 + i * 5 + 22;
              if (frame < drawnAt) return null;
              return [0, 0.5].map((ph, k) => {
                const t = (frame * 0.02 + ph + i * 0.13) % 1;
                const tt = t < 0.5 ? t * 2 : (1 - t) * 2; // outward then back
                const op = Math.sin(tt * Math.PI);
                return (
                  <circle
                    key={`p-${i}-${k}`}
                    cx={lerp(CX, s.x, tt)}
                    cy={lerp(CY, s.y, tt)}
                    r={6}
                    fill={LIME}
                    opacity={op}
                  />
                );
              });
            })}
          </svg>

          {/* satellite nodes — staggered spring-in chips */}
          {sats.map((s, i) => {
            const sp = clamp(spring({ frame: frame - (20 + i * 5), fps: 30, config: { damping: 14, stiffness: 160 } }), 0, 1);
            return (
              <div
                key={`n-${i}`}
                style={{
                  position: "absolute",
                  left: s.x,
                  top: s.y,
                  transform: `translate(-50%,-50%) scale(${sp})`,
                  opacity: sp,
                  background: RAISIN_DEEP,
                  border: `1px solid ${STEEL}`,
                  borderRadius: R_SURFACE,
                  padding: "14px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  boxShadow: "0 14px 30px -12px rgba(0,0,0,0.7)",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ width: 9, height: 9, background: LIME, display: "inline-block" }} />
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 22, letterSpacing: "0.08em", textTransform: "uppercase", color: SILVER }}>
                  {s.label}
                </span>
              </div>
            );
          })}

          {/* central hub — raisin box, 2px lime border, lime hard-offset block */}
          <div
            style={{
              position: "absolute",
              left: CX,
              top: CY,
              transform: `translate(-50%,-50%) scale(${lerp(0.85, 1, hubSpring)})`,
              opacity: rev(frame, 0, 8),
            }}
          >
            <div style={{ position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, background: LIME, transform: "translate(9px,9px)", borderRadius: R_INK }} />
              <div style={{ position: "relative", background: RAISIN, border: `2px solid ${LIME}`, borderRadius: R_INK, padding: "26px 40px", textAlign: "center" }}>
                <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: LIME }}>CENTRAL</div>
                <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 38, letterSpacing: "-0.02em", textTransform: "uppercase", color: WHITE }}>{hub}</div>
              </div>
            </div>
          </div>
        </div>
      </SingleObjectStage>
    </>
  );
};

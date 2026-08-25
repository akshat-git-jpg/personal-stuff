import React from "react";
import { useCurrentFrame } from "remotion";
import {
  SingleObjectStage, Eyebrow, clamp, rev,
  LIME, STEEL, WHITE, RAISIN, SILVER_MID, SANS, MONO, R_SURFACE,
} from "../kit";
import { BgKey } from "../tokens";

/**
 * streamsToOne — labeled streams on the left flow along curves into one target
 * node on the right, pulses traveling. Concept: "run 5 businesses through one
 * Claude window."
 */
export type StreamsToOneProps = {
  eyebrow: string;
  streams: string[];
  target: string;
  bg?: BgKey;
};

const W = 1300, H = 780, LX = 120, RX = 1120, TY = H / 2;

export const StreamsToOne: React.FC<StreamsToOneProps> = ({ eyebrow, streams, target, bg }) => {
  const frame = useCurrentFrame();
  const n = streams.length;
  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} move="push-in">
        <div style={{ position: "relative", width: W, height: H }}>
          <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            {streams.map((_, i) => {
              const y = (H / (n + 1)) * (i + 1);
              const draw = rev(frame, 16 + i * 5, 26);
              const cx = (LX + RX) / 2;
              const d = `M ${LX + 120} ${y} C ${cx} ${y}, ${cx} ${TY}, ${RX - 130} ${TY}`;
              return <path key={i} d={d} fill="none" stroke={STEEL} strokeWidth={2.5} strokeDasharray={1600} strokeDashoffset={(1 - draw) * 1600} />;
            })}
            {streams.map((_, i) => {
              const y = (H / (n + 1)) * (i + 1);
              if (rev(frame, 16 + i * 5, 26) < 0.99) return null;
              const t = ((frame + i * 11) % 44) / 44;
              const cx = (LX + RX) / 2;
              // approximate point along the cubic
              const bx = (1 - t) ** 3 * (LX + 120) + 3 * (1 - t) ** 2 * t * cx + 3 * (1 - t) * t * t * cx + t ** 3 * (RX - 130);
              const by = (1 - t) ** 3 * y + 3 * (1 - t) ** 2 * t * y + 3 * (1 - t) * t * t * TY + t ** 3 * TY;
              return <circle key={`p${i}`} cx={bx} cy={by} r={5} fill={LIME} />;
            })}
          </svg>
          {streams.map((s, i) => {
            const y = (H / (n + 1)) * (i + 1);
            return (
              <div key={i} style={{ position: "absolute", left: LX, top: y, transform: "translate(0,-50%)", opacity: rev(frame, 12 + i * 5, 10), background: RAISIN, border: `1px solid ${STEEL}`, borderRadius: R_SURFACE, padding: "10px 20px", fontFamily: MONO, fontSize: 20, fontWeight: 700, color: WHITE, whiteSpace: "nowrap" }}>{s}</div>
            );
          })}
          <div style={{ position: "absolute", left: RX, top: TY, transform: "translate(-50%,-50%)" }}>
            <div style={{ width: 220, height: 130, background: RAISIN, border: `2px solid ${LIME}`, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 24px ${LIME}55`, textAlign: "center" }}>
              <span style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 30, color: LIME, letterSpacing: "-0.02em", padding: "0 14px" }}>{target}</span>
            </div>
          </div>
        </div>
      </SingleObjectStage>
    </>
  );
};

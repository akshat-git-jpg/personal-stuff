import React from "react";
import { useCurrentFrame } from "remotion";
import {
  SingleObjectStage, Eyebrow, clamp, rev,
  RAISIN, LIME, STEEL, WHITE, SILVER_MID, SANS, MONO,
} from "../kit";
import { BgKey } from "../tokens";

/**
 * loop — the signature "build loops, don't prompt" visual.
 * A ring (the loop) with a lime token cycling it; each completed lap spits out a
 * "shipped" tick that flies outward and fades. Concept: you write the loop once,
 * it runs forever and keeps producing. NOT a title card — a literal running loop.
 */
export type LoopProps = {
  eyebrow: string;
  label: string;        // center label, e.g. "AGENT LOOP"
  caption?: string;     // small line under the label
  bg?: BgKey;
};

const SZ = 760;
const C = SZ / 2;
const R = 250;
const LAP = 54; // frames per lap

export const Loop: React.FC<LoopProps> = ({ eyebrow, label, caption, bg }) => {
  const frame = useCurrentFrame();
  const lapsF = Math.max(0, frame - 16) / LAP;          // start cycling after the ring draws
  const ang = (lapsF * 360 - 90) * (Math.PI / 180);
  const tx = C + R * Math.cos(ang);
  const ty = C + R * Math.sin(ang);
  const laps = Math.floor(lapsF);
  const drawRing = rev(frame, 4, 22);
  const circ = 2 * Math.PI * R;

  // one "shipped" output per completed lap (spawns at top, flies out + fades)
  const ships: number[] = [];
  for (let k = 1; k <= laps; k++) ships.push(16 + k * LAP);

  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} move="push-in">
        <div style={{ position: "relative", width: SZ, height: SZ }}>
          <svg width={SZ} height={SZ} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            {/* the loop ring (draws in) */}
            <circle
              cx={C} cy={C} r={R} fill="none" stroke={STEEL} strokeWidth={3}
              strokeDasharray={circ} strokeDashoffset={(1 - drawRing) * circ}
              transform={`rotate(-90 ${C} ${C})`}
            />
            {/* lime progress arc trailing the token (last ~0.4 lap) */}
            {frame > 16 && (
              <circle
                cx={C} cy={C} r={R} fill="none" stroke={LIME} strokeWidth={4} strokeLinecap="round"
                strokeDasharray={`${circ * 0.12} ${circ}`}
                strokeDashoffset={-(((lapsF % 1) * circ) - circ * 0.12)}
                transform={`rotate(-90 ${C} ${C})`}
                opacity={0.9}
              />
            )}
            {/* shipped outputs flying out from the top */}
            {ships.map((sf, i) => {
              const age = frame - sf;
              if (age < 0 || age > 30) return null;
              const p = clamp(age / 30, 0, 1);
              const a2 = -90 * (Math.PI / 180);
              const ex = C + (R + p * 130) * Math.cos(a2);
              const ey = C + (R + p * 130) * Math.sin(a2);
              return <circle key={i} cx={ex} cy={ey} r={10} fill={LIME} opacity={1 - p} />;
            })}
            {/* the traveling token */}
            {frame > 14 && (
              <circle cx={tx} cy={ty} r={17} fill={LIME} stroke={RAISIN} strokeWidth={4} />
            )}
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 60, color: WHITE, letterSpacing: "-0.02em", lineHeight: 1 }}>{label}</div>
            {caption && <div style={{ fontFamily: MONO, fontSize: 17, color: SILVER_MID, marginTop: 14, maxWidth: 320, lineHeight: 1.5 }}>{caption}</div>}
          </div>
        </div>
      </SingleObjectStage>
    </>
  );
};

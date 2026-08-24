import React from "react";
import { useCurrentFrame } from "remotion";
import {
  SingleObjectStage, rev, impact, Flash,
  LIME, WHITE, SILVER_MID, SANS, MONO,
} from "../kit";
import { BgKey } from "../tokens";

/**
 * automationDead — the "dead" word gets a stamp slammed over it and dims, then
 * the "alive" word rises in lime. Concept: "Automation is dead → Loops."
 */
export type AutomationDeadProps = {
  eyebrow: string;
  dead: string;        // e.g. "AUTOMATION"
  alive: string;       // e.g. "LOOPS"
  stamp?: string;      // e.g. "DEAD"
  bg?: BgKey;
};

export const AutomationDead: React.FC<AutomationDeadProps> = ({ eyebrow, dead, alive, stamp = "DEAD", bg }) => {
  const frame = useCurrentFrame();
  const stampP = rev(frame, 26, 8);
  const stamped = stampP > 0.1;
  const rise = rev(frame, 44, 16);
  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} move="push-in">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
          <div style={{ position: "relative", opacity: rev(frame, 4, 12) }}>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 120, letterSpacing: "-0.03em", color: stamped ? "#4a5170" : WHITE }}>{dead}</span>
            {/* stamp */}
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(-50%,-50%) rotate(-11deg) scale(${(1.4 - stampP * 0.4) * impact(frame, 34, 0.18, 7)})`, opacity: stampP, border: `5px solid ${LIME}`, borderRadius: 10, padding: "6px 26px", boxShadow: `0 0 20px ${LIME}66` }}>
              <span style={{ fontFamily: SANS, fontWeight: 900, fontSize: 62, letterSpacing: "0.04em", color: LIME }}>{stamp}</span>
            </div>
          </div>
          {/* payoff */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, opacity: rise, transform: `translateY(${(1 - rise) * 30}px)` }}>
            <span style={{ fontFamily: MONO, fontSize: 40, fontWeight: 700, color: SILVER_MID }}>→</span>
            <span style={{ position: "relative", display: "inline-block" }}>
              <span aria-hidden style={{ position: "absolute", inset: -60, background: `radial-gradient(closest-side, ${LIME}44, transparent 70%)`, filter: "blur(8px)", opacity: rise }} />
              <span style={{ position: "relative", fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 108, color: LIME, letterSpacing: "-0.03em" }}>{alive}</span>
            </span>
          </div>
        </div>
      </SingleObjectStage>
      <Flash hit={34} len={10} peak={0.36} />
    </>
  );
};

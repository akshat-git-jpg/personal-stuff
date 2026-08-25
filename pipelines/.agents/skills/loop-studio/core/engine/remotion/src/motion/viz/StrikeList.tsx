import React from "react";
import { useCurrentFrame } from "remotion";
import {
  SingleObjectStage, Eyebrow, rev,
  LIME, WHITE, SILVER_MID, SANS, MONO,
} from "../kit";
import { BgKey } from "../tokens";

/**
 * strikeList — big items struck through one by one (lime), then a payoff line.
 * Concept device for "you don't need X / replaced my team": each role/skill gets
 * crossed out in sequence, then "→ CLAUDE" lands. Inspired by the glowing
 * struck-through reference, kept on System-v1 (lime strike, no off-palette red).
 */
export type StrikeListProps = {
  eyebrow: string;
  items: string[];
  replacedBy?: string;   // payoff, e.g. "CLAUDE"
  bg?: BgKey;
};

const PER = 22;

export const StrikeList: React.FC<StrikeListProps> = ({ eyebrow, items, replacedBy, bg }) => {
  const frame = useCurrentFrame();
  return (
    <>
      <SingleObjectStage bg={bg ?? "grid-dark"} stable>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, alignItems: "flex-start" }}>
          {items.map((it, i) => {
            const appear = rev(frame, 8 + i * PER, 8);
            const strike = rev(frame, 15 + i * PER, 11);
            const struck = strike > 0.02;
            return (
              <div key={i} style={{ position: "relative", display: "inline-block", opacity: appear, transform: `translateX(${(1 - appear) * -28}px)` }}>
                <span style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 70, letterSpacing: "-0.02em", color: struck ? SILVER_MID : WHITE }}>{it}</span>
                <div style={{ position: "absolute", left: -4, top: "53%", height: 7, width: `calc(${strike * 100}% + 8px)`, background: LIME, transform: "translateY(-50%) rotate(-1.2deg)", borderRadius: 4 }} />
              </div>
            );
          })}
          {replacedBy && (() => {
            const a = rev(frame, 16 + items.length * PER + 6, 12);
            return (
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 18, opacity: a, transform: `translateY(${(1 - a) * 18}px)` }}>
                <span style={{ fontFamily: MONO, fontSize: 30, fontWeight: 700, color: SILVER_MID }}>→</span>
                <span style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: 76, letterSpacing: "-0.02em", color: LIME }}>{replacedBy}</span>
              </div>
            );
          })()}
        </div>
      </SingleObjectStage>
    </>
  );
};

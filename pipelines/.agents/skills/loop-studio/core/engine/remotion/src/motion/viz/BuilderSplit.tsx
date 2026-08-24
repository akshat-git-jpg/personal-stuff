import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ComparisonStage, rev, clamp, SILVER, SILVER_SOFT, BODY, RAISIN, STEEL, LIME, WHITE, MONO, SANS, R_SURFACE, R_INK } from "../kit";

export type BuilderSplitProps = {
  leftLabel?: string;
  leftPunch?: string;
  rightLabel?: string;
  rightPunch?: string;
};

/* Identity contrast for "this channel is for real builders, NOT for people who
   just watch and never finish". Framed split (no camera): the watcher side piles
   up unfinished tutorials and reads NEVER FINISH; the builder side ships. */
export const BuilderSplit: React.FC<BuilderSplitProps> = ({
  leftLabel = "tutorial watchers",
  leftPunch = "NEVER FINISH",
  rightLabel = "real builders",
  rightPunch = "THEY SHIP",
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const wipe = rev(frame, 6, 18);
  const leftIn = rev(frame, 12, 18);
  const rightIn = rev(frame, 22, 18);

  // unfinished tutorial cards stacking up on the watcher side
  const cards = [0, 1, 2, 3];

  return (
    <ComparisonStage>
      <AbsoluteFill style={{ display: "flex", flexDirection: "row" }}>
        {/* LEFT — the watcher (grey) */}
        <div style={{ width: width / 2, height, background: SILVER, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${SILVER_SOFT} 1px, transparent 1px), linear-gradient(90deg, ${SILVER_SOFT} 1px, transparent 1px)`, backgroundSize: "60px 60px", opacity: 0.5 }} />
          <div style={{ position: "absolute", left: 80, top: 96, display: "flex", alignItems: "center", gap: 12, opacity: leftIn }}>
            <span style={{ width: 14, height: 14, border: `3px solid ${BODY}`, display: "inline-block" }} />
            <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, letterSpacing: "0.18em", color: BODY, textTransform: "uppercase" }}>{leftLabel}</span>
          </div>
          {/* stack of dim, unfinished tutorial rows */}
          <div style={{ position: "absolute", left: 80, top: 220 }}>
            {cards.map((i) => {
              const s = rev(frame, 16 + i * 5, 14);
              const rot = [-3, 2, -2, 3][i];
              return (
                <div key={i} style={{ width: width / 2 - 200, height: 86, background: WHITE, border: `1px solid ${SILVER_SOFT}`, borderRadius: R_SURFACE, marginBottom: 18, transform: `translateY(${(1 - s) * 24}px) rotate(${rot}deg)`, opacity: s * 0.78, display: "flex", alignItems: "center", gap: 18, paddingLeft: 22 }}>
                  <div style={{ width: 60, height: 44, borderRadius: 8, background: SILVER_SOFT, position: "relative", flex: "0 0 auto" }}>
                    <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 0, height: 0, borderLeft: `14px solid ${BODY}`, borderTop: "9px solid transparent", borderBottom: "9px solid transparent", marginLeft: 3 }} />
                  </div>
                  <div style={{ width: 16, height: 16, border: `2px solid ${BODY}`, borderRadius: 3 }} />
                  <div style={{ width: 150, height: 10, background: SILVER_SOFT, borderRadius: 4 }} />
                </div>
              );
            })}
          </div>
          <div style={{ position: "absolute", left: 80, bottom: 90, opacity: leftIn }}>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 76, color: RAISIN, textTransform: "uppercase", letterSpacing: "-0.02em", lineHeight: 0.98 }}>{leftPunch}</div>
          </div>
        </div>

        {/* RIGHT — the builder (raisin + lime) */}
        <div style={{ width: width / 2, height, background: RAISIN, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${STEEL}55 1px, transparent 1px), linear-gradient(90deg, ${STEEL}55 1px, transparent 1px)`, backgroundSize: "60px 60px", opacity: 0.4 }} />
          <div style={{ position: "absolute", right: 80, top: 96, display: "flex", alignItems: "center", gap: 12, opacity: rightIn }}>
            <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, letterSpacing: "0.18em", color: LIME, textTransform: "uppercase" }}>{rightLabel}</span>
            <span style={{ width: 14, height: 14, background: LIME, display: "inline-block" }} />
          </div>
          {/* shipped rows — checked, lime */}
          <div style={{ position: "absolute", right: 80, top: 220, display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            {[0, 1, 2].map((i) => {
              const s = rev(frame, 26 + i * 6, 14);
              return (
                <div key={i} style={{ width: width / 2 - 220, height: 86, background: RAISIN, border: `1.5px solid ${STEEL}`, borderRadius: R_SURFACE, marginBottom: 18, transform: `translateX(${(1 - s) * 30}px)`, opacity: s, display: "flex", alignItems: "center", gap: 18, paddingLeft: 22 }}>
                  <div style={{ width: 40, height: 40, borderRadius: R_INK, background: LIME, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                    <svg width={24} height={24} viewBox="0 0 24 24"><path d="M4 12.5 L10 18 L20 6" fill="none" stroke={RAISIN} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 22, color: SILVER, letterSpacing: "0.04em" }}>{["shipped", "deployed", "live"][i]}</div>
                </div>
              );
            })}
          </div>
          <div style={{ position: "absolute", right: 80, bottom: 90, textAlign: "right", opacity: rightIn }}>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 76, color: LIME, textTransform: "uppercase", letterSpacing: "-0.02em", lineHeight: 0.98 }}>{rightPunch}</div>
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

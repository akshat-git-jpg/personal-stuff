import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { clamp, SANS, RAISIN, LIME, BODY, R_SURFACE, R_INK } from "../kit";

export type BuildVsLearnOverlayProps = {
  learn?: string;   // the rejected path
  build?: string;   // the chosen path
  side?: "right" | "left";
};

const interp = (v: number, a: number, b: number) => a + (b - a) * v;

/* TRANSPARENT overlay (renders to alpha webm) for "I wanted to BUILD real stuff,
   rather than just LEARNING about them." Two stacked tags float on one side so the
   speaker stays visible: the "just learn" tag is dim + struck through, the "build"
   tag is solid lime with a check. NO background — composites over the speaker. */
export const BuildVsLearnOverlay: React.FC<BuildVsLearnOverlayProps> = ({
  learn = "JUST LEARN ABOUT IT",
  build = "BUILD REAL STUFF",
  side = "right",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // speech order: "BUILD real stuff" first, THEN "rather than just LEARNING".
  // build slams in early; learn appears later and gets struck through.
  const s2 = spring({ frame: frame - 18, fps, config: { damping: 12, stiffness: 180 } }); // build
  const s1 = spring({ frame: frame - 58, fps, config: { damping: 16, stiffness: 150 } }); // learn
  const strike = clamp((frame - 72) / 12, 0, 1);
  const dx = side === "right" ? 80 : -80;
  const align = side === "right" ? "flex-end" : "flex-start";
  const posStyle: React.CSSProperties = side === "right"
    ? { right: 110 }
    : { left: 110 };

  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", ...posStyle, display: "flex", flexDirection: "column", alignItems: align, gap: 30 }}>
        {/* BUILD tag — solid lime, checked, slams in first ("build real stuff") */}
        <div
          style={{
            position: "relative",
            opacity: clamp(s2 * 1.3, 0, 1),
            transform: `translateX(${interp(clamp(s2, 0, 1), 1, 0) * dx}px) scale(${interp(clamp(s2, 0, 1), 1.12, 1)})`,
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: RAISIN, borderRadius: R_SURFACE, transform: "translate(9px,9px)" }} />
          <div style={{ position: "relative", background: LIME, borderRadius: R_SURFACE, padding: "22px 34px", display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 38, height: 38, borderRadius: R_INK, background: RAISIN, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
              <svg width={22} height={22} viewBox="0 0 24 24"><path d="M4 12.5 L10 18 L20 6" fill="none" stroke={LIME} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 52, color: RAISIN, textTransform: "uppercase", letterSpacing: "-0.02em" }}>{build}</span>
          </div>
        </div>

        {/* LEARN tag — appears after ("rather than just learning"), struck through */}
        <div
          style={{
            position: "relative",
            opacity: clamp(s1, 0, 1),
            transform: `translateX(${interp(clamp(s1, 0, 1), 1, 0) * dx}px)`,
            background: "rgba(233,236,237,0.92)",
            border: `2px solid ${BODY}`,
            borderRadius: R_SURFACE,
            padding: "16px 26px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            boxShadow: "0 18px 50px rgba(15,18,26,0.30)",
          }}
        >
          <span style={{ width: 26, height: 26, borderRadius: "50%", border: `3px solid ${BODY}`, display: "flex", alignItems: "center", justifyContent: "center", color: BODY, fontFamily: SANS, fontWeight: 700, fontSize: 18, flex: "0 0 auto" }}>✕</span>
          <span style={{ position: "relative", fontFamily: SANS, fontWeight: 700, fontSize: 38, color: BODY, textTransform: "uppercase", letterSpacing: "-0.01em" }}>
            {learn}
            <span style={{ position: "absolute", left: -4, right: -4, top: "52%", height: 5, background: "#C62828", transform: `scaleX(${strike})`, transformOrigin: "left center", borderRadius: 3 }} />
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

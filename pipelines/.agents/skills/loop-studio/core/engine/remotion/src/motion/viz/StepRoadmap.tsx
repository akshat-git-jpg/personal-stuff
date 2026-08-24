import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { clamp, SANS, MONO, RAISIN, LIME, BODY, R_INK } from "../kit";

export type Step = { n: string; key: string; desc: string; accent?: boolean };
export type StepRoadmapProps = {
  eyebrow?: string;
  steps?: Step[];
  // reveal time for each step as a fraction of the beat (synced to the spoken points)
  at?: number[];
};

const DEFAULT_STEPS: Step[] = [
  { n: "01", key: "IGNORE", desc: "the hype & the noise" },
  { n: "02", key: "LEARN", desc: "what actually matters" },
  { n: "03", key: "INCOME", desc: "turn AI into money", accent: true },
];

/* Three spoken points rendered as STRUCTURE, not three centered lines: a
   numbered roadmap with a connecting spine, each step sliding in as it's
   spoken, the payoff step accented lime. */
export const StepRoadmap: React.FC<StepRoadmapProps> = ({
  eyebrow = "the plan",
  steps = DEFAULT_STEPS,
  at = [0.04, 0.34, 0.74],
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const BADGE = 104;
  const ROW_GAP = 56;

  const revealOf = (i: number) => Math.round((at[i] ?? i * 0.3) * durationInFrames);
  // spine grows down as steps appear
  const lastShown = steps.reduce((acc, _s, i) => (frame >= revealOf(i) ? i : acc), -1);
  const spineP = clamp(interpolate(frame, [revealOf(0), revealOf(Math.max(0, steps.length - 1)) + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), 0, 1);

  return (
    <AbsoluteFill style={{ backgroundColor: "#D9DDE4" }}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img src={staticFile("brand/grid-light.png")} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(206,211,219,0.45)" }} />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "flex-start", padding: "0 0 0 16%" }}>
        {/* eyebrow */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: MONO, fontSize: 24, fontWeight: 700, letterSpacing: "0.24em", textTransform: "uppercase", color: RAISIN, marginBottom: 44, opacity: clamp(spring({ frame, fps, config: { damping: 200 } }), 0, 1) }}>
          <span style={{ width: 16, height: 16, background: LIME, display: "inline-block" }} />
          {eyebrow}
        </div>

        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: ROW_GAP }}>
          {/* spine connecting the badges */}
          <div style={{ position: "absolute", left: BADGE / 2 - 3, top: BADGE / 2, width: 6, height: `calc((100% - ${BADGE}px) * ${spineP})`, background: RAISIN, opacity: 0.16, borderRadius: 3 }} />

          {steps.map((s, i) => {
            const rs = spring({ frame: frame - revealOf(i), fps, config: { damping: 15, stiffness: 170 } });
            const p = clamp(rs, 0, 1);
            const dim = lastShown > i ? 0.92 : 1; // earlier steps settle slightly back
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 40, opacity: p, transform: `translateX(${interpolate(p, [0, 1], [60, 0])}px)` }}>
                {/* number badge: raisin tile + lime offset + lime italic numeral */}
                <div style={{ position: "relative", flex: "0 0 auto" }}>
                  <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: R_INK, transform: "translate(9px,9px)" }} />
                  <div style={{ position: "relative", width: BADGE, height: BADGE, background: RAISIN, borderRadius: R_INK, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: BADGE * 0.44, color: LIME, letterSpacing: "-0.02em" }}>{s.n}</span>
                  </div>
                </div>
                {/* keyword + descriptor */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, opacity: dim }}>
                  <div style={{ position: "relative", display: "inline-block", alignSelf: "flex-start" }}>
                    {s.accent && (
                      <span style={{ position: "absolute", top: "0.12em", bottom: "0.14em", left: -8, right: -14, background: LIME, transform: "rotate(-1.2deg)", zIndex: 0 }} />
                    )}
                    <span style={{ position: "relative", zIndex: 1, fontFamily: SANS, fontWeight: 700, fontSize: 78, letterSpacing: "-0.02em", textTransform: "uppercase", color: RAISIN, lineHeight: 1 }}>{s.key}</span>
                  </div>
                  <div style={{ fontFamily: SANS, fontSize: 30, color: BODY, letterSpacing: "0.01em" }}>{s.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

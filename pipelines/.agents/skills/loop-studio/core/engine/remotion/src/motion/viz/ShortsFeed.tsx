import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { clamp, LIME, WHITE, SANS, MONO } from "../kit";

export type ShortsFeedProps = {
  // clickbait titles to flood the feed; defaults to AI-slop tutorials
  items?: { title: string; views: string }[];
  eyebrow?: string;
};

const DEFAULT: { title: string; views: string }[] = [
  { title: "10 AI TOOLS YOU NEED RIGHT NOW", views: "1.2M views" },
  { title: "MAKE $10K/MONTH WITH AI (EASY)", views: "890K views" },
  { title: "THE ONLY AI PROMPT YOU'LL EVER NEED", views: "2.1M views" },
  { title: "AI WILL REPLACE YOUR JOB IN 2026", views: "3.4M views" },
  { title: "5 AI SIDE HUSTLES THAT PRINT MONEY", views: "760K views" },
  { title: "I BUILT AN APP IN 10 MINUTES WITH AI", views: "1.5M views" },
  { title: "STOP USING CHATGPT THE WRONG WAY", views: "2.8M views" },
  { title: "THIS AI TOOL CHANGED MY LIFE", views: "640K views" },
];
const HUES = ["#3A2A6E", "#1E6B4A", "#6E2A3A", "#2A4A6E", "#5B3AA8", "#6E5A2A"];

/* A YouTube-Shorts feed of AI-slop tutorials scrolling endlessly — the visual
   argument for "watch another tutorial and never finish". */
export const ShortsFeed: React.FC<ShortsFeedProps> = ({ items = DEFAULT, eyebrow = "the feed" }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const ROW_H = 168;
  const loop = [...items, ...items, ...items];
  const scroll = (frame / durationInFrames) * ROW_H * items.length * 1.6; // endless upward scroll

  return (
    <AbsoluteFill style={{ backgroundColor: "#0E0E10" }}>
      <div style={{ position: "absolute", left: "50%", top: 0, width: 1180, height: "100%", transform: "translateX(-50%) perspective(1600px) rotateX(6deg) rotateZ(-2deg)", transformStyle: "preserve-3d" }}>
        <div style={{ transform: `translateY(${120 - scroll}px)` }}>
          {loop.map((it, i) => {
            const appear = clamp(interpolate(frame, [i * 2, i * 2 + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), 0, 1);
            return (
              <div key={i} style={{ display: "flex", gap: 22, alignItems: "center", height: ROW_H, opacity: 0.55 + 0.45 * appear }}>
                <div style={{ width: 248, height: 140, borderRadius: 12, background: `linear-gradient(135deg, ${HUES[i % HUES.length]}, #15151a)`, position: "relative", flex: "0 0 auto", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <div style={{ width: 0, height: 0, borderLeft: "26px solid rgba(255,255,255,0.92)", borderTop: "16px solid transparent", borderBottom: "16px solid transparent", marginLeft: 6 }} />
                  </div>
                  <div style={{ position: "absolute", right: 8, bottom: 8, background: "rgba(0,0,0,0.7)", color: "#fff", fontFamily: MONO, fontSize: 13, padding: "2px 6px", borderRadius: 4 }}>0:42</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: WHITE, lineHeight: 1.12, letterSpacing: "-0.01em" }}>{it.title}</div>
                  <div style={{ fontFamily: MONO, fontSize: 18, color: "#8A8A92", marginTop: 8 }}>AI Guru · {it.views}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* top + bottom fade so the feed reads as endless */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, #0E0E10 2%, transparent 22%, transparent 78%, #0E0E10 98%)", pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

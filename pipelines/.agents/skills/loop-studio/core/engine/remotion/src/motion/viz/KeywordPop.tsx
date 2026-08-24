import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { rev, clamp, LIME, WHITE, SILVER_MID, RAISIN, SANS, MONO } from "../kit";
import { cineReveal, Glow } from "./cine";

/**
 * keywordPop — OVERLAY: a word/phrase pops in beside the speaker with a lime
 * marker wipe + glow. Cinematic motion (blur-rise). Transparent.
 */
export type KeywordPopProps = {
  word: string;
  sub?: string;
  anchor?: "left" | "right";
};

const INSET = 120;

export const KeywordPop: React.FC<KeywordPopProps> = ({ word, sub, anchor = "left" }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const left = anchor === "left";
  const mark = rev(frame, 12, 12);
  // Width-aware font so the word NEVER runs off-frame (base 84 was tuned for the
  // 1920 reel; a 1080 short needs it smaller, and long words shrink further).
  const base = Math.min(84, width * 0.066);
  const avail = width - INSET - 72;                       // anchor → opposite safe margin
  const byLen = avail / (Math.max(1, word.length) * 0.60);
  const fontSize = clamp(Math.min(base, byLen), 34, 84);
  const subSize = Math.max(15, fontSize * 0.26);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", [left ? "left" : "right"]: INSET, top: "42%", transform: "translateY(-50%)", maxWidth: avail, ...cineReveal(frame, 2, 15) }}>
        <span style={{ position: "relative", display: "inline-block" }}>
          <span aria-hidden style={{ position: "absolute", left: -10, right: -10, top: "16%", bottom: "14%", background: LIME, transform: `scaleX(${mark})`, transformOrigin: "left", borderRadius: 4, boxShadow: `0 0 20px ${LIME}55` }} />
          <span style={{ position: "relative", whiteSpace: "nowrap", fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize, letterSpacing: "-0.03em", color: mark > 0.4 ? RAISIN : WHITE, textShadow: mark > 0.4 ? "none" : "0 3px 20px rgba(0,0,0,0.6)" }}>{word}</span>
        </span>
        {sub && <div style={{ fontFamily: MONO, fontSize: subSize, color: SILVER_MID, marginTop: 14, letterSpacing: "0.02em", textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>{sub}</div>}
      </div>
    </AbsoluteFill>
  );
};

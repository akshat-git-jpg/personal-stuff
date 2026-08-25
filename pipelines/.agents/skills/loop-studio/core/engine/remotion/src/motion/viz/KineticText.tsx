import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { clamp, SANS, LIME, RAISIN, WHITE } from "../kit";
import { BgKey } from "../tokens";

export type KineticTextProps = {
  // each phrase is a LINE; accent=true → that whole line is filled LIME.
  phrases: { text: string; accent?: boolean }[];
  bg?: BgKey;      // default "grid-light"
  size?: number;   // hero font px (default 86)
  dark?: boolean;  // dark card: lime/white on raisin (e.g. "NEVER FINISH", "SO MUCH NOISE")
};

/* Bold word-by-word KARAOKE captions matched to the reference edit (SAMPLE 4):
   every word gets a THICK BLACK OUTLINE (paint-order stroke) so it reads on any
   background — no more white-on-white. Fill is WHITE by default, LIME for the
   emphasized line. Dark cards flip to lime/white on raisin. Words pop in
   word-by-word, spread across the card so the reveal tracks the spoken phrase. */
export const KineticText: React.FC<KineticTextProps> = ({ phrases, bg = "grid-light", size = 86, dark = false }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  let gi = 0;
  const lines = phrases.map((p) => ({ accent: !!p.accent, words: p.text.split(/\s+/).map((w) => ({ w, i: gi++ })) }));
  const total = Math.max(1, gi);
  const revealEnd = durationInFrames * 0.55; // words finish appearing by ~55% of the card, then hold
  const appearAt = (i: number) => (total <= 1 ? 0 : (i / (total - 1)) * revealEnd);

  // Light card = RAISIN ink + LIME accent on the silver grid (System v1 palette).
  // The lime line keeps the raisin outline (lime alone is too light on grey);
  // the supporting line is solid raisin — clean dark ink, no washed-out white.
  // Dark card flips to white ink + lime accent.
  const stroke = Math.max(3, size * 0.055);
  const fillFor = (accent: boolean) => (accent ? LIME : dark ? WHITE : RAISIN);
  const strokeFor = (accent: boolean): React.CSSProperties => {
    const col = dark ? RAISIN : RAISIN;
    const w = accent ? stroke : Math.max(2, size * 0.022); // lime gets the bold outline; raisin a hair
    return { WebkitTextStroke: `${w}px ${col}`, paintOrder: "stroke fill" as any };
  };

  return (
    <AbsoluteFill style={{ backgroundColor: dark ? "#0B0E15" : "#D9DDE4" }}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img
          src={staticFile(`brand/${dark ? "grid-dark" : bg}.png`)}
          style={{ width: "100%", height: "100%", objectFit: "cover", opacity: dark ? 1 : 0.5 }}
        />
      </AbsoluteFill>
      {/* mute the plate's blown-out center so it reads as a uniform cool grey */}
      {!dark && <AbsoluteFill style={{ background: "rgba(206,211,219,0.45)" }} />}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 8%" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: size * 0.18 }}>
          {lines.map((ln, li) => (
            <div
              key={li}
              style={{
                display: "inline-flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: `0 ${size * 0.26}px`,
              }}
            >
              {ln.words.map((wd) => {
                const s = spring({ frame: frame - appearAt(wd.i), fps, config: { damping: 13, stiffness: 220 } });
                return (
                  <span
                    key={wd.i}
                    style={{
                      fontFamily: SANS,
                      fontWeight: 700,
                      fontSize: size,
                      textTransform: "uppercase",
                      letterSpacing: "-0.01em",
                      color: fillFor(ln.accent),
                      ...strokeFor(ln.accent),
                      filter: ln.accent
                        ? "drop-shadow(0 4px 16px rgba(15,18,26,0.28))"
                        : "drop-shadow(0 2px 10px rgba(255,255,255,0.45))",
                      opacity: clamp(s, 0, 1),
                      transform: `translateY(${interpolate(s, [0, 1], [26, 0])}px) scale(${interpolate(s, [0, 1], [0.72, 1])})`,
                      display: "inline-block",
                    }}
                  >
                    {wd.w}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

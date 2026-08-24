import {
  AbsoluteFill,
  interpolate,
  Easing,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * CINEMATIC HOOK — premium cold-open title (2026-06-12).
 *
 * Built to feel like a graded brand-film title, NOT a default Remotion text
 * pop. Three things do the lifting:
 *   1. ATMOSPHERE — vignette + a fine film-grain layer + a soft bottom scrim,
 *      so the type sits in a graded frame with depth instead of floating flat.
 *   2. CRAFTED TYPE — heavy display hero (mixed-case) with ONE editorial
 *      italic-serif accent word in neo-lime; an underline that DRAWS under it
 *      and a soft bloom.
 *   3. EASED KINETIC REVEAL — each hero word is revealed by a mask-wipe (clip
 *      path rising) + a short motion-blur-to-sharp, on a slow expo ease — never
 *      a bouncy spring. The kicker tracks in first; the lockup settle-drifts so
 *      the frame is alive from frame 0 (static frame = scroll reflex).
 *
 * `title` supports `\n` and one `{accent}` span. `font: "grotesk" | "serif"`
 * swaps the hero face. Positioned in the lower third, clear of the speaker.
 */
export type CinematicHookProps = {
  kicker: string;
  title: string;
  vertical?: number;
  /** Hero face: "grotesk" (Archivo Black) or "serif" (Fraunces). Default grotesk. */
  font?: "grotesk" | "serif";
  beat_start_sec?: number;
};

const EXPO_OUT = Easing.bezier(0.16, 1, 0.3, 1); // slow, weighted settle
const QUINT_OUT = Easing.bezier(0.22, 1, 0.36, 1); // long fluid tail — organic, not stiff
const GROTESK = "'Archivo Black','Space Grotesk',system-ui,sans-serif";
const SERIF = "'Fraunces','Playfair Display',Georgia,serif";
const ACCENT_SERIF = "'Fraunces','Playfair Display',Georgia,serif";
const KICKER_FONT = "'Space Grotesk',system-ui,sans-serif";
const LIME = "#CFFF05";

let __chFonts = false;
const ensureFonts = () => {
  if (typeof document === "undefined" || __chFonts) return;
  __chFonts = true;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href =
    "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,900;1,9..144,600&family=Space+Grotesk:wght@500;700&display=block";
  document.head.appendChild(l);
};

type Tok = { text: string; accent: boolean };
const parseLine = (line: string): Tok[][] => {
  // split into words, keeping {accent} spans whole
  const parts = line.split(/(\{[^}]*\})/).filter(Boolean);
  const words: Tok[][] = [];
  for (const p of parts) {
    const accent = p.startsWith("{") && p.endsWith("}");
    const clean = accent ? p.slice(1, -1) : p;
    for (const w of clean.split(/\s+/).filter(Boolean)) {
      words.push([{ text: w, accent }]);
    }
  }
  return words;
};

/** Fine film grain via animated SVG turbulence — overlaid at low opacity. */
const FilmGrain: React.FC<{ frame: number; intensity: number }> = ({ frame, intensity }) => {
  const seed = 1 + (frame % 6); // reshuffle a few times/sec so it shimmers
  return (
    <AbsoluteFill
      style={{ mixBlendMode: "overlay", opacity: 0.4 * intensity, pointerEvents: "none" }}
    >
      <svg width="100%" height="100%">
        <filter id="chgrain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves={2}
            seed={seed}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#chgrain)" />
      </svg>
    </AbsoluteFill>
  );
};

export const CinematicHook: React.FC<CinematicHookProps> = ({
  kicker,
  title,
  vertical = 0.40,
  font = "grotesk",
}) => {
  ensureFonts();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;
  const durSec = durationInFrames / fps; // this hook's own length (varies per ad)
  const heroFamily = font === "serif" ? SERIF : GROTESK;

  const lines = title.split("\n").map(parseLine);

  // Choreography (seconds) — reads fully by ~1.5s, then holds + drifts.
  // Stagger < entrance duration so words OVERLAP as they flow in (not a
  // robotic one-then-the-next cadence).
  const KICK_IN = 0.08;
  const WORD0 = 0.42;
  const WORD_STAGGER = 0.22;
  const WORD_DUR = 0.64;

  // Kicker: tracks in (letter-spacing tightens) + fades.
  const kP = interpolate(t, [KICK_IN, KICK_IN + 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EXPO_OUT,
  });
  const kTrack = interpolate(kP, [0, 1], [0.42, 0.16]);
  // Exit fades are relative to THIS hook's length so short hooks (A5 ≈1.6s)
  // and long ones (A4 ≈3.8s) all dissolve gracefully instead of hard-cutting.
  const kickExit = interpolate(t, [durSec - 0.5, durSec - 0.12], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The lockup RISES + settles into place by ~1.3s, then HOLDS rock-steady —
  // a title sets and sits; the footage push-in (and grain) carry the life.
  // No continuous drift (a title that keeps creeping reads as a floating
  // template, not a film title).
  const settle = interpolate(t, [0, 1.3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: QUINT_OUT,
  });
  const driftY = interpolate(settle, [0, 1], [22, 0]);
  const lockScale = interpolate(settle, [0, 1], [0.985, 1]);
  const lockExit = interpolate(t, [durSec - 0.42, durSec - 0.06], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // ATMOSPHERE ramp — the hook's scrim/vignette/grain must fade IN at the
  // start and OUT at the end, never hard-cut. Otherwise the frame "pops"
  // brighter/flatter the instant the hook ends (the body only has the comp
  // ColorGrade), which reads as an amateur grade jump. A long ease out blends
  // the hook atmosphere into the body so the cut is invisible.
  const atmo = interpolate(t, [0, 0.4, durSec - 0.6, durSec - 0.02], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: QUINT_OUT,
  });

  // AD-SAFE mode (REMOTION_AD_SAFE_CAPTIONS=1): paid ads play cropped — the
  // Facebook/IG feed center-crops 9:16 → 4:5 (cuts the bottom ~15%) and
  // Reels/Stories overlay UI on the bottom ~20%. A TOP-anchored lockup grows
  // DOWNWARD, so a 2-line title's payoff word drops straight into the crop and
  // vanishes (the "would it / survive?" → "would it" failure). In ad-safe mode
  // we BOTTOM-anchor instead: the last line locks to a fixed safe line (~24%
  // from the bottom, clearing both the feed crop and the Reels UI), and longer
  // titles grow UPWARD toward the face rather than down into the crop. We also
  // trim the hero a touch so a 2-line title + kicker doesn't climb onto the face.
  const adSafe = process.env.REMOTION_AD_SAFE_CAPTIONS === "1";
  // Landscape (16:9 intros) reads against a wider canvas with a centred talking
  // head — a smaller, lower-anchored lockup is far more premium than the big
  // top-anchored stack that crowds the bottom edge (fixed 2026-06-21).
  const landscape = width > height;
  const heroSize = Math.round(
    Math.min(width, height) *
      (font === "serif" ? (landscape ? 0.115 : 0.158) : landscape ? 0.105 : 0.138) *
      (adSafe ? 0.78 : 1)
  );
  const topPx = Math.round(height * vertical);
  // Landscape: anchor the lockup's BOTTOM a comfortable margin above the frame
  // floor and let it grow UP — guarantees the payoff line never jams the edge
  // regardless of line count (the top-anchor path grows down into the bottom).
  const landBottomPx = Math.round(height * 0.13);
  // Bottom anchor for ad-safe: the FEED does NOT center-crop cleanly — it keeps
  // more of the top, cuts more of the bottom, AND overlays player UI (scrubber)
  // on the bottom of the displayed 4:5 frame. Calibrated to a real FB feed
  // screenshot (2026-06-13): anything below ~72% from the top is lost. So the
  // payoff line's BOTTOM must sit at ≥31% from the frame bottom (≤69% from top).
  const adBottomPx = Math.round(height * 0.31);

  let wordIdx = 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* ATMOSPHERE: bottom scrim + vignette + grain — all ramped by `atmo`
          so they fade in/out instead of hard-cutting into the body grade. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to top, rgba(8,8,11,0.82) 0%, rgba(8,8,11,0.45) 26%, rgba(8,8,11,0.0) 52%)",
          opacity: atmo,
        }}
      />
      <AbsoluteFill
        style={{
          boxShadow: `inset 0 0 ${Math.round(width * 0.5)}px rgba(0,0,0,0.55)`,
          opacity: 0.9 * atmo,
        }}
      />
      <FilmGrain frame={frame} intensity={atmo} />

      {/* TEXT LOCKUP — top-anchored normally; BOTTOM-anchored in ad-safe mode
          so the payoff line stays above the crop (grows up toward the face). */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          ...(adSafe
            ? { bottom: adBottomPx }
            : landscape
            ? { bottom: landBottomPx }
            : { top: topPx }),
          padding: `0 ${Math.round(width * 0.1)}px`,
          transform: `translateY(${driftY}px) scale(${lockScale})`,
          transformOrigin: "left center",
          opacity: lockExit,
        }}
      >
        {/* kicker */}
        <div
          style={{
            fontFamily: KICKER_FONT,
            fontWeight: 700,
            fontSize: Math.round(Math.min(width, height) * 0.031),
            letterSpacing: `${kTrack}em`,
            textTransform: "uppercase",
            color: LIME,
            opacity: kP * kickExit,
            transform: `translateY(${interpolate(kP, [0, 1], [10, 0])}px)`,
            marginBottom: Math.round(height * 0.018),
            textShadow: "0 2px 14px rgba(0,0,0,0.7)",
          }}
        >
          {kicker}
        </div>

        {/* hero — word-by-word: fluid fade + rise + scale + motion-blur clear.
            No clip-path (it was what cropped the accent glow) and a long QUINT
            tail so the motion has weight instead of snapping. */}
        {lines.map((lineWords, li) => (
          <div
            key={li}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              gap: `0 ${Math.round(heroSize * 0.24)}px`,
              lineHeight: 1.04,
              marginBottom: Math.round(heroSize * 0.16), // real leading — uses the space
              overflow: "visible",
            }}
          >
            {lineWords.map((toks, wi) => {
              const idx = wordIdx++;
              const appear = WORD0 + idx * WORD_STAGGER;
              const p = interpolate(t, [appear, appear + WORD_DUR], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: QUINT_OUT,
              });
              const tok = toks[0];
              const accent = tok.accent;
              // entrance: rise from below + settle scale + motion-blur clearing
              const rise = (1 - p) * Math.round(heroSize * 0.5);
              const wScale = interpolate(p, [0, 1], [0.9, 1]);
              const blurPx = (1 - p) * 16;
              // accent bloom intensity (painted as a soft radial behind the
              // word — NOT a text-shadow, which rasterizes to a hard box).
              const glowA = accent
                ? landscape
                  ? 0.1 + 0.16 * p
                  : 0.22 + 0.34 * p
                : 0;
              const underline = accent
                ? interpolate(t, [appear + 0.34, appear + 0.9], [0, 100], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: QUINT_OUT,
                  })
                : 0;
              return (
                <span
                  key={wi}
                  style={{
                    position: "relative",
                    display: "inline-block",
                    overflow: "visible",
                    opacity: p,
                    transform: `translateY(${rise}px) scale(${wScale})`,
                    transformOrigin: "left bottom",
                    filter: blurPx > 0.5 ? `blur(${blurPx}px)` : "none",
                    // Accent follows the hero face: serif → editorial italic
                    // serif; grotesk → heavy grotesk (same heft as the hero,
                    // just lime). Previously the accent was ALWAYS serif italic,
                    // which clashed inside a grotesk lockup.
                    fontFamily: accent && font === "serif" ? ACCENT_SERIF : heroFamily,
                    fontStyle: accent && font === "serif" ? "italic" : "normal",
                    fontWeight: font === "serif" ? (accent ? 600 : 900) : 400,
                    fontSize: accent
                      ? Math.round(heroSize * (landscape ? 1.0 : 1.06))
                      : heroSize,
                    letterSpacing: font === "serif" ? "-0.012em" : "-0.02em",
                    color: accent ? LIME : "#F7F7F4",
                    textShadow: accent
                      ? "0 2px 18px rgba(0,0,0,0.5)"
                      : "0 2px 16px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.9)",
                  }}
                >
                  {accent && (
                    <span
                      style={{
                        position: "absolute",
                        left: "-16%",
                        right: "-16%",
                        top: "-14%",
                        bottom: "-22%",
                        zIndex: -1,
                        pointerEvents: "none",
                        background: `radial-gradient(closest-side ellipse at 50% 55%, rgba(207,255,5,${glowA}) 0%, rgba(207,255,5,${glowA * 0.38}) 46%, rgba(207,255,5,0) 76%)`,
                        filter: `blur(${Math.round(heroSize * 0.07)}px)`,
                      }}
                    />
                  )}
                  {tok.text}
                  {accent && (
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        bottom: Math.round(heroSize * -0.08),
                        height: Math.max(3, Math.round(heroSize * 0.05)),
                        width: `${underline}%`,
                        background: LIME,
                        borderRadius: 99,
                        boxShadow: `0 0 ${Math.round(heroSize * (landscape ? 0.13 : 0.22))}px rgba(207,255,5,${landscape ? 0.38 : 0.7})`,
                      }}
                    />
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

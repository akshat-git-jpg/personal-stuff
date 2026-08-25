import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { useTypeBase } from "./motion";

export type LowerThirdProps = {
  /** Plain prefix text — e.g. "Only" / "There's" / "This is". White on raisin. */
  prefix?: string;
  /** Highlighted phrase — the lime block. e.g. "THREE THINGS" / "ONE FEATURE". */
  highlight: string;
  /** Plain suffix after the highlight. */
  suffix?: string;
  /** Optional small kicker label above the line — uppercase, small. */
  kicker?: string;
};

/**
 * Bottom-band callout strip — partial overlay that LEAVES THE SPEAKER VISIBLE
 * above. Wipes in from left with a raisin-black bar; lime block scales in
 * holding the highlight word; whole strip exits with a wipe-out to the right.
 *
 * Use as a QUICK punctuation between full-takeover beats. ~2.5s on screen
 * gives the eye a snack while the speaker keeps speaking. Pairs naturally
 * before/after a takeover for transition moments.
 *
 * Hard rules:
 *  - Strip occupies bottom ~22% of the frame (~30% in 9:16)
 *  - Single neo-lime accent: only the highlight block uses lime
 *  - NOT a takeover — coverage underlay does NOT engage on this kind, so
 *    the speaker layer stays fully visible behind the strip
 */
export const LowerThird: React.FC<LowerThirdProps> = ({ prefix, highlight, suffix, kicker }) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";

  const t = frame / fps;
  const isLandscape = width >= height;
  const stripH = Math.round(height * (isLandscape ? 0.22 : 0.18));
  const padX = Math.round(width * 0.05);
  const padY = Math.round(typeBase * 0.022);
  const marginBottom = Math.round(height * 0.05);

  const textSize = Math.round(typeBase * (isLandscape ? 0.060 : 0.050));
  const blockPadX = Math.round(textSize * 0.32);
  const blockPadY = Math.round(textSize * 0.16);
  const kickerSize = Math.round(typeBase * 0.022);
  const radius = Math.round(typeBase * 0.012);

  // Strip wipe — clip from left
  const stripWipe = interpolate(t, [0, 0.45], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1),
  });
  // Highlight block scale-in
  const highlightSpring = spring({
    frame: frame - Math.round(0.30 * fps), fps,
    durationInFrames: Math.round(0.45 * fps),
    config: { damping: 14, stiffness: 130, mass: 0.65 },
  });
  // Prefix + suffix fade
  const prefixK = interpolate(t, [0.20, 0.55], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1),
  });
  const suffixK = interpolate(t, [0.50, 0.85], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1),
  });
  const kickerK = interpolate(t, [0.10, 0.45], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1),
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute",
        left: padX,
        right: padX,
        bottom: marginBottom,
        height: stripH,
        backgroundColor: "rgba(15, 18, 26, 0.94)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        borderRadius: radius,
        borderLeft: `${Math.round(typeBase * 0.005)}px solid #CFFF05`,
        boxShadow: `0 ${Math.round(typeBase * 0.014)}px ${Math.round(typeBase * 0.034)}px rgba(0,0,0,0.40)`,
        clipPath: `inset(0 ${100 - stripWipe * 100}% 0 0)`,
        padding: `${padY}px ${Math.round(width * 0.024)}px`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: Math.round(typeBase * 0.006),
      }}>
        {kicker && (
          <div style={{
            fontFamily,
            fontWeight: 700,
            fontSize: kickerSize,
            color: "#CFFF05",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            opacity: kickerK,
            transform: `translateX(${interpolate(kickerK, [0, 1], [-12, 0])}px)`,
          }}>
            {kicker}
          </div>
        )}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          gap: Math.round(textSize * 0.20),
          fontFamily,
          fontWeight: 700,
          fontSize: textSize,
          color: "#FFFFFF",
          lineHeight: 1.05,
          letterSpacing: "-0.005em",
        }}>
          {prefix && (
            <span style={{
              opacity: prefixK,
              transform: `translateY(${interpolate(prefixK, [0, 1], [10, 0])}px)`,
            }}>
              {prefix}
            </span>
          )}
          <span style={{
            display: "inline-block",
            backgroundColor: "#CFFF05",
            color: "#0F121A",
            padding: `${blockPadY}px ${blockPadX}px`,
            borderRadius: Math.round(textSize * 0.10),
            opacity: highlightSpring,
            transform: `scale(${interpolate(highlightSpring, [0, 1], [0.85, 1])})`,
            transformOrigin: "left center",
            boxShadow: `0 ${Math.round(typeBase * 0.005)}px ${Math.round(typeBase * 0.014)}px rgba(15,18,26,0.30)`,
          }}>
            {highlight}
          </span>
          {suffix && (
            <span style={{
              opacity: suffixK,
              transform: `translateY(${interpolate(suffixK, [0, 1], [10, 0])}px)`,
            }}>
              {suffix}
            </span>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

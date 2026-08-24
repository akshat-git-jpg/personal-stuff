import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { DarkGridBg } from "./Backgrounds";
import { useTypeBase } from "./motion";

export type CinematicTitleProps = {
  /** The chapter number ("01", "02", "PART III"). Renders huge, lime. */
  chapter: string;
  /** The chapter title. Bold, white, slams in after the chapter number. */
  title: string;
  /** Optional subtitle, smaller, fades up last. */
  subtitle?: string;
  /** Optional kicker word above the chapter number. Small, uppercase. */
  kicker?: string;
};

/**
 * Cinematic chapter divider for longform. Use between major sections of a
 * 5+ minute video to give the viewer a clear "we're moving on" signal.
 *
 * Choreography:
 *   0.00s   raisin curtain wipes in left-to-right (frame fade)
 *   0.20s   small `kicker` text fades up
 *   0.35s   chapter number slams in from below with scale 1.30 → 1.00
 *   0.65s   horizontal lime divider line wipes left-to-right
 *   0.85s   title slides in from the right
 *   1.20s   optional subtitle fades up beneath
 *
 * Hard rules:
 *  - Chapter number ALWAYS lime; title ALWAYS white. Single-accent rule.
 *  - Title clamps to 2 lines; subtitle clamps to 2 lines. No overflow.
 *  - The whole stack is centered (vertical + horizontal).
 */
export const CinematicTitle: React.FC<CinematicTitleProps> = ({ chapter, title, subtitle, kicker }) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";

  const isLandscape = width >= height;
  const baseDim = isLandscape ? height : width;
  const t = frame / fps;

  // Type ladder
  const chapterSize = Math.round(baseDim * 0.34);
  const titleSize = Math.round(baseDim * 0.080);
  const subtitleSize = Math.round(baseDim * 0.034);
  const kickerSize = Math.round(baseDim * 0.026);

  // Animations
  const curtainK = interpolate(t, [0, 0.45], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1),
  });
  const kickerEnter = interpolate(t, [0.20, 0.55], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1),
  });
  const chapterSpring = spring({
    frame: frame - Math.round(0.35 * fps),
    fps,
    durationInFrames: Math.round(0.55 * fps),
    config: { damping: 14, stiffness: 130, mass: 0.65 },
  });
  const dividerK = interpolate(t, [0.65, 1.05], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1),
  });
  const titleEnter = interpolate(t, [0.85, 1.20], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1),
  });
  const subtitleEnter = interpolate(t, [1.20, 1.55], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1),
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#0F121A" }}>
      <DarkGridBg />

      {/* Curtain wipe — raisin overlay shrinks from full to nothing */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "#0F121A",
        clipPath: `inset(0 0 0 ${curtainK * 100}%)`,
      }} />

      <AbsoluteFill style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: width * 0.06,
        textAlign: "center",
      }}>
        {/* Kicker */}
        {kicker && (
          <div style={{
            fontFamily,
            fontWeight: 700,
            fontSize: kickerSize,
            color: "#CFFF05",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            marginBottom: Math.round(typeBase * 0.018),
            opacity: kickerEnter,
            transform: `translateY(${interpolate(kickerEnter, [0, 1], [10, 0])}px)`,
          }}>
            {kicker}
          </div>
        )}

        {/* Chapter number — slams in */}
        <div style={{
          fontFamily,
          fontWeight: 700,
          fontSize: chapterSize,
          color: "#CFFF05",
          lineHeight: 0.85,
          letterSpacing: "-0.04em",
          textShadow: `0 ${Math.round(typeBase * 0.008)}px ${Math.round(typeBase * 0.024)}px rgba(0,0,0,0.4)`,
          opacity: chapterSpring,
          transform: `translateY(${interpolate(chapterSpring, [0, 1], [80, 0])}px) scale(${interpolate(chapterSpring, [0, 1], [1.30, 1.00])})`,
          marginBottom: Math.round(typeBase * 0.020),
        }}>
          {chapter}
        </div>

        {/* Lime divider */}
        <div style={{
          width: Math.round(typeBase * 0.22),
          height: Math.round(typeBase * 0.008),
          backgroundColor: "#CFFF05",
          borderRadius: 999,
          margin: `${Math.round(typeBase * 0.020)}px 0`,
          transformOrigin: "left center",
          transform: `scaleX(${dividerK})`,
        }} />

        {/* Title — slides in from right */}
        <div style={{
          fontFamily,
          fontWeight: 700,
          fontSize: titleSize,
          color: "#FFFFFF",
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
          maxWidth: width * 0.85,
          opacity: titleEnter,
          transform: `translateX(${interpolate(titleEnter, [0, 1], [40, 0])}px)`,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          textOverflow: "ellipsis",
          overflowWrap: "break-word",
          wordBreak: "normal",
          hyphens: "manual",
        }}>
          {title}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div style={{
            fontFamily,
            fontWeight: 500,
            fontSize: subtitleSize,
            color: "#B5BFC2",
            lineHeight: 1.3,
            marginTop: Math.round(typeBase * 0.024),
            maxWidth: width * 0.78,
            opacity: subtitleEnter,
            transform: `translateY(${interpolate(subtitleEnter, [0, 1], [12, 0])}px)`,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {subtitle}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

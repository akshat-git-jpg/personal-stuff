import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useTypeBase } from "./motion";

export type ChapterBarProps = {
  /** Chapter number — "01", "02", etc. */
  number: string;
  /** Chapter title — short, uppercase reads best. */
  title: string;
};

/**
 * Editorial chapter marker pinned bottom-third over the speaker layer. NOT a
 * lower-third (no name/title chyron) — it's a "what is this part about" tag
 * that holds while the speaker talks. Lime tick + raisin bar with lime number
 * + white title.
 *
 * Renders WITHOUT a background of its own (transparent) — meant to be
 * composited on top of the speaker layer.
 */
export const ChapterBar: React.FC<ChapterBarProps> = ({ number, title }) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";

  const enterProg = interpolate(
    frame,
    [0, Math.round(fps * 0.4)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const barHeight = Math.round(typeBase * 0.10);
  const tickWidth = Math.round(typeBase * 0.012);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: height * 0.18,
        height: barHeight,
        display: "flex",
        alignItems: "stretch",
        opacity: enterProg,
        transform: `translateX(${interpolate(enterProg, [0, 1], [-width * 0.3, 0])}px)`,
      }}>
        {/* Lime tick on the left */}
        <div style={{
          width: tickWidth,
          backgroundColor: "#CFFF05",
        }} />
        {/* Raisin bar */}
        <div style={{
          flex: 1,
          backgroundColor: "rgba(15, 18, 26, 0.96)",
          padding: `0 ${width * 0.045}px`,
          display: "flex",
          alignItems: "center",
          gap: width * 0.022,
        }}>
          <div style={{
            fontFamily,
            fontWeight: 700,
            fontSize: Math.round(typeBase * 0.050),
            color: "#CFFF05",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.02em",
          }}>
            {number}
          </div>
          <div style={{
            width: 2,
            height: barHeight * 0.45,
            backgroundColor: "#343E5B",
          }} />
          <div style={{
            fontFamily,
            fontWeight: 700,
            fontSize: Math.round(typeBase * 0.040),
            color: "#FFFFFF",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}>
            {title}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

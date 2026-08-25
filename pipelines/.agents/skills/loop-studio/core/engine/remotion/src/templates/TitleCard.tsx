import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { LightGridBg } from "./Backgrounds";
import { useTypeBase } from "./motion";

export type TitleCardProps = {
  /** Optional big lime number / token ("5", "3", "01"). */
  number?: string;
  /** Title text — short, bold, uppercase reads best. Use \n for explicit line breaks. */
  title: string;
  /** Optional second line. */
  subtitle?: string;
};

/**
 * Big lime number to the left of a black box with white bold text. The black
 * box has a lime offset block behind it (top-left). Layout discipline:
 *  - The number is rendered INSIDE its own column so it never touches the box.
 *  - The lime offset block is positioned RELATIVE TO THE BOX ONLY, not to the
 *    flex container — so it cannot bleed across the number area.
 *  - Title text uses fixed line-height with explicit max-width to prevent
 *    runaway wrap.
 */
export const TitleCard: React.FC<TitleCardProps> = ({ number, title, subtitle }) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();

  const fontFamily = "Space Grotesk, system-ui, sans-serif";
  const numSize = Math.round(typeBase * 0.34);
  const titleSize = Math.round(typeBase * 0.10);
  const subSize = Math.round(typeBase * 0.045);
  const boxPadX = width * 0.045;
  const boxPadY = width * 0.030;
  const offsetShift = width * 0.014;
  const gap = width * 0.025;
  const boxMaxW = number ? width * 0.66 : width * 0.84;

  const numProg = spring({
    frame,
    fps,
    durationInFrames: Math.round(fps * 0.4),
    config: { damping: 14, stiffness: 130, mass: 0.6 },
  });
  const boxProg = spring({
    frame: frame - Math.round(fps * 0.3),
    fps,
    durationInFrames: Math.round(fps * 0.5),
    config: { damping: 14, stiffness: 130, mass: 0.65 },
  });
  const textProg = interpolate(
    frame,
    [Math.round(fps * 0.5), Math.round(fps * 1.0)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.2, 1) },
  );
  const shadowProg = interpolate(
    frame,
    [Math.round(fps * 0.7), Math.round(fps * 1.0)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill>
      <LightGridBg />
      <AbsoluteFill style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap }}>
          {number && (
            <div style={{
              fontFamily,
              fontWeight: 700,
              fontSize: numSize,
              color: "#CFFF05",
              lineHeight: 0.85,
              transform: `translateX(${interpolate(numProg, [0, 1], [-30, 0])}px) scale(${interpolate(numProg, [0, 1], [0.7, 1])})`,
              opacity: numProg,
              flexShrink: 0,
            }}>
              {number}
            </div>
          )}
          {/* Box wrapper — the lime offset block lives INSIDE this wrapper so
              it can never bleed past the box's edges. */}
          <div style={{
            position: "relative",
            transform: `scale(${interpolate(boxProg, [0, 1], [0.92, 1])})`,
            transformOrigin: "center",
            maxWidth: boxMaxW,
          }}>
            {/* Lime offset block */}
            <div style={{
              position: "absolute",
              inset: 0,
              transform: `translate(${offsetShift}px, ${offsetShift}px)`,
              backgroundColor: "#CFFF05",
              opacity: shadowProg,
              zIndex: 0,
            }} />
            {/* Black box */}
            <div style={{
              position: "relative",
              backgroundColor: "#0F121A",
              padding: `${boxPadY}px ${boxPadX}px`,
              zIndex: 1,
            }}>
              <div style={{
                fontFamily,
                fontWeight: 700,
                fontSize: titleSize,
                color: "#FFFFFF",
                lineHeight: 1.0,
                letterSpacing: "0.01em",
                textTransform: "uppercase",
                whiteSpace: "pre-line",
                opacity: textProg,
                transform: `translateY(${interpolate(textProg, [0, 1], [12, 0])}px)`,
              }}>
                {title}
              </div>
              {subtitle && (
                <div style={{
                  fontFamily,
                  fontWeight: 600,
                  fontSize: subSize,
                  color: "#B5BFC2",
                  lineHeight: 1.1,
                  marginTop: width * 0.012,
                  opacity: textProg,
                }}>
                  {subtitle}
                </div>
              )}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

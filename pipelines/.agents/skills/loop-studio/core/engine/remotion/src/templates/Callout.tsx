import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DarkGridBg } from "./Backgrounds";
import { useTypeBase } from "./motion";

export type CalloutProps = {
  /** Plain prefix text (white). e.g. "You don't just deliver the plan, you stay on as their" */
  prefix: string;
  /** Highlighted phrase (lime block). e.g. "AI advisor" */
  highlight: string;
  /** Optional suffix after the highlight. */
  suffix?: string;
  /** Overlay mode: render ON TOP of the talking-head video instead of as a
   *  full-screen takeover. Drops the grid, anchors the statement to the lower
   *  third (below the face), lays a soft bottom scrim + text shadows for
   *  legibility. The speaker stays fully visible. */
  overlay?: boolean;
};

/**
 * Two-line statement on dark grid background with one phrase rendered in a
 * lime block. Sequence:
 *  - 0..0.5s   prefix fades up
 *  - 0.4..0.8s lime block scales in
 *  - 0.6..1.0s highlight text fades up inside the block
 *  - 0.9..1.2s suffix (if any)
 */
export const Callout: React.FC<CalloutProps> = ({ prefix, highlight, suffix, overlay = false }) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();

  const fontFamily = "Space Grotesk, system-ui, sans-serif";
  const baseTextSize = typeBase * (overlay ? 0.068 : 0.080);
  // In overlay mode the prefix + lime block + suffix render on ONE inline row
  // (owner note 2026-05-29: overlays shouldn't stack and waste the side space).
  // Auto-shrink so the whole inline line fits ~90% of the frame width.
  let textSize = Math.round(baseTextSize);
  if (overlay) {
    const chars = (prefix + highlight + (suffix ?? "")).length;
    const avail = width * 0.9 - typeBase * 0.09; // reserve block padding + gaps
    const fitted = avail / (0.54 * Math.max(1, chars));
    textSize = Math.round(Math.min(baseTextSize, Math.max(typeBase * 0.03, fitted)));
  }
  const textGlow = overlay
    ? "0 2px 18px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.9)"
    : undefined;
  const blockPadX = typeBase * 0.035;
  const blockPadY = typeBase * 0.018;

  const prefixProg = interpolate(
    frame,
    [0, Math.round(fps * 0.5)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const blockProg = spring({
    frame: frame - Math.round(fps * 0.4),
    fps,
    durationInFrames: Math.round(fps * 0.4),
    config: { damping: 14, stiffness: 130, mass: 0.6 },
  });
  const hlTextProg = interpolate(
    frame,
    [Math.round(fps * 0.6), Math.round(fps * 1.0)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const suffixProg = interpolate(
    frame,
    [Math.round(fps * 0.9), Math.round(fps * 1.2)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill>
      {overlay ? (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(180deg, rgba(8,10,15,0) 45%, rgba(8,10,15,0.0) 55%, rgba(8,10,15,0.62) 100%)",
          }}
        />
      ) : (
        <DarkGridBg />
      )}
      <AbsoluteFill style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: overlay ? "flex-end" : "center",
        padding: width * 0.06,
        paddingBottom: overlay ? height * 0.06 : width * 0.06,
        textAlign: "center",
      }}>
        {/* Content wrapper. Overlay → a single inline ROW (prefix · lime block ·
            suffix) so it uses the full frame width instead of stacking and
            wasting the side space. Full-screen → the classic stacked column. */}
        <div style={{
          display: "flex",
          flexDirection: overlay ? "row" : "column",
          flexWrap: "nowrap",
          whiteSpace: overlay ? "nowrap" : undefined,
          alignItems: "center",
          justifyContent: "center",
          gap: overlay ? textSize * 0.32 : undefined,
          maxWidth: overlay ? "97%" : undefined,
        }}>
          <div style={{
            fontFamily,
            fontWeight: 700,
            fontSize: textSize,
            color: "#FFFFFF",
            lineHeight: 1.15,
            opacity: prefixProg,
            textShadow: textGlow,
            transform: `translateY(${interpolate(prefixProg, [0, 1], [12, 0])}px)`,
            marginBottom: overlay ? 0 : width * 0.025,
          }}>
            {prefix}
          </div>

          <div style={{ position: "relative", display: "inline-block", opacity: blockProg }}>
            {/* Subtle white outline offset, like the reference image — rendered
                FIRST (and z-index'd below) so the lime block paints OVER it and
                only the bottom-right offset peeks out as a layered-card edge.
                Previously this sat on top and its lines crossed the yellow. */}
            <div style={{
              position: "absolute",
              inset: 0,
              border: "2px solid #FFFFFF",
              transform: `translate(${width * 0.006}px, ${width * 0.006}px)`,
              pointerEvents: "none",
              opacity: blockProg * 0.6,
              zIndex: 0,
            }} />
            <div style={{
              position: "relative",
              zIndex: 1,
              backgroundColor: "#CFFF05",
              padding: `${blockPadY}px ${blockPadX}px`,
              transform: `scale(${interpolate(blockProg, [0, 1], [0.85, 1])})`,
              transformOrigin: "center",
            }}>
              <div style={{
                fontFamily,
                fontWeight: 700,
                fontSize: textSize,
                color: "#0F121A",
                lineHeight: 1.0,
                opacity: hlTextProg,
                transform: `translateY(${interpolate(hlTextProg, [0, 1], [8, 0])}px)`,
              }}>
                {highlight}
              </div>
            </div>
          </div>

          {suffix && (
            <div style={{
              fontFamily,
              fontWeight: 700,
              fontSize: textSize,
              color: "#FFFFFF",
              lineHeight: 1.15,
              opacity: suffixProg,
              textShadow: textGlow,
              transform: `translateY(${interpolate(suffixProg, [0, 1], [12, 0])}px)`,
              marginTop: overlay ? 0 : width * 0.025,
            }}>
              {suffix}
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

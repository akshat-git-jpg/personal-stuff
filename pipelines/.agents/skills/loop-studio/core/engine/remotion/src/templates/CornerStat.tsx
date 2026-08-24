import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { useTypeBase } from "./motion";

export type CornerStatProps = {
  /** Pre-label small uppercase text (e.g. "MRR" / "DAILY USERS"). */
  pre_label?: string;
  /** Hero value. Renders BIG. e.g. "$28k", "12", "97%". */
  value: string;
  /** Optional small caption below the value. */
  caption?: string;
  /** Optional delta chip. "+3", "↑ 12%". Lime if positive (+ / ↑); grey otherwise. */
  delta?: string;
  /** Anchor corner. Default "top-right". */
  anchor?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
};

/**
 * Single big-number HUD anchored to a frame corner. Speaker stays visible
 * everywhere else. Use as a heads-up display while the speaker discusses
 * the metric — "as I mention this number, the actual value is right here
 * in the corner the entire time."
 *
 * Choreography:
 *   0.00s   card slides in from outside the frame (corner-direction-aware)
 *   0.20s   value scales 0.85 → 1.00 with a soft spring
 *   0.45s   delta chip pops in
 *   1.00s   subtle settle-zoom holds the rest of the beat
 *
 * Hard rules:
 *  - Card occupies ~22% of frame width — small enough to leave the speaker
 *    dominant, large enough to read at scrub speed
 *  - Single neo-lime accent per frame: ONLY the delta chip (when positive)
 *    OR the pre_label uses lime, never both
 *  - NOT a takeover — speaker visible behind / around the card
 */
export const CornerStat: React.FC<CornerStatProps> = ({ pre_label, value, caption, delta, anchor }) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";

  const slot = anchor ?? "top-right";
  const cardW = Math.round(width * 0.22);
  const cardPad = Math.round(typeBase * 0.020);
  const cardRadius = Math.round(typeBase * 0.014);
  const margin = Math.round(typeBase * 0.040);

  const valueSize = Math.round(typeBase * 0.068);
  const labelSize = Math.round(typeBase * 0.022);
  const captionSize = Math.round(typeBase * 0.024);
  const deltaSize = Math.round(typeBase * 0.022);

  let cardLeft = 0, cardTop = 0;
  let slideOriginX = 0, slideOriginY = 0;
  switch (slot) {
    case "top-right":
      cardLeft = width - cardW - margin;
      cardTop = margin;
      slideOriginX = cardW * 0.4;
      slideOriginY = -cardW * 0.2;
      break;
    case "top-left":
      cardLeft = margin;
      cardTop = margin;
      slideOriginX = -cardW * 0.4;
      slideOriginY = -cardW * 0.2;
      break;
    case "bottom-right":
      cardLeft = width - cardW - margin;
      cardTop = height - margin - cardW * 0.7;
      slideOriginX = cardW * 0.4;
      slideOriginY = cardW * 0.2;
      break;
    case "bottom-left":
      cardLeft = margin;
      cardTop = height - margin - cardW * 0.7;
      slideOriginX = -cardW * 0.4;
      slideOriginY = cardW * 0.2;
      break;
  }

  const cardSpring = spring({
    frame, fps, durationInFrames: Math.round(0.55 * fps),
    config: { damping: 16, stiffness: 130, mass: 0.7 },
  });
  const valueSpring = spring({
    frame: frame - Math.round(0.20 * fps), fps,
    durationInFrames: Math.round(0.45 * fps),
    config: { damping: 14, stiffness: 130, mass: 0.65 },
  });
  const deltaSpring = spring({
    frame: frame - Math.round(0.45 * fps), fps,
    durationInFrames: Math.round(0.40 * fps),
    config: { damping: 16, stiffness: 130, mass: 0.7 },
  });
  const settleK = interpolate(frame / fps, [1.0, 2.5], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const settleScale = 1 + 0.020 * settleK;

  const slideX = interpolate(cardSpring, [0, 1], [slideOriginX, 0]);
  const slideY = interpolate(cardSpring, [0, 1], [slideOriginY, 0]);

  const deltaIsPositive = delta?.match(/^[+↑]/);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute",
        left: cardLeft,
        top: cardTop,
        width: cardW,
        backgroundColor: "rgba(15,18,26,0.94)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: `1px solid rgba(207,255,5,0.22)`,
        borderLeft: `${Math.round(typeBase * 0.005)}px solid #CFFF05`,
        borderRadius: cardRadius,
        boxShadow: `0 ${Math.round(typeBase * 0.012)}px ${Math.round(typeBase * 0.030)}px rgba(0,0,0,0.40)`,
        padding: cardPad,
        display: "flex",
        flexDirection: "column",
        gap: Math.round(typeBase * 0.006),
        opacity: cardSpring,
        transform: `translate(${slideX}px, ${slideY}px) scale(${settleScale})`,
      }}>
        {pre_label && (
          <div style={{
            fontFamily,
            fontWeight: 700,
            fontSize: labelSize,
            color: "#CFFF05",
            textTransform: "uppercase",
            letterSpacing: "0.10em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {pre_label}
          </div>
        )}
        <div style={{
          display: "flex",
          alignItems: "baseline",
          gap: Math.round(typeBase * 0.010),
          flexWrap: "wrap",
        }}>
          <div style={{
            fontFamily,
            fontWeight: 700,
            fontSize: valueSize,
            color: "#FFFFFF",
            lineHeight: 0.92,
            letterSpacing: "-0.02em",
            fontVariantNumeric: "tabular-nums",
            opacity: valueSpring,
            transform: `scale(${interpolate(valueSpring, [0, 1], [0.85, 1])})`,
            transformOrigin: "left bottom",
          }}>
            {value}
          </div>
          {delta && (
            <div style={{
              fontFamily,
              fontWeight: 700,
              fontSize: deltaSize,
              color: deltaIsPositive ? "#0F121A" : "#9AA3AB",
              backgroundColor: deltaIsPositive ? "#CFFF05" : "rgba(154,163,171,0.18)",
              padding: `${Math.round(deltaSize * 0.20)}px ${Math.round(deltaSize * 0.45)}px`,
              borderRadius: 999,
              opacity: deltaSpring,
              transform: `scale(${interpolate(deltaSpring, [0, 1], [0.7, 1])})`,
              whiteSpace: "nowrap",
            }}>
              {delta}
            </div>
          )}
        </div>
        {caption && (
          <div style={{
            fontFamily,
            fontWeight: 500,
            fontSize: captionSize,
            color: "#B5BFC2",
            lineHeight: 1.25,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {caption}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

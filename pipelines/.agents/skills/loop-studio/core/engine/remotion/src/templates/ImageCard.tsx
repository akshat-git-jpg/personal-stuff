import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useTypeBase } from "./motion";

/**
 * IMAGE CARD — a b-roll image shown in a glassy card in the BOTTOM HALF of
 * the frame, instead of a full-screen takeover. The speaker stays visible
 * above (and frosted-through) the card.
 *
 * Built May 21 2026 ("I don't want images full screen — put them bottom
 * half with a glassy background so I'm still visible").
 *
 * Look: a frosted dark-glass rounded card with a neo-lime glow border —
 * the BuildLoop notification-card aesthetic. Slides up on entrance.
 */
export type ImageCardProps = {
  /** Image source (already resolved by EditedVideo via staticFile). */
  src: string;
  /** Optional caption strip along the bottom of the card. */
  caption?: string;
};

const LIME = "#CFFF05";
const RAISIN = "#0F121A";
const BLOCK = "'Space Grotesk', system-ui, sans-serif";

export const ImageCard: React.FC<ImageCardProps> = ({ src, caption }) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();

  // ---- entrance / exit ----------------------------------------------------
  const enter = spring({
    frame, fps, durationInFrames: Math.round(0.5 * fps),
    config: { damping: 18, stiffness: 120, mass: 0.8 },
  });
  const exitStart = durationInFrames - 8;
  const exitP = frame > exitStart
    ? interpolate(frame, [exitStart, durationInFrames], [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;
  const opacity = enter * (1 - exitP);
  const ty = interpolate(enter, [0, 1], [height * 0.06, 0])
    + interpolate(exitP, [0, 1], [0, height * 0.04]);

  // slow ken-burns on the image so the card never feels frozen
  const kb = 1 + 0.06 * interpolate(
    frame, [0, durationInFrames], [0, 1],
    { extrapolateRight: "clamp" },
  );

  // ---- geometry: card fills the bottom ~half ------------------------------
  const margin = width * 0.06;
  const cardTop = height * 0.46;
  const cardBottom = height * 0.05;
  const radius = width * 0.05;
  const pad = width * 0.028;
  const borderW = Math.max(2, Math.round(typeBase * 0.005));
  const capH = caption ? typeBase * 0.085 : 0;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute",
        left: margin,
        right: margin,
        top: cardTop,
        bottom: cardBottom,
        opacity,
        transform: `translateY(${ty}px)`,
        borderRadius: radius,
        // frosted dark glass
        backgroundColor: "rgba(15,18,26,0.62)",
        backdropFilter: "blur(26px)",
        WebkitBackdropFilter: "blur(26px)",
        border: `${borderW}px solid rgba(207,255,5,0.55)`,
        // double glow — soft lime halo + a deep drop shadow for separation
        boxShadow: [
          `0 0 ${typeBase * 0.06}px rgba(207,255,5,0.30)`,
          `0 ${typeBase * 0.03}px ${typeBase * 0.07}px rgba(0,0,0,0.55)`,
        ].join(", "),
        padding: pad,
        boxSizing: "border-box",
        overflow: "hidden",
      }}>
        {/* image well */}
        <div style={{
          position: "absolute",
          left: pad, right: pad, top: pad,
          bottom: pad + capH,
          borderRadius: radius * 0.62,
          overflow: "hidden",
          backgroundColor: RAISIN,
        }}>
          <Img
            src={src}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${kb})`,
              transformOrigin: "center",
            }}
          />
        </div>

        {caption && (
          <div style={{
            position: "absolute",
            left: pad, right: pad, bottom: pad * 0.4,
            height: capH,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: BLOCK,
            fontWeight: 700,
            fontSize: typeBase * 0.034,
            color: "#FFFFFF",
            textAlign: "center",
            letterSpacing: "0.01em",
          }}>
            {caption}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

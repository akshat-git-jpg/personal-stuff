import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { useTypeBase } from "./motion";

const resolveSrc = (s: string): string => /^https?:\/\//i.test(s) ? s : staticFile(s);

export type SplitRevealProps = {
  /** Path to the BEFORE image (renders first / underneath). */
  before_image: string;
  /** Path to the AFTER image (wipes in over the before). */
  after_image: string;
  /** Optional labels rendered as small chips at the bottom-left and right.
   *  Default "BEFORE" / "AFTER". */
  before_label?: string;
  after_label?: string;
  /** When the wipe starts (sec, relative). Default 0.6s after beat start. */
  wipe_start_sec?: number;
  /** Wipe duration in seconds. Default 1.2s. */
  wipe_duration_sec?: number;
};

/**
 * Cinematic before/after wipe. Two images stacked; an animated vertical
 * divider sweeps left → right, revealing the AFTER image. A lime divider
 * line follows the wipe edge with a soft glow.
 *
 * Choreography:
 *   0.00s   before image fades in, BEFORE chip enters from left
 *   0.45s   AFTER chip slides in from right
 *   0.60s   wipe starts: lime divider line animates left → right, after
 *           image revealed behind it
 *   1.80s   wipe completes
 *   1.90s   subtle camera ease (1.0 → 1.02 settle zoom)
 *
 * Use for: visual proof of an actual change. "Before automation: messy
 * inbox. After automation: empty inbox." Pairs with screenshots that
 * have similar framing (same crop, same UI, different content).
 *
 * Hard rules:
 *  - Both images should have the same aspect ratio (the wipe assumes a
 *    1:1 spatial alignment between before and after)
 *  - Default labels "BEFORE" / "AFTER" — overrideable
 *  - Single neo-lime accent: the divider line is the only lime element
 */
export const SplitReveal: React.FC<SplitRevealProps> = ({
  before_image,
  after_image,
  before_label,
  after_label,
  wipe_start_sec,
  wipe_duration_sec,
}) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";

  const wipeStart = wipe_start_sec ?? 0.6;
  const wipeDur = wipe_duration_sec ?? 1.2;
  const t = frame / fps;

  const wipeProg = interpolate(t, [wipeStart, wipeStart + wipeDur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  });

  const beforeOp = interpolate(t, [0, 0.30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const beforeChipEnter = spring({
    frame: frame, fps, durationInFrames: Math.round(0.45 * fps),
    config: { damping: 16, stiffness: 130, mass: 0.7 },
  });
  const afterChipEnter = spring({
    frame: frame - Math.round(0.45 * fps), fps, durationInFrames: Math.round(0.45 * fps),
    config: { damping: 16, stiffness: 130, mass: 0.7 },
  });

  const settleK = interpolate(t, [wipeStart + wipeDur + 0.10, wipeStart + wipeDur + 1.50], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });
  const settleScale = 1 + 0.018 * settleK;

  const wipeX = wipeProg * width;
  const labelSize = Math.round(typeBase * 0.030);
  const dividerW = Math.round(typeBase * 0.008);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0F121A", overflow: "hidden" }}>
      <AbsoluteFill style={{
        transform: `scale(${settleScale})`,
        transformOrigin: "center",
      }}>
        {/* Before image (full frame, underneath) */}
        <Img
          src={resolveSrc(before_image)}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover",
            opacity: beforeOp,
          }}
        />

        {/* After image — clipped to the LEFT of the wipe edge (revealed) */}
        <div style={{
          position: "absolute", inset: 0,
          clipPath: `inset(0 ${100 - wipeProg * 100}% 0 0)`,
        }}>
          <Img
            src={resolveSrc(after_image)}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
            }}
          />
        </div>

        {/* Lime divider line at the wipe edge */}
        {wipeProg > 0 && wipeProg < 1 && (
          <div style={{
            position: "absolute",
            left: wipeX - dividerW / 2,
            top: 0, bottom: 0,
            width: dividerW,
            backgroundColor: "#CFFF05",
            boxShadow: `0 0 ${Math.round(typeBase * 0.030)}px ${Math.round(typeBase * 0.012)}px rgba(207,255,5,0.55)`,
          }} />
        )}

        {/* Lime drag handle on the divider — only visible during the wipe */}
        {wipeProg > 0 && wipeProg < 1 && (
          <div style={{
            position: "absolute",
            left: wipeX,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: Math.round(typeBase * 0.040),
            height: Math.round(typeBase * 0.040),
            borderRadius: "50%",
            backgroundColor: "#CFFF05",
            border: `3px solid #0F121A`,
            boxShadow: `0 ${Math.round(typeBase * 0.005)}px ${Math.round(typeBase * 0.014)}px rgba(15,18,26,0.40)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0F121A",
            fontWeight: 700,
            fontSize: Math.round(typeBase * 0.020),
          }}>
            ‹›
          </div>
        )}
      </AbsoluteFill>

      {/* BEFORE chip — bottom-left */}
      <div style={{
        position: "absolute",
        left: Math.round(typeBase * 0.040),
        bottom: Math.round(typeBase * 0.040),
        padding: `${Math.round(typeBase * 0.012)}px ${Math.round(typeBase * 0.024)}px`,
        backgroundColor: "rgba(15,18,26,0.92)",
        border: "2px solid rgba(255,255,255,0.20)",
        borderRadius: Math.round(typeBase * 0.012),
        fontFamily,
        fontWeight: 700,
        fontSize: labelSize,
        color: "#FFFFFF",
        textTransform: "uppercase",
        letterSpacing: "0.10em",
        opacity: beforeChipEnter,
        transform: `translateX(${interpolate(beforeChipEnter, [0, 1], [-30, 0])}px)`,
      }}>
        {before_label ?? "Before"}
      </div>

      {/* AFTER chip — bottom-right (lime, indicating it's the winner) */}
      <div style={{
        position: "absolute",
        right: Math.round(typeBase * 0.040),
        bottom: Math.round(typeBase * 0.040),
        padding: `${Math.round(typeBase * 0.012)}px ${Math.round(typeBase * 0.024)}px`,
        backgroundColor: "#CFFF05",
        borderRadius: Math.round(typeBase * 0.012),
        fontFamily,
        fontWeight: 700,
        fontSize: labelSize,
        color: "#0F121A",
        textTransform: "uppercase",
        letterSpacing: "0.10em",
        boxShadow: `0 ${Math.round(typeBase * 0.005)}px ${Math.round(typeBase * 0.014)}px rgba(15,18,26,0.30)`,
        opacity: afterChipEnter,
        transform: `translateX(${interpolate(afterChipEnter, [0, 1], [30, 0])}px)`,
      }}>
        {after_label ?? "After"}
      </div>
    </AbsoluteFill>
  );
};

import {
  AbsoluteFill,
  Img,
  staticFile,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useTypeBase } from "./motion";

/**
 * PORTRAIT BURST — small circular portraits in deterministic-random slots,
 * each landing at its own `appear_sec`. For moments where the speaker
 * references real people (CEOs, founders, public figures) — drop a small
 * face thumb at the moment they're named so the viewer attaches the claim
 * to a real human.
 *
 * Cardless dark-glass rim around each portrait (lime hairline) so the photo
 * reads as a "card" without a heavy frame. Optional name label below in
 * tight uppercase. DETERMINISTIC slot positions keyed on item index — same
 * plan renders identically.
 */
export type PortraitBurstItem = {
  image_path: string;
  /** Optional name label below the portrait (e.g. "Sam Altman"). */
  label?: string;
  /** Absolute source-video time the portrait should appear (seconds). */
  appear_sec: number;
};

export type PortraitBurstProps = {
  items: PortraitBurstItem[];
  /** Absolute source-video start of the beat — converts each item's
   *  appear_sec into a within-Sequence frame. */
  beat_start_sec?: number;
};

const LIME = "#CFFF05";
const BLOCK = "'Space Grotesk', system-ui, sans-serif";

// Deterministic slots — keyed on index, scattered but never overlapping.
// Each: { xPct, yPct, sizePct, rotate }. Positions stay clear of the
// speaker's head (top ~25%) and below the lower-third caption strip
// (bottom ~15%). xPct/yPct are the CENTER of the portrait, in 0..1.
const SLOTS: Array<{ xPct: number; yPct: number; sizePct: number; rotate: number }> = [
  { xPct: 0.20, yPct: 0.36, sizePct: 0.30, rotate: -4.0 },
  { xPct: 0.80, yPct: 0.62, sizePct: 0.30, rotate:  3.5 },
  { xPct: 0.78, yPct: 0.30, sizePct: 0.26, rotate:  2.5 },
  { xPct: 0.22, yPct: 0.68, sizePct: 0.26, rotate: -3.0 },
];

const resolveSrc = (p: string): string =>
  p.startsWith("http://") || p.startsWith("https://") || p.startsWith("data:")
    ? p : staticFile(p);

export const PortraitBurst: React.FC<PortraitBurstProps> = ({
  items, beat_start_sec,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const base = beat_start_sec ?? 0;

  if (!items || items.length === 0) return null;

  const exitStart = durationInFrames - 8;
  const groupOpacity = frame > exitStart
    ? interpolate(frame, [exitStart, durationInFrames], [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  const labelSize = Math.round(typeBase * 0.026);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: groupOpacity }}>
      {items.map((it, i) => {
        const slot = SLOTS[i % SLOTS.length];
        const appearF = Math.max(0, Math.round((it.appear_sec - base) * fps));
        const pop = spring({
          frame: frame - appearF, fps,
          durationInFrames: Math.round(0.45 * fps),
          config: { damping: 13, stiffness: 200, mass: 0.6 },
        });
        const visible = frame >= appearF;
        if (!visible) return null;
        const scale = interpolate(pop, [0, 1], [0.55, 1.0],
          { extrapolateRight: "clamp" });
        const opacity = interpolate(pop, [0, 0.6], [0, 1],
          { extrapolateRight: "clamp" });

        const size = width * slot.sizePct;
        const left = width * slot.xPct - size / 2;
        const top = height * slot.yPct - size / 2;
        const ringWidth = Math.max(3, Math.round(size * 0.014));

        return (
          <div key={i} style={{
            position: "absolute",
            left, top,
            width: size,
            opacity,
            transform: `scale(${scale}) rotate(${slot.rotate}deg)`,
            transformOrigin: "center",
          }}>
            {/* circular portrait with lime hairline + dark drop shadow */}
            <div style={{
              width: size, height: size,
              borderRadius: "50%",
              overflow: "hidden",
              border: `${ringWidth}px solid ${LIME}`,
              boxShadow: `0 ${size * 0.04}px ${size * 0.10}px rgba(0,0,0,0.55), 0 0 ${size * 0.05}px rgba(207,255,5,0.35)`,
              background: "#0F121A",
            }}>
              <Img src={resolveSrc(it.image_path)} style={{
                width: "100%", height: "100%", objectFit: "cover",
                display: "block",
              }} />
            </div>
            {it.label && (
              <div style={{
                marginTop: size * 0.06,
                fontFamily: BLOCK,
                fontWeight: 800,
                fontSize: labelSize,
                color: "#FFFFFF",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                textAlign: "center",
                textShadow: "0 4px 16px rgba(0,0,0,0.85), 0 2px 6px rgba(0,0,0,0.70)",
              }}>
                {it.label}
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

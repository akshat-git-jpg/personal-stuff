import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useTypeBase } from "./motion";

/**
 * BULLET BURST — short summed-up phrases accumulating on screen, each landing
 * at its own `appear_sec`. For the moments where the speaker is rapid-firing
 * a list mid-sentence:
 *   "Three sellers per niche. Same playbook. Same cold email three times a
 *    day."
 * One word_pop wouldn't capture it (it shows ONE phrase at a time). A boxed
 * list card is banned (rule 4ad). This template stacks the bullets cardless,
 * each in chunky uppercase typography, in DETERMINISTIC-RANDOM positions
 * (alternating alignment + slight horizontal/rotation jitter keyed on the
 * item index — looks scrapbook-collage, never overlapping).
 *
 * Cardless. Heavy text shadow so it reads over the speaker. Items POP IN
 * with spring scale + tiny rotation; once shown they stay. Last item can be
 * `accent` (lime) for the punchline.
 */
export type BulletBurstItem = {
  text: string;
  /** Absolute source-video time the item should appear (seconds). */
  appear_sec: number;
  /** Render in lime (the punchline highlight). Default false (white). */
  accent?: boolean;
};

export type BulletBurstProps = {
  items: BulletBurstItem[];
  /** Absolute source-video start of the beat — converts each item's absolute
   *  appear_sec into a within-Sequence frame (matches VerticalTimeline /
   *  BarOverlay convention). */
  beat_start_sec?: number;
};

const LIME = "#CFFF05";
const BLOCK = "'Space Grotesk', system-ui, sans-serif";

// Deterministic-random layout slots — chosen by INDEX, not Math.random,
// so the same plan renders identically every time. Mix of alignments + a
// tiny rotation so the stack reads as a curated scrapbook, not a list.
// vertical: 0..1 anchor within the safe lower-2/3 band (0.30–0.85), which
// keeps every bullet well clear of the speaker's head (rule 4al).
const SLOTS: Array<{ align: "left" | "center" | "right"; rotate: number; vertical: number }> = [
  { align: "left",   rotate: -2.0, vertical: 0.36 },
  { align: "right",  rotate:  1.5, vertical: 0.48 },
  { align: "center", rotate: -1.0, vertical: 0.60 },
  { align: "left",   rotate:  2.0, vertical: 0.72 },
  { align: "right",  rotate: -1.5, vertical: 0.82 },
];

export const BulletBurst: React.FC<BulletBurstProps> = ({ items, beat_start_sec }) => {
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

  const sideMargin = width * 0.07;
  const fontSize = Math.round(typeBase * 0.058);
  const shadow = "0 6px 24px rgba(0,0,0,0.90), 0 2px 6px rgba(0,0,0,0.80)";

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: groupOpacity }}>
      {items.map((it, i) => {
        const slot = SLOTS[i % SLOTS.length];
        const appearF = Math.max(0, Math.round((it.appear_sec - base) * fps));
        const pop = spring({
          frame: frame - appearF, fps,
          durationInFrames: Math.round(0.40 * fps),
          config: { damping: 12, stiffness: 220, mass: 0.55 },
        });
        const visible = frame >= appearF;
        if (!visible) return null;
        // Once shown, items stay — pop is the entrance, then settle at 1.
        const scale = interpolate(pop, [0, 1], [0.65, 1.0],
          { extrapolateRight: "clamp" });
        const opacity = interpolate(pop, [0, 0.6], [0, 1],
          { extrapolateRight: "clamp" });

        const color = it.accent ? LIME : "#FFFFFF";

        // Position the row at the slot's vertical anchor, aligned per slot.
        const justify =
          slot.align === "left" ? "flex-start"
          : slot.align === "right" ? "flex-end"
          : "center";
        return (
          <div key={i} style={{
            position: "absolute",
            left: sideMargin, right: sideMargin,
            top: height * slot.vertical - fontSize,
            display: "flex",
            justifyContent: justify,
            opacity,
          }}>
            <div style={{
              fontFamily: BLOCK,
              fontWeight: 900,
              fontSize,
              color,
              textTransform: "uppercase",
              letterSpacing: "0.01em",
              lineHeight: 1.0,
              textShadow: shadow,
              transform: `scale(${scale}) rotate(${slot.rotate}deg)`,
              transformOrigin: slot.align === "right" ? "right center"
                : slot.align === "left" ? "left center" : "center",
              maxWidth: width * 0.86,
              textAlign: slot.align,
            }}>
              {it.text}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

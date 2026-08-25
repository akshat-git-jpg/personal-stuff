import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { LightGridBg } from "./Backgrounds";
import { useTypeBase } from "./motion";

export type KeywordChip = {
  text: string;
  /** When this chip should pop in (seconds). */
  appear_sec?: number;
  /** Highlight this chip (lime fill, dark text). At most one usually. */
  active?: boolean;
};

export type KeywordChipsProps = {
  /** Optional title above the chip stack. */
  title?: string;
  chips: KeywordChip[];
};

/**
 * Pill-shaped chips for tools / terms / jargon. Chips wrap to new rows. Use
 * when the speaker name-drops 4–8 short tokens. Active chip gets lime fill;
 * inactive chips are raisin with a thin lime border.
 */
export const KeywordChips: React.FC<KeywordChipsProps> = ({ title, chips }) => {
  const { fps, width, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";

  const totalSec = durationInFrames / fps;
  const span = totalSec * 0.6;
  const norm = chips.map((c, i) => ({
    ...c,
    appear_sec: typeof c.appear_sec === "number"
      ? c.appear_sec
      : (span / Math.max(1, chips.length)) * i,
  }));

  return (
    <AbsoluteFill>
      <LightGridBg />
      <AbsoluteFill style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: width * 0.08,
      }}>
        {title && (
          <div style={{
            fontFamily,
            fontWeight: 700,
            fontSize: Math.round(typeBase * 0.055),
            color: "#FFFFFF",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: width * 0.05,
          }}>
            {title}
          </div>
        )}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: width * 0.025,
        }}>
          {norm.map((c, i) => {
            const f = Math.round(c.appear_sec * fps);
            const p = spring({
              frame: frame - f,
              fps,
              durationInFrames: Math.round(fps * 0.4),
              config: { damping: 13, stiffness: 130, mass: 0.6 },
            });
            const visible = frame >= f;
            const bg = c.active ? "#CFFF05" : "#0F121A";
            const fg = c.active ? "#0F121A" : "#FFFFFF";
            const border = c.active ? "transparent" : "#CFFF05";
            return (
              <div key={i} style={{
                // Slot pre-allocated so earlier chips don't reposition when
                // later chips appear (centered/wrapped containers shift).
                display: "inline-flex",
                visibility: visible ? "visible" : "hidden",
                alignItems: "center",
                fontFamily,
                fontWeight: 700,
                fontSize: Math.round(typeBase * 0.044),
                color: fg,
                backgroundColor: bg,
                border: `2.5px solid ${border}`,
                borderRadius: "999px",
                padding: `${width * 0.018}px ${width * 0.034}px`,
                opacity: p,
                transform: `translateY(${interpolate(p, [0, 1], [12, 0])}px) scale(${interpolate(p, [0, 1], [0.85, 1])})`,
              }}>
                {c.text}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { LightGridBg } from "./Backgrounds";
import { useFadeRise, useTypeBase } from "./motion";

export type StatGridItem = {
  /** Hero value, e.g. "12", "$8K", "97%". Stays static (no count-up — for that use metric_reveal). */
  value: string;
  /** Small label below the value, e.g. "ROUTINES" / "MRR" / "RETENTION". */
  label: string;
  /** Optional delta indicator, e.g. "+24%", "↑ 4.2x". Renders in lime if positive. */
  delta?: string;
  /** When this card pops in (sec, relative). */
  appear_sec?: number;
};

export type StatGridProps = {
  /** Optional title pinned at the top. */
  title?: string;
  /** Up to 6 stats (2×2, 1×3, 1×4, 2×3 layouts auto-pick). */
  stats: StatGridItem[];
};

const MAX_STATS = 6;

/**
 * Grid of mini-stats. Use when the speaker rattles off multiple numbers in
 * sequence ("12 routines, 22 skills, 48 edge fns"). Each cell pops in at its
 * own `appear_sec` so the grid builds with the speaker.
 *
 * Layout auto-picks based on count:
 *   1 → centered, big
 *   2 → 1×2
 *   3 → 1×3
 *   4 → 2×2 (default sweet spot)
 *   5–6 → 2×3
 *
 * Hard rules:
 *  - Each cell has a fixed aspect ratio (4:3) so the grid stays balanced
 *  - Single neo-lime accent: the value text is raisin black, the optional
 *    delta indicator is lime
 *  - All cells respect the brand palette (white surface, raisin border)
 */
export const StatGrid: React.FC<StatGridProps> = ({ title, stats }) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";
  const N = Math.min(MAX_STATS, stats.length);

  // ── Layout grid ────────────────────────────────────────────────────────
  const cols = N <= 1 ? 1 : N === 2 ? 2 : N === 3 ? 3 : N === 4 ? 2 : 3;
  const rows = Math.ceil(N / cols);

  const titleBarHeight = title ? Math.round(height * 0.13) : 0;
  const padX = Math.round(width * 0.06);
  const padY = Math.round(height * (title ? 0.20 : 0.10));
  const padBottom = Math.round(height * 0.10);
  const gap = Math.round(typeBase * 0.022);
  const gridW = width - padX * 2;
  const gridH = height - padY - padBottom;
  const cellW = Math.floor((gridW - gap * (cols - 1)) / cols);
  const cellH = Math.floor((gridH - gap * (rows - 1)) / rows);

  // Type sizing scales with cell size so 6-up cells use smaller text than
  // 2-up cells.
  const valueSize = Math.round(Math.min(cellH * 0.40, cellW * 0.28));
  const labelSize = Math.round(typeBase * 0.026);
  const deltaSize = Math.round(typeBase * 0.024);
  const titleSize = Math.round(typeBase * 0.046);
  const cardPad = Math.round(typeBase * 0.020);
  const cardRadius = Math.round(typeBase * 0.014);

  const titleEnter = spring({
    frame, fps, durationInFrames: 14,
    config: { damping: 18, stiffness: 130, mass: 0.65 },
  });

  // Auto-stagger if appear_sec missing
  const totalSec = useVideoConfig().durationInFrames / fps;
  const span = totalSec * 0.55;
  const norm = stats.slice(0, MAX_STATS).map((s, i) => ({
    ...s,
    appear_sec: typeof s.appear_sec === "number" ? s.appear_sec : (span / Math.max(1, N)) * i,
  }));

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <LightGridBg />

      {/* Title bar (raisin solid for high contrast over the cells) */}
      {title && (
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: titleBarHeight,
          backgroundColor: "#0F121A",
          borderBottom: "3px solid #CFFF05",
          paddingLeft: Math.round(width * 0.05),
          paddingRight: Math.round(width * 0.05),
          display: "flex",
          alignItems: "center",
          fontFamily,
          fontWeight: 700,
          fontSize: titleSize,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#FFFFFF",
          opacity: titleEnter,
          transform: `translateY(${interpolate(titleEnter, [0, 1], [-12, 0])}px)`,
          boxShadow: `0 ${Math.round(typeBase * 0.012)}px ${Math.round(typeBase * 0.026)}px rgba(15,18,26,0.20)`,
        }}>
          <span style={{ color: "#CFFF05", marginRight: Math.round(typeBase * 0.018) }}>━</span>
          {title}
        </div>
      )}

      {/* Grid */}
      <div style={{
        position: "absolute",
        left: padX,
        top: padY,
        width: gridW,
        height: gridH,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap,
      }}>
        {norm.map((s, i) => {
          const itemFrame = Math.round(s.appear_sec! * fps);
          const cardEnter = spring({
            frame: frame - itemFrame,
            fps,
            durationInFrames: Math.round(fps * 0.50),
            config: { damping: 16, stiffness: 120, mass: 0.7 },
          });
          const visible = frame >= itemFrame;
          const deltaIsPositive = s.delta?.match(/^[+↑]/);

          return (
            <div key={i} style={{
              backgroundColor: "#FFFFFF",
              border: "2px solid #0F121A",
              borderRadius: cardRadius,
              padding: cardPad,
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "flex-start",
              gap: Math.round(typeBase * 0.008),
              opacity: visible ? cardEnter : 0,
              transform: `translateY(${interpolate(cardEnter, [0, 1], [16, 0])}px) scale(${interpolate(cardEnter, [0, 1], [0.94, 1])})`,
              boxShadow: `0 ${Math.round(typeBase * 0.008)}px ${Math.round(typeBase * 0.020)}px rgba(15,18,26,0.10)`,
              overflow: "hidden",
            }}>
              <div style={{
                fontFamily,
                fontWeight: 700,
                fontSize: valueSize,
                color: "#0F121A",
                lineHeight: 0.92,
                letterSpacing: "-0.02em",
                fontVariantNumeric: "tabular-nums",
              }}>
                {s.value}
              </div>
              <div style={{
                fontFamily,
                fontWeight: 700,
                fontSize: labelSize,
                color: "#343E5B",
                textTransform: "uppercase",
                letterSpacing: "0.10em",
                lineHeight: 1.10,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                width: "100%",
              }}>
                {s.label}
              </div>
              {s.delta && (
                <div style={{
                  fontFamily,
                  fontWeight: 700,
                  fontSize: deltaSize,
                  color: deltaIsPositive ? "#0F121A" : "#5A6275",
                  backgroundColor: deltaIsPositive ? "#CFFF05" : "#E9ECED",
                  padding: `${Math.round(deltaSize * 0.20)}px ${Math.round(deltaSize * 0.50)}px`,
                  borderRadius: 999,
                  marginTop: Math.round(typeBase * 0.005),
                }}>
                  {s.delta}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

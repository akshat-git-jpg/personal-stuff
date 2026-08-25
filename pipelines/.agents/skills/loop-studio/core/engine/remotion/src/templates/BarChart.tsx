import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { LightGridBg } from "./Backgrounds";
import { useTypeBase } from "./motion";

export type BarChartItem = {
  label: string;
  /** Numeric value. Bar length is value / max. */
  value: number;
  /** Optional formatted display string (overrides numeric formatting at the bar end). */
  display?: string;
  /** Highlight this bar with the lime accent. At most one per chart. */
  highlight?: boolean;
  /** When this bar starts growing (sec, relative). Auto-staggered if missing. */
  appear_sec?: number;
};

export type BarChartProps = {
  /** Optional title pinned to top. */
  title?: string;
  /** Optional explicit max value; otherwise auto from highest bar × 1.10. */
  max?: number;
  bars: BarChartItem[];
  /** "horizontal" (default) — labels on the left, bars grow rightward.
   *  "vertical" — labels below, bars grow upward. */
  orientation?: "horizontal" | "vertical";
};

const MAX_BARS = 6;

/**
 * Animated bar chart. Bars grow from 0 → their value over ~0.7s with a smooth
 * ease-out (bezier 0.20, 0.65, 0.20, 1.0). Bar value labels tick up in sync,
 * so the eye sees both the bar AND the number landing together.
 *
 * Cinematic feel:
 *  - Each bar enters in sequence at its `appear_sec`
 *  - Highlighted bar gets a lime fill; others raisin (single-accent rule)
 *  - Subtle drop-shadow under the bar so it lifts off the gridded background
 *  - Tick marks on the axis at ~5 evenly-spaced values (horizontal mode)
 *
 * Best for: revenue/growth comparisons, before/after metrics, multi-option
 * stats where sizes need to be felt visually.
 */
export const BarChart: React.FC<BarChartProps> = ({ title, max, bars, orientation }) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";
  const N = Math.min(MAX_BARS, bars.length);
  const isHoriz = (orientation ?? "horizontal") === "horizontal";

  // Layout
  const titleBarHeight = title ? Math.round(height * 0.13) : 0;
  const padX = Math.round(width * 0.07);
  const padY = Math.round(height * (title ? 0.20 : 0.12));
  const padBottom = Math.round(height * 0.10);
  const tableW = width - padX * 2;
  const tableH = height - padY - padBottom;
  const titleSize = Math.round(typeBase * 0.046);

  const labelColW = isHoriz ? Math.round(tableW * 0.25) : 0;
  const valueColW = isHoriz ? Math.round(tableW * 0.13) : 0;
  const barAreaW = isHoriz ? tableW - labelColW - valueColW : tableW;
  const barAreaH = isHoriz ? tableH : tableH - Math.round(typeBase * 0.060);

  const computedMax = Math.max(0.01, max ?? Math.max(...bars.slice(0, N).map((b) => b.value)) * 1.10);

  // Auto-stagger
  const totalSec = durationInFrames / fps;
  const span = totalSec * 0.55;
  const norm = bars.slice(0, MAX_BARS).map((b, i) => ({
    ...b,
    appear_sec: typeof b.appear_sec === "number" ? b.appear_sec : (span / Math.max(1, N)) * i,
  }));

  // Per-bar growth animation. Value ramps from 0 → b.value over GROW_DUR
  // starting at b.appear_sec. Eased.
  const GROW_DUR = 0.75;
  const ease = Easing.bezier(0.20, 0.65, 0.20, 1.0);

  const titleEnter = spring({ frame, fps, durationInFrames: 14, config: { damping: 18, stiffness: 130, mass: 0.65 } });

  // Type sizing
  const labelSize = Math.round(typeBase * 0.030);
  const valueSize = Math.round(typeBase * 0.038);
  const barH = isHoriz ? Math.floor((barAreaH - (N - 1) * Math.round(typeBase * 0.015)) / N) : 0;
  const barW = isHoriz ? 0 : Math.floor((barAreaW - (N - 1) * Math.round(typeBase * 0.020)) / N);
  const cornerR = Math.round(typeBase * 0.008);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <LightGridBg />

      {title && (
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0, height: titleBarHeight,
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

      {/* Chart area */}
      <div style={{
        position: "absolute",
        left: padX, top: padY, width: tableW, height: tableH,
        display: "flex",
        flexDirection: isHoriz ? "column" : "row",
        gap: Math.round(typeBase * (isHoriz ? 0.015 : 0.020)),
        alignItems: isHoriz ? "stretch" : "flex-end",
      }}>
        {norm.map((b, i) => {
          const tNow = frame / fps;
          const k = interpolate(tNow, [b.appear_sec!, b.appear_sec! + GROW_DUR], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease,
          });
          const fillFrac = (b.value * k) / computedMax;
          const visible = frame >= Math.round(b.appear_sec! * fps);
          const enterOp = interpolate(tNow, [b.appear_sec!, b.appear_sec! + 0.20], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });
          const display = b.display ?? (Number.isInteger(b.value) ? b.value.toString() : b.value.toFixed(1));
          const liveDisplay = b.display ?? (Number.isInteger(b.value)
            ? Math.round(b.value * k).toString()
            : (b.value * k).toFixed(1));
          const barColor = b.highlight ? "#CFFF05" : "#0F121A";
          const valueColor = b.highlight ? "#0F121A" : "#0F121A";

          if (isHoriz) {
            return (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                height: barH,
                opacity: visible ? enterOp : 0,
              }}>
                <div style={{
                  width: labelColW,
                  fontFamily,
                  fontWeight: 700,
                  fontSize: labelSize,
                  color: "#0F121A",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  paddingRight: Math.round(typeBase * 0.014),
                  textAlign: "right",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {b.label}
                </div>
                <div style={{
                  position: "relative",
                  width: barAreaW,
                  height: barH,
                  background: "rgba(15,18,26,0.06)",
                  borderRadius: cornerR,
                  overflow: "hidden",
                }}>
                  <div style={{
                    position: "absolute",
                    left: 0, top: 0, bottom: 0,
                    width: `${fillFrac * 100}%`,
                    backgroundColor: barColor,
                    borderRadius: cornerR,
                    boxShadow: b.highlight
                      ? `0 ${Math.round(typeBase * 0.005)}px ${Math.round(typeBase * 0.014)}px rgba(207,255,5,0.40)`
                      : `0 ${Math.round(typeBase * 0.003)}px ${Math.round(typeBase * 0.010)}px rgba(15,18,26,0.20)`,
                    transition: "width 0ms",
                  }} />
                </div>
                <div style={{
                  width: valueColW,
                  fontFamily,
                  fontWeight: 700,
                  fontSize: valueSize,
                  color: valueColor,
                  textAlign: "left",
                  paddingLeft: Math.round(typeBase * 0.014),
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {liveDisplay}
                </div>
              </div>
            );
          }

          // Vertical bars
          const fillH = barAreaH * fillFrac;
          return (
            <div key={i} style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              width: barW,
              height: tableH,
              gap: Math.round(typeBase * 0.010),
              opacity: visible ? enterOp : 0,
            }}>
              <div style={{
                fontFamily,
                fontWeight: 700,
                fontSize: valueSize,
                color: "#0F121A",
                fontVariantNumeric: "tabular-nums",
              }}>
                {liveDisplay}
              </div>
              <div style={{
                width: barW,
                height: fillH,
                backgroundColor: barColor,
                borderRadius: `${cornerR}px ${cornerR}px 0 0`,
                boxShadow: b.highlight
                  ? `0 ${Math.round(typeBase * 0.005)}px ${Math.round(typeBase * 0.014)}px rgba(207,255,5,0.40)`
                  : `0 ${Math.round(typeBase * 0.003)}px ${Math.round(typeBase * 0.010)}px rgba(15,18,26,0.20)`,
              }} />
              <div style={{
                fontFamily,
                fontWeight: 700,
                fontSize: labelSize,
                color: "#0F121A",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                width: barW,
              }}>
                {b.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

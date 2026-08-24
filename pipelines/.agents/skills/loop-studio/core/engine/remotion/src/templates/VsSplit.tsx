import { AbsoluteFill, useVideoConfig } from "remotion";
import { BlueGridBg, LightGridBg } from "./Backgrounds";
import { useFadeRise, useSettleZoom, useWipe, useTypeBase } from "./motion";

export type VsSplitProps = {
  topLabel: string;
  topItems: string[];
  bottomLabel: string;
  bottomItems: string[];
  /** Which side is the "winner" — gets the lime accent. Default "bottom". */
  winner?: "top" | "bottom";
};

// Max items per half. We compute hooks unconditionally for each slot so the
// component never violates the rules of hooks regardless of how many items
// the caller passes (extras are ignored, missing slots render nothing).
const MAX_ITEMS = 5;

const ITEM_BASE_TOP = 0.25;
const ITEM_BASE_BOTTOM = 0.90;
const ITEM_STAGGER = 0.10;

/**
 * Old-vs-new contrast. Top half lives on the LIGHT grid (washed-out, "stale"
 * register). Bottom half lives on the BLUE grid (deeper, recommended path).
 * Bigger visual contrast than two raisin halves.
 */
export const VsSplit: React.FC<VsSplitProps> = ({
  topLabel,
  topItems,
  bottomLabel,
  bottomItems,
  winner = "bottom",
}) => {
  const { width, height } = useVideoConfig();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";

  // All hooks declared at top level, regardless of item count.
  const topWipe = useWipe(0.00, 0.45);
  const bottomWipe = useWipe(0.65, 0.45);
  const dividerWipe = useWipe(0.55, 0.45);
  // Settle-zoom disabled May 23 2026 — the slow 1.0→1.025 zoom on each
  // half was distracting and made the side text feel like it was creeping
  // out of frame. Static panels read cleaner. Winners can still be
  // emphasized via the lime accent in their items; no scale needed.
  const topZoom = 1.0;
  const bottomZoom = 1.0;
  const topLabelEnter = useFadeRise(0.10, 0.40, 12);
  const bottomLabelEnter = useFadeRise(0.75, 0.40, 12);

  // Reserve fixed-count hooks for each item slot
  const topItem0 = useFadeRise(ITEM_BASE_TOP + 0 * ITEM_STAGGER, 0.40, 10);
  const topItem1 = useFadeRise(ITEM_BASE_TOP + 1 * ITEM_STAGGER, 0.40, 10);
  const topItem2 = useFadeRise(ITEM_BASE_TOP + 2 * ITEM_STAGGER, 0.40, 10);
  const topItem3 = useFadeRise(ITEM_BASE_TOP + 3 * ITEM_STAGGER, 0.40, 10);
  const topItem4 = useFadeRise(ITEM_BASE_TOP + 4 * ITEM_STAGGER, 0.40, 10);
  const topEnters = [topItem0, topItem1, topItem2, topItem3, topItem4];

  const botItem0 = useFadeRise(ITEM_BASE_BOTTOM + 0 * ITEM_STAGGER, 0.40, 10);
  const botItem1 = useFadeRise(ITEM_BASE_BOTTOM + 1 * ITEM_STAGGER, 0.40, 10);
  const botItem2 = useFadeRise(ITEM_BASE_BOTTOM + 2 * ITEM_STAGGER, 0.40, 10);
  const botItem3 = useFadeRise(ITEM_BASE_BOTTOM + 3 * ITEM_STAGGER, 0.40, 10);
  const botItem4 = useFadeRise(ITEM_BASE_BOTTOM + 4 * ITEM_STAGGER, 0.40, 10);
  const botEnters = [botItem0, botItem1, botItem2, botItem3, botItem4];

  const halfHeight = (height - 4) / 2;
  const itemSize = Math.round(typeBase * 0.046);
  const labelSize = Math.round(typeBase * 0.060);

  const renderItem = (
    text: string,
    enter: { opacity: number; ty: number },
    isWinner: boolean,
    bullet: string,
    textColor: string,
  ) => (
    <div style={{
      fontFamily,
      fontWeight: 600,
      fontSize: itemSize,
      color: textColor,
      lineHeight: 1.25,
      marginBottom: height * 0.010,
      opacity: enter.opacity,
      transform: `translateY(${enter.ty}px)`,
      display: "flex",
      alignItems: "baseline",
      gap: width * 0.02,
    }}>
      <span style={{ color: bullet, fontWeight: 700 }}>●</span>
      <span>{text}</span>
    </div>
  );

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column" }}>
      {/* TOP HALF — light grid */}
      <div style={{
        height: halfHeight,
        position: "relative",
        overflow: "hidden",
        clipPath: `inset(${(1 - topWipe) * 100}% 0 0 0)`,
        transform: `scale(${topZoom})`,
        transformOrigin: "center top",
      }}>
        <LightGridBg />
        <AbsoluteFill style={{
          padding: `${height * 0.04}px ${width * 0.075}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}>
          <div style={{
            fontFamily,
            fontWeight: 700,
            fontSize: labelSize,
            color: winner === "top" ? "#CFFF05" : "#343E5B",
            textTransform: "uppercase",
            letterSpacing: "0.10em",
            marginBottom: height * 0.022,
            opacity: topLabelEnter.opacity,
            transform: `translateY(${topLabelEnter.ty}px)`,
          }}>
            {topLabel}
          </div>
          {topItems.slice(0, MAX_ITEMS).map((t, i) =>
            <div key={i}>{renderItem(
              t,
              topEnters[i],
              winner === "top",
              winner === "top" ? "#CFFF05" : "#343E5B",
              "#0F121A",
            )}</div>
          )}
        </AbsoluteFill>
      </div>

      {/* DIVIDER */}
      <div style={{
        height: 4,
        background: "#CFFF05",
        boxShadow: "0 0 24px rgba(207,255,5,0.55)",
        transformOrigin: "center",
        transform: `scaleX(${dividerWipe})`,
      }} />

      {/* BOTTOM HALF — blue grid */}
      <div style={{
        height: halfHeight,
        position: "relative",
        overflow: "hidden",
        clipPath: `inset(0 0 ${(1 - bottomWipe) * 100}% 0)`,
        transform: `scale(${bottomZoom})`,
        transformOrigin: "center bottom",
      }}>
        <BlueGridBg />
        <AbsoluteFill style={{
          padding: `${height * 0.04}px ${width * 0.075}px`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}>
          <div style={{
            fontFamily,
            fontWeight: 700,
            fontSize: labelSize,
            color: winner === "bottom" ? "#CFFF05" : "#B5BFC2",
            textTransform: "uppercase",
            letterSpacing: "0.10em",
            marginBottom: height * 0.022,
            opacity: bottomLabelEnter.opacity,
            transform: `translateY(${bottomLabelEnter.ty}px)`,
          }}>
            {bottomLabel}
          </div>
          {bottomItems.slice(0, MAX_ITEMS).map((t, i) =>
            <div key={i}>{renderItem(
              t,
              botEnters[i],
              winner === "bottom",
              winner === "bottom" ? "#CFFF05" : "#B5BFC2",
              "#FFFFFF",
            )}</div>
          )}
        </AbsoluteFill>
      </div>
    </AbsoluteFill>
  );
};

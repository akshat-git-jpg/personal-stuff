import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { DarkGridBg } from "./Backgrounds";
import { useTypeBase } from "./motion";

export type TickerItem = {
  /** Body text. Multi-line allowed via \n. Clamps to 2 lines. */
  text: string;
  /** Optional emoji or short token rendered to the left of the text. */
  glyph?: string;
  /** Right-aligned timestamp ("now", "1m ago"). */
  time?: string;
  /** Optional bold prefix label rendered before the body ("ROUTINE FIRED"). */
  label?: string;
  /** When this item appears at the top of the feed (sec, relative). */
  appear_sec?: number;
};

export type TickerFeedProps = {
  /** Optional title pinned at top. */
  title?: string;
  items: TickerItem[];
};

const MAX_ITEMS = 8;
const VISIBLE_SLOTS = 5; // how many rows render at once

/**
 * Cinematic activity ticker. Items appear at the TOP of a stack; older items
 * slide DOWN as new ones land. After VISIBLE_SLOTS items, the oldest fades
 * out the bottom — like a real activity log scrolling.
 *
 * Use for:
 *  - "Here's what my routine just did" — sequential automation events
 *  - Chat / Slack notification stream
 *  - Live transaction / order feed
 *  - Build-step progress (each step appears as a new ticker item)
 *
 * Visual register: dark-mode-IDE feel with monospace timestamps and lime
 * accents on labels. Each row has a subtle border-left bar that lights up
 * lime briefly on entrance.
 *
 * The animation is genuinely kinetic — older items get a smooth slide-down
 * transform whenever a new item lands, so the LAYOUT is always changing,
 * unlike most templates (which lock into a static frame after entrance).
 */
export const TickerFeed: React.FC<TickerFeedProps> = ({ title, items }) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";
  const fontMono = "ui-monospace, 'JetBrains Mono', Menlo, monospace";
  const N = Math.min(MAX_ITEMS, items.length);

  // Layout
  const titleBarHeight = title ? Math.round(height * 0.13) : 0;
  const padX = Math.round(width * (width >= height ? 0.18 : 0.06));
  const padY = Math.round(height * (title ? 0.20 : 0.10));
  const padBottom = Math.round(height * 0.10);
  const containerW = width - padX * 2;
  const containerH = height - padY - padBottom;

  const titleSize = Math.round(typeBase * 0.046);
  const labelSize = Math.round(typeBase * 0.022);
  const bodySize = Math.round(typeBase * 0.030);
  const timeSize = Math.round(typeBase * 0.022);
  const glyphSize = Math.round(typeBase * 0.034);
  const rowGap = Math.round(typeBase * 0.014);
  const rowPadX = Math.round(typeBase * 0.020);
  const rowPadY = Math.round(typeBase * 0.018);
  const rowH = Math.floor((containerH - rowGap * (VISIBLE_SLOTS - 1)) / VISIBLE_SLOTS);

  // Auto-stagger
  const totalSec = durationInFrames / fps;
  const span = totalSec * 0.75;
  const norm = items.slice(0, MAX_ITEMS).map((it, i) => ({
    ...it,
    appear_sec: typeof it.appear_sec === "number" ? it.appear_sec : 0.30 + (span / Math.max(1, N)) * i,
  }));

  // For each item, compute its current "stack index" — the OLDEST item visible
  // is at index 0 (bottom), newest is at index `last`. As new items land,
  // older indices increase (they get pushed DOWN).
  const tNow = frame / fps;
  const visibleIdx: { item: typeof norm[0]; visualSlot: number; freshK: number; idx: number }[] = [];
  norm.forEach((it, i) => {
    if (frame < Math.round(it.appear_sec! * fps)) return;
    visibleIdx.push({ item: it, visualSlot: 0, freshK: 0, idx: i });
  });
  // Most recent item at the TOP (visualSlot = 0); older items slot 1, 2, ...
  visibleIdx.reverse();
  visibleIdx.forEach((v, slot) => {
    v.visualSlot = slot;
    // Fresh-K: 1.0 → 0.0 over 0.40s after appear, used for entrance pop + lime border pulse
    v.freshK = interpolate(tNow, [v.item.appear_sec!, v.item.appear_sec! + 0.40], [1, 0], {
      extrapolateLeft: "clamp", extrapolateRight: "clamp",
    });
  });

  const titleEnter = spring({ frame, fps, durationInFrames: 14, config: { damping: 18, stiffness: 130, mass: 0.65 } });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkGridBg />

      {title && (
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0, height: titleBarHeight,
          backgroundColor: "rgba(15,18,26,0.94)",
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
        }}>
          <span style={{ color: "#CFFF05", marginRight: Math.round(typeBase * 0.018) }}>━</span>
          {title}
          {/* Pulsing lime "live" dot */}
          <span style={{
            display: "inline-block",
            width: Math.round(typeBase * 0.012),
            height: Math.round(typeBase * 0.012),
            backgroundColor: "#CFFF05",
            borderRadius: "50%",
            marginLeft: Math.round(typeBase * 0.020),
            opacity: 0.5 + 0.5 * Math.abs(Math.sin(frame / fps * 2.5)),
          }} />
        </div>
      )}

      {/* Container */}
      <div style={{
        position: "absolute",
        left: padX,
        top: padY,
        width: containerW,
        height: containerH,
        overflow: "hidden",
      }}>
        {visibleIdx.map(({ item, visualSlot, freshK, idx }) => {
          // Render only top VISIBLE_SLOTS items; older fade out
          if (visualSlot >= VISIBLE_SLOTS + 1) return null;
          const targetTop = visualSlot * (rowH + rowGap);
          const fadeOut = visualSlot >= VISIBLE_SLOTS
            ? interpolate(visualSlot, [VISIBLE_SLOTS, VISIBLE_SLOTS + 0.5], [0.6, 0], {
                extrapolateLeft: "clamp", extrapolateRight: "clamp",
              })
            : 1;
          const enterY = freshK * -rowH * 0.5;
          // freshK runs 1.0 (just appeared) → 0.0 (settled). Opacity should
          // rise quickly during the first 30% of the entrance window then
          // hold at 1. Hand-rolled because remotion's interpolate requires
          // monotonically increasing inputs.
          const enterOp = Math.min(1, (1 - freshK) / 0.3);
          return (
            <div key={idx} style={{
              position: "absolute",
              left: 0,
              top: targetTop,
              width: containerW,
              height: rowH,
              opacity: enterOp * fadeOut,
              transform: `translateY(${enterY}px)`,
              transition: "top 320ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}>
              <div style={{
                position: "relative",
                height: rowH,
                backgroundColor: "rgba(30, 36, 52, 0.85)",
                borderRadius: Math.round(typeBase * 0.012),
                border: "1px solid rgba(207, 255, 5, 0.12)",
                paddingLeft: rowPadX + Math.round(typeBase * 0.006),
                paddingRight: rowPadX,
                paddingTop: rowPadY,
                paddingBottom: rowPadY,
                display: "flex",
                alignItems: "center",
                gap: Math.round(typeBase * 0.014),
                overflow: "hidden",
              }}>
                {/* Lime border-left that "lights up" on fresh items */}
                <div style={{
                  position: "absolute",
                  left: 0, top: 0, bottom: 0,
                  width: Math.round(typeBase * 0.005),
                  backgroundColor: "#CFFF05",
                  opacity: 0.4 + freshK * 0.6,
                }} />

                {item.glyph && (
                  <div style={{
                    fontSize: glyphSize,
                    flexShrink: 0,
                    width: glyphSize * 1.2,
                    textAlign: "center",
                  }}>
                    {item.glyph}
                  </div>
                )}

                {/* Body column */}
                <div style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: Math.round(typeBase * 0.004),
                }}>
                  {item.label && (
                    <div style={{
                      fontFamily: fontMono,
                      fontWeight: 700,
                      fontSize: labelSize,
                      color: "#CFFF05",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {item.label}
                    </div>
                  )}
                  <div style={{
                    fontFamily,
                    fontWeight: 600,
                    fontSize: bodySize,
                    color: "#FFFFFF",
                    lineHeight: 1.20,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    overflowWrap: "break-word",
                    wordBreak: "normal",
                    hyphens: "manual",
                  }}>
                    {item.text}
                  </div>
                </div>

                {item.time && (
                  <div style={{
                    fontFamily: fontMono,
                    fontWeight: 600,
                    fontSize: timeSize,
                    color: "#9AA3AB",
                    flexShrink: 0,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {item.time}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

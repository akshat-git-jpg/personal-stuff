import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { useTypeBase } from "./motion";

export type SidePanelItem = {
  /** Bullet glyph: lime "•" by default. */
  glyph?: "dot" | "check" | "arrow";
  text: string;
  appear_sec?: number;
};

export type SidePanelProps = {
  /** Title pinned at top of the panel. */
  title?: string;
  /** Optional small kicker above the title (uppercase, lime). */
  kicker?: string;
  /** 2–5 items rendered as a vertical list inside the panel. */
  items: SidePanelItem[];
  /** Anchor side. Default "right". */
  anchor?: "right" | "left";
  /** Absolute source-video time when this beat starts. Used to convert
   *  per-item appear_sec (absolute, matches the convention used by `list`,
   *  `word_pop`, `keyword_chips`) into frame-relative within the Sequence.
   *  If omitted, appear_sec is treated as already-relative (legacy). */
  beat_start_sec?: number;
};

const MAX_ITEMS = 5;

const GLYPH_MAP: Record<NonNullable<SidePanelItem["glyph"]>, string> = {
  dot: "•",
  check: "✓",
  arrow: "→",
};

/**
 * Vertical side panel — speaker stays visible on the OTHER side of the frame.
 * Speaker fills ~60% of the frame width; panel takes the remaining ~40%.
 *
 * Use for "as I'm talking, here's the structured info" — bullet points,
 * mini-checklist, side roster, fact stack. Less visual weight than a full
 * takeover but still gives the eye somewhere structured to land.
 *
 * Choreography:
 *   0.00s   panel slides in from the side it's anchored to
 *   0.20s   title fades up
 *   0.35s   first item enters with translateY
 *   ~0.45s/item  subsequent items reveal with stagger
 *
 * Hard rules:
 *  - Item slot pre-allocated (visibility-gated) so earlier items DON'T
 *    shift when later ones reveal
 *  - Panel 40% wide, full frame height
 *  - Single neo-lime accent: only kicker + glyph chips use lime
 *  - NOT a takeover — speaker stays visible on the opposite side
 */
export const SidePanel: React.FC<SidePanelProps> = ({ title, kicker, items, anchor, beat_start_sec }) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";
  const N = Math.min(MAX_ITEMS, items.length);

  const slot = anchor ?? "right";
  const panelW = Math.round(width * 0.40);
  const panelLeft = slot === "right" ? width - panelW : 0;
  const padX = Math.round(typeBase * 0.030);
  const padY = Math.round(height * 0.10);

  const titleSize = Math.round(typeBase * 0.040);
  const kickerSize = Math.round(typeBase * 0.022);
  const itemSize = Math.round(typeBase * 0.030);
  const glyphChipSize = Math.round(itemSize * 1.30);
  const itemGap = Math.round(typeBase * 0.018);
  const slideOrigin = slot === "right" ? panelW * 0.6 : -panelW * 0.6;

  const panelEnter = spring({
    frame, fps, durationInFrames: Math.round(0.55 * fps),
    config: { damping: 16, stiffness: 120, mass: 0.7 },
  });
  const titleEnter = interpolate(frame / fps, [0.20, 0.55], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const kickerEnter = interpolate(frame / fps, [0.10, 0.40], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // Auto-stagger fallback for items that don't have appear_sec.
  // When beat_start_sec is provided (the convention used by list/word_pop/
  // keyword_chips), item.appear_sec is interpreted as ABSOLUTE source-video
  // time and converted to within-Sequence offset by subtracting beat_start_sec.
  // When omitted, appear_sec is treated as already-relative (legacy callers).
  const totalSec = durationInFrames / fps;
  const span = totalSec * 0.55;
  const norm = items.slice(0, MAX_ITEMS).map((it, i) => {
    const autoStaggerSec = 0.40 + (span / Math.max(1, N)) * i;
    if (typeof it.appear_sec !== "number") {
      return { ...it, appear_sec: autoStaggerSec };
    }
    const relSec = typeof beat_start_sec === "number"
      ? Math.max(0, it.appear_sec - beat_start_sec)
      : it.appear_sec;
    return { ...it, appear_sec: relSec };
  });

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute",
        left: panelLeft,
        top: 0,
        width: panelW,
        height: "100%",
        backgroundColor: "rgba(15, 18, 26, 0.92)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderLeft: slot === "right" ? `${Math.round(typeBase * 0.005)}px solid #CFFF05` : "none",
        borderRight: slot === "left" ? `${Math.round(typeBase * 0.005)}px solid #CFFF05` : "none",
        boxShadow: slot === "right"
          ? `${-Math.round(typeBase * 0.014)}px 0 ${Math.round(typeBase * 0.034)}px rgba(0,0,0,0.40)`
          : `${Math.round(typeBase * 0.014)}px 0 ${Math.round(typeBase * 0.034)}px rgba(0,0,0,0.40)`,
        padding: `${padY}px ${padX}px`,
        display: "flex",
        flexDirection: "column",
        gap: Math.round(typeBase * 0.022),
        opacity: panelEnter,
        transform: `translateX(${interpolate(panelEnter, [0, 1], [slideOrigin, 0])}px)`,
      }}>
        {kicker && (
          <div style={{
            fontFamily,
            fontWeight: 700,
            fontSize: kickerSize,
            color: "#CFFF05",
            textTransform: "uppercase",
            letterSpacing: "0.14em",
            opacity: kickerEnter,
            transform: `translateY(${interpolate(kickerEnter, [0, 1], [-8, 0])}px)`,
          }}>
            {kicker}
          </div>
        )}
        {title && (
          <div style={{
            fontFamily,
            fontWeight: 700,
            fontSize: titleSize,
            color: "#FFFFFF",
            lineHeight: 1.10,
            letterSpacing: "-0.005em",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
            opacity: titleEnter,
            transform: `translateY(${interpolate(titleEnter, [0, 1], [-10, 0])}px)`,
            marginBottom: Math.round(typeBase * 0.012),
          }}>
            {title}
          </div>
        )}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: itemGap,
        }}>
          {norm.map((it, i) => {
            const itemFrame = Math.round(it.appear_sec! * fps);
            const enter = spring({
              frame: frame - itemFrame, fps,
              durationInFrames: Math.round(0.45 * fps),
              config: { damping: 16, stiffness: 130, mass: 0.65 },
            });
            const visible = frame >= itemFrame;
            const glyph = GLYPH_MAP[it.glyph ?? "dot"];
            return (
              <div key={i} style={{
                display: "flex",
                alignItems: "flex-start",
                gap: Math.round(typeBase * 0.014),
                visibility: visible ? "visible" : "hidden",
                opacity: visible ? enter : 0,
                transform: visible ? `translateX(${interpolate(enter, [0, 1], [-12, 0])}px)` : "none",
              }}>
                <div style={{
                  width: glyphChipSize,
                  height: glyphChipSize,
                  borderRadius: Math.round(glyphChipSize * 0.22),
                  backgroundColor: "#CFFF05",
                  color: "#0F121A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily,
                  fontWeight: 800,
                  fontSize: Math.round(itemSize * 1.05),
                  flexShrink: 0,
                  marginTop: Math.round(itemSize * 0.06),
                }}>
                  {glyph}
                </div>
                <div style={{
                  flex: 1,
                  fontFamily,
                  fontWeight: 600,
                  fontSize: itemSize,
                  color: "#FFFFFF",
                  lineHeight: 1.30,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  overflowWrap: "break-word",
                  wordBreak: "normal",
                  hyphens: "manual",
                }}>
                  {it.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

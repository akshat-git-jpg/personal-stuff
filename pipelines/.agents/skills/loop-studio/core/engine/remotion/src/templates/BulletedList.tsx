import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { LightGridBg } from "./Backgrounds";
import { useTypeBase } from "./motion";

export type BulletedListItem = {
  text: string;
  /** Glyph in front: "check" (lime ✓), "x" (raisin ✗), "dot" (lime •), "arrow" (lime →), "warn" (raisin ⚠). Default "check". */
  glyph?: "check" | "x" | "dot" | "arrow" | "warn";
  appear_sec?: number;
};

export type BulletedListProps = {
  /** Optional title pinned at top. */
  title?: string;
  items: BulletedListItem[];
};

const MAX_ITEMS = 6;

const GLYPHS: Record<NonNullable<BulletedListItem["glyph"]>, { char: string; bg: string; fg: string }> = {
  check: { char: "✓", bg: "#CFFF05", fg: "#0F121A" },
  x:     { char: "✗", bg: "#0F121A", fg: "#FFFFFF" },
  dot:   { char: "•", bg: "#CFFF05", fg: "#0F121A" },
  arrow: { char: "→", bg: "#CFFF05", fg: "#0F121A" },
  warn:  { char: "!", bg: "#FFD66B", fg: "#0F121A" },
};

/**
 * Vertical bulleted list with semantic glyphs (check / x / dot / arrow / warn).
 * Items reveal one at a time from top to bottom. Best for:
 *   - Yes/no checklists ("does it repeat? ✓  predictable inputs? ✓  fallback? ✗")
 *   - Requirements lists
 *   - Pros/cons single-column
 *   - Step confirmations
 *
 * Hard rules:
 *  - Items wrap with 2-line max + ellipsis
 *  - Single neo-lime accent per item — only the glyph chip uses lime; text
 *    stays raisin black so the rule isn't violated when multiple items appear
 *  - Glyphs sit in a fixed-size square chip on the left, text flows right
 */
export const BulletedList: React.FC<BulletedListProps> = ({ title, items }) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";
  const N = Math.min(MAX_ITEMS, items.length);

  // Layout
  const titleBarHeight = title ? Math.round(height * 0.13) : 0;
  const padX = Math.round(width * (width >= height ? 0.16 : 0.08));
  const padY = Math.round(height * (title ? 0.20 : 0.12));
  const padBottom = Math.round(height * 0.10);
  const containerW = width - padX * 2;
  const containerH = height - padY - padBottom;

  const titleSize = Math.round(typeBase * 0.046);
  const itemSize = Math.round(typeBase * 0.040);
  const glyphSize = Math.round(itemSize * 1.6);
  const glyphChipSize = Math.round(itemSize * 1.45);
  const itemGap = Math.round(typeBase * 0.022);
  const rowPadY = Math.round(typeBase * 0.014);

  // Auto-stagger
  const totalSec = durationInFrames / fps;
  const span = totalSec * 0.65;
  const norm = items.slice(0, MAX_ITEMS).map((it, i) => ({
    ...it,
    appear_sec: typeof it.appear_sec === "number" ? it.appear_sec : (span / Math.max(1, N)) * i,
  }));

  const titleEnter = spring({
    frame, fps, durationInFrames: 14,
    config: { damping: 18, stiffness: 130, mass: 0.65 },
  });

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

      <div style={{
        position: "absolute",
        left: padX,
        top: padY,
        width: containerW,
        height: containerH,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: itemGap,
      }}>
        {norm.map((it, i) => {
          const itemFrame = Math.round(it.appear_sec! * fps);
          const enter = spring({
            frame: frame - itemFrame,
            fps,
            durationInFrames: Math.round(fps * 0.45),
            config: { damping: 16, stiffness: 130, mass: 0.65 },
          });
          const visible = frame >= itemFrame;
          const g = GLYPHS[it.glyph ?? "check"];

          return (
            <div key={i} style={{
              // Always rendered (slot pre-allocated) so earlier items DON'T
              // shift when later items appear. Visibility gated by opacity.
              display: "flex",
              alignItems: "flex-start",
              gap: Math.round(typeBase * 0.018),
              opacity: visible ? enter : 0,
              transform: visible
                ? `translateY(${interpolate(enter, [0, 1], [12, 0])}px) translateX(${interpolate(enter, [0, 1], [-12, 0])}px)`
                : "none",
              padding: `${rowPadY}px 0`,
            }}>
              <div style={{
                width: glyphChipSize,
                height: glyphChipSize,
                borderRadius: Math.round(glyphChipSize * 0.22),
                backgroundColor: g.bg,
                color: g.fg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily,
                fontWeight: 800,
                fontSize: glyphSize,
                lineHeight: 1,
                flexShrink: 0,
                boxShadow: `0 ${Math.round(typeBase * 0.005)}px ${Math.round(typeBase * 0.012)}px rgba(15,18,26,0.15)`,
              }}>
                {g.char}
              </div>
              <div style={{
                fontFamily,
                fontWeight: 700,
                fontSize: itemSize,
                color: "#0F121A",
                lineHeight: 1.25,
                letterSpacing: "-0.005em",
                paddingTop: Math.round(itemSize * 0.10),
                display: "-webkit-box",
                WebkitLineClamp: 2,
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
    </AbsoluteFill>
  );
};

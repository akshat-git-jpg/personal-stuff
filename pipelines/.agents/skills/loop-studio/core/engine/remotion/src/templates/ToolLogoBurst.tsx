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
 * TOOL LOGO BURST — small rounded-square brand thumbs in scattered slots,
 * each landing at its own `appear_sec`. Sibling of `portrait_burst` but for
 * product/company logos (which look wrong inside circles).
 *
 * Cardless dark-glass tile with a lime hairline ring around each logo so the
 * brand reads as a card without a heavy frame. Optional name label below.
 * DETERMINISTIC slot positions keyed on item index — same plan renders
 * identically every time.
 */
export type ToolLogoItem = {
  /** If omitted, the tile renders as a TEXT-only card with the `label`
   *  as the brand name — used when a logo isn't available (channel's own
   *  tools, very new products, anything not on Wikipedia). */
  image_path?: string;
  label?: string;
  /** Absolute source-video time the tile should appear (seconds). */
  appear_sec: number;
  /** Render with the lime emphasis ring (the "kept" / "winner" tool). */
  accent?: boolean;
  /** Optional placement overrides (0..1 frame-relative CENTER anchor) that
   *  replace the deterministic SLOT for this item. Use to drop a single hero
   *  logo into the clear LOWER zone of a landscape talking-head shot so it
   *  never overlays background shelves/decor (skill rule 4cn). When `x`/`y`
   *  are set the tile is NOT tilted unless `rotate` is given. `size` is the
   *  tile width as a fraction of frame width. */
  x?: number;
  y?: number;
  size?: number;
  rotate?: number;
  /** Slide the tile IN from a frame edge as it appears (instead of the default
   *  pop-in-place). "right" enters from off-screen right, "left" from left. */
  slide_from?: "left" | "right";
};

export type ToolLogoBurstProps = {
  items: ToolLogoItem[];
  /** Absolute source-video start of the beat. */
  beat_start_sec?: number;
  /** BARE mode: render the logo image directly with NO white card, NO ring,
   *  NO padding, NO rotation — for self-contained logos (e.g. the Claude
   *  orange tile) that already are a rounded icon. Label sits clearly below. */
  bare?: boolean;
};

const LIME = "#CFFF05";
const RAISIN = "#0F121A";
const BLOCK = "'Space Grotesk', system-ui, sans-serif";

// Up to 8 slots — for enumerations like "Hermes, Codex, Cursor, OpenClaw,
// Cline, Bolt, Replit, v0". Slot center as xPct/yPct (0..1). sizePct relative
// to frame WIDTH so they read at consistent visual size on 9:16.
const SLOTS: Array<{ xPct: number; yPct: number; sizePct: number; rotate: number }> = [
  { xPct: 0.18, yPct: 0.30, sizePct: 0.22, rotate: -3.0 },
  { xPct: 0.78, yPct: 0.34, sizePct: 0.22, rotate:  2.5 },
  { xPct: 0.22, yPct: 0.50, sizePct: 0.20, rotate:  1.5 },
  { xPct: 0.80, yPct: 0.56, sizePct: 0.22, rotate: -2.0 },
  { xPct: 0.20, yPct: 0.72, sizePct: 0.20, rotate: -2.5 },
  { xPct: 0.78, yPct: 0.76, sizePct: 0.20, rotate:  3.0 },
  { xPct: 0.50, yPct: 0.42, sizePct: 0.22, rotate: -1.5 },
  { xPct: 0.50, yPct: 0.84, sizePct: 0.20, rotate:  1.0 },
];

const resolveSrc = (p: string): string =>
  p.startsWith("http://") || p.startsWith("https://") || p.startsWith("data:")
    ? p : staticFile(p);

export const ToolLogoBurst: React.FC<ToolLogoBurstProps> = ({
  items, beat_start_sec, bare,
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

  const labelSize = Math.round(typeBase * 0.024);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: groupOpacity }}>
      {items.map((it, i) => {
        const slot = SLOTS[i % SLOTS.length];
        const appearF = Math.max(0, Math.round((it.appear_sec - base) * fps));
        const pop = spring({
          frame: frame - appearF, fps,
          durationInFrames: Math.round(0.40 * fps),
          config: { damping: 13, stiffness: 220, mass: 0.55 },
        });
        const visible = frame >= appearF;
        if (!visible) return null;
        const scale = interpolate(pop, [0, 1], [0.55, 1.0],
          { extrapolateRight: "clamp" });
        const opacity = interpolate(pop, [0, 0.6], [0, 1],
          { extrapolateRight: "clamp" });

        const hasPlacement = it.x != null || it.y != null;
        const xPct = it.x ?? slot.xPct;
        const yPct = it.y ?? slot.yPct;
        const sizePct = it.size ?? slot.sizePct;
        const rotate = it.rotate ?? (hasPlacement ? 0 : slot.rotate);
        const size = width * sizePct;
        const left = width * xPct - size / 2;
        const top = height * yPct - size / 2;
        const radius = size * 0.18;
        // Optional slide-in from a frame edge (overrides the pop's lateral
        // stillness). Eases from off-screen to the resting x over ~0.5s.
        const slideProg = it.slide_from
          ? spring({ frame: frame - appearF, fps,
              durationInFrames: Math.round(0.55 * fps),
              config: { damping: 18, stiffness: 150, mass: 0.7 } })
          : 1;
        const slideX = it.slide_from === "right"
          ? (1 - slideProg) * (width - left + size)
          : it.slide_from === "left"
            ? -(1 - slideProg) * (left + size)
            : 0;
        const ring = Math.max(3, Math.round(size * 0.018));
        const ringColor = it.accent ? LIME : "rgba(255,255,255,0.85)";

        if (bare) {
          // Clean logo: the image itself (already a rounded icon), no card,
          // no ring, no white bg, no rotation. Label clearly below.
          return (
            <div key={i} style={{
              position: "absolute",
              left, top, width: size,
              opacity,
              transform: `translateX(${slideX}px) scale(${scale})`,
              transformOrigin: "center",
              display: "flex", flexDirection: "column", alignItems: "center",
            }}>
              <Img src={resolveSrc(it.image_path || "")} style={{
                width: size, height: size, objectFit: "contain",
                borderRadius: radius, display: "block",
                filter: it.accent
                  ? `drop-shadow(0 ${size*0.05}px ${size*0.14}px rgba(0,0,0,0.5)) drop-shadow(0 0 ${size*0.10}px rgba(204,120,92,0.45))`
                  : `drop-shadow(0 ${size*0.05}px ${size*0.14}px rgba(0,0,0,0.5))`,
              }} />
              {it.label && (
                <div style={{
                  marginTop: size * 0.14,
                  fontFamily: BLOCK, fontWeight: 800, fontSize: labelSize,
                  color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.04em",
                  textAlign: "center", whiteSpace: "nowrap",
                  textShadow: "0 4px 16px rgba(0,0,0,0.85), 0 2px 6px rgba(0,0,0,0.70)",
                }}>
                  {it.label}
                </div>
              )}
            </div>
          );
        }

        return (
          <div key={i} style={{
            position: "absolute",
            left, top, width: size,
            opacity,
            transform: `translateX(${slideX}px) scale(${scale}) rotate(${rotate}deg)`,
            transformOrigin: "center",
          }}>
            <div style={{
              width: size, height: size,
              borderRadius: radius,
              overflow: "hidden",
              border: `${ring}px solid ${ringColor}`,
              background: it.image_path ? "#FFFFFF" : "#0F121A",
              boxShadow: it.accent
                ? `0 ${size*0.05}px ${size*0.12}px rgba(0,0,0,0.55), 0 0 ${size*0.06}px rgba(207,255,5,0.45)`
                : `0 ${size*0.05}px ${size*0.12}px rgba(0,0,0,0.55)`,
              padding: it.image_path ? size * 0.10 : size * 0.08,
              boxSizing: "border-box",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {it.image_path ? (
                <Img src={resolveSrc(it.image_path)} style={{
                  width: "100%", height: "100%", objectFit: "contain",
                  display: "block",
                }} />
              ) : (
                <div style={{
                  fontFamily: BLOCK,
                  fontWeight: 900,
                  fontSize: Math.round(size * 0.16),
                  color: it.accent ? LIME : "#FFFFFF",
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  textAlign: "center",
                  lineHeight: 1.0,
                  wordBreak: "break-word",
                }}>
                  {(it.label || "?").replace(/[^A-Za-z0-9 ]/g, "")}
                </div>
              )}
            </div>
            {it.label && (
              <div style={{
                marginTop: size * 0.06,
                fontFamily: BLOCK, fontWeight: 800,
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

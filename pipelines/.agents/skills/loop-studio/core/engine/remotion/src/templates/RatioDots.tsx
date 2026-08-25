import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useTypeBase } from "./motion";

/**
 * RATIO DOTS — "X out of Y" visualization with simple dots.
 *
 * Every time the speaker says a ratio ("9 of 12 routines killed", "3 of 11
 * tools made me money", "65 of 100 devs prefer X"), drop this in. Y dots in
 * a clean grid, then at `mark_at` exactly X of them flip to the OPPOSITE
 * state. The viewer instantly reads the proportion.
 *
 * Polarity controls which color "loses":
 *   - "negative": all dots start LIME (alive/kept/positive). At mark_at, the
 *                 first M dots fade to GRAY with a red X — these are the
 *                 ones being SUBTRACTED ("killed", "dropped", "lost"). Use
 *                 when M is the BAD number ("9 of 12 KILLED").
 *   - "positive": all dots start GRAY (idle/missed/empty). At mark_at, the
 *                 first M dots LIGHT UP to LIME — these are the WINNERS.
 *                 Use when M is the GOOD number ("3 of 12 STILL RUNNING").
 *
 * Cardless, lives in the lower-mid of the frame so the speaker stays visible
 * above (`vertical` default 0.55). Optional `caption` renders above the
 * grid in uppercase block type.
 */
export type RatioDotsProps = {
  /** Total number of dots (the Y in "X of Y"). */
  total: number;
  /** Number of dots to mark differently (the X in "X of Y"). */
  marked: number;
  /** Polarity controls the visual reading — see header docstring. */
  polarity?: "negative" | "positive";
  /** Absolute time the dots first appear (defaults to beat start). */
  appear_sec?: number;
  /** Absolute time the X marked dots flip state. */
  mark_at?: number;
  /** Optional uppercase caption above the grid. */
  caption?: string;
  /** Vertical anchor 0..1 of the dot-grid's center. Default 0.55. */
  vertical?: number;
  /** Optional explicit column count. Default = `ceil(sqrt(total))` which
   *  gives clean rectangles for most counts (12 → 4 cols / 3 rows). Set
   *  explicitly when the auto layout doesn't match what you want. */
  columns?: number;
  beat_start_sec?: number;
};

const LIME = "#CFFF05";
const SILVER = "#B5BFC2";
const SILVER_DIM = "rgba(181,191,194,0.35)";
const RED = "#FF4D5E";
const RAISIN = "#0F121A";
const BLOCK = "'Space Grotesk', system-ui, sans-serif";

export const RatioDots: React.FC<RatioDotsProps> = ({
  total, marked, polarity = "negative", appear_sec, mark_at,
  caption, vertical, columns, beat_start_sec,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const base = beat_start_sec ?? 0;

  if (total <= 0) return null;
  const M = Math.max(0, Math.min(total, Math.round(marked)));

  const exitStart = durationInFrames - 8;
  const groupOp = frame > exitStart
    ? interpolate(frame, [exitStart, durationInFrames], [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  // Grid geometry — `columns` override wins; else ceil(sqrt(total)) gives
  // clean rectangles for most counts (9→3, 12→4, 16→4). The old bias
  // toward wider rows produced 5+5+2 for 12; ceil(sqrt) gives a tidy 4×3.
  const cols = columns && columns > 0
    ? columns : Math.max(1, Math.ceil(Math.sqrt(total)));
  const rows = Math.ceil(total / cols);
  const gridW = Math.round(width * 0.74);
  const dotSpacing = gridW / cols;
  const dotSize = Math.round(dotSpacing * 0.50);
  const gridH = rows * dotSpacing;
  const gridLeft = Math.round((width - gridW) / 2);
  const cy = Math.round(height * Math.max(0.30, Math.min(0.78, vertical ?? 0.55)));
  const gridTop = cy - Math.round(gridH / 2);

  const captionSize = Math.round(typeBase * 0.034);
  const captionTop = gridTop - Math.round(captionSize * 1.8);
  const shadow = "0 6px 18px rgba(0,0,0,0.85), 0 2px 6px rgba(0,0,0,0.70)";

  const appearF = Math.max(0, Math.round(((appear_sec ?? base) - base) * fps));
  const markF = mark_at != null
    ? Math.max(appearF, Math.round((mark_at - base) * fps)) : null;

  // Initial color depends on polarity. Marked indices = the first M dots.
  // (We could randomize, but a contiguous block reads more clearly as a
  // proportion than scattered.)
  const isMarked = (i: number): boolean => i < M;
  const startColor = polarity === "negative" ? LIME : SILVER_DIM;
  const finalMarkedColor = polarity === "negative" ? SILVER_DIM : LIME;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: groupOp }}>
      {caption && (
        <div style={{
          position: "absolute",
          top: captionTop, left: 0, right: 0,
          textAlign: "center",
          fontFamily: BLOCK, fontWeight: 800, fontSize: captionSize,
          color: "#FFFFFF",
          textTransform: "uppercase", letterSpacing: "0.06em",
          textShadow: shadow,
          opacity: interpolate(frame, [appearF, appearF + 8], [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          {caption}
        </div>
      )}
      {Array.from({ length: total }).map((_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        // Center the LAST row if it's incomplete
        const lastRowCount = total - cols * (rows - 1);
        const xOffset = (r === rows - 1 && lastRowCount < cols)
          ? (cols - lastRowCount) * dotSpacing / 2 : 0;
        const dotCX = gridLeft + xOffset + c * dotSpacing + dotSpacing / 2;
        const dotCY = gridTop + r * dotSpacing + dotSpacing / 2;

        // Pop-in: each dot enters with a small per-index stagger.
        const dotAppearF = appearF + i * 3;
        const visible = frame >= dotAppearF;
        if (!visible) return null;
        const pop = spring({
          frame: frame - dotAppearF, fps,
          durationInFrames: Math.round(0.30 * fps),
          config: { damping: 14, stiffness: 240, mass: 0.5 },
        });
        const enterScale = interpolate(pop, [0, 1], [0.4, 1.0],
          { extrapolateRight: "clamp" });
        const enterOp = interpolate(pop, [0, 0.6], [0, 1],
          { extrapolateRight: "clamp" });

        // Color transition: if marked AND past markF, animate to finalMarkedColor.
        let color = startColor;
        let xProg = 0;
        if (markF != null && isMarked(i) && frame >= markF) {
          const t = interpolate(frame, [markF, markF + 10], [0, 1],
            { extrapolateRight: "clamp" });
          color = polarity === "negative"
            ? interpolateColor(LIME, SILVER_DIM, t)
            : interpolateColor(SILVER_DIM, LIME, t);
          // Show a red X over the dimmed dots in negative polarity
          if (polarity === "negative") xProg = t;
        }

        const glow = (color === LIME)
          ? `0 0 ${dotSize * 0.5}px rgba(207,255,5,0.55)` : "none";

        return (
          <div key={i} style={{
            position: "absolute",
            left: dotCX - dotSize / 2,
            top: dotCY - dotSize / 2,
            width: dotSize, height: dotSize,
            opacity: enterOp,
            transform: `scale(${enterScale})`,
            transformOrigin: "center",
          }}>
            <div style={{
              width: "100%", height: "100%",
              borderRadius: "50%",
              backgroundColor: color,
              boxShadow: glow,
              border: color === SILVER_DIM
                ? `1px solid rgba(255,255,255,0.15)` : "none",
            }} />
            {xProg > 0 && (
              <svg width={dotSize} height={dotSize}
                style={{ position: "absolute", left: 0, top: 0, opacity: xProg }}
                viewBox="0 0 100 100">
                <line x1="22" y1="22" x2="78" y2="78"
                      stroke={RED} strokeWidth="14" strokeLinecap="round" />
                <line x1="78" y1="22" x2="22" y2="78"
                      stroke={RED} strokeWidth="14" strokeLinecap="round" />
              </svg>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// Tiny color interpolator — supports hex (#RRGGBB) and rgba(...) endpoints
// of the form we use above. Returns rgba string.
function interpolateColor(a: string, b: string, t: number): string {
  const pa = parseRGBA(a);
  const pb = parseRGBA(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bb = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  const al = pa[3] + (pb[3] - pa[3]) * t;
  return `rgba(${r},${g},${bb},${al.toFixed(3)})`;
}
function parseRGBA(s: string): [number, number, number, number] {
  if (s.startsWith("#")) {
    const h = s.slice(1);
    const v = h.length === 3
      ? h.split("").map((c) => parseInt(c + c, 16))
      : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    return [v[0], v[1], v[2], 1];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(",").map((x) => parseFloat(x.trim()));
    return [parts[0], parts[1], parts[2], parts[3] ?? 1];
  }
  return [0, 0, 0, 1];
}

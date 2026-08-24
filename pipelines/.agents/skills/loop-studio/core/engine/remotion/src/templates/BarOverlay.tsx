import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useTypeBase } from "./motion";

/**
 * BAR OVERLAY — a compact bar chart that sits as a lower-third OVERLAY
 * (speaker stays visible), not a full-screen takeover. For visualizing a
 * change the speaker is describing: costs cut, revenue up, time down.
 *
 * Cardless — solid bars + shadowed labels, no glass frame — so it reads
 * like the `word_pop` text overlays, just with a chart instead of text.
 *
 * ── OVERLAP-PROOF LAYOUT ──────────────────────────────────────────────
 * The title and the bars used to be flexbox siblings, and a spring that
 * overshot 1.0 could grow a bar PAST `plotH` and punch up into the title.
 * This rewrite uses a RIGID fixed-box layout: the overlay is one absolute
 * box of known height, split into three stacked regions with hard-coded
 * tops — TITLE / PLOT / LABELS. A bar is absolutely positioned inside the
 * PLOT region, anchored to that region's floor, and its height is CLAMPED
 * to the region height. There is no flow, no flex overflow, no spring
 * overshoot that can escape — a bar physically cannot reach the title.
 */
export type BarOverlayItem = {
  label: string;
  /** Numeric height driver (relative to the set's max). */
  value: number;
  /** Optional text shown on the bar (e.g. "$100", "12 min"). */
  display?: string;
  /** Force the lime highlight on this bar. Default: the LAST bar is lime. */
  highlight?: boolean;
  /** Absolute source-video time this bar should grow in (seconds). Without
   *  it, bars stagger by index from the beat start — fine for a synchronous
   *  reveal (a 2-bar comparison), wrong for an enumerated count
   *  ("Message 1, Message 10, Message 20") where each bar must time to the
   *  word. Same convention as `vertical_timeline` steps (rule 4ba). */
  appear_sec?: number;
};

export type BarOverlayProps = {
  title?: string;
  bars: BarOverlayItem[];
  /** Vertical anchor 0..1 of the overlay block's top. Default 0.46. */
  vertical?: number;
  /** Absolute source-video start of the beat — converts each bar's absolute
   *  appear_sec into a within-Sequence frame (mirrors VerticalTimeline). */
  beat_start_sec?: number;
};

const LIME = "#CFFF05";
const RAISIN = "#0F121A";
const SILVER = "#B5BFC2";
const BLOCK = "'Space Grotesk', system-ui, sans-serif";

export const BarOverlay: React.FC<BarOverlayProps> = ({
  title, bars, vertical, beat_start_sec,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const base = beat_start_sec ?? 0;

  if (!bars || bars.length === 0) return null;

  const exitStart = durationInFrames - 8;
  const exitP = frame > exitStart
    ? interpolate(frame, [exitStart, durationInFrames], [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;
  const groupOpacity = 1 - exitP;

  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  const N = bars.length;

  // ── RIGID GEOMETRY ────────────────────────────────────────────────
  // Every region has a hard-coded height. The overlay box is the SUM of
  // them, anchored by pixel `top` (CSS % padding is width-relative — wrong
  // on a 9:16 frame). Nothing here can flex or overflow into a neighbour.
  const titleSize = Math.round(typeBase * 0.038);
  const labelSize = Math.round(typeBase * 0.030);
  const valSize = Math.round(typeBase * 0.040);
  const shadow = "0 4px 20px rgba(0,0,0,0.85), 0 2px 6px rgba(0,0,0,0.7)";

  const titleH = title ? Math.round(titleSize * 2.4) : 0;  // 2 lines max
  const titleGap = title ? Math.round(typeBase * 0.03) : 0;
  const plotH = Math.round(height * 0.20);                 // bar ceiling
  const labelsH = Math.round(plotH * 0.42);                // under-bar labels
  const deltaH = Math.round(typeBase * 0.09);              // delta-chip zone
  const blockH = titleH + titleGap + plotH + labelsH + deltaH;

  // Top of the whole overlay box, in pixels off frame HEIGHT.
  const blockTop = Math.round(
    height * Math.max(0, Math.min(0.58, vertical ?? 0.46)),
  );

  // Region tops, relative to the overlay box.
  const titleTop = 0;
  const plotTop = titleH + titleGap;
  const labelsTop = plotTop + plotH;
  const deltaTop = labelsTop + labelsH;

  // bars row geometry
  const barW = Math.min(width * 0.20, (width * 0.74) / N - width * 0.03);
  const gap = width * 0.06;

  // 2-bar set → a delta chip ("−84%"). Only when the author put real
  // numbers on the bars (`display` set) — deriving a precise % from
  // made-up heights would fabricate a stat.
  let delta: string | null = null;
  const hasRealNumbers = bars.some((b) => b.display);
  if (N >= 2 && hasRealNumbers) {
    const a = bars[0].value, b = bars[N - 1].value;
    if (a > 0) {
      const pct = Math.round(((b - a) / a) * 100);
      delta = (pct > 0 ? "+" : "") + pct + "%";
    }
  }

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* the rigid overlay box — fixed height, pixel-anchored */}
      <div style={{
        position: "absolute",
        left: 0, right: 0,
        top: blockTop,
        height: blockH,
        opacity: groupOpacity,
      }}>
        {/* ── TITLE region ───────────────────────────────────────── */}
        {title && (
          <div style={{
            position: "absolute",
            top: titleTop, left: 0, right: 0, height: titleH,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: BLOCK, fontWeight: 800, fontSize: titleSize,
            color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "0.04em",
            textShadow: shadow, textAlign: "center", lineHeight: 1.1,
            opacity: interpolate(frame, [0, 9], [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}>
            {title}
          </div>
        )}

        {/* ── PLOT region — bars live ONLY here, clamped to plotH ──── */}
        <div style={{
          position: "absolute",
          top: plotTop, left: 0, right: 0, height: plotH,
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          gap, overflow: "hidden",
        }}>
          {bars.map((bar, i) => {
            const isLime = bar.highlight ?? (i === N - 1);
            // Each bar's grow-in frame. If the bar carries `appear_sec`
            // (absolute source seconds — rule 4ba), time the grow to that
            // moment; otherwise stagger from beat start by index. This is
            // what lets each bar pop EXACTLY when the speaker names it
            // (scene-7's "Message 1 / 10 / 20") instead of spoiling the
            // whole comparison in the first second.
            const startF = typeof bar.appear_sec === "number"
              ? Math.max(0, Math.round((bar.appear_sec - base) * fps))
              : 6 + i * 7;
            // CLAMP the spring to [0,1] so an overshoot can't grow a bar
            // past plotH.
            const growRaw = spring({
              frame: frame - startF, fps,
              durationInFrames: Math.round(0.5 * fps),
              config: { damping: 18, stiffness: 130, mass: 0.7 },
            });
            const grow = Math.max(0, Math.min(1, growRaw));
            // min height so the value label always fits INSIDE the bar
            const minH = valSize * 2.0;
            // target height, HARD-clamped to the plot region
            const target = Math.min(
              plotH,
              Math.max(minH, (bar.value / maxVal) * plotH),
            );
            const h = Math.max(2, target * grow);
            // Hide the bar entirely until its grow window opens so it
            // doesn't sit as a 2px stub teasing the comparison.
            const visible = frame >= startF;
            return (
              <div key={i} style={{
                position: "relative",
                width: barW,
                height: h,
                opacity: visible ? 1 : 0,
                borderRadius: barW * 0.12,
                background: isLime
                  ? `linear-gradient(180deg, ${LIME} 0%, #A9D400 100%)`
                  : `linear-gradient(180deg, ${SILVER} 0%, #6E7886 100%)`,
                boxShadow: isLime
                  ? `0 0 ${typeBase * 0.03}px rgba(207,255,5,0.45)`
                  : "0 6px 18px rgba(0,0,0,0.45)",
              }}>
                {bar.display && (
                  <div style={{
                    position: "absolute",
                    top: typeBase * 0.012, left: 0, right: 0,
                    textAlign: "center",
                    fontFamily: BLOCK, fontWeight: 900, fontSize: valSize,
                    color: RAISIN,
                    opacity: interpolate(grow, [0.6, 1], [0, 1],
                      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                  }}>
                    {bar.display}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── LABELS region — under-bar labels, own fixed band ─────── */}
        <div style={{
          position: "absolute",
          top: labelsTop, left: 0, right: 0, height: labelsH,
          display: "flex", justifyContent: "center", gap,
        }}>
          {bars.map((bar, i) => (
            <div key={i} style={{
              width: barW,
              fontFamily: BLOCK, fontWeight: 700, fontSize: labelSize,
              color: "#FFFFFF", textShadow: shadow,
              marginTop: typeBase * 0.016, textAlign: "center",
              lineHeight: 1.1,
            }}>
              {bar.label}
            </div>
          ))}
        </div>

        {/* ── DELTA region — the headline change, own fixed band ───── */}
        {delta && (
          <div style={{
            position: "absolute",
            top: deltaTop, left: 0, right: 0, height: deltaH,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: BLOCK, fontWeight: 900,
            fontSize: Math.round(typeBase * 0.052),
            color: LIME, textShadow: shadow,
            opacity: interpolate(frame, [Math.round(0.55 * fps), Math.round(0.8 * fps)], [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            transform: `scale(${interpolate(
              spring({ frame: frame - Math.round(0.55 * fps), fps,
                durationInFrames: Math.round(0.4 * fps),
                config: { damping: 12, stiffness: 200, mass: 0.5 } }),
              [0, 1], [0.7, 1])})`,
          }}>
            {delta}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

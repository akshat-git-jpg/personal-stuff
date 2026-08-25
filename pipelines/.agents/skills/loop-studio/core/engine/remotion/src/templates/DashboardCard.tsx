import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useTypeBase } from "./motion";

/**
 * DASHBOARD CARD — a tiny mock SaaS dashboard. For moments where the speaker
 * says "dashboard" / "the metrics looked great" / "everything was green" —
 * show a card with 4 stat tiles (label + big number + trend pill) plus a
 * subtle pulsing "LIVE" indicator. Same Mac-window-style frame as
 * `claude_code_terminal` — they're the two screen visuals in the family.
 *
 * Numbers count UP on entrance via spring interpolation so the dashboard
 * feels alive. Trend pills (e.g. "+12%") render in lime; status values
 * ("✓ OK") in white. Optional bottom sparkline (line graph) to add motion.
 */
export type DashboardStat = {
  /** Small uppercase label above the value. */
  label: string;
  /** Final value text shown (e.g. "12", "847", "99.9%", "✓ OK"). If the
   *  value is a pure integer, the entrance counts up from 0 to it. */
  value: string;
  /** Optional trend pill below value (e.g. "+12%", "+3"). Renders lime. */
  trend?: string;
};

export type DashboardCardProps = {
  /** Title-bar label (e.g. "AGENT OPS · LIVE"). */
  title?: string;
  /** 1-6 stat tiles. */
  stats: DashboardStat[];
  /** Optional sparkline data — small line chart at bottom. */
  sparkline?: number[];
  /** Vertical anchor 0..1 of the card center. Default 0.55. */
  vertical?: number;
  beat_start_sec?: number;
};

const LIME = "#CFFF05";
const RAISIN = "#0F121A";
const SLATE = "#343E5B";
const BLOCK = "'Space Grotesk', system-ui, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title = "AGENT OPS · LIVE", stats, sparkline, vertical,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();

  if (!stats || stats.length === 0) return null;

  const exitStart = durationInFrames - 8;
  const groupOp = frame > exitStart
    ? interpolate(frame, [exitStart, durationInFrames], [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  // Card geometry — reduced height so tiles aren't over-tall with empty
  // vertical gaps (user feedback May 23 2026: "looks very fake and unaligned").
  const cardW = Math.round(width * 0.88);
  const cardH = Math.round(height * 0.34);
  const left = Math.round((width - cardW) / 2);
  const cy = Math.round(height * Math.max(0.30, Math.min(0.75, vertical ?? 0.55)));
  const top = cy - Math.round(cardH / 2);

  const titleSize = Math.round(typeBase * 0.022);
  const tileLabelSize = Math.round(typeBase * 0.019);
  const tileValueSize = Math.round(typeBase * 0.058);
  const trendSize = Math.round(typeBase * 0.018);

  // Card entrance
  const cardEnter = spring({
    frame: frame - 2, fps,
    durationInFrames: Math.round(0.40 * fps),
    config: { damping: 14, stiffness: 200, mass: 0.6 },
  });
  const enterOp = interpolate(cardEnter, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const enterTy = interpolate(cardEnter, [0, 1], [16, 0], { extrapolateRight: "clamp" });

  // "LIVE" indicator pulse
  const pulse = 0.55 + 0.45 * Math.abs(Math.sin((frame / fps) * Math.PI * 1.6));

  // Number count-up: parse pure integers and animate from 0 to value
  const parseInteger = (v: string): number | null => {
    const m = v.match(/^(-?)([\d,]+)$/);
    if (!m) return null;
    return parseInt(m[2].replace(/,/g, "")) * (m[1] === "-" ? -1 : 1);
  };
  const formatInt = (n: number, src: string): string => {
    const hasComma = src.includes(",");
    const v = Math.round(n);
    return hasComma ? v.toLocaleString() : String(v);
  };

  // Layout: prefer 2×2 grid for 3-4 stats (looks more balanced in portrait),
  // single row for ≤2.
  const tileCols = stats.length <= 2 ? stats.length : 2;
  const tileRows = Math.ceil(stats.length / tileCols);
  const tilePadX = Math.round(cardW * 0.035);
  const tileGapX = Math.round(cardW * 0.022);
  const tileGapY = Math.round(cardH * 0.04);
  const titleBarH = Math.round(titleSize * 3.0);
  const tileAreaTop = titleBarH + Math.round(cardH * 0.04);
  const tileAreaH = cardH - tileAreaTop - Math.round(cardH * 0.04);
  const tileW = (cardW - tilePadX * 2 - tileGapX * (tileCols - 1)) / tileCols;
  const tileH = (tileAreaH - tileGapY * (tileRows - 1)) / tileRows;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: groupOp }}>
      <div style={{
        position: "absolute",
        left, top, width: cardW, height: cardH,
        borderRadius: 16,
        background: "rgba(15,18,26,0.96)",
        border: "1px solid rgba(207,255,5,0.20)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.60), 0 0 60px rgba(207,255,5,0.10)",
        overflow: "hidden",
        opacity: enterOp,
        transform: `translateY(${enterTy}px)`,
      }}>
        {/* Title bar with traffic-light dots + LIVE pulse */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0, height: titleBarH,
          padding: `0 ${Math.round(titleSize * 1.1)}px`,
          background: "rgba(255,255,255,0.04)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: titleSize * 0.6,
        }}>
          <div style={{ width: titleSize * 0.7, height: titleSize * 0.7, borderRadius: "50%", background: "#FF5F57" }} />
          <div style={{ width: titleSize * 0.7, height: titleSize * 0.7, borderRadius: "50%", background: "#FEBC2E" }} />
          <div style={{ width: titleSize * 0.7, height: titleSize * 0.7, borderRadius: "50%", background: "#28C840" }} />
          <div style={{
            marginLeft: titleSize * 0.8,
            fontFamily: BLOCK, fontWeight: 700, fontSize: titleSize,
            color: "rgba(255,255,255,0.75)",
            textTransform: "uppercase", letterSpacing: "0.10em",
            flex: 1,
          }}>{title}</div>
          <div style={{
            display: "flex", alignItems: "center", gap: titleSize * 0.4,
            color: "#28C840",
            fontFamily: MONO, fontSize: titleSize * 0.9, fontWeight: 700,
          }}>
            <div style={{
              width: titleSize * 0.55, height: titleSize * 0.55,
              borderRadius: "50%", background: "#28C840",
              boxShadow: `0 0 ${titleSize * 0.6}px rgba(40,200,64,${pulse})`,
              opacity: pulse,
            }} />
            LIVE
          </div>
        </div>

        {/* Stat tiles */}
        {stats.map((s, i) => {
          const r = Math.floor(i / tileCols);
          const c = i % tileCols;
          const tileLeft = tilePadX + c * (tileW + tileGapX);
          const tileTop = tileAreaTop + r * (tileH + tileGapY);

          const tileSpring = spring({
            frame: frame - (4 + i * 4), fps,
            durationInFrames: Math.round(0.50 * fps),
            config: { damping: 14, stiffness: 200, mass: 0.6 },
          });
          const tileOp = interpolate(tileSpring, [0, 0.6], [0, 1], { extrapolateRight: "clamp" });
          const tileTy = interpolate(tileSpring, [0, 1], [10, 0], { extrapolateRight: "clamp" });

          // Number count-up
          const intVal = parseInteger(s.value);
          const valueText = intVal !== null
            ? formatInt(intVal * tileSpring, s.value)
            : s.value;

          // Trend color: lime for "+" deltas, red for "-" deltas, muted
          // gray for non-trend values like timestamps ("24h", "1m ago").
          const trendIsDelta = s.trend && /^[+-]/.test(s.trend);
          const trendIsNegative = s.trend && s.trend.startsWith("-");
          const trendColor = !trendIsDelta ? "rgba(255,255,255,0.45)"
            : trendIsNegative ? "#FF6B6E" : LIME;

          // Tiny inline sparkline at top-right of each tile — fake but
          // shape matches the trend (rising for positive delta, flat for
          // status/neutral). Deterministic per tile index so it doesn't
          // shimmer between renders.
          const sparkSeed = (i * 7 + 13) % 11;
          const sparkData = trendIsDelta && !trendIsNegative
            ? [3, 4, 5, 4, 7, 8, 10 + sparkSeed * 0.3, 12]
            : trendIsNegative
            ? [12, 11, 9, 10, 7, 6, 4, 3]
            : [6, 7, 6, 7, 8, 7, 8, 7];
          const sparkW = tileW * 0.42;
          const sparkH = tileH * 0.20;
          const sparkMax = Math.max(...sparkData);
          const sparkMin = Math.min(...sparkData);
          const sparkRange = Math.max(1, sparkMax - sparkMin);
          const sparkPoints = sparkData.map((v, k) => ({
            x: (sparkW * k) / (sparkData.length - 1),
            y: sparkH - ((v - sparkMin) / sparkRange) * sparkH * 0.9,
          }));
          const sparkPath = sparkPoints.reduce((acc, p, k) =>
            acc + (k === 0 ? `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
                            : ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`), "");
          const tilePadInner = Math.round(tileH * 0.11);

          return (
            <div key={i} style={{
              position: "absolute",
              left: tileLeft, top: tileTop, width: tileW, height: tileH,
              borderRadius: 10,
              background: "rgba(255,255,255,0.035)",
              border: "1px solid rgba(255,255,255,0.07)",
              padding: tilePadInner,
              boxSizing: "border-box",
              opacity: tileOp,
              transform: `translateY(${tileTy}px)`,
              display: "flex", flexDirection: "column",
              position: "absolute",
              overflow: "hidden",
            }}>
              {/* Top row: label + tiny sparkline */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start",
              }}>
                <div style={{
                  fontFamily: BLOCK, fontWeight: 700, fontSize: tileLabelSize,
                  color: "rgba(255,255,255,0.55)",
                  textTransform: "uppercase", letterSpacing: "0.10em",
                  lineHeight: 1.1,
                }}>{s.label}</div>
                <svg width={sparkW} height={sparkH} style={{ flex: "0 0 auto" }}>
                  <path d={sparkPath} fill="none"
                        stroke={trendColor}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.85" />
                </svg>
              </div>
              {/* Big value — flex-grow so it dominates vertically */}
              <div style={{
                flex: 1,
                display: "flex", alignItems: "center",
                fontFamily: BLOCK, fontWeight: 900, fontSize: tileValueSize,
                color: "#FFFFFF",
                lineHeight: 0.95,
                marginTop: tileH * 0.02,
              }}>{valueText}</div>
              {/* Trend pill */}
              {s.trend && (
                <div style={{
                  fontFamily: MONO, fontWeight: 700, fontSize: trendSize,
                  color: trendColor,
                  lineHeight: 1,
                }}>{s.trend}</div>
              )}
            </div>
          );
        })}

        {/* (bottom-spanning sparkline removed May 23 2026 — replaced with
            per-tile mini sparklines that read as actual data in each KPI
            instead of a decorative curve across the whole card.) */}
      </div>
    </AbsoluteFill>
  );
};

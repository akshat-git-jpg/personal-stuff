import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useTypeBase } from "./motion";

/**
 * INLINE CHART — small line-graph overlay for continuous-data moments
 * (token cost growing per message, solo-founder revenue distribution).
 * Different from `bar_overlay` which is for discrete enumeration; this is
 * for a TREND — the line draws progressively as the speaker explains the
 * pattern.
 *
 * Cardless dark-glass card in the lower-mid area (speaker stays visible
 * above). Title on top, line plot below, optional x-axis labels.
 * Animation: the line draws left-to-right over `draw_duration` seconds
 * starting at beat start; a lime dot rides the line's leading edge.
 */
export type InlineChartProps = {
  title?: string;
  /** Numeric values to plot. Plotted as a polyline left-to-right. */
  data: number[];
  /** Optional x-axis labels for each data point. */
  labels?: string[];
  /** Vertical anchor 0..1 of the card's center. Default 0.55. */
  vertical?: number;
  /** Seconds for the line to fully draw. Default 1.2. */
  draw_duration?: number;
  beat_start_sec?: number;
};

const LIME = "#CFFF05";
const RAISIN = "#0F121A";
const SLATE = "#343E5B";
const BLOCK = "'Space Grotesk', system-ui, sans-serif";

export const InlineChart: React.FC<InlineChartProps> = ({
  title, data, labels, vertical, draw_duration, beat_start_sec,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();

  if (!data || data.length < 2) return null;

  const exitStart = durationInFrames - 8;
  const groupOp = frame > exitStart
    ? interpolate(frame, [exitStart, durationInFrames], [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  // Card geometry — floats in the chosen vertical band, ~85% of width.
  const cardW = Math.round(width * 0.84);
  const cardH = Math.round(height * 0.34);
  const left = Math.round((width - cardW) / 2);
  const cy = Math.round(height * Math.max(0.30, Math.min(0.75, vertical ?? 0.55)));
  const top = cy - Math.round(cardH / 2);

  // Plot region inside the card (padding)
  const padX = Math.round(cardW * 0.06);
  const padTopTitle = title ? Math.round(typeBase * 0.040) + Math.round(cardH * 0.04) : Math.round(cardH * 0.04);
  const padBottomLabels = labels ? Math.round(typeBase * 0.024) + Math.round(cardH * 0.06) : Math.round(cardH * 0.06);
  const plotW = cardW - padX * 2;
  const plotH = cardH - padTopTitle - padBottomLabels;
  const plotLeft = padX;
  const plotTop = padTopTitle;

  // Map data → svg coordinates
  const N = data.length;
  const maxV = Math.max(...data, 1);
  const minV = Math.min(...data, 0);
  const range = Math.max(1, maxV - minV);
  const xAt = (i: number): number => plotLeft + (plotW * i) / (N - 1);
  const yAt = (v: number): number => plotTop + plotH - ((v - minV) / range) * plotH * 0.92;
  const points = data.map((v, i) => ({ x: xAt(i), y: yAt(v) }));

  // Line draws over draw_duration seconds — compute current progress
  const drawDur = draw_duration ?? 1.2;
  const drawF = Math.round(drawDur * fps);
  const drawProg = interpolate(frame, [4, 4 + drawF], [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Use stroke-dasharray trick to animate path drawing — compute total path length
  // approximation: sum of segment lengths
  const totalLen = points.slice(1).reduce(
    (acc, p, i) => acc + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0
  );

  // pathD as polyline through points
  const pathD = points.reduce((acc, p, i) => acc + (i === 0
    ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`), "");

  // Leading-edge dot position along the path
  const targetLen = totalLen * drawProg;
  let acc = 0;
  let dotX = points[0].x, dotY = points[0].y;
  for (let i = 1; i < points.length; i++) {
    const segLen = Math.hypot(points[i].x - points[i-1].x, points[i].y - points[i-1].y);
    if (acc + segLen >= targetLen) {
      const t = segLen === 0 ? 0 : (targetLen - acc) / segLen;
      dotX = points[i-1].x + (points[i].x - points[i-1].x) * t;
      dotY = points[i-1].y + (points[i].y - points[i-1].y) * t;
      break;
    }
    acc += segLen;
    dotX = points[i].x; dotY = points[i].y;
  }

  const titleSize = Math.round(typeBase * 0.030);
  const labelSize = Math.round(typeBase * 0.022);

  const cardEnter = spring({
    frame: frame - 2, fps,
    durationInFrames: Math.round(0.40 * fps),
    config: { damping: 14, stiffness: 200, mass: 0.6 },
  });
  const enterOp = interpolate(cardEnter, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const enterTy = interpolate(cardEnter, [0, 1], [16, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: groupOp }}>
      <div style={{
        position: "absolute",
        left, top, width: cardW, height: cardH,
        borderRadius: 16,
        background: "rgba(15,18,26,0.94)",
        border: "1px solid rgba(207,255,5,0.20)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.60), 0 0 60px rgba(207,255,5,0.10)",
        opacity: enterOp,
        transform: `translateY(${enterTy}px)`,
        overflow: "hidden",
      }}>
        {title && (
          <div style={{
            position: "absolute",
            top: Math.round(cardH * 0.06), left: padX, right: padX,
            fontFamily: BLOCK, fontWeight: 800, fontSize: titleSize,
            color: "#FFFFFF",
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}>{title}</div>
        )}
        <svg width={cardW} height={cardH}
             style={{ position: "absolute", left: 0, top: 0 }}>
          {/* baseline */}
          <line x1={plotLeft} y1={plotTop + plotH}
                x2={plotLeft + plotW} y2={plotTop + plotH}
                stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
          {/* main line — stroke-dasharray for draw animation */}
          <path d={pathD} fill="none" stroke={LIME} strokeWidth="4"
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={`${totalLen} ${totalLen}`}
                strokeDashoffset={totalLen * (1 - drawProg)} />
          {/* glow under line */}
          <path d={pathD} fill="none" stroke={LIME} strokeWidth="10"
                strokeLinecap="round" strokeLinejoin="round"
                strokeOpacity="0.18"
                strokeDasharray={`${totalLen} ${totalLen}`}
                strokeDashoffset={totalLen * (1 - drawProg)} />
          {/* leading-edge dot */}
          {drawProg < 1 && (
            <circle cx={dotX} cy={dotY} r={6} fill={LIME}
                    stroke={RAISIN} strokeWidth="2" />
          )}
          {/* final point */}
          {drawProg >= 1 && (
            <circle cx={points[points.length-1].x} cy={points[points.length-1].y}
                    r={8} fill={LIME} stroke={RAISIN} strokeWidth="2" />
          )}
        </svg>
        {/* x-axis labels */}
        {labels && (
          <div style={{
            position: "absolute",
            left: padX, right: padX,
            bottom: Math.round(cardH * 0.04),
            display: "flex", justifyContent: "space-between",
            fontFamily: BLOCK, fontWeight: 700, fontSize: labelSize,
            color: "rgba(255,255,255,0.65)",
            textTransform: "uppercase", letterSpacing: "0.05em",
          }}>
            {labels.slice(0, N).map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

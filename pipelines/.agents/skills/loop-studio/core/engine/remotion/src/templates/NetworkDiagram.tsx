import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { DarkGridBg } from "./Backgrounds";
import { useTypeBase } from "./motion";

export type NetworkNode = {
  id: string;
  label: string;
  /** Optional emoji/glyph rendered inside the node circle. */
  glyph?: string;
  /** Position as a fraction of the chart area. 0,0 = top-left, 1,1 = bottom-right.
   *  If omitted for ALL nodes, auto-layout in a horizontal row. */
  x?: number;
  y?: number;
  /** Mark this node as "active" — gets the lime fill. At most one. */
  highlight?: boolean;
  /** When this node pops in (sec, relative). */
  appear_sec?: number;
};

export type NetworkEdge = {
  from: string;
  to: string;
  /** Optional label rendered along the edge midpoint. */
  label?: string;
  /** Marching-ants animation along the edge for "data flowing." Default false. */
  flowing?: boolean;
  /** When this edge starts drawing in (sec, relative). Auto-stagger if missing. */
  appear_sec?: number;
};

export type NetworkDiagramProps = {
  title?: string;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
};

const MAX_NODES = 8;

/**
 * Network/system diagram — circular nodes connected by animated edges.
 * Edges draw in left-to-right (stroke-dashoffset trick), then optionally
 * pulse a lime "data packet" along their length to show data flowing.
 *
 * Use for:
 *  - Agent topology ("the cron triggers the routine, which calls the LLM,
 *    which writes to the DB")
 *  - System architecture maps
 *  - Decision trees / branching workflows
 *  - Anything where the RELATIONSHIPS between things matter, not just
 *    sequence (use flow_diagram for sequential pipelines)
 *
 * Layout:
 *  - If nodes have x,y fractions set, those are honored
 *  - Otherwise auto-layout in a horizontal row
 */
export const NetworkDiagram: React.FC<NetworkDiagramProps> = ({ title, nodes, edges }) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";
  const N = Math.min(MAX_NODES, nodes.length);

  // Layout
  const titleBarHeight = title ? Math.round(height * 0.13) : 0;
  const padX = Math.round(width * 0.10);
  const padY = Math.round(height * (title ? 0.22 : 0.14));
  const padBottom = Math.round(height * 0.14);
  const chartW = width - padX * 2;
  const chartH = height - padY - padBottom;

  const nodeR = Math.round(Math.min(chartW, chartH) * 0.075);
  const labelSize = Math.round(typeBase * 0.024);
  const glyphSize = Math.round(typeBase * 0.044);
  const titleSize = Math.round(typeBase * 0.046);
  const edgeLabelSize = Math.round(typeBase * 0.020);

  // Auto-layout: if any node lacks x,y, distribute horizontally evenly.
  const hasManualLayout = nodes.slice(0, N).every((n) => typeof n.x === "number" && typeof n.y === "number");
  const positioned = nodes.slice(0, N).map((n, i) => {
    if (hasManualLayout) {
      return { ...n, _x: n.x! * chartW, _y: n.y! * chartH };
    }
    // Auto: horizontal centerline
    const xFrac = N === 1 ? 0.5 : i / (N - 1);
    return { ...n, _x: xFrac * chartW, _y: chartH * 0.5 };
  });

  const nodeById = Object.fromEntries(positioned.map((n) => [n.id, n]));

  const totalSec = durationInFrames / fps;
  const span = totalSec * 0.65;
  const norm = positioned.map((n, i) => ({
    ...n,
    appear_sec: typeof n.appear_sec === "number" ? n.appear_sec : (span / Math.max(1, N)) * i,
  }));
  const normEdges = edges.map((e, i) => ({
    ...e,
    appear_sec: typeof e.appear_sec === "number" ? e.appear_sec : (span / Math.max(1, edges.length || 1)) * i + 0.30,
  }));

  const titleEnter = spring({ frame, fps, durationInFrames: 14, config: { damping: 18, stiffness: 130, mass: 0.65 } });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <DarkGridBg />

      {title && (
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0, height: titleBarHeight,
          backgroundColor: "rgba(15,18,26,0.92)",
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
        </div>
      )}

      {/* SVG layer for edges + nodes — easier to coordinate than absolute divs */}
      <svg
        width={chartW}
        height={chartH}
        style={{
          position: "absolute",
          left: padX,
          top: padY,
          overflow: "visible",
        }}
      >
        {/* Edges (drawn first, behind nodes) */}
        {normEdges.map((e, i) => {
          const a = nodeById[e.from];
          const b = nodeById[e.to];
          if (!a || !b) return null;
          // Compute endpoint at the EDGE of each node circle, not center.
          const dx = b._x - a._x;
          const dy = b._y - a._y;
          const len = Math.sqrt(dx * dx + dy * dy);
          const ux = dx / (len || 1);
          const uy = dy / (len || 1);
          const x1 = a._x + ux * nodeR;
          const y1 = a._y + uy * nodeR;
          const x2 = b._x - ux * nodeR;
          const y2 = b._y - uy * nodeR;
          const tNow = frame / fps;
          const drawProg = interpolate(tNow, [e.appear_sec!, e.appear_sec! + 0.50], [0, 1], {
            extrapolateLeft: "clamp", extrapolateRight: "clamp",
          });

          // Marching-ants flow effect
          const flowOffset = e.flowing
            ? -((tNow - e.appear_sec!) * 60) % 24
            : 0;

          // Midpoint for label
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;

          return (
            <g key={i}>
              {/* Edge line — clip-path to draw progressively */}
              <line
                x1={x1} y1={y1}
                x2={x1 + (x2 - x1) * drawProg}
                y2={y1 + (y2 - y1) * drawProg}
                stroke="rgba(207,255,5,0.85)"
                strokeWidth={3}
                strokeLinecap="round"
              />
              {/* Marching-ants packet (lime dot) traveling along */}
              {e.flowing && drawProg >= 1 && (
                <circle
                  cx={x1 + (x2 - x1) * (((tNow - e.appear_sec! - 0.5) * 0.6) % 1)}
                  cy={y1 + (y2 - y1) * (((tNow - e.appear_sec! - 0.5) * 0.6) % 1)}
                  r={Math.max(4, nodeR * 0.12)}
                  fill="#CFFF05"
                  opacity={0.95}
                />
              )}
              {/* Arrowhead at endpoint */}
              {drawProg >= 1 && (
                <polygon
                  points={`${x2},${y2} ${x2 - ux * 14 - uy * 7},${y2 - uy * 14 + ux * 7} ${x2 - ux * 14 + uy * 7},${y2 - uy * 14 - ux * 7}`}
                  fill="rgba(207,255,5,0.85)"
                />
              )}
              {/* Edge label */}
              {e.label && drawProg >= 0.6 && (
                <g>
                  <rect
                    x={mx - e.label.length * edgeLabelSize * 0.32}
                    y={my - edgeLabelSize * 0.7}
                    width={e.label.length * edgeLabelSize * 0.64}
                    height={edgeLabelSize * 1.4}
                    rx={6}
                    fill="rgba(15,18,26,0.92)"
                    opacity={interpolate(tNow, [e.appear_sec! + 0.30, e.appear_sec! + 0.55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
                  />
                  <text
                    x={mx}
                    y={my + edgeLabelSize * 0.30}
                    fontFamily={fontFamily}
                    fontSize={edgeLabelSize}
                    fontWeight={700}
                    fill="#CFFF05"
                    textAnchor="middle"
                    opacity={interpolate(tNow, [e.appear_sec! + 0.30, e.appear_sec! + 0.55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
                  >
                    {e.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {norm.map((n, i) => {
          const itemFrame = Math.round(n.appear_sec! * fps);
          const enter = spring({
            frame: frame - itemFrame, fps,
            durationInFrames: Math.round(fps * 0.45),
            config: { damping: 14, stiffness: 130, mass: 0.6 },
          });
          const visible = frame >= itemFrame;
          const fill = n.highlight ? "#CFFF05" : "#1E2434";
          const stroke = n.highlight ? "#0F121A" : "#CFFF05";
          const labelColor = "#FFFFFF";
          const glyphColor = n.highlight ? "#0F121A" : "#FFFFFF";
          const scale = interpolate(enter, [0, 1], [0.6, 1]);

          return (
            <g key={i} opacity={visible ? enter : 0} transform={`translate(${n._x},${n._y}) scale(${scale})`}>
              <circle
                cx={0} cy={0} r={nodeR}
                fill={fill}
                stroke={stroke}
                strokeWidth={3}
              />
              {n.glyph && (
                <text
                  x={0} y={glyphSize * 0.25}
                  fontFamily={fontFamily}
                  fontSize={glyphSize}
                  textAnchor="middle"
                  fill={glyphColor}
                >
                  {n.glyph}
                </text>
              )}
              {/* Label below the node */}
              <text
                x={0}
                y={nodeR + labelSize * 1.5}
                fontFamily={fontFamily}
                fontSize={labelSize}
                fontWeight={700}
                fill={labelColor}
                textAnchor="middle"
                style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}
              >
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

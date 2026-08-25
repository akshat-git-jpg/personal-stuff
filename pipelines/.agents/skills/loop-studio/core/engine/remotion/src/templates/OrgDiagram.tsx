import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { LightGridBg } from "./Backgrounds";
import { useTypeBase } from "./motion";

/**
 * ORG DIAGRAM — a 12-box org chart with pretty arrows. Specifically built
 * for scene-11's "12 boxes and pretty arrows" moment: the diagram literally
 * appears as the speaker describes it, then most of the boxes dim out + get
 * a red X to reveal "the other nine are theater."
 *
 * Layout: ONE parent box at top ("AI TEAM"), with N child boxes below in a
 * 4×3 grid. Lines connect parent to each child. Each child has
 * `appear_sec`; optional `dim_at` marks it as "fired once, never came back."
 * `kept` children stay lime.
 */
export type OrgDiagramNode = {
  label?: string;
  appear_sec: number;
  /** When this node should fade + show the red X. */
  dim_at?: number;
  /** Render as a kept / surviving node (lime fill). */
  kept?: boolean;
};

export type OrgDiagramProps = {
  title?: string;
  parent_label?: string;
  nodes: OrgDiagramNode[];
  beat_start_sec?: number;
};

const LIME = "#CFFF05";
const RAISIN = "#0F121A";
const SLATE = "#343E5B";
const RED = "#FF4D5E";
const SILVER_BG = "#E6EAF0";
const BLOCK = "'Space Grotesk', system-ui, sans-serif";

export const OrgDiagram: React.FC<OrgDiagramProps> = ({
  title, parent_label, nodes, beat_start_sec,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const base = beat_start_sec ?? 0;

  if (!nodes || nodes.length === 0) return null;

  // Layout: title at top, parent box below it, N children in 3 rows of 4.
  const padX = width * 0.06;
  const titleSize = Math.round(typeBase * 0.044);
  const titleH = title ? titleSize * 1.4 : 0;
  const titleTop = height * 0.07;

  const parentW = width * 0.32;
  const parentH = height * 0.075;
  const parentTop = titleTop + titleH + height * 0.025;
  const parentLeft = (width - parentW) / 2;

  // child grid
  const cols = 4;
  const rows = Math.ceil(nodes.length / cols);
  const gridTop = parentTop + parentH + height * 0.10;
  const gridBottom = height * 0.92;
  const gridH = gridBottom - gridTop;
  const cellW = (width - padX * 2) / cols;
  const cellH = gridH / rows;
  const boxW = cellW * 0.82;
  const boxH = Math.min(cellH * 0.62, height * 0.08);
  const labelSize = Math.round(typeBase * 0.020);

  // child positions
  const childPos = nodes.map((_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const cx = padX + cellW * (c + 0.5);
    const cy = gridTop + cellH * r + boxH / 2 + cellH * 0.10;
    return { cx, cy, left: cx - boxW / 2, top: cy - boxH / 2 };
  });

  const parentCX = parentLeft + parentW / 2;
  const parentBottomY = parentTop + parentH;

  // Strict rendering order
  return (
    <AbsoluteFill>
      <LightGridBg />
      <AbsoluteFill>
        {/* title */}
        {title && (
          <div style={{
            position: "absolute",
            top: titleTop, left: 0, right: 0,
            textAlign: "center",
            fontFamily: BLOCK, fontWeight: 800, fontSize: titleSize,
            color: RAISIN,
            textTransform: "uppercase", letterSpacing: "0.03em",
            opacity: interpolate(frame, [0, 10], [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}>
            {title}
          </div>
        )}

        {/* parent box — has a continuous subtle pulse so the whole diagram
            never goes fully static. ~1.2 Hz lime-glow breath. */}
        {(() => {
          const pulseT = Math.abs(Math.sin((frame / fps) * Math.PI * 1.2));
          return (
            <div style={{
              position: "absolute",
              left: parentLeft, top: parentTop,
              width: parentW, height: parentH,
              borderRadius: 14,
              background: RAISIN,
              color: "#FFFFFF",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: BLOCK, fontWeight: 800,
              fontSize: Math.round(typeBase * 0.030),
              textTransform: "uppercase", letterSpacing: "0.05em",
              boxShadow: `0 8px 24px rgba(0,0,0,0.25), 0 0 ${20 + 20 * pulseT}px rgba(207,255,5,${0.25 + 0.35 * pulseT})`,
              opacity: interpolate(frame, [4, 16], [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              transform: `scale(${1 + 0.015 * pulseT})`,
              transformOrigin: "center",
            }}>
              {parent_label || "AI TEAM"}
            </div>
          );
        })()}

        {/* connecting lines — drawn as SVG, animated by node appear_sec */}
        <svg style={{
          position: "absolute", left: 0, top: 0, width, height,
          pointerEvents: "none",
        }}>
          {childPos.map((p, i) => {
            const appearF = Math.max(0, Math.round((nodes[i].appear_sec - base) * fps));
            const lineProg = interpolate(frame, [appearF - 6, appearF + 4], [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const dimF = typeof nodes[i].dim_at === "number"
              ? Math.max(0, Math.round((nodes[i].dim_at as number - base) * fps)) : null;
            const dimOp = dimF !== null && frame >= dimF
              ? interpolate(frame, [dimF, dimF + 10], [1, 0.18],
                  { extrapolateRight: "clamp" }) : 1;
            // simple bezier from parent bottom to box top
            const midY = parentBottomY + (p.top - parentBottomY) * 0.55;
            const pathD = `M ${parentCX} ${parentBottomY}
                           C ${parentCX} ${midY}, ${p.cx} ${midY}, ${p.cx} ${p.top}`;
            return (
              <path key={i} d={pathD} fill="none"
                    stroke={nodes[i].kept ? LIME : SLATE}
                    strokeWidth={nodes[i].kept ? 3 : 2}
                    strokeOpacity={lineProg * dimOp}
                    strokeLinecap="round" />
            );
          })}
        </svg>

        {/* child boxes */}
        {nodes.map((n, i) => {
          const p = childPos[i];
          const appearF = Math.max(0, Math.round((n.appear_sec - base) * fps));
          const pop = spring({
            frame: frame - appearF, fps,
            durationInFrames: Math.round(0.30 * fps),
            config: { damping: 14, stiffness: 240, mass: 0.5 },
          });
          const visible = frame >= appearF;
          if (!visible) return null;
          const enterScale = interpolate(pop, [0, 1], [0.65, 1.0],
            { extrapolateRight: "clamp" });
          const enterOp = interpolate(pop, [0, 0.6], [0, 1],
            { extrapolateRight: "clamp" });

          const dimF = typeof n.dim_at === "number"
            ? Math.max(0, Math.round((n.dim_at - base) * fps)) : null;
          const dimOp = dimF !== null && frame >= dimF
            ? interpolate(frame, [dimF, dimF + 10], [1, 0.28],
                { extrapolateRight: "clamp" }) : 1;
          const showX = dimF !== null && frame >= dimF;
          // Brief shake on the moment of dim — boxes JOLT as they get
          // killed. ~6 frames of damped wobble.
          const shakeT = dimF !== null && frame >= dimF && frame < dimF + 8
            ? Math.sin((frame - dimF) * 2.4) * (1 - (frame - dimF) / 8) * 4
            : 0;
          // Subtle ambient breathing on KEPT (lime) boxes after the cull —
          // 1.0 ↔ 1.03 scale at ~1.4 Hz so the survivors feel alive.
          const breathT = n.kept && dimF !== null && frame >= dimF
            ? 1 + 0.025 * Math.sin((frame - dimF) / fps * Math.PI * 1.4)
            : 1;

          const bg = n.kept ? LIME : SILVER_BG;
          const fg = n.kept ? RAISIN : RAISIN;

          return (
            <div key={i} style={{
              position: "absolute",
              left: p.left, top: p.top,
              width: boxW, height: boxH,
              borderRadius: 10,
              background: bg,
              color: fg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: BLOCK, fontWeight: 700,
              fontSize: labelSize,
              textAlign: "center", padding: "0 6px",
              boxShadow: n.kept
                ? `0 6px 16px rgba(207,255,5,${0.45 + 0.15 * Math.abs(Math.sin((frame / fps) * Math.PI * 1.4))})`
                : "0 4px 12px rgba(0,0,0,0.18)",
              opacity: enterOp * dimOp,
              transform: `translate(${shakeT}px, 0) scale(${enterScale * breathT})`,
              transformOrigin: "center",
            }}>
              {n.label || `Agent ${i + 1}`}
              {showX && (
                <svg width={boxW} height={boxH}
                  style={{ position: "absolute", left: 0, top: 0 }}
                  viewBox={`0 0 ${boxW} ${boxH}`}>
                  <line x1={boxW * 0.12} y1={boxH * 0.18}
                        x2={boxW * 0.88} y2={boxH * 0.82}
                        stroke={RED} strokeWidth={Math.max(3, boxH * 0.10)}
                        strokeLinecap="round"
                        opacity={interpolate(frame, [dimF!, dimF! + 8], [0, 1],
                          { extrapolateRight: "clamp" })} />
                  <line x1={boxW * 0.88} y1={boxH * 0.18}
                        x2={boxW * 0.12} y2={boxH * 0.82}
                        stroke={RED} strokeWidth={Math.max(3, boxH * 0.10)}
                        strokeLinecap="round"
                        opacity={interpolate(frame, [dimF!, dimF! + 8], [0, 1],
                          { extrapolateRight: "clamp" })} />
                </svg>
              )}
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

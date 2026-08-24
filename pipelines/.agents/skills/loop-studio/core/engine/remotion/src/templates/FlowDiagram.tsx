import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { DarkGridBg } from "./Backgrounds";
import {
  useTypeBase,
  useWordReveal,
  useLivingHold,
  useChoreographedExit,
} from "./motion";

export type FlowDiagramNode = {
  /** Bold heading inside the box. */
  label: string;
  /** Optional description below the heading. */
  description?: string;
  /** Optional emoji / glyph above the heading for visual recognition. */
  glyph?: string;
  /** When this node + its inbound arrow appear (sec, relative to beat start). */
  appear_sec?: number;
  /** Highlight this node with lime accent (the "winning" or "current" node). */
  highlight?: boolean;
};

export type FlowDiagramProps = {
  /** Optional title pinned at top. */
  title?: string;
  /** 2–5 nodes connected left-to-right with arrows. */
  nodes: FlowDiagramNode[];
};

const MAX_NODES = 5;
const FONT = "Space Grotesk, system-ui, sans-serif";
const LIME = "#CFFF05";
const RAISIN = "#0F121A";
const STEEL = "#333D5A";
const STEEL_HI = "#46527A";

/**
 * Horizontal flow / pipeline diagram. Boxes in a row connected by arrows.
 * Use for showing a workflow ("trigger → fetch → process → output"), a
 * decision pipeline, or any A→B→C sequence where each node is roughly the
 * same size.
 *
 * 2026-05-29 — upgraded to the cinematic Layer-0 vocabulary so it matches
 * KineticStatement / ConceptBuild: on-brand DARK canvas (was a light slide
 * that read as PowerPoint), dark steel cards with white text + lime glow on
 * the highlighted node, motion-blur settle entrances, a slow living hold so
 * the frame is never frozen, and a choreographed dissolve-forward exit.
 *
 * Animation:
 *   - Each node builds in (rise + resolving motion-blur) at its appear_sec
 *   - The arrow leading into a node draws (left→right) just before the node lands
 *   - Highlighted node gets the single lime accent + glow
 */
export const FlowDiagram: React.FC<FlowDiagramProps> = ({ title, nodes }) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const N = Math.min(MAX_NODES, nodes.length);

  const EXIT_DUR = 0.5;
  const exitStartSec = Math.max(0, durationInFrames / fps - EXIT_DUR);
  const exit = useChoreographedExit(exitStartSec, EXIT_DUR);
  const hold = useLivingHold(5, 1.012, -4);

  // Layout
  const titleBarHeight = title ? Math.round(height * 0.13) : 0;
  const padX = Math.round(width * 0.06);
  const padY = Math.round(height * 0.2);
  const padBottom = Math.round(height * 0.2);
  const totalW = width - padX * 2;
  const totalH = height - padY - padBottom;
  const arrowFrac = 0.1;
  const nodeFrac = (1 - arrowFrac * (N - 1)) / N;
  const nodeW = Math.floor(totalW * nodeFrac);
  const arrowW = Math.floor(totalW * arrowFrac);
  const nodeH = Math.min(totalH, Math.floor(nodeW * 1.1)); // square-ish

  const titleSize = Math.round(typeBase * 0.046);
  const headingSize = Math.round(typeBase * 0.036);
  const descSize = Math.round(typeBase * 0.024);
  const glyphSize = Math.round(typeBase * 0.052);
  const cardPad = Math.round(typeBase * 0.022);
  const cardRadius = Math.round(typeBase * 0.018);

  // Auto-stagger if no per-node appear_sec was authored.
  const totalSec = durationInFrames / fps;
  const span = totalSec * 0.6;
  const norm = nodes.slice(0, MAX_NODES).map((n, i) => ({
    ...n,
    appear_sec:
      typeof n.appear_sec === "number"
        ? n.appear_sec
        : (span / Math.max(1, N - 1 || 1)) * i,
  }));

  const titleEnter = interpolate(frame, [0, Math.round(fps * 0.5)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <DarkGridBg />
      {/* Focusing vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 78% 66% at 50% 52%, rgba(15,18,26,0) 0%, rgba(8,10,15,0.5) 100%)",
        }}
      />
      {/* Deepen the ground so the cards read as clearly elevated — the grid was
          too close in tone to the cards (greater figure-ground contrast, 2026-06-21). */}
      <AbsoluteFill style={{ background: "rgba(5,6,10,0.5)" }} />

      {title && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: titleBarHeight,
            display: "flex",
            alignItems: "center",
            paddingLeft: Math.round(width * 0.06),
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: titleSize,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "#FFFFFF",
            opacity: titleEnter * exit.opacity,
            gap: typeBase * 0.018,
          }}
        >
          <span
            style={{
              width: typeBase * 0.05,
              height: 3,
              background: LIME,
              display: "inline-block",
              borderRadius: 2,
            }}
          />
          {title}
        </div>
      )}

      <AbsoluteFill
        style={{
          opacity: exit.opacity,
          filter: exit.blur > 0.05 ? `blur(${exit.blur}px)` : undefined,
          transform: `translateY(${hold.ty + exit.ty}px) scale(${hold.scale * exit.scale})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: padX,
            top: padY + (totalH - nodeH) / 2,
            width: totalW,
            height: nodeH,
            display: "flex",
            alignItems: "center",
          }}
        >
          {norm.map((node, i) => {
            const localAppear = node.appear_sec!;
            const k = useWordReveal(localAppear, 0.5);
            const rise = (1 - k) * typeBase * 0.03;
            const blur = (1 - k) * 11;
            const enterScale = 0.92 + 0.08 * k;

            // Arrow leading INTO this node draws from prev → this appear.
            const prevAppear = i > 0 ? norm[i - 1].appear_sec! : 0;
            const arrowProg = interpolate(
              frame / fps,
              [prevAppear + 0.2, prevAppear + 0.55],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            // a glowing pulse flows along the arrow INTO the node — live
            // pipeline feel (energy moving work → AI → approve).
            const pulseP = interpolate(
              frame / fps,
              [prevAppear + 0.3, prevAppear + 0.95],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            const pulseFade = Math.sin(Math.min(Math.max(pulseP, 0), 1) * Math.PI);

            const isHi = node.highlight;
            // highlighted node blooms as it lands (peaks ~0.6s after appear),
            // then settles — a soft "this is the payoff" pulse.
            const landBloom = isHi
              ? Math.sin(
                  Math.min(Math.max((frame / fps - localAppear) / 0.6, 0), 1) * Math.PI,
                )
              : 0;
            const bg = isHi
              ? LIME
              : `linear-gradient(180deg, ${STEEL_HI} 0%, ${STEEL} 100%)`;
            const fg = isHi ? RAISIN : "#FFFFFF";
            const border = isHi
              ? `2px solid ${LIME}`
              : "1.5px solid rgba(255,255,255,0.20)";
            // Stronger elevation shadow + the bloom on the hi node = clear
            // figure-ground separation from the deepened ground.
            const shadow = isHi
              ? `0 0 ${typeBase * (0.05 + 0.045 * landBloom)}px rgba(207,255,5,${0.4 + 0.32 * landBloom}), 0 ${typeBase * 0.02}px ${typeBase * 0.05}px rgba(0,0,0,0.6)`
              : `0 ${typeBase * 0.02}px ${typeBase * 0.05}px rgba(0,0,0,0.62)`;
            // arrow turns lime if it leads into the highlighted node
            const arrowColor = isHi ? LIME : "#7E8AA8";

            return (
              <div key={i} style={{ display: "contents" }}>
                {i > 0 && (
                  <div
                    style={{
                      position: "relative",
                      width: arrowW,
                      height: Math.round(typeBase * 0.014),
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: 0,
                        height: 4,
                        width: `${arrowProg * 100}%`,
                        backgroundColor: arrowColor,
                        transform: "translateY(-50%)",
                        borderRadius: 2,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: `${arrowProg * 100}%`,
                        transform: "translate(-100%, -50%)",
                        width: 0,
                        height: 0,
                        borderTop: `${Math.round(typeBase * 0.01)}px solid transparent`,
                        borderBottom: `${Math.round(typeBase * 0.01)}px solid transparent`,
                        borderLeft: `${Math.round(typeBase * 0.014)}px solid ${arrowColor}`,
                        opacity: arrowProg > 0.5 ? 1 : 0,
                      }}
                    />
                    {/* travelling energy pulse */}
                    <div
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: `${pulseP * 100}%`,
                        width: Math.round(typeBase * 0.02),
                        height: Math.round(typeBase * 0.02),
                        transform: "translate(-50%, -50%)",
                        borderRadius: 99,
                        background: arrowColor,
                        boxShadow: `0 0 ${Math.round(typeBase * 0.035)}px ${arrowColor}`,
                        opacity: pulseFade,
                      }}
                    />
                  </div>
                )}
                <div
                  style={{
                    width: nodeW,
                    height: nodeH,
                    flexShrink: 0,
                    background: bg,
                    border,
                    borderRadius: cardRadius,
                    padding: cardPad,
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    gap: Math.round(typeBase * 0.01),
                    opacity: k,
                    transform: `translateY(${rise}px) scale(${enterScale})`,
                    filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
                    boxShadow: shadow,
                    overflow: "hidden",
                    willChange: "transform, opacity, filter",
                  }}
                >
                  {node.glyph && (
                    <div style={{ fontSize: glyphSize, lineHeight: 1 }}>
                      {node.glyph}
                    </div>
                  )}
                  <div
                    style={{
                      fontFamily: FONT,
                      fontWeight: 700,
                      fontSize: headingSize,
                      color: fg,
                      lineHeight: 1.1,
                      letterSpacing: "-0.01em",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      overflowWrap: "break-word",
                      wordBreak: "normal",
                      hyphens: "manual",
                    }}
                  >
                    {node.label}
                  </div>
                  {node.description && (
                    <div
                      style={{
                        fontFamily: FONT,
                        fontWeight: 500,
                        fontSize: descSize,
                        color: isHi ? "rgba(15,18,26,0.72)" : "#9AA5C2",
                        lineHeight: 1.3,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        overflowWrap: "break-word",
                        wordBreak: "normal",
                        hyphens: "manual",
                      }}
                    >
                      {node.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

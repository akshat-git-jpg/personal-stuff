import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import {
  useTypeBase,
  useLivingHold,
  useChoreographedExit,
  ENTRANCE_EASE,
} from "./motion";

export type SpreadNode = {
  /** Optional short label rendered just outside the dot. */
  label?: string;
  /** Optional emoji / glyph inside the dot. */
  glyph?: string;
};

export type NetworkSpreadProps = {
  /** Optional title pinned top-left with a lime tick. */
  title?: string;
  /** The hub — "your business". Rendered as the glowing lime center node. */
  centerLabel: string;
  /** Optional emoji / glyph inside the center node. */
  centerGlyph?: string;
  /** 3–8 surrounding dots the hub connects to. */
  nodes: SpreadNode[];
  /**
   * Direction value travels along the edges once the web is built:
   *  - "in"  (default) — $ tokens flow FROM the outer dots INTO the center
   *    (you earn by selling to them).
   *  - "out" — tokens flow center → outward (you distribute to them).
   *  - "none" — static web, no tokens.
   */
  flow?: "in" | "out" | "none";
  /** Glyph carried by the flowing tokens. Default "$". */
  flowGlyph?: string;
  /** Beat start (absolute sec) — accepted for API parity; choreography is
   *  driven off the local Sequence frame so it is not strictly required. */
  startSec?: number;
};

const MAX_NODES = 8;
const FONT = "Space Grotesk, system-ui, sans-serif";
// Brand palette ONLY (owner note 2026-05-29: "use the darker color instead of
// the blue — it's a little too blue right now"). Raisin black + its two darker
// tints; the bluer #343E5B tint is intentionally avoided here so the dots/edges
// read as near-black, not slate-blue.
const LIME = "#CFFF05";
const LIME_DEEP = "#AEDC00";
const RAISIN = "#0F121A"; // primary
const RAISIN_2 = "#1E2434"; // brand dark tint — barely-blue, the lighter end
const INK = "#1E2434"; // dark text / hub border — crisp near-black on light

/**
 * NetworkSpread — a hub-and-spoke "network effect" metaphor canvas.
 *
 * A single glowing lime center ("your business") that, over the beat, radiates
 * edges outward to a ring of dark dots ("other businesses"). Once the web is
 * built, animated $ tokens stream along the edges — inward by default, to show
 * value/revenue flowing back to the hub as you sell to everyone around you.
 *
 * This is the "metaphor canvas" register from concept_visualization.md: not a
 * literal diagram, but a moving picture of an idea — distribution, network
 * effects, one-to-many, "build it once, sell it to everyone."
 *
 * Rendered on a LIGHT surface (2026-05-29 owner note: "it should always have
 * great contrast — the lighter backgrounds work better for this visual"). The
 * dark dots + dark edges + lime hub all pop hard against the soft off-white,
 * so every element reads instantly. Self-contained light background (does NOT
 * use Backgrounds.tsx, whose "LightGridBg" is actually a dark mid-raisin).
 *
 * Choreography (local sec, 0 = beat start):
 *   0.00–0.45  center node springs in with a lime glow pulse
 *   0.45→      edges draw outward, staggered per spoke
 *   (edge done) outer dot pops in with a motion-blur settle
 *   (web done)  $ tokens stream along every edge, looping, until the exit
 *   last 0.5s   whole canvas dissolves forward
 */
export const NetworkSpread: React.FC<NetworkSpreadProps> = ({
  title,
  centerLabel,
  centerGlyph,
  nodes,
  flow = "in",
  flowGlyph = "$",
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const t = frame / fps; // local seconds

  const N = Math.min(MAX_NODES, Math.max(1, nodes.length));
  const ring = nodes.slice(0, N);

  // Group-level life + exit.
  const EXIT_DUR = 0.5;
  const exitStartSec = Math.max(0, durationInFrames / fps - EXIT_DUR);
  const exit = useChoreographedExit(exitStartSec, EXIT_DUR);
  const hold = useLivingHold(6, 1.01, -4);

  // Geometry.
  const cx = width / 2;
  const cy = title ? height * 0.56 : height * 0.5;
  // Elliptical spread so the web FILLS the wide 16:9 frame instead of sitting
  // in a small circle with big empty margins (owner note 2026-05-29: "it can
  // be a bit larger … we have more full-screen options").
  const radiusX = width * 0.32;
  const radiusY = height * 0.36;
  const centerR = Math.round(typeBase * 0.10);
  const dotR = Math.round(typeBase * 0.058);

  const centerSize = Math.round(typeBase * 0.05);
  const labelSize = Math.round(typeBase * 0.026);
  const centerLabelSize = Math.round(typeBase * 0.032);
  const titleSize = Math.round(typeBase * 0.044);
  const tokenSize = Math.round(typeBase * 0.03);

  // Per-spoke geometry + timeline.
  const EDGE_LEAD = 0.5; // center settles first
  const EDGE_STAGGER = 0.12;
  const EDGE_DRAW = 0.5;

  // Start the ring at the top. For EVEN counts, offset by a half-step so a gap
  // (not a dot) sits at top AND bottom — keeps the straight-down position clear
  // for the center label. For odd counts the top has a dot and the bottom is
  // naturally a gap, so no offset is needed.
  const startDeg = -90 + (N % 2 === 0 ? 180 / N : 0);
  const spokes = ring.map((node, i) => {
    const ang = (startDeg + (360 / N) * i) * (Math.PI / 180);
    const ox = cx + radiusX * Math.cos(ang);
    const oy = cy + radiusY * Math.sin(ang);
    const edgeStart = EDGE_LEAD + i * EDGE_STAGGER;
    const dotAppear = edgeStart + EDGE_DRAW * 0.7;
    return { node, ang, ox, oy, edgeStart, dotAppear };
  });

  const webDoneSec = EDGE_LEAD + (N - 1) * EDGE_STAGGER + EDGE_DRAW;
  const flowStartFrame = Math.round((webDoneSec + 0.15) * fps);

  // Center node spring-in.
  const centerS = spring({
    frame,
    fps,
    durationInFrames: Math.round(0.45 * fps),
    config: { damping: 12, stiffness: 180, mass: 0.8 },
  });
  const centerScale = interpolate(centerS, [0, 1], [0.2, 1]);
  const centerOpacity = interpolate(frame, [0, Math.round(0.2 * fps)], [0, 1], {
    extrapolateRight: "clamp",
  });
  // Soft pulse synced to value arriving at the hub.
  const pulse =
    flow !== "none" && frame > flowStartFrame
      ? 1 + 0.03 * Math.max(0, Math.sin((t - webDoneSec) * Math.PI * 1.6))
      : 1;

  // Token cadence.
  const CYCLE = 1.4; // sec for one token to traverse an edge
  const cycleFrames = CYCLE * fps;
  const TOKENS_PER_EDGE = 2;

  const cellPx = Math.round(typeBase * 0.07);

  return (
    <AbsoluteFill>
      {/* Light surface — soft cool off-white, designed (not PowerPoint): a
          faint steel grid, a bright centered lift behind the hub, and a gentle
          edge vignette so the frame has depth instead of flat white. */}
      <AbsoluteFill
        style={{
          background: "linear-gradient(180deg, #F4F6FA 0%, #E4E8F1 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(rgba(42,51,74,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(42,51,74,0.055) 1px, transparent 1px)`,
          backgroundSize: `${cellPx}px ${cellPx}px`,
          maskImage:
            "radial-gradient(ellipse 75% 75% at 50% 50%, #000 35%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 75% 75% at 50% 50%, #000 35%, transparent 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 55% 50% at 50% 50%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 60%)",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 85% 80% at 50% 50%, rgba(20,27,38,0) 55%, rgba(20,27,38,0.10) 100%)",
        }}
      />

      {title && (
        <div
          style={{
            position: "absolute",
            top: Math.round(height * 0.08),
            left: Math.round(width * 0.06),
            display: "flex",
            alignItems: "center",
            gap: typeBase * 0.018,
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: titleSize,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: INK,
            opacity: interpolate(frame, [0, Math.round(fps * 0.5)], [0, 1], {
              extrapolateRight: "clamp",
            }) * exit.opacity,
          }}
        >
          <span
            style={{
              width: typeBase * 0.05,
              height: 3,
              background: LIME_DEEP,
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
        {/* Edges + flowing tokens (SVG layer). */}
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: "absolute", inset: 0 }}
        >
          <defs>
            <linearGradient id="edgeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={RAISIN_2} />
              <stop offset="100%" stopColor={RAISIN} />
            </linearGradient>
            <filter id="tokenGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation={typeBase * 0.008} result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {spokes.map((s, i) => {
            const draw = interpolate(
              t,
              [s.edgeStart, s.edgeStart + EDGE_DRAW],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ENTRANCE_EASE },
            );
            // Line from center to the drawn fraction toward the outer dot.
            const ex = cx + (s.ox - cx) * draw;
            const ey = cy + (s.oy - cy) * draw;
            return (
              <line
                key={`edge-${i}`}
                x1={cx}
                y1={cy}
                x2={ex}
                y2={ey}
                // Solid stroke (NOT the objectBoundingBox gradient): a perfectly
                // horizontal/vertical line has a zero-area bbox, which makes an
                // objectBoundingBox gradient degenerate and renders the line
                // INVISIBLE — that's why the two horizontal spokes had no line.
                stroke={RAISIN_2}
                strokeWidth={Math.max(2, typeBase * 0.005)}
                strokeLinecap="round"
                opacity={0.55}
              />
            );
          })}

          {/* Flowing value tokens — lime coins with a dark ring + dark $ so
              they pop against the light surface. */}
          {flow !== "none" &&
            frame > flowStartFrame &&
            spokes.flatMap((s, i) =>
              Array.from({ length: TOKENS_PER_EDGE }).map((_, j) => {
                const phaseOffset = i / N + j / TOKENS_PER_EDGE;
                const raw =
                  ((frame - flowStartFrame) / cycleFrames + phaseOffset) % 1;
                // p = 0 at source, 1 at destination.
                const p = raw;
                const from = flow === "in" ? { x: s.ox, y: s.oy } : { x: cx, y: cy };
                const to = flow === "in" ? { x: cx, y: cy } : { x: s.ox, y: s.oy };
                const px = from.x + (to.x - from.x) * p;
                const py = from.y + (to.y - from.y) * p;
                // Fade in/out at the ends of the trip.
                const fade = Math.max(
                  0,
                  Math.min(1, p / 0.18, (1 - p) / 0.18),
                );
                return (
                  <g key={`tok-${i}-${j}`} opacity={fade} filter="url(#tokenGlow)">
                    <circle
                      cx={px}
                      cy={py}
                      r={tokenSize * 0.62}
                      fill={LIME}
                      stroke={INK}
                      strokeWidth={Math.max(1.5, typeBase * 0.003)}
                    />
                    <text
                      x={px}
                      y={py}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontFamily={FONT}
                      fontWeight={700}
                      fontSize={tokenSize * 0.82}
                      fill={INK}
                    >
                      {flowGlyph}
                    </text>
                  </g>
                );
              }),
            )}
        </svg>

        {/* Outer dots — dark, so they read hard against the light surface. */}
        {spokes.map((s, i) => {
          const k = interpolate(t, [s.dotAppear, s.dotAppear + 0.4], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ENTRANCE_EASE,
          });
          const blur = (1 - k) * 8;
          const sc = 0.6 + 0.4 * k;
          // Label sits radially OUTWARD from the dot.
          const lx = cx + (radiusX + dotR * 1.4) * Math.cos(s.ang);
          const ly = cy + (radiusY + dotR * 1.4) * Math.sin(s.ang);
          const onLeft = Math.cos(s.ang) < -0.3;
          const onRight = Math.cos(s.ang) > 0.3;
          return (
            <div key={`dot-${i}`}>
              <div
                style={{
                  position: "absolute",
                  left: s.ox - dotR,
                  top: s.oy - dotR,
                  width: dotR * 2,
                  height: dotR * 2,
                  borderRadius: "50%",
                  background: `linear-gradient(180deg, ${RAISIN_2} 0%, ${RAISIN} 100%)`,
                  border: "1.5px solid rgba(255,255,255,0.65)",
                  boxShadow: `0 ${typeBase * 0.01}px ${typeBase * 0.026}px rgba(20,27,38,0.28)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: Math.round(typeBase * 0.034),
                  opacity: k,
                  transform: `scale(${sc})`,
                  filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
                  willChange: "transform, opacity, filter",
                }}
              >
                {s.node.glyph}
              </div>
              {s.node.label && (
                <div
                  style={{
                    position: "absolute",
                    left: lx,
                    top: ly,
                    transform: `translate(${onLeft ? "-100%" : onRight ? "0%" : "-50%"}, -50%)`,
                    maxWidth: width * 0.22,
                    fontFamily: FONT,
                    fontWeight: 600,
                    fontSize: labelSize,
                    lineHeight: 1.15,
                    color: INK,
                    textAlign: onLeft ? "right" : onRight ? "left" : "center",
                    opacity: k,
                  }}
                >
                  {s.node.label}
                </div>
              )}
            </div>
          );
        })}

        {/* Center hub — lime, with a dark ring + drop shadow so it has a crisp
            edge on the light surface, plus a soft lime halo. */}
        <div
          style={{
            position: "absolute",
            left: cx - centerR,
            top: cy - centerR,
            width: centerR * 2,
            height: centerR * 2,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 30%, #E8FF6B 0%, ${LIME} 55%, ${LIME_DEEP} 100%)`,
            border: `${Math.max(2, typeBase * 0.004)}px solid ${INK}`,
            boxShadow: `0 0 ${typeBase * 0.05}px rgba(207,255,5,0.65), 0 ${typeBase * 0.012}px ${typeBase * 0.03}px rgba(20,27,38,0.30)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: centerSize,
            color: RAISIN,
            opacity: centerOpacity,
            transform: `scale(${centerScale * pulse})`,
            willChange: "transform, opacity",
            zIndex: 2,
          }}
        >
          {centerGlyph}
        </div>
        <div
          style={{
            position: "absolute",
            left: cx - radiusX,
            top: cy + centerR + typeBase * 0.04,
            width: radiusX * 2,
            display: "flex",
            justifyContent: "center",
            opacity: centerOpacity,
            zIndex: 4,
          }}
        >
          <span
            style={{
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: centerLabelSize,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              // DARK raisin pill + white text + lime hairline. On the light
              // surface a light pill blended in (owner note 2026-05-29: "the
              // label has very bad contrast"); a dark pill pops hard and reads
              // as the same lime-accent system as the hub. Converging $ coins
              // pass BEHIND it (zIndex 4).
              color: "#FFFFFF",
              background: RAISIN,
              border: `2px solid ${LIME}`,
              padding: `${typeBase * 0.01}px ${typeBase * 0.026}px`,
              borderRadius: typeBase * 0.014,
              boxShadow: `0 ${typeBase * 0.009}px ${typeBase * 0.024}px rgba(15,18,26,0.38)`,
            }}
          >
            {centerLabel}
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

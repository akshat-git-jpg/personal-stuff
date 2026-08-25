import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { DarkGridBg } from "./Backgrounds";
import {
  useChoreographedExit,
  useLivingHold,
  useTypeBase,
  useWordReveal,
} from "./motion";

/**
 * concept_build — the flagship "more than a diagram" explainer.
 *
 * Where flow_diagram / network_diagram impose a fixed layout, ConceptBuild is a
 * free-form, VO-synced canvas: you place labeled ELEMENTS at arbitrary positions
 * and draw CONNECTORS between them, and every piece reveals on the exact word
 * that introduces it. The viewer's mental model assembles WITH the narration.
 *
 * Use it for STRUCTURE / COMPOSITION ("these three things live inside the agent"),
 * METAPHOR ("the context window is a desk that fills up"), or any concept build
 * that doesn't fit a rigid sequence (flow) or topology (network) template.
 *
 * Quality bar (knowledge/concept_visualization.md §6):
 *  - on-brand dark canvas (DarkGridBg + focusing vignette)
 *  - elements BUILD in with the motion-blur settle (never hard-cut)
 *  - connectors DRAW (stroke wipe), optional marching-ants flow
 *  - one lime accent per frame (the emphasized element/connector)
 *  - slow living hold so it's never frozen; choreographed dissolve-forward exit
 */

const FONT = "Space Grotesk, system-ui, sans-serif";
const LIME = "#CFFF05";
const RAISIN = "#0F121A";
const INK = "#161B26"; // dark text on the light cards
// Light frosted card surface — high contrast against the dark canvas, so the
// nodes read as elevated physical panels instead of low-contrast blue-on-blue
// boxes (owner note 2026-05-29: "not great contrast … lighter is better").
const CARD_TOP = "#FFFFFF";
const CARD_BOT = "#E6EBF4";

export type ConceptElementVariant = "box" | "chip" | "tile" | "frame" | "note";

export type ConceptElement = {
  /** Stable id, referenced by connectors. */
  id: string;
  /** Bold heading text. */
  label: string;
  /** Optional second line under the label. */
  sublabel?: string;
  /** Optional emoji/glyph (shown large for `tile`, inline otherwise). */
  glyph?: string;
  /** Center position as 0–1 fractions of the canvas. */
  x: number;
  y: number;
  /** Width as a 0–1 fraction of canvas width. Defaults per-variant. */
  w?: number;
  /** Height as a 0–1 fraction of canvas height. Only used by `frame`. */
  h?: number;
  /** Visual register. `frame` renders as a containing outline BEHIND others. */
  variant?: ConceptElementVariant;
  /** Render in lime (the single accent). */
  emphasis?: boolean;
  /** Absolute source-video time (sec) when this element should land. */
  appear_sec?: number;
};

export type ConceptConnector = {
  /** Element id this connector starts at. */
  from: string;
  /** Element id this connector ends at. */
  to: string;
  /** Optional label rendered in a pill at the midpoint. */
  label?: string;
  /** Marching-ants packet travelling along the edge (data movement). */
  flowing?: boolean;
  /** Lime accent for this connector. */
  emphasis?: boolean;
  /** Absolute source-video time (sec) when this connector draws. */
  appear_sec?: number;
};

export type ConceptBuildProps = {
  /** Optional title pinned top-left. */
  title?: string;
  elements: ConceptElement[];
  connectors?: ConceptConnector[];
  /** Beat start in source-video seconds — localizes each `appear_sec`. */
  startSec: number;
};

export const ConceptBuild: React.FC<ConceptBuildProps> = ({
  title,
  elements,
  connectors = [],
  startSec,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const typeBase = useTypeBase();

  const EXIT_DUR = 0.5;
  const exitStartSec = Math.max(0, durationInFrames / fps - EXIT_DUR);
  const exit = useChoreographedExit(exitStartSec, EXIT_DUR);
  const hold = useLivingHold(5, 1.014, -5);

  // Canvas inset — leave room for title bar + breathing margins.
  const padX = width * 0.08;
  const padTop = height * (title ? 0.2 : 0.12);
  const padBottom = height * 0.12;
  const canvasW = width - padX * 2;
  const canvasH = height - padTop - padBottom;

  const titleSize = Math.round(typeBase * 0.044);

  // element id -> pixel center (within the canvas) for connector routing.
  const centerOf = (id: string): { cx: number; cy: number } | null => {
    const el = elements.find((e) => e.id === id);
    if (!el) return null;
    return { cx: el.x * canvasW, cy: el.y * canvasH };
  };

  return (
    <AbsoluteFill>
      <DarkGridBg />
      {/* Focusing vignette — the build reads as the subject, not a flat slide. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 75% 65% at 50% 52%, rgba(15,18,26,0) 0%, rgba(8,10,15,0.5) 100%)",
        }}
      />

      {title && (
        <div
          style={{
            position: "absolute",
            top: height * 0.07,
            left: padX,
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: titleSize,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "#FFFFFF",
            opacity: exit.opacity,
            display: "flex",
            alignItems: "center",
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
            top: padTop,
            width: canvasW,
            height: canvasH,
          }}
        >
          {/* Connector layer (under elements) */}
          <svg
            width={canvasW}
            height={canvasH}
            style={{ position: "absolute", inset: 0, overflow: "visible" }}
          >
            {connectors.map((c, i) => (
              <Connector
                key={i}
                c={c}
                a={centerOf(c.from)}
                b={centerOf(c.to)}
                startSec={startSec}
                typeBase={typeBase}
              />
            ))}
          </svg>

          {/* Frames first (behind), then everything else. */}
          {[...elements]
            .sort((e1, e2) => rank(e1.variant) - rank(e2.variant))
            .map((el) => (
              <Element
                key={el.id}
                el={el}
                canvasW={canvasW}
                canvasH={canvasH}
                startSec={startSec}
                typeBase={typeBase}
              />
            ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// frames render behind (rank 0), the rest in front (rank 1).
const rank = (v?: ConceptElementVariant): number => (v === "frame" ? 0 : 1);

const Connector: React.FC<{
  c: ConceptConnector;
  a: { cx: number; cy: number } | null;
  b: { cx: number; cy: number } | null;
  startSec: number;
  typeBase: number;
}> = ({ c, a, b, startSec, typeBase }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  if (!a || !b) return null;
  const localAppear = Math.max(0, (c.appear_sec ?? startSec) - startSec);
  const k = useWordReveal(localAppear, 0.45);
  if (k <= 0.001) return null;

  const stroke = c.emphasis ? LIME : "#7E8AA8";
  const sw = Math.max(2, Math.round(typeBase * 0.006));
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // shorten both ends so the line doesn't tuck under the cards
  const pad = Math.min(len * 0.18, typeBase * 0.06);
  const ax = a.cx + (dx / len) * pad;
  const ay = a.cy + (dy / len) * pad;
  const bxFull = b.cx - (dx / len) * pad;
  const byFull = b.cy - (dy / len) * pad;
  // draw progress
  const bx = ax + (bxFull - ax) * k;
  const by = ay + (byFull - ay) * k;

  // marching-ants packet
  const tFlow = (frame % Math.round(fps * 1.1)) / Math.round(fps * 1.1);
  const px = ax + (bxFull - ax) * tFlow;
  const py = ay + (byFull - ay) * tFlow;

  const ang = Math.atan2(byFull - ay, bxFull - ax);
  const ah = typeBase * 0.016;

  // one-time "spawn pulse" — a bright glowing packet that fires hub→node the
  // instant the edge finishes drawing, so each connection reads as a burst of
  // energy (motion design), not a static drawn line (code).
  const pulseStart = localAppear + 0.42;
  const pulseDur = 0.5;
  const pulseRaw = (frame / fps - pulseStart) / pulseDur;
  const showPulse = pulseRaw >= 0 && pulseRaw <= 1;
  const pulseEase = interpolate(pulseRaw, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ppx = ax + (bxFull - ax) * pulseEase;
  const ppy = ay + (byFull - ay) * pulseEase;
  const pulseFade = Math.sin(Math.max(0, Math.min(1, pulseRaw)) * Math.PI);

  return (
    <g opacity={Math.min(1, k * 1.2)}>
      <line
        x1={ax}
        y1={ay}
        x2={bx}
        y2={by}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
      />
      {k > 0.85 && (
        <polygon
          points={`0,${-ah * 0.6} ${ah},0 0,${ah * 0.6}`}
          fill={stroke}
          transform={`translate(${bxFull},${byFull}) rotate(${(ang * 180) / Math.PI})`}
        />
      )}
      {showPulse && (
        <g opacity={pulseFade}>
          <circle cx={ppx} cy={ppy} r={sw * 4.6} fill={LIME} opacity={0.18} />
          <circle cx={ppx} cy={ppy} r={sw * 2.1} fill={LIME} />
        </g>
      )}
      {c.flowing && k > 0.9 && (
        <g>
          <circle cx={px} cy={py} r={sw * 3.2} fill={LIME} opacity={0.12} />
          <circle cx={px} cy={py} r={sw * 1.7} fill={LIME} opacity={0.85} />
        </g>
      )}
      {c.label && k > 0.6 && (
        <foreignObject
          x={(ax + bxFull) / 2 - typeBase * 0.09}
          y={(ay + byFull) / 2 - typeBase * 0.028}
          width={typeBase * 0.18}
          height={typeBase * 0.056}
          style={{ overflow: "visible" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              opacity: interpolate(k, [0.6, 0.85], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            <span
              style={{
                fontFamily: FONT,
                fontWeight: 600,
                fontSize: Math.round(typeBase * 0.022),
                color: RAISIN,
                background: LIME,
                padding: `${typeBase * 0.006}px ${typeBase * 0.014}px`,
                borderRadius: 999,
                whiteSpace: "nowrap",
              }}
            >
              {c.label}
            </span>
          </div>
        </foreignObject>
      )}
    </g>
  );
};

const Element: React.FC<{
  el: ConceptElement;
  canvasW: number;
  canvasH: number;
  startSec: number;
  typeBase: number;
}> = ({ el, canvasW, canvasH, startSec, typeBase }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const localAppear = Math.max(0, (el.appear_sec ?? startSec) - startSec);
  const appearFrame = Math.round(localAppear * fps);
  const k = useWordReveal(localAppear, 0.5);

  const variant = el.variant ?? "box";
  const emph = !!el.emphasis;

  const cx = el.x * canvasW;
  const cy = el.y * canvasH;

  // ── Designed entrance (not a flat coded fade) ───────────────────────────
  // A springy, slightly-overshooting POP that LAUNCHES the node outward from
  // the canvas centre toward its slot — so the hub visibly "emits" each piece
  // — then a continuous idle float so nothing is ever frozen.
  const s = spring({
    frame: frame - appearFrame,
    fps,
    durationInFrames: Math.round(0.62 * fps),
    config: { damping: 11, stiffness: 160, mass: 0.7 }, // mild overshoot
  });
  const enterScale = interpolate(s, [0, 1], [0.5, 1]); // overshoots ~1.02
  const blur = (1 - k) * 11;

  // launch-from-centre: at s=0 the node sits ~40% of the way toward the middle,
  // at s=1 it lands in its slot (overshoot carries it a touch past, then back).
  const launch = 0.4 * (1 - s);
  const flyX = (canvasW / 2 - cx) * launch;
  const flyY = (canvasH / 2 - cy) * launch;

  // idle float — independent per node so the cluster breathes organically.
  const phase = el.x * 6.3 + el.y * 11.7;
  const tSec = frame / fps;
  const floatY = Math.sin(tSec * 1.5 + phase) * typeBase * 0.006 * s;
  const floatX = Math.cos(tSec * 1.1 + phase) * typeBase * 0.003 * s;
  // the emphasised hub breathes — a slow lime-glow pulse so it reads as the
  // live "engine" powering the cluster.
  const hubPulse = emph ? (0.5 + 0.5 * Math.sin(tSec * 2.2)) * s : 0;

  const labelSize = Math.round(typeBase * 0.03);
  const subSize = Math.round(typeBase * 0.021);
  const glyphSize = Math.round(typeBase * 0.05);

  // per-variant sizing
  const defaultW =
    variant === "chip" ? 0.2 : variant === "tile" ? 0.16 : variant === "note" ? 0.22 : 0.26;
  const wFrac = el.w ?? defaultW;
  const boxW = wFrac * canvasW;

  if (variant === "frame") {
    const fw = (el.w ?? 0.5) * canvasW;
    const fh = (el.h ?? 0.5) * canvasH;
    return (
      <div
        style={{
          position: "absolute",
          left: cx - fw / 2,
          top: cy - fh / 2,
          width: fw,
          height: fh,
          border: `2px dashed ${emph ? LIME : "#4A5573"}`,
          borderRadius: typeBase * 0.024,
          opacity: k * 0.9,
          transform: `scale(${enterScale})`,
          transformOrigin: "center",
          boxSizing: "border-box",
        }}
      >
        {el.label && (
          <div
            style={{
              position: "absolute",
              top: -typeBase * 0.024,
              left: typeBase * 0.02,
              background: RAISIN,
              padding: `0 ${typeBase * 0.012}px`,
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: subSize,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: emph ? LIME : "#8A95B3",
            }}
          >
            {el.label}
          </div>
        )}
      </div>
    );
  }

  const isTile = variant === "tile";
  const isChip = variant === "chip";
  const isNote = variant === "note";

  const bg = isNote
    ? "transparent"
    : emph
      ? `radial-gradient(circle at 38% 30%, #E8FF6B 0%, ${LIME} 60%, #AEDC00 100%)`
      : `linear-gradient(180deg, ${CARD_TOP} 0%, ${CARD_BOT} 100%)`;
  const fg = emph ? RAISIN : INK;
  const border = isNote
    ? "none"
    : emph
      ? `2px solid ${LIME}`
      : "1px solid rgba(255,255,255,0.85)";
  // Light cards get a real drop shadow + an inset top highlight so they read as
  // physical, elevated panels (max contrast on the dark canvas). The hub keeps
  // its lime halo.
  const shadow = emph
    ? `0 0 ${typeBase * (0.05 + 0.035 * hubPulse)}px rgba(207,255,5,${0.45 + 0.25 * hubPulse}), 0 0 ${typeBase * (0.1 + 0.05 * hubPulse)}px rgba(207,255,5,${0.18 + 0.12 * hubPulse}), 0 ${typeBase * 0.014}px ${typeBase * 0.034}px rgba(0,0,0,0.55)`
    : `0 ${typeBase * 0.016}px ${typeBase * 0.04}px rgba(0,0,0,0.5), inset 0 ${typeBase * 0.004}px 0 rgba(255,255,255,0.8)`;

  return (
    <div
      style={{
        position: "absolute",
        left: cx - boxW / 2,
        top: cy,
        width: boxW,
        transform: `translate(${flyX + floatX}px, calc(-50% + ${flyY + floatY}px)) scale(${enterScale})`,
        transformOrigin: "center",
        opacity: k,
        filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
        willChange: "transform, opacity, filter",
      }}
    >
      <div
        style={{
          background: bg,
          border,
          borderRadius: isChip ? 999 : typeBase * 0.018,
          boxShadow: isNote ? "none" : shadow,
          padding: isChip
            ? `${typeBase * 0.012}px ${typeBase * 0.022}px`
            : isNote
              ? 0
              : typeBase * 0.02,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: isTile ? "column" : "row",
          alignItems: "center",
          justifyContent: isTile ? "center" : "flex-start",
          gap: typeBase * 0.012,
          textAlign: isTile || isNote ? "center" : "left",
        }}
      >
        {el.glyph && (
          <div style={{ fontSize: isTile ? glyphSize : labelSize, lineHeight: 1 }}>
            {el.glyph}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 700,
              fontSize: isNote ? subSize : labelSize,
              lineHeight: 1.12,
              letterSpacing: "-0.01em",
              color: isNote ? "#9AA5C2" : fg,
              fontStyle: isNote ? "italic" : "normal",
              overflowWrap: "break-word",
              wordBreak: "normal",
              hyphens: "manual",
            }}
          >
            {el.label}
          </div>
          {el.sublabel && (
            <div
              style={{
                fontFamily: FONT,
                fontWeight: 500,
                fontSize: subSize,
                lineHeight: 1.25,
                marginTop: typeBase * 0.004,
                color: emph ? "rgba(15,18,26,0.7)" : "rgba(22,27,38,0.62)",
                overflowWrap: "break-word",
                wordBreak: "normal",
                hyphens: "manual",
              }}
            >
              {el.sublabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

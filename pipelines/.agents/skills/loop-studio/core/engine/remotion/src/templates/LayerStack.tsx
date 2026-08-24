import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  useTypeBase,
  useChoreographedExit,
  useLivingHold,
  ENTRANCE_EASE,
} from "./motion";

export type StackLayer = {
  /** Main label, e.g. "Infrastructure". */
  label: string;
  /** Optional emoji / glyph in the left chip. */
  glyph?: string;
  /** Optional muted sub-line under the label. */
  sub?: string;
  /** Force lime-accent treatment. If omitted, the TOP layer is auto-accented. */
  accent?: boolean;
};

export type LayerStackProps = {
  /** Title pinned top-left with a lime tick. */
  title?: string;
  /**
   * Layers, ordered FOUNDATION-FIRST. layers[0] renders at the BOTTOM of the
   * stack and builds in first; the last entry sits on top and is the payoff.
   */
  layers: StackLayer[];
  /** Beat start (absolute sec) — accepted for API parity; choreography runs
   *  off the local Sequence frame. */
  startSec?: number;
};

const FONT = "Space Grotesk, system-ui, sans-serif";
const LIME = "#CFFF05";
const LIME_DEEP = "#AEDC00";
const RAISIN = "#0F121A";
const WHITE = "#FFFFFF";

/**
 * LayerStack — an "under the hood" architecture stack.
 *
 * When the speaker enumerates the layers of a system ("the infrastructure, the
 * AI behind it, the self-learning mechanism"), pills read as a flat tag-cloud.
 * This instead stacks the layers as physical slabs — foundation at the bottom,
 * building UP one slab at a time as each is named — so the viewer literally
 * sees the architecture assemble. The top slab (the payoff) lands lime.
 *
 * Choreography (local sec, 0 = beat start):
 *   0.00       title fades in
 *   0.30→      slabs slide up + fade in, bottom→top, one per named layer
 *   top slab   lands lime with a soft glow (the headline capability)
 *   last 0.5s  whole stack dissolves forward
 */
export const LayerStack: React.FC<LayerStackProps> = ({ title, layers }) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const t = frame / fps;

  const n = Math.max(1, layers.length);

  // Group life + exit.
  const EXIT_DUR = 0.5;
  const exit = useChoreographedExit(Math.max(0, durationInFrames / fps - EXIT_DUR), EXIT_DUR);
  const hold = useLivingHold(6, 1.01, -4);

  const titleIn = interpolate(frame, [0, Math.round(fps * 0.5)], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Build timeline: layers appear bottom→top across BUILD_SPAN.
  const BUILD_LEAD = 0.3;
  const BUILD_SPAN = (durationInFrames / fps) * 0.62;
  const perLayer = BUILD_SPAN / n;

  // Stack geometry — centered group below the title.
  const slabW = width * 0.62;
  const slabLeft = (width - slabW) / 2;
  const slabGap = height * 0.055;
  const stackTop = height * 0.25;
  const stackH = height * 0.6;
  const slabH = (stackH - slabGap * (n - 1)) / n;

  return (
    <AbsoluteFill>
      {/* Light SILVER brand stage (matches CommandDeck) — the dark BLUE slabs
          read with strong contrast against it instead of the old dark-on-dark
          "cheap card" look. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(130% 130% at 50% 26%, #EEF1F2 0%, #D2D8DA 55%, #B7C0C3 100%)",
        }}
      />
      {/* Faint steel grid so the stage has depth, not flat paper. */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(rgba(15,18,26,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(15,18,26,0.05) 1px, transparent 1px)",
          backgroundSize: `${Math.round(width * 0.035)}px ${Math.round(width * 0.035)}px`,
          maskImage:
            "radial-gradient(ellipse 80% 78% at 50% 50%, #000 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 78% at 50% 50%, #000 40%, transparent 100%)",
        }}
      />
      {/* Soft lime lift behind the stack so the accent slab glows on light. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(58% 50% at 50% 54%, rgba(207,255,5,0.12) 0%, rgba(207,255,5,0) 60%)",
        }}
      />

      {title && (
        <div
          style={{
            position: "absolute",
            top: Math.round(height * 0.09),
            left: Math.round(width * 0.07),
            display: "flex",
            alignItems: "center",
            gap: typeBase * 0.018,
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: Math.round(typeBase * 0.05),
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "#16203A",
            opacity: titleIn * exit.opacity,
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
        {layers.map((layer, i) => {
          // layers[0] sits at the BOTTOM of the stack.
          const fromBottom = i;
          const top = stackTop + (n - 1 - fromBottom) * (slabH + slabGap);
          const appearAt = BUILD_LEAD + i * perLayer;
          const p = spring({
            frame: frame - Math.round(appearAt * fps),
            fps,
            durationInFrames: Math.round(0.5 * fps),
            config: { damping: 16, stiffness: 130, mass: 0.7 },
          });
          const visible = t >= appearAt;
          const isAccent = layer.accent ?? i === n - 1;

          const chipSize = slabH * 0.58;
          const radius = Math.round(slabH * 0.18);
          const lip = Math.round(slabH * 0.13); // solid base edge → physical thickness
          // Foundation = 01 at the bottom, counting up.
          const layerIndex = String(i + 1).padStart(2, "0");

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: slabLeft,
                top,
                width: slabW,
                height: slabH,
                visibility: visible ? "visible" : "hidden",
                display: "flex",
                alignItems: "center",
                gap: slabW * 0.032,
                paddingLeft: slabW * 0.05,
                paddingRight: slabW * 0.045,
                boxSizing: "border-box",
                borderRadius: radius,
                background: isAccent
                  ? `linear-gradient(180deg, #E8FF6B 0%, ${LIME} 58%, ${LIME_DEEP} 100%)`
                  : `linear-gradient(180deg, #3C4B6E 0%, #2D3950 52%, #222C42 100%)`,
                border: isAccent
                  ? `1px solid #F4FFA8`
                  : `1px solid rgba(255,255,255,0.12)`,
                // Solid colored "lip" for slab thickness + a soft drop shadow so
                // the dark-blue slab separates cleanly from the LIGHT stage,
                // plus a top inner highlight so the surface looks lit (premium).
                boxShadow: isAccent
                  ? `0 ${lip}px 0 ${LIME_DEEP}, 0 ${lip + slabH * 0.08}px ${slabH * 0.3}px rgba(174,220,0,0.35), 0 ${lip + slabH * 0.1}px ${slabH * 0.28}px rgba(20,27,38,0.30), inset 0 1px 0 rgba(255,255,255,0.55)`
                  : `0 ${lip}px 0 #1A2236, 0 ${lip + slabH * 0.08}px ${slabH * 0.3}px rgba(20,27,38,0.34), inset 0 1px 0 rgba(255,255,255,0.14)`,
                opacity: interpolate(p, [0, 1], [0, 1]),
                transform: `translateY(${interpolate(p, [0, 1], [slabH * 0.5, 0])}px) scale(${interpolate(p, [0, 1], [0.96, 1])})`,
              }}
            >
              {/* Left accent bar — lime spine that reads as a "layer" marker. */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: slabH * 0.18,
                  bottom: slabH * 0.18,
                  width: Math.max(4, Math.round(slabW * 0.006)),
                  borderRadius: 99,
                  background: isAccent ? "rgba(15,18,26,0.55)" : LIME,
                  boxShadow: isAccent ? "none" : `0 0 ${slabH * 0.12}px rgba(207,255,5,0.55)`,
                }}
              />

              {/* Glyph chip */}
              <div
                style={{
                  width: chipSize,
                  height: chipSize,
                  flexShrink: 0,
                  borderRadius: "24%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: chipSize * 0.56,
                  background: isAccent ? "rgba(15,18,26,0.16)" : "rgba(10,13,20,0.55)",
                  border: `1.5px solid ${isAccent ? "rgba(15,18,26,0.30)" : "rgba(181,191,194,0.25)"}`,
                  boxShadow: isAccent ? "none" : "inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                {layer.glyph}
              </div>

              {/* Label + sub */}
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontFamily: FONT,
                    fontWeight: 800,
                    fontSize: Math.round(slabH * 0.30),
                    letterSpacing: "-0.01em",
                    lineHeight: 1.05,
                    color: isAccent ? RAISIN : WHITE,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {layer.label}
                </div>
                {layer.sub && (
                  <div
                    style={{
                      fontFamily: FONT,
                      fontWeight: 600,
                      fontSize: Math.round(slabH * 0.155),
                      color: isAccent ? "rgba(15,18,26,0.74)" : "#CAD4E6",
                      marginTop: slabH * 0.045,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {layer.sub}
                  </div>
                )}
              </div>

              {/* Layer index — small mono tag, far right. */}
              <div
                style={{
                  flexShrink: 0,
                  fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
                  fontWeight: 700,
                  fontSize: Math.round(slabH * 0.18),
                  letterSpacing: "0.06em",
                  color: isAccent ? "rgba(15,18,26,0.5)" : "rgba(202,212,230,0.62)",
                }}
              >
                {layerIndex}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

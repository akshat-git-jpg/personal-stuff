import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { LightGridBg } from "./Backgrounds";
import { useTypeBase } from "./motion";

export type HorizontalTimelineStep = {
  heading: string;
  description?: string;
  /** Appear time in seconds, RELATIVE to the beat's start_sec. If omitted,
   *  items auto-stagger across the first 60% of the beat duration. */
  appear_sec?: number;
};

export type HorizontalTimelineProps = {
  /** Optional title pinned to the top of the frame. */
  title?: string;
  steps: HorizontalTimelineStep[];
};

/**
 * Static horizontal timeline. All N cards live on a fixed rail, sized so the
 * full strip fits in the frame at once — NO camera pan. Cards reveal in
 * sequence at their appear_sec via a fade + lift entrance, then stay locked
 * in place. The viewer's eye walks the rail at their own pace.
 *
 * Why no camera pan: a panning track makes content unreadable — each card
 * has only ~1.5s of legibility before it slides off-axis. With a fixed
 * layout, every card is readable for the rest of the beat once it appears.
 *
 * Layout invariants:
 *  1. **All N cards fit inside the frame width.** Card width is computed
 *     from the item count so 3-card strips, 4-card strips, and 5-card
 *     strips all balance the frame.
 *  2. **Title row owns the top 14% with an opaque raisin-black bar.**
 *     Cards live in the middle band; rail at the bottom.
 *  3. **Hard overflow guards:** heading clamps to 2 lines, description to 3.
 *     Cards have `overflow: hidden`. Long copy truncates with ellipsis.
 *  4. **Type sizes anchor on `min(width, height)`** so 9:16 and 16:9 read
 *     at the same balance.
 */
export const HorizontalTimeline: React.FC<HorizontalTimelineProps> = ({ title, steps }) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";
  const N = Math.max(1, steps.length);

  // ── Vertical bands ────────────────────────────────────────────────────
  // Cards are tight — content drives height, not the other way around.
  // Excess vertical white inside cards reads as messy ("under-filled
  // wireframe"), so we shrink the card box to hug the content.
  const titleBarHeight = title ? Math.round(height * 0.13) : 0;
  const cardTopY = Math.round(height * (title ? 0.30 : 0.18));
  const cardH = Math.round(height * (title ? 0.28 : 0.36));
  const railY = Math.round(height * 0.74);

  // ── Horizontal layout — fit all cards in the frame, no panning ────────
  // We allocate the frame width as: 2*sidePad + N*cardW + (N-1)*gap = width.
  // sidePad and gap scale with width so the strip breathes a little. cardW
  // is then derived. This guarantees every card lives inside the frame.
  const sidePadFrac = 0.025;
  const gapFrac = 0.020;
  const sidePad = Math.round(width * sidePadFrac);
  const gap = Math.round(width * gapFrac);
  const totalGap = (N - 1) * gap;
  const cardW = Math.floor((width - 2 * sidePad - totalGap) / N);
  const itemPitch = cardW + gap;

  // ── Type ladder ───────────────────────────────────────────────────────
  // Type sizes scale down only when cards get TIGHT (>4 items in the
  // strip). For 3–4 items we trust the base sizes — text fills the card.
  const cardScale = cardW / (width * 0.25); // reference: 25%-wide card
  const scale = Math.min(1, cardScale);
  const titleSize = Math.round(typeBase * 0.046);
  const headingSize = Math.round(typeBase * 0.040 * scale);
  const descSize = Math.round(typeBase * 0.024 * scale);
  const numChipSize = Math.round(typeBase * 0.026 * scale);
  const dotSize = Math.round(typeBase * 0.030);
  const cardPad = Math.round(typeBase * 0.018);
  const cardRadius = Math.round(typeBase * 0.014);

  // ── Item appear times ──────────────────────────────────────────────────
  const totalSec = durationInFrames / fps;
  const span = totalSec * 0.60;
  const norm = steps.map((s, i) => ({
    ...s,
    appear_sec: typeof s.appear_sec === "number"
      ? s.appear_sec
      : (span / Math.max(1, N - 1 || 1)) * i,
  }));

  // Rail fill: progresses with item appearances
  const lastAppearFrame = Math.max(0, ...norm.map((s) => Math.round(s.appear_sec! * fps)));
  const railFillProg = interpolate(
    frame,
    [0, lastAppearFrame + Math.round(fps * 0.4)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const titleEnter = spring({
    frame, fps, durationInFrames: 14,
    config: { damping: 18, stiffness: 130, mass: 0.65 },
  });

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <LightGridBg />

      {/* RAIL — drawn behind the cards, in absolute frame coords (no pan). */}
      <div style={{
        position: "absolute",
        top: railY - 1.5,
        left: sidePad + cardW / 2,
        height: 3,
        width: (N - 1) * itemPitch,
        backgroundColor: "rgba(15,18,26,0.14)",
        borderRadius: 2,
      }} />
      <div style={{
        position: "absolute",
        top: railY - 2,
        left: sidePad + cardW / 2,
        height: 4,
        width: (N - 1) * itemPitch * railFillProg,
        backgroundColor: "#0F121A",
        borderRadius: 2,
      }} />

      {/* CARDS */}
      {norm.map((it, i) => {
        const itemFrame = Math.round(it.appear_sec! * fps);
        const dotProg = spring({
          frame: frame - itemFrame,
          fps,
          durationInFrames: Math.round(fps * 0.40),
          config: { damping: 14, stiffness: 130, mass: 0.6 },
        });
        const cardProg = spring({
          frame: frame - itemFrame - Math.round(fps * 0.04),
          fps,
          durationInFrames: Math.round(fps * 0.55),
          config: { damping: 16, stiffness: 110, mass: 0.7 },
        });
        const visible = frame >= itemFrame;
        const cardLeft = sidePad + i * itemPitch;
        const numLabel = String(i + 1).padStart(2, "0");

        return (
          <div key={i} style={{
            position: "absolute",
            left: cardLeft,
            top: 0,
            width: cardW,
            height: "100%",
            opacity: visible ? 1 : 0,
          }}>
            {/* Connecting tick from card-bottom to dot */}
            <div style={{
              position: "absolute",
              left: cardW / 2 - 1.5,
              top: cardTopY + cardH,
              width: 3,
              height: railY - (cardTopY + cardH) - dotSize / 2,
              backgroundColor: "#0F121A",
              opacity: cardProg,
            }} />

            {/* Card */}
            <div style={{
              position: "absolute",
              left: 0,
              top: cardTopY,
              width: cardW,
              height: cardH,
              padding: cardPad,
              boxSizing: "border-box",
              backgroundColor: "#FFFFFF",
              border: `2px solid #0F121A`,
              borderRadius: cardRadius,
              boxShadow: `0 ${Math.round(typeBase * 0.010)}px ${Math.round(typeBase * 0.026)}px rgba(15,18,26,0.12)`,
              opacity: cardProg,
              transform: `translateY(${interpolate(cardProg, [0, 1], [16, 0])}px)`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: Math.round(typeBase * 0.008),
              overflow: "hidden",
            }}>
              {/* Number chip */}
              <div style={{
                fontFamily,
                fontWeight: 700,
                fontSize: numChipSize,
                color: "#CFFF05",
                background: "#0F121A",
                alignSelf: "flex-start",
                padding: `${Math.round(typeBase * 0.005)}px ${Math.round(typeBase * 0.015)}px`,
                borderRadius: 999,
                letterSpacing: "0.02em",
                fontVariantNumeric: "tabular-nums",
              }}>
                {numLabel}
              </div>
              {/* Heading — clamped 2 lines */}
              <div style={{
                fontFamily,
                fontWeight: 700,
                fontSize: headingSize,
                color: "#0F121A",
                lineHeight: 1.10,
                letterSpacing: "-0.005em",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
                // Break only on whitespace — never mid-word. Hyphenated
                // word splits ("actual-ly") read as broken design.
                overflowWrap: "break-word",
                wordBreak: "normal",
                hyphens: "manual",
              }}>
                {it.heading}
              </div>
              {/* Description — clamped 3 lines */}
              {it.description && (
                <div style={{
                  fontFamily,
                  fontWeight: 500,
                  fontSize: descSize,
                  color: "#343E5B",
                  lineHeight: 1.30,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  overflowWrap: "break-word",
                  wordBreak: "normal",
                  hyphens: "manual",
                }}>
                  {it.description}
                </div>
              )}
            </div>

            {/* Dot on rail */}
            <div style={{
              position: "absolute",
              left: cardW / 2 - dotSize / 2,
              top: railY - dotSize / 2,
              width: dotSize,
              height: dotSize,
              borderRadius: "50%",
              backgroundColor: "#CFFF05",
              border: `3px solid #0F121A`,
              transform: `scale(${dotProg})`,
            }} />
          </div>
        );
      })}

      {/* TITLE BAR — opaque raisin-black, pinned top. */}
      {title && (
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: titleBarHeight,
          backgroundColor: "#0F121A",
          borderBottom: `3px solid #CFFF05`,
          paddingLeft: Math.round(width * 0.04),
          paddingRight: Math.round(width * 0.04),
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
          boxShadow: `0 ${Math.round(typeBase * 0.012)}px ${Math.round(typeBase * 0.026)}px rgba(15,18,26,0.20)`,
        }}>
          <span style={{ color: "#CFFF05", marginRight: Math.round(typeBase * 0.018) }}>━</span>
          {title}
        </div>
      )}
    </AbsoluteFill>
  );
};

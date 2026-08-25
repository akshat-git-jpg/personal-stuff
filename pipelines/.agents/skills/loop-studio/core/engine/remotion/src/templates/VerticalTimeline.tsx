import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { LightGridBg } from "./Backgrounds";
import { useTypeBase } from "./motion";

export type VerticalTimelineItem = {
  heading: string;
  description?: string;
  /** Absolute source-video time the item should appear (seconds). */
  appear_sec?: number;
};

export type VerticalTimelineProps = {
  items: VerticalTimelineItem[];
  title?: string;
  /** Absolute source-video start of the beat — converts each item's absolute
   *  appear_sec into a within-Sequence frame. */
  beat_start_sec?: number;
};

/**
 * Vertical timeline — the LINE is the core of the visual.
 *
 * The rail draws downward; each dot POPS from the rail's growing head at the
 * exact moment the head reaches that dot's position. The rail's descent is
 * keyframed so railHead(appear_frame[i]) === dotY[i] — so line speed and dot
 * cadence are locked: the line never races ahead of (or lags) the points.
 *
 * Fixed-height rows make every dot's Y deterministic, which is what lets the
 * rail be keyframed precisely to each dot.
 */
export const VerticalTimeline: React.FC<VerticalTimelineProps> = ({
  items, title, beat_start_sec,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";

  const N = Math.max(1, items.length);
  const base = beat_start_sec ?? 0;

  // ---- geometry (fixed, deterministic) -----------------------------------
  const padX = width * 0.08;
  const padTop = height * 0.085;
  const titleSize = Math.round(typeBase * 0.052);
  const headingSize = Math.round(typeBase * 0.060);
  const descSize = Math.round(typeBase * 0.032);
  const dotSize = Math.round(typeBase * 0.038);
  const railW = Math.max(3, Math.round(typeBase * 0.009));
  const colGap = width * 0.045;
  const rowH = height * 0.135;

  const titleBlockH = title ? titleSize * 1.2 + height * 0.045 : 0;
  const contentTop = padTop + titleBlockH;
  // dot centre Y for row i — dot sits on the heading line
  const dotCY = (i: number) => contentTop + i * rowH + headingSize * 0.5;
  const dotColCX = padX + dotSize / 2;

  // ---- per-item appear frames --------------------------------------------
  const appearF = items.map((it, i) => {
    if (typeof it.appear_sec === "number") {
      return Math.max(0, Math.round((it.appear_sec - base) * fps));
    }
    // fallback auto-stagger across first 60% of the beat
    return Math.round((durationInFrames * 0.6 / N) * i);
  });

  // ---- rail head Y: keyframed through every (appearFrame[i], dotY[i]) -----
  // interpolate() with arrays gives piecewise-linear motion that passes
  // EXACTLY through each dot at its appear frame — so the head reaches a dot
  // the instant that dot is due. Monotonic input required, so guard it.
  const kfFrames: number[] = [];
  const kfYs: number[] = [];
  for (let i = 0; i < N; i++) {
    const f = appearF[i];
    if (kfFrames.length && f <= kfFrames[kfFrames.length - 1]) {
      kfFrames.push(kfFrames[kfFrames.length - 1] + 1);
    } else {
      kfFrames.push(f);
    }
    kfYs.push(dotCY(i));
  }
  const railTop = dotCY(0);
  const railHeadY = kfFrames.length > 1
    ? interpolate(frame, kfFrames, kfYs, {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      })
    : dotCY(0);
  const railVisible = frame >= kfFrames[0];
  const railHeight = Math.max(0, railHeadY - railTop);

  return (
    <AbsoluteFill>
      <LightGridBg />
      <AbsoluteFill>
        {/* Title */}
        {title && (
          <div style={{
            position: "absolute",
            left: padX, top: padTop,
            fontFamily,
            fontWeight: 800,
            fontSize: titleSize,
            color: "#0F121A",
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            opacity: interpolate(frame, [0, 10], [0, 1], {
              extrapolateLeft: "clamp", extrapolateRight: "clamp",
            }),
          }}>
            {title}
          </div>
        )}

        {/* Rail — the spine. Drawn from the first dot down to the head. */}
        {railVisible && (
          <div style={{
            position: "absolute",
            left: dotColCX - railW / 2,
            top: railTop,
            width: railW,
            height: railHeight,
            backgroundColor: "#0F121A",
            borderRadius: railW,
          }} />
        )}

        {/* Rows */}
        {items.map((it, i) => {
          const fApp = appearF[i];
          const cy = dotCY(i);
          const dotPop = spring({
            frame: frame - fApp, fps,
            durationInFrames: Math.round(fps * 0.34),
            config: { damping: 12, stiffness: 200, mass: 0.5 },
          });
          const textProg = interpolate(
            frame, [fApp + 3, fApp + 15], [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const shown = frame >= fApp;
          return (
            <div key={i}>
              {/* dot — pops from the rail head when the head reaches cy */}
              <div style={{
                position: "absolute",
                left: dotColCX - dotSize / 2,
                top: cy - dotSize / 2,
                width: dotSize, height: dotSize,
                borderRadius: "50%",
                backgroundColor: "#CFFF05",
                border: `${Math.max(2, Math.round(typeBase*0.006))}px solid #0F121A`,
                transform: `scale(${shown ? dotPop : 0})`,
                boxShadow: shown
                  ? `0 0 ${typeBase*0.03}px rgba(207,255,5,0.6)`
                  : "none",
              }} />
              {/* text column */}
              <div style={{
                position: "absolute",
                left: dotColCX + dotSize / 2 + colGap,
                top: cy - headingSize * 0.5,
                width: width - (dotColCX + dotSize / 2 + colGap) - padX,
                opacity: textProg,
                transform: `translateX(${interpolate(textProg, [0,1], [-14,0])}px)`,
              }}>
                <div style={{
                  fontFamily, fontWeight: 800, fontSize: headingSize,
                  color: "#0F121A", lineHeight: 1.0,
                }}>
                  {it.heading}
                </div>
                {it.description && (
                  <div style={{
                    fontFamily, fontWeight: 500, fontSize: descSize,
                    color: "#343E5B", lineHeight: 1.25,
                    marginTop: descSize * 0.45,
                  }}>
                    {it.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

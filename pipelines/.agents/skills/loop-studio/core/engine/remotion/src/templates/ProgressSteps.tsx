import { AbsoluteFill, useVideoConfig } from "remotion";
import { LightGridBg } from "./Backgrounds";
import { useFadeRise, useSettleZoom, useSpringIn, useWipe, useTypeBase } from "./motion";

export type ProgressStep = {
  label: string;
  /** When this step should pop in (seconds). */
  appear_sec?: number;
  /** When the step transitions to "active" (filled). */
  active_sec?: number;
};

export type ProgressStepsProps = {
  steps: ProgressStep[];
  /** Optional title above the row. */
  title?: string;
};

const MAX_STEPS = 6;

/**
 * Vertical numbered chain. Each step is an outlined box; the lime fill
 * wipes left→right with a smooth ease as the speaker reaches it. The
 * filled step also gets a subtle settle zoom (1.00 → 1.015) so the
 * "active" position breathes a little instead of just sitting still.
 */
export const ProgressSteps: React.FC<ProgressStepsProps> = ({ steps, title }) => {
  const { fps, width, durationInFrames } = useVideoConfig();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";

  const totalSec = durationInFrames / fps;
  const span = totalSec * 0.6;
  const norm = steps.slice(0, MAX_STEPS).map((s, i) => ({
    ...s,
    appear_sec: typeof s.appear_sec === "number"
      ? s.appear_sec
      : (span / Math.max(1, steps.length)) * i,
    active_sec: typeof s.active_sec === "number"
      ? s.active_sec
      : (span / Math.max(1, steps.length)) * i + 0.30,
  }));

  // Pad to fixed length so we always call the same number of hooks
  const padded = [...norm];
  while (padded.length < MAX_STEPS) padded.push(null as any);

  // Per-step hooks (always MAX_STEPS hooks)
  const enters = padded.map((s) =>
    useSpringIn(s ? s.appear_sec : 9999, 0.45),
  );
  const fills = padded.map((s) =>
    useWipe(s ? s.active_sec! : 9999, 0.55),
  );
  const zooms = padded.map((s) =>
    useSettleZoom(s ? s.active_sec! : 9999, 1.4, 1.015),
  );
  const titleEnter = useFadeRise(0.00, 0.45, 12);

  return (
    <AbsoluteFill>
      <LightGridBg />
      <AbsoluteFill style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: width * 0.06,
      }}>
        {title && (
          <div style={{
            fontFamily,
            fontWeight: 700,
            fontSize: Math.round(typeBase * 0.055),
            color: "#0F121A",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: width * 0.05,
            opacity: titleEnter.opacity,
            transform: `translateY(${titleEnter.ty}px)`,
          }}>
            {title}
          </div>
        )}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: width * 0.025,
        }}>
          {norm.map((s, i) => {
            const enter = enters[i];
            const fill = fills[i];
            const zoom = zooms[i];
            return (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                gap: width * 0.025,
                opacity: enter,
                transform: `translateX(${(1 - enter) * -20}px) scale(${zoom})`,
                transformOrigin: "left center",
              }}>
                <div style={{
                  fontFamily,
                  fontWeight: 700,
                  fontSize: Math.round(typeBase * 0.040),
                  color: fill > 0.4 ? "#CFFF05" : "#343E5B",
                  width: width * 0.06,
                  textAlign: "right",
                  fontVariantNumeric: "tabular-nums",
                  transition: "color 0.3s",
                }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{
                  position: "relative",
                  flex: 1,
                  padding: `${width * 0.022}px ${width * 0.030}px`,
                  border: "3px solid #0F121A",
                  borderRadius: width * 0.012,
                  overflow: "hidden",
                }}>
                  {/* Lime fill — clip-path wipe from left so the edge feels
                      liquid rather than a scaling box. */}
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    backgroundColor: "#CFFF05",
                    clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)`,
                  }} />
                  {/* Soft lime glow on the leading edge while filling */}
                  {fill > 0.02 && fill < 0.98 && (
                    <div style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: `${fill * 100}%`,
                      width: width * 0.025,
                      transform: "translateX(-50%)",
                      background: "linear-gradient(90deg, rgba(207,255,5,0) 0%, rgba(207,255,5,0.55) 50%, rgba(207,255,5,0) 100%)",
                      filter: "blur(8px)",
                    }} />
                  )}
                  <div style={{
                    position: "relative",
                    fontFamily,
                    fontWeight: 700,
                    fontSize: Math.round(typeBase * 0.054),
                    color: "#0F121A",
                  }}>
                    {s.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

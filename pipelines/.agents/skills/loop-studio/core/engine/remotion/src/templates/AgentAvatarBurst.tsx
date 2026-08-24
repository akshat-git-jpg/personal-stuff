import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useTypeBase } from "./motion";

/**
 * AGENT AVATAR BURST — small stylized AI-agent icons (inline SVG, no asset)
 * in deterministic scattered slots. Each item lands at `appear_sec`; optional
 * `dim_at` makes the agent fade and gain a red X (the "killed routine"
 * pattern from scene-5 / scene-13).
 *
 * Cardless. Each avatar is a rounded square with a tiny robot face — eyes,
 * mouth bar, antenna — themed raisin/lime. `kept` agents render in lime;
 * unkept (the cull majority) stay silver.
 */
export type AgentAvatarItem = {
  /** Optional label below the avatar. */
  label?: string;
  appear_sec: number;
  /** Absolute time the avatar should DIM + show a red X over it. */
  dim_at?: number;
  /** Render in lime as a survivor / kept agent. */
  kept?: boolean;
};

export type AgentAvatarBurstProps = {
  items: AgentAvatarItem[];
  beat_start_sec?: number;
  /** Optional title at top of the burst. */
  title?: string;
};

const LIME = "#CFFF05";
const SILVER = "#B5BFC2";
const RAISIN = "#0F121A";
const RED = "#FF4D5E";
const BLOCK = "'Space Grotesk', system-ui, sans-serif";

// Up to 12 slots (scene-11's "12 agents"). Grid-ish but scattered so it
// doesn't read as a literal grid.
const SLOTS: Array<{ xPct: number; yPct: number; sizePct: number }> = [
  { xPct: 0.18, yPct: 0.28, sizePct: 0.14 },
  { xPct: 0.42, yPct: 0.25, sizePct: 0.14 },
  { xPct: 0.66, yPct: 0.28, sizePct: 0.14 },
  { xPct: 0.84, yPct: 0.34, sizePct: 0.14 },
  { xPct: 0.20, yPct: 0.46, sizePct: 0.14 },
  { xPct: 0.46, yPct: 0.48, sizePct: 0.14 },
  { xPct: 0.74, yPct: 0.46, sizePct: 0.14 },
  { xPct: 0.18, yPct: 0.66, sizePct: 0.14 },
  { xPct: 0.42, yPct: 0.68, sizePct: 0.14 },
  { xPct: 0.66, yPct: 0.66, sizePct: 0.14 },
  { xPct: 0.84, yPct: 0.72, sizePct: 0.14 },
  { xPct: 0.50, yPct: 0.84, sizePct: 0.14 },
];

const RobotAvatar: React.FC<{ size: number; color: string; bg: string }> = ({
  size, color, bg,
}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    {/* body */}
    <rect x="10" y="22" width="80" height="68" rx="14" fill={bg}
          stroke={color} strokeWidth="3" />
    {/* antenna */}
    <line x1="50" y1="22" x2="50" y2="10" stroke={color} strokeWidth="3" />
    <circle cx="50" cy="8" r="4" fill={color} />
    {/* eyes */}
    <circle cx="35" cy="48" r="6" fill={color} />
    <circle cx="65" cy="48" r="6" fill={color} />
    {/* mouth */}
    <rect x="32" y="66" width="36" height="6" rx="3" fill={color} />
  </svg>
);

export const AgentAvatarBurst: React.FC<AgentAvatarBurstProps> = ({
  items, beat_start_sec, title,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const base = beat_start_sec ?? 0;

  if (!items || items.length === 0) return null;

  const exitStart = durationInFrames - 8;
  const groupOpacity = frame > exitStart
    ? interpolate(frame, [exitStart, durationInFrames], [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  const titleSize = Math.round(typeBase * 0.038);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: groupOpacity }}>
      {title && (
        <div style={{
          position: "absolute",
          top: height * 0.10, left: 0, right: 0,
          textAlign: "center",
          fontFamily: BLOCK, fontWeight: 800, fontSize: titleSize,
          color: "#FFFFFF",
          textTransform: "uppercase", letterSpacing: "0.04em",
          textShadow: "0 4px 16px rgba(0,0,0,0.85)",
          opacity: interpolate(frame, [0, 10], [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          {title}
        </div>
      )}
      {items.map((it, i) => {
        const slot = SLOTS[i % SLOTS.length];
        const appearF = Math.max(0, Math.round((it.appear_sec - base) * fps));
        const dimF = typeof it.dim_at === "number"
          ? Math.max(0, Math.round((it.dim_at - base) * fps)) : null;
        const visible = frame >= appearF;
        if (!visible) return null;

        const pop = spring({
          frame: frame - appearF, fps,
          durationInFrames: Math.round(0.35 * fps),
          config: { damping: 12, stiffness: 220, mass: 0.5 },
        });
        const enterScale = interpolate(pop, [0, 1], [0.5, 1.0],
          { extrapolateRight: "clamp" });
        const enterOp = interpolate(pop, [0, 0.6], [0, 1],
          { extrapolateRight: "clamp" });

        // dim fade after dim_at
        let dimOp = 1;
        let showX = false;
        if (dimF !== null && frame >= dimF) {
          dimOp = interpolate(frame, [dimF, dimF + 10], [1, 0.28],
            { extrapolateRight: "clamp" });
          showX = true;
        }

        const size = width * slot.sizePct;
        const left = width * slot.xPct - size / 2;
        const top = height * slot.yPct - size / 2;
        const accent = it.kept ? LIME : SILVER;
        const bg = it.kept ? "rgba(15,18,26,0.92)" : "rgba(15,18,26,0.92)";

        return (
          <div key={i} style={{
            position: "absolute",
            left, top, width: size,
            opacity: enterOp * dimOp,
            transform: `scale(${enterScale})`,
            transformOrigin: "center",
          }}>
            <RobotAvatar size={size} color={accent} bg={bg} />
            {showX && (
              <svg width={size} height={size}
                style={{ position: "absolute", left: 0, top: 0 }}
                viewBox="0 0 100 100">
                <line x1="18" y1="18" x2="82" y2="82"
                      stroke={RED} strokeWidth="8" strokeLinecap="round"
                      opacity={interpolate(frame, [dimF!, dimF! + 8], [0, 1],
                        { extrapolateRight: "clamp" })} />
                <line x1="82" y1="18" x2="18" y2="82"
                      stroke={RED} strokeWidth="8" strokeLinecap="round"
                      opacity={interpolate(frame, [dimF!, dimF! + 8], [0, 1],
                        { extrapolateRight: "clamp" })} />
              </svg>
            )}
            {it.label && (
              <div style={{
                marginTop: size * 0.08,
                fontFamily: BLOCK, fontWeight: 800,
                fontSize: Math.round(typeBase * 0.020),
                color: "#FFFFFF",
                textAlign: "center",
                textShadow: "0 4px 12px rgba(0,0,0,0.85)",
              }}>
                {it.label}
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

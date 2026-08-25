import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { LightGridBg } from "./Backgrounds";
import { useTypeBase } from "./motion";

export type ChatMessageItem = {
  /** Role decides side + color: "user" = right side, raisin bg, white text;
   *  "agent" / "ai" / "claude" = left side, lime bg, raisin text;
   *  "other" = left side, raisin-light bg, white text (third party). */
  role: "user" | "agent" | "other";
  /** Optional speaker name above the bubble. Hidden for consecutive bubbles
   *  from the same role. */
  name?: string;
  /** Body text. Multi-line via \n. */
  text: string;
  /** When this bubble pops in (seconds, relative to beat start). */
  appear_sec?: number;
};

export type ChatMessageProps = {
  messages: ChatMessageItem[];
};

/**
 * iMessage-style chat conversation. Bubbles pop in sequentially from
 * alternating sides. Use for "I asked Claude X and it said Y" / customer
 * conversations / agent-to-agent dialogue / role-play exchanges.
 *
 * Hard rules:
 *  - Bubbles auto-stagger if `appear_sec` is missing
 *  - Long bodies clamp to 5 lines with ellipsis (one bubble shouldn't
 *    eat the whole frame)
 *  - Single neo-lime accent: only the agent/claude bubbles use lime
 *  - User bubbles are raisin black with white text — high contrast,
 *    reads fast
 *  - Bubbles flow vertically; if they overflow the body, the OLDEST
 *    bubbles slide UP and out (like a real chat would scroll)
 */
export const ChatMessage: React.FC<ChatMessageProps> = ({ messages }) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";

  const isLandscape = width >= height;
  const padX = Math.round(width * (isLandscape ? 0.16 : 0.07));
  const padY = Math.round(height * (isLandscape ? 0.10 : 0.10));
  const containerW = width - padX * 2;
  const containerH = height - padY * 2;

  const maxBubbleW = Math.round(containerW * 0.72);
  const bubblePadX = Math.round(typeBase * 0.024);
  const bubblePadY = Math.round(typeBase * 0.018);
  const bubbleRadius = Math.round(typeBase * 0.026);
  const bubbleGap = Math.round(typeBase * 0.022);
  const nameSize = Math.round(typeBase * 0.022);
  const bodySize = Math.round(typeBase * 0.030);

  // Auto-stagger appear_sec
  const totalSec = durationInFrames / fps;
  const span = totalSec * 0.70;
  const norm = messages.map((m, i) => ({
    ...m,
    appear_sec: typeof m.appear_sec === "number"
      ? m.appear_sec
      : (span / Math.max(1, messages.length)) * i,
  }));

  return (
    <AbsoluteFill>
      <LightGridBg />
      <div style={{
        position: "absolute",
        left: padX,
        top: padY,
        width: containerW,
        height: containerH,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        gap: bubbleGap,
        overflow: "hidden",
      }}>
        {norm.map((msg, idx) => {
          const itemFrame = Math.round(msg.appear_sec! * fps);
          const enter = spring({
            frame: frame - itemFrame,
            fps,
            durationInFrames: Math.round(fps * 0.45),
            config: { damping: 16, stiffness: 130, mass: 0.65 },
          });
          const visible = frame >= itemFrame;
          // Slot pre-allocated even when invisible — earlier bubbles must
          // STAY in place when new ones reveal. Without this, a 2nd bubble
          // appearing pushes the 1st one up, which reads as broken design.
          // (iMessage actually does this too on real devices; we don't.)

          const isUser = msg.role === "user";
          const isAgent = msg.role === "agent";
          const align = isUser ? "flex-end" : "flex-start";
          const bg = isUser ? "#0F121A" : isAgent ? "#CFFF05" : "#343E5B";
          const fg = isUser ? "#FFFFFF" : isAgent ? "#0F121A" : "#FFFFFF";
          const showName = !!msg.name && (
            idx === 0 || norm[idx - 1].role !== msg.role
          );
          const slideOriginX = isUser ? 24 : -24;

          return (
            <div key={idx} style={{
              display: "flex",
              flexDirection: "column",
              alignItems: align,
              gap: Math.round(typeBase * 0.005),
              opacity: visible ? enter : 0,
              transform: visible
                ? `translateX(${interpolate(enter, [0, 1], [slideOriginX, 0])}px) translateY(${interpolate(enter, [0, 1], [12, 0])}px)`
                : "none",
            }}>
              {showName && (
                <div style={{
                  fontFamily,
                  fontSize: nameSize,
                  fontWeight: 600,
                  color: "#5A6275",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  paddingLeft: isUser ? 0 : Math.round(typeBase * 0.012),
                  paddingRight: isUser ? Math.round(typeBase * 0.012) : 0,
                }}>
                  {msg.name}
                </div>
              )}
              <div style={{
                maxWidth: maxBubbleW,
                padding: `${bubblePadY}px ${bubblePadX}px`,
                backgroundColor: bg,
                color: fg,
                borderRadius: bubbleRadius,
                fontFamily,
                fontWeight: 500,
                fontSize: bodySize,
                lineHeight: 1.32,
                letterSpacing: "-0.005em",
                whiteSpace: "pre-wrap",
                overflowWrap: "break-word",
                wordBreak: "normal",
                hyphens: "manual",
                display: "-webkit-box",
                WebkitLineClamp: 5,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
                boxShadow: `0 ${Math.round(typeBase * 0.005)}px ${Math.round(typeBase * 0.014)}px rgba(15,18,26,0.10)`,
                // Tail-like rounded asymmetry on the bottom corner facing the side
                borderBottomRightRadius: isUser ? Math.round(bubbleRadius * 0.3) : bubbleRadius,
                borderBottomLeftRadius: !isUser ? Math.round(bubbleRadius * 0.3) : bubbleRadius,
              }}>
                {msg.text}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { useTypeBase } from "./motion";

const resolveSrc = (s: string): string => /^https?:\/\//i.test(s) ? s : staticFile(s);

export type NotificationToastProps = {
  /** App label — "Slack" / "Gmail" / "Stripe" */
  app_name: string;
  /** Optional image src for the app icon (PNG/JPG). If omitted, renders a
   *  branded lime square with the asterisk mark inside. */
  app_icon?: string;
  /** Bold notification title — "New message from Mats" / "Payment received" */
  title: string;
  /** 1–2 line body. Gets clamped to 2 lines with ellipsis. */
  body: string;
  /** Right-aligned timestamp ("now", "1m ago"). Default "now". */
  time?: string;
  /** Anchor: "top-right" (default) or "top-center". */
  anchor?: "top-right" | "top-center";
};

/**
 * iOS/macOS-style push notification that slides in over the speaker. PARTIAL
 * overlay — speaker stays visible; this is for "I got a Slack saying X" beats
 * where the notification IS the supporting visual but shouldn't take over.
 *
 * Choreography:
 *   0.00s   slides in from above, springs to rest
 *   ~beat-end-0.30s   slides out the way it came
 *
 * Hard rules:
 *  - Body clamps to 2 lines so tall notifications don't grow unbounded
 *  - Title clamps to 1 line
 *  - Soft drop shadow + backdrop blur so it reads against any speaker
 *    background
 *  - Lime accent ONLY on the icon square (rule §4f, single accent per frame)
 */
export const NotificationToast: React.FC<NotificationToastProps> = ({
  app_name,
  app_icon,
  title,
  body,
  time,
  anchor,
}) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";

  const isLandscape = width >= height;
  const cardW = Math.round(width * (isLandscape ? 0.32 : 0.78));
  const cardPadX = Math.round(typeBase * 0.022);
  const cardPadY = Math.round(typeBase * 0.018);
  const radius = Math.round(typeBase * 0.024);
  const iconSize = Math.round(typeBase * 0.058);
  const titleSize = Math.round(typeBase * 0.030);
  const bodySize = Math.round(typeBase * 0.026);
  const timeSize = Math.round(typeBase * 0.022);
  const margin = Math.round(typeBase * 0.040);

  const slot = anchor ?? "top-right";
  const cardLeft = slot === "top-center"
    ? Math.round((width - cardW) / 2)
    : width - cardW - margin;
  const cardTop = margin + Math.round(typeBase * 0.015);

  // Computed-on-demand duration: detect from prop chain context. Since the
  // component is mounted inside a <Sequence durationInFrames=...>, we use
  // useVideoConfig's durationInFrames as the beat length.
  const { durationInFrames } = useVideoConfig();
  const enterFrames = Math.round(fps * 0.55);
  const exitFrames = Math.round(fps * 0.45);
  const exitStart = durationInFrames - exitFrames;

  const inProg = spring({
    frame, fps, durationInFrames: enterFrames,
    config: { damping: 16, stiffness: 130, mass: 0.7 },
  });
  const outProg = frame > exitStart
    ? spring({
        frame: frame - exitStart, fps, durationInFrames: exitFrames,
        config: { damping: 18, stiffness: 110, mass: 0.7 },
      })
    : 0;

  const slideY = interpolate(inProg, [0, 1], [-cardW * 0.35, 0]) +
                 interpolate(outProg, [0, 1], [0, -cardW * 0.35]);
  const opacity = Math.min(inProg, 1 - outProg);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute",
        left: cardLeft,
        top: cardTop,
        width: cardW,
        backgroundColor: "rgba(245,247,248,0.92)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderRadius: radius,
        padding: `${cardPadY}px ${cardPadX}px`,
        boxShadow: `0 ${Math.round(typeBase * 0.020)}px ${Math.round(typeBase * 0.050)}px rgba(0,0,0,0.30), 0 ${Math.round(typeBase * 0.005)}px ${Math.round(typeBase * 0.010)}px rgba(0,0,0,0.18)`,
        border: "1px solid rgba(255,255,255,0.55)",
        opacity,
        transform: `translateY(${slideY}px)`,
        display: "flex",
        gap: Math.round(typeBase * 0.014),
        alignItems: "flex-start",
      }}>
        {/* Icon — lime square with asterisk if no asset */}
        <div style={{
          width: iconSize,
          height: iconSize,
          borderRadius: Math.round(iconSize * 0.22),
          backgroundColor: app_icon ? "transparent" : "#CFFF05",
          flexShrink: 0,
          overflow: "hidden",
          position: "relative",
          boxShadow: "0 1px 2px rgba(0,0,0,0.20)",
        }}>
          {app_icon ? (
            <Img src={resolveSrc(app_icon)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily,
              fontWeight: 700,
              fontSize: Math.round(iconSize * 0.62),
              color: "#0F121A",
              lineHeight: 1,
            }}>
              ✦
            </div>
          )}
        </div>

        {/* Text column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top row: app name + time */}
          <div style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: Math.round(typeBase * 0.012),
            marginBottom: Math.round(typeBase * 0.004),
          }}>
            <span style={{
              fontFamily,
              fontWeight: 600,
              fontSize: timeSize,
              color: "#5A6275",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {app_name}
            </span>
            <span style={{
              fontFamily,
              fontWeight: 500,
              fontSize: timeSize,
              color: "#9AA3AB",
              flexShrink: 0,
            }}>
              {time ?? "now"}
            </span>
          </div>
          {/* Title */}
          <div style={{
            fontFamily,
            fontWeight: 700,
            fontSize: titleSize,
            color: "#0F121A",
            lineHeight: 1.20,
            letterSpacing: "-0.005em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            marginBottom: Math.round(typeBase * 0.004),
          }}>
            {title}
          </div>
          {/* Body */}
          <div style={{
            fontFamily,
            fontWeight: 500,
            fontSize: bodySize,
            color: "#343E5B",
            lineHeight: 1.30,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textOverflow: "ellipsis",
            overflowWrap: "break-word",
            wordBreak: "normal",
            hyphens: "manual",
          }}>
            {body}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

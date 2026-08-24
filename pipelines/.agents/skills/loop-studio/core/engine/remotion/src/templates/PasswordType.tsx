import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useTypeBase } from "./motion";

/**
 * PASSWORD TYPE — a smooth, clean animation of a password being typed into a
 * glassy input field, then accepted (lime ring + check). Partial overlay: the
 * speaker stays visible above; the field sits in the lower third.
 */
export type PasswordTypeProps = {
  /** The password text that types in (or its length when masked). */
  password?: string;
  /** Small label above the field. */
  label?: string;
  /** MASK: render each typed char as a • dot — the password stays SECRET
   *  (revealed later in the video). Shows a lock, not a check, on accept. */
  mask?: boolean;
  /** 0..1 vertical anchor for the field centre (default lower third). */
  vertical?: number;
  beat_start_sec?: number;
};

const LIME = "#CFFF05";
const RAISIN = "#0F121A";
const BLOCK = "'Space Grotesk', system-ui, sans-serif";

export const PasswordType: React.FC<PasswordTypeProps> = ({
  password = "FABLE5",
  label = "PASSWORD",
  mask,
  vertical = 0.62,
  beat_start_sec,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();

  const dur = durationInFrames;
  const t = frame / dur;

  // Entrance: field fades + scales in over first ~0.35s.
  const intro = spring({ frame, fps, durationInFrames: Math.round(0.42 * fps), config: { damping: 16, stiffness: 170 } });
  // Exit fade.
  const exit = frame > dur - 8
    ? interpolate(frame, [dur - 8, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  // Typing window: chars appear between 18% and 60% of the beat.
  const typeStart = 0.18, typeEnd = 0.60;
  const typed = Math.max(0, Math.min(password.length,
    Math.round(interpolate(t, [typeStart, typeEnd], [0, password.length],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))));
  const shown = mask ? "•".repeat(typed) : password.slice(0, typed);
  const done = typed >= password.length;

  // Caret blink (hide once accepted).
  const caretOn = !done && Math.floor(frame / Math.round(0.42 * fps)) % 2 === 0;

  // Accept state (lime ring + check) shortly after typing completes.
  const acceptF = Math.round(0.66 * dur);
  const accept = spring({ frame: frame - acceptF, fps, durationInFrames: Math.round(0.45 * fps), config: { damping: 12, stiffness: 200 } });
  const accepted = frame >= acceptF;

  // Layout
  const fieldW = Math.round(width * 0.42);
  const fieldH = Math.round(height * 0.135);
  const cx = width / 2;
  const cy = height * vertical;
  const fontSize = Math.round(fieldH * 0.42);
  const labelSize = Math.round(typeBase * 0.026);
  const radius = Math.round(fieldH * 0.30);

  const ringColor = accepted
    ? `rgba(207,255,5,${0.55 + 0.45 * accept})`
    : "rgba(207,255,5,0.30)";
  const ringW = accepted ? 3 + 2 * accept : 2;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: exit }}>
      <div style={{
        position: "absolute",
        left: cx - fieldW / 2,
        top: cy - fieldH / 2,
        width: fieldW,
        opacity: intro,
        transform: `translateY(${(1 - intro) * 18}px) scale(${0.96 + 0.04 * intro})`,
        transformOrigin: "center",
        display: "flex", flexDirection: "column", alignItems: "flex-start",
      }}>
        {/* label */}
        <div style={{
          fontFamily: BLOCK, fontWeight: 700, fontSize: labelSize,
          color: LIME, letterSpacing: "0.22em", textTransform: "uppercase",
          marginBottom: fieldH * 0.16,
          textShadow: "0 2px 10px rgba(0,0,0,0.8)",
        }}>{label}</div>

        {/* field */}
        <div style={{
          width: fieldW, height: fieldH,
          borderRadius: radius,
          background: "rgba(15,18,26,0.78)",
          border: `${ringW}px solid ${ringColor}`,
          boxShadow: accepted
            ? `0 10px 40px rgba(0,0,0,0.5), 0 0 ${fieldH*0.5}px rgba(207,255,5,${0.30*accept})`
            : "0 10px 40px rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center",
          padding: `0 ${fieldH * 0.42}px`,
          boxSizing: "border-box",
          position: "relative",
        }}>
          <span style={{
            fontFamily: BLOCK, fontWeight: 700, fontSize,
            color: "#FFFFFF", letterSpacing: "0.16em",
            display: "inline-block", whiteSpace: "nowrap",
          }}>
            {shown}
            <span style={{
              display: "inline-block",
              width: Math.round(fontSize * 0.10),
              height: fontSize,
              background: LIME,
              marginLeft: Math.round(fontSize * 0.10),
              transform: "translateY(2px)",
              opacity: caretOn ? 1 : 0,
            }} />
          </span>

          {/* accepted check */}
          {accepted && (
            <div style={{
              position: "absolute",
              right: fieldH * 0.34,
              width: fieldH * 0.46, height: fieldH * 0.46,
              borderRadius: "50%",
              background: LIME,
              display: "flex", alignItems: "center", justifyContent: "center",
              transform: `scale(${accept})`,
              boxShadow: `0 0 ${fieldH*0.3}px rgba(207,255,5,0.6)`,
            }}>
              {mask ? (
                <svg width={fieldH * 0.30} height={fieldH * 0.30} viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="10.5" width="14" height="9.5" rx="2" fill={RAISIN} />
                  <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke={RAISIN} strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width={fieldH * 0.28} height={fieldH * 0.28} viewBox="0 0 24 24" fill="none">
                  <path d="M4 12.5l5 5L20 6.5" stroke={RAISIN} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default PasswordType;

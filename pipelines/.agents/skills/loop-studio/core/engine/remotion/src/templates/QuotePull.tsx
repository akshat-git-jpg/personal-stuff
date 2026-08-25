import { AbsoluteFill, useVideoConfig } from "remotion";
import { DarkGridBg } from "./Backgrounds";
import { useFadeRise, useSettleZoom, useSpringIn, useTypewriter, useTypeBase } from "./motion";

export type QuotePullProps = {
  /** Quoted text. \n for explicit line breaks. */
  text: string;
  /** Attribution — e.g. "@gregisenberg" or "Sarah, founder @ Acme". */
  attribution?: string;
  /** Override the typewriter cadence (default 32). Set this from the speaker's
   *  actual reading pace via align_to_speech.py so the type finishes around
   *  when the speaker finishes the quote. */
  charsPerSecond?: number;
};

/**
 * Cinematic sequence:
 *   0.00s   lime quote glyph springs in (subtle damping)
 *   0.30s   text types in at ~28 chars/sec
 *   text-end + 0.2s   attribution fades up
 *   text-end + 0.5s   subtle settle zoom 1.00 → 1.025 holds the rest of the beat
 *
 * The typewriter pulls the viewer through the quote at reading speed
 * instead of dumping the whole thing at once. Settle zoom keeps the
 * frame alive after the text lands.
 */
export const QuotePull: React.FC<QuotePullProps> = ({ text, attribution, charsPerSecond }) => {
  const { width } = useVideoConfig();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";

  const charsPerSec = charsPerSecond ?? 32;
  const typeStart = 0.30;
  const typeEnd = typeStart + text.length / charsPerSec;
  const typed = useTypewriter(text, typeStart, charsPerSec);

  const glyphSpring = useSpringIn(0.00, 0.50);
  const attrEnter = useFadeRise(typeEnd + 0.20, 0.45, 10);
  const settleZoom = useSettleZoom(typeEnd + 0.50, 1.4, 1.025);

  // Cursor: blinks while typing, hidden once finished
  const cursorVisible = typed.length < text.length && Math.floor((typed.length / charsPerSec) * 4) % 2 === 0;

  return (
    <AbsoluteFill>
      <DarkGridBg />
      <AbsoluteFill style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: `${width * 0.10}px ${width * 0.08}px`,
        transform: `scale(${settleZoom})`,
        transformOrigin: "center",
      }}>
        <div style={{
          fontFamily,
          fontWeight: 700,
          fontSize: Math.round(typeBase * 0.30),
          color: "#CFFF05",
          lineHeight: 0.6,
          marginBottom: width * 0.02,
          opacity: glyphSpring,
          transform: `scale(${0.7 + 0.3 * glyphSpring})`,
          transformOrigin: "left top",
        }}>
          “
        </div>
        <div style={{
          fontFamily,
          fontWeight: 700,
          fontSize: Math.round(typeBase * 0.072),
          color: "#FFFFFF",
          lineHeight: 1.18,
          whiteSpace: "pre-line",
          minHeight: Math.round(typeBase * 0.072) * 1.18 * 2,
        }}>
          {typed}
          {cursorVisible && (
            <span style={{
              display: "inline-block",
              width: "0.55em",
              height: "0.85em",
              backgroundColor: "#CFFF05",
              marginLeft: "0.06em",
              verticalAlign: "text-bottom",
            }} />
          )}
        </div>
        {attribution && (
          <div style={{
            fontFamily,
            fontWeight: 600,
            fontSize: Math.round(typeBase * 0.040),
            color: "#B5BFC2",
            marginTop: width * 0.045,
            opacity: attrEnter.opacity,
            transform: `translateY(${attrEnter.ty}px)`,
          }}>
            — {attribution}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

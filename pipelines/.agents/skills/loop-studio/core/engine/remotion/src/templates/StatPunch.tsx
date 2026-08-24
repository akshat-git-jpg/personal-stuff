import { AbsoluteFill, useVideoConfig } from "remotion";
import { LightGridBg } from "./Backgrounds";
import { useFadeRise, useSettleZoom, useSpringIn, useTypeBase } from "./motion";

export type StatPunchProps = {
  /** The hero number/value, e.g. "73%", "$40K/mo", "6 months". */
  value: string;
  /** Supporting one-line caption beneath the value. */
  caption: string;
  /** Optional small label above the value (e.g. "OF FOUNDERS"). */
  preLabel?: string;
};

/**
 * Choreographed cadence:
 *   0.00s   pre-label fades up
 *   0.20s   value springs in, then settle-zooms 1.00 → 1.03 over 1.6s
 *   0.45s   caption fades up
 * Even rhythm, every element on the same standard ease. No spring
 * over-bounce — feels cinematic, not bouncy.
 */
export const StatPunch: React.FC<StatPunchProps> = ({ value, caption, preLabel }) => {
  const { width } = useVideoConfig();
  const typeBase = useTypeBase();
  const fontFamily = "Space Grotesk, system-ui, sans-serif";

  const labelEnter = useFadeRise(0.00, 0.45, 14);
  const valueSpring = useSpringIn(0.20, 0.55);
  const valueZoom = useSettleZoom(0.55, 1.8, 1.03);
  const captionEnter = useFadeRise(0.45, 0.50, 14);

  // Auto-fit the hero font size so the LONGEST WORD fits inside SAFE_FRAME of
  // the frame. Critical: empirical char-width factor for Space Grotesk Bold at
  // -0.02em tracking is ~0.65× fontSize, NOT 0.55× — the previous 0.55 value
  // happened to make maxFontByWord equal `width × 0.32` for 5-character words,
  // so "1 MONTH" / "MONTHS" rendered at full hero size and bled past both frame
  // edges. Tested visually: "MONTHS" at fontSize 246 fits cleanly with the new
  // factor; "WIZARDS" at fontSize 190 fits. Safety margin held at 0.80 so a
  // descender or bold glyph variant can't sneak past the frame.
  const valueWords = value.split(/\s+/);
  const longestWordLen = Math.max(1, ...valueWords.map((w) => w.length));
  const AVG_CHAR_FACTOR = 0.65;
  const SAFE_FRAME_FRACTION = 0.80;
  const maxFontByWord = (width * SAFE_FRAME_FRACTION) / (longestWordLen * AVG_CHAR_FACTOR);
  const heroFontSize = Math.round(Math.min(typeBase * 0.32, maxFontByWord));

  return (
    <AbsoluteFill>
      <LightGridBg />
      <AbsoluteFill style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: width * 0.05,
        textAlign: "center",
      }}>
        {preLabel && (
          <div style={{
            fontFamily,
            fontWeight: 700,
            fontSize: Math.round(typeBase * 0.038),
            color: "#CFFF05",
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            marginBottom: width * 0.025,
            opacity: labelEnter.opacity,
            transform: `translateY(${labelEnter.ty}px)`,
          }}>
            {preLabel}
          </div>
        )}
        <div style={{
          fontFamily,
          fontWeight: 700,
          fontSize: heroFontSize,
          color: "#CFFF05",
          lineHeight: 0.85,
          letterSpacing: "-0.02em",
          // Wrap on whitespace so multi-word values render on multiple lines —
          // keeps each word centered and inside the safe frame.
          whiteSpace: "pre-line",
          opacity: valueSpring,
          transform: `scale(${(0.7 + 0.3 * valueSpring) * valueZoom})`,
        }}>
          {valueWords.join("\n")}
        </div>
        <div style={{
          fontFamily,
          fontWeight: 600,
          fontSize: Math.round(typeBase * 0.045),
          color: "#E9ECED",
          lineHeight: 1.25,
          marginTop: width * 0.035,
          maxWidth: width * 0.85,
          opacity: captionEnter.opacity,
          transform: `translateY(${captionEnter.ty}px)`,
        }}>
          {caption}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

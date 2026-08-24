import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useTypeBase } from "./motion";

/**
 * HEADLINE CARD — a news-clipping styled card in the bottom half of the
 * frame (same glass frame as ImageCard, speaker visible above).
 *
 * Use it instead of a literal/metaphor image when the point is "this is a
 * real, reported thing" — a market boom, a trend, an event. A real headline
 * reads as evidence; a metaphor image reads as decoration.
 *
 * Layout: a small lime source/masthead row, a big bold headline (left-
 * aligned, news-style, supports a single `{...}` lime highlight), a thin
 * rule, and a muted dek line. Headline lines fade up with a slight stagger
 * so the card "builds" like a chyron.
 */
export type HeadlineCardProps = {
  /** Small uppercase masthead / section line (lime). e.g. "THE GLP-1 BOOM". */
  source: string;
  /** The headline. Supports `\n` line breaks and one `{...}` lime span. */
  headline: string;
  /** Optional muted sub-line under the rule. */
  dek?: string;
};

const LIME = "#CFFF05";
const RAISIN = "#0F121A";
const BLOCK = "'Space Grotesk', system-ui, sans-serif";

export const HeadlineCard: React.FC<HeadlineCardProps> = ({ source, headline, dek }) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();

  // ---- entrance / exit (matches ImageCard so the two read as one family) --
  const enter = spring({
    frame, fps, durationInFrames: Math.round(0.5 * fps),
    config: { damping: 18, stiffness: 120, mass: 0.8 },
  });
  const exitStart = durationInFrames - 8;
  const exitP = frame > exitStart
    ? interpolate(frame, [exitStart, durationInFrames], [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 0;
  const opacity = enter * (1 - exitP);
  const ty = interpolate(enter, [0, 1], [height * 0.06, 0])
    + interpolate(exitP, [0, 1], [0, height * 0.04]);

  // ---- geometry (mirrors ImageCard) --------------------------------------
  const margin = width * 0.06;
  const cardTop = height * 0.46;
  const cardBottom = height * 0.05;
  const radius = width * 0.05;
  const pad = width * 0.06;
  const borderW = Math.max(2, Math.round(typeBase * 0.005));

  const sourceSize = Math.round(typeBase * 0.034);
  const headlineSize = Math.round(typeBase * 0.072);
  const dekSize = Math.round(typeBase * 0.036);

  // headline → lines → segments (one optional {lime} span)
  const parseLine = (line: string): Array<{ lime: boolean; text: string }> => {
    const parts: Array<{ lime: boolean; text: string }> = [];
    const re = /\{([^}]*)\}/g;
    let cursor = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > cursor) parts.push({ lime: false, text: line.slice(cursor, m.index) });
      parts.push({ lime: true, text: m[1] });
      cursor = m.index + m[0].length;
    }
    if (cursor < line.length) parts.push({ lime: false, text: line.slice(cursor) });
    if (parts.length === 0) parts.push({ lime: false, text: line });
    return parts;
  };
  const lines = headline.split("\n").map(parseLine);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute",
        left: margin, right: margin,
        top: cardTop, bottom: cardBottom,
        opacity,
        transform: `translateY(${ty}px)`,
        borderRadius: radius,
        backgroundColor: "rgba(15,18,26,0.78)",
        backdropFilter: "blur(26px)",
        WebkitBackdropFilter: "blur(26px)",
        border: `${borderW}px solid rgba(207,255,5,0.55)`,
        boxShadow: [
          `0 0 ${typeBase * 0.06}px rgba(207,255,5,0.30)`,
          `0 ${typeBase * 0.03}px ${typeBase * 0.07}px rgba(0,0,0,0.55)`,
        ].join(", "),
        padding: pad,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: typeBase * 0.022,
      }}>
        {/* source / masthead — plain lime letter-spaced label, no dot */}
        <div style={{
          fontFamily: BLOCK, fontWeight: 800, fontSize: sourceSize,
          color: LIME, textTransform: "uppercase", letterSpacing: "0.16em",
          opacity: interpolate(frame, [2, 12], [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>
          {source}
        </div>

        {/* headline — left-aligned, news-style, lines stagger up */}
        <div>
          {lines.map((parts, li) => {
            const p = spring({
              frame: frame - (8 + li * 4), fps,
              durationInFrames: Math.round(0.42 * fps),
              config: { damping: 18, stiffness: 130, mass: 0.7 },
            });
            return (
              <div key={li} style={{
                fontFamily: BLOCK, fontWeight: 900, fontSize: headlineSize,
                lineHeight: 1.06, letterSpacing: "-0.02em", color: "#FFFFFF",
                opacity: p,
                transform: `translateY(${interpolate(p, [0, 1], [16, 0])}px)`,
              }}>
                {parts.map((part, pi) => (
                  <span key={pi} style={{ color: part.lime ? LIME : "#FFFFFF" }}>
                    {part.text}
                  </span>
                ))}
              </div>
            );
          })}
        </div>

        {dek && (
          <>
            <div style={{
              height: Math.max(2, Math.round(typeBase * 0.004)),
              width: "38%",
              backgroundColor: "rgba(207,255,5,0.7)",
              borderRadius: 2,
              opacity: interpolate(frame, [14, 22], [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }} />
            <div style={{
              fontFamily: BLOCK, fontWeight: 500, fontSize: dekSize,
              lineHeight: 1.3, color: "#B5BFC2",
              opacity: interpolate(frame, [16, 26], [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
            }}>
              {dek}
            </div>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};

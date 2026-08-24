import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { DarkGridBg } from "./Backgrounds";
import {
  useChoreographedExit,
  useLivingHold,
  useTypeBase,
  useWordReveal,
} from "./motion";

export type KineticWord = {
  /** The word as it should read on screen. */
  text: string;
  /** Absolute source-video time (seconds) when the speaker says this word.
   *  Pull straight from words.json so the reveal is locked to the voice.
   *  Falls back to the beat start if omitted. */
  appear_sec?: number;
  /** Render this word as the emphasized (lime + glow) key word. */
  emphasis?: boolean;
};

export type KineticStatementProps = {
  words: KineticWord[];
  /** Beat start in source-video seconds — used to localize each word's
   *  absolute `appear_sec` to this Sequence's frame 0. */
  startSec: number;
  /** Overlay mode: render the type ON TOP of the talking-head video instead
   *  of as a full-screen takeover. Drops the grid background, anchors the
   *  words to the lower third (below the speaker's face), and lays a soft
   *  bottom scrim for legibility. The speaker stays fully visible. */
  overlay?: boolean;
};

const FONT = "Space Grotesk, system-ui, sans-serif";
const LIME = "#CFFF05";

/**
 * VO-synced kinetic statement. Each word lifts into place with a motion-blur
 * settle exactly as it is spoken; the key words turn lime and glow; the whole
 * block keeps a slow living drift, then dissolves forward on exit.
 *
 * Deliberately NO overflow-clip mask — that was cutting glyph edges and
 * leaving a cheap ghost. Premium kinetic type reads from blur + position +
 * scale + depth, not from a hard mask.
 */
export const KineticStatement: React.FC<KineticStatementProps> = ({
  words,
  startSec,
  overlay = false,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const typeBase = useTypeBase();
  const baseFontSize = typeBase * (overlay ? 0.072 : 0.084);
  // In overlay mode, keep the whole statement on ONE row. Two-row wrapping left
  // big dead space on the left/right (owner note 2026-05-29). We have the full
  // frame width here, so auto-shrink the font just enough that the line fits
  // across ~90% of the frame and never wraps. Non-overlay (full-screen takeover)
  // still wraps + centers as before.
  let fontSize = Math.round(baseFontSize);
  if (overlay) {
    const totalChars = words.reduce((s, w) => s + w.text.length, 0);
    const gaps = Math.max(0, words.length - 1);
    const avail = width * 0.9;
    // Space Grotesk bold ≈ 0.56·fontSize avg glyph advance; inter-word gap 0.3em.
    const fitted = avail / (0.56 * totalChars + 0.3 * gaps);
    fontSize = Math.round(Math.min(baseFontSize, fitted));
  }

  const EXIT_DUR = 0.5;
  const exitStartSec = Math.max(0, durationInFrames / fps - EXIT_DUR);
  const exit = useChoreographedExit(exitStartSec, EXIT_DUR);
  const hold = useLivingHold(4, 1.018, -6);

  return (
    <AbsoluteFill>
      {overlay ? (
        /* Overlay mode: no grid. A soft bottom scrim only — keeps the
           speaker's face fully visible up top while the lower-third type
           stays legible over busy footage. */
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(180deg, rgba(8,10,15,0) 45%, rgba(8,10,15,0.0) 55%, rgba(8,10,15,0.62) 100%)",
          }}
        />
      ) : (
        <>
          <DarkGridBg />
          {/* Focusing vignette — darkens the edges so the type reads as the
              subject, not a flat caption on a flat grid. */}
          <AbsoluteFill
            style={{
              background:
                "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(15,18,26,0) 0%, rgba(8,10,15,0.55) 100%)",
            }}
          />
        </>
      )}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: overlay ? "flex-end" : "center",
          justifyContent: "center",
          padding: width * 0.09,
          paddingBottom: overlay ? height * 0.05 : width * 0.09,
          opacity: exit.opacity,
          filter: exit.blur > 0.05 ? `blur(${exit.blur}px)` : undefined,
          transform: `translateY(${hold.ty + exit.ty}px) scale(${hold.scale * exit.scale})`,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: overlay ? "nowrap" : "wrap",
            gap: `${fontSize * 0.2}px ${fontSize * 0.3}px`,
            justifyContent: "center",
            alignItems: "baseline",
            maxWidth: overlay ? "96%" : "86%",
            textAlign: "center",
            whiteSpace: overlay ? "nowrap" : undefined,
          }}
        >
          {words.map((w, i) => (
            <KineticWordSpan
              key={i}
              word={w}
              startSec={startSec}
              fontSize={fontSize}
            />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const KineticWordSpan: React.FC<{
  word: KineticWord;
  startSec: number;
  fontSize: number;
}> = ({ word, startSec, fontSize }) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const localAppear = Math.max(0, (word.appear_sec ?? startSec) - startSec);
  const k = useWordReveal(localAppear, 0.5);
  const emph = !!word.emphasis;

  // Entrance: lift + motion-blur settle + micro-scale. All derived from the
  // same eased progress so the word arrives as one gesture.
  const rise = (1 - k) * fontSize * 0.42; // px lifted up from below
  const blur = (1 - k) * 13; // motion-blur that resolves to crisp
  const enterScale = 0.92 + 0.08 * k;

  // Emphasis: a brief scale overshoot at the landing moment so the key word
  // arrives with a beat, then settles back to 1.0 (color + glow carry it).
  const startFrame = Math.round(localAppear * fps);
  const overshoot = emph ? 1 + 0.08 * springGate(frame, startFrame, fps) : 1;

  const color = emph ? LIME : "#FFFFFF";
  // Lime reads poorly over bright/busy footage in overlay mode, so emphasis
  // words get a hard dark drop + a wider soft dark halo for separation,
  // THEN the lime glow on top. White words keep a strong dark shadow too.
  const shadow = emph
    ? `0 2px 3px rgba(0,0,0,0.95), 0 ${fontSize * 0.06}px ${fontSize * 0.22}px rgba(0,0,0,0.75), 0 0 ${fontSize * 0.34}px rgba(207,255,5,0.35)`
    : `0 2px 3px rgba(0,0,0,0.9), 0 ${fontSize * 0.06}px ${fontSize * 0.24}px rgba(0,0,0,0.6)`;

  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: FONT,
        fontWeight: 700,
        fontSize,
        lineHeight: 1.12,
        letterSpacing: "-0.02em",
        color,
        opacity: k,
        textShadow: shadow,
        transform: `translateY(${rise}px) scale(${enterScale * overshoot})`,
        transformOrigin: "center bottom",
        filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
        whiteSpace: "pre",
        willChange: "transform, opacity, filter",
      }}
    >
      {word.text}
    </span>
  );
};

// A 0→1→0 gate over ~0.45s after a word appears, so the emphasis overshoot
// only fires around the landing moment and doesn't permanently inflate scale.
function springGate(frame: number, startFrame: number, fps: number): number {
  const t = (frame - startFrame) / fps;
  if (t <= 0) return 0;
  const peak = 0.16;
  const fall = 0.45;
  if (t < peak) return t / peak;
  if (t < fall) return 1 - (t - peak) / (fall - peak);
  return 0;
}

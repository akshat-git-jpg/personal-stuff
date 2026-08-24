import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useTypeBase } from "./motion";

/**
 * Single typographic emphasis item: text shown over the speaker with NO
 * card / no fill — just bold letters timed to land when the speaker says
 * them. Each item replaces the previous with a soft cross-fade and a
 * 0.92 → 1.0 scale snap.
 *
 *   appear_sec is in ABSOLUTE source-video seconds (same convention as
 *   list / keyword_chips / progress_steps) so authors can copy timestamps
 *   straight out of words.json without computing offsets.
 *
 * Mixed-font syntax — wrap any portion of `text` in curly braces to
 * render that span in a script ("written") font instead of the bold
 * Space Grotesk default. The script span keeps its own line breaks and
 * gets a soft lime underline ink-stroke. Examples:
 *
 *   "FUTURE OF {solo business}"
 *     → "FUTURE OF" in block sans, "solo business" in script
 *
 *   "{find your wave} first"
 *     → "find your wave" in script, "first" in block sans
 *
 * Use the mix to lean into emotion / softness on key nouns while keeping
 * the framing words in the sharper block font.
 */
export type WordPopItem = {
  /** Display text. Wrap any sub-span in `{...}` to render it in the script
   *  font ("written" variant). The braces themselves are stripped at render. */
  text: string;
  /** Absolute source-video seconds when this item should appear. */
  appear_sec: number;
  /** Optional: render this item's block (non-script) text in neo-lime
   *  instead of white. Use sparingly — one lime accent per beat max. */
  accent?: boolean;
};

export type WordPopProps = {
  items: WordPopItem[];
  /** The Sequence's absolute start time, used to convert appear_sec → frame.
   *  EditedVideo.tsx passes broll.start_sec. */
  beat_start_sec: number;
  /** Optional override of the default block font size (relative to typeBase).
   *  Default 0.115 — big enough to read, small enough not to cover the face.
   *  Drop to 0.085 for long phrases (3+ words). */
  size?: number;
  /** Vertical position of the text block, 0 = top edge, 1 = bottom edge.
   *  Default 0.72 — sits in the lower third, above where burned-in shorts
   *  captions usually live, below the speaker's face/hands. */
  vertical?: number;
};

// Stack-of-stacks: try Google Fonts Caveat first (loaded via injected link),
// then macOS-native handwriting fonts, then the generic cursive fallback.
const SCRIPT_FONT_STACK =
  "'Caveat', 'Bradley Hand', 'Bradley Hand ITC', 'Brush Script MT', 'Snell Roundhand', cursive";
const BLOCK_FONT_STACK = "'Space Grotesk', system-ui, sans-serif";

// Inject Google Fonts <link> exactly once per page load. The script-font
// span uses Caveat at 700; if the font hasn't fetched yet by the first
// few frames, the fallback ("Bradley Hand" on macOS) reads similarly
// enough that no flash-of-unstyled-text is visible at video pace.
let __wordPopFontInjected = false;
const ensureScriptFontLoaded = () => {
  if (typeof document === "undefined" || __wordPopFontInjected) return;
  __wordPopFontInjected = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=block";
  document.head.appendChild(link);
};

/**
 * Cardless centered typography. Built specifically for shorts where the
 * speaker is the show — the text floats over them with a heavy
 * drop-shadow for legibility, scales in fast, and disappears the moment
 * the next item lands. No backdrop, no border, no card frame.
 *
 * Vertical anchor: lower third by default (vertical=0.72), so text sits
 * above burned-in captions without covering the speaker's face.
 */
export const WordPop: React.FC<WordPopProps> = ({
  items,
  beat_start_sec,
  size,
  vertical,
}) => {
  ensureScriptFontLoaded();
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();

  if (!items || items.length === 0) {
    return null;
  }

  // Build [startFrame, endFrame] for each item — end = next item's start,
  // last item runs to a large sentinel so the Sequence's own dur clips it.
  //
  // SINGLE-item word_pop: ignore appear_sec entirely — the one line shows
  // for the whole beat (start at frame 0). align_to_speech.py snaps the
  // BEAT to its speech_anchor but does NOT move per-item appear_sec, so a
  // hand-authored appear_sec goes stale the moment the beat is realigned —
  // which would make the only line never appear. A lone item has nothing to
  // stagger against anyway, so frame 0 is always correct.
  const single = items.length === 1;
  const segs = items.map((it, i) => {
    const start = single
      ? 0
      : Math.max(0, Math.round((it.appear_sec - beat_start_sec) * fps));
    const end = i < items.length - 1
      ? Math.max(start + 1, Math.round((items[i + 1].appear_sec - beat_start_sec) * fps))
      : 100_000;
    return { ...it, start, end };
  });

  // Auto-fit font: shrink if the longest token would overflow 88% of width.
  // Strip braces for the width calculation since they're rendered invisible.
  const baseSize = (size ?? 0.115) * typeBase;
  const longestChars = Math.max(
    ...items.map((it) => it.text.replace(/[{}]/g, "").length),
    1,
  );
  const maxCharsAtBase = (width * 0.88) / (baseSize * 0.55);
  const scaleFactor = longestChars > maxCharsAtBase
    ? maxCharsAtBase / longestChars
    : 1;
  const fontSize = Math.round(baseSize * scaleFactor);
  // Script font tends to render visually smaller at the same size; bump it
  // ~12% so the two styles feel balanced on the same line.
  const scriptFontSize = Math.round(fontSize * 1.12);

  // Vertical anchor — lower third by default. Convert to a flex item by
  // using justifyContent + a y offset so we can still tune the curve.
  const verticalAnchor = vertical ?? 0.72;
  // We pick top padding = verticalAnchor * height - (textBlockHeight / 2)
  // but since textBlockHeight is dynamic, use a simple top offset and let
  // text grow downward from there.
  const topOffsetPct = Math.max(0, Math.min(0.92, verticalAnchor)) * 100;
  // CSS percentage padding resolves against the container's WIDTH, so on a
  // LANDSCAPE frame `${pct}%` of the wide axis shoots the text clean off the
  // bottom (same bug fixed for hook_title — rule 4cc). On landscape, position
  // by height-relative pixels; portrait keeps the %-of-width path unchanged.
  const isLandscape = width > height;
  const topOffsetPx = Math.max(0, Math.min(0.92, verticalAnchor)) * height;

  const fadeIn = 7;   // frames
  const fadeOut = 6;  // frames

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {segs.map((s, i) => {
        let opacity = 0;
        let scale = 0.92;
        if (frame < s.start) {
          opacity = 0;
        } else if (frame < s.start + fadeIn) {
          const p = (frame - s.start) / fadeIn;
          opacity = p;
          scale = interpolate(p, [0, 1], [0.92, 1.0]);
        } else if (frame < s.end) {
          opacity = 1;
          scale = 1.0;
        } else if (frame < s.end + fadeOut) {
          const p = (frame - s.end) / fadeOut;
          opacity = 1 - p;
          scale = interpolate(p, [0, 1], [1.0, 0.97]);
        }
        if (opacity < 0.001) return null;

        // Split text into LINES first (by \n), then split each line into
        // alternating block / script segments by curly braces.
        //   "FUTURE OF\n{solo business}"
        //     → line 0: [{block: "FUTURE OF"}]
        //     → line 1: [{script: "solo business"}]
        // Each line renders as its own block-level row so textAlign center
        // works per-line (inline spans with \n broke centering on the
        // wrapped line — both lines collapsed onto the parent's left edge).
        const parseLine = (
          line: string,
        ): Array<{ kind: "block" | "script"; text: string }> => {
          const parts: Array<{ kind: "block" | "script"; text: string }> = [];
          const re = /\{([^}]*)\}/g;
          let cursor = 0;
          let m: RegExpExecArray | null;
          while ((m = re.exec(line)) !== null) {
            if (m.index > cursor) {
              parts.push({ kind: "block", text: line.slice(cursor, m.index) });
            }
            parts.push({ kind: "script", text: m[1] });
            cursor = m.index + m[0].length;
          }
          if (cursor < line.length) {
            parts.push({ kind: "block", text: line.slice(cursor) });
          }
          if (parts.length === 0) {
            parts.push({ kind: "block", text: line });
          }
          return parts;
        };
        const lines = s.text.split("\n").map(parseLine);

        // Drop-shadow stack: bold enough to read white text on any background
        // (light shirt, bright lamp, lime b-roll).
        const textShadow = [
          "0 6px 36px rgba(0,0,0,0.92)",
          "0 2px 12px rgba(0,0,0,0.80)",
          "0 0 4px rgba(0,0,0,0.60)",
        ].join(", ");

        return (
          <AbsoluteFill key={i} style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: isLandscape ? topOffsetPx : `${topOffsetPct}%`,
            paddingLeft: width * 0.06,
            paddingRight: width * 0.06,
          }}>
            <div style={{
              opacity,
              transform: `scale(${scale})`,
              transformOrigin: "center top",
              textAlign: "center",
              maxWidth: "92%",
              width: "92%",
              lineHeight: 1.02,
            }}>
              {lines.map((parts, li) => (
                <div key={li} style={{
                  textAlign: "center",
                  // Per-line block ensures each line centers independently.
                  // Avoid setting lineHeight on the parent — it conflicted
                  // with script font's intrinsic line metrics.
                  marginBottom: li < lines.length - 1 ? width * 0.005 : 0,
                }}>
                  {parts.map((part, pi) => {
                    if (part.kind === "script") {
                      // Detect adjacency to surrounding block segments so we
                      // can pad the side that touches block text — the italic
                      // tilt otherwise reads as "notBECAUSE" with no gap.
                      const prev = pi > 0 ? parts[pi - 1] : null;
                      const next = pi < parts.length - 1 ? parts[pi + 1] : null;
                      const padLeft = prev?.kind === "block" ? fontSize * 0.18 : 0;
                      const padRight = next?.kind === "block" ? fontSize * 0.18 : 0;
                      return (
                        <span key={pi} style={{
                          fontFamily: SCRIPT_FONT_STACK,
                          fontWeight: 700,
                          fontSize: scriptFontSize,
                          color: "#CFFF05",
                          letterSpacing: "0",
                          textShadow,
                          fontStyle: "italic",
                          display: "inline",
                          paddingLeft: padLeft,
                          paddingRight: padRight,
                        }}>
                          {part.text}
                        </span>
                      );
                    }
                    return (
                      <span key={pi} style={{
                        fontFamily: BLOCK_FONT_STACK,
                        fontWeight: 900,
                        fontSize,
                        color: s.accent ? "#CFFF05" : "#FFFFFF",
                        letterSpacing: "-0.025em",
                        textTransform: "uppercase",
                        textShadow,
                        display: "inline",
                      }}>
                        {part.text}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

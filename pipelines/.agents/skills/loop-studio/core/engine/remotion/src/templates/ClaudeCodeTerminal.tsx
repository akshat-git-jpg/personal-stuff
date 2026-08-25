import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useTypeBase } from "./motion";

/**
 * CLAUDE CODE TERMINAL — a small terminal-window overlay showing a Claude
 * Code session. Speaker doesn't spend much time in a literal shell — Claude
 * Code is what lives there, so a small "terminal-style" card showing prompts
 * and Claude's responses is a great subtle visual for any moment that
 * references the CLI tool, /compact, /clear, CLAUDE.md, MCP config, etc.
 *
 * Cardless-feeling but actually IS a card (a tiny terminal frame). Floats
 * in the lower-mid area as a partial overlay; speaker stays visible.
 * Lines reveal with a typewriter effect per line, each at its own
 * `appear_sec`. Lime accents on the prompt and Claude's outputs.
 */
export type ClaudeCodeLine = {
  /** "user" (you typing), "claude" (Claude's response), "system" (subdued info). */
  type?: "user" | "claude" | "system";
  text: string;
  /** Absolute source-video time the line should start typing in. */
  appear_sec: number;
  /** Characters-per-second typewriter speed for THIS line. Default 60 (fast). */
  cps?: number;
};

export type ClaudeCodeTerminalProps = {
  lines: ClaudeCodeLine[];
  title?: string;
  beat_start_sec?: number;
  /** Vertical anchor 0..1 of the terminal block's center. Default 0.55. */
  vertical?: number;
};

const LIME = "#CFFF05";
const RAISIN = "#0F121A";
const BLOCK = "'Space Grotesk', system-ui, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

const PROMPT = "claude>";

export const ClaudeCodeTerminal: React.FC<ClaudeCodeTerminalProps> = ({
  lines, title = "claude code", beat_start_sec, vertical,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();
  const base = beat_start_sec ?? 0;

  if (!lines || lines.length === 0) return null;

  const exitStart = durationInFrames - 8;
  const groupOp = frame > exitStart
    ? interpolate(frame, [exitStart, durationInFrames], [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  // Terminal frame: floats in middle, ~80% of frame width.
  const w = Math.round(width * 0.84);
  const h = Math.round(height * 0.42);
  const left = Math.round((width - w) / 2);
  const cy = Math.round(height * Math.max(0.30, Math.min(0.75, vertical ?? 0.55)));
  const top = cy - Math.round(h / 2);

  const titleSize = Math.round(typeBase * 0.022);
  const lineSize = Math.round(typeBase * 0.028);
  const linePad = Math.round(lineSize * 0.40);

  // group entrance (fade + small rise)
  const groupEnter = spring({
    frame: frame - 2, fps,
    durationInFrames: Math.round(0.40 * fps),
    config: { damping: 14, stiffness: 200, mass: 0.6 },
  });
  const enterOp = interpolate(groupEnter, [0, 1], [0, 1],
    { extrapolateRight: "clamp" });
  const enterTy = interpolate(groupEnter, [0, 1], [16, 0],
    { extrapolateRight: "clamp" });

  // Caret blink
  const caretBlink = Math.floor((frame / fps) * 2) % 2 === 0 ? 1 : 0.25;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: groupOp }}>
      <div style={{
        position: "absolute",
        left, top, width: w, height: h,
        borderRadius: 14,
        background: "rgba(15,18,26,0.96)",
        border: `1px solid rgba(207,255,5,0.20)`,
        boxShadow: "0 18px 50px rgba(0,0,0,0.60), 0 0 60px rgba(207,255,5,0.10)",
        backdropFilter: "blur(8px)",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        opacity: enterOp,
        transform: `translateY(${enterTy}px)`,
      }}>
        {/* title bar */}
        <div style={{
          flex: "0 0 auto",
          padding: `${Math.round(titleSize * 0.65)}px ${Math.round(titleSize * 1.1)}px`,
          background: "rgba(255,255,255,0.04)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: titleSize * 0.6,
        }}>
          <div style={{
            width: titleSize * 0.7, height: titleSize * 0.7,
            borderRadius: "50%", background: "#FF5F57",
          }} />
          <div style={{
            width: titleSize * 0.7, height: titleSize * 0.7,
            borderRadius: "50%", background: "#FEBC2E",
          }} />
          <div style={{
            width: titleSize * 0.7, height: titleSize * 0.7,
            borderRadius: "50%", background: "#28C840",
          }} />
          <div style={{
            marginLeft: titleSize * 0.8,
            fontFamily: BLOCK, fontWeight: 700, fontSize: titleSize,
            color: "rgba(255,255,255,0.65)",
            textTransform: "lowercase", letterSpacing: "0.04em",
          }}>{title}</div>
        </div>

        {/* line area */}
        <div style={{
          flex: "1 1 auto",
          padding: `${linePad * 1.6}px ${linePad * 2}px`,
          fontFamily: MONO,
          fontSize: lineSize,
          color: "#E6EAF0",
          lineHeight: 1.4,
          overflow: "hidden",
        }}>
          {lines.map((ln, i) => {
            const appearF = Math.max(0, Math.round((ln.appear_sec - base) * fps));
            if (frame < appearF) return null;
            const elapsed = (frame - appearF) / fps;
            const cps = ln.cps ?? 60;
            const visibleChars = Math.min(ln.text.length, Math.floor(elapsed * cps));
            const visibleText = ln.text.slice(0, visibleChars);
            const finished = visibleChars >= ln.text.length;
            const isLast = i === lines.length - 1;

            const color =
              ln.type === "claude" ? "#FFFFFF"
              : ln.type === "system" ? "rgba(230,234,240,0.55)"
              : "#E6EAF0";
            const prefix =
              ln.type === "claude" ? "" :
              ln.type === "system" ? "# " :
              "";

            return (
              <div key={i} style={{
                display: "flex",
                gap: linePad,
                marginBottom: linePad * 0.5,
                color,
              }}>
                {ln.type !== "claude" && ln.type !== "system" && (
                  <span style={{ color: LIME, fontWeight: 700 }}>{PROMPT}</span>
                )}
                <span style={{ whiteSpace: "pre-wrap" }}>
                  {prefix}{visibleText}
                  {!finished && isLast && (
                    <span style={{ opacity: caretBlink, color: LIME }}>▍</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

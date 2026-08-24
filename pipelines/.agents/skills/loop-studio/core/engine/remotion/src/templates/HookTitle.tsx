import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SMOOTH_EASE, useTypeBase } from "./motion";

/**
 * HOOK TITLE — the premium cold-open text treatment.
 *
 * This is the FIRST thing on screen (frame 0–1) on every short. Unlike the
 * workhorse `word_pop` — which is bare bold typography that pops in and out
 * mid-video — the hook title is a composed, hierarchical lockup built to
 * survive the 0.5-second scroll-decision window:
 *
 *   ┌─ kicker ──────────  small, uppercase, letter-spaced, lime
 *   ├─ accent rule ─────  thin lime bar, draws outward from center
 *   └─ HERO LINE ───────  huge block type, supports {script} spans
 *
 * Cardless (no fill / no box — same aesthetic rule as word_pop) but with a
 * much more deliberate entrance: kicker settles first, the rule draws, then
 * the hero line rises + un-blurs into place, then a slow settle-drift keeps
 * the frame alive while the speaker talks underneath.
 *
 * Mixed-font: the hero `title` supports the same `{...}` curly-brace script
 * syntax as word_pop.
 */
export type HookTitleProps = {
  /** Small eyebrow line above the hero. Uppercase, letter-spaced, lime. */
  kicker: string;
  /** Hero line. Huge block type. Supports `{...}` script spans + `\n`. */
  title: string;
  /** Vertical anchor 0..1 (0 = top, 1 = bottom). Default 0.66 — lower third,
   *  clear of the speaker's head/face (text must NEVER overlay the head). */
  vertical?: number;
  /** Horizontal layout:
   *  - "center" — centered lockup (kicker + rule + title)
   *  - "left"   — lockup anchored to the left margin
   *  - "flank"  — TWO text blocks flanking the speaker: `left_text` in the
   *               clear-left column, `right_text` in the clear-right column,
   *               both tucking behind the face. Ignores kicker/title/rule. */
  align?: "center" | "left" | "flank";
  /** flank mode: text block on the LEFT of the speaker's face. Supports \n. */
  left_text?: string;
  /** flank mode: text block on the RIGHT of the speaker's face. Supports \n. */
  right_text?: string;
  /** The Sequence's absolute start time (for parity with word_pop; the hook
   *  entrance is keyed off the Sequence's own frame 0 so this is unused for
   *  now, accepted so EditedVideo can pass it uniformly). */
  beat_start_sec?: number;
  /** Optional brand logo rendered above the kicker — for hooks that name a
   *  specific company ("KLARNA FIRED 700 PEOPLE"), the logo makes the brand
   *  concrete from frame zero. Rounded-square white tile, ~14% of frame
   *  width, with a lime hairline ring. Resolved via staticFile. */
  logo_path?: string;
  /** Multiple logos rendered side-by-side as a lockup above the kicker.
   *  When set, takes precedence over `logo_path`. Use for hooks that
   *  reference a brand PAIR ("anthropic + claude", "openai + anthropic"). */
  logo_paths?: string[];
};

const SCRIPT_FONT_STACK =
  "'Caveat', 'Bradley Hand', 'Bradley Hand ITC', 'Brush Script MT', 'Snell Roundhand', cursive";
const BLOCK_FONT_STACK = "'Space Grotesk', system-ui, sans-serif";

let __hookFontInjected = false;
const ensureScriptFontLoaded = () => {
  if (typeof document === "undefined" || __hookFontInjected) return;
  __hookFontInjected = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=block";
  document.head.appendChild(link);
};

export const HookTitle: React.FC<HookTitleProps> = ({
  kicker, title, vertical, align, left_text, right_text, logo_path, logo_paths,
}) => {
  const isLeft = align === "left";
  const isFlank = align === "flank";
  ensureScriptFontLoaded();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const typeBase = useTypeBase();

  // ---- Sizing -------------------------------------------------------------
  // Left-aligned hooks live in the clear left zone — sized smaller so the
  // whole hero reads there and only the last glyph or two tuck behind the
  // speaker. Centered hooks can go bigger.
  const heroBase = (isLeft ? 0.108 : 0.135) * typeBase;
  const heroLines = title.split("\n");
  const longestChars = Math.max(
    ...heroLines.map((l) => l.replace(/[{}]/g, "").length),
    1,
  );
  // Left-aligned hooks are typically behind_subject — keep the hero inside
  // ~58% of the frame width so it reads in the clear left zone and only its
  // tail tucks behind the speaker. Centered hooks may use the full 86%.
  const heroWidthCap = isLeft ? 0.58 : 0.86;
  // Char-width multiplier for Space Grotesk Black at this weight — was 0.55
  // (too narrow, predicted bigger fonts than would actually fit). Bumped to
  // 0.65 May 23 2026 after scene-8's "ZERO HAVE AN" (12 chars) wrapped to
  // a third line at the computed size.
  const charWidth = 0.65;
  const maxCharsAtBase = (width * heroWidthCap) / (heroBase * charWidth);
  // Width-derived scale (so the longest line fits in the cap).
  const widthScale = longestChars > maxCharsAtBase ? maxCharsAtBase / longestChars : 1;
  // Char-count tiered scale — even when a line technically fits, very long
  // titles look better smaller (less screen-dominant, fewer wrap risks
  // across font-rendering edge cases). Tiers chosen May 23 2026:
  //   ≤10  chars: full size (single-word hero — "FAKE", "$400M")
  //   ≤14  chars: 0.92× ("ARE THEATER", "ADD A ZERO")
  //   ≤18  chars: 0.82× ("ZERO HAVE AN", "BOTH TRUE.")
  //   ≤22  chars: 0.72× ("AGENT LAYER" longer titles)
  //   else      : 0.62× (very long — should usually be split with \n)
  const tierScale = longestChars <= 10 ? 1.00
                  : longestChars <= 14 ? 0.92
                  : longestChars <= 18 ? 0.82
                  : longestChars <= 22 ? 0.72 : 0.62;
  const heroScale = Math.min(widthScale, tierScale);
  const heroSize = Math.round(heroBase * heroScale);
  const scriptHeroSize = Math.round(heroSize * 1.12);
  const kickerSize = Math.round(typeBase * 0.030);
  const ruleW = width * 0.13;
  const ruleH = Math.max(3, Math.round(typeBase * 0.006));

  // ---- Entrance choreography ---------------------------------------------
  // kicker: 0–8f fade + slide down into place
  const kickerProg = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: SMOOTH_EASE,
  });
  // rule: 5–17f draws outward from center (scaleX)
  const ruleProg = interpolate(frame, [5, 17], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: SMOOTH_EASE,
  });
  // hero: 9f spring in — opacity + scale + blur burn-off
  const heroSpring = spring({
    frame: frame - 9, fps,
    durationInFrames: Math.round(0.55 * fps),
    config: { damping: 18, stiffness: 115, mass: 0.8 },
  });
  const heroOpacity = interpolate(frame, [9, 20], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const heroScaleIn = interpolate(heroSpring, [0, 1], [0.86, 1]);
  const heroBlur = interpolate(frame, [9, 22], [10, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });

  // settle-drift: very slow 1.0 → 1.018 zoom so the lockup never feels frozen
  const settle = interpolate(
    frame, [20, durationInFrames], [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: SMOOTH_EASE },
  );
  const settleScale = 1 + 0.018 * settle;

  // exit: last 8 frames fade + slight scale-down
  const exitStart = durationInFrames - 8;
  const exitProg = frame > exitStart
    ? interpolate(frame, [exitStart, durationInFrames], [0, 1], {
        extrapolateLeft: "clamp", extrapolateRight: "clamp",
      })
    : 0;
  const groupOpacity = 1 - exitProg;
  const groupScale = settleScale * (1 - 0.03 * exitProg);

  // `vertical` is a fraction of FRAME HEIGHT on every aspect ratio (2026-06-10).
  // CSS percentage padding resolves against WIDTH, so on portrait the old
  // %-path silently compressed placements toward the top (0.80 rendered at
  // 0.45 of height — text on the speaker's face). Height-relative pixels
  // everywhere makes `vertical` mean what authors think it means.
  const padTopCss = `${Math.round(Math.max(0, Math.min(0.92, vertical ?? 0.66)) * height)}px`;

  // AD-SAFE mode (REMOTION_AD_SAFE_CAPTIONS=1): paid ads play cropped (feed 4:5
  // cuts the bottom ~15%, Reels/Stories overlay the bottom ~20%). A top-anchored
  // hook grows downward and its payoff line drops into the crop. Bottom-anchor
  // instead — the last line locks ~24% from the bottom (above both zones) and
  // longer titles grow upward toward the face. Mirrors CinematicHook's fix.
  const adSafe = process.env.REMOTION_AD_SAFE_CAPTIONS === "1";
  // 0.31: the FB feed cuts more bottom than a clean center-crop + overlays
  // player UI there; calibrated to a real feed screenshot (2026-06-13).
  const adPadBottomCss = `${Math.round(height * 0.31)}px`;

  const textShadow = [
    "0 8px 44px rgba(0,0,0,0.94)",
    "0 3px 14px rgba(0,0,0,0.85)",
    "0 0 5px rgba(0,0,0,0.65)",
  ].join(", ");

  // Parse the hero title into block / script segments per line.
  const parseLine = (line: string): Array<{ kind: "block" | "script"; text: string }> => {
    const parts: Array<{ kind: "block" | "script"; text: string }> = [];
    const re = /\{([^}]*)\}/g;
    let cursor = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      if (m.index > cursor) parts.push({ kind: "block", text: line.slice(cursor, m.index) });
      parts.push({ kind: "script", text: m[1] });
      cursor = m.index + m[0].length;
    }
    if (cursor < line.length) parts.push({ kind: "block", text: line.slice(cursor) });
    if (parts.length === 0) parts.push({ kind: "block", text: line });
    return parts;
  };
  const lines = heroLines.map(parseLine);

  // ===== FLANK MODE ========================================================
  // Two text blocks straddling the speaker's face: left_text in the clear
  // left column, right_text in the clear right column. Both tuck behind the
  // face (the beat carries behind_subject). Left slides in from the left,
  // right from the right.
  if (isFlank) {
    const flankLines = (t: string) => (t || "").split("\n");
    const lT = flankLines(left_text ?? "");
    const rT = flankLines(right_text ?? "");
    // Size to the longest line across BOTH blocks so they read balanced.
    const longest = Math.max(
      ...lT.map((l) => l.length), ...rT.map((l) => l.length), 1,
    );
    // each side has ~42% of the frame to work with
    const flankSize = Math.min(
      0.115 * typeBase,
      (width * 0.42) / (longest * 0.55),
    );
    const topPct = Math.max(0, Math.min(0.85, vertical ?? 0.17)) * 100;

    const lProg = spring({
      frame, fps, durationInFrames: Math.round(0.5 * fps),
      config: { damping: 18, stiffness: 120, mass: 0.8 },
    });
    const rProg = spring({
      frame: frame - 4, fps, durationInFrames: Math.round(0.5 * fps),
      config: { damping: 18, stiffness: 120, mass: 0.8 },
    });
    const exitStartF = durationInFrames - 8;
    const exitP = frame > exitStartF
      ? interpolate(frame, [exitStartF, durationInFrames], [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 0;

    const blockStyle = (prog: number, fromX: number): React.CSSProperties => ({
      position: "absolute",
      top: `${topPct}%`,
      opacity: prog * (1 - exitP),
      transform: `translateX(${interpolate(prog, [0, 1], [fromX, 0])}px)`,
      fontFamily: BLOCK_FONT_STACK,
      fontWeight: 900,
      fontSize: flankSize,
      lineHeight: 1.0,
      letterSpacing: "-0.03em",
      textTransform: "uppercase",
      color: "#FFFFFF",
      textShadow,
    });

    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {/* LEFT block — anchored to the left margin, left-aligned */}
        <div style={{
          ...blockStyle(lProg, -width * 0.10),
          left: width * 0.05,
          textAlign: "left",
        }}>
          {lT.map((l, i) => <div key={i}>{l}</div>)}
        </div>
        {/* RIGHT block — anchored to the right margin, right-aligned */}
        <div style={{
          ...blockStyle(rProg, width * 0.10),
          right: width * 0.05,
          textAlign: "right",
        }}>
          {rT.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </AbsoluteFill>
    );
  }
  // ===== END FLANK MODE ====================================================

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Background scrim — a soft dark pool BEHIND the title lockup so the
          background reads darker (intentional, cinematic), while the text
          itself sits on top at full brightness. Biased to the text zone
          (lower-left for left mode, lower-center otherwise). Fades with the
          kicker entrance + the group exit so it never pops. */}
      <AbsoluteFill style={{
        opacity: kickerProg * groupOpacity,
        background: isLeft
          ? "radial-gradient(ellipse 60% 54% at 27% 74%, rgba(0,0,0,0.60) 0%, rgba(0,0,0,0.32) 44%, rgba(0,0,0,0) 70%)"
          : "radial-gradient(ellipse 72% 54% at 50% 70%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.26) 50%, rgba(0,0,0,0) 74%)",
      }} />
      <AbsoluteFill style={{
        display: "flex",
        flexDirection: "column",
        alignItems: isLeft ? "flex-start" : "center",
        justifyContent: adSafe ? "flex-end" : "flex-start",
        ...(adSafe ? { paddingBottom: adPadBottomCss } : { paddingTop: padTopCss }),
        paddingLeft: width * 0.06,
        paddingRight: width * 0.06,
      }}>
        <div style={{
          opacity: groupOpacity,
          transform: `scale(${groupScale})`,
          transformOrigin: isLeft ? "left top" : "center top",
          display: "flex",
          flexDirection: "column",
          alignItems: isLeft ? "flex-start" : "center",
          width: "100%",
        }}>
          {/* Optional brand logo(s) above the kicker — rounded-square white
              tiles with a lime hairline. Single via logo_path, multiple via
              logo_paths (lockup row). Fades in with the kicker. */}
          {(() => {
            const logos = (logo_paths && logo_paths.length > 0)
              ? logo_paths
              : (logo_path ? [logo_path] : []);
            if (logos.length === 0) return null;
            const tile = width * 0.14;
            const gap = width * 0.018;
            return (
              <div style={{
                display: "flex",
                gap,
                marginBottom: typeBase * 0.020,
                opacity: kickerProg,
                transform: `translateY(${interpolate(kickerProg, [0, 1], [-14, 0])}px)`,
                alignSelf: isLeft ? "flex-start" : "center",
              }}>
                {logos.map((lp, i) => (
                  <div key={i} style={{
                    width: tile, height: tile,
                    borderRadius: width * 0.025,
                    background: "#FFFFFF",
                    border: "3px solid #CFFF05",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.45), 0 0 22px rgba(207,255,5,0.30)",
                    padding: width * 0.012,
                    boxSizing: "border-box",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Img src={
                      lp.startsWith("http") || lp.startsWith("data:")
                        ? lp : staticFile(lp)
                    } style={{
                      width: "100%", height: "100%", objectFit: "contain",
                      display: "block",
                    }} />
                  </div>
                ))}
              </div>
            );
          })()}
          {/* Kicker */}
          <div style={{
            fontFamily: BLOCK_FONT_STACK,
            fontWeight: 800,
            fontSize: kickerSize,
            color: "#CFFF05",
            textTransform: "uppercase",
            letterSpacing: "0.22em",
            // optical: letter-spacing pads the right edge — nudge left when centered
            textIndent: isLeft ? "0" : "0.22em",
            opacity: kickerProg,
            transform: `translateY(${interpolate(kickerProg, [0, 1], [-14, 0])}px)`,
            textShadow,
            marginBottom: typeBase * 0.022,
            textAlign: isLeft ? "left" : "center",
          }}>
            {kicker}
          </div>

          {/* Accent rule — draws outward from center / from the left */}
          <div style={{
            width: ruleW,
            height: ruleH,
            backgroundColor: "#CFFF05",
            borderRadius: ruleH,
            transform: `scaleX(${ruleProg})`,
            transformOrigin: isLeft ? "left center" : "center",
            opacity: ruleProg,
            marginBottom: typeBase * 0.030,
            boxShadow: "0 2px 12px rgba(0,0,0,0.6)",
          }} />

          {/* Hero line */}
          <div style={{
            opacity: heroOpacity,
            transform: `scale(${heroScaleIn})`,
            transformOrigin: isLeft ? "left top" : "center top",
            filter: heroBlur > 0.15 ? `blur(${heroBlur}px)` : "none",
            textAlign: isLeft ? "left" : "center",
            width: "100%",
          }}>
            {lines.map((parts, li) => (
              <div key={li} style={{ textAlign: isLeft ? "left" : "center", lineHeight: 1.0 }}>
                {parts.map((part, pi) => {
                  if (part.kind === "script") {
                    const prev = pi > 0 ? parts[pi - 1] : null;
                    const next = pi < parts.length - 1 ? parts[pi + 1] : null;
                    return (
                      <span key={pi} style={{
                        fontFamily: SCRIPT_FONT_STACK,
                        fontWeight: 700,
                        fontSize: scriptHeroSize,
                        color: "#CFFF05",
                        fontStyle: "italic",
                        textShadow,
                        display: "inline",
                        paddingLeft: prev?.kind === "block" ? heroSize * 0.18 : 0,
                        paddingRight: next?.kind === "block" ? heroSize * 0.18 : 0,
                      }}>
                        {part.text}
                      </span>
                    );
                  }
                  return (
                    <span key={pi} style={{
                      fontFamily: BLOCK_FONT_STACK,
                      fontWeight: 900,
                      fontSize: heroSize,
                      color: "#FFFFFF",
                      letterSpacing: "-0.03em",
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
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

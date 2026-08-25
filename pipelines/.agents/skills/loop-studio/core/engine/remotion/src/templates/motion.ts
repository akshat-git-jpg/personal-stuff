import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Cinematic motion utilities. Used across templates to keep timing,
 * easing, and entrance feel consistent. The whole library shares this
 * vocabulary so a video edited with these templates feels choreographed,
 * not assembled.
 */

// Material standard ease — used for almost every entrance.
export const STANDARD_EASE = Easing.bezier(0.4, 0, 0.2, 1);

/**
 * Returns the dimension that typography should anchor on. In portrait (9:16)
 * this is `width`; in landscape (16:9) this is `height`. Without this, a
 * template authored at `width * 0.08` looks balanced in 9:16 but turns into
 * giant text that crowds the frame in 16:9 — because the wider canvas isn't
 * what the viewer reads against. Always use this for FONT SIZES; layout
 * dimensions (padding, gap, margin) keep using `width`/`height` so cards
 * grow proportionally with the frame.
 */
export const useTypeBase = (): number => {
  const { width, height } = useVideoConfig();
  return Math.min(width, height);
};
// Smooth slow-out for sustained motion (settle zoom, slow drifts).
export const SMOOTH_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

/**
 * Reveal text character-by-character starting at `startSec`.
 * Default cadence ~28 chars/sec which reads ~110 wpm — the sweet spot
 * for "I'm typing this out for you" without feeling slow.
 */
export const useTypewriter = (
  text: string,
  startSec: number,
  charsPerSecond: number = 28,
): string => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const startFrame = Math.round(startSec * fps);
  const t = Math.max(0, (frame - startFrame) / fps);
  const charsToShow = Math.min(text.length, Math.round(t * charsPerSecond));
  return text.slice(0, charsToShow);
};

/**
 * Slow ease-out from 1.0 → `peakScale` over `durationSec` starting at
 * `startSec`. Pair with an entrance: text springs in, then settle-zoom
 * keeps the frame alive without distracting.
 */
export const useSettleZoom = (
  startSec: number,
  durationSec: number = 1.6,
  peakScale: number = 1.025,
): number => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const startFrame = Math.round(startSec * fps);
  const dur = Math.round(durationSec * fps);
  const k = interpolate(frame, [startFrame, startFrame + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: SMOOTH_EASE,
  });
  return 1 + (peakScale - 1) * k;
};

/**
 * Standard fade+rise entrance. Fades in over `durSec` while drifting up
 * from `riseY` pixels.
 */
export const useFadeRise = (
  startSec: number,
  durSec: number = 0.5,
  riseY: number = 16,
): { opacity: number; ty: number } => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const startFrame = Math.round(startSec * fps);
  const dur = Math.round(durSec * fps);
  const k = interpolate(frame, [startFrame, startFrame + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: STANDARD_EASE,
  });
  return {
    opacity: k,
    ty: interpolate(k, [0, 1], [riseY, 0]),
  };
};

/**
 * Standard spring entrance scaled for cinematic feel — undershoots less
 * than a default spring (damping 18 vs the usual 14) so the bounce is
 * subtle, not bouncy.
 */
export const useSpringIn = (startSec: number, durSec: number = 0.55): number => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const startFrame = Math.round(startSec * fps);
  return spring({
    frame: frame - startFrame,
    fps,
    durationInFrames: Math.round(durSec * fps),
    config: { damping: 18, stiffness: 120, mass: 0.7 },
  });
};

/**
 * Smooth wipe progress 0→1 over a window. Good for filling bars,
 * drawing rails, and wipe transitions.
 */
export const useWipe = (startSec: number, durSec: number = 0.6): number => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const startFrame = Math.round(startSec * fps);
  const dur = Math.round(durSec * fps);
  return interpolate(frame, [startFrame, startFrame + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: SMOOTH_EASE,
  });
};

// ─────────────────────────────────────────────────────────────────────────
// Layer 0 — VO-synced kinetic typography infrastructure
//
// The whole "motion design" upgrade rests on four primitives that turn a
// static pop-up-and-freeze overlay into something choreographed to the voice:
//   1. word-by-word mask reveal synced to the spoken moment (useWordReveal)
//   2. emphasis isolation — a punch on the key words (useEmphasisPunch)
//   3. a living hold so the frame never freezes (useLivingHold)
//   4. a choreographed group exit (useChoreographedExit)
// Two locked easing curves give every motion the same "expensive" feel.
// ─────────────────────────────────────────────────────────────────────────

/** Expo-out: fast attack, long graceful settle. Every entrance speaks this. */
export const ENTRANCE_EASE = Easing.bezier(0.16, 1, 0.3, 1);
/** Expo-in: hangs, then snaps away. Every exit speaks this. */
export const EXIT_EASE = Easing.bezier(0.7, 0, 0.84, 0);

/**
 * Eased 0→1 progress for one word's reveal, synced to the moment it is
 * spoken. `localAppearSec` is RELATIVE to the current Sequence (frame 0 =
 * Sequence start). Pair with a mask-rise span in the component:
 *
 *   <span style={{ overflow:"hidden", display:"inline-block" }}>
 *     <span style={{ transform:`translateY(${(1-k)*100}%)`, opacity:k }}>
 *       {word}
 *     </span>
 *   </span>
 *
 * The inner span rises up from behind the clipped outer box — the classic
 * kinetic-type reveal, far more alive than a plain fade.
 */
export const useWordReveal = (
  localAppearSec: number,
  durSec: number = 0.42,
): number => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const startFrame = Math.round(localAppearSec * fps);
  const dur = Math.max(1, Math.round(durSec * fps));
  return interpolate(frame, [startFrame, startFrame + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ENTRANCE_EASE,
  });
};

/**
 * Scale punch for an emphasized word — a spring overshoot landing slightly
 * above 1.0 so the key word reads bigger than its neighbours. Combine with a
 * lime color in the component for full emphasis isolation. `localAppearSec`
 * is relative to the current Sequence.
 */
export const useEmphasisPunch = (
  localAppearSec: number,
  durSec: number = 0.55,
  rest: number = 1.06,
): number => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const s = spring({
    frame: frame - Math.round(localAppearSec * fps),
    fps,
    durationInFrames: Math.max(1, Math.round(durSec * fps)),
    config: { damping: 11, stiffness: 170, mass: 0.7 },
  });
  return interpolate(s, [0, 1], [0.9, rest]);
};

/**
 * A slow, continuous drift+scale applied to the whole statement so it is
 * never a frozen frame during its hold. Monotonic and tiny — the viewer
 * feels life, not motion. Frame 0 = Sequence start.
 */
export const useLivingHold = (
  durSec: number = 4,
  maxScale: number = 1.02,
  driftPx: number = -8,
): { scale: number; ty: number } => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const dur = Math.max(1, Math.round(durSec * fps));
  const k = interpolate(frame, [0, dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: SMOOTH_EASE,
  });
  return { scale: 1 + (maxScale - 1) * k, ty: driftPx * k };
};

/**
 * Choreographed group exit. Returns opacity / upward slide / blur / scale to
 * apply to the whole statement so it LEAVES with intention instead of cutting.
 * `exitStartSec` is relative to the current Sequence — usually
 * `durationInFrames / fps - durSec` so the exit lands exactly on the beat end.
 */
export const useChoreographedExit = (
  exitStartSec: number,
  durSec: number = 0.45,
): { opacity: number; ty: number; blur: number; scale: number } => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const startFrame = Math.round(exitStartSec * fps);
  const dur = Math.max(1, Math.round(durSec * fps));
  const p = interpolate(frame, [startFrame, startFrame + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EXIT_EASE,
  });
  // Dissolve-forward: the statement scales up a touch, blurs out and fades —
  // reads as "stepping through" the type, far more premium than a hard slide.
  return { opacity: 1 - p, ty: -p * 14, blur: p * 10, scale: 1 + p * 0.04 };
};

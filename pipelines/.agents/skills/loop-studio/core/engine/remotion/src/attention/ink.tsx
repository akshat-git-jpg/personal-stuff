/**
 * ink.tsx — the hand-drawn marker kit for the ATTENTION video.
 *
 * LIGHT treatment: Luuk is full-screen for the whole runtime and nothing ever covers him.
 * These are marginalia — wobbly white marker strokes that draw themselves on in the flat dark
 * wall to frame-left, one lime accent per sketch. Brand colours come from bb2/engine (which
 * reads core/brand/brand.json) — never hardcode a brand value here.
 */
import React from "react";
import { Sequence, interpolate, useCurrentFrame } from "remotion";
import { FPS, f, EASE, EASE_OVER, Boil, SANS, MONO, WHITE, SILVER, SILVER_MID, LIME } from "../bb2/engine";

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** local time in seconds inside the current <Sequence> */
export const useT = () => useCurrentFrame() / FPS;

/* ------------------------------------------------------------------ Ink */
/**
 * One marker stroke that draws itself on. Uses pathLength={1} so the dash maths is
 * independent of the real path length (no ref measuring, no SSR flicker).
 * `undraw` (optional) is the local time at which the stroke retracts again.
 */
export const Ink: React.FC<{
  d: string; at?: number; dur?: number; w?: number; color?: string;
  undraw?: number; undrawDur?: number; opacity?: number; dash?: string; cap?: "round" | "butt";
}> = ({ d, at = 0, dur = 0.55, w = 2.2, color = WHITE, undraw, undrawDur = 0.35, opacity = 1, dash, cap = "round" }) => {
  const t = useT();
  let p = interpolate(t, [at, at + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  if (undraw !== undefined) {
    p *= 1 - interpolate(t, [undraw, undraw + undrawDur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  }
  if (p <= 0.001) return null;
  return (
    <path
      d={d} pathLength={1} stroke={color} strokeWidth={w} fill="none"
      strokeLinecap={cap} strokeLinejoin="round" opacity={opacity}
      strokeDasharray={dash ?? 1} strokeDashoffset={dash ? 0 : 1 - p}
    />
  );
};

/** A filled marker blob (dots, solid figures) that pops in. */
export const Blob: React.FC<{ cx: number; cy: number; r: number; at?: number; color?: string; opacity?: number }> =
  ({ cx, cy, r, at = 0, color = WHITE, opacity = 1 }) => {
    const t = useT();
    const p = interpolate(t, [at, at + 0.22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OVER });
    if (p <= 0.001) return null;
    return <circle cx={cx} cy={cy} r={r * p} fill={color} opacity={opacity} />;
  };

/** Small hand-lettered numeral / unit. Only ever a real STAT value (Law 5) — never a spoken word. */
export const Num: React.FC<{ x: number; y: number; children: React.ReactNode; at?: number; size?: number; color?: string; anchor?: "middle" | "start" | "end" }> =
  ({ x, y, children, at = 0, size = 15, color = WHITE, anchor = "middle" }) => {
    const t = useT();
    const p = interpolate(t, [at, at + 0.2], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OVER });
    if (p <= 0.001) return null;
    return (
      <text x={x} y={y} fill={color} opacity={Math.min(1, p * 1.6)} textAnchor={anchor}
        style={{ fontFamily: MONO, fontSize: size, fontWeight: 600, letterSpacing: -0.4 }}>
        {children}
      </text>
    );
  };

/* ------------------------------------------------------------------ Beat */
export type Zone = "L" | "T";
const ZONES: Record<Zone, { left: number; top: number; w: number; h: number; vb: string }> = {
  // verified against a 70-frame temporal average of the source: flat dark wall for the whole runtime
  L: { left: 44, top: 168, w: 404, h: 404, vb: "0 0 200 200" },
  T: { left: 60, top: 38, w: 1800, h: 132, vb: "0 0 900 66" },
};

/**
 * One sketch moment. Fades in fast, holds, fades out gently — the drawing itself
 * carries the motion (Law 6: the OBJECT changes state on the word, not just opacity).
 */
export const Beat: React.FC<{ t: number; dur: number; zone?: Zone; id: string; amp?: number; rot?: number; children: React.ReactNode }> =
  ({ t, dur, zone = "L", id, amp = 1.1, rot = -1.2, children }) => {
    const z = ZONES[zone];
    return (
      <Sequence from={f(t)} durationInFrames={f(dur)} layout="none" name={id}>
        <BeatBody z={z} dur={dur} id={id} amp={amp} rot={rot}>{children}</BeatBody>
      </Sequence>
    );
  };

const BeatBody: React.FC<{ z: typeof ZONES["L"]; dur: number; id: string; amp: number; rot: number; children: React.ReactNode }> =
  ({ z, dur, id, amp, rot, children }) => {
    const t = useT();
    const op = Math.min(
      interpolate(t, [0, 0.28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE }),
      interpolate(t, [dur - 0.6, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE })
    );
    return (
      <div style={{ position: "absolute", left: z.left, top: z.top, width: z.w, height: z.h, opacity: op }}>
        <svg width="100%" height="100%" viewBox={z.vb} style={{ overflow: "visible", transform: `rotate(${rot}deg)` }}>
          <Boil id={id} amp={amp}>{children}</Boil>
        </svg>
      </div>
    );
  };

/* ------------------------------------------------------------------ captions */
type Card = { s: number; e: number; lines: string[] };

/**
 * Clean sentence captions (Luuk's choice, 2026-07-22): 1–2 lines, bottom-centre, the phrase
 * swaps in whole — no word-by-word pop. Legible over motion via a layered dark shadow.
 */
export const Captions: React.FC<{ cards: Card[] }> = ({ cards }) => {
  const t = useCurrentFrame() / FPS;
  const c = cards.find((k) => t >= k.s && t < k.e);
  if (!c) return null;
  const op = Math.min(clamp01((t - c.s) / 0.10), clamp01((c.e - t) / 0.12));
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 74, display: "flex",
      flexDirection: "column", alignItems: "center", gap: 4, opacity: op, pointerEvents: "none",
    }}>
      {c.lines.map((l, i) => (
        <div key={i} style={{
          fontFamily: SANS, fontWeight: 700, fontSize: 46, lineHeight: 1.18, color: WHITE,
          letterSpacing: -0.3, textAlign: "center", maxWidth: 1440,
          textShadow: "0 2px 12px rgba(0,0,0,.80), 0 0 4px rgba(0,0,0,.95), 0 1px 2px rgba(0,0,0,.9)",
        }}>{l}</div>
      ))}
    </div>
  );
};

export { WHITE, SILVER, SILVER_MID, LIME, MONO, SANS, f, FPS, interpolate, EASE, EASE_OVER };

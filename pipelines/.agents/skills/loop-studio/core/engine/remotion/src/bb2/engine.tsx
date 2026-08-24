/**
 * engine.tsx — Motion Grammar v2 engine (see knowledge/motion_grammar_v2.md).
 * Semantic world-camera with overshoot settle, ink boil, ambient loops, Kurzgesagt timing @30fps,
 * pop-ins, and a declarative SFX plan. All coordinates in page units (100 x 56.25 per screen).
 */
import React from "react";
import { Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import brandTokens from "../../../../brand/brand.json"; // SINGLE SOURCE OF TRUTH — edit core/brand/brand.json to re-skin every scene

export const FPS = 30;
export const f = (s: number) => Math.round(s * FPS);
// Kurzgesagt timing @30fps
export const MOVE = 25;  // default one-shot move
export const SNAP = 12;  // snappy
export const POP = 4;    // pop-ups
export const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);        // strong ease-out (brand)
export const EASE_OVER = Easing.bezier(0.25, 0.9, 0.3, 1.12); // overshoot settle
export const EASE_LOOP = Easing.bezier(0.4, 0, 0.6, 1);       // gentle for ambient only

// palette — DERIVED from the owner brand. core/brand/brand.json is the SINGLE SOURCE OF TRUTH:
// edit the colours there and every scene re-skins. Nothing here is a hardcoded brand value.
const _C = (brandTokens.colors ?? {}) as Record<string, string>;
const _HEX = /^#[0-9a-fA-F]{6}$/;
/** read a brand colour token with a safe fallback — a buyer's brand.json may be incomplete/malformed,
 *  and a bad value must never crash the render (it would become NaN in mix()). */
const C = (k: string, fallback: string) => (typeof _C[k] === "string" && _HEX.test(_C[k]) ? _C[k] : fallback);
/** mix two #rrggbb hexes, t in [0,1] */
const mix = (a: string, b: string, t: number) => {
  const rd = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const to = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${to(rd(a, 1), rd(b, 1))}${to(rd(a, 3), rd(b, 3))}${to(rd(a, 5), rd(b, 5))}`;
};

// identity tokens (brand values, each with a safe fallback). RAISIN/LIME/SILVER names kept for back-compat.
export const RAISIN = C("base", "#0F121A"), RAISIN_DEEP = C("base_elevated", "#1E2434"), STEEL = C("steel", "#343E5B");
export const SILVER = C("ink", "#E9ECED"), SILVER_SOFT = C("ink_soft", "#D2D8DA"), SILVER_MID = C("ink_mid", "#B5BFC2");
export const BODY = C("body", "#5A6068"), LIME = C("accent", "#CFFF05"), WHITE = "#FFFFFF", OLIVE = C("accent_on_light", "#7A9A00");
export const LIGHT_BG = C("light_bg", "#E9ECED");
// semantic aliases — PREFER these in new scenes (RAISIN/LIME are the legacy names).
export const ACCENT = LIME, BASE = RAISIN, BASE_DEEP = RAISIN_DEEP, INK = SILVER, ACCENT_ON_LIGHT = OLIVE;

// derived dark-UI grey ramp (BASE -> STEEL) — panels/borders harmonize with ANY brand base.
export const WELL         = mix(BASE, "#000000", 0.18); // deepest near-black surface (was #0d1017)
export const PANEL_DEEP   = mix(BASE, STEEL, 0.05);      // deep panel / file fill (was #12151d)
export const PANEL        = mix(BASE, STEEL, 0.20);      // frame cells / dark panel (was #161b26 / #181d2a)
export const PANEL_RAISED = mix(BASE, STEEL, 0.33);      // raised panel / photo bg / win (was #1b2030 / #20242e / #1d2230)
export const PANEL_HI     = mix(BASE, STEEL, 0.48);      // (was #232939)
export const CARD         = mix(BASE, STEEL, 0.66);      // card surface / panel border (was #2c3242 / #2a3145)
export const BORDER       = mix(BASE, STEEL, 0.95);      // borders / hairlines / marks (was #3a4256 / #39415a / #3a4152)
// derived light-register papers (LIGHT_BG -> white)
export const PAPER        = mix(LIGHT_BG, "#FFFFFF", 0.15); // photo paper / light card (was #e7eaec / #eef1f2)
export const PAPER_HI     = mix(LIGHT_BG, "#FFFFFF", 0.50); // brightest paper (was #f3f5f6)
export const PAPER_MID    = mix(LIGHT_BG, BODY, 0.14);      // muted paper (was #d5d9dd)

import { loadFont as loadSans } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadSerif } from "@remotion/google-fonts/PlayfairDisplay";
// Fresh-install fix: latin-only subset so cold-cache font loading clears the
// delayRender("fonts") timeout (bare loadFont() made hundreds of requests).
const FONT_OPT = { subsets: ["latin"], ignoreTooManyRequestsWarning: true } as const;
export const SANS = loadSans(undefined, FONT_OPT).fontFamily;
export const MONO = loadMono(undefined, FONT_OPT).fontFamily;
export const SERIF = loadSerif(undefined, FONT_OPT).fontFamily;

/* ---------------------------------------------------------------- camera */
export type CamKF = { t: number; x: number; y: number; z: number; over?: boolean };
/** Piecewise camera: each segment eases with overshoot (semantic settle). Returns world transform. */
export const useCamera = (kfs: CamKF[]) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;
  let x = kfs[0].x, y = kfs[0].y, z = kfs[0].z;
  for (let i = 1; i < kfs.length; i++) {
    const a = kfs[i - 1], b = kfs[i];
    if (frame < f(a.t)) break; // only segments we've reached may drive the camera
    const p = interpolate(frame, [f(a.t), f(b.t)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: b.over === false ? EASE : EASE_OVER });
    x = a.x + (b.x - a.x) * p; y = a.y + (b.y - a.y) * p; z = a.z + (b.z - a.z) * p;
  }
  return { transform: `translate(${W / 2 - x * u * z}px, ${H / 2 - y * u * z}px) scale(${z})`, u, z, camX: x, camY: y };
};

/* ---------------------------------------------------------------- ambient */
export const useAmbient = () => {
  const frame = useCurrentFrame();
  return {
    bob: (phase: number, amp = 0.4, period = 2.4) => Math.sin((frame / FPS / period + phase) * Math.PI * 2) * amp,
    drift: (phase: number, amp = 0.25, period = 3.7) => Math.cos((frame / FPS / period + phase) * Math.PI * 2) * amp,
    pulse: (phase: number, amp = 0.04, period = 2.0) => 1 + Math.sin((frame / FPS / period + phase) * Math.PI * 2) * amp,
  };
};

/* ---------------------------------------------------------------- ink boil */
/** Wrap hand-drawn SVG content; re-seeds displacement every 4 frames — traditional boil. */
export const Boil: React.FC<{ children: React.ReactNode; amp?: number; id: string }> = ({ children, amp = 1.6, id }) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 4) % 5;
  return (
    <>
      <defs>
        <filter id={`boil-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="1" seed={seed} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={amp} />
        </filter>
      </defs>
      <g filter={`url(#boil-${id})`}>{children}</g>
    </>
  );
};

/* ---------------------------------------------------------------- draw-on stroke */
export const Draw: React.FC<{ d: string; at: number; dur?: number; w: number; color?: string; len?: number; fillAfter?: string }> = ({ d, at, dur = MOVE / FPS, w, color = RAISIN, len = 300 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [f(at), f(at + dur)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  return <path d={d} stroke={color} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} />;
};

/* ---------------------------------------------------------------- pop-in */
export const usePop = (at: number, frames = POP) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [f(at), f(at) + frames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE_OVER });
  return { opacity: Math.min(1, p * 2), scale: 0.6 + 0.4 * p };
};

/* ---------------------------------------------------------------- SFX plan */
export type Sfx = { t: number; name: string; vol?: number };
export const SfxLayer: React.FC<{ plan: Sfx[] }> = ({ plan }) => (
  <>
    {plan.map((s, i) => (
      <Sequence key={i} from={f(s.t)} durationInFrames={f(2.2)}>
        <Audio src={staticFile(`sfx2/${s.name}`)} volume={s.vol ?? 0.5} />
      </Sequence>
    ))}
  </>
);

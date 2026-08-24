/**
 * BrandIntro — the personal-brand cold open, in the BUSINESS BRAIN visual language.
 * 3840x2160 @30, 64.234s. Reference: BusinessBrain_FULL_v26 (v7→v26 of feedback).
 *
 * WHY v5 IS ANOTHER REWRITE. v1-v3 were one world + a flying camera (overlaps, no dwell).
 * v4 corrected the overlap but invented a NEW editorial look and merely applied the brand colours —
 * which threw away the thing Loop Studio exists to protect. Luuk: "I thought you were going to use
 * Loop Studio with my own branding, my own way of working, and my own designs."
 * The look and the METHOD are the constant; only the CONCEPT is fresh. This file uses the canonical
 * bb2 system and nothing else: FootageLayer + the SK skeleton (the head is the spine, full → lime-
 * offset panel → hidden), HL + Marker (ONE lime word per beat), Eyebrow, DarkBg/LightBg registers.
 *
 * IT IS A SHOWCASE, so every enacted object is one of HIS REAL assets: the channel avatar, the three
 * real palette cards, the BuildLoop mark, eight shipped thumbnails, the live homepage, the real
 * revenue strip. Nothing is a placeholder and nothing is invented.
 */
import React from "react";
import { AbsoluteFill, Audio, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import {
  clamp01, EASE, EASE_OVER,
  RAISIN, SILVER, SILVER_MID, BODY, LIME, SANS, MONO,
  SK, skf, FootageLayer, Marker, DarkBg, LightBg,
} from "./bb2/scene";
import { SfxLayer, type Sfx } from "./bb2/engine";

const FPS = 30;
const A = (n: string) => staticFile(`brandintro/${n}`);
const SRC = "brandintro/head_4k.mp4";
export const BRAND_INTRO_FRAMES = Math.round(64.234 * FPS); // 1927

const f = (s: number) => Math.round(s * FPS);
const ip = (t: number, a: number, b: number, ease = EASE) =>
  interpolate(t, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
/** LAND, don't fade — the house body language: overshoot in 5 frames, settle. */
const win = (t: number, a: number, b: number, fade = 0.3) =>
  clamp01(Math.min((t - a) / fade, (b - t) / fade));
const land = (t: number, at: number) => ({
  p: ip(t, at, at + 0.22, EASE_OVER),
  flare: clamp01(1 - (t - at) / 0.10),
});

/* ---------------------------------------------------------------- house helpers (per the exemplar) */
const HL: React.FC<{ u: number; t: number; at: number; out?: number; ink: string; size?: number;
  top?: boolean; children: React.ReactNode }> = ({ u, t, at, out, ink, size = 2.9, top, children }) => (
  <div style={{
    position: "absolute", left: "50%", top: top ? "11%" : "88%", transform: "translate(-50%,-50%)",
    whiteSpace: "nowrap", textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: u * size,
    letterSpacing: "-0.02em", color: ink, textTransform: "uppercase",
    textShadow: ink === RAISIN ? "none" : "0 2px 18px rgba(0,0,0,0.55)",
    opacity: clamp01((t - at) / 0.4) * (out ? 1 - clamp01((t - out) / 0.4) : 1),
  }}>{children}</div>
);

const Eyebrow: React.FC<{ u: number; t: number; at: number; ink: string; out?: number;
  x?: string; y?: string; children: React.ReactNode }> =
({ u, t, at, ink, out, x = "6%", y = "8.5%", children }) => (
  <div style={{
    position: "absolute", left: x, top: y, display: "flex", alignItems: "center", gap: u * 0.6,
    opacity: clamp01((t - at) / 0.35) * (out ? 1 - clamp01((t - out) / 0.35) : 1),
    fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.22em",
    color: ink === RAISIN ? BODY : SILVER_MID,
  }}>
    <span style={{ width: u * 0.75, height: u * 0.75, background: LIME }} />{children}
  </div>
);

/** A real asset on the house lime hard-offset card. The showcase unit. */
const Asset: React.FC<{ x: number; y: number; u: number; w: number; ar: number; src: string;
  t: number; at: number; out?: number; rot?: number; grey?: number; dim?: number; scale?: number }> =
({ x, y, u, w, ar, src, t, at, out, rot = 0, grey = 0, dim = 0, scale = 1 }) => {
  const { p, flare } = land(t, at);
  const outP = out ? 1 - clamp01((t - out) / 0.2) : 1;
  if (p <= 0.001 || outP <= 0.001) return null;
  const W = u * w, H = W / ar;
  return (
    <div style={{
      position: "absolute", left: x + "%", top: y + "%",
      transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${(0.94 + 0.06 * p) * scale})`,
      opacity: p * (1 - dim) * outP,
    }}>
      <div style={{ position: "absolute", inset: 0, background: LIME, borderRadius: u * 0.5, transform: `translate(${u * 0.35}px,${u * 0.35}px)`, opacity: 0.9 }} />
      <div style={{
        position: "relative", width: W, height: H, overflow: "hidden", borderRadius: u * 0.5,
        border: `${u * 0.1}px solid ${flare > 0.02 ? LIME : SILVER_MID}`,
        boxShadow: `0 ${u * 0.45}px ${u * 1.2}px rgba(0,0,0,0.45)`,
      }}>
        <Img src={A(src)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: grey ? `saturate(${1 - grey})` : undefined }} />
      </div>
    </div>
  );
};

/** burned caption — the house lower-third, lime on the load-bearing word */
const Cap: React.FC<{ u: number; t: number; at: number; out: number; ink: string;
  pre: string; hot: string; post?: string; y?: string }> = ({ u, t, at, out, ink, pre, hot, post = "", y = "79%" }) => {
  const o = clamp01((t - at) / 0.18) * (1 - clamp01((t - out) / 0.18));
  if (o <= 0.01) return null;
  return (
    <div style={{
      position: "absolute", left: "50%", top: y, transform: "translate(-50%,-50%)",
      fontFamily: SANS, fontWeight: 700, fontSize: u * 1.62, letterSpacing: "-0.01em",
      color: ink, opacity: o, whiteSpace: "nowrap",
      textShadow: ink === RAISIN ? "none" : "0 2px 14px rgba(0,0,0,0.8)",
    }}>
      {pre}<span style={{ color: LIME }}>{hot}</span>{post}
    </div>
  );
};


/** ONE clean brand piece on the house lime card, tuned for the LIGHT register (brighter offset). */
const LightCard: React.FC<{ x: number; y: number; u: number; w: number; ar: number; src: string;
  t: number; at: number; out?: number }> = ({ x, y, u, w, ar, src, t, at, out }) => {
  const { p, flare } = land(t, at);
  const outP = out ? 1 - clamp01((t - out) / 0.2) : 1;
  if (p <= 0.001 || outP <= 0.001) return null;
  const W = u * w, H = W / ar;
  return (
    <div style={{ position: "absolute", left: x + "%", top: y + "%",
      transform: `translate(-50%,-50%) scale(${0.94 + 0.06 * p})`, opacity: p * outP }}>
      <div style={{ position: "absolute", inset: 0, background: ACCENT, borderRadius: u * 0.5, transform: `translate(${u * 0.35}px,${u * 0.35}px)` }} />
      <div style={{ position: "relative", width: W, height: H, overflow: "hidden", borderRadius: u * 0.5,
        border: `${u * 0.1}px solid ${flare > 0.02 ? ACCENT : RAISIN}`, boxShadow: `0 ${u * 0.45}px ${u * 1.2}px rgba(15,18,26,0.18)` }}>
        <Img src={A(src)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    </div>
  );
};

/** A deliberately AMATEUR brand — clashing colours, garish borders, a stretched hue-shifted photo,
 *  mismatched sizes and angles, intentionally messy. The visual argument for "random = amateur". */
const AmateurBoard: React.FC<{ u: number; t: number; at: number }> = ({ u, t, at }) => {
  const p = ip(t, at, at + 0.35);
  if (p <= 0.01) return null;
  const clash = ["#E4002B", "#7B2FF7", "#FF7A00", "#00C2D1", "#FF00A8", "#22C55E"];
  return (
    <div style={{ opacity: p }}>
      {clash.map((c, i) => (
        <div key={c} style={{ position: "absolute", left: `${16 + i * 8.5}%`, top: `${34 + (i % 3) * 12}%`,
          transform: `translate(-50%,-50%) rotate(${(i % 2 ? 1 : -1) * (5 + i * 3)}deg)`,
          width: u * (5 + (i % 3) * 1.4), height: u * (7 - (i % 2) * 2), background: c,
          border: `${u * 0.25}px solid ${i % 2 ? "#000" : "#fff"}` }} />
      ))}
      {/* a bad, generic "profile picture" — a stretched clip-art silhouette in a garish frame (no real person) */}
      <div style={{ position: "absolute", left: "64%", top: "42%", transform: "translate(-50%,-50%) rotate(7deg)",
        width: u * 15, height: u * 15, overflow: "hidden", border: `${u * 0.35}px solid #FF00A8`,
        boxShadow: `0 0 ${u}px #7B2FF7`, background: "radial-gradient(circle at 50% 35%, #00C2D1, #7B2FF7)" }}>
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
          <circle cx="50" cy="38" r="20" fill="#FFD400" />
          <path d="M15 92 Q50 55 85 92 Z" fill="#FFD400" />
        </svg>
      </div>
      {/* clashing garish wordmark */}
      <div style={{ position: "absolute", left: "48%", top: "72%", transform: "translate(-50%,-50%) rotate(-4deg)",
        fontFamily: SANS, fontStyle: "italic", fontWeight: 800, fontSize: u * 3.4, color: "#FFD400",
        textShadow: `${u*0.12}px ${u*0.12}px 0 #E4002B, -${u*0.1}px -${u*0.1}px 0 #00C2D1`, letterSpacing: "0.08em" }}>MY-BRAND!!</div>
    </div>
  );
};

const ACCENT = LIME;
const ACCENT_ON_LIGHT = "#7A9A00";
const THUMBS = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `thumb_${i}.png`);

/** An example BRAND BOOK — logo, positioning, type, palette, profile — assembled clean on a light
 *  page in its OWN (different) colour scheme. The "what you'll build" payoff, SaaS-commercial style. */
const BrandBookBoard: React.FC<{ u: number; t: number; at: number }> = ({ u, t, at }) => {
  const ACC = "#6C5CE7", DK = "#20223A", PAPER = "#FFFFFF";   // a DIFFERENT scheme (violet/navy)
  const row = (i: number) => land(t, at + i * 0.12);
  const Panel: React.FC<{ x: number; y: number; w: number; h: number; i: number; children?: React.ReactNode; bg?: string }> =
    ({ x, y, w, h, i, children, bg = PAPER }) => {
      const { p } = row(i); if (p <= 0.01) return null;
      return <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`,
        transform: `translateY(${(1 - p) * u * 1.2}px)`, opacity: p, background: bg, borderRadius: u * 0.9,
        border: `${u * 0.06}px solid rgba(32,34,58,.12)`, boxShadow: `0 ${u * 0.6}px ${u * 1.6}px rgba(32,34,58,.10)`,
        overflow: "hidden", boxSizing: "border-box" }}>{children}</div>;
    };
  return (
    <>
      {/* logo lockup */}
      <Panel x={17} y={26} w={30} h={20} i={0} bg={DK}>
        <div style={{ display: "flex", alignItems: "center", gap: u * 1, height: "100%", padding: `0 ${u * 1.6}px` }}>
          <div style={{ width: u * 3, height: u * 3, borderRadius: u * 0.6, background: ACC, transform: "rotate(45deg)" }} />
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.1, color: "#fff", letterSpacing: "-0.02em" }}>northwind</div>
        </div>
      </Panel>
      {/* positioning */}
      <Panel x={17} y={48} w={30} h={26} i={1}>
        <div style={{ padding: u * 1.4 }}>
          <div style={{ fontFamily: MONO, fontSize: u * 0.95, letterSpacing: "0.2em", color: ACC, fontWeight: 700 }}>POSITIONING</div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 1.5, color: DK, marginTop: u * 0.6, lineHeight: 1.2 }}>Calm software for people who hate software.</div>
        </div>
      </Panel>
      {/* type */}
      <Panel x={49} y={26} w={20} h={26} i={2}>
        <div style={{ padding: u * 1.4 }}>
          <div style={{ fontFamily: MONO, fontSize: u * 0.95, letterSpacing: "0.2em", color: ACC, fontWeight: 700 }}>TYPE</div>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 4.6, color: DK, lineHeight: 1 }}>Aa</div>
          <div style={{ fontFamily: SANS, fontSize: u * 1, color: "#6b6f86" }}>Space Grotesk</div>
        </div>
      </Panel>
      {/* palette — the different scheme */}
      <Panel x={49} y={54} w={20} h={20} i={3}>
        <div style={{ display: "flex", height: "100%" }}>
          {[ACC, DK, "#B7B2F0", "#EEF0FF"].map((c) => <div key={c} style={{ flex: 1, background: c }} />)}
        </div>
      </Panel>
      {/* profile picture */}
      <Panel x={71} y={26} w={12} h={20} i={4} bg={ACC}>
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
          <circle cx="50" cy="40" r="20" fill="#EEF0FF" /><path d="M18 92 Q50 58 82 92 Z" fill="#EEF0FF" />
        </svg>
      </Panel>
      {/* a sample post using it all */}
      <Panel x={71} y={48} w={12} h={26} i={5} bg={DK}>
        <div style={{ padding: u * 1 }}>
          <div style={{ width: u * 1.6, height: u * 1.6, borderRadius: u * 0.4, background: ACC, transform: "rotate(45deg)" }} />
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.15, color: "#fff", marginTop: u * 1.2, lineHeight: 1.15 }}>Ship less. Mean more.</div>
        </div>
      </Panel>
    </>
  );
};

/** Construction grid — the base a designer starts a brand book on. Draws in, then fades to a
 *  faint guide once the brand is built on top of it. */
const BuildGrid: React.FC<{ u: number; t: number; a: number; hold: number }> = ({ u, t, a, hold }) => {
  const draw = ip(t, a, a + 0.9);
  const fade = 1 - ip(t, hold, hold + 0.8);   // fade FULLY out — no lingering grid
  const N = 12;
  return (
    <svg viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: draw * fade }}>
      {Array.from({ length: N + 1 }).map((_, i) => {
        const x = 120 + i * (1680 / N);
        return <line key={`v${i}`} x1={x} y1={90} x2={x} y2={990} stroke={LIME} strokeOpacity={0.14}
          strokeWidth={1} strokeDasharray={900} strokeDashoffset={900 * (1 - clamp01(draw * 1.4 - i * 0.04))} />;
      })}
      {Array.from({ length: 7 }).map((_, i) => {
        const y = 90 + i * 150;
        return <line key={`h${i}`} x1={120} y1={y} x2={1800} y2={y} stroke={LIME} strokeOpacity={0.14}
          strokeWidth={1} strokeDasharray={1680} strokeDashoffset={1680 * (1 - clamp01(draw * 1.4 - i * 0.05))} />;
      })}
    </svg>
  );
};

/* ================================================================= */
export const BrandIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W } = useVideoConfig();
  const u = W / 100;
  const t = frame / FPS;

  /* THE SPINE — the head is present throughout, docking to the lime-offset panel when a graphic
     needs the frame and hiding only when a hero genuinely owns it. This is the thing v4 was missing. */
  const SKF: SK[] = [
    { t: 0.0,  x: 50, y: 50, s: 1,    dim: 0,    fr: 0 },   // HOOK: full-bleed face
    { t: 0.7,  x: 50, y: 50, s: 1,    dim: 0,    fr: 0 },   // a beat full-bleed on the face
    { t: 1.2,  x: 73, y: 53, s: 0.94, dim: 0.06, fr: 1 },   // dock RIGHT fast — the brand BUILDS beside him
    { t: 7.3,  x: 73, y: 53, s: 0.94, dim: 0.06, fr: 1 },
    { t: 7.9,  x: 73, y: 53, s: 0.94, dim: 1,    fr: 1 },   // fade OUT in place (never slide to centre)
    { t: 11.3, x: 73, y: 53, s: 0.94, dim: 1,    fr: 1 },
    { t: 11.4, x: 27, y: 53, s: 0.94, dim: 1,    fr: 1 },   // reposition while HIDDEN
    { t: 11.8, x: 27, y: 53, s: 0.94, dim: 0.06, fr: 1 },   // fade IN at the left panel
    { t: 19.58,x: 27, y: 53, s: 0.94, dim: 0.06, fr: 1 },   // hold, then fade out IN LOCKSTEP with the brother
    { t: 19.78,x: 27, y: 53, s: 0.94, dim: 1,    fr: 1 },
    { t: 25.10,x: 73, y: 53, s: 0.94, dim: 1,    fr: 1 },   // still hidden at the boundary
    { t: 25.45,x: 73, y: 53, s: 0.94, dim: 0.06, fr: 1 },   // fade in AFTER the cut, alone
    { t: 30.4, x: 73, y: 53, s: 0.94, dim: 0.06, fr: 1 },
    { t: 31.0, x: 73, y: 53, s: 0.94, dim: 1,    fr: 1 },   // fade out in place
    { t: 35.3, x: 50, y: 50, s: 1,    dim: 1,    fr: 0 },   // prep full-bleed while hidden
    { t: 35.8, x: 50, y: 50, s: 1,    dim: 0,    fr: 0 },   // BECAUSE YOU ARE — full-bleed
    { t: 42.0, x: 50, y: 50, s: 1,    dim: 0,    fr: 0 },
    { t: 42.6, x: 73, y: 53, s: 0.94, dim: 0.06, fr: 1 },   // full -> right panel (a real house move)
    { t: 46.7, x: 73, y: 53, s: 0.94, dim: 0.06, fr: 1 },
    { t: 47.3, x: 73, y: 53, s: 0.94, dim: 1,    fr: 1 },   // fade out in place
    { t: 56.4, x: 73, y: 53, s: 0.94, dim: 1,    fr: 1 },
    { t: 56.7, x: 27, y: 53, s: 0.94, dim: 1,    fr: 1 },   // reposition while hidden
    { t: 56.9, x: 27, y: 53, s: 0.94, dim: 0.06, fr: 1 },   // fade in at the left panel — he talks
    { t: 58.7, x: 27, y: 53, s: 0.94, dim: 0.06, fr: 1 },
    { t: 59.2, x: 27, y: 53, s: 0.94, dim: 1,    fr: 1 },   // fade out in place — the finished brand owns it
    { t: 63.94,x: 27, y: 53, s: 0.94, dim: 1,    fr: 1 },
    ];
  const sk = skf(SKF, frame);

  /* one cue per real state change — arrivals, the demotion, the register flips, the snap */
  const SFX: Sfx[] = [
    { t: 0.10, name: "es_swipe.wav", vol: 0.14 },   // the grid draws — the base
    { t: 0.35, name: "es_impact.wav", vol: 0.22 },  // the mark STAMPS
    { t: 2.15, name: "es_select.wav", vol: 0.16 },  // palette rises
    { t: 2.29, name: "es_select.wav", vol: 0.13 },
    { t: 2.43, name: "es_select.wav", vol: 0.11 },
    { t: 3.55, name: "card-pop.wav", vol: 0.16 },   // the work populates
    { t: 3.77, name: "card-pop.wav", vol: 0.14 },
    { t: 6.75, name: "flare-hit.mp3", vol: 0.20 },  // Marker: SYSTEM
    { t: 8.15, name: "es_success.wav", vol: 0.20 }, // the board snaps together
    { t: 10.20, name: "flare-hit.mp3", vol: 0.18 }, // Marker: HIGGSFIELD
    { t: 13.40, name: "es_blip.wav", vol: 0.20 },   // the brother lands
    { t: 19.85, name: "drone_low.wav", vol: 0.15 }, // the mark, alone
    { t: 23.40, name: "es_impact.wav", vol: 0.26 }, // demoted on "logo"
    { t: 29.85, name: "es_ping.wav", vol: 0.22 },   // RECOGNITION
    { t: 33.30, name: "es_ticks.wav", vol: 0.17 }, // the commodity wall floods
    { t: 44.40, name: "es_select.wav", vol: 0.18 }, // the judging bracket snaps
    { t: 51.40, name: "es_success.wav", vol: 0.18 }, // the MATCH tick
    { t: 35.66, name: "boom_sub.wav", vol: 0.26 },  // BECAUSE YOU ARE
    { t: 47.35, name: "es_select.wav", vol: 0.13 }, // flip to light
    { t: 52.75, name: "es_impact.wav", vol: 0.20 }, // it doesn't
    { t: 59.15, name: "card-pop.wav", vol: 0.20 },  // the kit rebuilds
    { t: 61.20, name: "flare-hit.mp3", vol: 0.20 }, // Marker: PURPOSE
  ];

  // registers — dark = the claim/tension, light = the resolution
  const lightP = clamp01((t - 46.9) / 0.4);  // flips to light at "belongs together" and STAYS light to the end
  const ink = lightP > 0.5 ? RAISIN : SILVER;

  return (
    <AbsoluteFill style={{ background: RAISIN, overflow: "hidden" }}>
      {/* AUDIO — one continuous bed kept well under the VO, plus subtle word-synced SFX that are
          present-but-never-noticed. Registers get their own weight: a low drone under the dark act,
          the bed opening up on the flip to light. */}
      <Audio src={A("vo.m4a")} />
      <Audio src={staticFile("music/brand_intro_bed.wav")} volume={0.34} />
      <SfxLayer plan={SFX} />
      <DarkBg u={u} />
      {/* the brand-book construction grid — BACKGROUND ONLY, behind the head (never over it) */}
      {t < 8 && <BuildGrid u={u} t={t} a={0.10} hold={5.6} />}
      {/* per-act backdrop texture so the dark register never reads flat/samey (id 41acd1fe) */}
      {(() => {
        const acts: [number, number, string][] = [
          [0, 19.7, "brand/bg_9.jpg"], [19.7, 35.5, "brand/bg_5.jpg"], [35.5, 46.7, "brand/bg_luuk.jpg"],
        ];
        return acts.map(([a, b, src], i) => {
          const o = win(t, a, b, 0.6) * 0.10;
          return o < 0.005 ? null : <Img key={i} src={A(src)} style={{ position: "absolute", inset: 0,
            width: "100%", height: "100%", objectFit: "cover", opacity: o, filter: "brightness(0.5) saturate(0.7)" }} />;
        });
      })()}
      <AbsoluteFill style={{ opacity: lightP }}><LightBg u={u} /></AbsoluteFill>

      {/* THE HEAD, composited into the world — behind the graphics, present nearly throughout */}
      <FootageLayer sk={sk} u={u} src={SRC} />

      {/* ---------- B1 0.0–7.5 · THE BRAND BUILDS (cumulative, catchy) ----------
           The head docks RIGHT almost immediately and his real brand ACCUMULATES beside him — the
           avatar, then the palette, then his biggest thumbnails — each landing in its own tidy slot,
           so the screen keeps filling (the hook) but nothing ever overlaps the footage or itself. */}
      {t < 7.6 && (
        <>
          <BuildGrid u={u} t={t} a={0.15} hold={5.8} />
          {/* my face */}
          <Asset x={13} y={29} u={u} w={16} ar={1} src="avatar.png" t={t} at={1.15} />
          {/* my colours — three real palette cards, tidy row under the avatar */}
          {["brand/swatch_raisin.png", "brand/swatch_silver.png", "brand/swatch_lime.png"].map((sw, i) => (
            <Asset key={sw} x={6 + i * 7} y={58} u={u} w={6} ar={0.435} src={sw} t={t} at={1.5 + i * 0.12} />
          ))}
          {/* everything I post — three BIGGER thumbnails, clean right column, clear of the panel */}
          {THUMBS.slice(0, 3).map((sw, i) => (
            <Asset key={sw} x={38} y={20 + i * 22.5} u={u} w={17} ar={16 / 9} src={sw} t={t} at={1.95 + i * 0.32} />
          ))}
          <Cap u={u} t={t} at={2.10} out={4.80} ink={ink} y="82%" pre="my face, my " hot="colors" post=", everything I post" />
          <Cap u={u} t={t} at={5.05} out={6.35} ink={ink} pre="and it's also how I make my " hot="living" />
          <HL u={u} t={t} at={6.50} out={7.45} ink={ink} size={2.9}>
            ONE <Marker u={u} t={t} at={6.80} base={ink}>SYSTEM</Marker>
          </HL>
        </>
      )}

      {/* ---------- B2 7.6–11.4 · BUILT WITH ONE SKILL ----------
           The head is hidden, so the frame is clean. ONE idea: the finished brand, centred as a tidy
           board — mark + palette on the left, the work as a 2x2 on the right, balanced, generous. */}
      {t >= 7.6 && t < 11.5 && (
        <>
          {(() => { const o = ip(t, 7.75, 8.05); return (
            <div style={{ position: "absolute", left: "24%", top: "34%", transform: "translate(-50%,-50%)", width: u * 8, height: u * 13.3, opacity: o }}>
              <Img src={A("brand/bl_mark_lime.png")} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>); })()}
          {["brand/swatch_raisin.png", "brand/swatch_silver.png", "brand/swatch_lime.png"].map((sw, i) => (
            <Asset key={sw} x={17 + i * 7} y={64} u={u} w={6.4} ar={0.435} src={sw} t={t} at={8.2 + i * 0.1} />
          ))}
          {THUMBS.slice(0, 4).map((sw, i) => (
            <Asset key={sw} x={58 + (i % 2) * 17} y={38 + Math.floor(i / 2) * 17} u={u} w={15} ar={16 / 9}
                   src={sw} t={t} at={8.55 + i * 0.1} />
          ))}
          <HL u={u} t={t} at={9.7} ink={ink} size={2.7}>
            BUILT WITH <Marker u={u} t={t} at={10.2} base={ink}>HIGGSFIELD</Marker>
          </HL>
        </>
      )}

      {/* ---------- B3 11.5–19.7 · THE PROMISE (the brother's slot opens) ---------- */}
      {t >= 11.5 && t < 19.8 && (
        <>
          {/* the brother — his REAL, raw photo lands in the slot on "little brother" */}
          <Asset x={60} y={53} u={u} w={21.2} ar={1} src="nout_real.png" t={t} at={13.2} out={19.78} />
          {/* his name to the RIGHT of the photo, arrow pointing LEFT into it — all centred on y53 */}
          {(() => {
            const a = ip(t, 14.0, 14.4, EASE_OVER), nm = ip(t, 14.2, 14.6);
            return (<>
              <div style={{ position: "absolute", left: "74%", top: "53%", transform: "translateY(-50%)",
                width: u * 7, height: u * 0.28, background: LIME, opacity: a, transformOrigin: "right center", scale: `${a} 1` }}>
                <div style={{ position: "absolute", left: -u * 0.1, top: -u * 0.55, width: 0, height: 0,
                  borderRight: `${u * 1.1}px solid ${LIME}`, borderTop: `${u * 0.65}px solid transparent`, borderBottom: `${u * 0.65}px solid transparent` }} />
              </div>
              <div style={{ position: "absolute", left: "89%", top: "53%", transform: "translate(-50%,-50%)", textAlign: "center", opacity: nm, whiteSpace: "nowrap" }}>
                <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.7, color: ink, letterSpacing: "-0.01em" }}>NOUT ALLEMAN</div>
                <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, letterSpacing: "0.16em", color: LIME, marginTop: u * 0.4 }}>19 · STUDENT AI</div>
              </div>
            </>);
          })()}
          <Cap u={u} t={t} at={11.6} out={13.9} ink={ink} pre="building the whole personal brand of my " hot="little brother" post=" live" />
          <HL u={u} t={t} at={16.6} ink={ink} size={2.9}>
            YOU LEAVE WITH THE <Marker u={u} t={t} at={17.4} base={ink}>SYSTEM</Marker>
          </HL>
        </>
      )}

      {/* ---------- B4 19.8–25.0 · NOT JUST YOUR LOGO ----------
           ENACTED: the mark doesn't merely shrink — on "logo" it collapses to a chip, and on
           "goes way further" his REAL brand floods in as a ring around it, so the logo is visibly
           demoted to one small piece of a much larger system. The idea does itself. */}
      {t >= 19.8 && t < 25.1 && (() => {
        const dem = ip(t, 23.40, 24.10);
        const b4out = 1 - clamp01((t - 24.85) / 0.2);                 // the demotion, on "logo"
        const ring = ip(t, 24.00, 24.90, EASE_OVER);     // the flood, on "goes way further"
        const RING: [string, number, number, number][] = [
          ["avatar.png", 26, 30, 12], ["thumb_1.png", 72, 27, 15], ["brand/swatch_lime.png", 16, 62, 5.5],
          ["thumb_4.png", 78, 66, 15], ["thumb_2.png", 50, 73, 15], ["thumb_6.png", 30, 74, 13],
        ];
        return (
          <>
            {RING.map(([src, x, y, w], i) => {
              const o = ring * clamp01((ring - i * 0.06) * 3);
              if (o <= 0.01) return null;
              const cx = 50 + (x - 50) * (0.42 + 0.58 * ring), cy = 46 + (y - 46) * (0.42 + 0.58 * ring);
              return <Asset key={src} x={cx} y={cy} u={u} w={w as number} ar={src.includes("swatch") ? 0.435 : src.includes("avatar") ? 1 : 16/9}
                            src={src} t={t} at={24.0 + i * 0.05} dim={1 - o} out={24.85} />;
            })}
            {/* THE MARK — one instance, scaling in place from hero to chip */}
            <div style={{
              position: "absolute", left: "50%", top: "46%",
              transform: `translate(-50%,-50%) scale(${1 - dem * 0.82})`,
              width: u * 17, height: u * 28.3, opacity: b4out,
            }}>
              <Img src={A("brand/bl_mark_lime.png")} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <HL u={u} t={t} at={21.0} out={23.9} ink={ink} size={2.9}>
              NOT JUST A <Marker u={u} t={t} at={23.4} base={ink}>LOGO</Marker>
            </HL>
            <HL u={u} t={t} at={24.15} ink={ink} size={2.9} top>
              IT GOES <Marker u={u} t={t} at={24.45} base={ink}>WAY FURTHER</Marker>
            </HL>
          </>
        );
      })()}

      {/* ---------- B5 25.1–30.5 · PERCEPTION (the avatar, and the three questions) ---------- */}
      {t >= 25.1 && t < 30.6 && (
        <>
          <Asset x={22} y={50} u={u} w={17} ar={1} src="avatar.png" t={t} at={25.6} out={30.35} />
          {[["TRUST", 27.85], ["LIKING", 28.85], ["RECOGNITION", 29.85]].map(([w, at], i) => (
            <div key={w as string} style={{
              position: "absolute", left: "37%", top: `${41 + i * 9}%`, transform: "translateY(-50%)",
              fontFamily: SANS, fontWeight: 800, fontSize: u * 1.9, letterSpacing: "-0.02em",
              textTransform: "uppercase", color: i === 2 ? LIME : ink,
              opacity: ip(t, at as number, (at as number) + 0.22),
            }}>{w}</div>
          ))}
        </>
      )}

      {/* ---------- B6 30.6–35.4 · CONTENT IS A COMMODITY ----------
           ONE unified grid, no overlapping layers. His 8 real thumbnails ARE the centre cells (in
           colour); on "isn't" the whole grid greys uniformly and the surrounding cells fill in with
           duplicates — everyone's content, identical (id 7d387247). */}
      {t >= 30.6 && t < 35.5 && (() => {
        const COLS = 8, ROWS = 4;
        const grey = ip(t, 33.30, 33.90);
        const fill = ip(t, 33.30, 34.60, EASE_OVER);
        const cw = 9.2, ch = cw, gx = 0.7, gy = 1.2;      // 16:9 cell => ch% == cw% in a 16:9 frame
        const totalW = COLS * cw + (COLS - 1) * gx, totalH = ROWS * ch + (ROWS - 1) * gy;
        const x0 = 50 - totalW / 2, y0 = 50 - totalH / 2;
        // the 8 real thumbnails occupy the middle two rows, centred four-per-row
        const realCell = (i: number) => {
          const r = 1 + Math.floor(i / 4), c = 2 + (i % 4);
          return r * COLS + c;
        };
        const realMap: Record<number, number> = {};
        THUMBS.forEach((_, i) => { realMap[realCell(i)] = i; });
        return (
          <>
            {Array.from({ length: COLS * ROWS }).map((_, cell) => {
              const c = cell % COLS, r = Math.floor(cell / COLS);
              const isReal = cell in realMap;
              // real cells present from the start; commodity cells fill in on "isn't"
              const ringDist = Math.abs(c - (COLS - 1) / 2) + Math.abs(r - (ROWS - 1) / 2);
              const on = isReal ? land(t, 30.65 + (realMap[cell]) * 0.06).p
                                : clamp01(fill * 1.6 - ringDist * 0.12);
              if (on < 0.02) return null;
              const src = THUMBS[isReal ? realMap[cell] : (cell % 8)];
              const g = isReal ? grey : 1;                 // real ones greyscale on cue; fillers born grey
              return (
                <div key={cell} style={{
                  position: "absolute", left: `${x0 + c * (cw + gx)}%`, top: `${y0 + r * (ch + gy)}%`,
                  width: `${cw}%`, height: `${ch}%`, overflow: "hidden", borderRadius: u * 0.9,
                  opacity: on * (isReal ? 1 : 0.55),
                  border: `${u * 0.06}px solid ${g > 0.5 ? "rgba(181,191,194,.15)" : SILVER_MID}`,
                }}>
                  <Img src={A(src)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: `saturate(${1 - g})` }} />
                </div>
              );
            })}
            <HL u={u} t={t} at={33.9} ink={ink} size={2.9}>
              CONTENT ISN&apos;T THE <Marker u={u} t={t} at={34.3} base={ink}>MOAT</Marker>
            </HL>
          </>
        );
      })()}

      {/* ---------- B7 35.5–42.0 · BECAUSE YOU ARE (full bleed, the emotional centre) ---------- */}
      {t >= 35.5 && t < 42.1 && (
        <>
          <HL u={u} t={t} at={35.8} out={36.8} ink={SILVER} size={3.4}>
            BECAUSE <Marker u={u} t={t} at={36.0} base={SILVER}>YOU</Marker> ARE
          </HL>
          {/* keep him full-bleed; the three things he IS pop as lime chips along the lower third */}
          {[["YOUR FACE", 37.05], ["YOUR TASTE", 38.10], ["YOUR BELIEFS", 40.30]].map(([w, at], i) => {
            const a = ip(t, at as number, (at as number) + 0.28, EASE_OVER) * (1 - clamp01((t - 41.9) / 0.3));
            if (a <= 0.01) return null;
            return <div key={w as string} style={{
              position: "absolute", left: `${26 + i * 24}%`, top: "76%", transform: `translate(-50%,-50%) scale(${0.9 + 0.1 * a})`,
              background: LIME, color: RAISIN, fontFamily: SANS, fontWeight: 800, fontSize: u * 1.5,
              letterSpacing: "0.01em", padding: `${u * 0.5}px ${u * 1.1}px`, borderRadius: u * 0.4, opacity: a,
              boxShadow: `0 ${u * 0.4}px ${u * 1.2}px rgba(0,0,0,0.4)` }}>{w}</div>;
          })}
        </>
      )}

      {/* ---------- B8 42.1–46.7 · THE FIRST GLANCE ----------
           No website screenshot. "Before anyone listens, they judge one thing." Enacted as the
           split-second glance: his real avatar as the profile people first see, and a lime judging
           bracket snapping around it — the instant, wordless verdict (id 683cfaf3). */}
      {t >= 42.1 && t < 46.8 && (() => {
        const br = ip(t, 44.4, 44.9, EASE_OVER);
        const bx = 31, by = 53, bw = 21.2, bh = 21.2;  // bracket target = the avatar (matches panel height+centre)
        const arm = u * 3;
        const corner = (cx: number, cy: number, sx: number, sy: number) => (
          <div style={{ position: "absolute",
            left: `${cx}%`, top: `${cy}%`, width: arm, height: u * 0.28, background: ACCENT, opacity: br,
            transform: `translate(${sx < 0 ? 0 : -arm}px,0)` }}>
            <div style={{ position: "absolute", left: sx < 0 ? 0 : arm - u*0.28, top: 0, width: u * 0.28, height: arm * sy, background: ACCENT }} />
          </div>
        );
        return (
          <>
            <Asset x={bx} y={by} u={u} w={21.2} ar={1} src="avatar.png" t={t} at={42.4} out={46.6} />
            {/* four judging corners snap in */}
            {corner(bx - bw/2, by - bh/2 * 0.56, -1, 1)}
            {corner(bx + bw/2, by - bh/2 * 0.56, 1, 1)}
            {corner(bx - bw/2, by + bh/2 * 0.56, -1, -1)}
            {corner(bx + bw/2, by + bh/2 * 0.56, 1, -1)}
            <div style={{ position: "absolute", left: `${bx}%`, top: `${by + 8}%`, transform: "translate(-50%,-50%)",
              fontFamily: MONO, fontWeight: 700, fontSize: u * 1.3, letterSpacing: "0.24em", color: ACCENT, opacity: br }}>0.05S</div>
            <HL u={u} t={t} at={44.6} ink={ink} size={2.8}>
              THEY JUDGE <Marker u={u} t={t} at={45.4} base={ink}>ONE THING</Marker>
            </HL>
          </>
        );
      })()}

      {/* ---------- B9 46.8–52.6 · CONSISTENT = COMPETENT ----------
           A MATCHED set: his real pieces, identical height, one shared baseline, one grid — visibly
           belonging together. Light register with the brighter LightCard offset (id d71ff874). A lime
           tick confirms the match on "competent" (id 4bde0910). */}
      {t >= 46.8 && t < 52.7 && (() => {
        const bind = ip(t, 48.6, 49.6);
        const check = ip(t, 51.4, 51.8, EASE_OVER);
        return (
          <>
            {/* one aligned row, identical height, shared baseline y=44 */}
            <LightCard x={26} y={42} u={u} w={16} ar={1} src="avatar.png" t={t} at={47.4} />
            <LightCard x={45} y={42} u={u} w={7} ar={0.435} src="brand/swatch_lime.png" t={t} at={47.6} />
            <LightCard x={66} y={42} u={u} w={28} ar={16 / 9} src="thumb_3.png" t={t} at={47.8} />
            {/* the shared baseline draws — the grid they all sit on */}
            <div style={{ position: "absolute", left: "14%", top: "60%", height: u * 0.14, background: ACCENT_ON_LIGHT, width: `${bind * 72}%` }} />
            {/* the MATCH tick */}
            <div style={{ position: "absolute", left: "50%", top: "70%", transform: "translate(-50%,-50%)", opacity: check }}>
              <svg width={u * 3.4} height={u * 3.4} viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="18" fill="none" stroke={ACCENT_ON_LIGHT} strokeWidth="3" />
                <path d="M12 20 L18 26 L28 14" fill="none" stroke={ACCENT_ON_LIGHT} strokeWidth="3.5" strokeLinecap="round"
                  strokeDasharray="28" strokeDashoffset={28 * (1 - check)} />
              </svg>
            </div>
            <HL u={u} t={t} at={50.0} ink={RAISIN} size={2.9}>
              CONSISTENT READS AS <Marker u={u} t={t} at={51.5} base={RAISIN}>COMPETENT</Marker>
            </HL>
          </>
        );
      })()}

      {/* ---------- B10 52.7–56.4 · RANDOM = AMATEUR ----------
           The opposite of B9: a deliberately AWFUL personal brand — clashing colours, a stretched
           hue-shifted photo, a garish wordmark, mismatched angles. Messy on purpose. This is exactly
           what "random reads as amateur" looks like (id 5de7c68f). Stays on the light register so it
           reads as the same person's OTHER option, not a different scene. */}
      {t >= 52.7 && t < 56.5 && (
        <>
          <AmateurBoard u={u} t={t} at={52.75} />
          <HL u={u} t={t} at={53.2} ink={RAISIN} size={2.9}>
            RANDOM READS AS <Marker u={u} t={t} at={54.0} base={RAISIN}>AMATEUR</Marker>
          </HL>
        </>
      )}

      {/* ---------- B11 56.5–63.94 · WHAT YOU WALK AWAY WITH ----------
           Not Luuk's kit, not the brother's photo. A clean EXAMPLE brand book — logo, positioning,
           type, palette, profile — in its OWN colour scheme, assembled SaaS-commercial style. This is
           the artifact the viewer builds for themselves (id f172ec4c). Head hidden, light register. */}
      {t >= 56.5 && (
        <>
          <BrandBookBoard u={u} t={t} at={59.0} />
          <HL u={u} t={t} at={60.4} ink={RAISIN} size={3.0}>
            YOUR WHOLE <Marker u={u} t={t} at={61.2} base={RAISIN}>BRAND BOOK</Marker>
          </HL>
        </>
      )}
    </AbsoluteFill>
  );
};

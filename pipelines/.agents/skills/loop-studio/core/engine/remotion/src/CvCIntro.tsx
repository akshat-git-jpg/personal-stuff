/**
 * CvCIntro v2 — "Claude vs Codex" blind-test intro, rebuilt on Round-1 feedback.
 * Through-line: THE PLAYHEAD (the edit itself) — planted in the hook as a lime
 * playhead sweeping a 3D timeline that wraps around the host while AI slices a
 * clip; returns at the end as the giant seam splitting the screen into the two
 * contenders' fields. Middle: descriptive suspect cards ('?' backs), a vertical
 * portrait cam exactly card-height, the arena, the fairness rules.
 * No redaction bars, no REC chip (Round-1 notes). 25fps to match footage.
 */
import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import {
  clamp01, lerp, EASE_OVER,
  RAISIN, SILVER, SILVER_SOFT, SILVER_MID, BODY, LIME, SANS, MONO,
  SK, skf, FootageLayer, DarkBg, LightBg, GRAIN_URL,
} from "./bb2/scene";

const FPS = 25;
const SRC = "cvc/cut.mp4";
const ease = (t: number, a: number, b: number) => interpolate(t, [a, b], [0, 1], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
  easing: Easing.inOut(Easing.cubic),
});

/* ---------- SFX cue (comp-locked so re-renders can't drift) ---------- */
const Sfx: React.FC<{ n: string; at: number; v?: number; dur?: number; kit?: string }> = ({ n, at, v = 0.3, dur = 1.5, kit = "loopstudio/sfx" }) => (
  <Sequence from={Math.round(at * FPS)} durationInFrames={Math.round(dur * FPS)}>
    <Audio src={staticFile(`${kit}/${n}.wav`)} volume={v * 0.55} />
  </Sequence>
);

const FilmPerfs: React.FC<{ u: number; dark?: boolean; count?: number }> = ({ u, dark = true, count = 10 }) => (
  <>
    {["top", "bottom"].map((edge) => (
      <div key={edge} style={{ position: "absolute", left: u * 0.55, right: u * 0.55, [edge]: u * 0.28, height: u * 0.38, display: "flex", justifyContent: "space-between", pointerEvents: "none", opacity: 0.72 }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} style={{ width: u * 0.3, height: u * 0.38, borderRadius: u * 0.06, background: dark ? RAISIN : SILVER_MID }} />
        ))}
      </div>
    ))}
  </>
);

/* ================= THE ENDGAME HOOK — the edit ORBITS the host =================
   The host is CUT OUT from the background (per-frame matte in public/cvc/matte/),
   so timeline elements literally circle him: passing BEHIND his body on the top
   arc and IN FRONT on the bottom arc. On 'edited' a lime blade slices the a-roll
   clip as it crosses front-center. This is the killer shot. */
const ORBIT_CX = 50, ORBIT_CY = 56, ORBIT_RX = 36, ORBIT_RY = 10.5, ORBIT_TILT = -7 * Math.PI / 180;
// Integrating one smooth velocity function avoids the tiny speed discontinuities
// created by a stack of independently eased keyframe segments.
const orbitSpeed = (s: number) => {
  const tt = Math.max(0, s);
  const easeIn = 0.08 + 0.92 * (1 - Math.exp(-tt * 3.1));
  const focusSlowdown = 1 - 0.62 * Math.exp(-Math.pow((tt - 2.62) / 0.34, 2));
  const release = 1 + 0.52 / (1 + Math.exp(-(tt - 3.03) * 7));
  return easeIn * focusSlowdown * release;
};
const integrateOrbit = (t: number) => {
  if (t <= 0) return 0;
  const steps = 96;
  const dt = t / steps;
  let sum = 0;
  for (let i = 0; i < steps; i++) sum += orbitSpeed((i + 0.5) * dt) * dt;
  return sum;
};
const ORBIT_SCALE = 144 / integrateOrbit(2.62);
const orbitTravel = (t: number) => integrateOrbit(Math.max(0, t)) * ORBIT_SCALE;
const orbitVelocity = (t: number) => (orbitTravel(t + 0.02) - orbitTravel(t - 0.02)) / 0.04;
const orbitPos = (baseDeg: number, t: number) => {
  const travel = orbitTravel(t);
  const th = ((baseDeg + travel) * Math.PI) / 180;
  const ex = ORBIT_RX * Math.cos(th), ey = ORBIT_RY * Math.sin(th);
  const x = ORBIT_CX + ex * Math.cos(ORBIT_TILT) - ey * Math.sin(ORBIT_TILT);
  const y = ORBIT_CY + ex * Math.sin(ORBIT_TILT) + ey * Math.cos(ORBIT_TILT);
  return { x, y, depth: Math.sin(th), theta: th, travel, velocity: orbitVelocity(t) }; // depth>0 = front
};
const orbitGuidePath = (W: number, H: number, half: "front" | "back") => {
  const pts: string[] = [];
  for (let d = 0; d <= 180; d += 6) {
    const deg = half === "front" ? d : d + 180;
    const th = (deg * Math.PI) / 180;
    const ex = ORBIT_RX * Math.cos(th), ey = ORBIT_RY * Math.sin(th);
    const x = ORBIT_CX + ex * Math.cos(ORBIT_TILT) - ey * Math.sin(ORBIT_TILT);
    const y = ORBIT_CY + ex * Math.sin(ORBIT_TILT) + ey * Math.cos(ORBIT_TILT);
    pts.push(`${(x * W) / 100},${(y * H) / 100}`);
  }
  return "M " + pts.join(" L ");
};

const RIBBON_FRAMES = Array.from({ length: 20 }, (_, i) => `cvc/ribbon/frame_${String(i).padStart(2, "0")}.jpg`);

const FilmRibbonCell: React.FC<{ u: number; t: number; idx: number; layer: "front" | "back"; W: number; H: number }> = ({ u, t, idx, layer, W, H }) => {
  const base = -54 + idx * 18;
  const p = orbitPos(base, t);
  const pn = orbitPos(base + 0.45, t);
  const tangent = Math.atan2((pn.y - p.y) * H, (pn.x - p.x) * W) * 180 / Math.PI;
  const uprightTangent = tangent > 90 ? tangent - 180 : tangent < -90 ? tangent + 180 : tangent;
  const displayTangent = Math.max(-18, Math.min(18, uprightTangent));
  const frontMix = clamp01((p.depth + 0.13) / 0.26);
  const layerOpacity = layer === "front" ? frontMix : 1 - frontMix;
  const born = ease(t, 0.28 + idx * 0.012, 0.72 + idx * 0.012);
  const finishOrder = ((idx + 6) % 20) / 20;
  const finished = ease(t, 0.82 + finishOrder * 0.62, 1.42 + finishOrder * 0.62);
  const heroFocus = idx === 0 ? ease(t, 2.05, 2.48) * (1 - ease(t, 2.96, 3.24)) : 0;
  const depthScale = 0.68 + 0.38 * ((p.depth + 1) / 2);
  const cellW = u * 8.15;
  const cellH = u * 4.8;
  const cut = idx === 0 ? ease(t, 2.61, 2.70) : 0;
  const gap = cut * u * 0.42;
  const releaseFade = 1 - ease(t, 3.56, 4.02);
  const captionOn = finished * (idx % 3 === 0 ? 1 : 0);
  const selected = idx === 0 ? ease(t, 1.45, 1.92) * (1 - ease(t, 2.48, 2.66)) : 0;
  const approvedIndex = [4, 9, 14].indexOf(idx);
  const approved = approvedIndex >= 0 ? ease(t, 1.02 + approvedIndex * 0.18, 1.28 + approvedIndex * 0.18) * (1 - ease(t, 3.34, 3.72)) : 0;
  const blur = layer === "back" ? u * (0.055 + Math.max(0, -p.depth) * 0.07) : 0;
  const image = (
    <>
      <Img src={staticFile(RIBBON_FRAMES[idx])} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: finished > 0.5 ? "50% 40%" : "50% 50%", filter: `grayscale(${1 - finished}) saturate(${0.58 + finished * 0.52}) contrast(${0.9 + finished * 0.18}) brightness(${0.68 + finished * 0.22})` }} />
      <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, transparent 50%, rgba(8,10,15,${0.28 * finished}))` }} />
      {captionOn > 0.01 && <div style={{ position: "absolute", left: "19%", right: "19%", bottom: "18%", display: "flex", flexDirection: "column", alignItems: "center", gap: u * 0.14, opacity: captionOn }}>
        <div style={{ width: idx % 2 ? "66%" : "82%", height: u * 0.19, borderRadius: u * 0.08, background: "rgba(255,255,255,0.9)", boxShadow: "0 1px 4px rgba(0,0,0,0.8)" }} />
        <div style={{ width: idx % 2 ? "82%" : "56%", height: u * 0.19, borderRadius: u * 0.08, background: "rgba(255,255,255,0.75)", boxShadow: "0 1px 4px rgba(0,0,0,0.8)" }} />
      </div>}
    </>
  );
  return (
    <div style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: cellW + gap, height: cellH, opacity: born * releaseFade * layerOpacity * (layer === "front" ? 1 : 0.76), transform: `translate(-50%,-50%) rotate(${displayTangent}deg) scale(${depthScale * (1 + heroFocus * 0.1)})`, filter: blur > 0.04 ? `blur(${blur}px) brightness(0.72)` : undefined, transformOrigin: "center", overflow: "visible" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: cut > 0.01 ? cellW * 0.55 : cellW, height: cellH, overflow: "hidden", borderRadius: u * 0.18, background: RAISIN, border: `${u * 0.1}px solid rgba(231,233,238,${0.24 + finished * 0.34})`, boxShadow: `0 ${u * 0.28}px ${u * 0.9}px rgba(0,0,0,0.5), inset 0 0 0 ${u * 0.22}px ${RAISIN}` }}>
        {image}<FilmPerfs u={u * 0.7} count={8} />
      </div>
      {cut > 0.01 && <div style={{ position: "absolute", left: cellW * 0.55 + gap, top: 0, width: cellW * 0.45, height: cellH, overflow: "hidden", borderRadius: u * 0.18, background: RAISIN, border: `${u * 0.1}px solid rgba(231,233,238,0.58)`, boxShadow: `0 ${u * 0.28}px ${u * 0.9}px rgba(0,0,0,0.5), inset 0 0 0 ${u * 0.22}px ${RAISIN}` }}>
        <div style={{ position: "absolute", right: 0, top: 0, width: cellW, height: cellH }}>{image}</div><FilmPerfs u={u * 0.7} count={4} />
      </div>}
      {selected > 0.01 && <div style={{ position: "absolute", left: -u * 0.16, top: -u * 0.16, width: cellW + u * 0.32, height: cellH + u * 0.32, borderRadius: u * 0.28, border: `${u * 0.16}px solid ${LIME}`, boxShadow: `0 0 ${u * 0.75}px ${LIME}aa, inset 0 0 ${u * 0.45}px ${LIME}55`, opacity: selected, pointerEvents: "none" }} />}
      {approved > 0.01 && <div style={{ position: "absolute", right: -u * 0.42, top: -u * 0.42, width: u * 1.55, height: u * 1.55, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: LIME, color: RAISIN, border: `${u * 0.1}px solid rgba(255,255,255,0.9)`, boxShadow: `0 0 ${u * 0.65}px ${LIME}99`, fontFamily: SANS, fontWeight: 900, fontSize: u * 1.05, lineHeight: 1, opacity: approved, transform: `scale(${interpolate(approved, [0, 1], [0.55, 1], { easing: EASE_OVER })})` }}>✓</div>}
      {idx === 0 && t >= 2.50 && t < 3.18 && (() => {
        const play = ease(t, 2.50, 2.60) * (1 - ease(t, 2.94, 3.18));
        return <div style={{ position: "absolute", left: cellW * 0.55 - u * 0.12, top: -u * 1.1, width: u * 0.24, height: cellH + u * 2.2, background: LIME, boxShadow: `0 0 ${u * 0.75}px ${LIME}`, transform: `scaleY(${play})`, transformOrigin: "top", opacity: play }} />;
      })()}
    </div>
  );
};

const FilmRibbonLayer: React.FC<{ u: number; t: number; layer: "front" | "back"; W: number; H: number; on: number }> = ({ u, t, layer, W, H, on }) => (
  <div style={{ position: "absolute", inset: 0, opacity: on * (1 - ease(t, 3.50, 4.02)), pointerEvents: "none" }}>
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <path d={orbitGuidePath(W, H, layer)} fill="none" stroke={RAISIN} strokeWidth={u * 4.6} strokeLinecap="round" opacity={layer === "front" ? 0.96 : 0.66} />
      <path d={orbitGuidePath(W, H, layer)} fill="none" stroke={SILVER_MID} strokeWidth={u * 0.12} opacity={layer === "front" ? 0.42 : 0.18} />
    </svg>
    {RIBBON_FRAMES.map((_, idx) => <FilmRibbonCell key={`${layer}-${idx}`} u={u} t={t} idx={idx} layer={layer} W={W} H={H} />)}
  </div>
);

const OrbitEditSignal: React.FC<{ u: number; t: number; layer: "front" | "back"; on: number }> = ({ u, t, layer, on }) => {
  const life = ease(t, 0.72, 1.08) * (1 - ease(t, 2.46, 2.64));
  const base = lerp(-18, -54, ease(t, 1.9, 2.58));
  const head = orbitPos(base, t);
  const frontMix = clamp01((head.depth + 0.13) / 0.26);
  const layerOpacity = layer === "front" ? frontMix : 1 - frontMix;
  if (life * layerOpacity <= 0.01) return null;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: on * life * layerOpacity, pointerEvents: "none" }}>
      {Array.from({ length: 7 }).map((_, i) => {
        const p = orbitPos(base + (i + 1) * 2.8, t);
        const fade = 1 - (i + 1) / 8;
        return <div key={i} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, width: u * (0.46 - i * 0.045), height: u * (0.46 - i * 0.045), borderRadius: "50%", transform: "translate(-50%,-50%)", background: LIME, opacity: fade * 0.68, boxShadow: `0 0 ${u * (0.55 + fade * 0.5)}px ${LIME}` }} />;
      })}
      <div style={{ position: "absolute", left: `${head.x}%`, top: `${head.y}%`, width: u * 1.08, height: u * 1.08, transform: "translate(-50%,-50%) rotate(45deg)", borderRadius: u * 0.14, background: LIME, border: `${u * 0.12}px solid rgba(255,255,255,0.9)`, boxShadow: `0 0 ${u * 0.85}px ${LIME}, 0 0 ${u * 2.2}px ${LIME}88` }}>
        <div style={{ position: "absolute", inset: "28%", borderRadius: "50%", background: RAISIN }} />
      </div>
    </div>
  );
};

const EndgameHook: React.FC<{ u: number; t: number; frame: number; W: number; H: number }> = ({ u, t, frame, W, H }) => {
  const on = clamp01((t - 0.3) / 0.4) * (1 - clamp01((t - 3.95) / 0.35));
  if (on <= 0.01) return null;
  const cutFade = 1 - clamp01((t - 3.95) / 0.3);
  const mi = Math.max(1, Math.min(105, frame + 1));
  const matte = `cvc/matte/f_${String(mi).padStart(3, "0")}.png`;
  const matteUrl = staticFile(matte);
  const guideOn = clamp01((t - 0.5) / 0.5);
  const push = 1;
  const kick = clamp01((t - 2.62) / 0.06) * (1 - clamp01((t - 2.62 - 0.14) / 0.2)); // exposure kick on the slice
  // fine atmospheric dust (slow, tiny, cinematic)
  const dust = Array.from({ length: 14 }).map((_, i) => {
    const dx = ((i * 137.5) % 100 + t * (0.6 + (i % 3) * 0.3)) % 100;
    const dy = (i * 61.8) % 100 - t * (0.35 + (i % 4) * 0.2);
    return { x: dx, y: ((dy % 100) + 100) % 100, i };
  });
  return (
    <>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${push})`, transformOrigin: "50% 52%" }}>
        {/* BACK: one unbroken strip, softly occluded by the real cutout. */}
        <FilmRibbonLayer u={u} t={t} layer="back" W={W} H={H} on={on * guideOn} />
        <OrbitEditSignal u={u} t={t} layer="back" on={on * guideOn} />
      </div>
      {/* THE CUTOUT — clean, no glow (Round-3 note) */}
      <AbsoluteFill style={{ opacity: cutFade, pointerEvents: "none" }}>
        <Img src={matteUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${push})`, transformOrigin: "50% 52%" }}>
        {/* FRONT: the same strip, crossfaded around the depth seam to prevent popping. */}
        <FilmRibbonLayer u={u} t={t} layer="front" W={W} H={H} on={on * guideOn} />
        <OrbitEditSignal u={u} t={t} layer="front" on={on * guideOn} />
        {/* atmospheric dust */}
        <div style={{ position: "absolute", inset: 0, opacity: on * 0.6, pointerEvents: "none" }}>
          {dust.map((d) => <div key={d.i} style={{ position: "absolute", left: `${d.x}%`, top: `${d.y}%`, width: u * 0.09, height: u * 0.09, borderRadius: "50%", background: "#fff", opacity: 0.12 + (d.i % 3) * 0.04 }} />)}
        </div>
      </div>
      {/* exposure kick on the slice — the whole frame breathes with the cut */}
      {kick > 0.01 && <AbsoluteFill style={{ pointerEvents: "none", background: "#fff", opacity: kick * 0.09, mixBlendMode: "screen" }} />}
    </>
  );
};

/* ================= vertical portrait cam — exactly card-height, card-row aligned ====== */
const CARD_H = 24;   // u-units — ONE source of truth for card AND cam height (bigger per Round-2)
const PortraitCam: React.FC<{ u: number; t: number }> = ({ u, t }) => {
  const inn = interpolate(clamp01((t - 4.15) / 0.4), [0, 1], [0.8, 1], { easing: EASE_OVER });
  const on = clamp01((t - 4.15) / 0.3) * (1 - clamp01((t - 12.95) / 0.35));
  if (on <= 0.01) return null;
  const H = u * CARD_H, W = H * 9 / 16;
  return (
    <div style={{ position: "absolute", left: "80%", top: "46%", transform: `translate(-50%,-50%) scale(${inn})`, opacity: on }}>
      <div style={{ position: "absolute", left: u * 0.8, top: u * 0.8, width: W, height: H, background: LIME, borderRadius: u * 0.9, opacity: 0.95 }} />
      <div style={{ position: "relative", width: W, height: H, borderRadius: u * 0.9, overflow: "hidden", border: `${u * 0.16}px solid ${SILVER}`, boxShadow: `0 ${u * 1.0}px ${u * 2.8}px rgba(0,0,0,0.4)` }}>
        <OffthreadVideo src={staticFile(SRC)} muted style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", height: "100%", width: "auto", aspectRatio: "16/9", objectFit: "cover", objectPosition: "50% 24%", filter: "contrast(1.04) saturate(1.03)" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 10}px`, opacity: 0.055, mixBlendMode: "soft-light" }} />
        <FilmPerfs u={u} dark count={5} />
      </div>
    </div>
  );
};

/* ---------- one suspect card: front = mark + name + descriptor, back = '?' ---------- */
const SuspectCard: React.FC<{
  u: number; logo: string; name: string; sub: string; flip: number; scale?: number; light: boolean;
}> = ({ u, logo, name, sub, flip, scale = 1, light }) => {
  const rot = lerp(0, 180, flip);
  const CW = u * 19.6, CH = u * CARD_H;
  return (
    <div style={{ width: CW, height: CH, perspective: `${u * 90}px`, transform: `scale(${scale})` }}>
      <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d", transform: `rotateY(${rot}deg)` }}>
        {/* FRONT */}
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", overflow: "hidden", borderRadius: u * 0.9, background: light ? "linear-gradient(150deg,#ffffff,#eef0f1)" : "#161b26", border: `${u * 0.14}px solid ${light ? "#c9cfd4" : "#2b3242"}`, boxShadow: `0 ${u * 1.1}px ${u * 3.1}px rgba(0,0,0,${light ? 0.24 : 0.55}), 0 ${u * 0.18}px ${u * 0.35}px rgba(0,0,0,0.14)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: u * 1.2 }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 11}px`, opacity: light ? 0.035 : 0.055, mixBlendMode: "multiply" }} />
          <Img src={staticFile(logo)} style={{ width: u * 8.2, height: u * 8.2, objectFit: "contain", filter: logo.includes("chatgpt") ? "brightness(0.35)" : undefined }} />
          <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: u * 2.1, letterSpacing: "0.14em", color: RAISIN }}>{name}</span>
          <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.2, letterSpacing: "0.06em", color: "#6b7488", whiteSpace: "nowrap" }}>{sub}</span>
          <FilmPerfs u={u} dark={light} count={8} />
        </div>
        {/* BACK — sealed identity: a clean '?' */}
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", overflow: "hidden", transform: "rotateY(180deg)", borderRadius: u * 0.9, background: "linear-gradient(160deg,#141a28,#0c0f18)", border: `${u * 0.14}px solid #2b3242`, boxShadow: `0 ${u * 1.1}px ${u * 3.1}px rgba(0,0,0,0.55)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 11}px`, opacity: 0.06, mixBlendMode: "soft-light" }} />
          <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 7, color: SILVER_MID, opacity: 0.9 }}>?</span>
          <FilmPerfs u={u} dark={false} count={8} />
        </div>
      </div>
    </div>
  );
};

export const CvCIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;

  /* ---- head framing: full-bleed hook → (portrait cam takes over) → hidden ---- */
  const SKF: SK[] = [
    { t: 0, x: 50, y: 50, s: 1, dim: 0, fr: 0 },       // match the full-bright subject matte from frame one
    { t: 0.28, x: 50, y: 50, s: 1, dim: 0, fr: 0 },    // hold exposure until the matte has entered
    { t: 0.62, x: 50, y: 50, s: 1, dim: 0.55, fr: 0 }, // dim only the room beneath the now-matched subject
    { t: 3.95, x: 50, y: 50, s: 1, dim: 0.55, fr: 0 },
    { t: 4.35, x: 50, y: 50, s: 1, dim: 1, fr: 0 },   // hand over to the PortraitCam
    { t: 24.6, x: 50, y: 50, s: 1, dim: 1, fr: 1 },
  ];
  // skf() maps t via the engine-wide FPS (30); this comp renders at 25fps —
  // pre-scale keyframe times so each fires at the intended REAL second.
  const sk = skf(SKF.map((k) => ({ ...k, t: k.t * FPS / 30 })), frame);

  /* ---- register: dark hook → light for the fair test → dark for the face-off ---- */
  const lite = clamp01((t - 4.1) / 0.5) * (1 - clamp01((t - 20.2) / 0.5));
  const cameraPush = interpolate(t, [0, 0.85, 2.62, 3.12, 4.25], [1, 1.006, 1.025, 1.017, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic),
  });
  const cameraX = interpolate(t, [0, 1.2, 2.62, 3.35, 4.25], [0, u * 0.12, -u * 0.24, u * 0.08, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic),
  });

  /* ---- suspect card positions through split → shuffle → arena ---- */
  const L0 = { x: 24, y: 46 }, R0 = { x: 52, y: 46 };
  const sw1 = interpolate(t, [10.34, 10.85], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const sw2 = interpolate(t, [10.85, 11.35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const arc1 = Math.sin(sw1 * Math.PI), arc2 = Math.sin(sw2 * Math.PI);
  let ax = lerp(lerp(L0.x, R0.x, sw1), L0.x, sw2);
  let bx = lerp(lerp(R0.x, L0.x, sw1), R0.x, sw2);
  let ay = L0.y - arc1 * 9 + arc2 * 9;
  let by = R0.y + arc1 * 9 - arc2 * 9;
  const aFront = arc1 > arc2 ? arc1 : -arc2;
  const shufScaleA = 1 + 0.06 * aFront, shufScaleB = 1 - 0.06 * aFront;
  const zA = aFront >= 0 ? 3 : 1, zB = aFront >= 0 ? 1 : 3;
  const fly = interpolate(t, [13.45, 14.15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  ax = lerp(ax, 25, fly); ay = lerp(ay, 44, fly);
  bx = lerp(bx, 75, fly); by = lerp(by, 44, fly);
  const cardScale = lerp(1, 0.88, fly);

  const flip = interpolate(t, [8.14, 8.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });

  /* ---- impact shakes: VS slam + the two battle clashes ---- */
  const imp = (at: number, amp: number, dur: number) =>
    t >= at && t < at + dur ? Math.sin(frame * 9.1) * u * amp * (1 - clamp01((t - at) / dur)) : 0;
  const shake = imp(14.72, 0.28, 0.38) + imp(20.6, 0.34, 0.42) + imp(22.8, 0.42, 0.45);

  /* ---- ending bloom ---- */
  const bloom = interpolate(frame, [FPS * 24.1, FPS * 24.45, FPS * 24.55], [0, 0.5, 0.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const cardsBorn = t >= 4.4;
  const arenaOn = t >= 12.86;

  return (
    <AbsoluteFill style={{ background: RAISIN, overflow: "hidden", fontFamily: SANS }}>
      <Audio src={staticFile("cvc/vo_centered.wav")} />
      <DarkBg u={u} gridOpacity={lite < 0.5 ? 0.5 : 0} />
      <LightBg u={u} opacity={lite} />
      <AbsoluteFill style={{ pointerEvents: "none", backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 12}px`, opacity: 0.026 + (1 - lite) * 0.012, mixBlendMode: lite > 0.5 ? "multiply" : "soft-light" }} />

      {/* One virtual camera drives both the photographed subject and the orbiting edit rig. */}
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${cameraX}px) scale(${cameraPush})`, transformOrigin: "50% 52%" }}>
        <FootageLayer sk={sk} u={u} src={SRC} />
        {t < 4.6 && <EndgameHook u={u} t={t} frame={frame} W={W} H={H} />}
      </div>

      {/* ================= GRAPHICS WORLD ================= */}
      <div style={{ position: "absolute", inset: 0, transform: `translateX(${shake}px)` }}>

        {/* vertical portrait cam — exactly card-height, card-row aligned */}
        <PortraitCam u={u} t={t} />

        {/* B2+B3: suspect cards (slam → flip to '?' → shuffle) */}
        {cardsBorn && t < 20.9 && (() => {
          const bornL = interpolate(clamp01((t - 4.74) / 0.32), [0, 1], [0.66, 1], { easing: EASE_OVER });
          const bornR = interpolate(clamp01((t - 5.68) / 0.32), [0, 1], [0.66, 1], { easing: EASE_OVER });
          const onL = clamp01((t - 4.6) / 0.2) * (1 - clamp01((t - 20.5) / 0.4));
          const onR = clamp01((t - 5.54) / 0.2) * (1 - clamp01((t - 20.5) / 0.4));
          const light = lite > 0.5;
          return (
            <>
              <div style={{ position: "absolute", left: `${ax}%`, top: `${ay}%`, transform: "translate(-50%,-50%)", opacity: onL, zIndex: zA }}>
                <SuspectCard u={u} logo="logos/claude.svg" name="FABLE 5" sub="by Anthropic" flip={flip} scale={bornL * cardScale * shufScaleA} light={light} />
              </div>
              <div style={{ position: "absolute", left: `${bx}%`, top: `${by}%`, transform: "translate(-50%,-50%)", opacity: onR, zIndex: zB }}>
                <SuspectCard u={u} logo="logos/chatgpt.svg" name="SOL 5.6" sub="by OpenAI" flip={flip} scale={bornR * cardScale * shufScaleB} light={light} />
              </div>
            </>
          );
        })()}

        {/* B3 lime progress track — the investigation ahead */}
        {t >= 11.28 && t < 13.3 && (() => {
          const draw = clamp01((t - 11.28) / 0.6);
          const on = 1 - clamp01((t - 12.95) / 0.3);
          const x0 = 14, x1 = lerp(14, 60, draw);
          return (
            <div style={{ position: "absolute", inset: 0, opacity: on, pointerEvents: "none" }}>
              <div style={{ position: "absolute", left: `${x0}%`, top: "71.5%", width: `${x1 - x0}%`, height: u * 0.34, borderRadius: u * 0.2, background: LIME, boxShadow: `0 0 ${u * 0.8}px ${LIME}88` }} />
              <div style={{ position: "absolute", left: `${x1}%`, top: "71.5%", transform: "translate(-30%,-38%)", width: 0, height: 0, borderLeft: `${u * 1.1}px solid ${LIME}`, borderTop: `${u * 0.7}px solid transparent`, borderBottom: `${u * 0.7}px solid transparent`, opacity: draw > 0.9 ? 1 : 0 }} />
              <div style={{ position: "absolute", left: "50%", top: "82%", width: "80%", transform: "translate(-50%,-50%)", opacity: clamp01((t - 11.7) / 0.4), fontFamily: SANS, fontWeight: 700, fontSize: u * 2.0, lineHeight: 1.22, letterSpacing: "0.01em", color: lite > 0.5 ? "#59617a" : SILVER_MID, textAlign: "center", textShadow: lite > 0.5 ? "none" : "0 1px 6px rgba(0,0,0,0.6)" }}>
                FABLE 5 VS SOL 5.6.<br />SAME VIDEO. LET&apos;S SEE THE RESULTS.
              </div>
            </div>
          );
        })()}

        {/* B4 ARENA: hairline + VS plate */}
        {arenaOn && t < 20.9 && (() => {
          const lineDraw = clamp01((t - 13.4) / 0.5);
          const lineOn = clamp01((t - 13.4) / 0.3) * (1 - clamp01((t - 20.3) / 0.4));
          const vsIn = interpolate(clamp01((t - 14.72) / 0.28), [0, 1], [1.35, 1], { easing: EASE_OVER });
          const vsOn = clamp01((t - 14.72) / 0.15) * (1 - clamp01((t - 20.3) / 0.4));
          return (
            <>
              <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: u * 0.14, height: `${lineDraw * 62}%`, background: lite > 0.5 ? "#c3c9cd" : "#2b3242", opacity: lineOn }} />
              {vsOn > 0.01 && (
                <div style={{ position: "absolute", left: "50%", top: "44%", transform: `translate(-50%,-50%) scale(${vsIn}) rotate(-1.6deg)`, opacity: vsOn }}>
                  <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3.6, color: "#fff", background: RAISIN, padding: `${u * 0.45}px ${u * 1.5}px`, borderRadius: u * 0.5, letterSpacing: "0.04em", boxShadow: `0 ${u * 0.8}px ${u * 2.2}px rgba(0,0,0,0.35)` }}>VS</span>
                </div>
              )}
            </>
          );
        })()}

        {/* B5 RULES: prompt chip duplicates; pips stamp */}
        {t >= 16.2 && t < 20.9 && (() => {
          const chipIn = interpolate(clamp01((t - 16.4) / 0.28), [0, 1], [0.8, 1], { easing: EASE_OVER });
          const dup = interpolate(t, [16.78, 17.3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
          const on = clamp01((t - 16.4) / 0.25) * (1 - clamp01((t - 20.3) / 0.4));
          const light = lite > 0.5;
          const Chip: React.FC<{ x: number; o: number; s?: number }> = ({ x, o, s = 1 }) => (
            <div style={{ position: "absolute", left: `${x}%`, top: "72%", transform: `translate(-50%,-50%) scale(${s})`, opacity: o }}>
              <div style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: u * 0.7, background: light ? "linear-gradient(155deg,#ffffff,#e8ebed)" : "#0f131b", border: `${u * 0.1}px solid ${light ? "#b9c0c5" : "#2b3242"}`, borderRadius: u * 0.42, padding: `${u * 0.72}px ${u * 1.3}px`, boxShadow: `0 ${u * 0.65}px ${u * 1.8}px rgba(0,0,0,${light ? 0.2 : 0.34}), 0 ${u * 0.12}px ${u * 0.25}px rgba(0,0,0,0.12)` }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 8}px`, opacity: light ? 0.035 : 0.05, mixBlendMode: light ? "multiply" : "soft-light" }} />
                <span style={{ position: "relative", width: u * 1.8, height: u * 1.8, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: LIME, color: RAISIN, fontFamily: MONO, fontWeight: 900, fontSize: u * 1.25 }}>›</span>
                <span style={{ position: "relative", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.35, color: light ? RAISIN : "#fff", whiteSpace: "nowrap" }}>edit this intro</span>
              </div>
            </div>
          );
          const pip = (i: number) => clamp01((t - (18.02 + i * 0.26)) / 0.2);
          const Pips: React.FC<{ x: number }> = ({ x }) => (
            <div style={{ position: "absolute", left: `${x}%`, top: "80%", transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: u * 0.7 }}>
              {/* fb v3: number the tries + name them so '3 prompts each' reads instantly */}
              <div style={{ display: "flex", gap: u * 1.1 }}>
                {[0, 1, 2].map((i) => {
                  const p = pip(i);
                  return <span key={i} style={{ width: u * 1.9, height: u * 1.9, borderRadius: "50%", border: `${u * 0.18}px solid ${light ? "#6b7488" : SILVER_MID}`, transform: `scale(${interpolate(p, [0, 1], [0.4, 1], { easing: EASE_OVER })})`, opacity: p, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontWeight: 800, fontSize: u * 0.98, color: light ? "#6b7488" : SILVER_MID }}>{i + 1}</span>;
                })}
              </div>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 0.92, letterSpacing: "0.18em", color: light ? "#8b93a0" : "#727b8c", opacity: pip(0) }}>3 PROMPTS</span>
            </div>
          );
          return (
            <div style={{ opacity: on }}>
              <Chip x={50} o={1 - dup} s={chipIn} />
              {dup > 0.01 && <Chip x={lerp(50, 25, dup)} o={dup} />}
              {dup > 0.01 && <Chip x={lerp(50, 75, dup)} o={dup} />}
              {t >= 18.0 && <><Pips x={25} /><Pips x={75} /></>}
            </div>
          );
        })()}

        {/* B6: two editor heroes collide for the title. Cinematic, but one clean focal event. */}
        {t >= 20.2 && (() => {
          const fieldIn = interpolate(t, [20.2, 20.75], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
          const heroPush = interpolate(t, [20.62, 22.72], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
          const clash1 = clamp01((t - 20.6) / 0.5);
          const clash2 = clamp01((t - 22.8) / 0.5);
          const burst = (b: number) => Math.sin(Math.min(b, 1) * Math.PI);
          const flicker = 0.55 + 0.25 * Math.abs(Math.sin(frame * 1.7)) + 0.2 * Math.abs(Math.sin(frame * 0.9));
          const impact = 0.55 * burst(clash1) + burst(clash2) + (t >= 22.8 ? 0.42 * Math.exp(-(t - 22.8) * 1.4) : 0);
          const crestIn = interpolate(clamp01((t - 20.45) / 0.5), [0, 1], [0.72, 1], { easing: EASE_OVER });
          const titleIn = ease(t, 22.05, 22.62);
          const rays = Array.from({ length: 7 }, (_, i) => ({
            y: 16 + i * 10.8,
            w: 11 + (i % 3) * 7,
            o: 0.07 + (i % 2) * 0.05,
          }));
          const HeroCrest: React.FC<{ side: "left" | "right"; logo: string; name: string }> = ({ side, logo, name }) => {
            const left = side === "left" ? lerp(34, 72, heroPush) : lerp(66, 28, heroPush);
            const tilt = side === "left" ? lerp(-7, -2, heroPush) : lerp(7, 2, heroPush);
            const glow = side === "left" ? "rgba(255,226,212,0.52)" : "rgba(200,218,255,0.48)";
            return (
              <div style={{ position: "absolute", left: `${left}%`, top: "45%", transform: `translate(-50%,-50%) rotate(${tilt}deg) scale(${crestIn * (1 + impact * 0.055)})`, display: "flex", flexDirection: "column", alignItems: "center", gap: u * 0.8 }}>
                <div style={{ position: "relative", width: u * 19.5, height: u * 19.5, display: "flex", alignItems: "center", justifyContent: "center", clipPath: "polygon(50% 0,88% 14%,100% 50%,86% 88%,50% 100%,14% 88%,0 50%,14% 14%)", background: "linear-gradient(145deg,rgba(255,255,255,0.19),rgba(10,12,18,0.56))", border: `${u * 0.12}px solid rgba(255,255,255,0.58)`, boxShadow: `0 ${u * 1.2}px ${u * 3.2}px rgba(0,0,0,0.42), 0 0 ${u * (2.2 + impact * 2.2)}px ${glow}, inset 0 0 ${u * 2.4}px rgba(255,255,255,0.12)` }}>
                  <div style={{ position: "absolute", inset: u * 1.0, clipPath: "inherit", border: `${u * 0.08}px solid rgba(255,255,255,0.28)` }} />
                  <Img src={staticFile(logo)} style={{ width: "59%", height: "59%", objectFit: "contain", filter: `drop-shadow(0 ${u * 0.5}px ${u * 1.1}px rgba(0,0,0,0.42))` }} />
                </div>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.2, color: "#fff", letterSpacing: "0.08em", textShadow: `0 ${u * 0.25}px ${u * 0.8}px rgba(0,0,0,0.46)` }}>{name}</span>
              </div>
            );
          };
          const Burst: React.FC<{ at: number }> = ({ at }) => {
            const bp = clamp01((t - at) / 0.55);
            if (bp <= 0 || bp >= 1) return null;
            const R = bp * u * 24;
            return (
              <>
                <div style={{ position: "absolute", left: "50%", top: "47%", transform: "translate(-50%,-50%)", width: R * 2, height: R * 2, borderRadius: "50%", border: `${u * 0.28 * (1 - bp)}px solid rgba(255,255,255,${0.8 * (1 - bp)})`, boxShadow: `0 0 ${u * 2}px rgba(255,255,255,${0.5 * (1 - bp)})` }} />
                {Array.from({ length: 12 }).map((_, k) => {
                  const ang = (k / 12) * Math.PI * 2 + 0.3;
                  const dist = bp * u * (14 + (k % 3) * 4);
                  return <div key={k} style={{ position: "absolute", left: `calc(50% + ${Math.cos(ang) * dist}px)`, top: `calc(47% + ${Math.sin(ang) * dist * 0.7}px)`, width: u * (0.5 - bp * 0.35), height: u * (0.5 - bp * 0.35), borderRadius: "50%", background: "#fff", opacity: (1 - bp) * 0.9, boxShadow: `0 0 ${u * 0.8}px #fff` }} />;
                })}
                <AbsoluteFill style={{ background: `radial-gradient(ellipse 40% 55% at 50% 47%, rgba(255,255,255,${0.32 * (1 - bp)}), transparent 60%)`, pointerEvents: "none" }} />
              </>
            );
          };
          return (
            <>
              <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "50%", transform: `translateX(${(fieldIn - 1) * 105}%)`, background: "linear-gradient(118deg,#D97757 0%,#bd5c42 58%,#6f2d25 100%)", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 80% at 70% 46%, rgba(255,235,224,0.28), transparent 62%)" }} />
                <div style={{ position: "absolute", inset: 0, backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 11}px`, opacity: 0.07, mixBlendMode: "soft-light" }} />
                {rays.map((r, i) => <div key={`lr${i}`} style={{ position: "absolute", right: `${18 + (i % 2) * 4}%`, top: `${r.y}%`, width: `${r.w}%`, height: u * 0.16, transform: `rotate(${i % 2 ? -8 : 7}deg) scaleX(${0.5 + heroPush * 0.5})`, transformOrigin: "right", background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.7))", opacity: r.o * fieldIn }} />)}
                <div style={{ position: "absolute", right: "4%", top: "12%", bottom: "12%", width: u * 8, background: `linear-gradient(90deg, transparent, rgba(255,237,229,${0.26 + impact * 0.16}))`, filter: `blur(${u * 0.8}px)` }} />
                <HeroCrest side="left" logo="logos/claude-white.svg" name="FABLE 5" />
              </div>
              <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "50%", transform: `translateX(${(1 - fieldIn) * 105}%)`, background: "linear-gradient(242deg,#303d5d 0%,#171f33 58%,#080b12 100%)", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 80% at 30% 46%, rgba(185,205,255,0.22), transparent 62%)" }} />
                <div style={{ position: "absolute", inset: 0, backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 11}px`, opacity: 0.075, mixBlendMode: "soft-light" }} />
                {rays.map((r, i) => <div key={`rr${i}`} style={{ position: "absolute", left: `${18 + (i % 2) * 4}%`, top: `${r.y}%`, width: `${r.w}%`, height: u * 0.16, transform: `rotate(${i % 2 ? 8 : -7}deg) scaleX(${0.5 + heroPush * 0.5})`, transformOrigin: "left", background: "linear-gradient(270deg,transparent,rgba(255,255,255,0.68))", opacity: r.o * fieldIn }} />)}
                <div style={{ position: "absolute", left: "4%", top: "12%", bottom: "12%", width: u * 8, background: `linear-gradient(270deg, transparent, rgba(207,220,255,${0.24 + impact * 0.16}))`, filter: `blur(${u * 0.8}px)` }} />
                <HeroCrest side="right" logo="logos/chatgpt-white.svg" name="SOL 5.6" />
              </div>
              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, transform: "translateX(-50%)", width: u * 1.05, clipPath: "polygon(42% 0,100% 13%,58% 28%,92% 44%,40% 59%,78% 76%,34% 100%,0 83%,38% 64%,7% 48%,48% 31%,17% 14%)", background: `rgba(255,255,255,${0.76 + 0.2 * flicker})`, boxShadow: `0 0 ${u * (1.8 + impact)}px rgba(255,255,255,0.9), 0 0 ${u * (4.2 + impact * 2)}px rgba(214,222,240,0.34)` }} />
              <div style={{ position: "absolute", left: "50%", top: "47%", transform: `translate(-50%,-50%) scale(${1 + impact * 0.18})`, width: u * 5.2, height: u * 5.2, borderRadius: "50%", background: `radial-gradient(circle,#fff 0%,rgba(255,255,255,${0.72 * flicker}) 18%,transparent 68%)`, filter: `blur(${u * 0.12}px)`, opacity: fieldIn }} />
              <div style={{ position: "absolute", left: "50%", bottom: "7.5%", transform: `translate(-50%,${lerp(18, 0, titleIn)}px)`, opacity: titleIn, display: "flex", alignItems: "center", gap: u * 1.05 }}>
                <span style={{ width: u * 4.2, height: u * 0.1, background: "rgba(255,255,255,0.58)" }} />
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.15, letterSpacing: "0.14em", color: "#fff", background: "rgba(15,18,26,0.86)", border: `${u * 0.08}px solid rgba(255,255,255,0.34)`, borderRadius: u * 0.38, padding: `${u * 0.5}px ${u * 1.25}px`, boxShadow: `0 ${u * 0.45}px ${u * 1.3}px rgba(0,0,0,0.42)` }}>BEST EDITOR</span>
                <span style={{ width: u * 4.2, height: u * 0.1, background: "rgba(255,255,255,0.58)" }} />
              </div>
              <Burst at={20.6} />
              <Burst at={22.8} />
            </>
          );
        })()}
      </div>

      {/* vignette */}
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 82% 74% at 50% 46%, transparent 52%, rgba(0,0,0,0.34) 100%)", opacity: lite > 0.5 ? 0.4 : (t >= 20.2 ? 0.5 : 1) }} />

      {/* soft lime bloom out */}
      {bloom > 0.01 && <AbsoluteFill style={{ pointerEvents: "none", opacity: bloom, background: "radial-gradient(ellipse 64% 50% at 50% 50%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.12) 36%, transparent 64%)", mixBlendMode: "screen" }} />}

      {/* ================= SOUND DESIGN (word-synced, comp-locked) ================= */}
      <Sfx n="riser" at={0.2} v={0.10} dur={3.6} />
      <Sfx n="whoosh" at={0.9} v={0.12} dur={1.0} />               {/* orbit sweeps front */}
      <Sfx n="whoosh" at={2.0} v={0.12} dur={1.0} />
      <Sfx n="click" at={2.62} v={0.24} dur={0.6} />               {/* the SLICE on 'edited' */}
      <Sfx n="impact" at={2.62} v={0.09} dur={1.2} kit="cvc/sfx" /> {/* quiet low body under the blade */}
      <Sfx n="whoosh" at={3.05} v={0.08} dur={0.8} />              {/* authored release out of the lock */}
      <Sfx n="ping" at={3.36} v={0.12} dur={0.8} />                {/* accent on 'AI' */}
      <Sfx n="pop" at={4.74} v={0.26} dur={0.7} kit="cvc/sfx" />   {/* FABLE 5 slams */}
      <Sfx n="pop" at={5.68} v={0.26} dur={0.7} kit="cvc/sfx" />   {/* SOL 5.6 slams */}
      <Sfx n="whoosh" at={8.1} v={0.18} dur={0.9} />               {/* cards flip */}
      <Sfx n="click" at={8.42} v={0.18} dur={0.5} />               {/* flip lands */}
      <Sfx n="whoosh" at={10.34} v={0.13} dur={0.8} />             {/* shuffle 1 */}
      <Sfx n="whoosh" at={10.85} v={0.13} dur={0.8} />             {/* shuffle 2 */}
      <Sfx n="ping" at={11.4} v={0.15} dur={1.0} />                {/* track draws */}
      <Sfx n="whoosh" at={13.25} v={0.18} dur={1.0} />             {/* cards fly to lanes */}
      <Sfx n="impact" at={14.72} v={0.32} dur={1.6} kit="cvc/sfx" /> {/* VS slam */}
      <Sfx n="click" at={16.4} v={0.2} dur={0.6} />                {/* prompt chip */}
      <Sfx n="whoosh" at={16.78} v={0.15} dur={0.8} />             {/* chip duplicates */}
      <Sfx n="pop" at={18.02} v={0.18} dur={0.5} kit="cvc/sfx" />
      <Sfx n="pop" at={18.28} v={0.18} dur={0.5} kit="cvc/sfx" />
      <Sfx n="pop" at={18.54} v={0.18} dur={0.5} kit="cvc/sfx" />
      <Sfx n="whoosh" at={20.2} v={0.18} dur={1.0} />              {/* fields slide in */}
      <Sfx n="impact" at={20.6} v={0.28} dur={1.4} kit="cvc/sfx" /> {/* CLASH 1 */}
      <Sfx n="riser" at={20.9} v={0.12} dur={2.6} />               {/* battle tension */}
      <Sfx n="impact" at={22.8} v={0.34} dur={1.5} kit="cvc/sfx" /> {/* CLASH 2 on 'better' */}
      <Sfx n="whoosh" at={24.15} v={0.17} dur={0.6} />             {/* bloom out */}
    </AbsoluteFill>
  );
};

/**
 * IntroBroll — Remotion motion-graphic B-ROLL for the talking-head intro, in the bb2 brand
 * language (raisin + lime, Space Grotesk, grain, the lime highlighter). These are full-screen
 * cutaways Luuk lays over his reveal VO. Windows are synced to the exported caption timings of
 * "EDIT - clean cut-2.mp4":
 *   line1  0.15–4.51  reveal ................ KEEP FACE (no b-roll)
 *   2–4    4.6–13.9   "terrible → super good" → Scene ITERATIONS
 *   5–6    14.0–20.9  "everyone claims Vox-style" → Scene CLAIMS
 *   7–8    20.9–29.0  "they animate by hand" → Scene BY HAND  (the argument beat)
 *   9      29.0–31.0  "all AI generated" → Scene STAMP
 *   10–12  31.0–39.9  "included in Loop Studio / link" → Scene LOOP STUDIO
 *   13     40.0+      "let's get started" ... KEEP FACE / whoosh out
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";
import { clamp01, lerp, Marker, DarkBg, GRAIN_URL, RAISIN, RAISIN_DEEP, LIME, SILVER, WHITE, STEEL, SANS, MONO } from "./bb2/scene";

const FPS = 30;
const easeOut = Easing.out(Easing.cubic);
const ap = (t: number, at: number, d = 0.35) => clamp01((t - at) / d);
const win = (t: number, a: number, b: number, f = 0.3) => ap(t, a, f) * (1 - clamp01((t - b) / f));

const Grain: React.FC<{ u: number; qt: number }> = ({ u, qt }) => {
  const k = Math.floor(qt / 0.4);
  return <AbsoluteFill style={{ backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 26}px ${u * 26}px`, backgroundPosition: `${(k * 37) % 140}px ${(k * 61) % 140}px`, opacity: 0.15, mixBlendMode: "overlay", pointerEvents: "none" }} />;
};

/* a small fake "video thumbnail" card — the claims everyone is posting */
const ClaimCard: React.FC<{ u: number; x: number; y: number; rot: number; app: number; dim?: boolean }> = ({ u, x, y, rot, app, dim }) => (
  <div style={{
    position: "absolute", left: `${x}%`, top: `${y}%`,
    width: u * 20, height: u * 11.6,
    transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${lerp(0.7, 1, easeOut(app))})`,
    opacity: app * (dim ? 0.5 : 1),
    background: STEEL, borderRadius: u * 0.9, border: `1px solid ${SILVER}22`,
    boxShadow: `0 ${u}px ${u * 2.4}px rgba(0,0,0,0.5)`, overflow: "hidden",
  }}>
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${RAISIN_DEEP}, ${STEEL})` }} />
    <div style={{ position: "absolute", left: "50%", top: "42%", transform: "translate(-50%,-50%)", width: 0, height: 0, borderTop: `${u * 1.1}px solid transparent`, borderBottom: `${u * 1.1}px solid transparent`, borderLeft: `${u * 1.8}px solid ${SILVER}cc` }} />
    <div style={{ position: "absolute", left: u * 0.7, bottom: u * 0.7, background: LIME, color: RAISIN, fontFamily: MONO, fontWeight: 700, fontSize: u * 0.82, letterSpacing: "0.06em", padding: `${u * 0.22}px ${u * 0.5}px`, borderRadius: u * 0.3 }}>VOX-STYLE ✨</div>
  </div>
);

/* ---------- Scene 1: ITERATIONS (terrible → super good) ---------- */
const SceneIterations: React.FC<{ u: number; t: number; a: number; b: number }> = ({ u, t, a, b }) => {
  const o = win(t, a, b, 0.4); if (o <= 0.01) return null;
  const p = easeOut(clamp01((t - a) / (b - a - 0.6)));
  const ver = Math.min(13, 1 + Math.round(p * 12));
  const credits = Math.round(p * 4200);
  const good = clamp01((p - 0.55) / 0.45);
  return (
    <AbsoluteFill style={{ opacity: o, justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.22em", color: SILVER, opacity: 0.75, marginBottom: u * 1.4 }}>THE ITERATION LOOP</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: u * 0.7 }}>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3, color: SILVER }}>VERSION</span>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 8.5, color: WHITE, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{ver}</span>
      </div>
      {/* quality bar terrible -> good */}
      <div style={{ position: "relative", width: u * 44, height: u * 1.5, background: "rgba(233,236,237,0.14)", marginTop: u * 1.6, borderRadius: u * 0.4, overflow: "hidden" }}>
        <div style={{ width: `${p * 100}%`, height: "100%", background: LIME }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", width: u * 44, marginTop: u * 0.7, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.0, letterSpacing: "0.12em" }}>
        <span style={{ color: SILVER, opacity: good < 0.5 ? 1 : 0.4 }}>TERRIBLE</span>
        <span style={{ color: good > 0.5 ? LIME : SILVER, opacity: good > 0.5 ? 1 : 0.4 }}>ACTUALLY GOOD</span>
      </div>
      <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.15, letterSpacing: "0.1em", color: SILVER, opacity: 0.7, marginTop: u * 2 }}>
        🔥 {credits.toLocaleString("en-US")} CREDITS BURNED
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Scene 2: CLAIMS (everyone says they can do Vox-style) ---------- */
const SceneClaims: React.FC<{ u: number; t: number; a: number; b: number }> = ({ u, t, a, b }) => {
  const o = win(t, a, b, 0.35); if (o <= 0.01) return null;
  const lt = t - a;
  const cards = [
    { x: 26, y: 34, rot: -7, at: 0.1 }, { x: 72, y: 30, rot: 6, at: 0.35 },
    { x: 34, y: 62, rot: 5, at: 0.6, dim: true }, { x: 68, y: 66, rot: -6, at: 0.85, dim: true },
  ];
  return (
    <AbsoluteFill style={{ opacity: o }}>
      {cards.map((c, i) => <ClaimCard key={i} u={u} x={c.x} y={c.y} rot={c.rot} app={ap(lt, c.at, 0.3)} dim={c.dim} />)}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ background: "rgba(9,11,17,0.72)", padding: `${u * 1.4}px ${u * 2.4}px`, borderRadius: u * 0.6, backdropFilter: "blur(2px)" }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.1, letterSpacing: "0.24em", color: SILVER, opacity: 0.7, textAlign: "center", marginBottom: u * 0.8 }}>EVERY AI CHANNEL RIGHT NOW</div>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 4.4, color: WHITE, letterSpacing: "-0.02em", textAlign: "center", lineHeight: 1.02 }}>
            "WE CAN DO <Marker u={u} t={t} at={a + 0.7} base={WHITE}>VOX-STYLE</Marker><br />WITH AI"
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ---------- Scene 3: BY HAND (the argument) ---------- */
const SceneByHand: React.FC<{ u: number; t: number; a: number; b: number }> = ({ u, t, a, b }) => {
  const o = win(t, a, b, 0.35); if (o <= 0.01) return null;
  const lt = t - a;
  const weeks = Math.min(3, 1 + Math.floor(clamp01((lt - 2.4) / 3) * 2));
  const framesPlaced = Math.round(clamp01((lt - 2.2) / 3.4) * 42);
  return (
    <AbsoluteFill style={{ opacity: o, justifyContent: "center", padding: `0 ${u * 9}%` }}>
      {/* Step 1 — generate the image (easy) */}
      <div style={{ display: "flex", alignItems: "center", gap: u * 1.4, opacity: ap(lt, 0.15) }}>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.4, color: SILVER, opacity: 0.6, width: u * 3 }}>01</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3.1, color: WHITE }}>GENERATE THE IMAGE</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: u * 0.8 }}>
          <div style={{ fontFamily: MONO, fontSize: u * 1.2, color: SILVER, opacity: 0.6 }}>seconds</div>
          <div style={{ width: u * 2.6, height: u * 2.6, borderRadius: "50%", background: LIME, color: RAISIN, fontFamily: SANS, fontWeight: 800, fontSize: u * 1.7, display: "grid", placeItems: "center" }}>✓</div>
        </div>
      </div>
      <div style={{ height: 1, background: `${SILVER}22`, margin: `${u * 2.4}px 0` }} />
      {/* Step 2 — animate it (the manual grind) */}
      <div style={{ display: "flex", alignItems: "center", gap: u * 1.4, opacity: ap(lt, 2.0) }}>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.4, color: SILVER, opacity: 0.6, width: u * 3 }}>02</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3.1, color: WHITE }}>ANIMATE IT</div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: u * 0.8 }}>
          <div style={{ fontFamily: MONO, fontSize: u * 1.2, color: "#E0B23C" }}>{weeks} week{weeks > 1 ? "s" : ""}</div>
          <div style={{ background: "#E0B23C", color: RAISIN, fontFamily: SANS, fontWeight: 800, fontSize: u * 1.35, padding: `${u * 0.35}px ${u * 0.9}px`, borderRadius: u * 0.35 }}>BY HAND</div>
        </div>
      </div>
      {/* the frame-by-frame grind bar */}
      <div style={{ display: "flex", gap: u * 0.22, marginTop: u * 1.7, marginLeft: u * 4.4, height: u * 2.2, opacity: ap(lt, 2.2) }}>
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} style={{ flex: 1, borderRadius: u * 0.12, background: i < framesPlaced ? "#E0B23C" : `${SILVER}18`, transition: "none" }} />
        ))}
      </div>
      {/* punch line */}
      <div style={{ marginTop: u * 3.4, textAlign: "center", opacity: ap(lt, 5.4) }}>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 3, letterSpacing: "-0.01em" }}>
          <span style={{ color: WHITE }}>THE HARD PART IS </span>
          <Marker u={u} t={t} at={a + 5.8} base={WHITE}>STILL 100% HUMAN</Marker>
        </span>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Scene 4: STAMP (all AI generated) ---------- */
const SceneStamp: React.FC<{ u: number; t: number; a: number; b: number }> = ({ u, t, a, b }) => {
  const o = win(t, a, b, 0.22); if (o <= 0.01) return null;
  const pop = easeOut(ap(t, a, 0.28));
  return (
    <AbsoluteFill style={{ opacity: o, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `scale(${lerp(0.82, 1, pop)}) rotate(-2deg)` }}>
        <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.3, letterSpacing: "0.3em", color: SILVER, opacity: 0.7, textAlign: "center", marginBottom: u * 0.9 }}>NO FOOTAGE. NO CAMERA.</div>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 7.5, color: WHITE, letterSpacing: "-0.02em", textAlign: "center" }}>
          <Marker u={u} t={t} at={a + 0.35} base={WHITE}>100% AI-GENERATED</Marker>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Scene 5: LOOP STUDIO (product) ---------- */
const SceneLoopStudio: React.FC<{ u: number; t: number; a: number; b: number }> = ({ u, t, a, b }) => {
  const o = win(t, a, b, 0.35); if (o <= 0.01) return null;
  const lt = t - a;
  const bob = Math.sin(lt * 3) * u * 0.3;
  return (
    <AbsoluteFill style={{ opacity: o, justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.2, letterSpacing: "0.26em", color: LIME, opacity: ap(lt, 0.1), marginBottom: u * 1.1 }}>INCLUDED IN</div>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 8.5, color: WHITE, letterSpacing: "-0.03em", transform: `scale(${lerp(0.9, 1, easeOut(ap(lt, 0.15)))})` }}>LOOP STUDIO</div>
      <div style={{ marginTop: u * 1.6, background: LIME, color: RAISIN, fontFamily: SANS, fontWeight: 800, fontSize: u * 2, letterSpacing: "0.02em", padding: `${u * 0.6}px ${u * 1.6}px`, borderRadius: u * 0.5, opacity: ap(lt, 0.9), transform: `scale(${lerp(0.85, 1, easeOut(ap(lt, 0.9)))})` }}>
        FREE UPDATE FOR OWNERS
      </div>
      <div style={{ position: "absolute", bottom: "12%", display: "flex", alignItems: "center", gap: u * 0.7, opacity: ap(lt, 1.6), transform: `translateY(${bob}px)` }}>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.5, letterSpacing: "0.14em", color: SILVER }}>↓ LINK IN THE DESCRIPTION</span>
      </div>
    </AbsoluteFill>
  );
};

export const IntroBroll: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W } = useVideoConfig();
  const u = W / 100;
  const t = frame / FPS;
  const qt = (Math.floor(frame / 2) * 2) / FPS;   // 12fps stutter on the grain
  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      <DarkBg u={u} />
      <SceneIterations u={u} t={t} a={4.6}  b={13.7} />
      <SceneClaims     u={u} t={t} a={13.9} b={20.8} />
      <SceneByHand     u={u} t={t} a={20.9} b={28.9} />
      <SceneStamp      u={u} t={t} a={29.0} b={31.0} />
      <SceneLoopStudio u={u} t={t} a={31.1} b={39.9} />
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 18}px ${u * 6}px rgba(9,11,17,0.5)`, pointerEvents: "none" }} />
      <Grain u={u} qt={qt} />
    </AbsoluteFill>
  );
};

/**
 * VoxTest — technique bake-off for the Vox-style explainer.
 * SAME script, SAME Fish VO, SAME caption/data layer. Only the VISUAL SOURCE changes:
 *   mode="canvas"   → Higgsfield stills + programmatic Ken Burns / parallax (0 credits, deterministic)
 *   mode="seedance" → Seedance 2.0 image-to-video clips
 *   mode="kling"    → Kling 3.0 Turbo image-to-video clips
 * The caption + data layer is Remotion in every version — that is the differentiator:
 * every word and number is vector-crisp and data-driven, never generated pixels.
 */
import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { clamp01, EASE_OVER, RAISIN, LIME, SILVER, SANS, MONO, WHITE } from "./bb2/scene";

const FPS = 30;
export type VoxMode = "canvas" | "seedance" | "kling";

/* scene windows (s) — equal thirds of the 15.5s VO.
   Each generated clip is 5.0s, so video scenes play at CLIP_RATE to fill 5.1667s
   without freezing on the last frame. (Bug 2026-07-22: without a <Sequence> the
   clips played at composition time, so scenes 2 and 3 were frozen stills.) */
const SCENE_DUR = 15.5 / 3;                 // 5.1667s
const CLIP_RATE = 5.0 / SCENE_DUR;          // 0.9677 — slight slow-mo, imperceptible
const SCENES = [
  { a: 0 * SCENE_DUR, still: "vox/still1.png", sd: "vox/sd1.mp4", kl: "vox/kl1.mp4" },
  { a: 1 * SCENE_DUR, still: "vox/still2.png", sd: "vox/sd2.mp4", kl: "vox/kl2.mp4" },
  { a: 2 * SCENE_DUR, still: "vox/still3.png", sd: "vox/sd3.mp4", kl: "vox/kl3.mp4" },
].map((s) => ({ ...s, b: s.a + SCENE_DUR }));

/* captions, timed to the detected silence gaps */
const CAPS: { a: number; b: number; text: string }[] = [
  { a: 0.15, b: 2.45, text: "Every AI video you've watched" },
  { a: 2.70, b: 4.60, text: "was rendered somewhere real" },
  { a: 4.85, b: 5.50, text: "Drawing power" },
  { a: 6.00, b: 11.10, text: "more electricity than entire countries" },
  { a: 11.45, b: 14.30, text: "the fastest-growing slice isn't chat" },
  { a: 14.60, b: 15.45, text: "It's video" },
];

const ap = (t: number, at: number, d = 0.3) => clamp01((t - at) / d);
const win = (t: number, a: number, b: number, f = 0.25) => ap(t, a, f) * (1 - clamp01((t - b) / f));

/* ---------- torn-paper caption chip (brand version of the Vox look) ---------- */
const Caption: React.FC<{ u: number; t: number; a: number; b: number; text: string }> = ({ u, t, a, b, text }) => {
  const o = win(t, a, b); if (o <= 0.01) return null;
  const y = (1 - ap(t, a, 0.28)) * u * 0.8;
  return (
    <div style={{ position: "absolute", left: "50%", bottom: "9%", transform: `translate(-50%, ${y}px)`, opacity: o }}>
      <div style={{
        background: SILVER, color: RAISIN, fontFamily: SANS, fontWeight: 800,
        fontSize: u * 2.5, letterSpacing: "-0.01em", padding: `${u * 0.75}px ${u * 1.6}px`,
        boxShadow: `0 ${u * 0.5}px ${u * 1.6}px rgba(0,0,0,0.5)`,
        // torn-paper edge
        clipPath: "polygon(0% 8%, 2% 0%, 12% 6%, 26% 1%, 41% 7%, 58% 2%, 73% 8%, 88% 2%, 98% 7%, 100% 92%, 96% 100%, 84% 94%, 68% 99%, 52% 93%, 36% 99%, 21% 93%, 8% 99%, 1% 91%)",
      }}>{text}</div>
    </div>
  );
};

/* ---------- THE DIFFERENTIATOR: a live, animated data figure ---------- */
const DataStat: React.FC<{ u: number; t: number; a: number; b: number }> = ({ u, t, a, b }) => {
  const o = win(t, a, b, 0.35); if (o <= 0.01) return null;
  const p = clamp01((t - a) / 1.6);
  const val = Math.round(interpolate(p, [0, 1], [0, 945], { easing: Easing.out(Easing.cubic) }));
  const bar = interpolate(p, [0, 1], [0, 1], { easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: "absolute", left: "7%", top: "16%", opacity: o }}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.1, letterSpacing: "0.2em", color: SILVER, opacity: 0.8 }}>DATA CENTRE DEMAND</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: u * 0.6, marginTop: u * 0.5 }}>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 8, color: WHITE, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{val}</span>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.6, color: LIME }}>TWh</span>
      </div>
      <div style={{ width: u * 26, height: u * 0.6, background: "rgba(233,236,237,0.18)", marginTop: u * 0.8 }}>
        <div style={{ width: `${bar * 100}%`, height: "100%", background: LIME }} />
      </div>
      <div style={{ fontFamily: MONO, fontWeight: 600, fontSize: u * 1.0, letterSpacing: "0.12em", color: SILVER, opacity: 0.65, marginTop: u * 0.5 }}>&gt; JAPAN&nbsp;&nbsp;·&nbsp;&nbsp;2026</div>
    </div>
  );
};

/* ---------- visual source per mode ----------
   Rendered INSIDE a <Sequence>, so useCurrentFrame() is LOCAL to the scene and
   every clip starts at its own frame 0. This is the fix for the frozen-scene bug. */
const Visual: React.FC<{ mode: VoxMode; i: number; u: number }> = ({ mode, i, u }) => {
  const f = useCurrentFrame();          // local to this scene
  const lt = f / FPS;                   // local seconds
  const s = SCENES[i];
  const dur = s.b - s.a;
  const fade = 0.32;
  const o = clamp01(lt / fade) * (1 - clamp01((lt - (dur - fade)) / fade));
  if (o <= 0.01) return null;

  if (mode === "canvas") {
    // programmatic Ken Burns: slow push + drift, alternating direction per scene
    const p = clamp01(lt / dur);
    const dir = i % 2 === 0 ? 1 : -1;
    const scale = interpolate(p, [0, 1], [1.04, 1.14]);
    const tx = interpolate(p, [0, 1], [0, dir * u * 1.6]);
    const ty = interpolate(p, [0, 1], [0, -u * 0.9]);
    return (
      <AbsoluteFill style={{ opacity: o }}>
        <Img src={staticFile(s.still)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale}) translate(${tx}px, ${ty}px)` }} />
      </AbsoluteFill>
    );
  }
  const src = mode === "seedance" ? s.sd : s.kl;
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <OffthreadVideo src={staticFile(src)} muted playbackRate={CLIP_RATE} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
  );
};

export const VoxTest: React.FC<{ mode?: VoxMode }> = ({ mode = "canvas" }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { width: W } = useVideoConfig();
  const u = W / 100;
  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      <Audio src={staticFile("vox/vo.wav")} />
      {SCENES.map((s, i) => (
        <Sequence key={i} from={Math.round(s.a * FPS)} durationInFrames={Math.round((s.b - s.a) * FPS) + 1} layout="none">
          <Visual mode={mode} i={i} u={u} />
        </Sequence>
      ))}

      {/* legibility scrim */}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(9,11,17,0.55) 0%, transparent 26%, transparent 58%, rgba(9,11,17,0.72) 100%)", pointerEvents: "none" }} />

      {/* the layer no generative pipeline can do: crisp text + live data */}
      <DataStat u={u} t={t} a={6.0} b={11.1} />
      {CAPS.map((c, i) => <Caption key={i} u={u} t={t} a={c.a} b={c.b} text={c.text} />)}

      {/* technique label so the three versions are distinguishable on review */}
      <div style={{ position: "absolute", right: "3%", top: "5%", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.18em", color: RAISIN, background: LIME, padding: `${u * 0.4}px ${u * 0.9}px` }}>
        {mode.toUpperCase()}
      </div>
    </AbsoluteFill>
  );
};

/**
 * VoxTestV2 — the Vox MOTION GRAMMAR applied on top of the winning visual source (Seedance).
 *
 * v1 looked good but read as a slideshow. Research (knowledge/topics/vox-style-explainer-
 * video-motion-design-transitions.md) named the six missing moves. All six are here:
 *
 *  1. PUSH-THROUGH TRANSITIONS  — scenes overlap; the camera keeps accelerating through the
 *     edit point and the next scene arrives already moving, decelerating into place. A blur
 *     peaks AT the cut so the swap happens while the frame is illegible → invisible cut.
 *     (v1 used crossfades — the amateur tell.)
 *  2. 12FPS STUTTER             — every graphic samples a quantised frame (half timeline rate).
 *     This is the single most recognisable Vox signature.
 *  3. PARALLAX DEPTH            — the graphic plane counter-drifts against the camera push, so
 *     text/data sit on a nearer depth plane instead of being glued to a flat image.
 *  4. GRAPHICS THAT EXPLAIN     — the stat is no longer a counter; it is a bar racing a labelled
 *     JAPAN reference line, and the line reacts when it is passed. It argues.
 *  5. HIGHLIGHTER               — brand `Marker` lime sweep on the load-bearing word of a caption.
 *  6. NEVER-STILL FRAME         — grain texture steps to a new offset every ~0.4s, so nothing on
 *     screen is ever completely frozen.
 */
import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { clamp01, lerp, Marker, RAISIN, LIME, SILVER, SANS, MONO, WHITE, GRAIN_URL } from "./bb2/scene";

const FPS = 30;
export type VoxMode = "canvas" | "seedance" | "kling";

const SCENE_DUR = 15.5 / 3;            // 5.1667s of narration per scene
const TR = 0.55;                        // transition overlap — the push-through window
const VIS_DUR = SCENE_DUR + TR;         // each scene stays on screen through the next one's entry
const CLIP_RATE = 5.0 / VIS_DUR;        // 0.874 — 5s source stretched over the visible window

/* Two footage sets:
   "v1" — the original clips (near-static; the code had to fake all the movement)
   "v2" — regenerated 2026-07-22 with the grammar designed in: every clip is the SAME
          constant-speed forward dolly through staged fg/mg/bg depth, so the footage
          itself carries parallax AND carries momentum through each cut. Measured motion
          went 0.0046/0.0140/0.0048 → 0.0389/0.0282/… (6-8x).
   Because v2 footage really moves, the code-side push is dialled back to near-nothing —
   it only needs to ACCELERATE at the edit, not invent the motion. */
export type FootageSet = "v1" | "v2";
const SETS: Record<FootageSet, { still: string; sd: string; kl: string; dir: number }[]> = {
  v1: [
    { still: "vox/still1.png", sd: "vox/sd1.mp4", kl: "vox/kl1.mp4", dir: 1 },
    { still: "vox/still2.png", sd: "vox/sd2.mp4", kl: "vox/kl2.mp4", dir: -1 },
    { still: "vox/still3.png", sd: "vox/sd3.mp4", kl: "vox/kl3.mp4", dir: 1 },
  ],
  v2: [
    { still: "vox/n1.png", sd: "vox/nsd1.mp4", kl: "vox/nsd1.mp4", dir: 1 },
    { still: "vox/n2.png", sd: "vox/nsd2.mp4", kl: "vox/nsd2.mp4", dir: -1 },
    { still: "vox/n3.png", sd: "vox/nsd3.mp4", kl: "vox/nsd3.mp4", dir: 1 },
  ],
};
const SCENES = SETS.v1; // used only for the parallax phase helper (geometry is identical)

/* captions, timed to the detected silence gaps. `mark` = the load-bearing word
   that gets the lime highlighter sweep. */
const CAPS: { a: number; b: number; pre: string; mark?: string; post?: string }[] = [
  { a: 0.15, b: 2.45, pre: "Every AI video you've watched" },
  { a: 2.70, b: 4.60, pre: "was rendered ", mark: "somewhere real" },
  { a: 4.85, b: 5.50, pre: "Drawing power" },
  { a: 6.00, b: 11.10, pre: "more electricity than ", mark: "entire countries" },
  { a: 11.45, b: 14.30, pre: "the fastest-growing slice ", mark: "isn't chat" },
  { a: 14.60, b: 15.45, pre: "It's ", mark: "video" },
];

const ap = (t: number, at: number, d = 0.3) => clamp01((t - at) / d);
const win = (t: number, a: number, b: number, f = 0.25) => ap(t, a, f) * (1 - clamp01((t - b) / f));
const easeOut = Easing.out(Easing.cubic);
const easeIn = Easing.in(Easing.cubic);

/* ---------------------------------------------------------------------------
   THE CAMERA — one continuous move that never stops at a cut.
   lt = seconds local to the scene. Entry (0..TR) decelerates in from a big
   scale; body pushes slowly; exit (SCENE_DUR..VIS_DUR) accelerates away again.
   The next scene's entry picks up exactly where this exit left off.
--------------------------------------------------------------------------- */
const camScale = (lt: number, live: boolean) => {
  // `live` = the footage already dollies, so the body push is near-flat and we only
  // shape the entry/exit. Otherwise the code has to supply the whole move.
  const base = live ? lerp(1.03, 1.06, clamp01(lt / SCENE_DUR)) : lerp(1.06, 1.16, clamp01(lt / SCENE_DUR));
  const inS = live ? 1.18 : 1.34;
  const outS = live ? 1.16 : 1.3;
  const entry = lerp(inS, 1.0, easeOut(clamp01(lt / TR)));             // arriving, decelerating
  const exit = lerp(1.0, outS, easeIn(clamp01((lt - SCENE_DUR) / TR))); // leaving, accelerating
  return base * entry * exit;
};
/* blur peaks AT the edit point and is shorter than the camera move — the cut hides inside it */
const camBlur = (lt: number) =>
  Math.max(1 - clamp01(lt / TR), clamp01((lt - SCENE_DUR) / TR)) * 14;

/* opacity: held flat through the body, swapped only under peak blur */
const camOpacity = (lt: number) =>
  clamp01(lt / (TR * 0.9)) * (1 - clamp01((lt - SCENE_DUR - TR * 0.1) / (TR * 0.9)));

/* the same camera phase, read globally, so the graphic plane can counter-drift against it */
const parallax = (t: number) => {
  const i = Math.min(SCENES.length - 1, Math.floor(t / SCENE_DUR));
  const lt = t - i * SCENE_DUR;
  return { p: clamp01(lt / SCENE_DUR) - 0.5, dir: SCENES[i].dir };
};

/* ---------- visual source (rendered inside a <Sequence>, so lt is local) ---------- */
const Visual: React.FC<{ mode: VoxMode; i: number; u: number; set: FootageSet }> = ({ mode, i, u, set }) => {
  const lt = useCurrentFrame() / FPS;
  const s = SETS[set][i];
  const o = camOpacity(lt);
  if (o <= 0.005) return null;

  const live = set === "v2" && mode !== "canvas";   // footage supplies its own dolly
  const scale = camScale(lt, live);
  const blur = camBlur(lt);
  const drift = (clamp01(lt / SCENE_DUR) - 0.5) * u * (live ? 0.8 : 2.4) * s.dir;
  const inner: React.CSSProperties = {
    width: "100%", height: "100%", objectFit: "cover",
    transform: `scale(${scale}) translate(${drift}px, ${-drift * 0.35}px)`,
  };

  return (
    <AbsoluteFill style={{ opacity: o, filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
      {mode === "canvas"
        ? <Img src={staticFile(s.still)} style={inner} />
        : <OffthreadVideo src={staticFile(mode === "seedance" ? s.sd : s.kl)} muted playbackRate={CLIP_RATE} style={inner} />}
    </AbsoluteFill>
  );
};

/* ---------- caption: jagged step reveal, plate first, text on a delay ---------- */
const Caption: React.FC<{ u: number; t: number; c: (typeof CAPS)[number]; px: number }> = ({ u, t, c, px }) => {
  const o = win(t, c.a, c.b); if (o <= 0.01) return null;
  // plate wipes open in 5 discrete steps (Vox lower-thirds are stepped, not smooth)
  const raw = clamp01((t - c.a) / 0.26);
  const step = Math.ceil(raw * 5) / 5;
  const txt = ap(t, c.a + 0.13, 0.12);
  const y = (1 - ap(t, c.a, 0.28)) * u * 0.8;
  return (
    <div style={{ position: "absolute", left: "50%", bottom: "9%", transform: `translate(calc(-50% + ${px}px), ${y}px)`, opacity: o }}>
      <div style={{
        background: SILVER, color: RAISIN, fontFamily: SANS, fontWeight: 800,
        fontSize: u * 2.5, letterSpacing: "-0.01em", padding: `${u * 0.75}px ${u * 1.6}px`,
        boxShadow: `0 ${u * 0.5}px ${u * 1.6}px rgba(0,0,0,0.5)`,
        transformOrigin: "left center", transform: `scaleX(${step})`,
        clipPath: "polygon(0% 8%, 2% 0%, 12% 6%, 26% 1%, 41% 7%, 58% 2%, 73% 8%, 88% 2%, 98% 7%, 100% 92%, 96% 100%, 84% 94%, 68% 99%, 52% 93%, 36% 99%, 21% 93%, 8% 99%, 1% 91%)",
      }}>
        <span style={{ display: "inline-block", transform: `scaleX(${1 / step})`, transformOrigin: "left center", opacity: txt, whiteSpace: "nowrap" }}>
          {c.pre}
          {c.mark && <Marker u={u} t={t} at={c.a + 0.45} base={RAISIN}>{c.mark}</Marker>}
          {c.post}
        </span>
      </div>
    </div>
  );
};

/* ---------- THE GRAPHIC THAT ARGUES ----------
   Not a counter. A bar racing a labelled reference line, which reacts when it is passed. */
const JAPAN = 943;
const PEAK = 1180;
const DataRace: React.FC<{ u: number; t: number; a: number; b: number; px: number }> = ({ u, t, a, b, px }) => {
  const o = win(t, a, b, 0.35); if (o <= 0.01) return null;
  const p = easeOut(clamp01((t - a) / 2.2));
  const val = Math.round(p * PEAK);
  const W = u * 30, H = u * 1.5;
  const jx = (JAPAN / PEAK) * W;                 // where the Japan line sits on the track
  const passed = clamp01((val - JAPAN) / 60);    // 0→1 as we cross it
  const flash = passed * (0.65 + 0.35 * Math.sin(t * 14));

  return (
    <div style={{ position: "absolute", left: "7%", top: "14%", opacity: o, transform: `translate(${px * 1.7}px, ${px * 0.4}px)` }}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, letterSpacing: "0.2em", color: SILVER, opacity: 0.75 }}>
        AI DATA CENTRES · ANNUAL TWh
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: u * 0.55, margin: `${u * 0.5}px 0 ${u * 2.8}px` }}>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 6.4, color: WHITE, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{val}</span>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.2, color: LIME }}>TWh</span>
      </div>

      {/* the track — the bar races the JAPAN line, which sits ON TOP so the pass is visible */}
      <div style={{ position: "relative", width: W, height: H, background: "rgba(233,236,237,0.14)" }}>
        <div style={{ width: `${p * 100}%`, height: "100%", background: LIME }} />
        <div style={{
          position: "absolute", left: jx, top: -u * 0.85, bottom: -u * 0.85,
          width: Math.max(3, u * 0.26), background: WHITE, opacity: 0.85 + flash * 0.15,
          boxShadow: `0 0 0 ${Math.max(1, u * 0.1)}px rgba(9,17,26,0.9)${flash > 0.05 ? `, 0 0 ${u * 1.6}px rgba(255,255,255,${flash})` : ""}`,
        }} />
        <div style={{
          position: "absolute", left: jx + u * 0.6, top: H + u * 1.15, whiteSpace: "nowrap",
          fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, letterSpacing: "0.14em",
          color: WHITE, background: "rgba(9,17,26,0.82)", padding: `${u * 0.3}px ${u * 0.6}px`,
        }}>
          JAPAN · 943
        </div>
      </div>

      {/* the payoff label only exists once the claim is true */}
      <div style={{ marginTop: u * 3.4, opacity: passed, transform: `translateX(${(1 - passed) * -u}px)` }}>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.5, letterSpacing: "0.04em", background: LIME, color: RAISIN, padding: `${u * 0.34}px ${u * 0.85}px` }}>
          PASSES JAPAN IN 2026
        </span>
      </div>
    </div>
  );
};

/* ---------- never-still: grain that steps to a new offset ~2.5×/s ---------- */
const LiveGrain: React.FC<{ u: number; qt: number }> = ({ u, qt }) => {
  const k = Math.floor(qt / 0.4);
  const x = (k * 37) % 140, y = (k * 61) % 140;
  return (
    <AbsoluteFill style={{
      backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 26}px ${u * 26}px`,
      backgroundPosition: `${x}px ${y}px`, opacity: 0.16, mixBlendMode: "overlay", pointerEvents: "none",
    }} />
  );
};

export const VoxTestV2: React.FC<{ mode?: VoxMode; set?: FootageSet }> = ({ mode = "seedance", set = "v1" }) => {
  const frame = useCurrentFrame();
  const { width: W } = useVideoConfig();
  const u = W / 100;

  // 12fps stutter: every graphic reads a quantised frame (half the 30fps timeline)
  const qt = (Math.floor(frame / 2) * 2) / FPS;
  // parallax: the graphic plane counter-drifts against the camera push
  const { p, dir } = parallax(qt);
  const px = -p * u * 1.5 * dir;

  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      <Audio src={staticFile("vox/vo.wav")} />

      {SCENES.map((_, i) => (
        <Sequence key={i} from={Math.round(i * SCENE_DUR * FPS)} durationInFrames={Math.round(VIS_DUR * FPS)} layout="none">
          <Visual mode={mode} i={i} u={u} set={set} />
        </Sequence>
      ))}

      {/* edge treatment — soft optical falloff so the flat frame reads as photographed */}
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 16}px ${u * 5}px rgba(9,11,17,0.55)`, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(9,11,17,0.55) 0%, transparent 26%, transparent 58%, rgba(9,11,17,0.72) 100%)", pointerEvents: "none" }} />
      <LiveGrain u={u} qt={qt} />

      {/* the layer no generative pipeline can do: crisp text + a graphic that argues */}
      <DataRace u={u} t={qt} a={6.0} b={11.1} px={px} />
      {CAPS.map((c, i) => <Caption key={i} u={u} t={qt} c={c} px={px} />)}

      <div style={{ position: "absolute", right: "3%", top: "5%", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.18em", color: RAISIN, background: LIME, padding: `${u * 0.4}px ${u * 0.9}px` }}>
        {mode.toUpperCase()} · {set === "v2" ? "V3 · NEW CLIPS" : "V2 · GRAMMAR ONLY"}
      </div>
    </AbsoluteFill>
  );
};

/**
 * VoxTestV4 — the creative pass. Fixes three notes on V3:
 *
 *  1. "every scene goes BACK a bit, then forward"
 *     V3's entry multiplier started each scene at scale 1.18 and eased DOWN to 1.0 —
 *     literally a pull-back before the push. Gone. The incoming scene now enters at
 *     0.96 and GROWS to 1.0; the outgoing pushes past to 1.12. Nothing ever retreats.
 *
 *  2. "transitions feel programmatic, not motivated by the visuals"
 *     Each cut now has a KIND that matches what the footage is actually doing, and the
 *     footage was generated to hand off:
 *       cut 0 "lift"  — S1 is pulling back and rising; S2 opens overhead. The camera
 *                       keeps travelling upward through the edit. Long, soft, blurred.
 *       cut 1 "match" — S2 ends with the lime arcs converged into a vertical line; S3
 *                       opens on a vertical lime column. Shapes align, so this is a
 *                       SHORT, near-hard cut with a 3-frame lime bloom. No mushy blur:
 *                       when the shapes match, blur would hide the trick instead of
 *                       selling it.
 *
 *  3. "everything is linear — one second in you know what happens"
 *     Three DIFFERENT camera behaviours instead of three identical dollies, each
 *     opening on something you can't yet place:
 *       S1 macro on ONE indicator light  → rapid PULL-BACK, the hall assembles
 *       S2 bird's-eye over the yard      → CRANE DOWN to eye level (axis change)
 *       S3 macro on a vertical lime bar  → pull back to reveal the wall, then PUSH IN
 *
 *  Also: cuts moved off the hard thirds (5.17s / 10.33s) — 5.17s landed mid-caption.
 *  They now sit at 5.75s and 11.28s, inside the narration's actual silence.
 */
import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { clamp01, lerp, Marker, RAISIN, LIME, SILVER, SANS, MONO, WHITE, GRAIN_URL } from "./bb2/scene";

const FPS = 30;
const TOTAL = 15.5;
export type V4Mode = "canvas" | "seedance";

/* cuts land in the VO's silence, not on arithmetic thirds */
const CUTS = [5.75, 11.28];
const BOUNDS = [0, ...CUTS, TOTAL];

type CutKind = "lift" | "match";
const CUT_KIND: CutKind[] = ["lift", "match"];
const TRANS: Record<CutKind, { dur: number; blur: number; bloom: number; hard: boolean }> = {
  lift: { dur: 0.52, blur: 13, bloom: 0.0, hard: false },  // soft — camera travels through
  // A match cut must be a HARD CUT. A dissolve shows both shots at once and destroys the
  // illusion (v4 first pass: substation + screen wall visibly ghosting). The shape
  // alignment does the work; a 2-frame swap + a brief spark is all the help it needs.
  match: { dur: 0.14, blur: 3, bloom: 0.3, hard: true },
};

const SCENES = [0, 1, 2].map((i) => {
  const a = BOUNDS[i], b = BOUNDS[i + 1];
  const outKind = CUT_KIND[i];                  // transition LEAVING this scene
  const inKind = i > 0 ? CUT_KIND[i - 1] : undefined; // transition ARRIVING at it
  const tOut = outKind ? TRANS[outKind].dur : 0;
  return { i, a, b, dur: b - a, vis: b - a + tOut, outKind, inKind, tOut };
});

const STILLS = ["vox/v4a.png", "vox/v4b.png", "vox/v4c.png"];
const CLIPS = ["vox/v4a.mp4", "vox/v4b.mp4", "vox/v4c.mp4"];

const CAPS: { a: number; b: number; pre: string; mark?: string; post?: string }[] = [
  { a: 0.15, b: 2.45, pre: "Every AI video you've watched" },
  { a: 2.70, b: 4.60, pre: "was rendered ", mark: "somewhere real" },
  { a: 4.85, b: 5.50, pre: "Drawing power" },
  { a: 6.00, b: 10.95, pre: "more electricity than ", mark: "entire countries" },
  { a: 11.45, b: 14.30, pre: "the fastest-growing slice ", mark: "isn't chat" },
  { a: 14.60, b: 15.45, pre: "It's ", mark: "video" },
];

const ap = (t: number, at: number, d = 0.3) => clamp01((t - at) / d);
const win = (t: number, a: number, b: number, f = 0.25) => ap(t, a, f) * (1 - clamp01((t - b) / f));
const easeOut = Easing.out(Easing.cubic);
const easeIn = Easing.in(Easing.cubic);

/* ---------------------------------------------------------------------------
   THE CAMERA — never retreats.
   entry: 0.96 → 1.00 (growing, arriving)      [was 1.18 → 1.00, a pull-back]
   body:  flat — the footage supplies the move
   exit:  1.00 → 1.12 (pushing past, leaving)
--------------------------------------------------------------------------- */
const camScale = (lt: number, s: (typeof SCENES)[number], live: boolean) => {
  const tIn = s.inKind ? TRANS[s.inKind].dur : 0.001;
  const entry = lerp(live ? 0.96 : 0.93, 1.0, easeOut(clamp01(lt / tIn)));
  const body = live ? 1.0 : lerp(1.0, 1.09, clamp01(lt / s.dur));
  const exitP = s.tOut ? clamp01((lt - s.dur) / s.tOut) : 0;
  const exit = lerp(1.0, live ? 1.12 : 1.18, easeIn(exitP));
  return entry * body * exit;
};

/* blur is proportional to frame width so 720p and 1080p look the same */
const camBlur = (lt: number, s: (typeof SCENES)[number], k: number) => {
  const inB = s.inKind ? (1 - clamp01(lt / TRANS[s.inKind].dur)) * TRANS[s.inKind].blur : 0;
  const outB = s.tOut ? clamp01((lt - s.dur) / s.tOut) * TRANS[s.outKind!].blur : 0;
  return Math.max(inB, outB) * k;
};

const camOpacity = (lt: number, s: (typeof SCENES)[number]) => {
  // A hard cut must swap on ONE frame: the outgoing shot has to be gone the instant the
  // incoming appears, or you see both at once and it reads as a dissolve (v4 pass 2 bug —
  // the fade started at dur+tOut-HARD, leaving the incoming at ~30% over a full outgoing).
  const HARD = 1 / FPS;
  const tIn = s.inKind ? (TRANS[s.inKind].hard ? HARD : TRANS[s.inKind].dur * 0.85) : 0.001;
  const fin = clamp01(lt / tIn);
  if (!s.tOut) return fin;
  const outHard = TRANS[s.outKind!].hard;
  const tOut = outHard ? HARD : s.tOut * 0.85;
  const start = outHard ? s.dur : s.dur + s.tOut * 0.15;   // hard: fade begins AT the cut
  return fin * (1 - clamp01((lt - start) / tOut));
};

/* the "lift" cut also carries the camera UPWARD through the edit */
const camRise = (lt: number, s: (typeof SCENES)[number], u: number) => {
  let y = 0;
  if (s.outKind === "lift" && s.tOut) y -= easeIn(clamp01((lt - s.dur) / s.tOut)) * u * 7;
  if (s.inKind === "lift") y -= (1 - easeOut(clamp01(lt / TRANS.lift.dur))) * u * 7;
  return y;
};

const Visual: React.FC<{ mode: V4Mode; s: (typeof SCENES)[number]; u: number; k: number }> = ({ mode, s, u, k }) => {
  const lt = useCurrentFrame() / FPS;
  const o = camOpacity(lt, s);
  if (o <= 0.005) return null;
  const live = mode !== "canvas";
  const blur = camBlur(lt, s, k);
  const inner: React.CSSProperties = {
    width: "100%", height: "100%", objectFit: "cover",
    transform: `scale(${camScale(lt, s, live)}) translateY(${camRise(lt, s, u)}px)`,
  };
  return (
    <AbsoluteFill style={{ opacity: o, filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
      {mode === "canvas"
        ? <Img src={staticFile(STILLS[s.i])} style={inner} />
        : <OffthreadVideo src={staticFile(CLIPS[s.i])} muted playbackRate={5.0 / s.vis} style={inner} />}
    </AbsoluteFill>
  );
};

/* the match cut's lime bloom — 3 frames, sells the shape alignment */
const Bloom: React.FC<{ t: number }> = ({ t }) => {
  const at = CUTS[1];
  // a brief SPARK on the aligned shape, not a full-frame wash (v4 first pass washed
  // the whole frame yellow — you could see straight through both shots)
  const p = 1 - clamp01(Math.abs(t - at) / 0.055);
  if (p <= 0.01) return null;
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(ellipse 11% 58% at 50% 50%, ${LIME} 0%, transparent 72%)`,
      opacity: p * TRANS.match.bloom, mixBlendMode: "screen", pointerEvents: "none",
    }} />
  );
};

const Caption: React.FC<{ u: number; t: number; c: (typeof CAPS)[number]; px: number }> = ({ u, t, c, px }) => {
  const o = win(t, c.a, c.b); if (o <= 0.01) return null;
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

const JAPAN = 943, PEAK = 1180;
const DataRace: React.FC<{ u: number; t: number; a: number; b: number; px: number }> = ({ u, t, a, b, px }) => {
  const o = win(t, a, b, 0.35); if (o <= 0.01) return null;
  const p = easeOut(clamp01((t - a) / 2.2));
  const val = Math.round(p * PEAK);
  const W = u * 30, H = u * 1.5;
  const jx = (JAPAN / PEAK) * W;
  const passed = clamp01((val - JAPAN) / 60);
  const flash = passed * (0.65 + 0.35 * Math.sin(t * 14));
  return (
    <div style={{ position: "absolute", left: "7%", top: "14%", opacity: o, transform: `translate(${px * 1.7}px, ${px * 0.4}px)` }}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, letterSpacing: "0.2em", color: SILVER, opacity: 0.75 }}>AI DATA CENTRES · ANNUAL TWh</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: u * 0.55, margin: `${u * 0.5}px 0 ${u * 2.8}px` }}>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 6.4, color: WHITE, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{val}</span>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.2, color: LIME }}>TWh</span>
      </div>
      <div style={{ position: "relative", width: W, height: H, background: "rgba(233,236,237,0.14)" }}>
        <div style={{ width: `${p * 100}%`, height: "100%", background: LIME }} />
        <div style={{ position: "absolute", left: jx, top: -u * 0.85, bottom: -u * 0.85, width: Math.max(3, u * 0.26), background: WHITE, opacity: 0.85 + flash * 0.15, boxShadow: `0 0 0 ${Math.max(1, u * 0.1)}px rgba(9,17,26,0.9)${flash > 0.05 ? `, 0 0 ${u * 1.6}px rgba(255,255,255,${flash})` : ""}` }} />
        <div style={{ position: "absolute", left: jx + u * 0.6, top: H + u * 1.15, whiteSpace: "nowrap", fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, letterSpacing: "0.14em", color: WHITE, background: "rgba(9,17,26,0.82)", padding: `${u * 0.3}px ${u * 0.6}px` }}>JAPAN · 943</div>
      </div>
      <div style={{ marginTop: u * 3.4, opacity: passed, transform: `translateX(${(1 - passed) * -u}px)` }}>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 1.5, letterSpacing: "0.04em", background: LIME, color: RAISIN, padding: `${u * 0.34}px ${u * 0.85}px` }}>PASSES JAPAN IN 2026</span>
      </div>
    </div>
  );
};

const LiveGrain: React.FC<{ u: number; qt: number }> = ({ u, qt }) => {
  const k = Math.floor(qt / 0.4);
  return <AbsoluteFill style={{ backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 26}px ${u * 26}px`, backgroundPosition: `${(k * 37) % 140}px ${(k * 61) % 140}px`, opacity: 0.16, mixBlendMode: "overlay", pointerEvents: "none" }} />;
};

export const VoxTestV4: React.FC<{ mode?: V4Mode }> = ({ mode = "seedance" }) => {
  const frame = useCurrentFrame();
  const { width: W } = useVideoConfig();
  const u = W / 100;
  const k = W / 1920;                                  // keep blur consistent at any render size
  const qt = (Math.floor(frame / 2) * 2) / FPS;        // 12fps stutter on every graphic

  const i = Math.min(2, BOUNDS.findIndex((b, n) => n > 0 && qt < b) - 1);
  const si = i < 0 ? 2 : i;
  const px = -(clamp01((qt - BOUNDS[si]) / SCENES[si].dur) - 0.5) * u * 1.5 * (si % 2 === 0 ? 1 : -1);

  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      <Audio src={staticFile("vox/vo.wav")} />
      {SCENES.map((s) => (
        <Sequence key={s.i} from={Math.round(s.a * FPS)} durationInFrames={Math.round(s.vis * FPS)} layout="none">
          <Visual mode={mode} s={s} u={u} k={k} />
        </Sequence>
      ))}
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 16}px ${u * 5}px rgba(9,11,17,0.55)`, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(9,11,17,0.55) 0%, transparent 26%, transparent 58%, rgba(9,11,17,0.72) 100%)", pointerEvents: "none" }} />
      <LiveGrain u={u} qt={qt} />
      <Bloom t={qt} />
      {/* starts AFTER the lift transition settles (6.27) and clears BEFORE the match cut
          at 11.28 — a graphic caught inside a cut smears across it */}
      <DataRace u={u} t={qt} a={6.45} b={10.8} px={px} />
      {CAPS.map((c, n) => <Caption key={n} u={u} t={qt} c={c} px={px} />)}
      <div style={{ position: "absolute", right: "3%", top: "5%", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.18em", color: RAISIN, background: LIME, padding: `${u * 0.4}px ${u * 0.9}px` }}>
        {mode.toUpperCase()} · V4
      </div>
    </AbsoluteFill>
  );
};

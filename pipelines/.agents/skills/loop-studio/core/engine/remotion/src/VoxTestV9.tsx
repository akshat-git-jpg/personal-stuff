/**
 * VoxTestV5 — ONE BIG WORLD. The transitions are no longer *hidden*, they are *eliminated*.
 *
 * The problem with V4: the clips were generated independently, so at a match cut the two
 * shapes were only ever SIMILAR, never IDENTICAL. Blur and bloom can disguise that gap —
 * they can't close it. That's why the cuts read as "clean but not perfect".
 *
 * The fix is upstream, in generation. Seedance accepts BOTH a start_image and an end_image,
 * so the clips are CHAINED through shared frames:
 *
 *     clip A : start = still 1  →  end = still 2
 *     clip B : start = still 2  →  end = still 3
 *     clip C : start = still 3  →  (free)
 *
 * Clip A's final frame and clip B's first frame are now THE SAME IMAGE. The cut is
 * pixel-identical, so it needs no blur, no bloom, no overlap and no crossfade — the camera
 * simply keeps flying. Three renders, one continuous flight through one connected world:
 *
 *     inside a server rack → out through the hall → up over the roof
 *     → down into the power yard → forward into a glowing screen → across the wall
 *
 * Everything below is therefore SIMPLER than V4, not more complex. That is the tell that
 * the fix was in the right place: a real seam costs code to hide, an absent seam costs none.
 *
 * (Retained from V4: no camera retreat, cuts on the VO's silence, 12fps graphic stutter,
 *  parallax, highlighter, live grain, and the data race that argues.)
 *
 * --- V4 header kept for the record ---
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
const TOTAL = 17.8;
export type V4Mode = "canvas" | "seedance";

/* cuts land in the VO's silence, not on arithmetic thirds */
const CUTS = [7.0, 10.75];   // in the VO breaths (MMS_FA-aligned, narrator2 final take)
const BOUNDS = [0, ...CUTS, TOTAL];

/* MONTAGE. Six shots, hard cuts on word onsets. Vignettes don't chain — each is its
   own beat, so they generate in parallel and cut hard (Vox montage grammar). Only the
   finale (through the screen → bird) keeps the chained continuity.
   from = source-seconds to skip; rate = playback speed (montage may run hot). */
// xin = short crossfade-in (frames). Used ONLY where a cut is MEANT to flow but the two
// clips aren't frame-identical (Seedance doesn't reproduce a start_image exactly — the
// chained time-lapse opens a touch wider/dimmer than the frame it continues from). A ~7f
// dissolve blends that residual mismatch. The hard montage cuts keep xin=0 on purpose.
const SHOTS: { a: number; b: number; src: string; from: number; rate: number; xin?: number }[] = [
  { a: 0.00,  b: 2.30,  src: "vox/m1.mp4",  from: 0.0, rate: 1.0  },  // hand working the mouse
  { a: 2.30,  b: 4.55,  src: "vox/v8a.mp4", from: 0.0, rate: 1.0  },  // tired face, arc begins
  { a: 4.55,  b: 7.40,  src: "vox/m2.mp4",  from: 0.0, rate: 1.35, xin: 7 },  // time-lapse: chained → dissolve the residual light/framing shift
  { a: 7.43,  b: 10.75, src: "vox/m3.mp4",  from: 0.0, rate: 1.2  },  // invoices stack + meter
  // ONE unbroken shot for the whole finale: over the shoulder → into the screen → the bird
  // takes flight. No join anywhere (v12 note: even a frame-exact join reads as a seam when
  // the playback rate changes across it). 6s source over 7.05s = gentle 0.85x slow-mo.
  { a: 10.75, b: 17.80, src: "vox/v8c.mp4", from: 0.0, rate: 6.0 / 7.05 },
];

const CAPS: { a: number; b: number; pre: string; mark?: string; post?: string }[] = [
  { a: 0.82, b: 4.40, pre: "Animation like this used to mean a motion designer" },
  { a: 4.55, b: 6.90, pre: "hunched over ", mark: "After Effects", post: " for weeks" },
  { a: 7.43, b: 9.20, pre: "It ran ", mark: "thousands of dollars" },
  { a: 9.30, b: 10.50, pre: "per finished minute" },
  { a: 11.25, b: 15.00, pre: "This one was made by one person, ", mark: "in one afternoon" },
  { a: 15.24, b: 17.80, pre: "and you're watching the ", mark: "proof" },
];

const ap = (t: number, at: number, d = 0.3) => clamp01((t - at) / d);
const win = (t: number, a: number, b: number, f = 0.25) => ap(t, a, f) * (1 - clamp01((t - b) / f));
const easeOut = Easing.out(Easing.cubic);

const OVERSCAN = 1.012;
const Visual: React.FC<{ shot: (typeof SHOTS)[number] }> = ({ shot }) => {
  const f = useCurrentFrame();                          // local to this shot's Sequence
  const o = shot.xin ? clamp01(f / shot.xin) : 1;       // fade in over the overlap frames
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <OffthreadVideo
        src={staticFile(shot.src)} muted
        startFrom={Math.round(shot.from * FPS)}
        playbackRate={shot.rate}
        style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${OVERSCAN})` }} />
    </AbsoluteFill>
  );
};

/* Bloom deleted. It existed to SELL a cut that didn't quite land; a spark on a seam that
   isn't there just draws attention to a moment the viewer should never notice. */

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

/* The graphic that ARGUES — the cost of traditional animation, counting UP while the
   camera glides over the studio floor full of desks. It reinforces the VO ("thousands of
   dollars per finished minute") rather than repeating it: the VO states the claim, the
   graphic performs the meter running. NO product/price here — the cold open must pass as
   a documentary; the reveal belongs to Luuk on camera, not to a price tag. */
const COST_PEAK = 3000;
const CostMeter: React.FC<{ u: number; t: number; a: number; b: number; px: number }> = ({ u, t, a, b, px }) => {
  const o = win(t, a, b, 0.35); if (o <= 0.01) return null;
  const p = easeOut(clamp01((t - a) / 2.6));
  const val = Math.round(p * COST_PEAK);
  const W = u * 30, H = u * 1.5;
  const hot = p > 0.985 ? 0.65 + 0.35 * Math.sin(t * 12) : 0;   // meter pegged — it pulses
  return (
    <>
      {/* the graphic carries its own darkness (a flight can't reserve empty frame space) */}
      <AbsoluteFill style={{
        background: "linear-gradient(100deg, rgba(9,11,17,0.92) 0%, rgba(9,11,17,0.82) 24%, rgba(9,11,17,0.45) 42%, transparent 58%)",
        opacity: o, pointerEvents: "none",
      }} />
    <div style={{ position: "absolute", left: "7%", top: "14%", opacity: o, transform: `translate(${px * 1.7}px, ${px * 0.4}px)` }}>
      <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, letterSpacing: "0.2em", color: SILVER, opacity: 0.75 }}>TRADITIONAL 2D ANIMATION · COST</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: u * 0.55, margin: `${u * 0.5}px 0 ${u * 2.0}px` }}>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 6.4, color: WHITE, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>${val.toLocaleString("en-US")}</span>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: u * 2.2, color: LIME }}>/ MIN</span>
      </div>
      <div style={{ position: "relative", width: W, height: H, background: "rgba(233,236,237,0.14)" }}>
        <div style={{ width: `${p * 100}%`, height: "100%", background: LIME, boxShadow: hot > 0.05 ? `0 0 ${u * 1.4}px rgba(207,255,5,${hot * 0.8})` : undefined }} />
      </div>
      <div style={{ marginTop: u * 1.0, fontFamily: MONO, fontWeight: 600, fontSize: u * 1.0, letterSpacing: "0.12em", color: SILVER, opacity: 0.65 }}>
        MOTION DESIGNER · WEEKS PER MINUTE DELIVERED
      </div>
    </div>
    </>
  );
};

const LiveGrain: React.FC<{ u: number; qt: number }> = ({ u, qt }) => {
  const k = Math.floor(qt / 0.4);
  return <AbsoluteFill style={{ backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 26}px ${u * 26}px`, backgroundPosition: `${(k * 37) % 140}px ${(k * 61) % 140}px`, opacity: 0.16, mixBlendMode: "overlay", pointerEvents: "none" }} />;
};

export const VoxTestV9: React.FC<{ mode?: V4Mode }> = ({ mode = "seedance" }) => {
  const frame = useCurrentFrame();
  const { width: W } = useVideoConfig();
  const u = W / 100;
  const qt = (Math.floor(frame / 2) * 2) / FPS;        // 12fps stutter on every graphic

    const si = Math.max(0, SHOTS.findIndex((sh) => qt < sh.b));
  const sh = SHOTS[si] ?? SHOTS[SHOTS.length - 1];
  const px = -(clamp01((qt - sh.a) / (sh.b - sh.a)) - 0.5) * u * 1.5 * (si % 2 === 0 ? 1 : -1);

  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      <Audio src={staticFile("vox/vo_v9.wav")} />
      {SHOTS.map((sh, i) => (
        // a shot with xin starts `xin` frames early and overlaps the shot before it,
        // fading in on top (crossfade). Others are hard cuts (xin undefined → 0).
        <Sequence key={i} from={Math.round(sh.a * FPS) - (sh.xin ?? 0)} durationInFrames={Math.round((sh.b - sh.a) * FPS) + (sh.xin ?? 0)} layout="none">
          <Visual shot={sh} />
        </Sequence>
      ))}
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 16}px ${u * 5}px rgba(9,11,17,0.55)`, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(9,11,17,0.55) 0%, transparent 26%, transparent 58%, rgba(9,11,17,0.72) 100%)", pointerEvents: "none" }} />
      <LiveGrain u={u} qt={qt} />
      {/* still clears before the cut — a graphic straddling a cut betrays it even when
          the footage itself is seamless */}
      <CostMeter u={u} t={qt} a={7.6} b={10.4} px={px} />
      {CAPS.map((c, n) => <Caption key={n} u={u} t={qt} c={c} px={px} />)}
      {/* review-only technique badge removed for the final render */}
    </AbsoluteFill>
  );
};

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
const TOTAL = 15.5;
export type V4Mode = "canvas" | "seedance";

/* cuts land in the VO's silence, not on arithmetic thirds */
const CUTS = [5.75, 11.28];
const BOUNDS = [0, ...CUTS, TOTAL];

/* NO transition config. The clips are chained through shared frames, so each scene owns
   exactly its own window — zero overlap, zero blur, zero bloom, zero crossfade. The last
   frame of one clip IS the first frame of the next; the camera just keeps flying. */
const SCENES = [0, 1, 2].map((i) => {
  const a = BOUNDS[i], b = BOUNDS[i + 1];
  return { i, a, b, dur: b - a };
});

/* v5a: still1 → still2   v5b: still2 → still3   v5c: still3 → free */
const STILLS = ["vox/v4a.png", "vox/v4b.png", "vox/v4c.png"];
const CLIPS = ["vox/v6a.mp4", "vox/v6b.mp4", "vox/v6c.mp4"];
const CLIP_SECS = [6, 6, 5];   // source lengths, retimed to fill each scene window

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
   THE CAMERA — there is nothing to do.
   The footage is one continuous flight and consecutive clips share a frame, so the
   code adds NO scale, NO blur, NO opacity ramp and NO rise. Every previous version
   needed those to paper over a seam; here the seam does not exist.
   `scale(1.012)` is the single exception — a hair of overscan so 720p source never
   shows a sub-pixel edge against the 1280-wide comp.
--------------------------------------------------------------------------- */
const OVERSCAN = 1.012;

const Visual: React.FC<{ mode: V4Mode; s: (typeof SCENES)[number] }> = ({ mode, s }) => {
  const inner: React.CSSProperties = {
    width: "100%", height: "100%", objectFit: "cover", transform: `scale(${OVERSCAN})`,
  };
  return (
    <AbsoluteFill>
      {mode === "canvas"
        ? <Img src={staticFile(STILLS[s.i])} style={inner} />
        // retime the source so its LAST frame lands exactly on the cut
        : <OffthreadVideo src={staticFile(CLIPS[s.i])} muted playbackRate={CLIP_SECS[s.i] / s.dur} style={inner} />}
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
    <>
      {/* One-world flight means we can no longer RESERVE empty space in the frame — the
          camera descends into the yard and fills it. So the graphic carries its own
          darkness: a soft left-edge scrim that keeps it legible over any footage. */}
      <AbsoluteFill style={{
        background: "linear-gradient(100deg, rgba(9,11,17,0.92) 0%, rgba(9,11,17,0.82) 24%, rgba(9,11,17,0.45) 42%, transparent 58%)",
        opacity: o, pointerEvents: "none",
      }} />
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
    </>
  );
};

const LiveGrain: React.FC<{ u: number; qt: number }> = ({ u, qt }) => {
  const k = Math.floor(qt / 0.4);
  return <AbsoluteFill style={{ backgroundImage: `url("${GRAIN_URL}")`, backgroundSize: `${u * 26}px ${u * 26}px`, backgroundPosition: `${(k * 37) % 140}px ${(k * 61) % 140}px`, opacity: 0.16, mixBlendMode: "overlay", pointerEvents: "none" }} />;
};

export const VoxTestV6: React.FC<{ mode?: V4Mode }> = ({ mode = "seedance" }) => {
  const frame = useCurrentFrame();
  const { width: W } = useVideoConfig();
  const u = W / 100;
  const qt = (Math.floor(frame / 2) * 2) / FPS;        // 12fps stutter on every graphic

  const i = Math.min(2, BOUNDS.findIndex((b, n) => n > 0 && qt < b) - 1);
  const si = i < 0 ? 2 : i;
  const px = -(clamp01((qt - BOUNDS[si]) / SCENES[si].dur) - 0.5) * u * 1.5 * (si % 2 === 0 ? 1 : -1);

  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      <Audio src={staticFile("vox/vo.wav")} />
      {/* each scene owns exactly its own window — no overlap, so the shared frame
          lands precisely on the cut and the two clips meet on identical pixels */}
      {SCENES.map((s) => (
        <Sequence key={s.i} from={Math.round(s.a * FPS)} durationInFrames={Math.round(s.dur * FPS)} layout="none">
          <Visual mode={mode} s={s} />
        </Sequence>
      ))}
      <AbsoluteFill style={{ boxShadow: `inset 0 0 ${u * 16}px ${u * 5}px rgba(9,11,17,0.55)`, pointerEvents: "none" }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(9,11,17,0.55) 0%, transparent 26%, transparent 58%, rgba(9,11,17,0.72) 100%)", pointerEvents: "none" }} />
      <LiveGrain u={u} qt={qt} />
      {/* still clears before the cut — a graphic straddling a cut betrays it even when
          the footage itself is seamless */}
      <DataRace u={u} t={qt} a={6.35} b={10.8} px={px} />
      {CAPS.map((c, n) => <Caption key={n} u={u} t={qt} c={c} px={px} />)}
      <div style={{ position: "absolute", right: "3%", top: "5%", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.18em", color: RAISIN, background: LIME, padding: `${u * 0.4}px ${u * 0.9}px` }}>
        {mode.toUpperCase()} · V6 · CHAINED
      </div>
    </AbsoluteFill>
  );
};

# The Remotion layer — the part no generator can do

Reference implementation: `~/.claude/skills/loop-studio/core/engine/remotion/src/VoxTestV6.tsx`
Registered in `src/index-vox.tsx` as `VoxV6` (1280×720). Copy it as the starting point.

Imports from `./bb2/scene`: `clamp01, lerp, Marker, RAISIN, LIME, SILVER, SANS, MONO, WHITE, GRAIN_URL`.

---

## Scene structure — zero overlap

Because clips are chained (each begins on the previous one's last frame), scenes must NOT overlap.
Any overlap means the shared frame doesn't land on the cut.

```tsx
const CUTS = [5.75, 11.28];              // in the VO's SILENCE, never arithmetic thirds
const BOUNDS = [0, ...CUTS, TOTAL];
const SCENES = [0,1,2].map(i => {
  const a = BOUNDS[i], b = BOUNDS[i+1];
  return { i, a, b, dur: b - a };
});
const CLIP_SECS = [6, 6, 5];             // source lengths

<Sequence from={Math.round(s.a*FPS)} durationInFrames={Math.round(s.dur*FPS)} layout="none">
  <Visual s={s} />
</Sequence>
```

`<Sequence>` is REQUIRED — without it `OffthreadVideo` plays at composition time, so later clips sit
frozen on their last frame. (This was the original frozen-scene bug: measured motion 56.6 / 10.7 / 10.2.)

## Visual — almost nothing to do

```tsx
const OVERSCAN = 1.012;   // hides sub-pixel edges from 720p source; that's ALL the code does
<OffthreadVideo
  src={staticFile(CLIPS[s.i])} muted
  playbackRate={CLIP_SECS[s.i] / s.dur}      // last frame lands ON the cut
  style={{ width:"100%", height:"100%", objectFit:"cover", transform:`scale(${OVERSCAN})` }} />
```

No blur, no bloom, no opacity ramp, no scale curve. **If you're adding transition code, the
transition is broken upstream.**

## 12fps stutter — the Vox signature

```tsx
const qt = (Math.floor(frame / 2) * 2) / FPS;   // half the 30fps timeline
```
Pass `qt` (not `frame/FPS`) to EVERY graphic component. One line, huge character shift.

## Caption — jagged step reveal + highlighter

```tsx
const raw  = clamp01((t - c.a) / 0.26);
const step = Math.ceil(raw * 5) / 5;            // 5 discrete steps, not smooth
const txt  = ap(t, c.a + 0.13, 0.12);           // text delayed behind the plate
```
Torn-paper chip: `SILVER` bg, `RAISIN` text, `clipPath` polygon for the ragged edge, counter-scale
the inner span by `1/step` so text doesn't stretch during the wipe.

Highlighter on the ONE load-bearing word:
```tsx
<Marker u={u} t={t} at={c.a + 0.45} base={RAISIN}>{c.mark}</Marker>
```
`base={RAISIN}` because the chip is silver — the default `SILVER` would be invisible on it.

## The graphic that ARGUES

Not a counter. A bar RACING a labelled reference line:
- eyebrow → big tabular number → track
- reference line drawn ON TOP of the bar with a dark outline so it stays visible when passed
- line flashes as it's crossed: `passed = clamp01((val - REF) / 60)`
- payoff tag (`PASSES JAPAN IN 2026`) appears ONLY once the claim is true: `opacity: passed`

Layout traps that cost a round: give the number a big bottom margin (`u*2.8`) or the track collides
with it; put the reference label BELOW the track (`top: H + u*1.15`) with its own dark plate, never
above where it lands in the number row.

## The graphic carries its own darkness

A continuous flight CANNOT reserve empty frame space. Don't prompt for it — scrim it:
```tsx
<AbsoluteFill style={{
  background: "linear-gradient(100deg, rgba(9,11,17,0.92) 0%, rgba(9,11,17,0.82) 24%, rgba(9,11,17,0.45) 42%, transparent 58%)",
  opacity: o,     // tied to the graphic's OWN opacity so it enters and leaves with it
}} />
```

## Timing rules

- Captions follow the VO exactly.
- **The data graphic must CLEAR before a cut** — end it ~0.5s early (e.g. `b: 10.8` for a cut at
  11.28). A graphic straddling a cut betrays it even when the footage is seamless.
- Start it AFTER the previous cut settles.

## Never-still grain

```tsx
const k = Math.floor(qt / 0.4);                 // steps ~2.5x/sec
backgroundPosition: `${(k*37)%140}px ${(k*61)%140}px`, opacity: 0.16, mixBlendMode: "overlay"
```

## Resolution independence

`u = W/100` for all sizing. If you keep any pixel-unit effect, scale it by `k = W/1920` so 720p
iteration and 1080p master look identical.

## JSX trap

`{/* comment */}` cannot go inside an arrow-function return before the element:
```tsx
{SCENES.map(s => (
  {/* ← breaks the bundle: "Expected ) but found key" */}
  <Sequence .../>
))}
```
Put the comment ABOVE the `.map(`.

import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
  continueRender,
  delayRender,
} from "remotion";
import {
  RAISIN, RAISIN_DEEP, STEEL, SILVER, SILVER_SOFT, SILVER_MID, BODY, LIME, WHITE,
  SANS, MONO, SERIF, R_SURFACE, R_INK, BgKey,
} from "./tokens";

/* ============================================================================
   fonts — clears fast, and RETRIES on stall so long renders never fail.
   The module-level delayRender re-runs whenever Remotion recycles a render
   page mid-render. On a recycled/backgrounded page the browser can throttle
   setTimeout, so the 4s fallback never fires and the handle hangs for the
   whole render timeout. `retries` makes Remotion re-render that frame on a
   fresh page instead of failing the entire render; the short per-attempt
   timeout keeps each recovery cheap.
============================================================================ */
const fontHandle = delayRender("fonts", { retries: 12, timeoutInMilliseconds: 7000 });
{
  let done = false;
  const finish = () => { if (!done) { done = true; try { continueRender(fontHandle); } catch { /* already continued */ } } };
  if (typeof document !== "undefined") {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&family=Playfair+Display:ital,wght@1,500;1,600&display=block";
    document.head.appendChild(link);
    const f: any = (document as any).fonts;
    (f && f.ready ? f.ready : Promise.resolve()).then(finish).catch(finish);
    // Multiple independent clears so a stalled font fetch / throttled timer can never
    // hang the whole render — worst case a short per-attempt timeout retries on a fresh page.
    setTimeout(finish, 900);
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(finish);
      requestAnimationFrame(() => setTimeout(finish, 500));
    }
    // Fresh-install fix: also clear synchronously. This delayRender runs at
    // webpack-startup module eval; in this headless build the async timers above
    // (setTimeout / rAF / document.fonts.ready) can fail to fire before the 5s
    // timeout, hanging EVERY render that imports this module (kit is pulled into
    // the main entry transitively). Font readiness is still guaranteed by the
    // @remotion/google-fonts loaders' own delayRenders, so clearing this
    // redundant handle immediately is safe.
    finish();
  } else finish();
}

/* ============================================================================
   helpers
============================================================================ */
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const EASE = Easing.bezier(0.2, 0.8, 0.2, 1); // brand ease — never linear
export type KF = { f: number; v: number };
export function key(frame: number, ks: KF[]) {
  return interpolate(frame, ks.map((k) => k.f), ks.map((k) => k.v), {
    easing: EASE, extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
}
export const rev = (frame: number, start: number, len = 22) => clamp((frame - start) / len, 0, 1);

/* ---------------------------------------------------------------------------
   BOLD-KINETIC motion helpers (2026-07-01)
--------------------------------------------------------------------------- */

/** IMPACT: a fast scale-punch at `hit` that spikes then decays. Multiply a
    transform scale by this. Returns 1 outside the window (no effect). */
export function impact(frame: number, hit: number, mag = 0.16, len = 8) {
  const d = frame - hit;
  if (d < 0 || d > len) return 1;
  const p = d / len;                       // 0..1
  return 1 + mag * Math.sin(p * Math.PI) * (1 - p * 0.35);
}

/** BREATH: jitter-free "living hold". A slow sine, safe on GLOWS/blur/bg only —
    never on text geometry. amp is small; period in frames. */
export const breath = (frame: number, per = 96, amp = 0.05) =>
  1 + Math.sin((frame / per) * Math.PI * 2) * amp;

/** OVERSHOOT: 0→1 that kisses slightly past 1 then settles. For element pops. */
export function overshoot(frame: number, start: number, len = 16, over = 0.08) {
  const p = clamp((frame - start) / len, 0, 1);
  const base = 1 - Math.pow(1 - p, 3);
  const bump = Math.sin(p * Math.PI) * over * (1 - p);
  return base + bump;
}

/** FLASH: a brief lime bloom over the whole frame at `hit` (impact punctuation). */
export const Flash: React.FC<{ hit: number; len?: number; color?: string; peak?: number }> = ({
  hit, len = 11, color = LIME, peak = 0.42,
}) => {
  const frame = useCurrentFrame();
  const p = clamp((frame - hit) / len, 0, 1);
  const o = frame < hit ? 0 : (1 - p) * peak;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 46%, ${color}, transparent 62%)`,
        opacity: o, mixBlendMode: "screen", pointerEvents: "none",
      }}
    />
  );
};

/** EXIT: the last `len` frames of a scene — blur + slight scale + drift out, so
    every takeover LEAVES with intent instead of a flat opacity death. Identity
    until the exit window. Applied automatically by SingleObjectStage. */
export function exitStyle(frame: number, dur: number, len = 12): React.CSSProperties {
  const q = clamp((frame - (dur - len)) / len, 0, 1);
  if (q <= 0) return {};
  return {
    transform: `scale(${1 - q * 0.04}) translateY(${q * -18}px)`,
    filter: q > 0.02 ? `blur(${q * 6}px)` : undefined,
    opacity: 1 - q * 0.15,
    willChange: "transform, filter",
  };
}

/* LAW: headlines never tick backward. runningPeak = max value reached so far. */
export function runningPeak(series: number[], p: number): number {
  if (!series || series.length === 0) return 0;
  const n = series.length;
  const idx = clamp(p, 0, 1) * (n - 1);
  const upto = Math.floor(idx);
  let mx = -Infinity;
  for (let i = 0; i <= Math.min(upto, n - 1); i++) mx = Math.max(mx, series[i]);
  if (upto < n - 1) mx = Math.max(mx, lerp(series[upto], series[upto + 1], idx - upto));
  return mx;
}

/* ============================================================================
   timing wrappers
============================================================================ */
export const Fade: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12, dur - 12, dur], [0, 1, 1, 0], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const Tilt: React.FC<{ ry?: number; rx?: number; children: React.ReactNode }> = ({ ry = 0, rx = 0, children }) => (
  <div style={{ perspective: 1700 }}>
    <div style={{ transform: `rotateY(${ry}deg) rotateX(${rx}deg)`, transformStyle: "preserve-3d" }}>{children}</div>
  </div>
);

/* ============================================================================
   CAMERA — internal. The ONLY zoom/pan rig. Comparisons can't reach it.
============================================================================ */
type Cam = { tx: number; ty: number; z: number };
const Camera: React.FC<{ cam: Cam; blur?: number; children: React.ReactNode }> = ({ cam, blur = 0, children }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          position: "absolute", left: 0, top: 0, transformOrigin: "0 0",
          transform: `translate(${width / 2}px, ${height / 2}px) scale(${cam.z}) translate(${-cam.tx}px, ${-cam.ty}px)`,
          filter: blur > 0.15 ? `blur(${blur}px)` : undefined, willChange: "transform",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

const brandBg = (bg: BgKey) => staticFile(`brand/${bg}.png`);

/* camera-move presets (single-object only). Scaled to the shot duration. */
export type Move = "push-in" | "reveal-out" | "orbit-up" | "track-up" | "dolly";
/* SETTLE-AND-HOLD: every move reaches its final value by ~50% of the shot, then
   HOLDS dead-constant. A held transform renders identically every frame, so once
   settled there is zero sub-pixel wobble. (Continuous drift = jitter.) These are
   for OBJECT scenes only — text scenes use `stable` mode and never scale at all. */
function presetKeyframes(move: Move, dur: number): { zKs: KF[]; txKs: KF[]; tyKs: KF[] } {
  const a = Math.round(dur * 0.42);   // near-final (micro-overshoot peak)
  const b = Math.round(dur * 0.58);   // settled, then HOLD
  switch (move) {
    case "reveal-out": // zoom OUT from a hub to reveal the whole thing (network)
      return {
        zKs: [{ f: 0, v: 2.3 }, { f: a, v: 0.975 }, { f: b, v: 1.0 }, { f: dur, v: 1.0 }],
        txKs: [{ f: 0, v: 960 }, { f: b, v: 975 }, { f: dur, v: 975 }],
        tyKs: [{ f: 0, v: 534 }, { f: b, v: 540 }, { f: dur, v: 540 }],
      };
    case "orbit-up": // start low, pull back and rise (3D stack), then lock
      return {
        zKs: [{ f: 0, v: 1.55 }, { f: a, v: 0.985 }, { f: b, v: 1.0 }, { f: dur, v: 1.0 }],
        txKs: [{ f: 0, v: 960 }, { f: dur, v: 960 }],
        tyKs: [{ f: 0, v: 706 }, { f: a, v: 526 }, { f: b, v: 540 }, { f: dur, v: 540 }],
      };
    case "track-up": // a real vertical crane — rise onto the subject + lock
      return {
        zKs: [{ f: 0, v: 1.14 }, { f: a, v: 0.992 }, { f: b, v: 1.0 }, { f: dur, v: 1.0 }],
        txKs: [{ f: 0, v: 960 }, { f: dur, v: 960 }],
        tyKs: [{ f: 0, v: 668 }, { f: a, v: 532 }, { f: b, v: 540 }, { f: dur, v: 540 }],
      };
    case "dolly": // a real lateral track across the subject + settle
      return {
        zKs: [{ f: 0, v: 1.07 }, { f: b, v: 1.0 }, { f: dur, v: 1.0 }],
        txKs: [{ f: 0, v: 892 }, { f: a, v: 964 }, { f: b, v: 960 }, { f: dur, v: 960 }],
        tyKs: [{ f: 0, v: 540 }, { f: dur, v: 540 }],
      };
    case "push-in":
    default: // gentle push that overshoots, settles + holds
      return {
        zKs: [{ f: 0, v: 0.95 }, { f: a, v: 1.084 }, { f: b, v: 1.06 }, { f: dur, v: 1.06 }],
        txKs: [{ f: 0, v: 960 }, { f: dur, v: 960 }],
        tyKs: [{ f: 0, v: 540 }, { f: dur, v: 540 }],
      };
  }
}

/* ============================================================================
   SingleObjectStage — for ONE focal subject. Camera move + motion blur +
   parallax/DOF background. Use for: network, chart, stack, stats, bars, hero.
============================================================================ */
export const SingleObjectStage: React.FC<{
  bg: BgKey;
  move?: Move;
  stable?: boolean;
  /** the device's natural content size in px — the stage scales it as LARGE as it
      fits (0.92 of the frame), never overflowing. Defaults to the 1920x1080 stage
      for un-annotated devices. Measure a device once and pass its real size so it
      fills a vertical short instead of sitting tiny. */
  designW?: number;
  designH?: number;
  children: React.ReactNode;
}> = ({ bg, move = "push-in", stable = false, designW = 1760, designH = 1000, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();

  // FIT-TO-FRAME: scale the content to be as large as fits the frame (with a 0.92
  // safe margin) using the device's real design size. On the 16:9 reel this is
  // ~1.0 (unchanged); on a 1080x1920 short it fills the width without overflowing.
  const fit = Math.min(1, (width * 0.92) / designW, (height * 0.92) / designH);

  // STABLE mode (text-bearing scenes): the foreground is NEVER scaled or rotated
  // by a camera, so text renders at the identical position every frame = zero
  // sub-pixel wobble. Depth/life comes from a gentle background parallax + the
  // viz's own element entrance animations. The cure for "text jitters on zoom".
  if (stable) {
    // LIVING HOLD: a slow parallax creep + a barely-there breath. Both act only
    // on the 2px-blurred background, so the (frozen) foreground text never moves.
    const bgScale = interpolate(frame, [0, durationInFrames], [1.0, 1.05], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) * breath(frame, 150, 0.01);
    return (
      <AbsoluteFill style={{ backgroundColor: RAISIN }}>
        <AbsoluteFill style={{ overflow: "hidden" }}>
          <Img src={brandBg(bg)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${bgScale})`, filter: "blur(2px)" }} />
        </AbsoluteFill>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div style={{ transform: `scale(${fit})` }}>{children}</div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  const { zKs, txKs, tyKs } = presetKeyframes(move, durationInFrames);
  const z = key(frame, zKs), zP = key(frame - 1, zKs);
  const tx = key(frame, txKs), txP = key(frame - 1, txKs);
  const ty = key(frame, tyKs), tyP = key(frame - 1, tyKs);
  // motion blur from camera velocity — capped low so small text stays legible during moves
  const blur = clamp(Math.abs(z - zP) * 110 + (Math.abs(tx - txP) + Math.abs(ty - tyP)) * 0.09 * z, 0, 6);
  const bgScale = (1 + (z - 1) * 0.18) * breath(frame, 150, 0.008); // living-hold breath (bg only)
  return (
    <AbsoluteFill style={{ backgroundColor: RAISIN }}>
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <Img src={brandBg(bg)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${bgScale})`, filter: "blur(2px)" }} />
      </AbsoluteFill>
      <Camera cam={{ tx, ty, z }} blur={blur}>
        <div style={{ position: "absolute", left: 960, top: 540, transform: `translate(-50%,-50%) scale(${fit})` }}>{children}</div>
      </Camera>
    </AbsoluteFill>
  );
};

/* ============================================================================
   ComparisonStage — for side-by-side / before-after. NO camera prop exists, so
   it is STRUCTURALLY IMPOSSIBLE to zoom a comparison. Motion = reveals only.
============================================================================ */
export const ComparisonStage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill>{children}</AbsoluteFill>
);

/* ============================================================================
   signature devices
============================================================================ */
export const Offset: React.FC<{ color?: string; dx?: number; dy?: number; radius?: number; p?: number; children: React.ReactNode }> = ({
  color = LIME, dx = 8, dy = 8, radius = R_INK, p = 1, children,
}) => (
  <div style={{ position: "relative", display: "inline-block" }}>
    <div style={{ position: "absolute", inset: 0, background: color, borderRadius: radius, transform: `translate(${dx * p}px, ${dy * p}px)`, opacity: p }} />
    <div style={{ position: "relative" }}>{children}</div>
  </div>
);

export const Eyebrow: React.FC<{ children: React.ReactNode; tick?: boolean; delay?: number }> = ({ children, tick = true, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 200 } });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontFamily: MONO, fontSize: 22, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: LIME, opacity: s, transform: `translateY(${interpolate(s, [0, 1], [10, 0])}px)` }}>
      {tick && <span style={{ width: 14, height: 14, background: LIME, display: "inline-block" }} />}
      <span>{children}</span>
    </div>
  );
};

export const Counterpoint: React.FC<{ children: React.ReactNode; delay?: number; color?: string }> = ({ children, delay = 0, color = SILVER_MID }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <div style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: 38, color, opacity: o, transform: `translateY(${interpolate(o, [0, 1], [10, 0])}px)`, lineHeight: 1.25 }}>{children}</div>;
};

/* lime highlighter marker behind one word */
export const Marker: React.FC<{ children: React.ReactNode; p: number }> = ({ children, p }) => (
  <span style={{ position: "relative", display: "inline-block", padding: "0 0.1em" }}>
    <span style={{ position: "absolute", top: "0.08em", bottom: "0.06em", left: 0, right: 0, background: LIME, transform: `rotate(-1.5deg) scaleX(${p})`, transformOrigin: "left center", zIndex: 0 }} />
    <span style={{ position: "relative", zIndex: 1, color: RAISIN }}>{children}</span>
  </span>
);

export const Headline: React.FC<{ words: string[]; size: number; markIndex?: number; delay?: number; color?: string; align?: "left" | "center" }> = ({
  words, size, markIndex = -1, delay = 0, color = WHITE, align = "left",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: `0 ${size * 0.22}px`, justifyContent: align === "center" ? "center" : "flex-start", fontFamily: SANS, fontWeight: 700, fontSize: size, letterSpacing: "-0.02em", textTransform: "uppercase", lineHeight: 1.02 }}>
      {words.map((w, i) => {
        const s = spring({ frame: frame - delay - i * 5, fps, config: { damping: 16, stiffness: 130 } });
        const blur = (1 - clamp(s, 0, 1)) * 11;
        const markP = i === markIndex ? rev(frame, delay + i * 5 + 8, 16) : 0;
        return (
          <span key={i} style={{ color, opacity: clamp(s, 0, 1), transform: `translateY(${interpolate(s, [0, 1], [44, 0])}px)`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined, display: "inline-block" }}>
            {i === markIndex ? <Marker p={markP}>{w}</Marker> : w}
          </span>
        );
      })}
    </div>
  );
};

export const NumberBadge: React.FC<{ n: string; size?: number; p?: number }> = ({ n, size = 88, p = 1 }) => (
  <Offset color={LIME} dx={9} dy={9} radius={R_INK} p={p}>
    <div style={{ width: size, height: size, background: RAISIN, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: R_INK }}>
      <span style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: size * 0.46, color: LIME, letterSpacing: "-0.02em" }}>{n}</span>
    </div>
  </Offset>
);

/* italic-900 stat number */
export const StatValue: React.FC<{ children: React.ReactNode; size?: number; color?: string }> = ({ children, size = 88, color = RAISIN }) => (
  <span style={{ fontFamily: SANS, fontWeight: 700, fontStyle: "italic", fontSize: size, letterSpacing: "-0.02em", color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{children}</span>
);

/* a headline counter that PHYSICALLY cannot count backward (running peak) */
export const MonotonicCounter: React.FC<{ series: number[]; p: number; scale?: number; prefix?: string; suffix?: string; size?: number; color?: string }> = ({
  series, p, scale = 1, prefix = "", suffix = "", size = 40, color = RAISIN,
}) => {
  const v = Math.round(runningPeak(series, p) * scale);
  return <StatValue size={size} color={color}>{prefix}{v.toLocaleString("en-US")}{suffix}</StatValue>;
};

/* re-export tokens for convenience */
export { RAISIN, RAISIN_DEEP, STEEL, SILVER, SILVER_SOFT, SILVER_MID, BODY, LIME, WHITE, SANS, MONO, SERIF, R_SURFACE, R_INK };

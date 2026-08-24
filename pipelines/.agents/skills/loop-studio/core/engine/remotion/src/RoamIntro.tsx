/**
 * RoamIntro v3 — WORLD-CANVAS register (locked hero standard) + v2 review notes applied.
 * Environment: THE HONEST PRODUCTION FLOOR — a silver draftsman canvas the camera travels:
 * WALL of AI clips (117 tries) → REGULAR-GUY promise → torn-canvas GAP → model BENCH → SKILL
 * file → full-frame REAL-COMMERCIAL takeover → dark ONE-MISTAKE room, killed on "kill it".
 * Speaker rides as a choreographed card, parked OFF every set piece. Set pieces at world scale.
 * v3 changes (Luuk v2 notes): hook opens on a stronger ad shot (startFrom 9.0) and FREEZES into
 * a still of its last clip before the wall builds (speaker held out of the transition); no
 * TAKE-01 chip anywhere; wall plates no longer overlap; "price of effortless" line removed;
 * "no experience" text → crossed ICONS; gap sides made clearer (crowd vs one); non-Luuk tiles
 * swapped for no-face details; bench tags clear of the speaker; arrowheads aligned to their
 * lines; kill-cross bold + outlined + flashed. Every event lands on a word-start.
 */
import React from "react";
import {
  AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, spring,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
} from "remotion";

const FPS = 30;
const f = (sec: number) => Math.round(sec * FPS);
export const ROAM_INTRO_FRAMES = 1598; // 53.2667s

const RAISIN = "#14121A";
const INK = "#1A1720";
const SILVER_BG = "#E9ECED";
const LIME = "#CFFF05";
const SILVER = "#E7E9EE";
const BODY = "#9AA0AF";
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const SERIF = "'Playfair Display', Georgia, serif";
const EASE = Easing.bezier(0.45, 0, 0.18, 1);

/* ============ WORLD CAMERA — [frame, centerU (world x), zoom] ============ */
const CAMK: [number, number, number, number][] = [
  [0, 50, 50, 1.14],
  [f(4.8), 50, 50, 1.14],
  [f(6.6), 50, 50, 1.0],        // pull back: the WALL
  [f(9.6), 50, 50, 1.0],
  [f(10.8), 29, 58, 1.24],      // push into the bottom-left: TEAM + MONEY viz
  [f(13.9), 29, 58, 1.24],
  [f(15.4), 47, 40, 1.0],       // pull out to frame the TRIES contact sheet
  [f(17.5), 47, 40, 1.0],
  [f(18.8), 165, 50, 1.05],     // → PROMISE
  [f(22.9), 163, 50, 1.07],
  [f(23.6), 163, 50, 1.07],
  [f(24.9), 280, 50, 1.0],      // → THE GAP
  [f(28.9), 280, 50, 1.0],
  [f(29.9), 281, 50, 1.12],
  [f(30.4), 281, 50, 1.12],
  [f(31.6), 395, 50, 1.05],     // → THE BENCH
  [f(37.9), 395, 50, 1.05],
  [f(39.0), 400, 50, 1.13],     // nudge onto the file
  [f(44.9), 400, 50, 1.13],
  [f(46.1), 520, 50, 1.02],     // → the DARK room
  [f(52.6), 521, 50, 1.12],
  [f(53.3), 521, 50, 1.12],
];
function cam(frame: number) {
  const ks = CAMK;
  if (frame <= ks[0][0]) return { c: ks[0][1], cy: ks[0][2], z: ks[0][3] };
  for (let i = 0; i < ks.length - 1; i++) {
    const [fa, ca, ya, za] = ks[i]; const [fb, cb, yb, zb] = ks[i + 1];
    if (frame >= fa && frame <= fb) {
      const t = EASE((frame - fa) / Math.max(1, fb - fa));
      return { c: ca + (cb - ca) * t, cy: ya + (yb - ya) * t, z: za + (zb - za) * t };
    }
  }
  const [, c, cy, z] = ks[ks.length - 1]; return { c, cy, z };
}

/* ============ SPEAKER CARD — one position per beat, parked OFF set pieces ============ */
// [frame, x%, y%, w%, rot°]
const SPK: [number, number, number, number, number][] = [
  [0, 39, 4, 22, 0],                  // (hidden during hook — opacity 0)
  [f(6.4), 71, 5, 22, 2],             // wall: top-right (hero freeze tile lives top-left)
  [f(9.6), 71, 5, 22, 2],
  [f(10.8), 74, 4, 18, 2],            // shrinks away while camera dives to team/money
  [f(17.6), 74, 4, 18, 2],            // holds top-right through the tries contact sheet
  [f(18.8), 52, 10, 40, 1.5],         // promise: center-top, grown
  [f(23.6), 52, 10, 40, 1.5],
  [f(24.9), 39, 3.5, 22, 0],          // gap: small, above the chasm (favors neither side)
  [f(30.4), 39, 3.5, 22, 0],
  [f(31.6), 3, 63, 26, -1.5],         // bench: bottom-left, clear of prints+tags+file
  [f(41.0), 3, 63, 26, -1.5],
  [f(42.2), 30, 15, 40, 0],           // real-commercial (behind the takeover)
  [f(44.9), 30, 15, 40, 0],
  [f(46.1), 3, 15, 27, -1.5],         // dark room: top-left, clear of the headline+stranger
  [f(52.55), 3, 15, 27, -1.5],
  [f(53.2), 8, 8, 58, 0],             // handoff grow
];
function spk(frame: number) {
  const ks = SPK;
  if (frame <= ks[0][0]) { const [, x, y, w, r] = ks[0]; return { x, y, w, r }; }
  for (let i = 0; i < ks.length - 1; i++) {
    const [fa, xa, ya, wa, ra] = ks[i]; const [fb, xb, yb, wb, rb] = ks[i + 1];
    if (frame >= fa && frame <= fb) {
      const t = EASE((frame - fa) / Math.max(1, fb - fa));
      return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, w: wa + (wb - wa) * t, r: ra + (rb - ra) * t };
    }
  }
  const [, x, y, w, r] = ks[ks.length - 1]; return { x, y, w, r };
}

const Sfx: React.FC<{ src: string; at: number; volume?: number; rate?: number }> = ({ src, at, volume = 0.2, rate = 1 }) => (
  <Sequence from={at} durationInFrames={f(1.6)}>
    <Audio src={staticFile(src)} volume={volume} playbackRate={rate} />
  </Sequence>
);
const typeOn = (frame: number, at: number, text: string, cps = 1.4) => {
  if (frame < at) return "";
  return text.slice(0, Math.min(text.length, Math.floor((frame - at) / cps)));
};

const Plate: React.FC<{ x: number; y: number; at: number; children: React.ReactNode; u: number; lime?: boolean }> =
  ({ x, y, at, children, u, lime }) => {
    const frame = useCurrentFrame();
    if (frame < at) return null;
    const p = spring({ frame: frame - at, fps: FPS, config: { damping: 15, stiffness: 170 }, durationInFrames: 15 });
    return (
      <div style={{
        position: "absolute", left: x * u, top: y * u, padding: `${u * 0.45}px ${u * 0.9}px`,
        background: lime ? LIME : INK, color: lime ? RAISIN : "#fff",
        fontFamily: MONO, fontWeight: 700, fontSize: u * 1.15, letterSpacing: "0.1em",
        borderRadius: u * 0.28, opacity: p, transform: `translateY(${(1 - p) * u * 0.9}px) rotate(${lime ? -1 : 0.6}deg)`,
        boxShadow: `0 ${u * 0.5}px ${u * 1.6}px rgba(20,18,26,0.25)`, whiteSpace: "nowrap",
      }}>{children}</div>
    );
  };

/* a "no" icon: glyph in a ring with a lime slash */
const NoIcon: React.FC<{ x: number; y: number; at: number; u: number; vh: number; label: string; kind: "crew" | "film" | "cap" }> =
  ({ x, y, at, u, vh, label, kind }) => {
    const frame = useCurrentFrame();
    if (frame < at) return null;
    const p = spring({ frame: frame - at, fps: FPS, config: { damping: 14, stiffness: 160 }, durationInFrames: 16 });
    const R = u * 3.4, S = R * 2;
    const glyph = (() => {
      if (kind === "crew") return (
        <g stroke={INK} strokeWidth={u * 0.16} fill="none" strokeLinecap="round">
          <circle cx={S * 0.36} cy={S * 0.4} r={u * 0.62} /><path d={`M ${S * 0.22} ${S * 0.66} Q ${S * 0.36} ${S * 0.52} ${S * 0.5} ${S * 0.66}`} />
          <circle cx={S * 0.64} cy={S * 0.42} r={u * 0.52} /><path d={`M ${S * 0.52} ${S * 0.64} Q ${S * 0.64} ${S * 0.52} ${S * 0.78} ${S * 0.64}`} />
        </g>);
      if (kind === "film") return (
        <g stroke={INK} strokeWidth={u * 0.16} fill="none" strokeLinejoin="round">
          <rect x={S * 0.24} y={S * 0.34} width={S * 0.52} height={S * 0.34} rx={u * 0.2} />
          <path d={`M ${S * 0.24} ${S * 0.44} L ${S * 0.76} ${S * 0.44}`} />
          <path d={`M ${S * 0.36} ${S * 0.34} L ${S * 0.44} ${S * 0.44} M ${S * 0.5} ${S * 0.34} L ${S * 0.58} ${S * 0.44}`} />
        </g>);
      return (
        <g stroke={INK} strokeWidth={u * 0.16} fill="none" strokeLinejoin="round" strokeLinecap="round">
          <path d={`M ${S * 0.5} ${S * 0.34} L ${S * 0.76} ${S * 0.46} L ${S * 0.5} ${S * 0.58} L ${S * 0.24} ${S * 0.46} Z`} />
          <path d={`M ${S * 0.68} ${S * 0.5} L ${S * 0.68} ${S * 0.64}`} />
        </g>);
    })();
    return (
      <div style={{ position: "absolute", left: x * u, top: y * vh, width: S, opacity: p, transform: `translateY(${(1 - p) * u * 1.0}px)`, textAlign: "center" }}>
        <svg width={S} height={S} style={{ display: "block" }}>
          <circle cx={S / 2} cy={S / 2} r={R - u * 0.1} fill="#fff" stroke="rgba(20,18,26,0.16)" strokeWidth={u * 0.1} />
          {glyph}
          <line x1={S * 0.2} y1={S * 0.8} x2={S * 0.8} y2={S * 0.2} stroke={LIME} strokeWidth={u * 0.42} strokeLinecap="round" />
        </svg>
        <div style={{ marginTop: u * 0.5, fontFamily: MONO, fontSize: u * 0.82, letterSpacing: "0.12em", color: INK }}>{label}</div>
      </div>
    );
  };

/* person glyph for the gap crowd */
const Person: React.FC<{ cx: number; cy: number; r: number; color: string; u: number }> = ({ cx, cy, r, color, u }) => (
  <g fill={color}>
    <circle cx={cx} cy={cy - r * 0.55} r={r * 0.42} />
    <path d={`M ${cx - r * 0.62} ${cy + r * 0.75} Q ${cx} ${cy - r * 0.1} ${cx + r * 0.62} ${cy + r * 0.75} Z`} />
  </g>
);

/* ================================ ROOT ================================ */
export const RoamIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100, vh = H / 100;

  const { c, cy, z } = cam(frame);
  const tx = W / 2 - c * u * z;
  const ty = H / 2 - cy * vh * z;
  const s = spk(frame);
  // speaker held OUT of the hook/freeze transition; fades in only once the wall exists
  const spkIn = interpolate(frame, [f(6.5), f(7.1)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const wob = Math.sin(frame / 47) * 0.22;

  return (
    <AbsoluteFill style={{ background: SILVER_BG, fontFamily: SANS }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: u * 640, height: H, transform: `translate(${tx}px, ${ty}px) scale(${z})`, transformOrigin: "0 0" }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `linear-gradient(rgba(20,18,26,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(20,18,26,0.055) 1px, transparent 1px)`,
          backgroundSize: `${u * 5}px ${u * 5}px`,
        }} />
        <WallStation u={u} vh={vh} />
        <PromiseStation u={u} vh={vh} />
        <GapStation u={u} vh={vh} />
        <BenchStation u={u} vh={vh} />
        <DarkStation u={u} vh={vh} />
      </div>

      {/* SPEAKER CARD (mounted from frame 0 for audio; visually held out until the wall) */}
      <div style={{
        position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%`,
        aspectRatio: "16/9", borderRadius: u * 0.6, overflow: "hidden",
        transform: `rotate(${s.r + wob}deg)`,
        boxShadow: `0 ${u * 1.2}px ${u * 3.6}px rgba(20,18,26,0.42), 0 0 0 1px rgba(20,18,26,0.10)`,
        opacity: spkIn,
      }}>
        <OffthreadVideo src={staticFile("roam/source.mp4")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      {/* S0: the ad plays, then FREEZES into a still of its last clip → shrinks into the wall */}
      <Sequence from={0} durationInFrames={f(6.6)}>
        <AdOpen u={u} W={W} H={H} />
      </Sequence>

      {/* S6: full-frame takeover — the covered cut */}
      <Sequence from={f(42.8)} durationInFrames={f(44.85) - f(42.8)}>
        <CoveredTakeover u={u} start={f(42.8)} end={f(44.85)} />
      </Sequence>

      {/* SOUND — landings only, soft */}
      <Sfx src="vedit/sfx/tick_soft.wav" at={f(2.36)} volume={0.22} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={f(3.28)} volume={0.22} rate={1.06} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={f(4.04)} volume={0.24} rate={1.12} />
      <Sfx src="higgs/sfx/whoosh.wav" at={f(4.8)} volume={0.12} rate={1.2} />
      {Array.from({ length: 7 }, (_, i) => (
        <Sfx key={`wt${i}`} src="vedit/sfx/tick_soft.wav" at={f(6.6) + i * 8} volume={0.08} rate={0.92 + i * 0.05} />
      ))}
      <Sfx src="vedit/sfx/tick.wav" at={f(10.96)} volume={0.15} />
      <Sfx src="vedit/sfx/tick.wav" at={f(12.4)} volume={0.15} rate={1.05} />
      <Sfx src="vedit/sfx/slide.wav" at={f(14.34)} volume={0.12} />
      <Sfx src="vedit/sfx/tap.wav" at={f(16.84)} volume={0.18} />
      <Sfx src="higgs/sfx/whoosh.wav" at={f(18.8)} volume={0.13} />
      <Sfx src="vedit/sfx/tap.wav" at={f(19.54)} volume={0.14} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={f(20.94)} volume={0.12} />
      <Sfx src="higgs/sfx/whoosh.wav" at={f(24.9)} volume={0.14} rate={0.95} />
      <Sfx src="vedit/sfx/tick.wav" at={f(25.12)} volume={0.13} />
      <Sfx src="vedit/sfx/es_swish.wav" at={f(27.3)} volume={0.16} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={f(29.14)} volume={0.16} />
      <Sfx src="higgs/sfx/whoosh.wav" at={f(31.6)} volume={0.11} rate={1.05} />
      {[0, 1, 2].map((i) => (
        <Sfx key={`mc${i}`} src="vedit/sfx/es_tick.wav" at={f(31.3) + i * 8 + 2} volume={0.17} rate={1 + i * 0.05} />
      ))}
      <Sfx src="vedit/sfx/tap.wav" at={f(40.1)} volume={0.11} />
      <Sfx src="higgs/sfx/whoosh.wav" at={f(42.8)} volume={0.16} rate={1.1} />
      <Sfx src="higgs/sfx/whoosh.wav" at={f(46.1)} volume={0.13} rate={0.9} />
      <Sfx src="vedit/sfx/es_boom.wav" at={f(45.88)} volume={0.12} />
      <Sfx src="vedit/sfx/es_boom.wav" at={f(52.62)} volume={0.2} />
      <Sfx src="vedit/sfx/es_swish.wav" at={f(52.62)} volume={0.18} rate={1.15} />
    </AbsoluteFill>
  );
};

/* ================= S0 — ad plays → freezes into a still → shrinks to the wall ================= */
const AdOpen: React.FC<{ u: number; W: number; H: number }> = ({ u, W, H }) => {
  const frame = useCurrentFrame();
  const focus = interpolate(frame, [0, 15], [1, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const freezeAt = f(4.6);
  // still rect: fullscreen → wall hero-tile rect (world 7,10,30w at pull-back pose ≈ screen)
  const m = interpolate(frame, [f(4.8), f(5.7)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const x = interpolate(m, [0, 1], [3, 7]);
  const y = interpolate(m, [0, 1], [3, 10]);
  const w = interpolate(m, [0, 1], [94, 30]);
  const stillFade = interpolate(frame, [f(5.5), f(5.85)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const vidFade = interpolate(frame, [freezeAt, freezeAt + 4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const stampFade = interpolate(frame, [f(4.35), f(4.7)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const vol = interpolate(frame, [freezeAt - 6, freezeAt], [0.15, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const STAMPS: { t: string; at: number; x: number; y: number; r: number; lime?: boolean }[] = [
    { t: "NO CAMERA", at: f(2.36), x: 7, y: 64, r: -2.5 },
    { t: "NO CREW", at: f(3.28), x: 40, y: 74, r: 1.5 },
    { t: "NO BUDGET", at: f(4.04), x: 66, y: 62, r: -1.2, lime: true },
  ];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* the freeze STILL (last clip) — starts fullscreen, shrinks to the tile */}
      <div style={{
        position: "absolute", left: `${x}%`, top: `${y}%`, width: `${w}%`, aspectRatio: "16/9",
        borderRadius: u * 0.6, overflow: "hidden", opacity: stillFade,
        boxShadow: `0 ${u * 1.4}px ${u * 4}px rgba(20,18,26,0.45), 0 0 0 1px rgba(20,18,26,0.12)`,
        filter: `blur(${focus * u * 0.3}px)`,
      }}>
        <Img src={staticFile("roam/ad_freeze.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      {/* the moving ad on top, fades out at the freeze (identical frame beneath = seamless) */}
      {frame < freezeAt + 5 && (
        <div style={{
          position: "absolute", left: "3%", top: "3%", width: "94%", aspectRatio: "16/9",
          borderRadius: u * 0.6, overflow: "hidden", opacity: vidFade, filter: `blur(${focus * u * 0.3}px)`,
        }}>
          <OffthreadVideo src={staticFile("roam/ad.mp4")} startFrom={f(9.0)} volume={vol} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      {/* eyebrow + slate stamps (fade before the shrink; never sit on the canvas) */}
      <div style={{
        position: "absolute", left: "4.4%", top: "7%", padding: `${u * 0.4}px ${u * 0.85}px`,
        fontFamily: MONO, fontSize: u * 1.0, letterSpacing: "0.2em", color: SILVER,
        background: "rgba(20,18,26,0.72)", borderRadius: u * 0.3, opacity: Math.min(stampFade, frame > f(0.7) ? 1 : 0),
      }}>{typeOn(frame, f(0.7), "ROAM — 100% AI-GENERATED")}</div>
      {STAMPS.map((st) => {
        if (frame < st.at) return null;
        const p = spring({ frame: frame - st.at, fps: FPS, config: { damping: 13, stiffness: 220 }, durationInFrames: 12 });
        return (
          <div key={st.t} style={{
            position: "absolute", left: `${st.x}%`, top: `${st.y}%`,
            fontFamily: SANS, fontWeight: 700, fontSize: u * 4.6, letterSpacing: "-0.02em",
            color: st.lime ? LIME : "#fff", opacity: Math.min(p, stampFade),
            transform: `rotate(${st.r}deg) scale(${1.18 - 0.18 * p})`, textShadow: "0 4px 34px rgba(0,0,0,0.72)",
          }}>{st.t}</div>
        );
      })}
    </AbsoluteFill>
  );
};

/* team crowd + money pile — wide, cleanly aligned (the "a team / a lot of money" set piece) */
const TeamViz: React.FC<{ u: number; vh: number; at: number }> = ({ u, vh, at }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const rows = 3, cols = 6, dx = 3.5, dy = 3.6;
  return (
    <div style={{ position: "absolute", left: u * 5, top: vh * 42 }}>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 2.8, color: INK, letterSpacing: "-0.02em", marginBottom: u * 1.1 }}>A TEAM</div>
      <svg width={u * (dx * cols + 1)} height={u * (dy * rows + 1)}>
        {Array.from({ length: rows * cols }, (_, i) => {
          const c = i % cols, r = Math.floor(i / cols);
          const pa = Math.min(1, Math.max(0, (frame - at - i * 1.1) / 8));
          if (pa <= 0) return null;
          return <g key={i} opacity={pa} transform={`translate(0 ${(1 - pa) * u * 0.7})`}><Person u={u} cx={u * (1.5 + c * dx)} cy={u * (1.7 + r * dy)} r={u * 1.4} color={INK} /></g>;
        })}
      </svg>
    </div>
  );
};
const MoneyViz: React.FC<{ u: number; vh: number; at: number }> = ({ u, vh, at }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const bills = 5, bw = 16, bh = 1.5, gap = 0.55;
  return (
    <div style={{ position: "absolute", left: u * 36, top: vh * 42 }}>
      <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 2.8, color: INK, letterSpacing: "-0.02em", marginBottom: u * 1.1 }}>A LOT OF MONEY</div>
      <svg width={u * (bw + 2)} height={u * 15.5} style={{ overflow: "visible" }}>
        {/* a neat, left-aligned stack of bills */}
        {Array.from({ length: bills }, (_, i) => {
          const pa = Math.min(1, Math.max(0, (frame - at - i * 2) / 8));
          if (pa <= 0) return null;
          const y = u * (i * (bh + gap) + 0.5);
          return (
            <g key={i} opacity={pa} transform={`translate(${(1 - pa) * u * 1.4} 0)`}>
              <rect x={u * 0.5} y={y} width={u * bw} height={u * bh} rx={u * 0.22} fill="#fff" stroke={INK} strokeWidth={u * 0.12} />
              <circle cx={u * (bw * 0.5 + 0.5)} cy={y + u * bh / 2} r={u * 0.42} fill="none" stroke={INK} strokeWidth={u * 0.1} />
            </g>
          );
        })}
        {/* a neat aligned row of coins below */}
        {[0, 1, 2, 3].map((i) => {
          const pa = Math.min(1, Math.max(0, (frame - at - bills * 2 - i * 1.5) / 8));
          if (pa <= 0) return null;
          return <circle key={i} cx={u * (1.5 + i * 2.6)} cy={u * (bills * (bh + gap) + 2)} r={u * 1.05} fill={LIME} stroke={INK} strokeWidth={u * 0.12} opacity={pa} />;
        })}
      </svg>
    </div>
  );
};

/* the amount of work: 117 generated takes, almost all binned, ONE keeper */
const TRY_IMGS = [
  "roam/ad_freeze.png", "roam/surf_frame.png", "roam/wall_02.png", "roam/wall_08.png", "roam/wall_04.png",
  "roam/wall_03.png", "roam/wall_10.png", "roam/wall_06.png", "roam/wall_00.png", "roam/wall_05.png",
  "roam/wall_07.png", "roam/wall_01.png", "roam/wall_09.png", "roam/wall_11.png", "roam/face_frame.png",
];
const TriesGrid: React.FC<{ u: number; vh: number; spinAt: number; landAt: number }> = ({ u, vh, spinAt, landAt }) => {
  const frame = useCurrentFrame();
  if (frame < spinAt - 4) return null;
  const cols = 13, rows = 9, total = 117, keeper = 71;
  const cw = 3.0, chh = cw * 9 / 16, gap = 0.32;
  const gx = 26, gy = 30; // world u (x), vh (y) for the grid origin
  const count = Math.min(total, Math.max(0, Math.floor(interpolate(frame, [spinAt, landAt], [0, total], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))));
  const landed = frame >= landAt;
  const kx = (keeper % cols) * (cw + gap), ky = Math.floor(keeper / cols) * (chh + gap);
  return (
    <div style={{ position: "absolute", left: u * gx, top: vh * gy }}>
      {/* running label */}
      <div style={{ position: "absolute", left: 0, top: -u * 3.4, fontFamily: MONO, fontSize: u * 1.25, letterSpacing: "0.2em", color: INK, whiteSpace: "nowrap" }}>
        {landed ? <>117 TAKES <span style={{ color: BODY }}>·</span> <span style={{ background: LIME, color: RAISIN, padding: `0 ${u * 0.45}px`, borderRadius: u * 0.2, fontWeight: 700 }}>1 KEEPER</span></>
                : <>GENERATING TAKES… <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{String(count).padStart(3, "0")}</span></>}
      </div>
      {Array.from({ length: total }, (_, i) => {
        const at = spinAt + i * ((landAt - spinAt - 4) / total);
        if (frame < at) return null;
        const c = i % cols, r = Math.floor(i / cols);
        const isKeep = i === keeper;
        const p = Math.min(1, (frame - at) / 3);
        const keepPop = isKeep && landed ? interpolate(frame, [landAt, landAt + 6], [1, 1.28], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
        return (
          <div key={i} style={{
            position: "absolute", left: u * (c * (cw + gap)), top: u * (r * (chh + gap)), width: u * cw, height: u * chh,
            borderRadius: u * 0.16, overflow: "hidden",
            opacity: (isKeep && landed) ? 1 : p * 0.42,
            transform: `scale(${keepPop})`, zIndex: isKeep && landed ? 6 : 1,
            boxShadow: (isKeep && landed) ? `0 0 0 ${u * 0.16}px ${LIME}, 0 ${u * 0.6}px ${u * 1.8}px rgba(20,18,26,0.45)` : "none",
          }}>
            <Img src={staticFile(TRY_IMGS[i % TRY_IMGS.length])} style={{ width: "100%", height: "100%", objectFit: "cover", filter: (isKeep && landed) ? "none" : "grayscale(1) brightness(0.72)" }} />
          </div>
        );
      })}
      {/* keeper tag */}
      {landed && (
        <div style={{ position: "absolute", left: u * (kx + cw * 0.5), top: u * (ky + chh + 0.5), fontFamily: MONO, fontWeight: 700, fontSize: u * 0.95, letterSpacing: "0.14em", color: RAISIN, background: LIME, padding: `${u * 0.25}px ${u * 0.6}px`, borderRadius: u * 0.2, opacity: interpolate(frame, [landAt + 3, landAt + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), whiteSpace: "nowrap" }}>THE ONE YOU SEE ↑</div>
      )}
    </div>
  );
};

/* ================= STATION 1 — THE WALL ================= */
const WallStation: React.FC<{ u: number; vh: number }> = ({ u, vh }) => {
  const frame = useCurrentFrame();
  // hero tile = the ad freeze still (continuous with the shrink); rest are strong/no-face clips
  const TILES: { img: string; x: number; y: number; w: number; r: number; at: number; dim?: number }[] = [
    { img: "roam/ad_freeze.png", x: 7, y: 10, w: 30, r: 0, at: f(5.6) },
    { img: "roam/wall_01.png", x: 40, y: 6, w: 20, r: 1.8, at: f(6.0) },   // his laugh
    { img: "roam/wall_02.png", x: 62, y: 10, w: 22, r: -1.4, at: f(6.3) }, // surf macro (no face)
    { img: "roam/wall_08.png", x: 41, y: 34, w: 18, r: -2.2, at: f(7.2) }, // scooter macro (no face)
    { img: "roam/wall_03.png", x: 7, y: 48, w: 21, r: 1.2, at: f(7.5) },   // rocks feet (no face)
    { img: "roam/wall_10.png", x: 30, y: 56, w: 17, r: 2.0, at: f(7.8) },  // surf board (no face)
    { img: "roam/wall_04.png", x: 61, y: 38, w: 17, r: 1.6, at: f(8.1) },  // rain macro (no face)
    { img: "roam/wall_09.png", x: 80, y: 30, w: 16, r: -1.8, at: f(8.4), dim: 0.85 }, // his hat-tip
    { img: "roam/wall_06.png", x: 49, y: 66, w: 18, r: -1.2, at: f(8.7), dim: 0.7 },  // rock spray (no face)
    { img: "roam/wall_11.png", x: 86, y: 6, w: 12, r: 2.4, at: f(9.0), dim: 0.7 },    // his laugh
    { img: "roam/wall_05.png", x: 70, y: 62, w: 15, r: 1.0, at: f(9.3), dim: 0.6 },   // market feet (no face)
    { img: "roam/wall_07.png", x: 20, y: 30, w: 16, r: -1.6, at: f(9.6), dim: 0.7 },  // market lights (no face)
    { img: "roam/wall_00.png", x: 88, y: 52, w: 11, r: -2.0, at: f(9.9), dim: 0.55 }, // wave spray (distant)
  ];
  const spinAt = f(14.34), landAt = f(16.84);
  const tileAtten = interpolate(frame, [f(10.6), f(11.4)], [1, 0.16], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) * interpolate(frame, [f(13.9), f(14.8)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const vizAtten = interpolate(frame, [f(13.9), f(14.6)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const count = Math.floor(interpolate(frame, [spinAt, landAt], [1, 117], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }));
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: u * 100, height: vh * 100 }}>
      <div style={{
        position: "absolute", left: u * 40, top: vh * 3, fontFamily: MONO, fontSize: u * 1.1,
        letterSpacing: "0.26em", color: INK, opacity: 0.85 * tileAtten,
      }}>{typeOn(frame, f(7.6), "THE CRAZY AI VIDEOS ONLINE")}</div>
      {TILES.map((t, i) => {
        if (frame < t.at) return null;
        const p = spring({ frame: frame - t.at, fps: FPS, config: { damping: 14, stiffness: 150 }, durationInFrames: 18 });
        const kb = 1 + 0.04 * Math.min(1, (frame - t.at) / 300);
        return (
          <div key={i} style={{
            position: "absolute", left: u * t.x, top: vh * t.y, width: u * t.w, aspectRatio: "16/9",
            borderRadius: u * 0.45, overflow: "hidden",
            opacity: p * (t.dim ?? 1) * tileAtten, transform: `translateY(${(1 - p) * u * 1.6}px) rotate(${t.r}deg)`,
            boxShadow: `0 ${u * 0.8}px ${u * 2.4}px rgba(20,18,26,0.30), 0 0 0 1px rgba(20,18,26,0.10)`,
          }}>
            <Img src={staticFile(t.img)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${kb})` }} />
          </div>
        );
      })}
      {/* THE TEAM (a crowd) + THE MONEY (a pile) — camera dives into the bottom-left here */}
      <div style={{ opacity: vizAtten }}>
        <TeamViz u={u} vh={vh} at={f(10.96)} />
        <MoneyViz u={u} vh={vh} at={f(12.4)} />
      </div>
      {/* THE TRIES — a contact sheet of 117 takes, almost all rejected, one keeper */}
      <TriesGrid u={u} vh={vh} spinAt={spinAt} landAt={landAt} />
    </div>
  );
};

/* ================= STATION 2 — THE PROMISE (world x 115..215) ================= */
const PromiseStation: React.FC<{ u: number; vh: number }> = ({ u, vh }) => {
  const frame = useCurrentFrame();
  const X = 115, hAt = f(19.54);
  const hp = frame >= hAt ? spring({ frame: frame - hAt, fps: FPS, config: { damping: 15, stiffness: 140 }, durationInFrames: 20 }) : 0;
  return (
    <div style={{ position: "absolute", left: u * X, top: 0, width: u * 100, height: vh * 100 }}>
      {/* A regular GUY. — world-scale type (no TAKE flip) */}
      {frame >= hAt && (
        <div style={{
          position: "absolute", left: u * 8, top: vh * 30, opacity: hp, transform: `translateY(${(1 - hp) * u * 1.6}px)`,
          fontFamily: SANS, fontWeight: 700, fontSize: u * 7.6, letterSpacing: "-0.03em", color: INK, lineHeight: 1.02,
        }}>
          A <span style={{ fontFamily: SERIF, fontStyle: "italic", background: LIME, color: RAISIN, padding: `0 ${u * 0.7}px`, borderRadius: u * 0.3 }}>regular</span><br />GUY.
        </div>
      )}
      {/* icons replace the boring "no experience / no crew / no film school" text */}
      <NoIcon u={u} vh={vh} x={8} y={66} at={f(20.94)} kind="cap" label="NO EXPERIENCE" />
      <NoIcon u={u} vh={vh} x={18.5} y={66} at={f(21.36)} kind="crew" label="NO CREW" />
      <NoIcon u={u} vh={vh} x={29} y={66} at={f(21.72)} kind="film" label="NO FILM SCHOOL" />
    </div>
  );
};

/* ================= STATION 3 — THE GAP (world x 230..330) ================= */
const GapStation: React.FC<{ u: number; vh: number }> = ({ u, vh }) => {
  const frame = useCurrentFrame();
  const X = 230, inAt = f(25.12), strikeAt = f(27.3), brAt = f(29.14);
  const inP = frame >= inAt ? spring({ frame: frame - inAt, fps: FPS, config: { damping: 15, stiffness: 140 }, durationInFrames: 18 }) : 0;
  const chasm = interpolate(frame, [inAt, inAt + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
  const strike = interpolate(frame, [strikeAt, strikeAt + 9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const br = interpolate(frame, [brAt, brAt + 11], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const w = u * 100, h = vh * 100, chasmW = u * 14 * chasm;
  return (
    <div style={{ position: "absolute", left: u * X, top: 0, width: w, height: h }}>
      {/* two clearly separated zones: THEM (muted grey) | YOU (bright) */}
      <div style={{ position: "absolute", left: 0, top: 0, width: u * 47, height: h, background: "rgba(20,18,26,0.06)", opacity: inP }} />
      <div style={{ position: "absolute", left: u * 55, top: 0, width: u * 45, height: h, background: "rgba(207,255,5,0.05)", opacity: inP }} />
      {/* the chasm splits them */}
      <div style={{
        position: "absolute", left: u * 50 - chasmW / 2, top: 0, width: chasmW, height: h,
        background: RAISIN, transform: "rotate(1.2deg) scaleY(1.1)", boxShadow: `inset 0 0 ${u * 3}px rgba(0,0,0,0.75)`,
      }} />
      {/* NOT REPEATABLE (light side, struck) */}
      {frame >= inAt && (
        <div style={{
          position: "absolute", left: u * 5, top: vh * 6, opacity: inP,
          fontFamily: SANS, fontWeight: 700, fontSize: u * 4.0, letterSpacing: "-0.02em", color: INK,
        }}>
          <span style={{ position: "relative", display: "inline-block" }}>
            NOT REPEATABLE
            <span style={{ position: "absolute", left: "-1%", top: "52%", height: u * 0.4, width: `${strike * 103}%`, background: LIME, borderRadius: u * 0.2, transform: "rotate(-1.6deg)", boxShadow: `0 0 ${u * 0.8}px rgba(207,255,5,0.55)` }} />
          </span>
        </div>
      )}
      {/* THEM — a CROWD (many people) + weeks */}
      {frame >= inAt && (
        <div style={{ position: "absolute", left: u * 5, top: vh * 26, opacity: inP }}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 4.6, color: INK, opacity: 0.42, letterSpacing: "-0.02em" }}>THEM</div>
          <svg width={u * 34} height={u * 12} style={{ display: "block", marginTop: u * 0.6, opacity: 0.5 }}>
            {Array.from({ length: 10 }, (_, i) => (
              <Person key={i} u={u} cx={u * (2.2 + (i % 5) * 3.2)} cy={u * (3 + Math.floor(i / 5) * 5.4)} r={u * 2.0} color={INK} />
            ))}
          </svg>
          <div style={{ marginTop: u * 0.6, display: "inline-block", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.9, background: INK, color: "#fff", padding: `${u * 0.4}px ${u * 0.9}px`, borderRadius: u * 0.3, opacity: 0.7 }}>WEEKS OF WORK</div>
        </div>
      )}
      {/* YOU — ONE person, bright, lime */}
      {frame >= inAt + 5 && (() => {
        const p = spring({ frame: frame - inAt - 5, fps: FPS, config: { damping: 15, stiffness: 140 }, durationInFrames: 18 });
        return (
          <div style={{ position: "absolute", left: u * 63, top: vh * 26, opacity: p }}>
            <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: u * 4.6, color: RAISIN, background: LIME, display: "inline-block", padding: `0 ${u * 0.6}px`, borderRadius: u * 0.3, letterSpacing: "-0.02em" }}>YOU</div>
            <svg width={u * 10} height={u * 12} style={{ display: "block", marginTop: u * 0.6 }}>
              <Person u={u} cx={u * 4.4} cy={u * 6} r={u * 4.2} color={INK} />
            </svg>
            <div style={{ marginTop: u * 0.2, display: "inline-block", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.9, background: LIME, color: RAISIN, padding: `${u * 0.4}px ${u * 0.9}px`, borderRadius: u * 0.3, boxShadow: `0 ${u * 0.5}px ${u * 1.6}px rgba(20,18,26,0.25)` }}>ONE AFTERNOON</div>
          </div>
        );
      })()}
      {/* the gap bracket */}
      {frame >= brAt && (() => {
        const y = vh * 84, x1 = u * 37, x2 = u * 63, mid = (x1 + x2) / 2, half = ((x2 - x1) / 2) * br;
        return (
          <>
            <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
              <line x1={mid - half} y1={y} x2={mid + half} y2={y} stroke={LIME} strokeWidth={u * 0.2} strokeLinecap="round" />
              <line x1={mid - half} y1={y - u * 0.9} x2={mid - half} y2={y + u * 0.9} stroke={LIME} strokeWidth={u * 0.2} strokeLinecap="round" />
              <line x1={mid + half} y1={y - u * 0.9} x2={mid + half} y2={y + u * 0.9} stroke={LIME} strokeWidth={u * 0.2} strokeLinecap="round" />
            </svg>
            <div style={{ position: "absolute", left: mid - u * 8, top: y + u * 1.2, width: u * 16, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: u * 1.5, letterSpacing: "0.34em", color: "#fff", opacity: br }}>THE GAP</div>
          </>
        );
      })()}
    </div>
  );
};

/* ================= STATION 4 — THE BENCH + THE SKILL (world x 345..445) ================= */
const BenchStation: React.FC<{ u: number; vh: number }> = ({ u, vh }) => {
  const frame = useCurrentFrame();
  const X = 345, inAt = f(31.3), cardAt = f(31.8), knowAt = f(33.5), fileAt = f(38.2), pulseAt = f(40.1);
  const PRINTS = [
    { img: "roam/hat_sheet.png", model: "GPT IMAGE 2", job: "THE PRODUCT", x: 6, r: -2.0 },
    { img: "roam/wall_02.png", model: "SEEDANCE 2.0", job: "THE MOTION", x: 37, r: 1.4 },
    { img: "roam/face_frame.png", model: "SOUL", job: "YOUR FACE", x: 68, r: -1.2 },
  ];
  // prints across the TOP; tags directly under each print; file bottom-CENTER; speaker bottom-LEFT (clear)
  const pw = 22, py = 8, tagY = py + pw * 9 / 16 * (1.777) + 3.2; // vh under the print
  const fileP = frame >= fileAt ? spring({ frame: frame - fileAt, fps: FPS, config: { damping: 14, stiffness: 140 }, durationInFrames: 20 }) : 0;
  const pulse = 1 + (frame >= pulseAt ? 0.05 * Math.exp(-(frame - pulseAt) / 5) : 0);
  const w = u * 100, h = vh * 100, fileX = 40, fileY = 64, fileW = 30;
  return (
    <div style={{ position: "absolute", left: u * X, top: 0, width: w, height: h }}>
      <div style={{
        position: "absolute", left: u * 34, top: vh * 2.5, fontFamily: MONO, fontSize: u * 1.2, letterSpacing: "0.3em", color: INK,
        opacity: frame >= inAt ? Math.min(1, (frame - inAt) / 10) * 0.85 : 0,
      }}>SAME MODELS — <span style={{ background: LIME, color: RAISIN, padding: `0 ${u * 0.5}px`, borderRadius: u * 0.2, fontWeight: 700 }}>DIFFERENT JOBS</span></div>
      {/* connectors → file (each arrowhead aligned to its own line's angle) */}
      {frame >= fileAt && (
        <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
          {PRINTS.map((pr, i) => {
            const t = interpolate(frame, [fileAt + i * 3, fileAt + i * 3 + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE });
            if (t <= 0) return null;
            const sx = u * (pr.x + pw / 2), sy = vh * py + u * pw * 9 / 16 + vh * 7.5;
            const ex = u * (fileX + fileW / 2 + (i - 1) * 7), ey = vh * fileY - u * 0.6;
            const cx = sx + (ex - sx) * t, cy = sy + (ey - sy) * t;
            const ang = (Math.atan2(ey - sy, ex - sx) * 180) / Math.PI;
            return (
              <g key={i}>
                <line x1={sx} y1={sy} x2={cx} y2={cy} stroke={INK} strokeWidth={u * 0.16} strokeLinecap="round" opacity={0.68} />
                {t > 0.9 && (
                  <g transform={`translate(${ex} ${ey}) rotate(${ang})`} opacity={0.68}>
                    <path d={`M ${-u * 1.2} ${-u * 0.6} L 0 0 L ${-u * 1.2} ${u * 0.6}`} stroke={INK} strokeWidth={u * 0.16} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {PRINTS.map((pr, i) => {
        const at = cardAt + i * 7;
        if (frame < at) return null;
        const op = interpolate(frame, [at, at + 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const pop = interpolate(frame, [at, at + 2, at + 9], [0.86, 1.05, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const ringWin = frame >= knowAt + i * 20 && frame < knowAt + (i + 1) * 20 + 8;
        const known = frame >= knowAt + i * 20;
        return (
          <div key={pr.model}>
            <div style={{
              position: "absolute", left: u * pr.x, top: vh * py, width: u * pw, background: "#fff", padding: `${u * 0.7}px`, borderRadius: u * 0.4,
              opacity: op, transform: `scale(${pop}) rotate(${pr.r}deg)`,
              boxShadow: `0 ${u * 1.1}px ${u * 3.2}px rgba(20,18,26,0.35), 0 0 0 ${ringWin ? u * 0.16 : 0}px ${LIME}`,
            }}>
              <div style={{ width: "100%", aspectRatio: "16/9", overflow: "hidden", borderRadius: u * 0.2 }}>
                <Img src={staticFile(pr.img)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: known ? "none" : "grayscale(0.5) brightness(0.94)" }} />
              </div>
              <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, color: INK, letterSpacing: "0.12em", marginTop: u * 0.5 }}>{pr.model}</div>
            </div>
            {known && (
              <div style={{
                position: "absolute", left: u * (pr.x + 2), top: vh * tagY,
                fontFamily: MONO, fontWeight: 700, fontSize: u * 1.25, letterSpacing: "0.14em",
                background: LIME, color: RAISIN, padding: `${u * 0.35}px ${u * 0.8}px`, borderRadius: u * 0.25,
                transform: `rotate(${-pr.r * 0.7}deg)`, opacity: Math.min(1, (frame - (knowAt + i * 20)) / 8),
                boxShadow: `0 ${u * 0.4}px ${u * 1.4}px rgba(20,18,26,0.25)`,
              }}>{pr.job}</div>
            )}
          </div>
        );
      })}
      {frame >= fileAt && (
        <div style={{
          position: "absolute", left: u * fileX, top: vh * fileY, width: u * fileW, background: INK, borderRadius: u * 0.7,
          padding: `${u * 1.1}px ${u * 1.4}px`, display: "flex", alignItems: "center", gap: u * 1.1,
          opacity: fileP, transform: `translateY(${(1 - fileP) * u * 2}px) scale(${pulse})`, boxShadow: `0 ${u * 1.2}px ${u * 3.4}px rgba(20,18,26,0.45)`,
        }}>
          <Img src={staticFile("higgs/claude.png")} style={{ width: u * 3.2, height: u * 3.2, objectFit: "contain" }} />
          <div>
            <div style={{ fontFamily: MONO, fontSize: u * 0.85, color: BODY, letterSpacing: "0.12em" }}>roam-make</div>
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: u * 1.7, color: "#fff" }}>SKILL<span style={{ color: LIME }}>.md</span></div>
            <div style={{ fontFamily: MONO, fontSize: u * 0.8, color: BODY, letterSpacing: "0.08em", marginTop: u * 0.15 }}>does most of the work for you</div>
          </div>
        </div>
      )}
      {/* sponsor logo — bottom-right */}
      {frame >= inAt && (
        <div style={{ position: "absolute", left: u * 80, top: vh * 78, display: "flex", alignItems: "center", gap: u * 0.7, opacity: Math.min(1, (frame - inAt) / 12) }}>
          <Img src={staticFile("higgs/higgsfield.png")} style={{ width: u * 3.0, height: u * 3.0, objectFit: "contain", borderRadius: u * 0.5 }} />
          <div style={{ fontFamily: MONO, fontSize: u * 0.9, letterSpacing: "0.2em", color: INK, opacity: 0.7 }}>HIGGSFIELD</div>
        </div>
      )}
    </div>
  );
};

/* ================= STATION 5 — DARK ROOM: ONE MISTAKE (world x 460..580) ================= */
const DarkStation: React.FC<{ u: number; vh: number }> = ({ u, vh }) => {
  const frame = useCurrentFrame();
  const X = 460, headAt = f(45.88), strangerAt = f(48.04), killAt = f(52.4);
  const headP = frame >= headAt ? spring({ frame: frame - headAt, fps: FPS, config: { damping: 15, stiffness: 150 }, durationInFrames: 16 }) : 0;
  const sIn = frame >= strangerAt ? spring({ frame: frame - strangerAt, fps: FPS, config: { damping: 15, stiffness: 130 }, durationInFrames: 20 }) : 0;
  const killT = interpolate(frame, [killAt, killAt + 7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const flash = interpolate(frame, [killAt, killAt + 2, killAt + 8], [0, 0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const drop = interpolate(frame, [killAt + 9, killAt + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const w = u * 120, h = vh * 100, sx = 46, sy = 20, sw = 40;
  return (
    <div style={{ position: "absolute", left: u * X, top: 0, width: w, height: h }}>
      <div style={{ position: "absolute", inset: 0, background: RAISIN }} />
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `linear-gradient(rgba(207,255,5,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(207,255,5,0.035) 1px, transparent 1px)`,
        backgroundSize: `${u * 5}px ${u * 5}px`,
      }} />
      {frame >= headAt && (
        <>
          <div style={{ position: "absolute", left: u * 20, top: vh * 54, fontFamily: MONO, fontSize: u * 1.15, letterSpacing: "0.26em", color: BODY, opacity: headP * 0.9 }}>MAKES ALL OF THIS LOOK AI-ISH</div>
          <div style={{
            position: "absolute", left: u * 20, top: vh * 62, opacity: headP, transform: `translateY(${(1 - headP) * u * 1.6}px)`,
            fontFamily: SANS, fontWeight: 700, fontSize: u * 8.4, letterSpacing: "-0.03em", lineHeight: 0.98, color: SILVER,
          }}>ONE<br /><span style={{ color: LIME }}>MISTAKE</span></div>
        </>
      )}
      {/* the stranger print */}
      {frame >= strangerAt && drop < 1 && (
        <div style={{
          position: "absolute", left: u * sx, top: vh * sy + drop * vh * 80, width: u * sw, background: "#fff", padding: `${u * 0.8}px`, borderRadius: u * 0.45,
          opacity: sIn * (1 - drop), transform: `rotate(${2 + drop * 16}deg) translateY(${(1 - sIn) * u * 2.4}px)`, boxShadow: `0 ${u * 1.4}px ${u * 4.2}px rgba(0,0,0,0.6)`,
        }}>
          <div style={{ width: "100%", aspectRatio: "16/9", overflow: "hidden", borderRadius: u * 0.2, position: "relative" }}>
            <Img src={staticFile("roam/stranger.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", left: u * 1.0, bottom: u * 1.0, padding: `${u * 0.4}px ${u * 0.85}px`, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.3, letterSpacing: "0.12em", background: RAISIN, color: LIME, borderRadius: u * 0.28 }}>NOT ME.</div>
          </div>
        </div>
      )}
      {/* the KILL — bold, dark-outlined, flashed X across the print */}
      {frame >= killAt && drop < 1 && (
        <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
          {([[sx - 3, sy - 5, sx + sw + 3, sy + 41], [sx + sw + 3, sy - 5, sx - 3, sy + 41]] as const).map(([x1, y1, x2, y2], k) => {
            const ex = x1 + (x2 - x1) * killT, ey = y1 + (y2 - y1) * killT;
            return (
              <g key={k}>
                <line x1={u * x1} y1={vh * y1} x2={u * ex} y2={vh * ey} stroke={RAISIN} strokeWidth={u * 1.1} strokeLinecap="round" />
                <line x1={u * x1} y1={vh * y1} x2={u * ex} y2={vh * ey} stroke={LIME} strokeWidth={u * 0.6} strokeLinecap="round" />
              </g>
            );
          })}
        </svg>
      )}
      {flash > 0 && <AbsoluteFill style={{ background: LIME, opacity: flash }} />}
      {frame >= killAt + 8 && (
        <div style={{ position: "absolute", left: u * 52, top: vh * 40, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.7, letterSpacing: "0.3em", color: LIME, opacity: Math.min(1, (frame - killAt - 8) / 8) }}>KILLED ▸ IN THIS VIDEO</div>
      )}
    </div>
  );
};

/* ================= S6 — full-frame takeover: the covered cut ================= */
const CoveredTakeover: React.FC<{ u: number; start: number; end: number }> = ({ u, start, end }) => {
  const frame = useCurrentFrame();
  const dur = end - start;
  const inP = interpolate(frame, [0, 4], [0, 1], { extrapolateRight: "clamp" });
  const outP = interpolate(frame, [dur - 4, dur], [1, 0], { extrapolateLeft: "clamp" });
  const sc = 1.0 + 0.03 * interpolate(frame, [0, dur], [0, 1], { easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: Math.min(inP, outP), background: RAISIN }}>
      <AbsoluteFill style={{ transform: `scale(${sc})` }}>
        <OffthreadVideo src={staticFile("roam/ad.mp4")} startFrom={f(16.0)} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <div style={{ position: "absolute", right: u * 3.2, bottom: u * 3.0, fontFamily: MONO, fontWeight: 700, fontSize: u * 1.05, letterSpacing: "0.24em", color: RAISIN, padding: `${u * 0.4}px ${u * 0.85}px`, background: LIME, borderRadius: u * 0.3 }}>A REAL COMMERCIAL</div>
    </AbsoluteFill>
  );
};

export default RoamIntro;

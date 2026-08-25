/**
 * HiggsIntro v2 — bespoke edit, revised per Luuk's feedback (2026-07-02):
 *  · Hook now shows real thumbnails appearing as he says "my thumbnails" — catchy, clean
 *  · "ever again." toned down: gentle serif fade, no slam/shake/boom
 *  · CTR slash kept exactly (loved)
 *  · SKILL.md card REPLACED by the evolution beat: 0.9%-CTR old thumbnail → 7.1% new one
 *    ("took me multiple days to get to this level" — the level-up made visible)
 *  · Brain node now uses the Claude spark (not the Anthropic wordmark)
 *  · Thumbnail flow + cascade kept (loved), overall aggression dialed down
 */
import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, spring,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
} from "remotion";

const FPS = 30;
const f = (sec: number) => Math.round(sec * FPS);

const RAISIN = "#0F121A";
const LIME = "#CFFF05";
const SILVER = "#B5BFC2";
const CLAY = "#D97757";
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const SERIF = "'Playfair Display', Georgia, serif";

// ---------- global camera ----------
const CAM: [number, number, number, number][] = [
  [0, 1.14, 0, 8],
  [f(2.75), 1.04, 0, 4],
  [f(2.9), 1.04, 0, 4],
  [f(4.45), 1.06, 0, 4],
  [f(4.55), 1.10, 0, 6],
  [f(6.0), 1.05, 0, 4],
  [f(9.0), 1.03, 0, 2],
  [f(14.2), 1.03, 0, 2],
  [f(14.5), 1.07, 0, 5],
  [f(16.0), 1.04, 0, 3],
  [f(22.2), 1.03, 0, 2],
  [f(24.4), 1.04, 0, 2],
  [f(24.6), 1.08, 0, 5],
  [f(25.5), 1.10, 0, 7],
];
function cam(frame: number) {
  const ks = CAM;
  if (frame <= ks[0][0]) return { s: ks[0][1], x: ks[0][2], y: ks[0][3] };
  for (let i = 0; i < ks.length - 1; i++) {
    const [fa, sa, xa, ya] = ks[i]; const [fb, sb, xb, yb] = ks[i + 1];
    if (frame >= fa && frame <= fb) {
      const t = Easing.bezier(0.25, 0.8, 0.25, 1)((frame - fa) / Math.max(1, fb - fa));
      return { s: sa + (sb - sa) * t, x: xa + (xb - xa) * t, y: ya + (yb - ya) * t };
    }
  }
  const [, s, x, y] = ks[ks.length - 1]; return { s, x, y };
}
function shake(frame: number, hit: number, amp = 8, dur = 8) {
  const t = frame - hit;
  if (t < 0 || t > dur) return { dx: 0, dy: 0 };
  const decay = 1 - t / dur;
  return { dx: Math.sin(t * 2.7) * amp * decay, dy: Math.cos(t * 3.3) * amp * 0.6 * decay };
}

const Flash: React.FC<{ at: number; color?: string; peak?: number }> = ({ at, color = "#fff", peak = 0.4 }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + 1, at + 4], [0, peak, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (o <= 0) return null;
  return <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: "none" }} />;
};

const Sfx: React.FC<{ src: string; at: number; volume?: number; rate?: number }> = ({ src, at, volume = 0.6, rate = 1 }) => (
  <Sequence from={at} durationInFrames={f(1.6)}>
    <Audio src={staticFile(src)} volume={volume} playbackRate={rate} />
  </Sequence>
);

const GRAIN_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix type='saturate' values='0'/></filter><rect width='240' height='240' filter='url(#n)' opacity='0.55'/></svg>`
  );

export const HiggsIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const u = W / 100;

  const c = cam(frame);
  const sh2 = shake(frame, f(4.52), 4);
  const sh3 = shake(frame, f(11.63), 3);
  const sh4 = shake(frame, f(24.55), 6);
  const dx = (sh2.dx + sh3.dx + sh4.dx) * (u / 19.2);
  const dy = (sh2.dy + sh3.dy + sh4.dy) * (u / 19.2);

  const dim =
    interpolate(frame, [f(2.85), f(3.1), f(4.95), f(5.15)], [0, 0.42, 0.42, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) +
    interpolate(frame, [f(5.15), f(5.5), f(8.7), f(9.0)], [0, 0.30, 0.30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) +
    interpolate(frame, [f(9.24), f(9.7), f(13.9), f(14.3)], [0, 0.85, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) +
    interpolate(frame, [f(17.5), f(17.9), f(21.7), f(22.15)], [0, 0.55, 0.55, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      <AbsoluteFill
        style={{
          transform: `translate(${c.x * (u / 19.2) + dx}px, ${c.y * (u / 19.2) + dy}px) scale(${c.s})`,
          filter: "contrast(1.07) saturate(1.1) brightness(1.01)",
        }}
      >
        <OffthreadVideo src={staticFile("higgs/source.mp4")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: RAISIN, opacity: Math.min(dim, 0.9), pointerEvents: "none" }} />

      {/* 1. HOOK — type rides the words + real thumbnails appear */}
      <Sequence from={0} durationInFrames={f(2.9)}>
        <HookType u={u} H={H} W={W} />
      </Sequence>

      {/* 2. CTR SLASH (approved) */}
      <Sequence from={f(2.85)} durationInFrames={f(4.95) - f(2.85)}>
        <CtrSlash u={u} W={W} H={H} start={f(2.85)} />
      </Sequence>

      {/* 3. EVOLUTION — old 0.9% thumb → new 7.1% thumb */}
      <Sequence from={f(5.15)} durationInFrames={f(8.95) - f(5.15)}>
        <Evolution u={u} W={W} H={H} start={f(5.15)} />
      </Sequence>

      {/* 4. BRAIN + HANDS (Claude spark) */}
      <Sequence from={f(9.24)} durationInFrames={f(14.25) - f(9.24)}>
        <BrainHands u={u} W={W} H={H} start={f(9.24)} />
      </Sequence>

      {/* 5. STRIKE */}
      <Sequence from={f(16.2)} durationInFrames={f(17.55) - f(16.2)}>
        <StrikeOnly u={u} H={H} start={f(16.2)} />
      </Sequence>

      {/* 6. CASCADE (approved) */}
      <Sequence from={f(17.55)} durationInFrames={f(22.2) - f(17.55)}>
        <Cascade u={u} W={W} H={H} start={f(17.55)} />
      </Sequence>

      {/* 7. SPONSOR */}
      <Sequence from={f(22.4)} durationInFrames={f(24.45) - f(22.4)}>
        <SponsorChip u={u} H={H} start={f(22.4)} />
      </Sequence>

      {/* 8. CLOSER */}
      <Sequence from={f(24.5)} durationInFrames={f(25.5) - f(24.5)}>
        <Closer u={u} H={H} start={f(24.5)} />
      </Sequence>

      {/* flashes — softened */}
      <Flash at={f(25.3)} color="#ffffff" peak={0.8} />

      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 75% 65% at 50% 42%, transparent 55%, rgba(6,8,14,0.42) 100%)" }} />
      <AbsoluteFill
        style={{
          pointerEvents: "none", opacity: 0.05, mixBlendMode: "overlay",
          backgroundImage: `url("${GRAIN_URI}")`, backgroundSize: `${u * 12.5}px`,
          transform: `translate(${(frame % 3) * 3}px, ${(frame % 2) * -3}px)`,
        }}
      />

      {/* SFX — fewer, softer */}
      {/* SFX only where something visibly moves — 5 cues, gentle */}
      <Sfx src="higgs/sfx/whoosh.wav" at={f(2.95)} volume={0.16} rate={1.15} />
      <Sfx src="higgs/sfx/boom.wav" at={f(4.5)} volume={0.12} />
      <Sfx src="higgs/sfx/boom.wav" at={f(11.63)} volume={0.15} />
      <Sfx src="higgs/sfx/whoosh.wav" at={f(17.6)} volume={0.16} />
      <Sfx src="higgs/sfx/boom.wav" at={f(24.55)} volume={0.16} />
    </AbsoluteFill>
  );
};

/* ---------------- 1. HOOK ---------------- */
const HookType: React.FC<{ u: number; H: number; W: number }> = ({ u, H, W }) => {
  const frame = useCurrentFrame();
  const words: { t: string; at: number }[] = [
    { t: "I", at: f(0.21) }, { t: "NEVER", at: f(0.51) }, { t: "MAKE", at: f(1.11) },
    { t: "MY", at: f(1.29) }, { t: "THUMBNAILS", at: f(1.41) },
  ];
  const againAt = f(2.2);
  // real thumbnails appear as he says "my thumbnails" — flanking the face, never covering it
  const THUMBS: { id: string; x: number; y: number; rot: number; at: number }[] = [
    { id: "RevcVgE5vac", x: 0.055, y: 0.10, rot: -2.5, at: f(1.35) },
    { id: "CpwHi6DIyJU", x: 0.715, y: 0.075, rot: 2.0, at: f(1.55) },
    { id: "cRM_PzpmFEY", x: 0.75, y: 0.42, rot: -1.5, at: f(1.75) },
  ];
  const TW = u * 20;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: H * 0.4, background: "linear-gradient(transparent, rgba(8,10,16,0.72))" }} />
      {THUMBS.map((t) => {
        if (frame < t.at) return null;
        // cinematic: slow fade + rise + defocus-to-focus, no bounce
        const p = interpolate(frame, [t.at, t.at + 22], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
        const drift = (frame - t.at) * u * 0.006; // slow upward drift, film-title style
        const blur = (1 - p) * u * 0.22;
        return (
          <div key={t.id} style={{
            position: "absolute", left: t.x * W, top: t.y * H + u * 1.2 - p * u * 1.2 - drift, width: TW, height: TW * 9 / 16,
            borderRadius: u * 0.55, overflow: "hidden",
            opacity: p, transform: `scale(${1.03 - 0.03 * p}) rotate(${t.rot}deg)`,
            filter: `blur(${blur}px)`,
            boxShadow: `0 ${u * 0.9}px ${u * 2.6}px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.14)`,
          }}>
            <img src={staticFile(`higgs/thumbs/${t.id}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        );
      })}
      <div style={{ position: "absolute", left: u * 7, bottom: H * 0.155, display: "flex", gap: u * 1.1, alignItems: "baseline" }}>
        {words.map((w, i) => {
          const p = spring({ frame: frame - w.at, fps: FPS, config: { damping: 17, stiffness: 170 }, durationInFrames: 18 });
          if (frame < w.at) return <span key={i} />;
          return (
            <span key={i} style={{
              fontFamily: SANS, fontWeight: 700, fontSize: u * 3.3, letterSpacing: "-0.02em", color: "#fff",
              opacity: p, transform: `translateY(${(1 - p) * u * 1.0}px)`,
              textShadow: "0 3px 26px rgba(0,0,0,0.65)", display: "inline-block",
            }}>{w.t}</span>
          );
        })}
      </div>
      {/* ever again. — quiet serif, no slam */}
      {frame >= againAt && (() => {
        const p = interpolate(frame, [againAt, againAt + 12], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
        return (
          <div style={{
            position: "absolute", left: u * 7, bottom: H * 0.075,
            fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, fontSize: u * 4.2,
            color: LIME, opacity: p, transform: `translateY(${(1 - p) * u * 0.7}px)`,
            textShadow: `0 3px 26px rgba(0,0,0,0.6)`,
          }}>ever again.</div>
        );
      })()}
    </AbsoluteFill>
  );
};

/* ---------------- 2. CTR SLASH (approved, unchanged) ---------------- */
const CtrSlash: React.FC<{ u: number; W: number; H: number; start: number }> = ({ u, W, H, start }) => {
  const frame = useCurrentFrame();
  const drawEnd = f(4.4) - start;
  const slamAt = f(4.5) - start;
  const draw = interpolate(frame, [3, drawEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.6, 0, 0.35, 1) });
  const exit = interpolate(frame, [f(4.95) - start - 6, f(4.95) - start], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pts = [[8, 78], [20, 71], [30, 74], [40, 64], [52, 58], [62, 61], [72, 47], [84, 30], [92, 16]];
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0] * (W / 100)} ${p[1] * (H / 100)}`).join(" ");
  const totalLen = W * 1.35;
  const slam = interpolate(frame, [slamAt, slamAt + 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 1 - exit, transform: `translateY(${-exit * u * 6}px)` }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="glow"><feGaussianBlur stdDeviation={u * 0.35} result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <path d={path} stroke={LIME} strokeWidth={u * 0.42} fill="none" strokeLinecap="round" strokeLinejoin="round"
          filter="url(#glow)" strokeDasharray={totalLen} strokeDashoffset={totalLen * (1 - draw)} opacity={0.95} />
        {draw > 0.02 && draw < 1 && (() => {
          const idx = draw * (pts.length - 1); const i0 = Math.floor(idx); const t = idx - i0;
          const a = pts[Math.min(i0, pts.length - 1)], b = pts[Math.min(i0 + 1, pts.length - 1)];
          const x = (a[0] + (b[0] - a[0]) * t) * (W / 100), y = (a[1] + (b[1] - a[1]) * t) * (H / 100);
          return <circle cx={x} cy={y} r={u * 0.55} fill={LIME} filter="url(#glow)" />;
        })()}
      </svg>
      <div style={{ position: "absolute", left: u * 8, top: H * 0.815, fontFamily: MONO, fontSize: u * 1.15, color: SILVER, letterSpacing: "0.14em" }}>
        CTR · 12 MONTHS
      </div>
      <div style={{ position: "absolute", left: u * 7.6, top: H * 0.72, fontFamily: MONO, fontSize: u * 1.5, color: "#fff", opacity: 0.85 }}>4.6%</div>
      {frame >= slamAt && (
        <div style={{
          position: "absolute", right: u * 5.5, top: H * 0.045,
          fontFamily: SANS, fontWeight: 700, fontSize: u * 11, letterSpacing: "-0.04em", color: "#fff",
          opacity: slam, transform: `scale(${1.1 - 0.1 * slam})`, transformOrigin: "right top",
          textShadow: `0 0 ${u * 1.6}px rgba(207,255,5,0.3), 0 6px 40px rgba(0,0,0,0.7)`,
        }}>
          8<span style={{ color: LIME }}>%</span>
          <div style={{ fontFamily: MONO, fontWeight: 400, fontSize: u * 1.15, color: SILVER, letterSpacing: "0.18em", textAlign: "right", marginTop: -u * 0.6 }}>
            AND CLIMBING
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ---------------- 3. EVOLUTION — old → new ---------------- */
const Evolution: React.FC<{ u: number; W: number; H: number; start: number }> = ({ u, W, H, start }) => {
  const frame = useCurrentFrame();
  const oldAt = f(5.7) - start;
  const arrowAt = f(7.2) - start;
  const newAt = f(7.9) - start;
  const exit = interpolate(frame, [f(8.95) - start - 7, f(8.95) - start], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const TW = u * 25, TH = TW * 9 / 16;
  const cy = H * 0.30;
  const oldP = spring({ frame: frame - oldAt, fps: FPS, config: { damping: 15, stiffness: 140 }, durationInFrames: 20 });
  const newP = spring({ frame: frame - newAt, fps: FPS, config: { damping: 13, stiffness: 150 }, durationInFrames: 20 });
  const arrowP = interpolate(frame, [arrowAt, arrowAt + 9], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const chip = (txt: string, on: boolean, lime: boolean) => (
    <div style={{
      position: "absolute", left: u * 1.0, bottom: u * 1.0, padding: `${u * 0.35}px ${u * 0.7}px`,
      fontFamily: MONO, fontSize: u * 1.05, fontWeight: 700, letterSpacing: "0.06em",
      background: RAISIN, color: lime ? LIME : SILVER, borderRadius: u * 0.25, opacity: on ? 1 : 0,
    }}>{txt}</div>
  );
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 1 - exit }}>
      {frame >= oldAt && (
        <div style={{
          position: "absolute", left: W * 0.075, top: cy + Math.sin(frame / 22) * u * 0.1, width: TW, height: TH,
          borderRadius: u * 0.6, overflow: "hidden",
          opacity: oldP * 0.92, transform: `translateY(${(1 - oldP) * u * 2.4}px) rotate(-1.6deg)`,
          boxShadow: `0 ${u * 1}px ${u * 3}px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.10)`,
        }}>
          <img src={staticFile("higgs/old_thumb.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "grayscale(0.7) brightness(0.82)" }} />
          {chip("2024 · 1.5% CTR", frame > oldAt + 8, false)}
        </div>
      )}
      {frame >= arrowAt && (
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <line x1={W * 0.075 + TW + u * 1.6} y1={cy + TH / 2}
            x2={W * 0.075 + TW + u * 1.6 + arrowP * (W * 0.655 - (W * 0.075 + TW) - u * 3.2)} y2={cy + TH / 2}
            stroke={LIME} strokeWidth={u * 0.22} strokeLinecap="round" opacity={0.9} />
          {arrowP > 0.95 && (
            <path d={`M ${W * 0.655 - u * 2.4} ${cy + TH / 2 - u * 0.7} L ${W * 0.655 - u * 1.4} ${cy + TH / 2} L ${W * 0.655 - u * 2.4} ${cy + TH / 2 + u * 0.7}`}
              stroke={LIME} strokeWidth={u * 0.22} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      )}
      {frame >= newAt && (
        <div style={{
          position: "absolute", left: W * 0.66, top: cy - u * 0.8 + Math.sin((frame + 30) / 20) * u * 0.1, width: TW * 1.06, height: TH * 1.06,
          borderRadius: u * 0.6, overflow: "hidden",
          opacity: newP, transform: `translateY(${(1 - newP) * u * 2.8}px) rotate(1.4deg) scale(${0.94 + 0.06 * newP})`,
          boxShadow: `0 ${u * 1.2}px ${u * 3.6}px rgba(0,0,0,0.6), 0 0 0 ${u * 0.1}px rgba(207,255,5,0.55), 0 0 ${u * 2}px rgba(207,255,5,0.18)`,
        }}>
          <img src={staticFile("higgs/new_thumb.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          {chip("NOW · ~8% CTR", frame > newAt + 8, true)}
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ---------------- 4. BRAIN + HANDS ---------------- */
const BrainHands: React.FC<{ u: number; W: number; H: number; start: number }> = ({ u, W, H, start }) => {
  const frame = useCurrentFrame();
  const connectAt = f(11.63) - start;
  const flowStart = f(12.35) - start;
  const exit = interpolate(frame, [f(14.25) - start - 7, f(14.25) - start], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const claudeIn = spring({ frame: frame - 6, fps: FPS, config: { damping: 14, stiffness: 120 }, durationInFrames: 24 });
  const higgsIn = spring({ frame: frame - f(10.33) + start, fps: FPS, config: { damping: 14, stiffness: 120 }, durationInFrames: 24 });
  const beam = interpolate(frame, [connectAt, connectAt + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const cy = H * 0.42;
  const lx = W * 0.30, rx = W * 0.70;
  const NODE = u * 8.4;
  const THUMBS = ["N5EoDvPSxjo", "RevcVgE5vac", "lCtb8kIIMso", "r7P9_cL1InI", "CpwHi6DIyJU", "cRM_PzpmFEY"];

  const node = (x: number, img: string, label: string, p: number, ring: string, pad: string) => (
    <div style={{ position: "absolute", left: x - NODE / 2, top: cy - NODE / 2, width: NODE, height: NODE, opacity: p, transform: `scale(${0.6 + 0.4 * p})` }}>
      <div style={{
        width: "100%", height: "100%", borderRadius: u * 1.6, background: "#fff",
        border: `${u * 0.14}px solid ${ring}`, display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 ${u * 1}px ${u * 3.5}px rgba(0,0,0,0.5), 0 0 ${u * 2.5}px ${ring}44`, padding: pad, boxSizing: "border-box",
      }}>
        <img src={staticFile(img)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
      <div style={{ marginTop: u * 0.9, textAlign: "center", fontFamily: MONO, fontSize: u * 1.05, letterSpacing: "0.22em", color: SILVER }}>{label}</div>
    </div>
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 1 - exit }}>
      <AbsoluteFill style={{
        backgroundImage: `linear-gradient(rgba(207,255,5,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(207,255,5,0.05) 1px, transparent 1px)`,
        backgroundSize: `${u * 6}px ${u * 6}px`,
        maskImage: "radial-gradient(ellipse 60% 55% at 50% 40%, #000 30%, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse 60% 55% at 50% 40%, #000 30%, transparent 75%)",
      }} />
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {beam > 0 && (() => {
          const x1 = lx + NODE / 2, x2 = lx + NODE / 2 + (rx - lx - NODE) * beam;
          /* horizontal lines have zero-height bboxes — SVG filters clip them; layered strokes instead */
          return (
            <>
              <line x1={x1} y1={cy} x2={x2} y2={cy} stroke={LIME} strokeWidth={u * 1.1} opacity={0.14} strokeLinecap="round" />
              <line x1={x1} y1={cy} x2={x2} y2={cy} stroke={LIME} strokeWidth={u * 0.55} opacity={0.35} strokeLinecap="round" />
              <line x1={x1} y1={cy} x2={x2} y2={cy} stroke={LIME} strokeWidth={u * 0.26} strokeLinecap="round"
                strokeDasharray={`${u * 1.6} ${u * 1.0}`} strokeDashoffset={-frame * u * 0.4} />
            </>
          );
        })()}
        {frame >= connectAt && (() => {
          const t = Math.min(1, (frame - connectAt) / 14);
          return <circle cx={(lx + rx) / 2} cy={cy} r={u * (1 + t * 7)} stroke={LIME} strokeWidth={u * 0.12 * (1 - t)} fill="none" opacity={1 - t} />;
        })()}
      </svg>
      {node(lx, "higgs/claude.png", "THE BRAIN", claudeIn, CLAY, `${u * 1.7}px`)}
      {node(rx, "higgs/higgsfield.png", "THE HANDS", higgsIn, LIME, "0px")}
      {THUMBS.map((id, i) => {
        const born = flowStart + i * 8;
        if (frame < born) return null;
        const t = Math.min(1, (frame - born) / 34);
        const e = Easing.out(Easing.cubic)(t);
        const tx = (lx + rx) / 2 - u * 7 + (i - 2.5) * u * 2.2 * e;
        const ty = cy + u * 5 + e * H * 0.30;
        const tw = u * 13;
        return (
          <div key={id} style={{
            position: "absolute", left: tx, top: ty, width: tw, height: tw * 9 / 16,
            transform: `rotate(${(i % 2 ? 1 : -1) * (4 - 3 * e)}deg) scale(${0.5 + 0.5 * e})`,
            opacity: Math.min(1, t * 3) * (1 - Math.max(0, t - 0.92) * 8),
            borderRadius: u * 0.5, overflow: "hidden",
            boxShadow: `0 ${u * 0.8}px ${u * 2.4}px rgba(0,0,0,0.55)`, border: "1px solid rgba(255,255,255,0.18)",
          }}>
            <img src={staticFile(`higgs/thumbs/${id}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        );
      })}
      {frame >= connectAt && (
        <div style={{
          position: "absolute", left: 0, right: 0, top: H * 0.13, textAlign: "center",
          fontFamily: MONO, fontSize: u * 1.15, letterSpacing: "0.26em", color: SILVER,
          opacity: interpolate(frame, [connectAt, connectAt + 8], [0, 1], { extrapolateRight: "clamp" }),
        }}>
          CLAUDE PLANS · HIGGSFIELD RENDERS
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ---------------- 5. STRIKE ---------------- */
const StrikeOnly: React.FC<{ u: number; H: number; start: number }> = ({ u, H, start }) => {
  const frame = useCurrentFrame();
  const inP = spring({ frame, fps: FPS, config: { damping: 16, stiffness: 160 }, durationInFrames: 14 });
  const strike = interpolate(frame, [f(17.15) - start, f(17.45) - start], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const exit = interpolate(frame, [f(17.55) - start - 4, f(17.55) - start], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 1 - exit }}>
      <div style={{
        position: "absolute", left: u * 7, bottom: H * 0.12,
        fontFamily: SANS, fontWeight: 700, fontSize: u * 3.4, color: "#fff", letterSpacing: "-0.01em",
        opacity: inP, transform: `translateY(${(1 - inP) * u}px)`, textShadow: "0 3px 24px rgba(0,0,0,0.65)",
      }}>
        <span style={{ position: "relative", display: "inline-block" }}>
          ONLY THUMBNAILS
          <span style={{
            position: "absolute", left: 0, top: "54%", height: u * 0.3, width: `${strike * 103}%`,
            background: LIME, borderRadius: u * 0.2, boxShadow: `0 0 ${u * 1}px rgba(207,255,5,0.5)`,
          }} />
        </span>
        <span style={{ color: LIME, marginLeft: u * 1.6, opacity: strike }}>?</span>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- 6. DESIGN RANGE — one skill, four design jobs ---------------- */
const Cascade: React.FC<{ u: number; W: number; H: number; start: number }> = ({ u, W, H, start }) => {
  const frame = useCurrentFrame();
  const exit = interpolate(frame, [f(22.2) - start - 7, f(22.2) - start], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const zoom = 1 + interpolate(frame, [0, f(22.2) - start], [0, 0.04], { extrapolateRight: "clamp" });
  const label = interpolate(frame, [f(20.3) - start, f(20.7) - start], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // four REAL outputs, four different design jobs, four formats — the range IS the message
  const TILES: { src: string; label: string; x: number; y: number; w: number; ar: number; rot: number; at: number }[] = [
    { src: "higgs/thumb_light_range.jpg", label: "THUMBNAILS", x: 0.06,  y: 0.15,  w: 0.315, ar: 16 / 9,    rot: -1.6, at: 3 },
    { src: "higgs/design_carousel.png",    label: "SOCIAL",     x: 0.435, y: 0.095, w: 0.185, ar: 1080/1350, rot: 1.2,  at: 10 },
    { src: "higgs/design_broll.png",       label: "B-ROLL ART", x: 0.685, y: 0.08,  w: 0.165, ar: 1152/2048, rot: -1.0, at: 17 },
    { src: "higgs/design_slides.png",      label: "SLIDES",     x: 0.075, y: 0.63,  w: 0.46,  ar: 2700/675,  rot: 0.8,  at: 24 },
  ];
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 1 - exit }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})`, transformOrigin: "50% 45%" }}>
        {TILES.map((t) => {
          if (frame < t.at) return null;
          // cinematic entrance: fade + rise + focus (matches the hook)
          const p = interpolate(frame, [t.at, t.at + 20], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
          const drift = (frame - t.at) * u * 0.004;
          const blur = (1 - p) * u * 0.2;
          const w = t.w * W, h = w / t.ar;
          return (
            <div key={t.label}>
              <div style={{
                position: "absolute", left: t.x * W, top: t.y * H + u * 1.0 - p * u * 1.0 - drift, width: w, height: h,
                borderRadius: u * 0.55, overflow: "hidden",
                opacity: p, transform: `rotate(${t.rot}deg)`, filter: `blur(${blur}px)`,
                boxShadow: `0 ${u * 1.1}px ${u * 3.2}px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.14)`,
              }}>
                <img src={staticFile(t.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{
                position: "absolute", left: t.x * W, top: t.y * H + h + u * 0.7 - drift, width: w, textAlign: "center",
                fontFamily: MONO, fontSize: u * 0.95, letterSpacing: "0.22em", color: SILVER, opacity: p * 0.9,
              }}>{t.label}</div>
            </div>
          );
        })}
      </div>
      <div style={{
        position: "absolute", right: u * 6, bottom: H * 0.10, textAlign: "right",
        fontFamily: SANS, fontWeight: 700, fontSize: u * 2.5, color: "#fff", letterSpacing: "-0.01em",
        opacity: label, transform: `translateY(${(1 - label) * u * 0.8}px)`, textShadow: "0 3px 26px rgba(0,0,0,0.7)",
      }}>
        ANY VISUAL. <span style={{ color: LIME, fontFamily: SERIF, fontStyle: "italic" }}>one skill.</span>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- 7. SPONSOR ---------------- */
const SponsorChip: React.FC<{ u: number; H: number; start: number }> = ({ u, H, start }) => {
  const frame = useCurrentFrame();
  const p = spring({ frame: frame - 2, fps: FPS, config: { damping: 14, stiffness: 150 }, durationInFrames: 20 });
  const exit = interpolate(frame, [f(24.45) - start - 5, f(24.45) - start], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sweep = interpolate(frame, [10, 34], [-30, 130], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const S = u * 7.2;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 1 - exit }}>
      <div style={{ position: "absolute", left: u * 6.5, top: H * 0.60, opacity: p, transform: `translateY(${(1 - p) * u * 1.6}px)` }}>
        <div style={{ position: "relative", width: S, height: S, borderRadius: u * 1.5, overflow: "hidden", boxShadow: `0 ${u * 0.9}px ${u * 2.8}px rgba(0,0,0,0.5)` }}>
          <img src={staticFile("higgs/higgsfield.png")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{
            position: "absolute", top: 0, bottom: 0, left: `${sweep}%`, width: "26%",
            background: "linear-gradient(105deg, transparent, rgba(255,255,255,0.5), transparent)", transform: "skewX(-18deg)",
          }} />
        </div>
        <div style={{ marginTop: u * 0.8, fontFamily: MONO, fontSize: u * 0.95, letterSpacing: "0.24em", color: SILVER }}>SPONSOR</div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- 8. CLOSER ---------------- */
const Closer: React.FC<{ u: number; H: number; start: number }> = ({ u, H, start }) => {
  const frame = useCurrentFrame();
  const p = spring({ frame: frame - 1, fps: FPS, config: { damping: 14, stiffness: 170 }, durationInFrames: 14 });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: H * 0.12, textAlign: "center",
        fontFamily: SANS, fontWeight: 700, fontSize: u * 3.4, color: "#fff", letterSpacing: "-0.01em",
        opacity: p, transform: `scale(${1.08 - 0.08 * p})`, textShadow: "0 4px 28px rgba(0,0,0,0.7)",
      }}>
        LET&apos;S DIVE <span style={{ color: LIME }}>IN</span> <span style={{ color: LIME }}>→</span>
      </div>
    </AbsoluteFill>
  );
};

export default HiggsIntro;

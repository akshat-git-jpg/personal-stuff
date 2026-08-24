/**
 * FishIntro — bespoke intro for the Fish Audio video (2026-07-02).
 * Concept: "the waveform is the thread." Fish-brand cream studio (NOT BuildLoop System v1):
 * painterly pastel blobs, a violet audio-wave line linking stations, emotion-tag pills
 * as the annotation language. Mid-video the A-roll PAUSES for a full listening break
 * where the two real clips (ElevenLabs vs Fish) actually play, then resumes for the reveal.
 */
import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
  delayRender, continueRender,
} from "remotion";

const FPS = 30;
const f = (sec: number) => Math.round(sec * FPS);

/* ---------------- Fish Audio brand ---------------- */
const CREAM = "#F5F1EB";
const INK = "#161616";
const BODY = "#6E6B66";
// co-branded neutral system (BuildLoop x Fish): ink + warm sand, no brand accent colors
const VIOLET = "#33312D";      // deep warm charcoal — the accent everywhere
const VIOLET_BG = "#EAE4D8";   // warm sand for highlight blocks / pills
const PEACH = "#57534B";       // stone — secondary emphasis
const PEACH_BG = "#EFE9DE";
const CARD_BORDER = "#E7E1D8";
const SANS = "'DM Sans', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

/* fonts — DM Sans for the Fish look (kit.tsx already loads the mono) */
const fontHandle = delayRender("fish-fonts");
{
  let done = false;
  const finish = () => { if (!done) { done = true; continueRender(fontHandle); } };
  if (typeof document !== "undefined") {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&display=block";
    document.head.appendChild(link);
    const ft: any = (document as any).fonts;
    (ft && ft.ready ? ft.ready : Promise.resolve()).then(finish).catch(finish);
    setTimeout(finish, 4000);
  } else finish();
}

/* ---------------- the insert (listening break) ----------------
   Source A-roll runs 0→INSERT_AT, pauses 9.4s while the two clips play, resumes. */
const INSERT_AT = 27.35;                       // source-time: "publish?" ends 27.09 + a breath, before "So"
const INSERT_LEN = 8.6;
const SRC_DUR = 36.31;
const T = (srcSec: number) => (srcSec <= INSERT_AT ? srcSec : srcSec + INSERT_LEN); // source→comp seconds
const COMP_DUR = SRC_DUR + INSERT_LEN;         // 44.91 → 1348 frames
const CLIP_A = { at: T(INSERT_AT) + 0.6, dur: 2.85 };   // ElevenLabs (real EL voice clone)
const CLIP_B = { at: T(INSERT_AT) + 4.0, dur: 4.15 };   // Fish (good)

/* ---------------- world camera ---------------- */
const CAM: [number, number, number, number][] = [
  [f(0.0), 1150, 520, 1.0],                    // parked at the Fish card behind the hook
  [f(3.3), 1150, 520, 1.0],
  [f(4.3), 1175, 505, 1.08],                   // Fish reveal, slow push
  [f(6.4), 1210, 495, 1.12],
  [f(7.4), 2270, 470, 0.98],                   // glide → blind test
  [f(10.3), 2310, 458, 1.05],
  [f(11.3), 3280, 700, 0.96],                  // glide → price
  [f(14.6), 3320, 688, 1.03],
  [f(15.6), 4180, 1000, 0.94],                 // glide → into Claude
  [f(19.2), 4220, 990, 1.0],
  [f(20.2), 5080, 1370, 1.00],                 // glide → the two clips
  [f(T(26.95)), 5100, 1380, 1.06],
  // (listening break covers the frame here)
  [f(T(27.6)), 5100, 1380, 1.06],
  [f(T(30.4)), 5280, 1330, 1.14],              // push on card 02 for the reveal
  [f(T(36.2)), 5300, 1345, 1.18],              // one continuous creep to the end
];
function cam(frame: number) {
  const ks = CAM;
  if (frame <= ks[0][0]) { const [, x, y, z] = ks[0]; return { x, y, z }; }
  for (let i = 0; i < ks.length - 1; i++) {
    const [fa, xa, ya, za] = ks[i]; const [fb, xb, yb, zb] = ks[i + 1];
    if (frame >= fa && frame <= fb) {
      const t = Easing.bezier(0.45, 0, 0.18, 1)((frame - fa) / Math.max(1, fb - fa));
      return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, z: za + (zb - za) * t };
    }
  }
  const [, x, y, z] = ks[ks.length - 1]; return { x, y, z };
}

/* ---------------- the waveform thread ----------------
   A smooth line through all stations with a small audio-wave oscillation. */
const WAVE_ANCHORS: [number, number][] = [
  [640, 760], [1000, 640], [1520, 560], [2020, 500], [2580, 520],
  [3060, 640], [3560, 760], [4020, 1160], [4460, 1210], [4820, 1280], [5250, 1400],
];
const WAVE_PATH = (() => {
  const pts: [number, number][] = [];
  const A = WAVE_ANCHORS;
  for (let i = 0; i < A.length - 1; i++) {
    const [x0, y0] = A[i]; const [x1, y1] = A[i + 1];
    const seg = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 26);
    for (let k = 0; k < seg; k++) {
      const t = k / seg;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t + Math.sin((x / 62)) * 12;
      pts.push([x, y]);
    }
  }
  return "M " + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ");
})();
const WAVE_LEN = 6000;

/* pastel painterly blobs (the hero-painting nod) */
const Blobs: React.FC<{ o?: number }> = ({ o = 1 }) => (
  <>
    <div style={{ position: "absolute", left: "-12%", top: "-25%", width: "55%", height: "80%", borderRadius: "50%", background: "radial-gradient(circle, rgba(190,196,206,0.40), transparent 70%)", filter: "blur(80px)", opacity: o }} />
    <div style={{ position: "absolute", right: "-10%", top: "-15%", width: "50%", height: "75%", borderRadius: "50%", background: "radial-gradient(circle, rgba(214,204,196,0.38), transparent 70%)", filter: "blur(90px)", opacity: o }} />
    <div style={{ position: "absolute", left: "30%", bottom: "-30%", width: "45%", height: "70%", borderRadius: "50%", background: "radial-gradient(circle, rgba(224,214,192,0.38), transparent 70%)", filter: "blur(85px)", opacity: o }} />
  </>
);

export const FishIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const wu = W / 1920;
  const c0 = cam(frame);
  const c = { x: c0.x + Math.sin(frame / 40) * 5, y: c0.y + Math.cos(frame / 49) * 4, z: c0.z };

  const worldStyle: React.CSSProperties = {
    position: "absolute", left: 0, top: 0, width: 0, height: 0,
    transform: `translate(${W / 2 - c.x * wu * c.z}px, ${H / 2 - c.y * wu * c.z}px) scale(${c.z * wu})`,
    transformOrigin: "0 0",
  };

  const waveProgress = interpolate(frame, [f(0.5), f(T(20.3))], [0.04, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.4, 1) });

  // listening break window
  const insertIn = interpolate(frame, [f(T(INSERT_AT) - 0.05), f(T(INSERT_AT) + 0.45)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const insertOut = interpolate(frame, [f(T(INSERT_AT) + INSERT_LEN - 0.45), f(T(INSERT_AT) + INSERT_LEN)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const insertP = Math.min(insertIn, insertOut);
  const inInsert = frame >= f(T(INSERT_AT)) && frame <= f(T(INSERT_AT) + INSERT_LEN);

  /* speaker card keyframes (comp-time) */
  const spk = (() => {
    const kf: [number, number, number, number][] = [
      [f(0.0), 0.5, 0.5, 0.94],
      [f(3.25), 0.5, 0.5, 0.94],
      [f(4.35), 0.165, 0.745, 0.235],           // corner while the canvas talks
      [f(T(26.4)), 0.165, 0.745, 0.235],
      [f(T(INSERT_AT)), 0.165, 0.745, 0.235],   // (hidden during the break)
      [f(T(27.5)), 0.20, 0.72, 0.30],           // slightly bigger for the reveal
      [f(T(36.2)), 0.205, 0.725, 0.30],
    ];
    for (let i = 0; i < kf.length - 1; i++) {
      const [fa, xa, ya, wa] = kf[i]; const [fb, xb, yb, wb] = kf[i + 1];
      if (frame >= fa && frame <= fb) {
        const t = Easing.bezier(0.45, 0, 0.18, 1)((frame - fa) / Math.max(1, fb - fa));
        return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, w: wa + (wb - wa) * t };
      }
    }
    const [, x, y, w] = kf[kf.length - 1]; return { x, y, w };
  })();
  const spkW = spk.w * W, spkH = spkW * 9 / 16;
  const spkRadius = W * 0.012;
  const spkOpacity = inInsert ? 1 - insertP : 1;

  /* hook treatment */
  const hookBlur = interpolate(frame, [0, f(0.7)], [9, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const hookBright = interpolate(frame, [0, f(0.7)], [1.13, 1], { extrapolateRight: "clamp" });
  const hookScale = interpolate(frame, [0, f(2.4)], [1.08, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.3, 0, 0.4, 1) });
  const frameDraw = interpolate(frame, [f(0.25), f(1.35)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.5, 0, 0.2, 1) });
  const eyebrowIn = interpolate(frame, [f(0.45), f(0.95)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const stopIn = interpolate(frame, [f(2.85), f(3.15)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const titleOut = interpolate(frame, [f(3.25), f(3.7)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: CREAM, fontFamily: SANS }}>
      <Blobs o={0.9} />

      {/* ================= WORLD ================= */}
      <div style={worldStyle}>
        <svg width={6200} height={2400} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <path d={WAVE_PATH} fill="none" stroke={VIOLET} strokeWidth={4}
            strokeLinecap="round" opacity={0.24}
            strokeDashoffset={WAVE_LEN * (1 - waveProgress)} strokeDasharray={WAVE_LEN} pathLength={WAVE_LEN} />
        </svg>

        <StationFish at={f(3.9)} nameAt={f(5.85)} />
        <StationBlindTest at={f(6.9)} countAt={f(9.1)} winAt={f(9.9)} />
        <StationPrice at={f(10.9)} xAt={f(11.8)} noteAt={f(13.4)} />
        <StationClaude at={f(15.2)} linkAt={f(16.4)} />
        <StationClips
          at={f(19.8)}
          namesAt={f(21.2)}
          questionAt={f(24.1)}
          revealAt={f(T(27.8))}
          fishAt={f(T(30.4))}
          priceAt={f(T(32.6))}
          ctaAt={f(T(34.4))}
        />
      </div>

      {/* ================= SPEAKER ================= */}
      <div style={{
        position: "absolute",
        left: spk.x * W - spkW / 2, top: spk.y * H - spkH / 2, width: spkW, height: spkH,
        borderRadius: spkRadius, overflow: "hidden", opacity: spkOpacity,
        boxShadow: `0 ${W * 0.007}px ${W * 0.022}px rgba(22,22,22,0.22), 0 0 0 1px rgba(22,22,22,0.06)`,
      }}>
        {/* A-roll part 1 → pause → part 2 */}
        <Sequence from={0} durationInFrames={f(T(INSERT_AT))} layout="none">
          <OffthreadVideo src={staticFile("fish/source.mp4")}
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${hookScale})`, filter: `contrast(1.04) saturate(1.05) brightness(${hookBright})${hookBlur > 0.1 ? ` blur(${hookBlur}px)` : ""}` }} />
        </Sequence>
        <Sequence from={f(T(INSERT_AT) + INSERT_LEN)} layout="none">
          <OffthreadVideo src={staticFile("fish/source.mp4")} startFrom={f(INSERT_AT)}
            style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.04) saturate(1.05)" }} />
        </Sequence>

        {frame < f(3.8) && (
          <>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "44%", background: "linear-gradient(to top, rgba(22,22,22,0.60), transparent)", opacity: Math.min(eyebrowIn, titleOut) }} />
            <div style={{ position: "absolute", left: "5.2%", bottom: "8.5%", opacity: titleOut }}>
              <div style={{ opacity: eyebrowIn, transform: `translateY(${(1 - eyebrowIn) * W * 0.006}px)`, display: "flex", alignItems: "center", gap: W * 0.007 }}>
                <span style={{ fontFamily: MONO, fontSize: W * 0.0105, fontWeight: 700, letterSpacing: "0.14em", background: "rgba(245,241,235,0.94)", color: INK, padding: `${W * 0.003}px ${W * 0.008}px`, borderRadius: W * 0.02 }}>[ real talk ]</span>
                <img src={staticFile("fish/el_white.png")} style={{ height: W * 0.0125, opacity: 0.85 }} />
                <span style={{ fontFamily: MONO, fontSize: W * 0.0105, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(255,255,255,0.75)" }}>PAYING FOR ELEVENLABS?</span>
              </div>
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.046, color: "#fff", lineHeight: 1.05, marginTop: W * 0.006, opacity: stopIn, transform: `translateY(${(1 - stopIn) * W * 0.008}px)` }}>
                stop<span style={{ color: "#E8DFD0" }}>.</span>
              </div>
            </div>
          </>
        )}

        {/* violet frame — draws on, stays the whole video */}
        <svg width="100%" height="100%" viewBox={`0 0 ${spkW} ${spkH}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
          <rect x={W * 0.0035} y={W * 0.0035} width={spkW - W * 0.007} height={spkH - W * 0.007}
            rx={spkRadius * 0.85} fill="none" stroke={VIOLET} strokeWidth={W * 0.0022}
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - frameDraw)} />
        </svg>
      </div>

      {/* ================= LISTENING BREAK ================= */}
      {inInsert && <ListeningBreak p={insertP} />}
      <Sequence from={f(CLIP_A.at)} durationInFrames={f(CLIP_A.dur)}><Audio src={staticFile("fish/bad.mp3")} volume={0.95} /></Sequence>
      <Sequence from={f(CLIP_B.at)} durationInFrames={f(CLIP_B.dur)}><Audio src={staticFile("fish/good.mp3")} volume={0.95} /></Sequence>

      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 80% 72% at 50% 44%, transparent 62%, rgba(22,22,22,0.07) 100%)" }} />

      {frame >= f(T(35.9)) && (
        <AbsoluteFill style={{ background: "#fff", opacity: interpolate(frame, [f(T(35.9)), f(T(36.1)), f(T(36.31))], [0, 0.85, 0.95], { extrapolateRight: "clamp" }) }} />
      )}

      {/* cues at visual landings */}
      <Sequence from={f(3.4)} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.28} /></Sequence>
      <Sequence from={f(4.3)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.4} /></Sequence>
      <Sequence from={f(7.25)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.35} /></Sequence>
      <Sequence from={f(9.5)} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.26} /></Sequence>
      <Sequence from={f(10.25)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.4} /></Sequence>
      <Sequence from={f(11.25)} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.3} /></Sequence>
      <Sequence from={f(12.2)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.42} /></Sequence>
      <Sequence from={f(15.55)} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.3} /></Sequence>
      <Sequence from={f(16.85)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.38} /></Sequence>
      <Sequence from={f(20.35)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.42} /></Sequence>
      <Sequence from={f(20.65)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.42} /></Sequence>
      <Sequence from={f(T(INSERT_AT) + 0.35)} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.32} /></Sequence>
      <Sequence from={f(CLIP_B.at - 0.25)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.3} /></Sequence>
      <Sequence from={f(T(30.55))} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.42} /></Sequence>
      <Sequence from={f(T(34.75))} durationInFrames={15}><Audio src={staticFile("vedit/sfx/tap.wav")} volume={0.55} /></Sequence>
    </AbsoluteFill>
  );
};

/* ---------- shared ---------- */
const useIn = (at: number, dur = 16) => {
  const frame = useCurrentFrame();
  if (frame < at) return 0;
  return interpolate(frame, [at, at + dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
};

const Card: React.FC<{ x: number; y: number; w: number; rot?: number; p: number; pad?: number; children: React.ReactNode }> =
  ({ x, y, w, rot = 0, p, pad = 30, children }) => (
    <div style={{
      position: "absolute", left: x, top: y + (1 - p) * 24, width: w,
      background: "#FFFFFF", border: `1px solid ${CARD_BORDER}`, borderRadius: 22,
      boxShadow: "0 2px 8px rgba(22,22,22,.05), 0 22px 44px -18px rgba(22,22,22,.16)",
      padding: pad, opacity: p, transform: `rotate(${rot}deg)`,
    }}>{children}</div>
  );

const TagPill: React.FC<{ children: React.ReactNode; peach?: boolean }> = () => null;

/* animated EQ bars (the Fish glyph) */
const EqBars: React.FC<{ n?: number; h?: number; color?: string; live?: boolean; seed?: number; bw?: number }> =
  ({ n = 9, h = 54, color = INK, live = true, seed = 0, bw = 7 }) => {
    const frame = useCurrentFrame();
    return (
      <svg width={n * (bw + 6)} height={h}>
        {Array.from({ length: n }).map((_, i) => {
          const base = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + seed * 3.1));
          const wob = live ? 0.74 + 0.26 * Math.sin(frame / 7 + i * 1.9 + seed * 5) : 1;
          const bh = Math.max(6, h * base * wob);
          return <rect key={i} x={i * (bw + 6)} y={(h - bh) / 2} width={bw} height={bh} rx={bw / 2} fill={color} />;
        })}
      </svg>
    );
  };

/* ---------- Station: FISH REVEAL ---------- */
const StationFish: React.FC<{ at: number; nameAt: number }> = ({ at, nameAt }) => {
  const p = useIn(at);
  const nm = useIn(nameAt, 12);
  return (
    <>
      <div style={{ position: "absolute", left: 760, top: 290, opacity: p }}><TagPill>[ open source ]</TagPill></div>
      <Card x={750} y={345} w={560} rot={-0.8} p={p}>
        <EqBars n={13} h={54} seed={1} />
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 25, color: BODY, marginTop: 14 }}>a new open-source voice model</div>
        <img src={staticFile("fish/fish_wordmark.png")} style={{ width: 470, display: "block", marginTop: 20, opacity: nm, transform: `translateY(${(1 - nm) * 12}px)` }} />
      </Card>
    </>
  );
};

/* ---------- Station: BLIND TEST ---------- */
const StationBlindTest: React.FC<{ at: number; countAt: number; winAt: number }> = ({ at, countAt, winAt }) => {
  const frame = useCurrentFrame();
  const p = useIn(at);
  const win = useIn(winAt, 12);
  const count = Math.round(interpolate(frame, [countAt, countAt + 26], [0, 5000], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }));
  const barP = interpolate(frame, [winAt, winAt + 20], [0.5, 0.72], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return (
    <>
      <div style={{ position: "absolute", left: 1980, top: 205, opacity: p }}><TagPill>[ blind test ]</TagPill></div>
      <Card x={1970} y={260} w={620} rot={0.7} p={p}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 76, letterSpacing: "-0.03em", color: INK, lineHeight: 1 }}>
          {count.toLocaleString("en-US")}<span style={{ fontSize: 30, fontWeight: 700, color: BODY, marginLeft: 10 }}>people</span>
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 24, color: BODY, marginTop: 8 }}>couldn&apos;t see the labels. they just listened.</div>
        {/* the vote bar */}
        <div style={{ marginTop: 22, height: 46, borderRadius: 999, background: "#F1EDE6", overflow: "hidden", display: "flex", position: "relative" }}>
          <div style={{ width: `${barP * 100}%`, background: VIOLET, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: 20 }}>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 21, color: "#fff", opacity: win }}>fish</span>
          </div>
          <span style={{ position: "absolute", right: 20, top: 0, bottom: 0, display: "flex", alignItems: "center", gap: 8, fontFamily: SANS, fontWeight: 700, fontSize: 21, color: BODY }}>
            <img src={staticFile("fish/el_black.png")} style={{ height: 20, opacity: 0.6 }} />
            <span style={{ textDecoration: win > 0.5 ? "line-through" : "none" }}>ElevenLabs</span>
          </span>
        </div>
      </Card>
    </>
  );
};

/* ---------- Station: PRICE ---------- */
const StationPrice: React.FC<{ at: number; xAt: number; noteAt: number }> = ({ at, xAt, noteAt }) => {
  const frame = useCurrentFrame();
  const p = useIn(at);
  const note = useIn(noteAt, 12);
  const mult = Math.round(interpolate(frame, [xAt, xAt + 24], [1, 10], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }));
  return (
    <>
      <div style={{ position: "absolute", left: 3000, top: 480, opacity: p }}><TagPill peach>[ pricing ]</TagPill></div>
      <Card x={2990} y={535} w={560} rot={-0.6} p={p}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 110, letterSpacing: "-0.04em", color: INK, lineHeight: 1 }}>
          {mult}×<span style={{ fontSize: 38, fontWeight: 700, color: PEACH, marginLeft: 12 }}>cheaper</span>
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 25, color: BODY, marginTop: 12, opacity: note, whiteSpace: "nowrap" }}>
          which honestly <span style={{ color: INK, fontWeight: 700, background: VIOLET_BG, padding: "0 8px", borderRadius: 8 }}>doesn&apos;t make sense</span>
        </div>
      </Card>
    </>
  );
};

/* ---------- Station: INTO CLAUDE ---------- */
const StationClaude: React.FC<{ at: number; linkAt: number }> = ({ at, linkAt }) => {
  const frame = useCurrentFrame();
  const p = useIn(at);
  const link = useIn(linkAt, 16);
  const tile: React.CSSProperties = {
    width: 170, height: 170, background: "#fff", borderRadius: 36, border: `1px solid ${CARD_BORDER}`,
    boxShadow: "0 18px 40px -16px rgba(22,22,22,.18)", display: "flex", alignItems: "center", justifyContent: "center",
  };
  return (
    <>
      <div style={{ position: "absolute", left: 3910, top: 770, opacity: p }}><TagPill>[ the plan ]</TagPill></div>
      <div style={{ position: "absolute", left: 3900, top: 840, display: "flex", alignItems: "center", gap: 34, opacity: p }}>
        <div style={{ ...tile, transform: `rotate(${-2 + p * 1}deg)` }}><img src={staticFile("fish/fish_glyph.png")} style={{ width: "68%", objectFit: "contain" }} /></div>
        {/* the wave flows INTO Claude */}
        <svg width={150} height={60} style={{ overflow: "visible" }}>
          <path d="M 6 30 L 126 30"
            fill="none" stroke={VIOLET} strokeWidth={5} strokeLinecap="round"
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - link)} />
          <path d="M 116 19 L 134 30 L 116 41" fill="none" stroke={VIOLET} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round"
            opacity={link > 0.9 ? (link - 0.9) / 0.1 : 0} />
        </svg>
        <div style={{ ...tile, transform: `rotate(${2 - p * 1}deg)` }}>
          <img src={staticFile("fish/claude.png")} style={{ width: "58%", height: "58%", objectFit: "contain" }} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 3900, top: 1060, width: 700, fontFamily: SANS, fontWeight: 700, fontSize: 34, color: INK, opacity: link, whiteSpace: "nowrap" }}>
        we&apos;re running it <span style={{ color: VIOLET }}>into Claude</span><span style={{ fontWeight: 500, color: BODY }}> — live.</span>
      </div>
    </>
  );
};

/* ---------- Station: THE TWO CLIPS (+ reveal after the break) ---------- */
const StationClips: React.FC<{ at: number; namesAt: number; questionAt: number; revealAt: number; fishAt: number; priceAt: number; ctaAt: number }> =
  ({ at, namesAt, questionAt, revealAt, fishAt, priceAt, ctaAt }) => {
    const frame = useCurrentFrame();
    const p1 = useIn(at, 12);
    const p2 = useIn(at + 9, 12);
    const names = useIn(namesAt, 12);
    const q = useIn(questionAt, 14);
    const reveal = useIn(revealAt, 14);
    const answered = useIn(revealAt - 6, 10);   // fades the pre-break text away
    const fish = useIn(fishAt, 12);
    const price = useIn(priceAt, 12);
    const cta = useIn(ctaAt, 12);
    const X0 = 4700, Y0 = 1230;
    const playerCard = (x: number, label: string, p: number, seed: number, highlight: number) => (
      <div style={{
        position: "absolute", left: x, top: Y0 + (1 - p) * 22, width: 380,
        background: "#fff", border: `1.5px solid ${highlight > 0.3 ? VIOLET : CARD_BORDER}`, borderRadius: 22,
        boxShadow: highlight > 0.3 ? "0 24px 50px -18px rgba(22,22,22,.22)" : "0 20px 42px -18px rgba(22,22,22,.15)",
        padding: 24, opacity: p, transform: `scale(${1 + highlight * 0.05})`,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <TagPill>[ {label} ]</TagPill>
          <div style={{ width: 34, height: 34, borderRadius: 999, background: INK, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 0, height: 0, borderLeft: "11px solid #fff", borderTop: "7px solid transparent", borderBottom: "7px solid transparent", marginLeft: 3 }} />
          </div>
        </div>
        <div style={{ marginTop: 16 }}><EqBars n={12} h={44} seed={seed} live={false} color={highlight > 0.3 ? VIOLET : INK} /></div>
      </div>
    );
    return (
      <>
        <div style={{ position: "absolute", left: X0 + 10, top: Y0 - 66, opacity: p1 }}><TagPill peach>[ the test ]</TagPill></div>
        {playerCard(X0, "clip 01", p1, 4, 0)}
        {playerCard(X0 + 430, "clip 02", p2, 7, reveal)}
        {/* "one is elevenlabs, one is fish" */}
        <div style={{ position: "absolute", left: X0 + 140, top: Y0 + 190, fontFamily: SANS, fontWeight: 500, fontSize: 27, color: BODY, opacity: names * (1 - answered), whiteSpace: "nowrap" }}>
          one is <img src={staticFile("fish/el_black.png")} style={{ height: 20, verticalAlign: "-3px" }} /> <span style={{ fontWeight: 700, color: INK }}>ElevenLabs</span> · one is <img src={staticFile("fish/fish_glyph.png")} style={{ height: 22, verticalAlign: "-4px" }} /> <span style={{ fontWeight: 700, color: INK }}>Fish</span> — we won&apos;t tell you which.
        </div>
        {/* the question */}
        <div style={{ position: "absolute", left: X0 + 140, top: Y0 + 250, fontFamily: SANS, fontWeight: 800, fontSize: 52, letterSpacing: "-0.02em", color: INK, opacity: q * (1 - answered), transform: `translateY(${(1 - q) * 14}px)`, whiteSpace: "nowrap" }}>
          which one would <span style={{ background: VIOLET_BG, color: VIOLET, padding: "0 14px", borderRadius: 14 }}>you</span> publish?
        </div>
        {/* reveal: clip 02 was fish */}
        <div style={{ position: "absolute", left: X0 + 430, top: Y0 - 58, display: "flex", alignItems: "center", gap: 12, opacity: fish, transform: `translateY(${(1 - fish) * 10}px)` }}>
          <div style={{ width: 104, height: 58, background: "#fff", borderRadius: 14, border: `1.5px solid ${VIOLET}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 24px -8px rgba(22,22,22,.20)" }}>
            <img src={staticFile("fish/fish_glyph.png")} style={{ width: "76%", objectFit: "contain" }} />
          </div>
          <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 34, color: INK, whiteSpace: "nowrap" }}>it&apos;s fish<span style={{ color: VIOLET }}>.</span></span>
        </div>
        <div style={{ position: "absolute", left: X0 + 436, top: Y0 + 168, fontFamily: SANS, fontWeight: 700, fontSize: 24, color: PEACH, opacity: price, whiteSpace: "nowrap" }}>
          at a fraction of the price
        </div>
        {/* closer — brand black pill */}
        <div style={{ position: "absolute", left: X0 + 430, top: Y0 + 320, opacity: cta, transform: `scale(${0.8 + 0.2 * cta})`, transformOrigin: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 16, background: INK, borderRadius: 999, padding: "22px 44px", boxShadow: "0 24px 48px -16px rgba(22,22,22,.4)" }}>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, color: "#fff", whiteSpace: "nowrap" }}>let&apos;s set it up</span>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, color: "#E8DFD0" }}>→</span>
          </div>
        </div>
      </>
    );
  };

/* ---------- LISTENING BREAK (fullscreen) ---------- */
const ListeningBreak: React.FC<{ p: number }> = ({ p }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const aOn = frame >= f(CLIP_A.at) && frame <= f(CLIP_A.at + CLIP_A.dur);
  const bOn = frame >= f(CLIP_B.at) && frame <= f(CLIP_B.at + CLIP_B.dur);
  const aProg = interpolate(frame, [f(CLIP_A.at), f(CLIP_A.at + CLIP_A.dur)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bProg = interpolate(frame, [f(CLIP_B.at), f(CLIP_B.at + CLIP_B.dur)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bIn = useIn(f(CLIP_B.at - 0.35), 10);
  const player = (label: string, y: number, active: boolean, prog: number, seed: number, dim: number) => (
    <div style={{
      position: "absolute", left: 0.5 * W, top: y, transform: "translateX(-50%)",
      width: 0.46 * W, background: "#fff",
      border: `2px solid ${active ? VIOLET : CARD_BORDER}`, borderRadius: W * 0.016,
      boxShadow: active ? "0 30px 70px -20px rgba(22,22,22,.20)" : "0 22px 50px -22px rgba(22,22,22,.14)",
      padding: `${W * 0.016}px ${W * 0.022}px`, opacity: dim,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: MONO, fontSize: W * 0.011, fontWeight: 700, color: active ? VIOLET : BODY, background: active ? VIOLET_BG : "#F1EDE6", padding: `${W * 0.003}px ${W * 0.009}px`, borderRadius: 999 }}>[ {label} ]</span>
        <span style={{ fontFamily: MONO, fontSize: W * 0.010, fontWeight: 700, color: BODY }}>{active ? "PLAYING" : prog >= 1 ? "DONE" : "UP NEXT"}</span>
      </div>
      <div style={{ marginTop: W * 0.012, display: "flex", justifyContent: "center" }}>
        <EqBars n={26} h={W * 0.036} seed={seed} live={active} color={active ? VIOLET : "#C9C3BA"} bw={Math.round(W * 0.0045)} />
      </div>
      <div style={{ marginTop: W * 0.012, height: W * 0.004, borderRadius: 999, background: "#F1EDE6", overflow: "hidden" }}>
        <div style={{ width: `${prog * 100}%`, height: "100%", background: active ? VIOLET : "#C9C3BA", borderRadius: 999 }} />
      </div>
    </div>
  );
  return (
    <AbsoluteFill style={{ opacity: p }}>
      <AbsoluteFill style={{ background: CREAM }} />
      <Blobs o={1} />
      <div style={{ position: "absolute", left: 0.5 * W, top: 0.115 * H, transform: "translateX(-50%)", textAlign: "center" }}>
        <span style={{ fontFamily: MONO, fontSize: W * 0.011, fontWeight: 700, color: VIOLET, background: VIOLET_BG, padding: `${W * 0.004}px ${W * 0.012}px`, borderRadius: 999 }}>[ listen closely ]</span>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.030, letterSpacing: "-0.02em", color: INK, marginTop: W * 0.008 }}>
          which one would you publish?
        </div>
      </div>
      {player("clip 01", 0.30 * H, aOn, aProg, 4, 1)}
      <div style={{ opacity: bIn }}>{player("clip 02", 0.60 * H, bOn, bProg, 7, 1)}</div>
    </AbsoluteFill>
  );
};

export default FishIntro;

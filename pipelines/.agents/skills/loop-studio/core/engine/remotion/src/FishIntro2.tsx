/**
 * FishIntro2 — "the departures board" (2026-07-02).
 * One voice, shipped worldwide. COLD OPEN: the SAME sentence plays in Luuk's cloned
 * voice in Spanish, then flips to Chinese — live native captions + EN translation.
 * Then the terminal-wall journey along a dotted flight path:
 *   S2.1 model card → the input (a few seconds of voice, once) → the 80+ LANGUAGE BOARD
 *   (chips cascade in) → strike list (re-recording/translators/voice actors) →
 *   Claude the operator → ONE video fans out into FOUR.
 * Palette: bg #F5F3F1 · blush #F8EEE8 · gray #999EA9 · violet #7C5CFC.
 */
import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
  delayRender, continueRender,
} from "remotion";

const FPS = 30;
const f = (sec: number) => Math.round(sec * FPS);

/* ---------------- palette ---------------- */
const BG = "#F5F3F1";
const BLUSH = "#F8EEE8";
const GRAY = "#999EA9";
const VIOLET = "#9b90e8";
const VIOLET_SOFT = "#ECEAFA";
const INK = "#17171A";
const LINE = "#E9E6E2";
const SANS = "'DM Sans', 'Helvetica Neue', sans-serif";
const SANS_I = "'DM Sans', 'PingFang SC', 'Hiragino Sans GB', 'Helvetica Neue', sans-serif"; // intl glyphs
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

/* fonts */
const fontHandle = delayRender("fish2-fonts");
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

/* ---------------- structure ---------------- */
const OPEN_LEN = 9.9;                             // avatar ES (5.1s) + ZH (4.4s) cold open, then A-roll
const T = (srcSec: number) => srcSec + OPEN_LEN;
const SRC_DUR = 39.79;                            // comp 49.69 → 1491 frames
const ES = { at: 0.15, dur: 5.12 };               // es_avatar.mp4 (real lip sync)
const ZH = { at: 5.27, dur: 4.41 };               // zh_avatar.mp4
// live captions (comp time, word/char) — from the generated welcome lines
const ES_WORDS: [number, string][] = [
  [0.32, "Bienvenido"], [0.93, "a"], [1.05, "este"], [1.29, "vídeo,"], [1.89, "qué"],
  [2.15, "bueno"], [2.42, "que"], [2.54, "estés"], [2.84, "aquí."], [3.55, "esto"],
  [3.75, "se"], [3.93, "pone"], [4.29, "muy"], [4.49, "interesante."],
];
const ZH_CHARS: [number, string][] = [
  [5.34, "欢"], [5.46, "迎"], [5.62, "观"], [5.83, "看"], [6.07, "这"], [6.17, "个"],
  [6.27, "视"], [6.43, "频"], [6.59, "，"], [6.84, "很"], [6.98, "高"], [7.16, "兴"],
  [7.28, "你"], [7.40, "来"], [7.52, "了"], [7.56, "，"], [8.03, "接"], [8.15, "下"],
  [8.25, "来"], [8.39, "的"], [8.49, "内"], [8.65, "容"], [8.92, "非"], [9.02, "常"],
  [9.16, "精"], [9.32, "彩"],
];
const EN_LINE = "“welcome to this video — glad you’re here.”";

/* the 80+ board */
const LANGS: [string, string, string][] = [
  ["ES", "Español", "🇪🇸"], ["ZH", "中文", "🇨🇳"], ["DE", "Deutsch", "🇩🇪"], ["FR", "Français", "🇫🇷"],
  ["PT", "Português", "🇵🇹"], ["JA", "日本語", "🇯🇵"], ["KO", "한국어", "🇰🇷"], ["HI", "हिन्दी", "🇮🇳"],
  ["IT", "Italiano", "🇮🇹"], ["NL", "Nederlands", "🇳🇱"], ["TR", "Türkçe", "🇹🇷"], ["PL", "Polski", "🇵🇱"],
  ["RU", "Русский", "🇷🇺"], ["VI", "Tiếng Việt", "🇻🇳"], ["TH", "ไทย", "🇹🇭"], ["ID", "Bahasa", "🇮🇩"],
  ["SV", "Svenska", "🇸🇪"], ["EL", "Ελληνικά", "🇬🇷"], ["CS", "Čeština", "🇨🇿"], ["DA", "Dansk", "🇩🇰"],
  ["RO", "Română", "🇷🇴"], ["UK", "Українська", "🇺🇦"], ["AR", "العربية", "🇸🇦"], ["HE", "עברית", "🇮🇱"],
];

/* ---------------- world camera ---------------- */
const CAM: [number, number, number, number][] = [
  [f(0.0), 960, 540, 1.0],
  [f(7.4), 960, 545, 1.05],
  [f(T(5.6)), 960, 540, 1.05],                    // (hook covers)
  [f(T(6.7)), 1990, 525, 1.16],                   // → the model (bigger in frame)
  [f(T(10.6)), 2015, 522, 1.24],
  [f(T(11.5)), 2970, 610, 1.22],                  // → the input
  [f(T(14.3)), 2995, 606, 1.30],
  [f(T(15.1)), 4120, 620, 0.96],                  // → THE BOARD (wide but full)
  [f(T(19.9)), 4145, 618, 1.02],
  [f(T(20.4)), 5430, 585, 1.24],                  // → the strikes
  [f(T(25.1)), 5455, 583, 1.30],
  [f(T(25.9)), 6540, 645, 1.24],                  // → the operator
  [f(T(31.5)), 6560, 643, 1.30],                  // hold through "inside Claude"
  [f(T(32.4)), 7230, 600, 1.32],                  // → one becomes four
  [f(T(39.4)), 7250, 605, 1.40],                  // one continuous creep out
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

/* dotted flight path hopping station to station */
const FLIGHT_D =
  "M 1500 640 Q 1720 440 1930 540 " +
  "Q 2200 660 2480 600 Q 2720 555 2930 640 " +
  "Q 3250 760 3520 640 Q 3720 555 3960 580 " +
  "Q 4600 640 4980 600 Q 5230 575 5440 640 " +
  "Q 5750 735 6020 680 Q 6180 650 6330 700 " +
  "Q 6650 800 6900 700 Q 7050 640 7230 640";
const FLIGHT_LEN = 6600;

const Blobs: React.FC = () => (
  <>
    <div style={{ position: "absolute", left: "-12%", top: "-25%", width: "55%", height: "80%", borderRadius: "50%", background: "radial-gradient(circle, rgba(155,144,232,0.10), transparent 70%)", filter: "blur(85px)" }} />
    <div style={{ position: "absolute", right: "-10%", top: "-18%", width: "52%", height: "78%", borderRadius: "50%", background: "radial-gradient(circle, rgba(232,205,190,0.40), transparent 70%)", filter: "blur(90px)" }} />
    <div style={{ position: "absolute", left: "28%", bottom: "-30%", width: "48%", height: "72%", borderRadius: "50%", background: "radial-gradient(circle, rgba(153,158,169,0.16), transparent 70%)", filter: "blur(85px)" }} />
  </>
);

const useIn = (at: number, dur = 16) => {
  const frame = useCurrentFrame();
  if (frame < at) return 0;
  return interpolate(frame, [at, at + dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
};

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

const Pill: React.FC<{ children: React.ReactNode; blush?: boolean }> = () => null;

export const FishIntro2: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const wu = W / 1920;
  const sec = frame / FPS;
  const c = cam(frame);
  const camX = c.x + Math.sin(frame / 42) * 4, camY = c.y + Math.cos(frame / 51) * 3, zoom = c.z;

  const worldStyle: React.CSSProperties = {
    position: "absolute", left: 0, top: 0, width: 0, height: 0,
    transform: `translate(${W / 2 - camX * zoom * wu}px, ${H / 2 - camY * zoom * wu}px) scale(${zoom * wu})`,
    transformOrigin: "0 0",
  };

  const flightP = interpolate(frame, [f(T(5.8)), f(T(32.5))], [0.02, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.4, 1) });

  const inOpen = frame < f(OPEN_LEN);
  const openOut = interpolate(frame, [f(OPEN_LEN - 0.45), f(OPEN_LEN)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  /* speaker: fullscreen hook → corner journey */
  const spk = (() => {
    const kf: [number, number, number, number][] = [
      [f(OPEN_LEN), 0.5, 0.5, 0.94],
      [f(T(5.55)), 0.5, 0.5, 0.94],
      [f(T(6.65)), 0.165, 0.745, 0.235],
      [f(T(31.2)), 0.165, 0.745, 0.235],
      [f(T(32.2)), 0.145, 0.78, 0.205],           // tuck smaller for the 1→4 finale
      [f(T(39.4)), 0.148, 0.782, 0.205],
    ];
    if (frame <= kf[0][0]) { const [, x, y, w] = kf[0]; return { x, y, w }; }
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
  const spkOpacity = interpolate(frame, [f(OPEN_LEN - 0.45), f(OPEN_LEN)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  /* hook treatment */
  const hb = f(OPEN_LEN);
  const hookBlur = interpolate(frame, [hb, hb + f(0.7)], [9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const hookBright = interpolate(frame, [hb, hb + f(0.7)], [1.13, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hookScale = interpolate(frame, [hb, hb + f(2.4)], [1.08, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.3, 0, 0.4, 1) });
  const frameDraw = interpolate(frame, [hb + f(0.2), hb + f(1.3)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.5, 0, 0.2, 1) });
  const eyebrowIn = interpolate(frame, [hb + f(0.35), hb + f(0.85)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const bigIn = interpolate(frame, [f(T(4.25)), f(T(4.7))], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const titleOut = interpolate(frame, [f(T(5.35)), f(T(5.8))], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: SANS }}>
      <Blobs />

      {/* ================= WORLD: the terminal wall ================= */}
      <div style={worldStyle}>
        <svg width={7600} height={2000} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <path d={FLIGHT_D} fill="none" stroke={VIOLET} strokeWidth={4.5}
            strokeLinecap="round" strokeDasharray="1 20" opacity={0.5}
            strokeDashoffset={FLIGHT_LEN * (1 - flightP)} pathLength={FLIGHT_LEN} />
        </svg>

        <StationModel at={f(T(6.3))} nameAt={f(T(8.6))} />
        <StationInput at={f(T(11.7))} onceAt={f(T(14.0))} />
        <StationBoard at={f(T(15.4))} countAt={f(T(15.7))} moreAt={f(T(18.8))} />
        <StationStrikes at={f(T(20.6))} s1={f(T(22.2))} s2={f(T(23.4))} s3={f(T(24.6))} />
        <StationClaude at={f(T(27.3))} withAt={f(T(30.6))} />
        <StationFour at={f(T(32.7))} fanAt={f(T(33.9))} fourAt={f(T(38.4))} ctaAt={f(T(38.75))} />
      </div>

      {/* ================= SPEAKER ================= */}
      <div style={{
        position: "absolute",
        left: spk.x * W - spkW / 2, top: spk.y * H - spkH / 2, width: spkW, height: spkH,
        borderRadius: spkRadius, overflow: "hidden", opacity: spkOpacity,
        boxShadow: `0 ${W * 0.007}px ${W * 0.022}px rgba(23,23,26,0.20), 0 0 0 1px rgba(23,23,26,0.05)`,
      }}>
        {frame < f(OPEN_LEN) && (
          <img src={staticFile("fish2/poster.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
        )}
        <Sequence from={f(OPEN_LEN)} layout="none">
          {/* A-roll audio is MUTED here — Remotion mis-times this file's audio by ~610ms; the real
              voice is muxed back in post from source.mp4 (ffmpeg decodes it correctly). Video only. */}
          <OffthreadVideo muted src={staticFile("fish2/source.mp4")}
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${hookScale})`, filter: `contrast(1.04) saturate(1.05) brightness(${hookBright})${hookBlur > 0.1 ? ` blur(${hookBlur}px)` : ""}` }} />
        </Sequence>

        {frame >= hb && frame < f(T(6.0)) && (
          <>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "44%", background: "linear-gradient(to top, rgba(23,23,26,0.60), transparent)", opacity: Math.min(eyebrowIn, titleOut) }} />
            <div style={{ position: "absolute", left: "5.2%", bottom: "8.5%", opacity: titleOut }}>
              <div style={{ opacity: eyebrowIn, transform: `translateY(${(1 - eyebrowIn) * W * 0.006}px)`, display: "flex", alignItems: "center", gap: W * 0.007 }}>
                <span style={{ fontSize: W * 0.055, lineHeight: 1, filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.4))" }}>🇪🇸</span>
                <span style={{ fontSize: W * 0.055, lineHeight: 1, filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.4))" }}>🇨🇳</span>
                <span style={{ fontFamily: MONO, fontSize: W * 0.0115, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(255,255,255,0.8)", marginLeft: W * 0.006 }}>THAT WAS MY VOICE.</span>
              </div>
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.040, color: "#fff", lineHeight: 1.05, marginTop: W * 0.006, opacity: bigIn, transform: `translateY(${(1 - bigIn) * W * 0.008}px)` }}>
                I can&apos;t speak <span style={{ color: VIOLET }}>a word</span> of either.
              </div>
            </div>
          </>
        )}

        {/* violet frame — persistent */}
        <svg width="100%" height="100%" viewBox={`0 0 ${spkW} ${spkH}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
          <rect x={W * 0.0035} y={W * 0.0035} width={spkW - W * 0.007} height={spkH - W * 0.007}
            rx={spkRadius * 0.85} fill="none" stroke={VIOLET} strokeWidth={W * 0.0022}
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - frameDraw)} />
        </svg>
      </div>

      {/* ================= COLD OPEN: one sentence, two languages ================= */}
      {inOpen && <ColdOpen out={openOut} sec={sec} />}

      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 80% 72% at 50% 44%, transparent 62%, rgba(23,23,26,0.06) 100%)" }} />

      {frame >= f(T(39.45)) && (
        <AbsoluteFill style={{ background: "#fff", opacity: interpolate(frame, [f(T(39.45)), f(T(39.65)), f(T(39.79))], [0, 0.85, 0.95], { extrapolateRight: "clamp" }) }} />
      )}

      {/* ---- ONSET SFX: every cue keyed to the SAME T(...) as its visual element, so it fires on the exact frame the thing appears (never on settle) ---- */}
      {/* cold open + A-roll cut-in */}
      <Sequence from={f(ES.at)} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.26} /></Sequence>
      <Sequence from={f(ZH.at)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.36} /></Sequence>
      <Sequence from={f(OPEN_LEN)} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.3} /></Sequence>
      {/* StationModel — at=T(6.3) nameAt=T(8.6) */}
      <Sequence from={f(T(6.3))} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.3} /></Sequence>
      <Sequence from={f(T(8.6))} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.3} /></Sequence>
      {/* StationInput — at=T(11.7) onceAt=T(14.0) */}
      <Sequence from={f(T(11.7))} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.3} /></Sequence>
      <Sequence from={f(T(14.0))} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.3} /></Sequence>
      {/* StationBoard — at=T(15.4) countAt=T(15.7) moreAt=T(18.8) */}
      <Sequence from={f(T(15.4))} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.32} /></Sequence>
      <Sequence from={f(T(15.7))} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.34} /></Sequence>
      <Sequence from={f(T(18.8))} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.4} /></Sequence>
      {/* StationStrikes — at=T(20.6) then three strikes as HITS */}
      <Sequence from={f(T(20.6))} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.3} /></Sequence>
      <Sequence from={f(T(22.2))} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tap.wav")} volume={0.5} /></Sequence>
      <Sequence from={f(T(23.4))} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tap.wav")} volume={0.5} /></Sequence>
      <Sequence from={f(T(24.6))} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tap.wav")} volume={0.52} /></Sequence>
      {/* StationClaude — at=T(27.3) withAt=T(30.6) */}
      <Sequence from={f(T(27.3))} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.3} /></Sequence>
      <Sequence from={f(T(30.6))} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.4} /></Sequence>
      {/* StationFour — at=T(32.7); fan cards at fanAt=T(33.9) staggered 0.367s; fourAt=T(38.4); ctaAt=T(38.75) */}
      <Sequence from={f(T(32.7))} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.3} /></Sequence>
      {[0, 1, 2, 3].map((i) => (
        <Sequence key={`fan${i}`} from={f(T(33.9 + i * 0.367))} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.28 - i * 0.015} /></Sequence>
      ))}
      <Sequence from={f(T(38.4))} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.4} /></Sequence>
      <Sequence from={f(T(38.75))} durationInFrames={15}><Audio src={staticFile("vedit/sfx/tap.wav")} volume={0.55} /></Sequence>
    </AbsoluteFill>
  );
};

/* ---------- COLD OPEN: his own video, auto-dubbed ---------- */
const ColdOpen: React.FC<{ out: number; sec: number }> = ({ out, sec }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const inP = interpolate(frame, [0, f(0.45)], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const swap = interpolate(frame, [f(5.05), f(5.45)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.45, 0, 0.18, 1) });
  const isES = swap < 0.5;
  const flip = Math.abs(swap - 0.5) * 2;
  const lang = isES ? { flag: "🇪🇸", name: "Español" } : { flag: "🇨🇳", name: "中文 · Mandarin" };
  const words = isES ? ES_WORDS : ZH_CHARS;
  const vis = words.filter(([t]) => sec >= t);
  const caption = isES ? vis.map(([, w]) => w).join(" ") : vis.map(([, w]) => w).join("");
  const prog = interpolate(sec, [0.2, OPEN_LEN], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <AbsoluteFill style={{ background: "#000" }} />
      {/* his AI clone actually speaking the languages — real lip sync */}
      <Sequence from={f(ES.at)} durationInFrames={f(ZH.at) - f(ES.at) + 4} layout="none">
        <OffthreadVideo src={staticFile("fish2/es_avatar.mp4")}
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.04) saturate(1.05)" }} />
      </Sequence>
      <Sequence from={f(ZH.at)} layout="none">
        <OffthreadVideo src={staticFile("fish2/zh_avatar.mp4")}
          style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.04) saturate(1.05)" }} />
      </Sequence>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: "22%", background: "linear-gradient(to bottom, rgba(8,8,10,0.55), transparent)", opacity: inP }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "34%", background: "linear-gradient(to top, rgba(8,8,10,0.65), transparent)", opacity: inP }} />

      {/* top-left: preview label */}
      <div style={{ position: "absolute", left: 0.032 * W, top: 0.045 * H, fontFamily: MONO, fontSize: W * 0.0105, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(255,255,255,0.75)", opacity: inP }}>
        SAME VOICE · NEW LANGUAGE
      </div>

      {/* top-right: the audio-track chip (flips ES → ZH) */}
      <div style={{
        position: "absolute", right: 0.032 * W, top: 0.038 * H, display: "flex", alignItems: "center", gap: W * 0.008,
        background: "rgba(12,12,16,0.78)", borderRadius: 999, padding: `${W * 0.0055}px ${W * 0.012}px`,
        border: "1px solid rgba(255,255,255,0.14)", opacity: inP, transform: `scaleY(${Math.max(0.05, flip)})`,
      }}>
        <span style={{ fontSize: W * 0.085, lineHeight: 1, filter: "drop-shadow(0 10px 28px rgba(0,0,0,0.45))" }}>{lang.flag}</span>
        <span style={{ fontFamily: MONO, fontSize: W * 0.011, fontWeight: 700, color: "#fff", background: VIOLET, padding: `${W * 0.004}px ${W * 0.013}px`, borderRadius: 999 }}>{isES ? "ES" : "ZH"} · CLONED</span>
      </div>

      {/* captions — word-synced, YT style */}
      <div style={{ position: "absolute", left: 0.5 * W, bottom: 0.145 * H, transform: "translateX(-50%)", maxWidth: 0.72 * W, textAlign: "center", opacity: inP }}>
        {caption.length > 0 && (
          <span style={{
            fontFamily: SANS_I, fontWeight: 700, fontSize: W * 0.0205, lineHeight: 1.5, color: "#fff",
            background: "rgba(10,10,14,0.78)", borderRadius: W * 0.006, padding: `${W * 0.004}px ${W * 0.010}px`,
            boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone",
          }}>{caption}</span>
        )}
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: W * 0.0105, color: "rgba(255,255,255,0.62)", marginTop: W * 0.007 }}>
          {EN_LINE} — <span style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700 }}>his voice, cloned</span>
        </div>
      </div>

      {/* player progress */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: W * 0.0024, background: "rgba(255,255,255,0.22)" }}>
        <div style={{ width: `${prog * 100}%`, height: "100%", background: VIOLET }} />
      </div>
    </AbsoluteFill>
  );
};

/* ---------- Station: THE MODEL ---------- */
const StationModel: React.FC<{ at: number; nameAt: number }> = ({ at, nameAt }) => {
  const p = useIn(at);
  const nm = useIn(nameAt, 12);
  return (
    <>
      <div style={{ position: "absolute", left: 1720, top: 300, opacity: p }}><Pill>[ brand new ]</Pill></div>
      <div style={{
        position: "absolute", left: 1710, top: 355, width: 640, background: "#fff",
        border: `1px solid ${LINE}`, borderRadius: 22, padding: 34,
        boxShadow: "0 2px 8px rgba(23,23,26,.05), 0 22px 44px -18px rgba(23,23,26,.14)",
        opacity: p, transform: `rotate(-0.8deg) translateY(${(1 - p) * 22}px)`,
      }}>
        <img src={staticFile("fish/fish_wordmark.png")} style={{ width: 400, display: "block" }} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 20, opacity: Math.max(0.15, nm), transform: `translateY(${(1 - nm) * 10}px)` }}>
          <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 60, letterSpacing: "-0.03em", color: INK, lineHeight: 1 }}>S2.1 Pro</span>
          <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: "#fff", background: VIOLET, padding: "5px 14px", borderRadius: 999 }}>NEW</span>
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 23, color: GRAY, marginTop: 10, whiteSpace: "nowrap" }}>the voice model behind what you just heard.</div>
      </div>
    </>
  );
};

/* ---------- Station: THE INPUT ---------- */
const StationInput: React.FC<{ at: number; onceAt: number }> = ({ at, onceAt }) => {
  const p = useIn(at);
  const once = useIn(onceAt, 12);
  return (
    <>
      <div style={{ position: "absolute", left: 2700, top: 430, opacity: p }}><Pill blush>[ the input ]</Pill></div>
      <div style={{
        position: "absolute", left: 2690, top: 485, width: 560, background: "#fff",
        border: `1px solid ${LINE}`, borderRadius: 22, padding: 32,
        boxShadow: "0 22px 44px -18px rgba(23,23,26,.14)",
        opacity: p, transform: `rotate(0.7deg) translateY(${(1 - p) * 22}px)`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 999, background: VIOLET_SOFT, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 14, height: 22, borderRadius: 7, border: `3px solid ${VIOLET}` }} />
          </div>
          <span style={{ fontFamily: MONO, fontSize: 21, fontWeight: 700, color: INK }}>luuk_voice.wav</span>
          <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: GRAY, marginLeft: "auto" }}>0:07</span>
        </div>
        <div style={{ marginTop: 18 }}><EqBars n={22} h={44} seed={4} live={false} color="#C9CBD1" bw={6} /></div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, color: INK, marginTop: 18, opacity: once, transform: `translateY(${(1 - once) * 10}px)` }}>
          a few seconds. <span style={{ background: VIOLET_SOFT, color: VIOLET, padding: "0 12px", borderRadius: 10 }}>recorded once.</span>
        </div>
      </div>
    </>
  );
};

/* ---------- Station: THE 80+ BOARD ---------- */
const StationBoard: React.FC<{ at: number; countAt: number; moreAt: number }> = ({ at, countAt, moreAt }) => {
  const frame = useCurrentFrame();
  const p = useIn(at);
  const count = Math.round(interpolate(frame, [countAt, countAt + 26], [2, 80], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }));
  const more = useIn(moreAt, 12);
  return (
    <>
      <div style={{ position: "absolute", left: 3480, top: 270, opacity: p }}><Pill>[ departures ]</Pill></div>
      <div style={{ position: "absolute", left: 3470, top: 322, display: "flex", alignItems: "baseline", gap: 20, opacity: p }}>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 96, letterSpacing: "-0.04em", color: INK, lineHeight: 1 }}>
          {count}<span style={{ color: VIOLET }}>+</span>
        </span>
        <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, color: GRAY, whiteSpace: "nowrap" }}>languages. same voice.</span>
      </div>
      <div style={{ position: "absolute", left: 3470, top: 470, width: 1320, display: "flex", flexWrap: "wrap", gap: 14 }}>
        {LANGS.map(([code, name, flag], i) => {
          const ci = useIn(at + 6 + i * 2.2, 9);
          const proven = code === "ES" || code === "ZH";
          return (
            <div key={code} style={{
              display: "flex", alignItems: "center", gap: 10,
              background: proven ? VIOLET_SOFT : "#fff", border: `1.5px solid ${proven ? VIOLET : LINE}`,
              borderRadius: 999, padding: "9px 20px", opacity: ci, transform: `translateY(${(1 - ci) * 10}px)`,
            }}>
              <span style={{ fontSize: 20 }}>{flag}</span>
              <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: proven ? VIOLET : GRAY }}>{code}</span>              {proven && <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 17, color: VIOLET }}>✓</span>}
            </div>
          );
        })}
        <div style={{
          display: "flex", alignItems: "center", background: INK, borderRadius: 999,
          padding: "9px 22px", opacity: more, transform: `translateY(${(1 - more) * 10}px)`,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: "#fff" }}>+ 56 MORE</span>
        </div>
      </div>
    </>
  );
};

/* ---------- Station: THE STRIKES ---------- */
const StationStrikes: React.FC<{ at: number; s1: number; s2: number; s3: number }> = ({ at, s1, s2, s3 }) => {
  const p = useIn(at);
  // "voice actors" row removed 2026-07-16 — Fish now licenses professional voice actors, so striking them out is off-message.
  const rows: [string, number][] = [["re-recording", s1], ["translators", s2]];
  return (
    <>
      <div style={{ position: "absolute", left: 5180, top: 380, opacity: p }}><Pill blush>[ not needed ]</Pill></div>
      <div style={{
        position: "absolute", left: 5170, top: 435, width: 520, background: "#fff",
        border: `1px solid ${LINE}`, borderRadius: 22, padding: "30px 36px",
        boxShadow: "0 22px 44px -18px rgba(23,23,26,.14)", opacity: p, transform: `rotate(-0.6deg) translateY(${(1 - p) * 22}px)`,
      }}>
        {rows.map(([txt, sAt]) => {
          const s = useIn(sAt, 9);
          return (
            <div key={txt} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0" }}>
              <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 26, color: s > 0.5 ? GRAY : INK, position: "relative" }}>
                no {txt}
                <span style={{ position: "absolute", left: "-2%", top: "54%", height: 4, width: `${s * 104}%`, background: VIOLET, borderRadius: 4 }} />
              </span>
              <span style={{ marginLeft: "auto", fontFamily: SANS, fontWeight: 800, fontSize: 24, color: VIOLET, opacity: s }}>✓</span>
            </div>
          );
        })}
      </div>
    </>
  );
};

/* ---------- Station: THE OPERATOR ---------- */
const StationClaude: React.FC<{ at: number; withAt: number }> = ({ at, withAt }) => {
  const p = useIn(at);
  const w = useIn(withAt, 12);

  return (
    <>
      <div style={{ position: "absolute", left: 6100, top: 500, opacity: p }}><Pill>[ the operator ]</Pill></div>
      <div style={{ position: "absolute", left: 6090, top: 560, display: "flex", alignItems: "center", gap: 26, opacity: p }}>
        <div style={{
          width: 160, height: 160, background: "#fff", borderRadius: 34, border: `1.5px solid ${w > 0.3 ? VIOLET : LINE}`,
          boxShadow: w > 0.3 ? "0 18px 40px -14px rgba(155,144,232,.35)" : "0 18px 40px -16px rgba(23,23,26,.15)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: `rotate(${-2 + p * 1}deg)`, opacity: 0.45 + 0.55 * w,
        }}>
          <img src={staticFile("fish/claude.png")} style={{ width: "58%", objectFit: "contain" }} />
        </div>
        <div>
          {/* pre-line while he says "show you exactly how" — hands off to the Claude line */}
          <div style={{ position: "absolute", fontFamily: SANS, fontWeight: 800, fontSize: 40, color: INK, whiteSpace: "nowrap", opacity: p * (1 - w) }}>
            here&apos;s <span style={{ background: VIOLET_SOFT, color: VIOLET, padding: "0 12px", borderRadius: 10 }}>exactly</span> how.
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 40, color: INK, whiteSpace: "nowrap", opacity: w, transform: `translateY(${(1 - w) * 10}px)` }}>
            it all runs <span style={{ color: VIOLET }}>inside Claude</span><span style={{ fontWeight: 500, color: GRAY }}>.</span>
          </div>
        </div>
      </div>
    </>
  );
};

/* ---------- Station: ONE VIDEO → FOUR ---------- */
const StationFour: React.FC<{ at: number; fanAt: number; fourAt: number; ctaAt: number }> = ({ at, fanAt, fourAt, ctaAt }) => {
  const p = useIn(at);
  const four = useIn(fourAt, 10);
  const cta = useIn(ctaAt, 10);
  const langs: [string, string][] = [["EN", "🇺🇸"], ["ES", "🇪🇸"], ["ZH", "🇨🇳"], ["DE", "🇩🇪"]];
  return (
    <>
      <div style={{ position: "absolute", left: 6900, top: 330, opacity: p }}><Pill>[ the pipeline ]</Pill></div>
      {/* the one */}
      <div style={{
        position: "absolute", left: 6890, top: 430, width: 300, background: "#fff",
        border: `1px solid ${LINE}`, borderRadius: 16, padding: 10,
        boxShadow: "0 22px 46px -18px rgba(23,23,26,.2)", opacity: p, transform: `rotate(-1deg) translateY(${(1 - p) * 20}px)`,
      }}>
        <img src={staticFile("fish2/thumb.jpg")} style={{ width: "100%", borderRadius: 9, display: "block" }} />
        <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: GRAY, marginTop: 8, letterSpacing: "0.08em" }}>ONE VIDEO</div>
      </div>
      {/* the four */}
      {langs.map(([lg, flag], i) => {
        const fi = useIn(fanAt + i * 11, 13);
        const y = 360 + i * 160;
        return (
          <React.Fragment key={lg}>
            <svg width={170} height={560} style={{ position: "absolute", left: 7190, top: 340, overflow: "visible", opacity: fi, pointerEvents: "none" }}>
              <path d={`M 10 205 C 75 205, 85 ${y + 55 - 340}, 152 ${y + 55 - 340}`} fill="none" stroke={VIOLET} strokeWidth={3.5} strokeLinecap="round" strokeDasharray="1 12" />
            </svg>
            <div style={{
              position: "absolute", left: 7350, top: y, width: 210, background: "#fff",
              border: `1.5px solid ${lg === "EN" ? LINE : VIOLET}`, borderRadius: 13, padding: 7,
              boxShadow: "0 16px 34px -14px rgba(23,23,26,.18)", opacity: fi, transform: `translateX(${(1 - fi) * -14}px) rotate(${(i - 1.5) * 0.8}deg)`,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <img src={staticFile("fish2/thumb.jpg")} style={{ width: 92, borderRadius: 7, display: "block", filter: lg === "EN" ? "none" : "saturate(1.08)" }} />
              <div>
                <span style={{ fontSize: 17, marginRight: 7 }}>{flag}</span>
                <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: lg === "EN" ? GRAY : VIOLET }}>{lg}</span>
                <div style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 700, color: INK }}>{lg === "EN" ? "original" : "same voice"}</div>
              </div>
            </div>
          </React.Fragment>
        );
      })}
      <div style={{ position: "absolute", left: 6820, top: 905, fontFamily: SANS, fontWeight: 800, fontSize: 46, color: INK, opacity: four, transform: `translateY(${(1 - four) * 12}px)`, whiteSpace: "nowrap" }}>
        one video <span style={{ color: VIOLET }}>→ four</span><span style={{ color: GRAY, fontWeight: 500 }}>. automatically.</span>
      </div>
      {/* closer — brand black pill */}
      <div style={{ position: "absolute", left: 6930, top: 742, opacity: cta, transform: `scale(${0.82 + 0.18 * cta})`, transformOrigin: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 14, background: INK, borderRadius: 999, padding: "18px 38px", boxShadow: "0 22px 46px -16px rgba(23,23,26,.4)" }}>
          <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: "#fff", whiteSpace: "nowrap" }}>let&apos;s start now</span>
          <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: VIOLET }}>→</span>
        </div>
      </div>
    </>
  );
};

export default FishIntro2;

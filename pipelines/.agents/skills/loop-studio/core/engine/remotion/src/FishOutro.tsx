/**
 * FishOutro — 16:9 world-canvas outro for the Fish multilingual video (2026-07-03).
 * Same style as FishIntro2 (departures board): cream canvas, violet accent, dotted
 * flight path, moving speaker card, [ pill ] tags, flags, badges, clean karaoke captions.
 * Stations: FREE·JULY → 50% OFF + link → thank-you → 80+ languages → "see you next video".
 */
import React from "react";
import {
  AbsoluteFill, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig,
  staticFile, Easing, delayRender, continueRender,
} from "remotion";
import WORDS from "./fishoutro_words.json";

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const EASE = Easing.bezier(0.45, 0, 0.18, 1);
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const BG = "#F5F3F1";
const VIOLET = "#9b90e8";
const VIOLET_SOFT = "#ECEAFA";
const INK = "#17171A";
const GRAY = "#9AA0AC";
const LINE = "#E4E0DA";
const SANS = "'DM Sans', 'PingFang SC', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

const fontHandle = delayRender("fishoutro-fonts");
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

type Word = [number, number, string];
const words = WORDS as Word[];

const GRID_URI = (() => {
  const s = 84;
  return "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'><path d='M ${s} 0 L 0 0 0 ${s}' fill='none' stroke='rgba(155,144,232,0.12)' stroke-width='1.2'/></svg>`);
})();

const useIn = (at: number, dur = 12) => {
  const frame = useCurrentFrame();
  if (frame < at) return 0;
  return interpolate(frame, [at, at + dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
};
const hold = (frame: number, at: number, until: number, d = 9) =>
  Math.min(
    interpolate(frame, [at, at + d], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }),
    interpolate(frame, [until - d, until], [1, 0], clamp));

/* dotted flight path (cosmetic thread, no arrowhead) */
const FLIGHT_D =
  "M 1500 640 Q 1720 470 1960 560 Q 2260 660 2560 600 " +
  "Q 2860 545 3160 640 Q 3520 760 3860 660 Q 4180 575 4460 640 " +
  "Q 4820 740 5160 660 Q 5460 590 5760 650";
const FLIGHT_LEN = 5200;
const FLAGS = ["🇪🇸", "🇨🇳", "🇩🇪", "🇫🇷", "🇯🇵", "🇰🇷", "🇮🇳", "🇧🇷", "🇮🇹", "🇳🇱"];

/* ---- source footage skips (cut in SOURCE, not the render) ----
   Remove spoken "S2.1" and "the whole month of July" from the speaker footage.
   Audio is muxed precisely in post; these seams keep the speaker roughly lip-synced
   and are CROSS-DISSOLVED so the head morphs instead of snapping (never ripple-cut a render). */
const SRC_DUR = 24.36;
const S1A = 0.38, S1B = 1.52;        // "The [S2.1] model"
// NB: whisper mis-placed "developers" end at 3.06. The word's tail is long + fragmented (vowel
// 3.075-3.145, gap, "-s" 3.22-3.235, trailing decay to ~3.34). Cutting tight kept sounding like
// "develop/develope/developer" — keep the FULL tail to 3.34 so it trails off naturally; S2B capped
// at 4.90 (before "There's"@4.94). COMP_DUR -> 21.66 (durationInFrames 650 in Root.tsx).
const S2A = 3.34, S2B = 4.90;        // "developers" full natural tail | [the whole month of July]. There's
const S1 = S1B - S1A;                // 1.14
const S2 = S2B - S2A;                // 1.59
const C1 = S1A;                      // comp seam 1 = 0.38
const C2 = S1A + (S2A - S1B);        // comp seam 2 = 1.92
const COMP_DUR = SRC_DUR - S1 - S2;  // 21.63
const CF = 5;                        // avatar cross-dissolve length (frames)
const OutroSeg: React.FC<{ startFrom: number; fadeIn: boolean; fadeOut: boolean; dur: number; blur: number }> =
  ({ startFrom, fadeIn, fadeOut, dur, blur }) => {
    const r = useCurrentFrame();
    let op = 1;
    if (fadeIn) op = Math.min(op, interpolate(r, [0, CF], [0, 1], clamp));
    if (fadeOut) op = Math.min(op, interpolate(r, [dur - CF, dur], [1, 0], clamp));
    return <OffthreadVideo muted src={staticFile("fish2/outro.mp4")} startFrom={startFrom}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
        filter: `contrast(1.04) saturate(1.05)${blur > 0.1 ? ` blur(${blur}px)` : ""}`, opacity: op }} />;
  };

/* clean karaoke captions */
function chunk(ws: Word[]): Word[][] {
  const groups: Word[][] = []; let cur: Word[] = [];
  for (const w of ws) {
    cur.push(w);
    const endsClause = /[.?!,]$/.test(w[2]);
    const dur = w[1] - cur[0][0];
    if ((cur.length >= 4 && (endsClause || dur > 1.6)) || cur.length >= 6) { groups.push(cur); cur = []; }
  }
  if (cur.length) groups.push(cur);
  return groups;
}
const Captions: React.FC = () => {
  const { width: W } = useVideoConfig();
  const t = useCurrentFrame() / FPS;
  const groups = React.useMemo(() => chunk(words), []);
  let gi = -1;
  for (let i = 0; i < groups.length; i++) {
    const start = groups[i][0][0];
    const end = i + 1 < groups.length ? groups[i + 1][0][0] : groups[i][groups[i].length - 1][1] + 0.6;
    if (t >= start - 0.08 && t < end) { gi = i; break; }
  }
  if (gi < 0) return null;
  const g = groups[gi];
  const pop = interpolate(t, [g[0][0] - 0.08, g[0][0] + 0.08], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", left: "12%", right: "12%", bottom: "8%", textAlign: "center", opacity: pop, transform: `scale(${0.97 + 0.03 * pop})` }}>
      {g.map(([s, e, w], i) => {
        const current = t >= s - 0.02 && (i === g.length - 1 ? t < e + 0.25 : t < g[i + 1][0]);
        return (
          <span key={i} style={{
            fontFamily: SANS, fontWeight: 800, fontSize: W * 0.026, lineHeight: 1.4, letterSpacing: "-0.01em",
            color: current ? "#fff" : INK, background: current ? VIOLET : "transparent",
            padding: `${W * 0.0022}px ${W * 0.007}px`, borderRadius: W * 0.008, margin: `0 ${W * 0.002}px`,
            boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone",
            textShadow: current ? "none" : "0 2px 10px rgba(245,243,241,0.9)",
          }}>{w}</span>
        );
      })}
    </div>
  );
};

const Tag: React.FC<{ children: React.ReactNode }> = () => null;

/* world camera + speaker choreography */
// retimed to the CUT speech (S2.1 + July removed): hook 0-0.8 · FREE 1.0-2.1 ·
// 50%OFF 2.4-7.2 · THANKS 7.6-14.7 · 80+ 15.5-16.7 · CTA 17.1-21.5
const CAM: [number, number, number, number][] = [
  [f(0.0), 900, 640, 1.0], [f(0.8), 905, 638, 1.02],
  [f(1.0), 1960, 560, 1.08], [f(2.1), 1980, 556, 1.14],        // FREE (for developers)
  [f(2.4), 3160, 640, 1.04], [f(7.2), 3180, 636, 1.10],        // 50% OFF + link
  [f(7.6), 4160, 640, 1.0], [f(14.7), 4180, 636, 1.06],        // THANKS
  [f(15.5), 5160, 660, 0.92], [f(16.7), 5185, 656, 0.98],      // 80+ LANGUAGES
  [f(17.1), 5760, 650, 1.06], [f(COMP_DUR), 5785, 648, 1.12],  // CTA close
];
type KF = [number, number, number, number, number];
const SPK: KF[] = [
  [f(0), 0.5, 0.5, 0.9, 0], [f(0.8), 0.5, 0.5, 0.9, 0],
  [f(1.0), 0.24, 0.72, 0.24, -2], [f(2.1), 0.24, 0.72, 0.24, -2],
  [f(2.4), 0.75, 0.71, 0.24, 2], [f(7.2), 0.75, 0.71, 0.24, 2],
  [f(7.6), 0.5, 0.5, 0.52, 0], [f(14.7), 0.5, 0.5, 0.52, 0],      // bigger for the thank-you
  [f(15.5), 0.78, 0.26, 0.22, 2], [f(16.7), 0.78, 0.26, 0.22, 2],
  [f(17.1), 0.72, 0.7, 0.26, 2], [f(COMP_DUR), 0.72, 0.7, 0.26, 2],
];
function interpCam(frame: number, ks: [number, number, number, number][]) {
  if (frame <= ks[0][0]) { const [, x, y, z] = ks[0]; return { x, y, z }; }
  for (let i = 0; i < ks.length - 1; i++) {
    const [fa, xa, ya, za] = ks[i]; const [fb, xb, yb, zb] = ks[i + 1];
    if (frame >= fa && frame <= fb) { const t = EASE((frame - fa) / Math.max(1, fb - fa)); return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, z: za + (zb - za) * t }; }
  }
  const [, x, y, z] = ks[ks.length - 1]; return { x, y, z };
}
function interpKF(frame: number, kf: KF[]) {
  if (frame <= kf[0][0]) { const [, x, y, w, r] = kf[0]; return { x, y, w, r }; }
  for (let i = 0; i < kf.length - 1; i++) {
    const [fa, xa, ya, wa, ra] = kf[i]; const [fb, xb, yb, wb, rb] = kf[i + 1];
    if (frame >= fa && frame <= fb) { const t = EASE((frame - fa) / Math.max(1, fb - fa)); return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, w: wa + (wb - wa) * t, r: ra + (rb - ra) * t }; }
  }
  const [, x, y, w, r] = kf[kf.length - 1]; return { x, y, w, r };
}

const World: React.FC = () => {
  const frame = useCurrentFrame();
  const free = hold(frame, f(1.0), f(2.2));
  const s21 = useIn(f(0.3), 12);
  const off = hold(frame, f(2.4), f(7.3));
  const link = useIn(f(5.9), 12);
  const thanks = hold(frame, f(7.6), f(14.7));
  const learned = useIn(f(10.3), 12);
  // The narration reaches "80 plus languages" at 15.64s. Reveal the board on that phrase,
  // rather than during the preceding "links in the description" sentence.
  const board = hold(frame, f(15.5), f(16.8));
  const flagP = FLAGS.map((_, i) => interpolate(frame, [f(15.5) + 8 + i * 2, f(15.5) + 16 + i * 2], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const cta = hold(frame, f(17.1), f(COMP_DUR));
  const next = useIn(f(19.7), 12);
  return (
    <>
      {/* FREE JULY */}
      {free > 0 && (
        <div style={{ position: "absolute", left: 1640, top: 400, width: 640, opacity: free }}>
          <Tag>[ this month ]</Tag>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 22 }}>
            <img src={staticFile("fish/fish_glyph.png")} style={{ height: 60, objectFit: "contain" }} />
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 46, color: INK }}>S2.1 Pro</span>
            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 24, color: "#fff", background: VIOLET, padding: "6px 16px", borderRadius: 999, opacity: s21 }}>NEW</span>
          </div>
          <div style={{ marginTop: 22, display: "inline-flex", alignItems: "center", gap: 18, background: "#fff", border: `2px solid ${VIOLET}`, borderRadius: 999, padding: "20px 38px", boxShadow: "0 24px 50px -16px rgba(155,144,232,.45)" }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 52, color: VIOLET }}>FREE</span>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 38, color: INK }}>for developers</span>
          </div>
        </div>
      )}
      {/* 50% OFF + link */}
      {off > 0 && (
        <div style={{ position: "absolute", left: 2840, top: 440, width: 620, opacity: off }}>
          <Tag>[ for creators ]</Tag>
          <div style={{ marginTop: 22, display: "inline-flex", alignItems: "center", gap: 18, background: VIOLET, borderRadius: 999, padding: "22px 44px", boxShadow: "0 24px 50px -16px rgba(155,144,232,.55)" }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 64, color: "#fff" }}>50% OFF</span>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: "#EFEAFE" }}>creator plans</span>
          </div>
          <div style={{ marginTop: 22, display: "inline-flex", alignItems: "center", gap: 14, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: "16px 26px", opacity: link, transform: `translateY(${(1 - link) * 12}px)` }}>
            <span style={{ fontFamily: MONO, fontSize: 24, color: GRAY }}>▸</span>
            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 26, color: INK }}>link in the description</span>
          </div>
        </div>
      )}
      {/* THANKS */}
      {thanks > 0 && (
        <div style={{ position: "absolute", left: 3860, top: 400, width: 620, opacity: thanks, textAlign: "center" }}>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 72, letterSpacing: "-0.02em", color: INK }}>thanks for<br />sticking around<span style={{ color: VIOLET }}>.</span></div>
          <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 32, color: GRAY, marginTop: 16, opacity: learned }}>hope you <span style={{ color: INK, fontWeight: 700 }}>learned something.</span></div>
        </div>
      )}
      {/* 80+ LANGUAGES */}
      {board > 0 && (
        <div style={{ position: "absolute", left: 4820, top: 400, width: 720, opacity: board }}>
          <Tag>[ your turn ]</Tag>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 20 }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 132, letterSpacing: "-0.04em", color: INK, lineHeight: 1 }}>80<span style={{ color: VIOLET }}>+</span></span>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 46, color: GRAY }}>languages</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 22, fontSize: 50 }}>
            {FLAGS.map((fl, i) => <span key={i} style={{ opacity: flagP[i], transform: `translateY(${(1 - flagP[i]) * 12}px)` }}>{fl}</span>)}
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 32, color: GRAY, marginTop: 20 }}>in your <span style={{ color: INK, fontWeight: 800 }}>own voice.</span></div>
        </div>
      )}
      {/* CTA close */}
      {cta > 0 && (
        <div style={{ position: "absolute", left: 5430, top: 430, width: 640, opacity: cta }}>
          <Tag>[ next up ]</Tag>
          <div style={{ marginTop: 22, display: "inline-flex", alignItems: "center", gap: 18, background: INK, borderRadius: 999, padding: "24px 44px", boxShadow: "0 24px 50px -16px rgba(23,23,26,.4)", opacity: next, transform: `scale(${0.9 + 0.1 * next})` }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 46, color: "#fff", whiteSpace: "nowrap" }}>see you next video</span>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 46, color: VIOLET }}>→</span>
          </div>
        </div>
      )}
    </>
  );
};

export const FishOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const wu = W / 1920;
  const s21badge = hold(frame, f(0.3), f(2.1));   // big Fish S2.1 Pro on the model line (spoken S2.1 cut in post)
  const c0 = interpCam(frame, CAM);
  const c = { x: c0.x + Math.sin(frame / 44) * 6, y: c0.y + Math.cos(frame / 52) * 5, z: c0.z };
  const worldStyle: React.CSSProperties = {
    position: "absolute", left: 0, top: 0, width: 0, height: 0,
    transform: `translate(${W / 2 - c.x * wu * c.z}px, ${H / 2 - c.y * wu * c.z}px) scale(${c.z * wu})`, transformOrigin: "0 0",
  };
  const gridPos = `${W / 2 - c.x * wu * c.z}px ${H / 2 - c.y * wu * c.z}px`;
  const flightP = interpolate(frame, [f(0.5), f(17.5)], [0.03, 1], { ...clamp, easing: Easing.bezier(0.4, 0, 0.4, 1) });

  const spk = interpKF(frame, SPK);
  const spkW = spk.w * W, spkH = spkW * 9 / 16;
  const hookBlur = interpolate(frame, [0, 16], [8, 0], { ...clamp, easing: Easing.out(Easing.quad) });
  const endFade = interpolate(frame, [f(COMP_DUR - 0.26), f(COMP_DUR)], [1, 0], clamp);

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: SANS, opacity: endFade }}>
      <AbsoluteFill style={{
        backgroundImage: `url("${GRID_URI}")`, backgroundSize: `${84 * wu * c.z}px`, backgroundPosition: gridPos,
        maskImage: "radial-gradient(ellipse 90% 78% at 50% 45%, #000 0%, rgba(0,0,0,.4) 60%, transparent 92%)",
        WebkitMaskImage: "radial-gradient(ellipse 90% 78% at 50% 45%, #000 0%, rgba(0,0,0,.4) 60%, transparent 92%)",
      }} />

      <div style={worldStyle}>
        <svg width={6400} height={1400} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <path d={FLIGHT_D} fill="none" stroke={VIOLET} strokeWidth={4.5} strokeLinecap="round" strokeDasharray="1 20" opacity={0.5}
            strokeDashoffset={FLIGHT_LEN * (1 - flightP)} pathLength={FLIGHT_LEN} />
        </svg>
        <World />
      </div>

      <div style={{
        position: "absolute", left: spk.x * W - spkW / 2, top: spk.y * H - spkH / 2, width: spkW, height: spkH,
        transform: `rotate(${spk.r}deg)`, borderRadius: W * 0.012, overflow: "hidden",
        boxShadow: "0 10px 34px rgba(23,23,26,0.24), 0 0 0 1px rgba(23,23,26,0.06)",
      }}>
        {/* footage skips "S2.1" and "the whole month of July" in SOURCE, cross-dissolved so the
            speaker morphs across each seam instead of snapping (audio is muxed precisely in post) */}
        <Sequence from={0} durationInFrames={f(C1) + CF} layout="none">
          <OutroSeg startFrom={0} fadeIn={false} fadeOut dur={f(C1) + CF} blur={hookBlur} />
        </Sequence>
        <Sequence from={f(C1)} durationInFrames={f(C2 - C1) + CF} layout="none">
          <OutroSeg startFrom={f(S1B)} fadeIn fadeOut dur={f(C2 - C1) + CF} blur={hookBlur} />
        </Sequence>
        <Sequence from={f(C2)} durationInFrames={f(COMP_DUR) - f(C2)} layout="none">
          <OutroSeg startFrom={f(S2B)} fadeIn fadeOut={false} dur={f(COMP_DUR) - f(C2)} blur={0} />
        </Sequence>
        <div style={{ position: "absolute", inset: 0, border: `${Math.max(3, spkW * 0.0055)}px solid ${VIOLET}`, borderRadius: W * 0.012 }} />
      </div>

      {s21badge > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: "21%", display: "flex", justifyContent: "center", opacity: s21badge }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: W * 0.012, background: "rgba(255,255,255,0.97)", borderRadius: W * 0.022, padding: `${W * 0.011}px ${W * 0.024}px`, boxShadow: "0 26px 64px -18px rgba(0,0,0,.5)" }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.036, color: INK, letterSpacing: "-0.02em" }}>Fish</span>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.024, color: "#fff", background: VIOLET, padding: `${W * 0.006}px ${W * 0.016}px`, borderRadius: 999 }}>S2.1 Pro</span>
          </div>
        </div>
      )}

      <Captions />
    </AbsoluteFill>
  );
};

export default FishOutro;

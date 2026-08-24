/**
 * FishShort — 9:16 WORLD-CANVAS Fish shorts (v3, 2026-07-03).
 * v2 notes from Luuk: PLAY the demo audio (mute defeated the point); captions too
 * pulsy + invisible on dark; motion jumpy not eased; scene 1 needs a GENERATED voice
 * demo we can hear. Fixes:
 *  · Listening-break inserts: narration pauses, the real clip AUDIO plays, then resumes.
 *      scene 2 → the ES then ZH avatar clips (video+audio). scene 1 → a Fish s2.1 emotion
 *      clip (audio) over a "now playing" listening card.
 *  · Captions on a readable dark bar, white text, current word on violet, NO per-word pulse.
 *  · Smoother motion: source-time keyframes mapped through the insert, long eased travels,
 *      minimal drift, true holds.
 */
import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig,
  staticFile, Easing, delayRender, continueRender,
} from "remotion";
import S1 from "./fishshort_s1.json";
import S2 from "./fishshort_s2.json";

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const EASE = Easing.bezier(0.42, 0, 0.16, 1);
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const BG = "#F5F3F1";
const VIOLET = "#7C5CFC";
const VIOLET_SOFT = "#EFEAFE";
const INK = "#17171A";
const GRAY = "#9AA0AC";
const LINE = "#E4E0DA";
const CAPBAR = "rgba(20,20,26,0.82)";
const SANS = "'DM Sans', 'PingFang SC', 'Hiragino Sans GB', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

const fontHandle = delayRender("fishshort-fonts");
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

const GRID_URI = (() => {
  const s = 84;
  return "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'><path d='M ${s} 0 L 0 0 0 ${s}' fill='none' stroke='rgba(124,92,252,0.12)' stroke-width='1.2'/></svg>`);
})();

type Word = [number, number, string];
type KF = [number, number, number, number, number]; // SOURCE sec, x(0-1), y(0-1), w(frac), rot

/* ---- per-scene config (times in SOURCE seconds; insert maps them to comp time) ---- */
const CFG = {
  1: {
    src: "fishshort/s1.mp4", srcDur: 33.63, insertAt: 3.0, insertLen: 5.0,
    poster: "fishshort/s1_poster.jpg",
  },
  2: {
    src: "fishshort/s2.mp4", srcDur: 34.66, insertAt: 2.6, insertLen: 5.35,
    poster: "",
  },
} as const;

const useInF = (at: number, dur = 12) => {
  const frame = useCurrentFrame();
  if (frame < at) return 0;
  return interpolate(frame, [at, at + dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
};
const holdF = (frame: number, at: number, until: number, d = 10) =>
  Math.min(
    interpolate(frame, [at, at + d], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }),
    interpolate(frame, [until - d, until], [1, 0], clamp));

function interp(frame: number, ks: number[][]) {
  if (frame <= ks[0][0]) return ks[0].slice(1);
  for (let i = 0; i < ks.length - 1; i++) {
    const a = ks[i], b = ks[i + 1];
    if (frame >= a[0] && frame <= b[0]) {
      const t = EASE((frame - a[0]) / Math.max(1, b[0] - a[0]));
      return a.slice(1).map((v, j) => v + (b[j + 1] - v) * t);
    }
  }
  return ks[ks.length - 1].slice(1);
}

const EqBars: React.FC<{ n?: number; h?: number; color?: string; bw?: number; live?: boolean }> = ({ n = 9, h = 60, color = INK, bw = 8, live = true }) => {
  const frame = useCurrentFrame();
  return (
    <svg width={n * (bw + 6)} height={h}>
      {Array.from({ length: n }).map((_, i) => {
        const base = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + 1.3));
        const wob = live ? 0.74 + 0.26 * Math.sin(frame / 7 + i * 1.9) : 1;
        const bh = Math.max(8, h * base * wob);
        return <rect key={i} x={i * (bw + 6)} y={(h - bh) / 2} width={bw} height={bh} rx={bw / 2} fill={color} />;
      })}
    </svg>
  );
};
const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, letterSpacing: "0.18em", color: VIOLET }}>{children}</div>
);

/* clean karaoke captions — one readable dark bar, white words, current word violet, NO pulse */
function chunk(words: Word[]): Word[][] {
  const groups: Word[][] = []; let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    const endsClause = /[.?!,]$/.test(w[2]);
    const dur = w[1] - cur[0][0];
    if ((cur.length >= 3 && (endsClause || dur > 1.5)) || cur.length >= 5) { groups.push(cur); cur = []; }
  }
  if (cur.length) groups.push(cur);
  return groups;
}
const Captions: React.FC<{ words: Word[]; hideFrom?: number; hideTo?: number }> = ({ words, hideFrom, hideTo }) => {
  const { width: W } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const groups = React.useMemo(() => chunk(words), [words]);
  if (hideFrom != null && hideTo != null && frame >= hideFrom && frame < hideTo) return null;
  let gi = -1;
  for (let i = 0; i < groups.length; i++) {
    const start = groups[i][0][0];
    const end = i + 1 < groups.length ? groups[i + 1][0][0] : groups[i][groups[i].length - 1][1] + 0.6;
    if (t >= start - 0.08 && t < end) { gi = i; break; }
  }
  if (gi < 0) return null;
  const g = groups[gi];
  const pop = interpolate(t, [g[0][0] - 0.1, g[0][0] + 0.02], [0, 1], clamp); // gentle fade, no scale
  return (
    <div style={{ position: "absolute", left: "6%", right: "6%", bottom: "10.5%", display: "flex", justifyContent: "center", opacity: pop }}>
      <div style={{ background: CAPBAR, borderRadius: W * 0.028, padding: `${W * 0.016}px ${W * 0.026}px`, maxWidth: "100%", textAlign: "center", boxShadow: "0 12px 34px rgba(0,0,0,0.28)" }}>
        {g.map(([s, e, w], i) => {
          const current = t >= s - 0.02 && (i === g.length - 1 ? t < e + 0.25 : t < g[i + 1][0]);
          return (
            <span key={i} style={{
              fontFamily: SANS, fontWeight: 800, fontSize: W * 0.056, lineHeight: 1.34, letterSpacing: "-0.01em",
              color: "#fff", background: current ? VIOLET : "transparent",
              padding: `${W * 0.002}px ${W * 0.011}px`, borderRadius: W * 0.014, margin: `0 ${W * 0.002}px`,
              boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone",
            }}>{w}</span>
          );
        })}
      </div>
    </div>
  );
};

/* ============================ SCENE 1 WORLD ============================ */
/* source-time station beats (mapped via T at call site) */
const Scene1World: React.FC<{ T: (s: number) => number }> = ({ T }) => {
  const frame = useCurrentFrame();
  const emo = holdF(frame, f(T(3.4)), f(T(6.9)));            // "It laughs, it whispers, it even cracks"
  const p0 = useInF(f(T(3.57)), 8), p1 = useInF(f(T(4.39)), 8), p2 = useInF(f(T(5.59)), 8);
  const pills = [{ t: "[ laughs ]", p: p0 }, { t: "[ whispers ]", p: p1 }, { t: "[ cracks ]", p: p2 }];
  const model = holdF(frame, f(T(7.9)), f(T(13.0)));         // "That is Fish's brand new S2.1 model"
  const won = useInF(f(T(11.0)), 12);
  const control = holdF(frame, f(T(16.3)), f(T(25.2)));
  const caret = Math.sin(frame / 8) > 0 ? 1 : 0.2;
  const free = holdF(frame, f(T(26.9)), f(T(29.6)));
  return (
    <>
      {emo > 0 && (
        <div style={{ position: "absolute", left: 1780, top: 640, width: 640, opacity: emo }}>
          <Tag>FIG.01 · EMOTION</Tag>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginTop: 26 }}>
            {pills.map((pl, i) => (
              <div key={pl.t} style={{ background: VIOLET, color: "#fff", fontFamily: MONO, fontWeight: 700, fontSize: 42, padding: "18px 32px", borderRadius: 999, opacity: pl.p, transform: `translateY(${(1 - pl.p) * 20}px) rotate(${(i - 1) * -2}deg)`, boxShadow: "0 20px 44px -14px rgba(124,92,252,.5)" }}>{pl.t}</div>
            ))}
          </div>
        </div>
      )}
      {model > 0 && (
        <div style={{ position: "absolute", left: 3000, top: 780, width: 620, opacity: model }}>
          <Tag>FIG.02 · THE MODEL</Tag>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 24 }}>
            <div style={{ width: 120, height: 120, background: "#fff", borderRadius: 28, border: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 18px 40px -16px rgba(23,23,26,.2)" }}>
              <img src={staticFile("fish/fish_glyph.png")} style={{ width: "62%", objectFit: "contain" }} />
            </div>
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 92, color: INK, letterSpacing: "-0.03em" }}>
              Fish<span style={{ fontSize: 38, color: "#fff", background: VIOLET, padding: "8px 18px", borderRadius: 999, marginLeft: 14, verticalAlign: "middle" }}>S2.1</span>
            </div>
          </div>
          <div style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 14, background: VIOLET_SOFT, borderRadius: 999, padding: "14px 28px", opacity: won }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 32, color: VIOLET }}>WON</span>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, color: INK }}>a test for sounding human</span>
          </div>
          {/* flashback to the demo voice on "won a test for sounding human" (muted; narration plays) */}
          <div style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 20, opacity: won, transform: `translateY(${(1 - won) * 16}px)` }}>
            <div style={{ width: 300, borderRadius: 18, overflow: "hidden", border: `4px solid ${VIOLET}`, boxShadow: "0 22px 46px -18px rgba(124,92,252,.5)" }}>
              <Sequence from={f(T(11.0))} durationInFrames={f(2.6)} layout="none">
                <OffthreadVideo src={staticFile("fishshort/emotion_avatar.mp4")} startFrom={f(0.4)} muted style={{ width: "100%", display: "block", aspectRatio: "16 / 9", objectFit: "cover" }} />
              </Sequence>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, letterSpacing: "0.06em", color: VIOLET, lineHeight: 1.3, whiteSpace: "nowrap" }}>◀ that voice</div>
          </div>
        </div>
      )}
      {control > 0 && (
        <div style={{ position: "absolute", left: 4230, top: 700, width: 640, opacity: control }}>
          <Tag>FIG.03 · YOU CONTROL IT</Tag>
          <div style={{ marginTop: 24, background: "#0F0F14", border: `2px solid ${VIOLET}`, borderRadius: 28, padding: 34, boxShadow: "0 24px 54px -18px rgba(124,92,252,.5)" }}>
            <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: "0.2em", color: GRAY, marginBottom: 18 }}>SCRIPT.TXT</div>
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 38, color: "#fff", lineHeight: 1.7 }}>
              <span style={{ color: VIOLET }}>[laugh]</span> that's wild<br />
              <span style={{ color: VIOLET }}>[whisper]</span> watch this<br />
              <span style={{ color: VIOLET }}>[pause]</span> right here<span style={{ color: VIOLET, opacity: caret }}>▊</span>
            </div>
          </div>
        </div>
      )}
      {free > 0 && (
        <div style={{ position: "absolute", left: 5470, top: 810, width: 560, opacity: free }}>
          <Tag>FIG.04 · RIGHT NOW</Tag>
          <div style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 18, background: "#fff", border: `2px solid ${VIOLET}`, borderRadius: 999, padding: "22px 40px", boxShadow: "0 24px 50px -16px rgba(124,92,252,.5)" }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 58, color: VIOLET }}>FREE</span>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, color: INK }}>for devs · all July</span>
          </div>
        </div>
      )}
    </>
  );
};

/* ============================ SCENE 2 WORLD ============================ */
const FLAGS = ["🇪🇸", "🇨🇳", "🇩🇪", "🇫🇷", "🇯🇵", "🇰🇷", "🇮🇳", "🇧🇷", "🇮🇹", "🇳🇱"];
const Scene2World: React.FC<{ T: (s: number) => number }> = ({ T }) => {
  const frame = useCurrentFrame();
  const model = holdF(frame, f(T(6.9)), f(T(9.5)));
  const board = holdF(frame, f(T(9.85)), f(T(17.6)));
  const count = Math.round(interpolate(frame, [f(T(13.9)), f(T(15.2))], [2, 80], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const contrast = holdF(frame, f(T(17.9)), f(T(23.6)));
  const stays = useInF(f(T(21.9)), 12);
  const free = holdF(frame, f(T(24.0)), f(T(30.0)));
  const off = holdF(frame, f(T(30.7)), f(T(34.6)));
  const flagP = FLAGS.map((_, i) => interpolate(frame, [f(T(9.85)) + 6 + i * 2, f(T(9.85)) + 14 + i * 2], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }));
  return (
    <>
      {model > 0 && (
        <div style={{ position: "absolute", left: 3100, top: 800, width: 620, opacity: model }}>
          <Tag>FIG.02 · THE MODEL</Tag>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 24 }}>
            <div style={{ width: 120, height: 120, background: "#fff", borderRadius: 28, border: `1px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 18px 40px -16px rgba(23,23,26,.2)" }}>
              <img src={staticFile("fish/fish_glyph.png")} style={{ width: "62%", objectFit: "contain" }} />
            </div>
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 92, color: INK, letterSpacing: "-0.03em" }}>
              Fish<span style={{ fontSize: 38, color: "#fff", background: VIOLET, padding: "8px 18px", borderRadius: 999, marginLeft: 14, verticalAlign: "middle" }}>S2.1</span>
            </div>
          </div>
        </div>
      )}
      {board > 0 && (
        <div style={{ position: "absolute", left: 4230, top: 620, width: 780, opacity: board }}>
          <Tag>FIG.03 · IT SCALES</Tag>
          <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginTop: 20 }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 168, letterSpacing: "-0.04em", color: INK, lineHeight: 1 }}>{count}<span style={{ color: VIOLET }}>+</span></span>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 52, color: GRAY }}>languages</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 26, fontSize: 56 }}>
            {FLAGS.map((fl, i) => <span key={i} style={{ opacity: flagP[i], transform: `translateY(${(1 - flagP[i]) * 12}px)` }}>{fl}</span>)}
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: GRAY, marginTop: 22 }}>still the <span style={{ color: INK, fontWeight: 800 }}>exact same person.</span></div>
        </div>
      )}
      {contrast > 0 && (
        <div style={{ position: "absolute", left: 5540, top: 720, width: 640, opacity: contrast }}>
          <Tag>FIG.04 · THE DIFFERENCE</Tag>
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 20, padding: "22px 30px" }}>
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: GRAY }}>other tools</span>
              <span style={{ marginLeft: "auto", fontFamily: SANS, fontWeight: 800, fontSize: 34, color: "#C2452E", textDecoration: "line-through" }}>voice lost</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 18, background: VIOLET_SOFT, border: `2px solid ${VIOLET}`, borderRadius: 20, padding: "22px 30px", opacity: stays }}>
              <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 36, color: VIOLET }}>S2.1</span>
              <span style={{ marginLeft: "auto", fontFamily: SANS, fontWeight: 800, fontSize: 38, color: INK }}>stays you ✓</span>
            </div>
          </div>
        </div>
      )}
      {free > 0 && (
        <div style={{ position: "absolute", left: 6780, top: 810, width: 560, opacity: free }}>
          <Tag>FIG.05 · RIGHT NOW</Tag>
          <div style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 18, background: "#fff", border: `2px solid ${VIOLET}`, borderRadius: 999, padding: "22px 40px", boxShadow: "0 24px 50px -16px rgba(124,92,252,.5)" }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 54, color: VIOLET }}>FREE</span>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 38, color: INK }}>for devs · all July</span>
          </div>
        </div>
      )}
      {off > 0 && (
        <div style={{ position: "absolute", left: 7980, top: 780, width: 560, opacity: off }}>
          <Tag>FIG.06 · CREATORS</Tag>
          <div style={{ marginTop: 24, display: "inline-flex", alignItems: "center", gap: 18, background: VIOLET, borderRadius: 999, padding: "24px 44px", boxShadow: "0 24px 50px -16px rgba(124,92,252,.55)" }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 64, color: "#fff" }}>50% OFF</span>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 36, color: "#EFEAFE" }}>creator plans</span>
          </div>
        </div>
      )}
    </>
  );
};

/* ============================ LISTEN INSERTS (audio plays here) ============================ */
const Listen1: React.FC<{ p: number; avStart: number }> = ({ p, avStart }) => {
  const { width: W } = useVideoConfig();
  const frame = useCurrentFrame();
  const laughsOn = frame >= avStart + f(0.3);
  const whispersOn = frame >= avStart + f(2.2);
  return (
    <AbsoluteFill style={{ opacity: p }}>
      <AbsoluteFill style={{ background: BG }} />
      <div style={{ position: "absolute", left: "50%", top: "16%", transform: "translateX(-50%)", textAlign: "center" }}>
        <span style={{ display: "inline-block", whiteSpace: "nowrap", fontFamily: MONO, fontSize: W * 0.028, fontWeight: 700, color: VIOLET, background: VIOLET_SOFT, padding: `${W * 0.012}px ${W * 0.03}px`, borderRadius: 999 }}>▶ now playing · Fish S2.1</span>
      </div>
      {/* LIP-SYNCED avatar clip (carries its own audio) — mouth moves with the Fish voice */}
      <Sequence from={avStart} durationInFrames={f(4.6)} layout="none">
        <div style={{ position: "absolute", left: "50%", top: "30%", transform: "translateX(-50%)", width: W * 0.66, borderRadius: W * 0.04, overflow: "hidden", border: `${W * 0.008}px solid ${VIOLET}`, boxShadow: "0 30px 70px -20px rgba(124,92,252,.55)" }}>
          <OffthreadVideo src={staticFile("fishshort/emotion_avatar.mp4")} style={{ width: "100%", display: "block", objectFit: "cover", aspectRatio: "16/9" }} />
        </div>
      </Sequence>
      <div style={{ position: "absolute", left: "50%", top: "63%", transform: "translateX(-50%)", display: "flex", gap: 16 }}>
        {[["laughs", laughsOn], ["whispers", whispersOn]].map(([tg, on]) => (
          <span key={tg as string} style={{ display: "inline-block", whiteSpace: "nowrap", fontFamily: MONO, fontWeight: 700, fontSize: W * 0.036, color: on ? "#fff" : GRAY, background: on ? VIOLET : "#E7E2DB", padding: `${W * 0.012}px ${W * 0.026}px`, borderRadius: 999 }}>[{tg as string}]</span>
        ))}
      </div>
      <div style={{ position: "absolute", left: "50%", top: "72%", transform: "translateX(-50%)" }}>
        <EqBars n={26} h={W * 0.06} bw={Math.round(W * 0.008)} color={VIOLET} />
      </div>
    </AbsoluteFill>
  );
};

/* one clip card with its own synced audio + opacity crossfade (local Sequence frame) */
const ClipCard: React.FC<{ src: string; from: number; dur: number; fadeOut: boolean }> = ({ src, from, dur, fadeOut }) => {
  const { width: W } = useVideoConfig();
  const local = useCurrentFrame();
  const op = Math.min(
    interpolate(local, [0, 9], [0, 1], clamp),
    fadeOut ? interpolate(local, [dur - 10, dur], [1, 0], clamp) : 1);
  return (
    <div style={{ position: "absolute", left: "50%", top: "26%", transform: `translateX(-50%) scale(${0.985 + 0.015 * Math.min(1, local / 9)})`, width: W * 0.66, borderRadius: W * 0.04, overflow: "hidden", border: `${W * 0.008}px solid ${VIOLET}`, boxShadow: "0 30px 72px -20px rgba(124,92,252,.6)", opacity: op }}>
      <OffthreadVideo src={staticFile(src)} startFrom={f(from)} style={{ width: "100%", display: "block", objectFit: "cover", aspectRatio: "16/9" }} />
    </div>
  );
};
const Listen2: React.FC<{ p: number; esStart: number; esDur: number; zhStart: number; zhDur: number }> = ({ p, esStart, esDur, zhStart, zhDur }) => {
  const { width: W } = useVideoConfig();
  const frame = useCurrentFrame();
  const showZh = frame >= zhStart + 5;
  const label = showZh ? { flag: "🇨🇳", name: "Chinese" } : { flag: "🇪🇸", name: "Spanish" };
  return (
    <AbsoluteFill style={{ opacity: p }}>
      <AbsoluteFill style={{ background: BG }} />
      <div style={{ position: "absolute", left: "50%", top: "12%", transform: "translateX(-50%)", width: "92%", textAlign: "center" }}>
        <span style={{ display: "inline-block", whiteSpace: "nowrap", fontFamily: MONO, fontSize: W * 0.028, fontWeight: 700, color: VIOLET, background: VIOLET_SOFT, padding: `${W * 0.012}px ${W * 0.03}px`, borderRadius: 999 }}>▶ same voice · just listen</span>
      </div>
      {/* ES then ZH — windows OVERLAP so the cards cross-dissolve (no bare-canvas gap); each clip
          is trimmed to end on a clean sentence boundary (ES after "…aquí.", ZH after "…来了.") */}
      <Sequence from={esStart} durationInFrames={esDur} layout="none"><ClipCard src="fish2/es_avatar.mp4" from={0.0} dur={esDur} fadeOut /></Sequence>
      <Sequence from={zhStart} durationInFrames={zhDur} layout="none"><ClipCard src="fish2/zh_avatar.mp4" from={0.0} dur={zhDur} fadeOut={false} /></Sequence>
      <div style={{ position: "absolute", left: "50%", top: "62%", transform: "translateX(-50%)", display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 16, whiteSpace: "nowrap" }}>
        <span style={{ fontSize: W * 0.06 }}>{label.flag}</span>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.06, color: INK }}>{label.name}</span>
        <span style={{ display: "inline-block", whiteSpace: "nowrap", fontFamily: MONO, fontWeight: 700, fontSize: W * 0.03, color: VIOLET, background: VIOLET_SOFT, padding: `${W * 0.008}px ${W * 0.02}px`, borderRadius: 999, marginLeft: 8 }}>his cloned voice</span>
      </div>
      <div style={{ position: "absolute", left: "50%", top: "70%", transform: "translateX(-50%)", display: "flex", gap: 14 }}>
        {[0, 1].map((i) => <div key={i} style={{ width: W * 0.03, height: W * 0.012, borderRadius: 999, background: (i === 0 && !showZh) || (i === 1 && showZh) ? VIOLET : "#DAD5CE" }} />)}
      </div>
    </AbsoluteFill>
  );
};

/* ============================ MAIN ============================ */
export const FishShort: React.FC<{ scene: number }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const cfg = CFG[scene as 1 | 2];
  const words = (scene === 1 ? S1 : S2) as Word[];
  const T = (s: number) => (s <= cfg.insertAt ? s : s + cfg.insertLen);
  const insStart = f(cfg.insertAt), insEnd = f(cfg.insertAt + cfg.insertLen);
  const inInsert = frame >= insStart && frame < insEnd;
  const insP = Math.min(
    interpolate(frame, [insStart, insStart + 5], [0, 1], clamp),
    interpolate(frame, [insEnd - 6, insEnd], [1, 0], clamp));

  // remap caption words through T
  const cWords = React.useMemo(() => words.map(([s, e, w]) => [T(s), T(e), w] as Word), [scene]);

  // camera / speaker keyframes in SOURCE seconds → comp frames via T
  const CAM1: number[][] = [
    [f(T(0)), 900, 900, 1.0], [f(T(2.9)), 905, 905, 1.02],
    [f(T(3.4)), 2100, 820, 1.1], [f(T(6.8)), 2120, 815, 1.14],
    [f(T(7.9)), 3300, 950, 1.04], [f(T(13.0)), 3320, 945, 1.1],
    [f(T(16.3)), 4550, 880, 1.02], [f(T(25.2)), 4575, 875, 1.08],
    [f(T(26.9)), 5750, 950, 1.1], [f(T(29.6)), 5770, 945, 1.14],
    [f(T(30.6)), 900, 900, 1.0], [f(T(33.6)), 905, 908, 1.05],
  ];
  const SPK1: number[][] = [
    [f(T(0)), 0.5, 0.5, 0.9, 0], [f(T(2.9)), 0.5, 0.5, 0.9, 0],
    [f(T(3.4)), 0.74, 0.30, 0.26, 2], [f(T(6.8)), 0.74, 0.30, 0.26, 2],     // EMOTION — card up to top-right so [laughs][whispers][cracks] pills stay visible
    [f(T(7.9)), 0.82, 0.14, 0.20, 2], [f(T(13.0)), 0.82, 0.14, 0.20, 2],     // MODEL — small top-right, clear of the station + flashback
    [f(T(16.3)), 0.79, 0.16, 0.22, 2], [f(T(25.2)), 0.79, 0.16, 0.22, 2],     // CONTROL — small top-right, clear of the FIG.03 tag + SCRIPT.TXT box
    [f(T(26.9)), 0.78, 0.17, 0.22, 2], [f(T(29.6)), 0.78, 0.17, 0.22, 2],     // FREE — small top-right, clear of centered badge + caption
    [f(T(30.6)), 0.5, 0.5, 0.86, 0], [f(T(33.6)), 0.5, 0.5, 0.86, 0],
  ];
  const CAM2: number[][] = [
    [f(T(0)), 900, 900, 1.0], [f(T(2.5)), 905, 905, 1.02],
    [f(T(6.9)), 3400, 950, 1.04], [f(T(9.5)), 3420, 945, 1.1],
    [f(T(9.9)), 4600, 880, 0.92], [f(T(17.6)), 4625, 875, 0.98],
    [f(T(17.9)), 5850, 900, 1.02], [f(T(23.6)), 5875, 898, 1.08],
    [f(T(24.0)), 7050, 950, 1.1], [f(T(30.0)), 7070, 945, 1.14],
    [f(T(30.7)), 8250, 930, 1.06], [f(T(34.6)), 8270, 928, 1.12],
  ];
  const SPK2: number[][] = [
    [f(T(0)), 0.5, 0.5, 0.9, 0], [f(T(2.5)), 0.5, 0.5, 0.9, 0],
    [f(T(6.9)), 0.73, 0.72, 0.32, 2], [f(T(9.5)), 0.73, 0.72, 0.32, 2],
    [f(T(9.9)), 0.27, 0.73, 0.32, -2], [f(T(17.6)), 0.27, 0.73, 0.32, -2],
    [f(T(17.9)), 0.73, 0.25, 0.30, 2], [f(T(23.6)), 0.73, 0.25, 0.30, 2],
    [f(T(24.0)), 0.78, 0.17, 0.22, 2], [f(T(30.0)), 0.78, 0.17, 0.22, 2],     // FREE — small top-right
    [f(T(30.7)), 0.78, 0.17, 0.22, 2], [f(T(34.6)), 0.78, 0.17, 0.22, 2],     // 50% OFF — stays top-right, clear of badge + caption
  ];
  const CAM = scene === 1 ? CAM1 : CAM2, SPK = scene === 1 ? SPK1 : SPK2;

  const c0 = interp(frame, CAM);
  const c = { x: c0[0] + Math.sin(frame / 60) * 3, y: c0[1] + Math.cos(frame / 68) * 2.5, z: c0[2] };
  const worldStyle: React.CSSProperties = {
    position: "absolute", left: 0, top: 0, width: 0, height: 0,
    transform: `translate(${W / 2 - c.x * c.z}px, ${H / 2 - c.y * c.z}px) scale(${c.z})`, transformOrigin: "0 0",
  };
  const gridPos = `${W / 2 - c.x * c.z}px ${H / 2 - c.y * c.z}px`;
  const spk = interp(frame, SPK);
  const [sx, sy, sw, sr] = spk;
  const spkW = sw * W, spkH = spkW * 16 / 9;
  // opening: cinematic eased settle (defocus + slight scale) + clean fade-in
  const hookBlur = interpolate(frame, [0, 18], [10, 0], { ...clamp, easing: Easing.out(Easing.quad) });
  const hookScale = interpolate(frame, [0, f(0.9)], [1.045, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const startFade = interpolate(frame, [0, 7], [0, 1], clamp);
  const endFade = Math.min(startFade, interpolate(frame, [f(T(cfg.srcDur) - 0.25), f(T(cfg.srcDur))], [1, 0], clamp));

  // ES/ZH inside scene-2 insert. Each clip is trimmed to a CLEAN sentence boundary:
  //   ES 0.0–3.15s ("Bienvenido a este vídeo, qué bueno que estés aquí." — before "Esto…")
  //   ZH 0.0–2.4s  ("欢迎观看这个视频，很高兴你来了。" — before "接下来…")
  // Windows overlap ~0.2s so the cards cross-dissolve; ZH ends exactly at insEnd (no gap).
  const esStart = insStart, esDur = f(3.15);
  const zhStart = insStart + f(2.95), zhDur = f(2.4);

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: SANS, opacity: endFade }}>
      <AbsoluteFill style={{
        backgroundImage: `url("${GRID_URI}")`, backgroundSize: `${84 * c.z}px`, backgroundPosition: gridPos,
        maskImage: "radial-gradient(ellipse 90% 78% at 50% 45%, #000 0%, rgba(0,0,0,.4) 60%, transparent 92%)",
        WebkitMaskImage: "radial-gradient(ellipse 90% 78% at 50% 45%, #000 0%, rgba(0,0,0,.4) 60%, transparent 92%)",
      }} />

      {/* WORLD */}
      <div style={worldStyle}>{scene === 1 ? <Scene1World T={T} /> : <Scene2World T={T} />}</div>

      {/* SPEAKER CARD (two sequences around the insert) */}
      {!inInsert && (
        <div style={{
          position: "absolute", left: sx * W - spkW / 2, top: sy * H - spkH / 2, width: spkW, height: spkH,
          transform: `rotate(${sr}deg)`, borderRadius: W * 0.03, overflow: "hidden",
          boxShadow: "0 10px 34px rgba(23,23,26,0.24), 0 0 0 1px rgba(23,23,26,0.06)",
        }}>
          <Sequence from={0} durationInFrames={insStart} layout="none">
            <OffthreadVideo src={staticFile(cfg.src)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${hookScale})`, filter: `contrast(1.04) saturate(1.05)${hookBlur > 0.1 ? ` blur(${hookBlur}px)` : ""}` }} />
          </Sequence>
          <Sequence from={insEnd} layout="none">
            <OffthreadVideo src={staticFile(cfg.src)} startFrom={insStart} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.04) saturate(1.05)" }} />
          </Sequence>
          <div style={{ position: "absolute", inset: 0, border: `${Math.max(3, spkW * 0.012)}px solid ${VIOLET}`, borderRadius: W * 0.03 }} />
        </div>
      )}

      {/* LISTEN INSERT (each carries its own synced audio via the clip's OffthreadVideo) */}
      {inInsert && (scene === 1
        ? <Listen1 p={insP} avStart={insStart + f(0.15)} />
        : <Listen2 p={insP} esStart={esStart} esDur={esDur} zhStart={zhStart} zhDur={zhDur} />)}

      {/* CAPTIONS (hidden during insert) */}
      <Captions words={cWords} hideFrom={insStart} hideTo={insEnd} />
    </AbsoluteFill>
  );
};

export default FishShort;

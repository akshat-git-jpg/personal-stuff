/**
 * FishHero2 — restaged 9:16 Fish short, scene 2 (multilingual). 2026-07-16.
 * Same hero system as FishHero1: LUUK FULL-SCREEN, overlays on top, shrink only for
 * the demo beat. NO FIG labels. "S2.1 Pro" everywhere. Discount = July -> August.
 * Official Fish brand: accent #9b90e8, Onest, black/white. Reuses fishshort_s2.json.
 */
import React from "react";
import {
  AbsoluteFill, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig,
  staticFile, Easing, delayRender, continueRender,
} from "remotion";
import S2 from "./fishshort_s2_hero.json";

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const VIOLET = "#9b90e8";
const VIOLET_SOFT = "#ECEAFA";
const ACCENT_DEEP = "#6E62C4";
const INK = "#17171A";
const GRAY = "#9AA0AC";
const RED = "#C2452E";
const SANS = "'Onest','Helvetica Neue',sans-serif";
const MONO = "'JetBrains Mono','SF Mono',Menlo,monospace";

const fontHandle = delayRender("fishhero2-fonts");
{
  let done = false;
  const finish = () => { if (!done) { done = true; continueRender(fontHandle); } };
  if (typeof document !== "undefined") {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=block";
    document.head.appendChild(link);
    const ft: any = (document as any).fonts;
    (ft && ft.ready ? ft.ready : Promise.resolve()).then(finish).catch(finish);
    setTimeout(finish, 4000);
  } else finish();
}

const INSERT_AT = 2.6, INSERT_LEN = 5.9, SRC_DUR = 34.66;
const T = (s: number) => (s <= INSERT_AT ? s : s + INSERT_LEN);
const FLAGS = ["🇪🇸", "🇨🇳", "🇩🇪", "🇫🇷", "🇯🇵", "🇰🇷", "🇮🇳", "🇧🇷", "🇮🇹", "🇳🇱"];

type Word = [number, number, string];
const holdF = (frame: number, a: number, b: number, d = 10) =>
  Math.min(interpolate(frame, [a, a + d], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }),
           interpolate(frame, [b - d, b], [1, 0], clamp));
const inF = (frame: number, at: number, d = 8) =>
  frame < at ? 0 : interpolate(frame, [at, at + d], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

function chunk(words: Word[]): Word[][] {
  const g: Word[][] = []; let c: Word[] = [];
  for (const w of words) { c.push(w);
    const clause = /[.?!,]$/.test(w[2]); const dur = w[1] - c[0][0];
    if ((c.length >= 3 && (clause || dur > 1.5)) || c.length >= 5) { g.push(c); c = []; } }
  if (c.length) g.push(c); return g;
}
const Captions: React.FC<{ words: Word[]; hideFrom: number; hideTo: number }> = ({ words, hideFrom, hideTo }) => {
  const { width: W } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const groups = React.useMemo(() => chunk(words), [words]);
  if (frame >= hideFrom && frame < hideTo) return null;
  let gi = -1;
  for (let i = 0; i < groups.length; i++) {
    const s = groups[i][0][0];
    const le = groups[i][groups[i].length - 1][1]; const e = Math.min(i + 1 < groups.length ? groups[i + 1][0][0] : le + 0.6, le + 0.9);
    if (t >= s - 0.08 && t < e) { gi = i; break; }
  }
  if (gi < 0) return null;
  const g = groups[gi];
  const pop = interpolate(t, [g[0][0] - 0.1, g[0][0] + 0.02], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", left: "7%", right: "7%", bottom: "11%", display: "flex", justifyContent: "center", opacity: pop }}>
      <div style={{ textAlign: "center", lineHeight: 1.28 }}>
        {g.map(([s, e, w], i) => {
          const cur = t >= s - 0.02 && (i === g.length - 1 ? t < e + 0.25 : t < g[i + 1][0]);
          return <span key={i} style={{
            fontFamily: SANS, fontWeight: 800, fontSize: W * 0.062, letterSpacing: "-0.01em",
            color: "#fff", background: cur ? VIOLET : "transparent",
            padding: `${W * 0.004}px ${W * 0.014}px`,
            borderRadius: W * 0.014, margin: `0 ${W * 0.003}px`,
            boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone",
            textShadow: cur ? "none" : "0 2px 10px rgba(0,0,0,0.85)",
          }}>{w}</span>;
        })}
      </div>
    </div>
  );
};

export const FishHero2: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const words = S2 as Word[];
  const cWords = React.useMemo(() => words.filter(([s]) => s !== 4.74).map(([s, e, w]) =>
    [T(s), T(e), w === "same" && s === 4.88 ? "my" : w] as Word), []);
  const insStart = f(INSERT_AT), insEnd = f(INSERT_AT + INSERT_LEN);
  const inInsert = frame >= insStart && frame < insEnd;
  const insP = Math.min(interpolate(frame, [insStart, insStart + 6], [0, 1], clamp),
                        interpolate(frame, [insEnd - 6, insEnd], [1, 0], clamp));

  const heroZoom = interpolate(frame, [0, f(T(SRC_DUR))], [1.0, 1.06], clamp);
  const startFade = interpolate(frame, [0, 7], [0, 1], clamp);
  const endFade = Math.min(startFade, interpolate(frame, [f(T(SRC_DUR)) - 8, f(T(SRC_DUR))], [1, 0], clamp));

  // beat windows (comp frames via T)
  const model = holdF(frame, f(T(6.0)), f(T(8.1)));
  // "80 languages" is spoken near the end of this sentence. Keep the board off-screen
  // until the phrase starts, then finish the count exactly as "80" is said.
  const board = holdF(frame, f(T(13.44)), f(T(17.6)), 6);
  const count = Math.round(interpolate(frame, [f(T(13.44)), f(T(13.6))], [2, 80], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const flagP = FLAGS.map((_, i) => inF(frame, f(T(13.6)) + i * 2, 9));
  const contrast = holdF(frame, f(T(17.9)), f(T(23.6)));
  const stays = inF(frame, f(T(21.9)), 12);
  const free = holdF(frame, f(T(24.0)), f(T(29.8)));
  const off = holdF(frame, f(T(30.7)), f(T(34.6)));

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: SANS, opacity: endFade }}>
      {/* HERO full-screen */}
      {!inInsert && (
        <AbsoluteFill style={{ transform: `scale(${heroZoom})`, transformOrigin: "50% 42%" }}>
          <Sequence from={0} durationInFrames={insStart} layout="none">
            <OffthreadVideo src={staticFile("fishshort/s2.mp4")} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.04) saturate(1.05)" }} />
          </Sequence>
          <Sequence from={insEnd} layout="none">
            <OffthreadVideo src={staticFile("fishshort/s2.mp4")} startFrom={insStart} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.04) saturate(1.05)" }} />
          </Sequence>
        </AbsoluteFill>
      )}

      {/* DEMO INSERT — Spanish THEN Chinese clip plays; Luuk shrinks (the "just listen" beat) */}
      {inInsert && (() => {
        const zhStart = insStart + f(3.25);
        const showZh = frame >= zhStart;
        return (
        <AbsoluteFill style={{ background: "#0B0B10", opacity: insP }}>
          <AbsoluteFill style={{ background: `radial-gradient(ellipse 76% 50% at 50% 38%, ${VIOLET}40 0%, ${VIOLET}14 42%, transparent 74%)` }} />
          <div style={{ position: "absolute", left: "50%", top: "8%", transform: "translateX(-50%)" }}>
            <span style={{ fontFamily: MONO, fontSize: W * 0.026, fontWeight: 700, letterSpacing: "0.06em", color: "#fff", background: VIOLET, padding: `${W * 0.012}px ${W * 0.028}px`, borderRadius: 999, whiteSpace: "nowrap" }}>▶ SAME VOICE · JUST LISTEN</span>
          </div>
          {/* bigger footage; ES then ZH */}
          <Sequence from={insStart + f(0.12)} durationInFrames={f(3.10)} layout="none">
            <div style={{ position: "absolute", left: "50%", top: "20%", transform: "translateX(-50%)", width: W * 0.88, borderRadius: W * 0.05, overflow: "hidden", border: `${W * 0.008}px solid ${VIOLET}`, boxShadow: `0 40px 90px -20px ${VIOLET}88` }}>
              <OffthreadVideo src={staticFile("fish2/es_avatar.mp4")} style={{ width: "100%", display: "block", objectFit: "cover", aspectRatio: "16/9" }} />
            </div>
          </Sequence>
          <Sequence from={zhStart} durationInFrames={f(2.55)} layout="none">
            <div style={{ position: "absolute", left: "50%", top: "20%", transform: "translateX(-50%)", width: W * 0.88, borderRadius: W * 0.05, overflow: "hidden", border: `${W * 0.008}px solid ${VIOLET}`, boxShadow: `0 40px 90px -20px ${VIOLET}88` }}>
              <OffthreadVideo src={staticFile("fish2/zh_avatar.mp4")} style={{ width: "100%", display: "block", objectFit: "cover", aspectRatio: "16/9" }} />
            </div>
          </Sequence>
          {/* ONE big language name (single row, no extra label) */}
          <div style={{ position: "absolute", left: 0, right: 0, top: "66%", textAlign: "center" }}>
            <span style={{ fontSize: W * 0.09, verticalAlign: "middle" }}>{showZh ? "🇨🇳" : "🇪🇸"}</span>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.11, color: "#fff", letterSpacing: "-0.02em", marginLeft: W * 0.02, verticalAlign: "middle" }}>{showZh ? "Chinese" : "Spanish"}</span>
          </div>
        </AbsoluteFill>
        );
      })()}

      {/* scrims */}
      {!inInsert && <AbsoluteFill style={{ pointerEvents: "none", background: "linear-gradient(180deg, rgba(8,8,12,0.62) 0%, rgba(8,8,12,0) 24%, rgba(8,8,12,0) 56%, rgba(8,8,12,0.74) 100%)" }} />}

      {/* brand eyebrow */}
      {!inInsert && (
        <div style={{ position: "absolute", top: "4.5%", left: 0, right: 0, textAlign: "center", opacity: interpolate(frame, [4, 16], [0, 1], clamp) }}>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: W * 0.028, letterSpacing: "0.18em", color: "#fff" }}>FISH AUDIO · <span style={{ color: "#CDBBff" }}>S2.1 PRO</span></span>
        </div>
      )}

      {/* S2.1 Pro model badge */}
      {model > 0 && !inInsert && (
        <div style={{ position: "absolute", top: "53%", left: 0, right: 0, display: "flex", justifyContent: "center", opacity: model }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: W * 0.02, background: "rgba(255,255,255,0.97)", borderRadius: W * 0.04, padding: `${W * 0.02}px ${W * 0.038}px`, boxShadow: "0 20px 50px -18px rgba(0,0,0,.5)" }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.078, color: INK, letterSpacing: "-0.02em" }}>Fish</span>
            <span style={{ fontSize: W * 0.05, color: "#fff", background: VIOLET, padding: `${W * 0.012}px ${W * 0.028}px`, borderRadius: 999, fontFamily: SANS, fontWeight: 800 }}>S2.1 Pro</span>
          </div>
        </div>
      )}

      {/* language board — counter + flags + "same person" */}
      {board > 0 && !inInsert && (
        <div style={{ position: "absolute", top: "45%", left: "7%", right: "7%", display: "flex", flexDirection: "column", alignItems: "center", gap: W * 0.014, opacity: board }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: W * 0.014 }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.15, color: "#fff", letterSpacing: "-0.04em", lineHeight: 1, textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>{count}<span style={{ color: VIOLET }}>+</span></span>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.05, color: "#fff" }}>languages</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: W * 0.01, fontSize: W * 0.05, maxWidth: "90%" }}>
            {FLAGS.map((fl, i) => <span key={i} style={{ opacity: flagP[i], transform: `translateY(${(1 - flagP[i]) * 10}px)` }}>{fl}</span>)}
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: W * 0.032, color: "#fff", background: `${VIOLET}D0`, padding: `${W * 0.008}px ${W * 0.02}px`, borderRadius: 999 }}>the exact same person</div>
        </div>
      )}

      {/* contrast — other tools lose it / S2.1 Pro stays you */}
      {contrast > 0 && !inInsert && (
        <div style={{ position: "absolute", top: "51%", left: "8%", right: "8%", display: "flex", flexDirection: "column", gap: W * 0.016, opacity: contrast }}>
          <div style={{ display: "flex", alignItems: "center", gap: W * 0.014, background: "rgba(255,255,255,0.95)", border: `1.5px solid #E4E0DA`, borderRadius: W * 0.028, padding: `${W * 0.018}px ${W * 0.026}px` }}>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: W * 0.032, color: GRAY }}>other tools</span>
            <span style={{ marginLeft: "auto", fontFamily: SANS, fontWeight: 800, fontSize: W * 0.032, color: RED, textDecoration: "line-through" }}>voice lost</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: W * 0.014, background: VIOLET_SOFT, border: `2px solid ${VIOLET}`, borderRadius: W * 0.028, padding: `${W * 0.018}px ${W * 0.026}px`, opacity: stays, transform: `translateY(${(1 - stays) * 12}px)` }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.034, color: ACCENT_DEEP }}>S2.1 Pro</span>
            <span style={{ marginLeft: "auto", fontFamily: SANS, fontWeight: 800, fontSize: W * 0.036, color: INK }}>stays you ✓</span>
          </div>
        </div>
      )}

      {/* FREE for developers + BIG July -> August */}
      {free > 0 && !inInsert && (
        <div style={{ position: "absolute", top: "49%", left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: W * 0.016, opacity: free }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: W * 0.014, background: "#fff", border: `2px solid ${VIOLET}`, borderRadius: 999, padding: `${W * 0.014}px ${W * 0.03}px`, boxShadow: `0 20px 46px -16px ${VIOLET}77` }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.044, color: ACCENT_DEEP }}>FREE</span>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: W * 0.03, color: INK }}>for developers</span>
          </div>
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.092, color: "#fff", letterSpacing: "-0.02em", textShadow: "0 4px 24px rgba(0,0,0,0.65)" }}>July <span style={{ color: VIOLET }}>→</span> August</div>
        </div>
      )}

      {/* 50% OFF creator plans */}
      {off > 0 && !inInsert && (
        <div style={{ position: "absolute", top: "54%", left: 0, right: 0, display: "flex", justifyContent: "center", opacity: off }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: W * 0.016, background: VIOLET, borderRadius: 999, padding: `${W * 0.02}px ${W * 0.04}px`, boxShadow: `0 24px 50px -16px ${VIOLET}99` }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.058, color: "#fff" }}>50% OFF</span>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: W * 0.032, color: VIOLET_SOFT }}>creator plans</span>
          </div>
        </div>
      )}

      <Captions words={cWords} hideFrom={insStart} hideTo={insEnd} />
    </AbsoluteFill>
  );
};

export default FishHero2;

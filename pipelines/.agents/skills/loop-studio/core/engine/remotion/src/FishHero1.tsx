/**
 * FishHero1 — restaged 9:16 Fish short, scene 1 (2026-07-16).
 * NEW DIRECTION (Susan): LUUK IS THE HERO, FULL-SCREEN. Animations/visualizations
 * overlay ON TOP of him; he only shrinks in a couple of beats. No "FIG" labels.
 * Model is named "S2.1 Pro" everywhere. Reuses fishshort_s1.json word timings +
 * the same source clip + demo insert. Violet Fish brand.
 */
import React from "react";
import {
  AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig,
  staticFile, Easing,
} from "remotion";
import S1 from "./fishshort_s1_hero.json";

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
const EASE = Easing.bezier(0.42, 0, 0.16, 1);

const VIOLET = "#9b90e8";
const VIOLET_SOFT = "#ECEAFA";
const ACCENT_DEEP = "#6E62C4";
const INK = "#17171A";
const GRAY = "#9AA0AC";
const SANS = "'Onest','Helvetica Neue',sans-serif";
const MONO = "'JetBrains Mono','SF Mono',Menlo,monospace";

if (typeof document !== "undefined" && !document.querySelector("link[data-fishhero-font]")) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.dataset.fishheroFont = "true";
  link.href = "https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700;800&display=swap";
  document.head.appendChild(link);
}

/* insert: narration pauses 5s at src 3.0 while the demo clip plays */
const INSERT_AT = 3.0, INSERT_LEN = 5.0, SRC_DUR = 34.10;
/* spoken cuts (clean audio muxed in post; hero footage skips these too, cross-dissolved):
   CUT1 = the whole "That is Fish's brand new [S2.1] model," sentence (the model name is carried
   ON SCREEN by the badge instead) · CUT2 = "all of July" in "developers [all of July]. Make" */
const CUT1A = 7.25, CUT1B = 10.24, CUT2A = 28.28, CUT2B = 29.05;
const CUT1 = CUT1B - CUT1A, CUT2 = CUT2B - CUT2A;
const CLAIM_A = 10.36, CLAIM_B = 13.06, CLAIM_LEN = 6.2;
const CLAIM_OLD_LEN = CLAIM_B - CLAIM_A;
const CLAIM_DELTA = CLAIM_LEN - CLAIM_OLD_LEN;
const T = (s: number) => {
  let t = s <= INSERT_AT ? s : s + INSERT_LEN;
  if (s > CUT1B) t -= CUT1;
  if (s >= CLAIM_B) t += CLAIM_DELTA;
  if (s > CUT2B) t -= CUT2;
  return t;
};
const CLAIM_OUT_A = CLAIM_A + INSERT_LEN - CUT1;
const CLAIM_OUT_B = CLAIM_OUT_A + CLAIM_LEN;
const inCut = (s: number) =>
  (s >= CUT1A && s < CUT1B) || (s >= CLAIM_A && s < CLAIM_B) || (s >= CUT2A && s < CUT2B);
const CF = 6; // hero cross-dissolve frames at each footage skip

const RANKED_WORDS: Word[] = [
  [0.00, 0.24, "Fish"], [0.24, 0.80, "Audio's"], [0.80, 1.08, "model"],
  [1.08, 1.44, "ranked"], [1.44, 1.78, "number"], [1.78, 2.04, "one"],
  [2.04, 2.52, "overall"], [2.52, 2.84, "in"], [2.84, 2.98, "our"],
  [2.98, 3.24, "blind"], [3.24, 3.60, "listening"], [3.60, 4.00, "test"],
  [4.00, 4.34, "against"], [4.34, 4.78, "every"], [4.78, 5.12, "major"],
  [5.12, 5.60, "TTS"], [5.60, 6.02, "competitor."],
];

type Word = [number, number, string];
const holdF = (frame: number, a: number, b: number, d = 10) =>
  Math.min(interpolate(frame, [a, a + d], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }),
           interpolate(frame, [b - d, b], [1, 0], clamp));
const inF = (frame: number, at: number, d = 8) =>
  frame < at ? 0 : interpolate(frame, [at, at + d], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

/* hero footage segment — muted (audio muxed in post); opacity cross-dissolve at each skip seam
   so the full-screen head morphs across the "S2.1"/"July" cuts instead of jump-cutting */
const HeroSeg: React.FC<{ startFrom: number; fadeIn: boolean; fadeOut: boolean; dur: number }> =
  ({ startFrom, fadeIn, fadeOut, dur }) => {
    const r = useCurrentFrame();
    let op = 1;
    if (fadeIn) op = Math.min(op, interpolate(r, [0, CF], [0, 1], clamp));
    if (fadeOut) op = Math.min(op, interpolate(r, [dur - CF, dur], [1, 0], clamp));
    return <OffthreadVideo muted src={staticFile("fishshort/s1.mp4")} startFrom={startFrom}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "contrast(1.04) saturate(1.05)", opacity: op }} />;
  };

/* karaoke captions — bottom, over scrim */
function chunk(words: Word[]): Word[][] {
  const g: Word[][] = []; let c: Word[] = [];
  for (const w of words) {
    if (c.length && w[0] - c[c.length - 1][1] > 0.55) { g.push(c); c = []; }
    c.push(w);
    const clause = /[.?!,]$/.test(w[2]); const dur = w[1] - c[0][0];
    if ((c.length >= 3 && (clause || dur > 1.5)) || c.length >= 5) { g.push(c); c = []; } }
  if (c.length) g.push(c); return g;
}
const Captions: React.FC<{ words: Word[]; hideFrom: number; hideTo: number; hide2From?: number; hide2To?: number }> = ({ words, hideFrom, hideTo, hide2From, hide2To }) => {
  const { width: W } = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const groups = React.useMemo(() => chunk(words), [words]);
  if ((frame >= hideFrom && frame < hideTo) ||
      (hide2From !== undefined && hide2To !== undefined && frame >= hide2From && frame < hide2To)) return null;
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

const CLAIM_CAPTION_GROUPS: Word[][] = [
  RANKED_WORDS.slice(0, 3),
  RANKED_WORDS.slice(3, 6),
  RANKED_WORDS.slice(6, 9),
  RANKED_WORDS.slice(9, 12),
  RANKED_WORDS.slice(12, 15),
  RANKED_WORDS.slice(15, 17),
];
const ClaimCaptions: React.FC<{ start: number; end: number }> = ({ start, end }) => {
  const frame = useCurrentFrame();
  const { width: W } = useVideoConfig();
  if (frame < start || frame >= end) return null;
  const t = (frame - start) / FPS;
  const group = CLAIM_CAPTION_GROUPS.find((g, i) => {
    const next = CLAIM_CAPTION_GROUPS[i + 1];
    return t >= g[0][0] - 0.08 && t < (next ? next[0][0] : g[g.length - 1][1] + 0.28);
  });
  if (!group) return null;
  const pop = interpolate(t, [group[0][0] - 0.08, group[0][0] + 0.04], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", left: "5%", right: "5%", bottom: "10.5%", display: "flex", justifyContent: "center", opacity: pop }}>
      <div style={{ textAlign: "center", lineHeight: 1.25, whiteSpace: "nowrap" }}>
        {group.map(([s, e, w], i) => {
          const cur = t >= s - 0.02 && (i === group.length - 1 ? t < e + 0.2 : t < group[i + 1][0]);
          return <span key={`${s}-${w}`} style={{
            fontFamily: SANS, fontWeight: 800, fontSize: W * 0.056, letterSpacing: "-0.015em",
            color: "#fff", background: cur ? VIOLET : "transparent",
            padding: `${W * 0.004}px ${W * 0.012}px`, borderRadius: W * 0.014,
            margin: `0 ${W * 0.002}px`, textShadow: cur ? "none" : "0 2px 10px rgba(0,0,0,0.9)",
          }}>{w}</span>;
        })}
      </div>
    </div>
  );
};

const EqBars: React.FC<{ n: number; h: number; color: string; bw: number }> = ({ n, h, color, bw }) => {
  const frame = useCurrentFrame();
  return <svg width={n * (bw + 6)} height={h}>{Array.from({ length: n }).map((_, i) => {
    const base = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + 1.3));
    const wob = 0.74 + 0.26 * Math.sin(frame / 7 + i * 1.9);
    const bh = Math.max(8, h * base * wob);
    return <rect key={i} x={i * (bw + 6)} y={(h - bh) / 2} width={bw} height={bh} rx={bw / 2} fill={color} />;
  })}</svg>;
};

const ResultProof: React.FC<{ start: number; end: number }> = ({ start, end }) => {
  const frame = useCurrentFrame();
  const local = frame - start;
  const enter = interpolate(local, [0, 10], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const leave = interpolate(frame, [end - 8, end], [1, 0], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const opacity = Math.min(enter, leave);
  const rank = inF(frame, start + f(1.42), 10);
  const field = inF(frame, start + f(4.0), 10);
  const breathe = 1 + Math.sin(local * 0.075) * 0.0025;
  return (
    <AbsoluteFill style={{ background: "#09090D", opacity, overflow: "hidden" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 78% 48% at 50% 46%, ${VIOLET}2E 0%, transparent 72%)` }} />
      <div style={{ position: "absolute", top: 82, left: 68, right: 68, textAlign: "center" }}>
        <div style={{ fontFamily: SANS, fontSize: 58, fontWeight: 850, color: "white", letterSpacing: "-0.035em" }}>
          A real blind test. <span style={{ color: VIOLET }}>A clear winner.</span>
        </div>
      </div>

      <div
        style={{
          position: "absolute", left: 24, right: 24, top: 330, height: 580,
          borderRadius: 34, background: "white", overflow: "hidden",
          border: `3px solid ${VIOLET}`,
          boxShadow: `0 44px 120px -28px ${VIOLET}88`,
          transform: `translateY(${(1 - enter) * 34}px) scale(${(0.965 + enter * 0.035) * breathe})`,
        }}
      >
        <Img
          src={staticFile("fishshort/results/overall_bt_scores.png")}
          style={{ width: "100%", height: "100%", objectFit: "contain", background: "white" }}
        />
        <div
          style={{
            position: "absolute", left: 20, right: 20, top: 44, height: 88,
            borderRadius: 22, border: `5px solid ${VIOLET}`,
            boxShadow: `0 0 0 999px rgba(10,10,14,${rank * 0.18}), 0 0 40px ${VIOLET}88`,
            opacity: rank,
          }}
        />
        <div
          style={{
            position: "absolute", right: 22, top: 12, width: 148, height: 148,
            borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
            background: VIOLET, color: "white", border: "8px solid white",
            fontFamily: SANS, fontSize: 70, fontWeight: 900,
            boxShadow: `0 20px 48px -14px ${VIOLET}`,
            opacity: rank, transform: `scale(${0.72 + rank * 0.28}) rotate(${(1 - rank) * -12}deg)`,
          }}
        >#1</div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 1035, display: "flex", justifyContent: "center" }}>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 22, padding: "20px 34px",
            borderRadius: 999, background: VIOLET_SOFT, color: INK,
            opacity: rank, transform: `translateY(${(1 - rank) * 18}px)`,
            boxShadow: `0 24px 70px -24px ${VIOLET}`,
          }}
        >
          <span style={{ fontFamily: SANS, fontSize: 47, fontWeight: 900 }}>RANKED #1 OVERALL</span>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: VIOLET }} />
          <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800, color: ACCENT_DEEP }}>BT 3.07</span>
        </div>
      </div>

      <div
        style={{
          position: "absolute", left: 0, right: 0, top: 1185, textAlign: "center",
          fontFamily: MONO, fontSize: 18, fontWeight: 700, letterSpacing: "0.11em",
          color: "rgba(255,255,255,.68)", opacity: field,
        }}
      >
        ELEVENLABS · INWORLD · MINIMAX · FISH AUDIO
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 56, textAlign: "center", fontFamily: MONO, fontSize: 14, color: "rgba(255,255,255,.48)", letterSpacing: "0.08em" }}>
        SOURCE · FISH AUDIO RESEARCH · APRIL 5, 2026
      </div>
    </AbsoluteFill>
  );
};

/* Typewriter — types emotion TAGS + EMOJIS char-by-char (the "you direct it" beat) */
const TYPE_SCRIPT: { text: string; color: string }[][] = [
  [{ text: "[excited] ", color: VIOLET }, { text: "this is unreal ", color: "#fff" }, { text: "🤯", color: "#fff" }],
  [{ text: "[whisper] ", color: VIOLET }, { text: "listen closely ", color: "#fff" }, { text: "🤫", color: "#fff" }],
  [{ text: "[laugh] ", color: VIOLET }, { text: "no way ", color: "#fff" }, { text: "😂", color: "#fff" }],
];
const TYPE_UNITS: { ch: string; color: string; line: number }[] = [];
TYPE_SCRIPT.forEach((line, li) => line.forEach((tok) => Array.from(tok.text).forEach((ch) => TYPE_UNITS.push({ ch, color: tok.color, line: li }))));
const Typewriter: React.FC<{ startFrame: number; fontSize: number }> = ({ startFrame, fontSize }) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const reveal = Math.min(TYPE_UNITS.length, Math.floor((elapsed / FPS) * 20)); // ~20 chars/sec
  const caretOn = Math.sin(frame / 6) > -0.2 ? 1 : 0.12;
  const shown = TYPE_UNITS.slice(0, reveal);
  const lastLine = shown.length ? shown[shown.length - 1].line : 0;
  const lines: JSX.Element[] = [];
  for (let li = 0; li <= Math.max(lastLine, 0); li++) {
    const u = shown.filter((x) => x.line === li);
    // group into colour runs
    const runs: { text: string; color: string }[] = [];
    u.forEach((x) => { const last = runs[runs.length - 1]; if (last && last.color === x.color) last.text += x.ch; else runs.push({ text: x.ch, color: x.color }); });
    lines.push(
      <div key={li} style={{ minHeight: fontSize * 1.5 }}>
        {runs.map((r, i) => <span key={i} style={{ color: r.color }}>{r.text}</span>)}
        {li === lastLine && reveal < TYPE_UNITS.length && <span style={{ color: VIOLET, opacity: caretOn }}>▊</span>}
      </div>
    );
  }
  return <div style={{ fontFamily: MONO, fontWeight: 700, fontSize, lineHeight: 1.55, textAlign: "left" }}>{lines}</div>;
};

export const FishHero1: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const words = S1 as Word[];
  const cWords = React.useMemo(() => words
    .filter(([s]) => !inCut(s))
    .map(([s, e, w]) => [T(s), T(e), w] as Word)
    .sort((a, b) => a[0] - b[0]), []);
  const insStart = f(INSERT_AT), insEnd = f(INSERT_AT + INSERT_LEN);
  const inInsert = frame >= insStart && frame < insEnd;
  const inClaim = frame >= f(CLAIM_OUT_A) && frame < f(CLAIM_OUT_B);
  const insP = Math.min(interpolate(frame, [insStart, insStart + 6], [0, 1], clamp),
                        interpolate(frame, [insEnd - 6, insEnd], [1, 0], clamp));

  // gentle push-in on the hero
  const heroZoom = interpolate(frame, [0, f(T(SRC_DUR))], [1.0, 1.06], clamp);
  const startFade = interpolate(frame, [0, 7], [0, 1], clamp);
  const endFade = Math.min(startFade, interpolate(frame, [f(T(SRC_DUR)) - 8, f(T(SRC_DUR))], [1, 0], clamp));

  // overlay windows (comp frames via T)
  const emo = holdF(frame, f(T(3.4)), f(T(6.9)));
  const p0 = inF(frame, f(T(3.57))), p1 = inF(frame, f(T(4.39))), p2 = inF(frame, f(T(5.59)));
  // "That is Fish's brand new model" is cut from audio — the S2.1 Pro badge now rides
  // the "and it just won a test for sounding human" beat (src 10.3+) instead.
  const control = holdF(frame, f(T(16.3)), f(T(25.2)));
  const caret = Math.sin(frame / 8) > 0 ? 1 : 0.2;
  const free = holdF(frame, f(T(26.9)), f(T(29.6)));

  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: SANS, opacity: endFade }}>
      {/* ===== HERO: Luuk full-screen (muted; audio muxed). Footage skips "S2.1" + "all of July"
             at the same source points as the audio, cross-dissolved so the head doesn't jump. ===== */}
      {!inInsert && (
        <AbsoluteFill style={{ transform: `scale(${heroZoom})`, transformOrigin: "50% 42%" }}>
          {/* pre-insert: src [0, 3.0] */}
          <Sequence from={0} durationInFrames={insStart} layout="none">
            <HeroSeg startFrom={0} fadeIn={false} fadeOut={false} dur={insStart} />
          </Sequence>
          {/* B1: src [3.0, 8.89] -> up to the S2.1 seam */}
          <Sequence from={insEnd} durationInFrames={f(T(CUT1A)) - insEnd + CF} layout="none">
            <HeroSeg startFrom={insStart} fadeIn={false} fadeOut dur={f(T(CUT1A)) - insEnd + CF} />
          </Sequence>
          {/* B2: tiny clean bridge from model-name cut to the replacement result beat */}
          <Sequence from={f(T(CUT1A))} durationInFrames={f(CLAIM_OUT_A) - f(T(CUT1A)) + CF} layout="none">
            <HeroSeg startFrom={f(CUT1B)} fadeIn fadeOut dur={f(CLAIM_OUT_A) - f(T(CUT1A)) + CF} />
          </Sequence>
          {/* C1: resume the original synced footage after the replacement sentence */}
          <Sequence from={f(CLAIM_OUT_B)} durationInFrames={f(T(CUT2A)) - f(CLAIM_OUT_B) + CF} layout="none">
            <HeroSeg startFrom={f(CLAIM_B)} fadeIn fadeOut dur={f(T(CUT2A)) - f(CLAIM_OUT_B) + CF} />
          </Sequence>
          {/* B3: src [29.05, SRC_DUR] -> after the July cut */}
          <Sequence from={f(T(CUT2A))} durationInFrames={f(T(SRC_DUR)) - f(T(CUT2A))} layout="none">
            <HeroSeg startFrom={f(CUT2B)} fadeIn fadeOut={false} dur={f(T(SRC_DUR)) - f(T(CUT2A))} />
          </Sequence>
        </AbsoluteFill>
      )}

      {frame >= f(CLAIM_OUT_A) && frame < f(CLAIM_OUT_B) && (
        <ResultProof start={f(CLAIM_OUT_A)} end={f(CLAIM_OUT_B)} />
      )}

      {/* ===== LISTEN INSERT (demo audio plays; Luuk shrinks to a card) ===== */}
      {inInsert && (
        <AbsoluteFill style={{ background: "#0B0B10", opacity: insP }}>
          {/* Fish-purple ambient glow so the beat isn't sparse */}
          <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 46% at 50% 40%, ${VIOLET}38 0%, ${VIOLET}12 40%, transparent 72%)` }} />
          <div style={{ position: "absolute", left: "50%", top: "9%", transform: "translateX(-50%)", textAlign: "center" }}>
            <span style={{ fontFamily: MONO, fontSize: W * 0.03, fontWeight: 700, color: "#fff", background: VIOLET, padding: `${W * 0.012}px ${W * 0.03}px`, borderRadius: 999 }}>▶ NOW PLAYING · S2.1 PRO</span>
          </div>
          <Sequence from={insStart + f(0.15)} durationInFrames={f(4.6)} layout="none">
            <div style={{ position: "absolute", left: "50%", top: "23%", transform: "translateX(-50%)", width: W * 0.72, borderRadius: W * 0.05, overflow: "hidden", border: `${W * 0.008}px solid ${VIOLET}`, boxShadow: `0 40px 90px -20px ${VIOLET}88` }}>
              <OffthreadVideo src={staticFile("fishshort/emotion_avatar.mp4")} style={{ width: "100%", display: "block", objectFit: "cover", aspectRatio: "16/9" }} />
            </div>
          </Sequence>
          <div style={{ position: "absolute", left: "50%", top: "64%", transform: "translateX(-50%)", textAlign: "center" }}>
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.058, color: "#fff", letterSpacing: "-0.01em" }}>same words. <span style={{ color: VIOLET }}>real emotion.</span></div>
          </div>
          <div style={{ position: "absolute", left: "50%", top: "74%", transform: "translateX(-50%)" }}>
            <EqBars n={34} h={W * 0.075} bw={Math.round(W * 0.007)} color={VIOLET} />
          </div>
        </AbsoluteFill>
      )}

      {/* ===== scrims for overlay legibility ===== */}
      {!inInsert && !inClaim && <AbsoluteFill style={{ pointerEvents: "none", background: "linear-gradient(180deg, rgba(8,8,12,0.62) 0%, rgba(8,8,12,0) 24%, rgba(8,8,12,0) 58%, rgba(8,8,12,0.72) 100%)" }} />}

      {/* persistent brand eyebrow (S2.1 Pro everywhere) */}
      {!inInsert && !inClaim && (
        <div style={{ position: "absolute", top: "4.5%", left: 0, right: 0, textAlign: "center", opacity: interpolate(frame, [4, 16], [0, 1], clamp) }}>
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: W * 0.028, letterSpacing: "0.18em", color: "#fff" }}>FISH AUDIO · <span style={{ color: "#CDBBff" }}>S2.1 PRO</span></span>
        </div>
      )}

      {/* ===== OVERLAYS on top of Luuk (no FIG labels) ===== */}
      {/* emotion pills — a clean row near top */}
      {emo > 0 && !inInsert && (
        <div style={{ position: "absolute", top: "48%", left: 0, right: 0, display: "flex", justifyContent: "center", gap: W * 0.02, opacity: emo }}>
          {[["[ laughs ]", p0], ["[ whispers ]", p1], ["[ cracks ]", p2]].map(([t, p]: any, i) => (
            <div key={i} style={{ background: VIOLET, color: "#fff", fontFamily: MONO, fontWeight: 700, fontSize: W * 0.032, padding: `${W * 0.012}px ${W * 0.022}px`, borderRadius: 999, opacity: p, transform: `translateY(${(1 - p) * 12}px)`, boxShadow: "0 16px 40px -14px rgba(124,92,252,.6)" }}>{t}</div>
          ))}
        </div>
      )}

      {/* control — CREATIVE: you TYPE the emotion (tags + emojis type out live) */}
      {control > 0 && !inInsert && (
        <div style={{ position: "absolute", top: "49%", left: "6%", right: "6%", display: "flex", flexDirection: "column", alignItems: "center", gap: W * 0.018, opacity: control }}>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: W * 0.026, letterSpacing: "0.14em", color: "#fff", background: VIOLET, padding: `${W * 0.01}px ${W * 0.026}px`, borderRadius: 999 }}>YOU TYPE THE EMOTION</div>
          <div style={{ width: "100%", background: "#0E0E13", border: `2px solid ${VIOLET}`, borderRadius: W * 0.032, padding: `${W * 0.026}px ${W * 0.03}px`, boxShadow: `0 26px 58px -18px ${VIOLET}88` }}>
            <div style={{ display: "flex", alignItems: "center", gap: W * 0.011, marginBottom: W * 0.018 }}>
              <span style={{ width: W * 0.016, height: W * 0.016, borderRadius: 999, background: "#ff5f57", display: "inline-block" }} />
              <span style={{ width: W * 0.016, height: W * 0.016, borderRadius: 999, background: "#febc2e", display: "inline-block" }} />
              <span style={{ width: W * 0.016, height: W * 0.016, borderRadius: 999, background: "#28c840", display: "inline-block" }} />
              <span style={{ fontFamily: MONO, fontSize: W * 0.019, fontWeight: 700, letterSpacing: "0.14em", color: GRAY, marginLeft: W * 0.008 }}>script.txt</span>
            </div>
            <Typewriter startFrame={f(T(16.7))} fontSize={W * 0.041} />
          </div>
        </div>
      )}

      {/* FREE for developers · July → August */}
      {free > 0 && !inInsert && (
        <div style={{ position: "absolute", top: "54%", left: 0, right: 0, display: "flex", justifyContent: "center", opacity: free }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: W * 0.016, background: "#fff", border: `2px solid ${VIOLET}`, borderRadius: 999, padding: `${W * 0.018}px ${W * 0.034}px`, boxShadow: "0 24px 50px -16px rgba(124,92,252,.5)" }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.05, color: VIOLET }}>FREE</span>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: W * 0.03, color: INK }}>for developers</span>
          </div>
        </div>
      )}

      {/* captions */}
      <Captions words={cWords} hideFrom={insStart} hideTo={insEnd} hide2From={f(CLAIM_OUT_A)} hide2To={f(CLAIM_OUT_B)} />
      <ClaimCaptions start={f(CLAIM_OUT_A)} end={f(CLAIM_OUT_B)} />
    </AbsoluteFill>
  );
};

export default FishHero1;

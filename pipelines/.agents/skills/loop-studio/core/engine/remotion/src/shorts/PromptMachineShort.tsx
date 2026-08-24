/**
 * PromptMachineShort — bespoke 9:16 short (2511f @30fps, 1080x1920).
 *
 * CONCEPT: his life inside a terminal session. One persistent terminal chrome
 * (hairline frame, traffic dots, session label) wraps the footage for the whole
 * runtime; a lime block cursor blinks on the input line from frame 0 to black.
 *
 * Beats (word-anchored to shorts/prompt-machine/words.json):
 *  1. HOOK       0–6.1s   frame draws on, `> the prompt machine` types riding his words
 *  2. TIMER      9.3–15.5 session timer races 0 → 10:00:00, lands on "straight" (13.8)
 *  3. NO TYPING  16.4→    keyboard glyph fades, waveform breathes in its place (stays)
 *  4. NIGHT RUN  18.1–24.3 dim + `⠋ running: overnight-job` → `✓ done` at 21.48
 *  5. CALLBACK   25.9–31.9 the typed title returns (same element, same spot)
 *  6. STREAK     34.4–41.8 21 cells fill one by one, last cell pulses on "day." (40.56)
 *  7. CHIPS      43.4–55.0 `> lunch` `> workout` `> shower` land as he lists them
 *  8. FIVE PANES 56.6–77.3 frame splits into 5 sessions; crowd-in on "headaches",
 *                          camera pulls back on "playing chess at a high level"
 *  9. CLOSER     77.7–end  completed 21/21 strip returns, `it works` types on, fade
 */
import React, { useEffect, useState } from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate,
  useCurrentFrame, staticFile, Easing, delayRender, continueRender,
} from "remotion";

const FPS = 30;
const f = (sec: number) => Math.round(sec * FPS);

const RAISIN = "#0F121A";
const LIME = "#CFFF05";
const SILVER = "#B5BFC2";
const SILVER_HI = "#E9ECED";
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const SERIF = "'Playfair Display', Georgia, serif";

/* ---------- fonts (renderer fetches Google fonts before first frame) ---------- */
const FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;500;700&family=Playfair+Display:ital,wght@1,600&display=block";
let fontsInjected = false;
const useFonts = () => {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    if (typeof document === "undefined") { continueRender(handle); return; }
    if (!fontsInjected) {
      fontsInjected = true;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_CSS;
      document.head.appendChild(link);
    }
    const done = () => continueRender(handle);
    Promise.race([
      (document as any).fonts?.ready ?? Promise.resolve(),
      new Promise((r) => setTimeout(r, 4000)),
    ]).then(done, done);
  }, [handle]);
};

/* ---------- word data (corrected: prompt/Claude/chess/anymore/works) ---------- */
type W = [number, number, string];
const WORDS: W[] = [
  [0,0.4,"So"],[0.4,0.72,"my"],[0.72,1.08,"family"],[1.08,1.4,"calls"],[1.4,1.62,"me"],[1.62,1.78,"the"],[1.78,2.08,"prompt"],[2.08,2.38,"machine"],[2.38,2.64,"and"],[2.64,2.78,"I'm"],[2.78,2.92,"not"],[2.92,3.18,"sure"],[3.18,3.36,"if"],[3.36,3.48,"that"],[3.48,3.76,"is"],[3.76,4.7,"a"],[4.7,4.82,"good"],[4.82,5.1,"thing"],[5.1,5.54,"or"],[5.54,5.68,"a"],[5.68,5.8,"bad"],[5.8,6.06,"thing."],
  [6.16,6.4,"Honestly,"],[6.46,7.36,"everything"],[7.36,7.72,"I"],[7.72,8.2,"do"],[8.2,8.6,"is"],[8.6,9,"just"],[9,9.28,"me"],[9.28,9.66,"talking"],[9.66,9.84,"to"],[9.84,9.98,"my"],[9.98,10.28,"laptop."],[10.46,10.52,"So"],[10.52,10.66,"I"],[10.66,10.82,"can"],[10.82,11,"be"],[11,11.54,"talking"],[11.54,11.74,"to"],[11.74,11.9,"my"],[11.9,12.18,"laptop"],[12.18,12.58,"for"],[13.12,13.46,"10"],[13.46,13.8,"hours"],[13.8,14.68,"straight"],[14.68,15.04,"or"],[15.04,15.66,"I"],[15.66,15.96,"almost"],[15.96,16.22,"don't"],[16.22,16.38,"even"],[16.38,16.92,"type"],[16.92,17.18,"out"],[17.18,17.34,"on"],[17.34,17.44,"my"],[17.44,17.68,"laptop"],[17.68,18.14,"anymore."],[18.14,18.7,"before"],[18.7,19,"bed."],[19.18,19.46,"I"],[19.46,19.64,"want"],[19.64,19.78,"to"],[19.78,19.94,"make"],[19.94,20.22,"sure"],[20.22,20.92,"something"],[20.92,21.18,"is"],[21.18,21.48,"running."],[21.96,22.22,"So"],[22.22,22.38,"that"],[22.38,22.5,"is"],[22.5,22.78,"weird."],[23.3,23.82,"I"],[23.82,24.04,"know"],[24.04,24.34,"but"],[24.34,24.88,"so"],[24.88,25.9,"that's"],[25.9,26.06,"why"],[26.06,26.22,"my"],[26.22,26.52,"family"],[26.52,26.7,"is"],[26.7,26.9,"calling"],[26.9,27.04,"me"],[27.04,27.16,"the"],[27.16,27.34,"prompt"],[27.34,27.6,"machine."],[28.2,28.5,"I'm"],[28.5,28.64,"not"],[28.64,28.84,"really"],[28.84,29.14,"proud"],[29.14,29.28,"of"],[29.28,29.44,"it,"],[29.46,29.72,"but"],[29.72,30.94,"I"],[30.94,31.28,"do"],[31.28,31.6,"enjoy"],[31.6,31.74,"the"],[31.74,31.94,"work."],
  [32.28,32.62,"So"],[32.62,33,"I"],[33,33.2,"have"],[33.2,33.34,"been"],[33.34,33.64,"using"],[33.64,33.98,"Claude"],[33.98,34.44,"Code"],[34.44,35.28,"21"],[35.28,35.9,"days"],[35.9,36.44,"in"],[36.44,36.54,"the"],[36.54,36.74,"last"],[36.74,37.14,"21"],[37.14,37.6,"days,"],[38,38.96,"which"],[38.96,39.18,"is"],[39.18,39.3,"a"],[39.3,39.5,"lot"],[39.5,39.68,"like"],[39.68,39.94,"I"],[39.94,40.22,"didn't"],[40.22,40.44,"miss"],[40.44,40.56,"a"],[40.56,40.72,"day."],
  [41.36,41.64,"So"],[41.64,41.9,"whether"],[41.9,42.28,"it's"],[42.28,42.52,"like"],[42.52,43.4,"after"],[43.4,43.96,"lunch,"],[44.36,44.86,"so"],[44.86,45.06,"whether"],[45.06,45.3,"it's"],[45.3,45.54,"like"],[45.54,46.14,"after"],[46.14,46.6,"working"],[46.6,47,"out"],[47,47.66,"and"],[47.66,47.96,"in"],[47.96,48.16,"between"],[48.16,48.74,"showering,"],[48.94,49.08,"I"],[49.08,49.2,"think"],[49.2,49.36,"like,"],[49.36,49.62,"okay,"],[49.7,50.26,"let's"],[50.26,50.64,"put"],[50.64,50.74,"in"],[50.74,50.92,"one"],[50.92,51.1,"more"],[51.1,51.46,"prompt"],[51.46,51.62,"and"],[51.62,51.72,"then"],[51.72,51.86,"I"],[51.86,52.04,"can"],[52.04,52.22,"go"],[52.22,52.56,"shower"],[52.56,52.78,"and"],[52.78,52.9,"then"],[52.9,53.04,"in"],[53.04,53.14,"the"],[53.14,53.44,"meantime,"],[53.76,54.12,"that"],[54.12,54.26,"is"],[54.26,54.48,"fixed."],
  [54.62,54.72,"And"],[54.72,55.2,"lately"],[55.2,55.68,"it"],[55.68,55.82,"has"],[55.82,56.06,"even"],[56.06,56.32,"been"],[56.32,56.6,"like"],[56.6,57.06,"five"],[57.06,57.6,"different"],[57.6,57.96,"Claude"],[57.96,58.22,"Code"],[58.22,58.54,"chats"],[58.54,59.42,"in"],[59.42,60.04,"one"],[60.04,60.36,"time,"],[60.6,60.66,"like"],[60.66,61.24,"all"],[61.24,61.4,"at"],[61.4,61.48,"the"],[61.48,61.7,"same"],[61.7,61.9,"time"],[61.9,62.24,"running."],[62.84,62.88,"So"],[62.88,63.02,"the"],[63.02,63.4,"productivity"],[63.4,63.88,"is"],[63.88,64.2,"pretty"],[64.2,64.6,"high."],[65.22,65.56,"But"],[65.56,65.72,"I"],[65.72,65.9,"also"],[65.9,66.08,"get"],[66.08,66.46,"headaches"],[66.46,66.84,"at"],[66.84,66.92,"the"],[66.92,67.02,"end"],[67.02,67.16,"of"],[67.16,67.16,"the"],[67.16,67.38,"day,"],[67.4,67.6,"because"],[67.6,68.04,"you're"],[68.04,69.1,"constantly"],[69.1,69.56,"looking"],[69.56,69.84,"at"],[69.84,69.96,"it"],[69.96,70.2,"from"],[70.2,70.38,"a"],[70.38,70.68,"higher"],[70.68,71.06,"perspective."],[71.8,72.06,"And"],[72.06,72.36,"you're"],[72.36,72.66,"actually"],[72.66,72.94,"just"],[72.94,73.62,"constantly"],[73.62,74.52,"playing"],[74.52,74.88,"chess"],[74.88,75.38,"at"],[75.38,75.58,"a"],[75.58,76,"high"],[76,76.36,"level."],
  [77.1,77.48,"So"],[77.48,77.62,"yeah,"],[77.72,78.06,"21"],[78.06,78.32,"out"],[78.32,78.42,"of"],[78.42,78.7,"21"],[78.7,78.98,"days."],[80.22,80.78,"I'm"],[80.78,80.92,"not"],[80.92,81.12,"sure"],[81.12,81.26,"if"],[81.26,81.36,"that"],[81.36,81.48,"is"],[81.48,81.54,"a"],[81.54,81.64,"good"],[81.64,81.86,"thing,"],[82.12,82.12,"but"],[82.12,82.74,"hey,"],[83.4,83.48,"it"],[83.48,83.66,"works."],
];

/* ---------- caption lines: ≤3 words, break at punctuation / gaps >0.5s ---------- */
type Line = { start: number; end: number; words: { t: string; s: number }[] };
const buildLines = (): Line[] => {
  const lines: Line[] = [];
  let cur: W[] = [];
  const push = () => {
    if (!cur.length) return;
    lines.push({
      start: cur[0][0], end: cur[cur.length - 1][1],
      words: cur.map((w) => ({ t: w[2].replace(/[.,!?]+$/, "").toUpperCase(), s: w[0] })),
    });
    cur = [];
  };
  for (const w of WORDS) {
    if (cur.length && w[0] - cur[cur.length - 1][1] > 0.5) push();
    cur.push(w);
    if (cur.length === 3 || /[.,!?]$/.test(w[2])) push();
  }
  push();
  // suppressed: beat-1 typed title is the caption (<6.06), beat-5 callback retype
  // (26.0–27.7, the title embodies those words), beat-9 stamp moment (>=82.0)
  return lines.filter((l) => l.start >= 6.06 && l.start < 82.0 && !(l.start >= 26.0 && l.start < 27.7));
};
const LINES = buildLines();

/* ---------- layout: the terminal chrome ---------- */
const PAD = 26;                       // chrome inset from comp edge
const CH_X = PAD, CH_Y = PAD, CH_W = 1080 - PAD * 2, CH_H = 1920 - PAD * 2;
const TOPBAR = 78, BOTBAR = 88;
const INN = { x: CH_X + 2, y: CH_Y + TOPBAR, w: CH_W - 4, h: CH_H - TOPBAR - BOTBAR }; // footage interior
type Rect = { x: number; y: number; w: number; h: number };
const FULL: Rect = { x: INN.x, y: INN.y, w: INN.w, h: INN.h };
const CENTER: Rect = { x: 42, y: 382, w: 996, h: 760 };
const MINIS: (Rect & { label: string; task: string; at: number })[] = [
  { x: 42, y: 118, w: 491, h: 250, label: "claude · s2", task: "fix refund flow", at: f(57.0) },
  { x: 547, y: 118, w: 491, h: 250, label: "claude · s3", task: "draft support replies", at: f(57.25) },
  { x: 42, y: 1450, w: 491, h: 250, label: "claude · s4", task: "render shorts", at: f(57.5) },
  { x: 547, y: 1450, w: 491, h: 250, label: "claude · s5", task: "sync knowledge base", at: f(57.75) },
];

/* ---------- beat time anchors (words.json) ---------- */
const T = {
  titleTypeStart: 1.0, titleTypeEnd: 2.38,          // "the prompt machine" 1.62–2.38
  titleOut: 5.9,                                     // "...bad thing." ends 6.06
  timerIn: 9.28, countStart: 10.52, countEnd: 13.8,  // lands on "straight"
  timerOut: 15.5,
  voiceSwap: 16.38,                                  // "type"
  nightIn: 18.14, spinIn: 19.78, done: 21.48, nightOut: 24.3,
  cbTypeStart: 25.9, cbTypeEnd: 27.6, cbOut: 31.4,   // callback rides "why...machine."
  stripIn: 34.44, cellStep: 0.288, lastPulse: 40.56, stripOut: 41.4,
  chips: [43.4, 46.14, 48.16], chipsOut: 54.5,       // lunch / working out / showering
  splitIn: 56.6, crowd: 66.08, pull: 73.62, splitOut: 76.5,
  strip2In: 77.72, strip2Pulse: 78.7,                // "21 ... days."
  stampStart: 82.74, stampEnd: 83.3,                 // types on "hey," → lands as "it works"
};

/* ---------- camera: one continuous move per intention + micro-drift ---------- */
const CAM: [number, number][] = [
  [0, 1.09],           // hook: slow settle in
  [f(2.4), 1.045],
  [f(6.2), 1.03],
  [f(13.8), 1.055],    // push through "10 hours straight"
  [f(18.14), 1.035],   // release into the night beat
  [f(24.4), 1.03],
  [f(27.6), 1.06],     // callback push
  [f(32.3), 1.035],
  [f(40.7), 1.055],    // streak completes
  [f(43.0), 1.04],
  [f(54.5), 1.065],    // chips: long slow push
  [f(56.6), 1.0],      // split: relax inside pane
  [f(77.0), 1.0],
  [f(77.7), 1.02],
  [2511, 1.075],       // closer: slight slow zoom to black
];
const camScale = (frame: number) => {
  if (frame <= CAM[0][0]) return CAM[0][1];
  for (let i = 0; i < CAM.length - 1; i++) {
    const [fa, sa] = CAM[i], [fb, sb] = CAM[i + 1];
    if (frame >= fa && frame <= fb) {
      const t = Easing.bezier(0.45, 0, 0.18, 1)((frame - fa) / Math.max(1, fb - fa));
      return sa + (sb - sa) * t;
    }
  }
  return CAM[CAM.length - 1][1];
};

const easeIO = Easing.bezier(0.45, 0, 0.18, 1);
const prog = (frame: number, a: number, b: number, e = easeIO) =>
  interpolate(frame, [a, b], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

const Sfx: React.FC<{ src: string; at: number; volume?: number; rate?: number }> = ({ src, at, volume = 0.3, rate = 1 }) => (
  <Sequence from={at} durationInFrames={f(1.5)}>
    <Audio src={staticFile(`vedit/sfx/${src}`)} volume={volume} playbackRate={rate} />
  </Sequence>
);

const SPIN = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
const spinChar = (frame: number) => SPIN[Math.floor(frame / 3) % SPIN.length];
const blink = (frame: number) => (frame % 32 < 18 ? 1 : 0);

/* ================================ ROOT ================================ */
export const PromptMachineShort: React.FC = () => {
  useFonts();
  const frame = useCurrentFrame();

  // chrome draw-on (frames 0–26)
  const drawP = prog(frame, 2, 26);
  const barsP = prog(frame, 18, 32);

  // footage rect: full → center pane → back
  const sIn = prog(frame, f(T.splitIn), f(T.splitIn) + 24);
  const sOut = prog(frame, f(T.splitOut), f(T.splitOut) + 24);
  const S = sIn * (1 - sOut);
  const R: Rect = {
    x: FULL.x + (CENTER.x - FULL.x) * S,
    y: FULL.y + (CENTER.y - FULL.y) * S,
    w: FULL.w + (CENTER.w - FULL.w) * S,
    h: FULL.h + (CENTER.h - FULL.h) * S,
  };

  // beat 8 group transforms: crowd-in (4%) then one pull-back
  const crowdP = prog(frame, f(T.crowd), f(T.crowd) + 20);
  const pullP = prog(frame, f(T.pull), f(T.pull) + 50);
  const groupScale = 1 - 0.1 * pullP * (1 - sOut);
  const gridCy = 940;

  // camera on the footage itself (micro-drift never rests)
  const cs = camScale(frame) + 0.003 * Math.sin(frame / 120);
  const cdx = Math.sin(frame / 95) * 4;
  const cdy = Math.cos(frame / 71) * 3;

  // night dim (beat 4)
  const night =
    prog(frame, f(T.nightIn), f(T.nightIn) + 22) * 0.34 -
    prog(frame, f(T.nightOut) - 20, f(T.nightOut)) * 0.34;

  // footage entrance
  const fadeIn = prog(frame, 0, 14, Easing.out(Easing.cubic));
  // final fade to black (last 12 frames)
  const fadeOut = prog(frame, 2499, 2511, Easing.in(Easing.quad));

  const crowdShift = (r: Rect) => {
    const cy = r.y + r.h / 2;
    return (gridCy - cy) * 0.04 * crowdP;
  };

  return (
    <AbsoluteFill style={{ background: RAISIN, fontFamily: SANS }}>
      {/* -------- beat-8 group: footage pane + mini sessions -------- */}
      <AbsoluteFill style={{ transform: `scale(${groupScale})`, transformOrigin: `540px ${gridCy}px` }}>
        {/* footage inside the chrome (the session's viewport) */}
        <div style={{
          position: "absolute", left: R.x, top: R.y, width: R.w, height: R.h,
          borderRadius: 8 + 14 * S, overflow: "hidden", opacity: fadeIn,
          boxShadow: S > 0.01 ? `0 0 0 1px rgba(181,191,194,${0.28 * S}), 0 18px 60px rgba(0,0,0,${0.4 * S})` : "none",
        }}>
          <div style={{
            width: "100%", height: "100%",
            transform: `translate(${cdx}px, ${cdy}px) scale(${cs})`, transformOrigin: "53% 32%",
            filter: "contrast(1.06) saturate(1.08)",
          }}>
            <OffthreadVideo
              src={staticFile("shorts/prompt-machine/source.mp4")}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "53% 50%" }}
            />
          </div>
          {/* night dim lives on the footage only */}
          <div style={{ position: "absolute", inset: 0, background: "#070a12", opacity: Math.max(0, night), pointerEvents: "none" }} />
          {/* pane header once split */}
          {S > 0.05 && (
            <div style={{
              position: "absolute", left: 0, right: 0, top: 0, height: 46, opacity: S,
              background: "rgba(15,18,26,0.82)", display: "flex", alignItems: "center", gap: 10, paddingLeft: 18,
              fontFamily: MONO, fontSize: 19, color: SILVER, letterSpacing: "0.08em",
            }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: LIME, opacity: 0.8 }} />
              claude · s1 — luuk
            </div>
          )}
        </div>

        {/* four mini session panes */}
        {MINIS.map((m, i) => {
          const inP = prog(frame, m.at, m.at + 14, Easing.out(Easing.cubic)) * (1 - prog(frame, f(T.splitOut) - 6, f(T.splitOut) + 10));
          if (inP <= 0) return null;
          const dy = crowdShift(m);
          return (
            <div key={i} style={{
              position: "absolute", left: m.x, top: m.y + dy + (1 - inP) * 14, width: m.w, height: m.h,
              borderRadius: 16, background: "rgba(15,18,26,0.92)", opacity: inP,
              boxShadow: "0 0 0 1px rgba(181,191,194,0.22), 0 14px 44px rgba(0,0,0,0.35)",
              overflow: "hidden", fontFamily: MONO,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, height: 44, paddingLeft: 18, fontSize: 18, color: SILVER, letterSpacing: "0.08em", borderBottom: "1px solid rgba(181,191,194,0.12)" }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: SILVER, opacity: 0.55 }} />
                {m.label}
              </div>
              <div style={{ padding: "26px 22px 0", fontSize: 22, color: SILVER_HI }}>
                <span style={{ color: LIME, opacity: 0.9 }}>{SPIN[Math.floor((frame + i * 3) / 3) % SPIN.length]}</span>
                {"  "}{m.task}
              </div>
              <div style={{ padding: "14px 22px 0", fontSize: 16, color: SILVER, opacity: 0.42 }}>esc to interrupt</div>
            </div>
          );
        })}
      </AbsoluteFill>

      {/* -------- persistent terminal chrome -------- */}
      <TerminalChrome frame={frame} drawP={drawP} barsP={barsP} />

      {/* beat 2: session timer in the chrome */}
      <SessionTimer frame={frame} />

      {/* beat 4: overnight spinner line */}
      <NightRun frame={frame} />

      {/* beats 1+5: the typed title (same element = persistence) */}
      <Sequence from={0} durationInFrames={f(6.4)}>
        <TypedTitle typeStart={f(T.titleTypeStart)} typeEnd={f(T.titleTypeEnd)} fadeOutAt={f(T.titleOut)} showSerif />
      </Sequence>
      <Sequence from={f(25.7)} durationInFrames={f(32.0) - f(25.7)}>
        <TypedTitle typeStart={f(T.cbTypeStart) - f(25.7)} typeEnd={f(T.cbTypeEnd) - f(25.7)} fadeOutAt={f(T.cbOut) - f(25.7)} />
      </Sequence>

      {/* beat 6: the 21/21 streak strip (the receipt) */}
      <Sequence from={f(T.stripIn) - 6} durationInFrames={f(T.stripOut) + 20 - (f(T.stripIn) - 6)}>
        <Streak mode="fill" start={6} />
      </Sequence>
      {/* beat 9: strip returns completed */}
      <Sequence from={f(T.strip2In) - 4} durationInFrames={2511 - (f(T.strip2In) - 4)}>
        <Streak mode="done" start={4} pulseAt={f(T.strip2Pulse) - (f(T.strip2In) - 4)} />
      </Sequence>

      {/* beat 7: the life chips */}
      <Chips frame={frame} />

      {/* beat 9: `it works` stamp */}
      <Stamp frame={frame} />

      {/* karaoke captions (suppressed during hook title + stamp) */}
      <Captions frame={frame} />

      {/* soft vignette */}
      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 80% 62% at 50% 40%, transparent 58%, rgba(5,7,12,0.34) 100%)" }} />

      {/* final fade to black — the cursor blinks into it */}
      <AbsoluteFill style={{ background: "#000", opacity: fadeOut, pointerEvents: "none" }} />

      {/* -------- SFX: cues fire when things LAND -------- */}
      <Sfx src="slide.wav" at={4} volume={0.26} />
      <Sfx src="tap.wav" at={f(2.38)} volume={0.3} />
      <Sfx src="tick_soft.wav" at={f(T.countEnd)} volume={0.34} />
      <Sfx src="soft.wav" at={f(T.done)} volume={0.3} />
      {/* streak fills: one tick family, every 3rd cell + the landing */}
      {[0, 3, 6, 9, 12, 15, 18].map((i) => (
        <Sfx key={`c${i}`} src="tick_soft.wav" at={f(T.stripIn + i * T.cellStep)} volume={0.24} />
      ))}
      <Sfx src="tick.wav" at={f(T.lastPulse)} volume={0.32} />
      {T.chips.map((t, i) => (
        <Sfx key={`ch${i}`} src="tap.wav" at={f(t)} volume={0.26} />
      ))}
      <Sfx src="slide.wav" at={f(T.splitIn)} volume={0.3} />
      <Sfx src="soft.wav" at={f(T.pull)} volume={0.24} />
      <Sfx src="tick.wav" at={f(T.strip2In)} volume={0.3} />
      <Sfx src="tap.wav" at={f(T.stampEnd)} volume={0.28} />
    </AbsoluteFill>
  );
};

/* ================== the persistent chrome ================== */
const TerminalChrome: React.FC<{ frame: number; drawP: number; barsP: number }> = ({ frame, drawP, barsP }) => {
  const perim = 2 * (CH_W + CH_H);
  const swap = prog(frame, f(T.voiceSwap), f(T.voiceSwap) + 18);
  const dots = ["rgba(201,123,123,0.75)", "rgba(201,188,123,0.75)", "rgba(134,181,123,0.75)"];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* top + bottom bar plates (mask footage overflow behind bars) */}
      <div style={{ position: "absolute", left: CH_X, top: CH_Y, width: CH_W, height: TOPBAR, background: RAISIN, borderRadius: "26px 26px 0 0" }} />
      <div style={{ position: "absolute", left: CH_X, top: CH_Y + CH_H - BOTBAR, width: CH_W, height: BOTBAR, background: RAISIN, borderRadius: "0 0 26px 26px" }} />
      {/* hairline frame draws on */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <rect
          x={CH_X} y={CH_Y} width={CH_W} height={CH_H} rx={26}
          fill="none" stroke="rgba(181,191,194,0.42)" strokeWidth={2}
          strokeDasharray={perim} strokeDashoffset={perim * (1 - drawP)}
        />
        <line x1={CH_X + 14} y1={CH_Y + TOPBAR} x2={CH_X + CH_W - 14} y2={CH_Y + TOPBAR} stroke="rgba(181,191,194,0.16)" strokeWidth={1.5} opacity={barsP} />
        <line x1={CH_X + 14} y1={CH_Y + CH_H - BOTBAR} x2={CH_X + CH_W - 14} y2={CH_Y + CH_H - BOTBAR} stroke="rgba(181,191,194,0.16)" strokeWidth={1.5} opacity={barsP} />
      </svg>
      {/* traffic dots + session label */}
      <div style={{ position: "absolute", left: CH_X + 30, top: CH_Y + TOPBAR / 2 - 6, display: "flex", gap: 12, opacity: barsP }}>
        {dots.map((c, i) => <span key={i} style={{ width: 13, height: 13, borderRadius: 7, background: c }} />)}
      </div>
      <div style={{
        position: "absolute", left: 0, right: 0, top: CH_Y + TOPBAR / 2 - 13, textAlign: "center",
        fontFamily: MONO, fontSize: 21, letterSpacing: "0.22em", color: SILVER, opacity: 0.75 * barsP,
      }}>
        luuk@mbp — claude
      </div>

      {/* bottom input line: glyph + prompt + THE cursor (persists to black) */}
      <div style={{ position: "absolute", left: CH_X + 34, top: CH_Y + CH_H - BOTBAR, height: BOTBAR, display: "flex", alignItems: "center", gap: 18, opacity: barsP }}>
        {/* keyboard glyph — fades when he stops typing */}
        <svg width={46} height={30} viewBox="0 0 46 30" style={{ opacity: 0.75 - 0.63 * swap }}>
          <rect x={1} y={1} width={44} height={28} rx={6} fill="none" stroke={SILVER} strokeWidth={2} />
          {[7, 15, 23, 31].map((x) => <rect key={x} x={x} y={8} width={5} height={4} rx={1} fill={SILVER} />)}
          <rect x={39} y={8} width={2} height={4} rx={1} fill={SILVER} />
          <rect x={11} y={18} width={24} height={4} rx={2} fill={SILVER} />
        </svg>
        {/* waveform glyph — breathes in its place */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, height: 30, marginLeft: -8, opacity: swap }}>
          {[0, 1, 2, 3, 4].map((i) => {
            const h = 8 + 12 * Math.abs(Math.sin(frame / 6 + i * 1.1));
            return <span key={i} style={{ width: 4, height: h, borderRadius: 2, background: LIME, opacity: 0.55 + 0.35 * Math.abs(Math.sin(frame / 9 + i)) }} />;
          })}
        </div>
        <span style={{ fontFamily: MONO, fontSize: 26, color: SILVER, opacity: 0.7 - 0.25 * swap }}>&gt;</span>
        <span style={{ width: 15, height: 32, background: LIME, opacity: blink(frame), borderRadius: 2, boxShadow: `0 0 14px rgba(207,255,5,0.35)` }} />
      </div>
    </AbsoluteFill>
  );
};

/* ================== beat 2: session timer ================== */
const pad2 = (n: number) => String(n).padStart(2, "0");
const SessionTimer: React.FC<{ frame: number }> = ({ frame }) => {
  const inP = prog(frame, f(T.timerIn), f(T.timerIn) + 10) - prog(frame, f(T.timerOut), f(T.timerOut) + 10);
  if (inP <= 0) return null;
  const p = prog(frame, f(T.countStart), f(T.countEnd), Easing.out(Easing.cubic));
  const secs = Math.round(p * 36000); // 10:00:00
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  const landed = frame >= f(T.countEnd);
  const settle = prog(frame, f(T.countEnd), f(T.countEnd) + 10, Easing.out(Easing.cubic));
  return (
    <div style={{
      position: "absolute", right: CH_X + 30, top: CH_Y + TOPBAR / 2 - 14, fontFamily: MONO,
      fontSize: 24, letterSpacing: "0.08em", opacity: inP,
      color: landed ? LIME : SILVER_HI,
      transform: `scale(${1 + 0.08 * settle * (1 - settle) * 4})`, transformOrigin: "right center",
      textShadow: landed ? "0 0 16px rgba(207,255,5,0.3)" : "none",
    }}>
      {pad2(h)}:{pad2(m)}:{pad2(s)}
    </div>
  );
};

/* ================== beat 4: overnight run ================== */
const NightRun: React.FC<{ frame: number }> = ({ frame }) => {
  const inP = prog(frame, f(T.spinIn), f(T.spinIn) + 10) - prog(frame, f(23.7), f(24.2));
  if (inP <= 0) return null;
  const done = frame >= f(T.done);
  const doneP = prog(frame, f(T.done), f(T.done) + 8, Easing.out(Easing.cubic));
  return (
    <div style={{
      position: "absolute", left: INN.x + 40, top: INN.y + INN.h - 78, fontFamily: MONO,
      fontSize: 26, color: SILVER_HI, opacity: inP, display: "flex", gap: 16, alignItems: "center",
      transform: `translateY(${(1 - inP) * 8}px)`, textShadow: "0 2px 14px rgba(0,0,0,0.7)",
    }}>
      {done ? (
        <span style={{ color: LIME, transform: `scale(${1 + 0.25 * doneP * (1 - doneP) * 4})`, display: "inline-block" }}>✓</span>
      ) : (
        <span style={{ color: LIME, opacity: 0.9 }}>{spinChar(frame)}</span>
      )}
      <span style={{ opacity: done ? 1 : 0.85 }}>{done ? "done — see you tomorrow" : "running: overnight-job"}</span>
    </div>
  );
};

/* ================== beats 1+5: the typed title ================== */
const TITLE = "the prompt machine";
const TypedTitle: React.FC<{ typeStart: number; typeEnd: number; fadeOutAt: number; showSerif?: boolean }> = ({ typeStart, typeEnd, fadeOutAt, showSerif }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, typeStart, typeEnd, Easing.linear);
  const n = Math.floor(p * TITLE.length);
  const out = prog(frame, fadeOutAt, fadeOutAt + 12);
  const serifP = showSerif ? prog(frame, f(2.92), f(3.5)) : 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 1 - out }}>
      <div style={{
        position: "absolute", left: 0, right: 0, top: 1920 * 0.575, display: "flex", justifyContent: "center",
        transform: `translateY(${out * -10}px)`,
      }}>
        <div style={{ fontFamily: MONO, fontSize: 56, fontWeight: 500, color: "#fff", letterSpacing: "0.01em", textShadow: "0 4px 30px rgba(0,0,0,0.8)", display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: SILVER, opacity: 0.7 }}>&gt;</span>
          <span style={{ whiteSpace: "pre" }}>{TITLE.slice(0, n)}</span>
          <span style={{ width: 22, height: 52, background: LIME, opacity: blink(frame), borderRadius: 2, boxShadow: "0 0 18px rgba(207,255,5,0.4)", marginLeft: -6 }} />
        </div>
      </div>
      {showSerif && serifP > 0 && (
        <div style={{
          position: "absolute", left: 0, right: 0, top: 1920 * 0.575 + 92, textAlign: "center",
          fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, fontSize: 34, color: SILVER,
          opacity: serifP * 0.9, transform: `translateY(${(1 - serifP) * 8}px)`, textShadow: "0 2px 18px rgba(0,0,0,0.7)",
        }}>
          a good thing? or a bad thing?
        </div>
      )}
    </AbsoluteFill>
  );
};

/* ================== beats 6+9: the 21/21 streak strip ================== */
const CELLS = 21;
const Streak: React.FC<{ mode: "fill" | "done"; start: number; pulseAt?: number }> = ({ mode, start, pulseAt }) => {
  const frame = useCurrentFrame();
  const inP = prog(frame, start, start + 10, Easing.out(Easing.cubic));
  const out = mode === "fill" ? prog(frame, f(T.stripOut) - (f(T.stripIn) - 6), f(T.stripOut) - (f(T.stripIn) - 6) + 12) : 0;
  const cw = 38, gap = 8;
  const total = CELLS * cw + (CELLS - 1) * gap;
  const x0 = (1080 - total) / 2;
  const y = 1104; // shared overlay lane: below his chin, above the captions
  const fillAt = (i: number) => (mode === "done" ? start : f(T.stripIn + i * T.cellStep) - (f(T.stripIn) - 6));
  const filled = [...Array(CELLS)].filter((_, i) => frame >= fillAt(i)).length;
  const lastPulseAt = mode === "fill" ? f(T.lastPulse) - (f(T.stripIn) - 6) : (pulseAt ?? 9999);
  const pulse = prog(frame, lastPulseAt, lastPulseAt + 12, Easing.out(Easing.cubic));
  const pulseS = 1 + 0.28 * pulse * (1 - pulse) * 4;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: inP * (1 - out) }}>
      <div style={{ position: "absolute", left: x0, top: y - 52, display: "flex", width: total, justifyContent: "space-between", fontFamily: MONO, fontSize: 20, letterSpacing: "0.16em", transform: `translateY(${(1 - inP) * 10}px)` }}>
        <span style={{ color: SILVER, background: "rgba(15,18,26,0.72)", padding: "4px 12px", borderRadius: 6 }}>claude code — daily streak</span>
        <span style={{ color: filled >= CELLS ? LIME : SILVER_HI, background: "rgba(15,18,26,0.72)", padding: "4px 12px", borderRadius: 6 }}>{filled}/21</span>
      </div>
      <div style={{ position: "absolute", left: x0, top: y, display: "flex", gap, transform: `translateY(${(1 - inP) * 10}px)` }}>
        {[...Array(CELLS)].map((_, i) => {
          const on = frame >= fillAt(i);
          const cp = prog(frame, fillAt(i), fillAt(i) + 7, Easing.out(Easing.cubic));
          const isLast = i === CELLS - 1;
          const sc = (on ? 1 + 0.18 * cp * (1 - cp) * 4 : 1) * (isLast ? pulseS : 1);
          return (
            <span key={i} style={{
              width: cw, height: cw, borderRadius: 8,
              background: on ? `rgba(207,255,5,${isLast && pulse > 0 && pulse < 1 ? 0.95 : 0.62})` : "rgba(15,18,26,0.55)",
              boxShadow: on
                ? `0 0 0 1px rgba(207,255,5,0.4)${isLast && pulse > 0 && pulse < 1 ? ", 0 0 22px rgba(207,255,5,0.5)" : ""}`
                : "0 0 0 1px rgba(181,191,194,0.28)",
              transform: `scale(${sc})`, display: "inline-block",
            }} />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ================== beat 7: life chips ================== */
const CHIP_TXT = ["lunch", "workout", "shower"];
const Chips: React.FC<{ frame: number }> = ({ frame }) => {
  const out = prog(frame, f(T.chipsOut), f(T.chipsOut) + 14);
  if (frame < f(T.chips[0]) - 4 || out >= 1) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 1 - out }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1104, display: "flex", justifyContent: "center", gap: 22 }}>
        {CHIP_TXT.map((t, i) => {
          const at = f(T.chips[i]);
          const p = prog(frame, at, at + 9, Easing.out(Easing.cubic));
          if (p <= 0) return <span key={t} />;
          return (
            <div key={t} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "16px 24px",
              borderRadius: 12, background: "rgba(15,18,26,0.78)",
              boxShadow: "0 0 0 1px rgba(181,191,194,0.3), 0 10px 32px rgba(0,0,0,0.4)",
              opacity: p, transform: `translateY(${(1 - p) * 10}px)`,
              fontFamily: MONO, fontSize: 27, color: SILVER_HI,
            }}>
              <span style={{ color: SILVER, opacity: 0.65 }}>&gt;</span>
              {t}
              <span style={{ width: 11, height: 26, background: LIME, opacity: blink(frame + i * 7) * 0.9, borderRadius: 2 }} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ================== beat 9: `it works` stamp ================== */
const STAMP = "it works";
const Stamp: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < f(T.stampStart) - 2) return null;
  const p = prog(frame, f(T.stampStart), f(T.stampEnd), Easing.linear);
  const n = Math.floor(p * STAMP.length);
  const shown = STAMP.slice(0, n);
  const parts = shown.split(" ");
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, top: 1920 * 0.66, display: "flex", justifyContent: "center",
      pointerEvents: "none",
    }}>
      <div style={{ fontFamily: MONO, fontSize: 66, fontWeight: 500, color: "#fff", textShadow: "0 4px 34px rgba(0,0,0,0.85)", display: "flex", alignItems: "center", gap: 18 }}>
        <span style={{ color: SILVER, opacity: 0.7 }}>&gt;</span>
        <span style={{ whiteSpace: "pre" }}>
          {parts.map((w, i) => (
            <span key={i} style={{ color: i === 1 ? LIME : "#fff" }}>{i > 0 ? " " : ""}{w}</span>
          ))}
        </span>
        <span style={{ width: 26, height: 60, background: LIME, opacity: blink(frame), borderRadius: 2, boxShadow: "0 0 20px rgba(207,255,5,0.45)", marginLeft: -8 }} />
      </div>
    </div>
  );
};

/* ================== karaoke captions ================== */
const Captions: React.FC<{ frame: number }> = ({ frame }) => {
  const t = frame / FPS;
  let idx = -1;
  for (let i = 0; i < LINES.length; i++) {
    const showUntil = Math.min(i + 1 < LINES.length ? LINES[i + 1].start : LINES[i].end + 0.6, LINES[i].end + 0.9);
    if (t >= LINES[i].start && t < showUntil) { idx = i; break; }
  }
  if (idx < 0) return null;
  const line = LINES[idx];
  const inP = prog(frame, f(line.start), f(line.start) + 4, Easing.out(Easing.cubic));
  return (
    <div style={{
      position: "absolute", left: 60, right: 60, top: 1920 * 0.68, display: "flex", justifyContent: "center",
      pointerEvents: "none", opacity: inP, transform: `translateY(${(1 - inP) * 6}px)`,
    }}>
      <div style={{
        fontFamily: SANS, fontWeight: 800, fontSize: 58, letterSpacing: "0.005em", lineHeight: 1.12,
        textAlign: "center", textTransform: "uppercase", maxWidth: 920,
        textShadow: "0 3px 8px rgba(0,0,0,0.75), 0 8px 40px rgba(0,0,0,0.85)",
      }}>
        {line.words.map((w, i) => {
          const isCur = t >= w.s && (i + 1 >= line.words.length || t < line.words[i + 1].s);
          return (
            <span key={i} style={{ color: isCur ? LIME : "#fff" }}>
              {i > 0 ? " " : ""}{w.t}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default PromptMachineShort;

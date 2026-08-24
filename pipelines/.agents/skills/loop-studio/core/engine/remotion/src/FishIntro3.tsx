/**
 * FishIntro3 v2 — "the session" (2026-07-02, full rethink per Luuk).
 * The ENTIRE intro lives inside one podcast-production session window:
 *  · cold open: the AI podcast plays IN the session — playhead, live waveform blocks
 *    per speaker turn, word-synced dialogue transcript
 *  · the hook docks Luuk's live video INTO the session as the Voice A avatar
 *  · "0 seconds recorded" stamps over the lanes
 *  · the last-video source tile explodes into waveform blocks
 *  · Claude → Script → Fish S2.1 light up as rack inserts
 *  · one prompt types itself → the whole timeline cascades into existence
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
const VIOLET = "#7C5CFC";
const VIOLET_SOFT = "#EFEAFE";
const INK = "#17171A";
const LINE = "#E9E6E2";
const SANS = "'DM Sans', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

/* fonts */
const fontHandle = delayRender("fish3-fonts");
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
const OPEN_LEN = 8.5;                            // cold open, then A-roll
const T = (srcSec: number) => srcSec + OPEN_LEN;
const SRC_DUR = 29.61;                           // comp total 37.66 → 1130 frames
const POD = { start: 3.0, dur: 8.15, at: 0.35 }; // podcast.wav 3.0–11.15; fade lands after "confidently." (10.58)
const TURNS: [number, number, "A" | "B"][] = [
  [0.52, 4.75, "A"], [5.33, 5.95, "B"], [6.67, 7.93, "A"],
];
// word-synced dialogue (comp seconds = podcast time − 2.65)
const DIALOGUE: [number, string, "A" | "B"][] = [
  [0.52, "You", "A"], [0.70, "played", "A"], [0.98, "me", "A"], [1.16, "two", "A"],
  [1.44, "voices", "A"], [1.92, "yesterday", "A"], [2.58, "and", "A"], [2.86, "asked", "A"],
  [3.13, "which", "A"], [3.51, "one", "A"], [3.71, "was", "A"], [3.90, "the", "A"],
  [4.09, "actual", "A"], [4.48, "human.", "A"],
  [5.33, "And", "B"], [5.49, "you", "B"], [5.71, "picked", "B"], [5.95, "wrong.", "B"],
  [6.67, "I", "A"], [6.87, "picked", "A"], [7.17, "wrong,", "A"], [7.93, "confidently.", "A"],
];

/* ---------------- session layout (design space 1920×1080; session at +70,+50, 1780×980) ---------------- */
const SX = 70, SY = 50, SW = 1780, SH = 980;
const LANE_X0 = 300, LANE_X1 = 1740;                 // waveform lanes
const TRACK_A = { y: 330, h: 140 };                  // avatar 210×118 at (30,330)
const TRACK_B = { y: 520, h: 140 };
const AVA_A = { x: 30, y: 330, w: 210, h: 118 };     // Luuk's video docks HERE
const laneT = (compSec: number) => LANE_X0 + ((compSec - POD.at) / POD.dur) * (LANE_X1 - LANE_X0);

/* ---------------- camera: focal point (design px) + zoom on the session ---------------- */
const CAM: [number, number, number, number][] = [
  [f(0.0), 960, 540, 1.0],
  [f(2.0), 960, 545, 1.03],
  [f(7.9), 960, 550, 1.06],
  [f(T(5.3)), 960, 540, 1.0],                    // base for the dock
  [f(T(6.6)), 960, 540, 1.0],
  [f(T(7.3)), 1030, 590, 1.32],                  // → lanes: 0 seconds recorded
  [f(T(11.6)), 1040, 585, 1.38],
  [f(T(12.5)), 780, 570, 1.42],                  // → lane start: the source drops in
  [f(T(15.4)), 800, 565, 1.48],
  [f(T(16.3)), 560, 330, 1.52],                  // → the rack: pipeline
  [f(T(21.2)), 580, 328, 1.58],
  [f(T(22.1)), 660, 355, 1.30],                  // → the prompt bar (transport + rack in frame)
  [f(T(26.9)), 665, 358, 1.34],
  [f(T(27.5)), 960, 540, 1.06],                  // pull back: the session builds itself
  [f(T(29.5)), 960, 542, 1.10],
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

const Blobs: React.FC = () => (
  <>
    <div style={{ position: "absolute", left: "-12%", top: "-25%", width: "55%", height: "80%", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,92,252,0.10), transparent 70%)", filter: "blur(85px)" }} />
    <div style={{ position: "absolute", right: "-10%", top: "-18%", width: "52%", height: "78%", borderRadius: "50%", background: "radial-gradient(circle, rgba(232,205,190,0.40), transparent 70%)", filter: "blur(90px)" }} />
    <div style={{ position: "absolute", left: "28%", bottom: "-30%", width: "48%", height: "72%", borderRadius: "50%", background: "radial-gradient(circle, rgba(153,158,169,0.16), transparent 70%)", filter: "blur(85px)" }} />
  </>
);

/* a waveform clip block on a lane */
const Clip: React.FC<{ x: number; y: number; w: number; active?: boolean; p?: number; seed?: number }> =
  ({ x, y, w, active = false, p = 1, seed = 0 }) => {
    const frame = useCurrentFrame();
    const n = Math.max(2, Math.floor(w / 9));
    return (
      <div style={{
        position: "absolute", left: x, top: y + (1 - p) * 10, width: Math.max(10, w), height: 96,
        background: active ? VIOLET_SOFT : "#F4F2EF", border: `1.5px solid ${active ? VIOLET : LINE}`,
        borderRadius: 12, overflow: "hidden", opacity: p,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "0 8px",
      }}>
        {Array.from({ length: n }).map((_, i) => {
          const base = 0.25 + 0.72 * Math.abs(Math.sin(i * 1.93 + seed * 2.7));
          const wob = active ? 0.74 + 0.26 * Math.sin(frame / 7 + i * 1.7 + seed * 5) : 1;
          return <div key={i} style={{ width: 4.5, height: 78 * base * wob, borderRadius: 4, background: active ? VIOLET : "#C9CBD1", flexShrink: 0 }} />;
        })}
      </div>
    );
  };

export const FishIntro3: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const wu = W / 1920;
  const sec = frame / FPS;
  const c = cam(frame);
  const drift = { x: Math.sin(frame / 42) * 3, y: Math.cos(frame / 51) * 2.5 };
  const camX = c.x + drift.x, camY = c.y + drift.y, zoom = c.z;
  // big "Fish S2.1 Pro" badge on the model line (spoken "S2.1" is cut in post; badge carries the name)
  const s21op = interpolate(frame, [f(T(19.3)), f(T(19.7)), f(T(22.1)), f(T(22.4))], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // project a design-space point to screen px (4K)
  const px = (dx: number) => (W / 2 + (dx - camX) * zoom * wu);
  const py = (dy: number) => (H / 2 + (dy - camY) * zoom * wu);

  const inOpen = frame < f(OPEN_LEN);
  const openOut = interpolate(frame, [f(OPEN_LEN - 0.45), f(OPEN_LEN)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  /* ---- speaker overlay: fullscreen hook → docks into the Voice A avatar slot ---- */
  const dockP = interpolate(frame, [f(T(5.3)), f(T(6.5))], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.45, 0, 0.18, 1) });
  // dock target rect in screen px (tracks the camera every frame)
  const tgt = {
    x: px(SX + AVA_A.x), y: py(SY + AVA_A.y),
    w: AVA_A.w * zoom * wu, h: AVA_A.h * zoom * wu,
  };
  const fullW = 0.94 * W, fullH = fullW * 9 / 16;
  const spkX = interpolate(dockP, [0, 1], [W / 2 - fullW / 2, tgt.x]);
  const spkY = interpolate(dockP, [0, 1], [H / 2 - fullH / 2, tgt.y]);
  const spkW = interpolate(dockP, [0, 1], [fullW, tgt.w]);
  const spkH = interpolate(dockP, [0, 1], [fullH, tgt.h]);
  const spkR = interpolate(dockP, [0, 1], [W * 0.012, 14 * zoom * wu]);
  const spkOpacity = interpolate(frame, [f(OPEN_LEN - 0.45), f(OPEN_LEN)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  /* hook treatment */
  const hb = f(OPEN_LEN);
  const hookBlur = interpolate(frame, [hb, hb + f(0.7)], [9, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const hookBright = interpolate(frame, [hb, hb + f(0.7)], [1.13, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hookScale = interpolate(frame, [hb, hb + f(2.4)], [1.08, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.3, 0, 0.4, 1) });
  const frameDraw = interpolate(frame, [hb + f(0.2), hb + f(1.3)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.5, 0, 0.2, 1) });
  const eyebrowIn = interpolate(frame, [hb + f(0.4), hb + f(0.9)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const bigIn = interpolate(frame, [f(T(4.25)), f(T(4.65))], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const titleOut = interpolate(frame, [f(T(5.1)), f(T(5.5))], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  /* cold-open state */
  const playX = laneT(Math.min(sec, POD.at + POD.dur));
  const timecode = (() => {
    const t = Math.max(0, sec - POD.at);
    const m = Math.floor(t / 60), s2 = Math.floor(t % 60), d = Math.floor((t % 1) * 10);
    return `${String(m).padStart(2, "0")}:${String(s2).padStart(2, "0")}.${d}`;
  })();

  /* beats */
  const zeroIn = frame >= f(T(6.2)) ? interpolate(frame, [f(T(6.2)), f(T(6.75))], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) : 0;
  const zeroStamp = frame >= f(T(9.15)) ? interpolate(frame, [f(T(9.15)), f(T(9.5))], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) : 0;
  const zeroOut = interpolate(frame, [f(T(11.9)), f(T(12.4))], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const srcIn = frame >= f(T(12.5)) ? interpolate(frame, [f(T(12.5)), f(T(13.1))], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) : 0;
  const srcOut = interpolate(frame, [f(T(15.6)), f(T(16.1))], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const minIn = frame >= f(T(14.45)) ? interpolate(frame, [f(T(14.45)), f(T(14.95))], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) : 0;
  const rack1 = frame >= f(T(16.3)) ? interpolate(frame, [f(T(16.3)), f(T(16.8))], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) : 0;
  const rack2 = frame >= f(T(17.9)) ? interpolate(frame, [f(T(17.9)), f(T(18.4))], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) : 0;
  const rack3 = frame >= f(T(19.3)) ? interpolate(frame, [f(T(19.3)), f(T(19.8))], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) : 0;
  const typeP = interpolate(frame, [f(T(22.3)), f(T(24.4))], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sendP = frame >= f(T(27.05)) ? interpolate(frame, [f(T(27.05)), f(T(27.35))], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) : 0;
  const cascade = frame >= f(T(27.4)) ? interpolate(frame, [f(T(27.4)), f(T(28.7))], [0, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.3, 0, 0.3, 1) }) : 0;
  const epIn = frame >= f(T(28.0)) ? interpolate(frame, [f(T(28.0)), f(T(28.45))], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) : 0;
  const coolIn = frame >= f(T(28.45)) ? interpolate(frame, [f(T(28.45)), f(T(28.85))], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) : 0;

  const PROMPT_TEXT = "make me a full podcast episode";
  const typed = PROMPT_TEXT.slice(0, Math.round(typeP * PROMPT_TEXT.length));
  const caret = Math.sin(frame / 8) > 0 ? 1 : 0;

  // dialogue: words visible so far, current speaker
  const visWords = DIALOGUE.filter(([t]) => sec >= t);
  const curTurn = TURNS.find(([a, b]) => sec >= a && sec <= b)?.[2] ?? null;
  const lastSp = visWords.length ? visWords[visWords.length - 1][2] : "A";

  /* session container transform */
  const sessionStyle: React.CSSProperties = {
    position: "absolute", left: 0, top: 0, width: 1920, height: 1080,
    transform: `translate(${W / 2 - camX * zoom * wu}px, ${H / 2 - camY * zoom * wu}px) scale(${zoom * wu})`,
    transformOrigin: "0 0",
  };

  const label = (t: string): React.CSSProperties => ({ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", color: GRAY });

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: SANS }}>
      <Blobs />

      {/* ================= THE SESSION ================= */}
      <div style={sessionStyle}>
        <div style={{
          position: "absolute", left: SX, top: SY, width: SW, height: SH,
          background: "#FFFFFF", borderRadius: 28, border: `1px solid ${LINE}`,
          boxShadow: "0 3px 10px rgba(23,23,26,.04), 0 40px 90px -30px rgba(23,23,26,.16)",
        }}>
          {/* transport */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 92, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: "0 40px" }}>
            <div style={{ display: "flex", gap: 9, marginRight: 28 }}>
              {["#E5484D", "#F5A623", "#5BB98B"].map((cd) => <div key={cd} style={{ width: 13, height: 13, borderRadius: 999, background: cd, opacity: 0.5 }} />)}
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 999, background: VIOLET, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 20 }}>
              <div style={{ width: 0, height: 0, borderLeft: "14px solid #fff", borderTop: "9px solid transparent", borderBottom: "9px solid transparent", marginLeft: 4 }} />
            </div>
            <span style={{ fontFamily: MONO, fontSize: 21, fontWeight: 700, color: INK, width: 130 }}>{timecode}</span>
            <span style={{ position: "absolute", left: 0, right: 0, textAlign: "center", fontFamily: MONO, fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: GRAY, pointerEvents: "none" }}>
              EP. 01 — UNTITLED SESSION
            </span>
            <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 15, fontWeight: 700, color: VIOLET, background: VIOLET_SOFT, padding: "6px 16px", borderRadius: 999 }}>● LIVE</span>
          </div>

          {/* AI prompt bar */}
          <div style={{
            position: "absolute", left: 36, width: 1100, top: 112, height: 64,
            background: typeP > 0 ? "#fff" : "#FAF9F7", border: `2px solid ${typeP > 0 ? VIOLET : LINE}`,
            borderRadius: 999, display: "flex", alignItems: "center", padding: "0 12px 0 28px",
            boxShadow: typeP > 0 ? "0 14px 34px -14px rgba(124,92,252,.35)" : "none",
          }}>
            <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, color: typed ? INK : "#C6C9CF", whiteSpace: "pre" }}>
              {typed || "ask the session assistant…"}
              {typeP > 0 && typeP < 1.01 && <span style={{ opacity: caret, color: VIOLET }}>│</span>}
            </span>
            <div style={{
              marginLeft: "auto", width: 44, height: 44, borderRadius: 999,
              background: typeP > 0.95 ? VIOLET : "#E8E6E2",
              display: "flex", alignItems: "center", justifyContent: "center",
              transform: `scale(${1 + sendP * 0.18})`,
              boxShadow: sendP > 0 ? "0 10px 26px -8px rgba(124,92,252,.6)" : "none",
            }}>
              <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 24, color: typeP > 0.95 ? "#fff" : "#B4B8BF" }}>↑</span>
            </div>
          </div>

          {/* rack: the pipeline inserts */}
          <div style={{ position: "absolute", left: 36, top: 200, display: "flex", alignItems: "center", gap: 18 }}>
            {[
              { p: rack1, name: "RESEARCH", body: <img src={staticFile("fish/claude.png")} style={{ width: 54, objectFit: "contain" }} /> },
              {
                p: rack2, name: "SCRIPT", body: (
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {[46, 32, 39].map((wd, i) => <div key={i} style={{ width: wd, height: 6, borderRadius: 4, background: i === 0 ? INK : "#D9DBDF" }} />)}
                  </div>
                )
              },
              {
                p: rack3, name: "VOICES", body: (
                  <div style={{ position: "relative" }}>
                    <img src={staticFile("fish/fish_glyph.png")} style={{ width: 66, objectFit: "contain" }} />
                    <span style={{ position: "absolute", right: -34, top: -20, fontFamily: MONO, fontSize: 12, fontWeight: 700, color: "#fff", background: VIOLET, padding: "3px 9px", borderRadius: 999 }}>S2.1 Pro</span>
                  </div>
                )
              },
            ].map((slot, i) => (
              <React.Fragment key={slot.name}>
                {i > 0 && (
                  <svg width={58} height={28} style={{ opacity: slot.p }}>
                    <path d="M 4 14 L 46 14" fill="none" stroke={VIOLET} strokeWidth={3.5} strokeLinecap="round"
                      pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - slot.p)} />
                    <path d="M 40 7 L 52 14 L 40 21" fill="none" stroke={VIOLET} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={slot.p > 0.88 ? (slot.p - 0.88) / 0.12 : 0} />
                  </svg>
                )}
                <div style={{
                  width: 200, height: 96, background: slot.p > 0 ? "#fff" : "#FAF9F7",
                  border: `1.5px solid ${slot.p > 0.3 ? VIOLET : LINE}`, borderRadius: 16,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
                  opacity: 0.35 + 0.65 * Math.min(1, slot.p + 0.0001 * frame * 0),
                  transform: `translateY(${(1 - Math.min(1, slot.p)) * 8}px)`,
                  boxShadow: slot.p > 0.3 ? "0 14px 30px -14px rgba(124,92,252,.3)" : "none",
                }}>
                  <div style={{ opacity: slot.p > 0 ? 1 : 0.35 }}>{slot.body}</div>
                  <span style={{ ...label(""), color: slot.p > 0.3 ? INK : GRAY }}>{slot.name}</span>
                </div>
              </React.Fragment>
            ))}
            <span style={{ ...label(""), marginLeft: 10, opacity: rack1 > 0 ? 0 : 0.7 }}>INSERTS — EMPTY</span>
          </div>

          {/* tracks */}
          {([
            { tr: TRACK_A, who: "A" as const, name: "voice A", sub: "the host" },
            { tr: TRACK_B, who: "B" as const, name: "voice B", sub: "…?" },
          ]).map(({ tr, who, name, sub }) => (
            <React.Fragment key={who}>
              {/* header */}
              <div style={{ position: "absolute", left: 30, top: tr.y, width: 210 }}>
                {who === "B" ? (
                  <div style={{ width: 210, height: 118, borderRadius: 14, border: `2px dashed ${curTurn === "B" && inOpen ? VIOLET : "#D4D6DB"}`, background: curTurn === "B" && inOpen ? VIOLET_SOFT : "#FAF9F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 40, color: curTurn === "B" && inOpen ? VIOLET : "#C6C9CF" }}>?</span>
                  </div>
                ) : (
                  <div style={{ width: 210, height: 118, borderRadius: 14, border: `2.5px ${dockP >= 1 ? "solid" : "dashed"} ${dockP >= 1 ? VIOLET : (curTurn === "A" && inOpen ? VIOLET : "#D4D6DB")}`, background: curTurn === "A" && inOpen ? VIOLET_SOFT : "#FAF9F7", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: dockP >= 1 ? "0 6px 18px rgba(23,23,26,.16)" : "none" }}>
                    {dockP < 1 && <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 40, color: curTurn === "A" && inOpen ? VIOLET : "#C6C9CF" }}>?</span>}
                    {dockP >= 1 && (
                      <Sequence from={f(OPEN_LEN)} layout="none">
                        <OffthreadVideo muted src={staticFile("fish3/source.mp4")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </Sequence>
                    )}
                  </div>
                )}
                <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", color: INK }}>{name}</span>
                  <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: GRAY }}>
                    {who === "A" && dockP >= 1 ? "luuk — human" : sub}
                  </span>
                </div>
              </div>
              {/* lane */}
              <div style={{ position: "absolute", left: LANE_X0, top: tr.y, width: LANE_X1 - LANE_X0, height: 118, borderRadius: 14, background: "#FAF9F7", border: `1px solid ${LINE}` }} />
            </React.Fragment>
          ))}

          {/* cold-open clips: grow with each turn */}
          {TURNS.map(([a, b, who], i) => {
            if (sec < a) return null;
            const x = laneT(a);
            const wNow = laneT(Math.min(sec, b)) - x;
            const y = (who === "A" ? TRACK_A.y : TRACK_B.y) + 11;
            const active = curTurn === who && sec <= b + 0.1 && inOpen;
            return <Clip key={i} x={x} y={y} w={wNow} active={active} seed={i + 2} />;
          })}

          {/* source-import clips (the last video becomes blocks) */}
          {[0, 1, 2, 3].map((i) => {
            const at = f(T(13.5 + i * 0.3));
            if (frame < at) return null;
            const p = interpolate(frame, [at, at + 10], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
            const y = (i % 2 === 0 ? TRACK_A.y : TRACK_B.y) + 11;
            return <Clip key={`s${i}`} x={LANE_X0 + 20 + i * 150} y={y} w={128} p={p} seed={i + 9} />;
          })}

          {/* finale cascade: the one-prompt episode builds itself */}
          {Array.from({ length: 12 }).map((_, i) => {
            const start = 0.04 + (i / 12) * 0.72;
            const p = cascade <= start ? 0 : Math.min(1, (cascade - start) / 0.22);
            if (p <= 0) return null;
            const y = (i % 2 === 0 ? TRACK_A.y : TRACK_B.y) + 11;
            const x = LANE_X0 + 30 + Math.floor(i / 2) * 235;
            return <Clip key={`c${i}`} x={x} y={y} w={205} p={p} active={p > 0.9} seed={i + 20} />;
          })}

          {/* playhead (cold open + finale) */}
          {(inOpen || cascade > 0) && (
            <div style={{
              position: "absolute", top: TRACK_A.y - 16, height: TRACK_B.y + 134 - (TRACK_A.y - 16),
              left: inOpen ? playX : LANE_X0 + cascade * (LANE_X1 - LANE_X0),
              width: 3, background: VIOLET, borderRadius: 2, opacity: 0.85,
            }}>
              <div style={{ position: "absolute", top: -9, left: -7, width: 17, height: 12, background: VIOLET, borderRadius: 3 }} />
            </div>
          )}

          {/* word-synced dialogue (cold open) */}
          {inOpen && (
            <div style={{ position: "absolute", left: 60, right: 60, top: 730, textAlign: "center" }}>
              <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: "0.12em", color: lastSp === "A" ? VIOLET : GRAY, marginBottom: 14 }}>
                VOICE {lastSp} ▸
              </div>
              <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 40, lineHeight: 1.35, color: INK }}>
                {visWords.slice(-14).map(([t, w, sp], i) => (
                  <span key={t} style={{ opacity: Math.min(1, (sec - t) / 0.18) * (sp === lastSp ? 1 : 0.35), marginRight: 12, color: sp === "B" ? GRAY : INK }}>{w}</span>
                ))}
              </div>
            </div>
          )}

          {/* status strip */}
          <div style={{ position: "absolute", left: 36, bottom: 26, display: "flex", gap: 26, alignItems: "center" }}>
            <span style={label("")}>48 kHz</span><span style={label("")}>2 TRACKS</span>
            <span style={{ ...label(""), color: zeroStamp > 0 ? "#E5484D" : GRAY }}>{zeroStamp > 0 ? "INPUT: NONE" : "MONITORING"}</span>
          </div>

          {/* ---- beat overlays (inside the session, over the lanes) ---- */}
          {/* 0 seconds recorded */}
          {zeroIn > 0 && zeroOut > 0 && (
            <div style={{
              position: "absolute", left: 620, top: 430, transform: `translateY(${(1 - zeroIn) * 18}px) rotate(-1deg)`,
              background: "rgba(255,255,255,0.96)", border: `1.5px solid ${LINE}`, borderRadius: 20,
              boxShadow: "0 30px 60px -22px rgba(23,23,26,.22)", padding: "30px 42px", opacity: zeroIn * zeroOut,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 14, height: 14, borderRadius: 999, background: "#E5484D", opacity: Math.sin(frame / 7) > 0 ? 0.6 : 0.2 }} />
                <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: "0.14em", color: GRAY, textDecoration: "line-through" }}>REC</span>
                <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: "0.10em", color: GRAY }}>NO MIC · NO STUDIO</span>
              </div>
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 92, letterSpacing: "-0.04em", color: INK, lineHeight: 1, marginTop: 12, opacity: Math.max(0.18, zeroStamp) }}>
                0:00 <span style={{ fontSize: 34, fontWeight: 700, color: GRAY }}>recorded</span>
              </div>
              <div style={{ fontFamily: SANS, fontWeight: 500, fontSize: 22, color: GRAY, marginTop: 8 }}>of the episode you just heard.</div>
            </div>
          )}

          {/* the source drops in */}
          {srcIn > 0 && srcOut > 0 && (
            <div style={{ position: "absolute", left: 330, top: 705, display: "flex", alignItems: "center", gap: 26, opacity: srcIn * srcOut, transform: `translateY(${(1 - srcIn) * 16}px)` }}>
              <div style={{ width: 250, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: 10, boxShadow: "0 22px 46px -18px rgba(23,23,26,.2)", transform: "rotate(-1.2deg)" }}>
                <img src={staticFile("fish3/lastvideo.jpg")} style={{ width: "100%", borderRadius: 9, display: "block" }} />
                <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: GRAY, marginTop: 8, letterSpacing: "0.06em" }}>my_last_video.mp4</div>
              </div>
              <svg width={86} height={40} style={{ overflow: "visible" }}>
                <path d="M 4 20 L 64 20" fill="none" stroke={VIOLET} strokeWidth={4.5} strokeLinecap="round"
                  pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - srcIn)} />
                <path d="M 56 11 L 72 20 L 56 29" fill="none" stroke={VIOLET} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" opacity={srcIn > 0.9 ? 1 : 0} />
              </svg>
              <div style={{ opacity: minIn, transform: `translateY(${(1 - minIn) * 10}px)`, whiteSpace: "nowrap" }}>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 44, color: INK }}>≈ 2 minutes</span>
                <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 30, color: GRAY }}> of my time.</span>
              </div>
            </div>
          )}

          {/* rendered episode chip */}
          {epIn > 0 && (
            <div style={{
              position: "absolute", left: 1180, top: 720, display: "flex", alignItems: "center", gap: 14,
              background: "#fff", border: `1.5px solid ${VIOLET}`, borderRadius: 999, padding: "13px 26px",
              boxShadow: "0 20px 44px -16px rgba(124,92,252,.4)", opacity: epIn, transform: `translateY(${(1 - epIn) * -14}px)`,
            }}>
              <img src={staticFile("fish/fish_glyph.png")} style={{ height: 24, objectFit: "contain" }} />
              <span style={{ fontFamily: MONO, fontSize: 19, fontWeight: 700, color: INK }}>episode_01.wav</span>
              <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 21, color: VIOLET }}>✓ rendered</span>
            </div>
          )}
        </div>
      </div>

      {/* ================= SPEAKER (fullscreen hook → dock flight; in-session afterwards) ================= */}
      {frame < f(T(6.55)) && <div style={{
        position: "absolute", left: spkX, top: spkY, width: spkW, height: spkH,
        borderRadius: spkR, overflow: "hidden", opacity: spkOpacity,
        boxShadow: dockP < 1
          ? `0 ${W * 0.007}px ${W * 0.022}px rgba(23,23,26,0.20)`
          : `0 ${6 * zoom * wu}px ${18 * zoom * wu}px rgba(23,23,26,0.18)`,
      }}>
        {frame < f(OPEN_LEN) && (
          <img src={staticFile("fish3/poster.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }} />
        )}
        <Sequence from={f(OPEN_LEN)} layout="none">
          <OffthreadVideo muted src={staticFile("fish3/source.mp4")}
            style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${hookScale})`, filter: `contrast(1.04) saturate(1.05) brightness(${hookBright})${hookBlur > 0.1 ? ` blur(${hookBlur}px)` : ""}` }} />
        </Sequence>

        {frame >= hb && frame < f(T(5.7)) && (
          <>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "44%", background: "linear-gradient(to top, rgba(23,23,26,0.60), transparent)", opacity: Math.min(eyebrowIn, titleOut) }} />
            <div style={{ position: "absolute", left: "5.2%", bottom: "8.5%", opacity: titleOut, display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: W * 0.006, background: "rgba(16,15,20,0.80)", padding: `${W * 0.010}px ${W * 0.016}px`, borderRadius: W * 0.014, boxShadow: "0 14px 40px rgba(0,0,0,0.42)", backdropFilter: "blur(2px)" }}>
              <div style={{ opacity: eyebrowIn, transform: `translateY(${(1 - eyebrowIn) * W * 0.006}px)`, display: "flex", alignItems: "center", gap: W * 0.007 }}>
                <span style={{ fontFamily: MONO, fontSize: W * 0.0105, fontWeight: 700, letterSpacing: "0.14em", background: "rgba(155,144,232,0.95)", color: "#111", padding: `${W * 0.003}px ${W * 0.008}px`, borderRadius: W * 0.02 }}>[ ep. 01 ]</span>
                <span style={{ fontFamily: MONO, fontSize: W * 0.0105, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(255,255,255,0.78)" }}>TWO PEOPLE. ONE CONVERSATION.</span>
              </div>
              <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.040, color: "#fff", lineHeight: 1.05, opacity: bigIn, transform: `translateY(${(1 - bigIn) * W * 0.008}px)` }}>
                one of them <span style={{ color: "#B3A8FF" }}>doesn&apos;t exist.</span>
              </div>
            </div>
          </>
        )}

        {/* violet frame — stays through the dock */}
        <svg width="100%" height="100%" viewBox={`0 0 ${spkW} ${spkH}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0 }}>
          <rect x={spkW * 0.006} y={spkW * 0.006} width={spkW * 0.988} height={spkH - spkW * 0.012}
            rx={spkR * 0.85} fill="none" stroke={VIOLET} strokeWidth={Math.max(2, spkW * 0.0028)}
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - frameDraw)} />
        </svg>
      </div>}

      {/* podcast audio */}
      <Sequence from={f(POD.at)} durationInFrames={f(POD.dur)}>
        <Audio src={staticFile("fish3/podcast.wav")} startFrom={f(POD.start)}
          volume={(fr) => interpolate(fr, [0, 8, f(POD.dur) - 12, f(POD.dur)], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
      </Sequence>

      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 80% 72% at 50% 44%, transparent 62%, rgba(23,23,26,0.06) 100%)" }} />

      {frame >= f(T(28.9)) && (
        <AbsoluteFill style={{ background: "#fff", opacity: interpolate(frame, [f(T(28.9)), f(T(29.2)), f(T(29.55))], [0, 0.85, 0.95], { extrapolateRight: "clamp" }) }} />
      )}

      {/* big Fish S2.1 Pro badge — model moment */}
      {s21op > 0 && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: "13%", display: "flex", justifyContent: "center", opacity: s21op }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: W * 0.012, background: "rgba(255,255,255,0.97)", borderRadius: W * 0.022, padding: `${W * 0.011}px ${W * 0.024}px`, boxShadow: "0 26px 64px -18px rgba(0,0,0,.45)" }}>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.036, color: "#141317", letterSpacing: "-0.02em" }}>Fish</span>
            <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.024, color: "#fff", background: "#9b90e8", padding: `${W * 0.006}px ${W * 0.016}px`, borderRadius: 999 }}>S2.1 Pro</span>
          </div>
        </div>
      )}

      {/* cues at landings */}
      <Sequence from={f(0.35)} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.26} /></Sequence>
      <Sequence from={f(OPEN_LEN - 0.3)} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.3} /></Sequence>
      <Sequence from={f(T(6.35))} durationInFrames={15}><Audio src={staticFile("vedit/sfx/tap.wav")} volume={0.4} /></Sequence>
      <Sequence from={f(T(9.25))} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.42} /></Sequence>
      <Sequence from={f(T(12.8))} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.3} /></Sequence>
      <Sequence from={f(T(13.6))} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.26} /></Sequence>
      <Sequence from={f(T(13.9))} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.26} /></Sequence>
      <Sequence from={f(T(14.2))} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.26} /></Sequence>
      <Sequence from={f(T(16.65))} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.4} /></Sequence>
      <Sequence from={f(T(18.25))} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.36} /></Sequence>
      <Sequence from={f(T(19.65))} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.4} /></Sequence>
      <Sequence from={f(T(22.4))} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.3} /></Sequence>
      <Sequence from={f(T(27.15))} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.45} /></Sequence>
      <Sequence from={f(T(27.6))} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.24} /></Sequence>
      <Sequence from={f(T(27.9))} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.24} /></Sequence>
      <Sequence from={f(T(28.2))} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.26} /></Sequence>
      <Sequence from={f(T(28.05))} durationInFrames={15}><Audio src={staticFile("vedit/sfx/tap.wav")} volume={0.5} /></Sequence>
    </AbsoluteFill>
  );
};

export default FishIntro3;

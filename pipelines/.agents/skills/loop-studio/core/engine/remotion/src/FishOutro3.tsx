/**
 * FishOutro3 — outro in the FishIntro3 "session" style (2026-07-03).
 * Same mac-window podcast-session shell (transport bar, EP.01/LIVE, two tracks,
 * sweeping playhead, karaoke captions, speaker docked in the Voice A slot). The
 * camera travels the timeline; each CTA line drops a clip on the track + a panel:
 *   links → 50% OFF → FREE·JULY (S2.1) → thank-you → links → like/subscribe + next.
 * The doubled "50% discount" take is skipped in the source (keep last take).
 */
import React from "react";
import {
  AbsoluteFill, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig,
  staticFile, Easing, delayRender, continueRender,
} from "remotion";
import WORDS from "./fishoutro3_words_hero.json";

const FPS = 30;
const f = (s: number) => Math.round(s * FPS);
const EASE = Easing.bezier(0.45, 0, 0.18, 1);
const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const BG = "#F5F3F1";
const VIOLET = "#7C5CFC";
const VIOLET_SOFT = "#EFEAFE";
const INK = "#17171A";
const GRAY = "#999EA9";
const LINE = "#E9E6E2";
const CAPBAR = "rgba(20,20,26,0.82)";
const SANS = "'DM Sans', 'PingFang SC', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

const fontHandle = delayRender("fishoutro3-fonts");
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

/* ---- source skip (drop the first "50% discount" retake) ---- */
const SKIP_START = 4.1, SKIP_END = 8.31, SKIP_LEN = SKIP_END - SKIP_START;
// 2nd skip: after "…free access", cut "to the S2.1 model the entire month of July" in the
// SOURCE footage. "access" -sss ends src 14.11; "Thank" resumes at src 17.20 (after a pause).
// NOTE: the precise clean audio is muxed on post-render (source-cut, no OffthreadVideo lag);
// these footage seams just keep the tiny avatar roughly in sync.
const SKIP2_START = 14.11, SKIP2_END = 17.20, SKIP2_LEN = SKIP2_END - SKIP2_START;
const SKIP2_COMP = SKIP2_START - SKIP_LEN; // where the 2nd skip lands in comp time (9.90)
const SRC_DUR = 27.05;
const COMP_DUR = SRC_DUR - SKIP_LEN - SKIP2_LEN; // 19.75

/* ---- session layout (design space 1920×1080) ---- */
const SX = 70, SY = 50, SW = 1780, SH = 980;
const LANE_X0 = 300, LANE_X1 = 1740;
const TRACK_A = { y: 330 }, TRACK_B = { y: 520 };
const AVA = { x: 30, y: 330, w: 210, h: 118 };
const laneX = (t: number) => LANE_X0 + (t / COMP_DUR) * (LANE_X1 - LANE_X0);

const useIn = (at: number, dur = 12) => {
  const frame = useCurrentFrame();
  if (frame < at) return 0;
  return interpolate(frame, [at, at + dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
};
const hold = (frame: number, at: number, until: number, d = 8) =>
  Math.min(interpolate(frame, [at, at + d], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }),
           interpolate(frame, [until - d, until], [1, 0], clamp));

const GRID_URI = (() => {
  const s = 84;
  return "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'><path d='M ${s} 0 L 0 0 0 ${s}' fill='none' stroke='rgba(124,92,252,0.10)' stroke-width='1.1'/></svg>`);
})();
const Blobs: React.FC = () => (
  <>
    <div style={{ position: "absolute", left: "-10%", top: "-22%", width: "52%", height: "78%", borderRadius: "50%", background: "radial-gradient(circle, rgba(124,92,252,0.10), transparent 70%)", filter: "blur(85px)" }} />
    <div style={{ position: "absolute", right: "-10%", top: "-14%", width: "50%", height: "74%", borderRadius: "50%", background: "radial-gradient(circle, rgba(232,205,190,0.36), transparent 70%)", filter: "blur(90px)" }} />
  </>
);
const Clip: React.FC<{ x: number; y: number; w: number; active?: boolean; p?: number; seed?: number }> =
  ({ x, y, w, active = false, p = 1, seed = 0 }) => {
    const frame = useCurrentFrame();
    const n = Math.max(3, Math.floor(w / 9));
    return (
      <div style={{ position: "absolute", left: x, top: y + (1 - p) * 8, width: Math.max(10, w), height: 96,
        background: active ? VIOLET_SOFT : "#F4F2EF", border: `1.5px solid ${active ? VIOLET : LINE}`,
        borderRadius: 12, overflow: "hidden", opacity: p, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "0 8px" }}>
        {Array.from({ length: n }).map((_, i) => {
          const base = 0.25 + 0.72 * Math.abs(Math.sin(i * 1.93 + seed * 2.7));
          const wob = active ? 0.74 + 0.26 * Math.sin(frame / 7 + i * 1.7 + seed * 5) : 1;
          return <div key={i} style={{ width: 4.5, height: Math.min(58, 78 * base * wob), borderRadius: 4, background: active ? VIOLET : "#C9CBD1", flexShrink: 0 }} />;
        })}
      </div>
    );
  };

/* clean karaoke captions (dark bar, current word violet) */
function chunk(ws: Word[]): Word[][] {
  const g: Word[][] = []; let cur: Word[] = [];
  for (const w of ws) { cur.push(w);
    const clause = /[.?!,]$/.test(w[2]); const dur = w[1] - cur[0][0];
    if ((cur.length >= 3 && (clause || dur > 1.5)) || cur.length >= 5) { g.push(cur); cur = []; } }
  if (cur.length) g.push(cur); return g;
}
const Captions: React.FC = () => {
  const { width: W } = useVideoConfig();
  const t = useCurrentFrame() / FPS;
  const groups = React.useMemo(() => chunk(words), []);
  let gi = -1;
  for (let i = 0; i < groups.length; i++) {
    const start = groups[i][0][0];
    const end = i + 1 < groups.length ? groups[i + 1][0][0] : groups[i][groups[i].length - 1][1] + 0.5;
    if (t >= start - 0.08 && t < end) { gi = i; break; }
  }
  if (gi < 0) return null;
  const g = groups[gi];
  const pop = interpolate(t, [g[0][0] - 0.1, g[0][0] + 0.02], [0, 1], clamp);
  return (
    <div style={{ position: "absolute", left: "6%", right: "6%", bottom: "8%", display: "flex", justifyContent: "center", opacity: pop }}>
      <div style={{ background: CAPBAR, borderRadius: W * 0.02, padding: `${W * 0.012}px ${W * 0.02}px`, textAlign: "center", boxShadow: "0 12px 34px rgba(0,0,0,0.28)" }}>
        {g.map(([s, e, w], i) => {
          const current = t >= s - 0.02 && (i === g.length - 1 ? t < e + 0.25 : t < g[i + 1][0]);
          return <span key={i} style={{ fontFamily: SANS, fontWeight: 800, fontSize: W * 0.03, lineHeight: 1.3, color: "#fff",
            background: current ? VIOLET : "transparent", padding: `${W * 0.0015}px ${W * 0.009}px`, borderRadius: W * 0.011, margin: `0 ${W * 0.0015}px`,
            boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" }}>{w}</span>;
        })}
      </div>
    </div>
  );
};

/* CTA panels along the timeline (world space, above the lanes) */
const Panel: React.FC<{ x: number; p: number; children: React.ReactNode }> = ({ x, p, children }) => (
  <div style={{ position: "absolute", left: x, top: 690, transform: `translate(-50%, ${(1 - p) * 16}px)`, opacity: p }}>{children}</div>
);
const label: React.CSSProperties = { fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", color: GRAY };

/* Avatar footage segment with opacity cross-dissolve at the skip seams.
   Skipping source footage snaps the tiny talking-head to a new pose (a jump-cut);
   a short cross-dissolve at each seam morphs the pose instead of snapping. The
   overlapping frames play a hair of the removed footage at falling opacity — at
   ~210px that reads as a soft morph, never a readable re-take. */
const CF = 5; // crossfade length in frames (~0.16s)
const AvaVid: React.FC<{ startFrom: number; fadeIn: boolean; fadeOut: boolean; dur: number }> =
  ({ startFrom, fadeIn, fadeOut, dur }) => {
    const r = useCurrentFrame(); // relative to the enclosing Sequence
    let op = 1;
    if (fadeIn) op = Math.min(op, interpolate(r, [0, CF], [0, 1], clamp));
    if (fadeOut) op = Math.min(op, interpolate(r, [dur - CF, dur], [1, 0], clamp));
    return <OffthreadVideo muted src={staticFile("fish3/outro.mp4")} startFrom={startFrom}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: op }} />;
  };

export const FishOutro3: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const wu = W / 1920;
  const sec = frame / FPS;

  /* CTA beats (comp sec) */
  const B = {
    links1: { at: f(0.2), until: f(4.0), x: laneX(1.6) },
    off:    { at: f(4.1), until: f(7.5), x: laneX(5.4) },     // "50% off, creator plan"
    july:   { at: f(7.7), until: f(9.9), x: laneX(8.7) },     // "free for developers, free access"
    thanks: { at: f(9.95), until: f(12.35), x: laneX(11.0) }, // "thank you for sticking around…"
    links2: { at: f(12.45), until: f(16.05), x: laneX(14.0) },// "check the links… good discounts"
    subs:   { at: f(16.1), until: f(COMP_DUR), x: laneX(17.7) }, // "like & subscribe, see you next"
  };
  /* camera follows the playhead across the timeline */
  const camX = interpolate(sec, [0, COMP_DUR], [700, 1500], clamp) + Math.sin(frame / 44) * 4;
  const camY = 610 + Math.cos(frame / 52) * 4;
  const zoom = interpolate(sec, [0, 2, COMP_DUR - 2, COMP_DUR], [1.02, 1.16, 1.16, 1.08], clamp);
  const sessionStyle: React.CSSProperties = {
    position: "absolute", left: 0, top: 0, width: 1920, height: 1080,
    transform: `translate(${W / 2 - camX * zoom * wu}px, ${H / 2 - camY * zoom * wu}px) scale(${zoom * wu})`, transformOrigin: "0 0",
  };
  const gridPos = `${W / 2 - camX * zoom * wu}px ${H / 2 - camY * zoom * wu}px`;

  const timecode = (() => {
    const m = Math.floor(sec / 60), s2 = Math.floor(sec % 60), d = Math.floor((sec % 1) * 10);
    return `${String(m).padStart(2, "0")}:${String(s2).padStart(2, "0")}.${d}`;
  })();
  const playX = laneX(sec);
  const endFlash = frame >= f(COMP_DUR - 0.2) ? interpolate(frame, [f(COMP_DUR - 0.2), f(COMP_DUR - 0.05), f(COMP_DUR)], [0, 0.85, 0.95], { extrapolateRight: "clamp" }) : 0;

  /* per-beat state */
  const p = {
    links1: hold(frame, B.links1.at, B.links1.until),
    off: hold(frame, B.off.at, B.off.until),
    july: hold(frame, B.july.at, B.july.until),
    thanks: hold(frame, B.thanks.at, B.thanks.until),
    links2: hold(frame, B.links2.at, B.links2.until),
    subs: hold(frame, B.subs.at, B.subs.until),
  };
  const subLike = useIn(B.subs.at, 10), subBell = useIn(B.subs.at + 10, 10);

  /* clips already laid down on the tracks up to the playhead (the finished episode) */
  const CLIPS = [
    { x: LANE_X0 + 20, w: 210, y: TRACK_A.y }, { x: LANE_X0 + 260, w: 300, y: TRACK_B.y },
    { x: LANE_X0 + 590, w: 260, y: TRACK_A.y }, { x: LANE_X0 + 880, w: 240, y: TRACK_B.y },
    { x: LANE_X0 + 1150, w: 300, y: TRACK_A.y }, { x: LANE_X0 + 1480, w: 240, y: TRACK_B.y },
    { x: LANE_X0 + 1750, w: 220, y: TRACK_A.y }, { x: LANE_X0 + 2000, w: 200, y: TRACK_B.y },
  ];

  const linkChip = (p: number) => (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 14, background: "#fff", border: `2px solid ${VIOLET}`, borderRadius: 18, padding: "20px 34px", boxShadow: "0 22px 46px -16px rgba(124,92,252,.4)" }}>
      <span style={{ fontFamily: MONO, fontSize: 26, color: GRAY }}>▸</span>
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 30, color: INK }}>links in the description</span>
    </div>
  );

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: SANS }}>
      <Blobs />
      <AbsoluteFill style={{ backgroundImage: `url("${GRID_URI}")`, backgroundSize: `${84 * zoom * wu}px`, backgroundPosition: gridPos,
        maskImage: "radial-gradient(ellipse 92% 80% at 50% 46%, #000 0%, rgba(0,0,0,.4) 60%, transparent 92%)",
        WebkitMaskImage: "radial-gradient(ellipse 92% 80% at 50% 46%, #000 0%, rgba(0,0,0,.4) 60%, transparent 92%)" }} />

      {/* ============ THE SESSION ============ */}
      <div style={sessionStyle}>
        <div style={{ position: "absolute", left: SX, top: SY, width: SW, height: SH, background: "#fff", borderRadius: 28, border: `1px solid ${LINE}`, boxShadow: "0 3px 10px rgba(23,23,26,.04), 0 40px 90px -30px rgba(23,23,26,.16)" }}>
          {/* transport */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 92, borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", padding: "0 40px" }}>
            <div style={{ display: "flex", gap: 9, marginRight: 28 }}>{["#E5484D", "#F5A623", "#5BB98B"].map((cd) => <div key={cd} style={{ width: 13, height: 13, borderRadius: 999, background: cd, opacity: 0.5 }} />)}</div>
            <div style={{ width: 44, height: 44, borderRadius: 999, background: VIOLET, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 20 }}>
              <div style={{ width: 0, height: 0, borderLeft: "14px solid #fff", borderTop: "9px solid transparent", borderBottom: "9px solid transparent", marginLeft: 4 }} />
            </div>
            <span style={{ fontFamily: MONO, fontSize: 21, fontWeight: 700, color: INK, width: 130 }}>{timecode}</span>
            <span style={{ position: "absolute", left: 0, right: 0, textAlign: "center", fontFamily: MONO, fontSize: 16, fontWeight: 700, letterSpacing: "0.16em", color: GRAY, pointerEvents: "none" }}>EP. 01 — EXPORTED ✓</span>
            <span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 15, fontWeight: 700, color: VIOLET, background: VIOLET_SOFT, padding: "6px 16px", borderRadius: 999 }}>● LIVE</span>
          </div>

          {/* rack (populated — the session is done) */}
          <div style={{ position: "absolute", left: 36, top: 200, display: "flex", alignItems: "center", gap: 18 }}>
            {[{ name: "RESEARCH", body: <img src={staticFile("fish/claude.png")} style={{ width: 50, objectFit: "contain" }} /> },
              { name: "SCRIPT", body: <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>{[46, 32, 39].map((wd, i) => <div key={i} style={{ width: wd, height: 6, borderRadius: 4, background: i === 0 ? INK : "#D9DBDF" }} />)}</div> },
              { name: "VOICES", body: <div style={{ position: "relative" }}><img src={staticFile("fish/fish_glyph.png")} style={{ width: 62, objectFit: "contain" }} /><span style={{ position: "absolute", right: -34, top: -20, fontFamily: MONO, fontSize: 12, fontWeight: 700, color: "#fff", background: VIOLET, padding: "3px 9px", borderRadius: 999 }}>S2.1 Pro</span></div> },
            ].map((slot, i) => (
              <React.Fragment key={slot.name}>
                {i > 0 && <svg width={44} height={26}><path d="M 3 13 L 34 13" fill="none" stroke={VIOLET} strokeWidth={3} strokeLinecap="round" /><path d="M 28 7 L 39 13 L 28 19" fill="none" stroke={VIOLET} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg>}
                <div style={{ width: 190, height: 92, background: "#fff", border: `1.5px solid ${VIOLET}`, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, boxShadow: "0 14px 30px -14px rgba(124,92,252,.3)" }}>
                  {slot.body}<span style={{ ...label, color: INK }}>{slot.name}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* tracks */}
          {[{ y: TRACK_A.y, name: "voice A", sub: "luuk — human" }, { y: TRACK_B.y, name: "voice B", sub: "fish s2.1 pro" }].map((tr, ti) => (
            <React.Fragment key={ti}>
              <div style={{ position: "absolute", left: 30, top: tr.y, width: 210 }}>
                {ti === 0 ? (
                  <div style={{ width: AVA.w, height: AVA.h, borderRadius: 14, border: `2.5px solid ${VIOLET}`, overflow: "hidden", boxShadow: "0 6px 18px rgba(23,23,26,.16)" }}>
                    {/* picture only (audio is muxed precisely in post); footage skips the doubled
                        "50% discount" take + the "S2.1 model / July" tail, cross-dissolved so the
                        talking head morphs across each seam instead of snapping to a new pose. */}
                    <Sequence from={0} durationInFrames={f(SKIP_START) + CF} layout="none">
                      <AvaVid startFrom={0} fadeIn={false} fadeOut dur={f(SKIP_START) + CF} />
                    </Sequence>
                    <Sequence from={f(SKIP_START)} durationInFrames={f(SKIP2_COMP - SKIP_START) + CF} layout="none">
                      <AvaVid startFrom={f(SKIP_END)} fadeIn fadeOut dur={f(SKIP2_COMP - SKIP_START) + CF} />
                    </Sequence>
                    <Sequence from={f(SKIP2_COMP)} durationInFrames={f(COMP_DUR) - f(SKIP2_COMP)} layout="none">
                      <AvaVid startFrom={f(SKIP2_END)} fadeIn fadeOut={false} dur={f(COMP_DUR) - f(SKIP2_COMP)} />
                    </Sequence>
                  </div>
                ) : (
                  <div style={{ width: AVA.w, height: AVA.h, borderRadius: 14, border: `2px solid ${LINE}`, background: "#FAF9F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <img src={staticFile("fish/fish_glyph.png")} style={{ width: "42%", objectFit: "contain", opacity: 0.7 }} />
                  </div>
                )}
                <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: "0.1em", color: INK }}>{tr.name}</span>
                  <span style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: GRAY }}>{tr.sub}</span>
                </div>
              </div>
              <div style={{ position: "absolute", left: LANE_X0, top: tr.y, width: LANE_X1 - LANE_X0, height: 118, borderRadius: 14, background: "#FAF9F7", border: `1px solid ${LINE}` }} />
            </React.Fragment>
          ))}

          {/* the finished episode clips (only up to the playhead) */}
          {CLIPS.map((cl, i) => {
            if (cl.x > playX + 40) return null;
            if (cl.x >= LANE_X1 - 24) return null;                    // clip starts past the lane → don't draw it
            const cw = Math.min(cl.w, LANE_X1 - 12 - cl.x);           // clamp right edge inside the lane
            const active = cl.x <= playX && cl.x + cw >= playX;
            return <Clip key={i} x={cl.x} y={cl.y + 11} w={cw} active={active} seed={i + 4} />;
          })}

          {/* playhead */}
          <div style={{ position: "absolute", top: TRACK_A.y - 16, height: TRACK_B.y + 134 - (TRACK_A.y - 16), left: playX, width: 3, background: VIOLET, borderRadius: 2, opacity: 0.9 }}>
            <div style={{ position: "absolute", top: -9, left: -7, width: 17, height: 12, background: VIOLET, borderRadius: 3 }} />
          </div>

          {/* status strip */}
          <div style={{ position: "absolute", left: 36, bottom: 26, display: "flex", gap: 26, alignItems: "center" }}>
            <span style={label}>48 kHz</span><span style={label}>2 TRACKS</span><span style={{ ...label, color: VIOLET }}>RENDER DONE</span>
          </div>

          {/* ===== CTA panels (above the lanes, camera travels to each) ===== */}
          {p.links1 > 0 && <Panel x={B.links1.x} p={p.links1}><div style={{ textAlign: "center" }}>{linkChip(p.links1)}</div></Panel>}
          {p.off > 0 && <Panel x={B.off.x} p={p.off}>
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 16, background: VIOLET, borderRadius: 999, padding: "22px 44px", boxShadow: "0 24px 50px -16px rgba(124,92,252,.55)" }}>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 60, color: "#fff" }}>50% OFF</span>
                <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: "#EFEAFE" }}>Creator Plan</span>
              </div></div></Panel>}
          {p.july > 0 && <Panel x={B.july.x} p={p.july}>
            <div style={{ textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 18, background: "#fff", border: `2px solid ${VIOLET}`, borderRadius: 999, padding: "20px 40px", boxShadow: "0 24px 50px -16px rgba(124,92,252,.45)" }}>
                <img src={staticFile("fish/fish_glyph.png")} style={{ height: 44, objectFit: "contain" }} />
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 44, color: VIOLET }}>S2.1 Pro</span>
                <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: INK }}>free for developers</span>
              </div></div></Panel>}
          {p.thanks > 0 && <Panel x={B.thanks.x} p={p.thanks}>
            <div style={{ textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: 66, letterSpacing: "-0.02em", color: INK }}>thanks for<br />sticking around<span style={{ color: VIOLET }}>.</span></div></Panel>}
          {p.links2 > 0 && <Panel x={B.links2.x} p={p.links2}><div style={{ textAlign: "center" }}>{linkChip(p.links2)}</div></Panel>}
          {p.subs > 0 && <Panel x={B.subs.x} p={p.subs}>
            <div style={{ textAlign: "center", marginTop: -110 }}>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 18 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: "#E5484D", borderRadius: 999, padding: "16px 30px", opacity: subLike, transform: `translateY(${(1 - subLike) * 14}px)` }}>
                  <span style={{ fontSize: 34 }}>👍</span><span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 32, color: "#fff" }}>LIKE</span></div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: INK, borderRadius: 999, padding: "16px 30px", opacity: subBell, transform: `translateY(${(1 - subBell) * 14}px)` }}>
                  <span style={{ fontSize: 34 }}>🔔</span><span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 32, color: "#fff" }}>SUBSCRIBE</span></div>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 16, background: VIOLET, borderRadius: 999, padding: "22px 44px", boxShadow: "0 24px 50px -16px rgba(124,92,252,.55)" }}>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 42, color: "#fff", whiteSpace: "nowrap" }}>see you next video</span>
                <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: 42, color: "#EFEAFE" }}>→</span>
              </div></div></Panel>}
        </div>
      </div>

      <Captions />
      {endFlash > 0 && <AbsoluteFill style={{ background: "#fff", opacity: endFlash }} />}
    </AbsoluteFill>
  );
};

export default FishOutro3;

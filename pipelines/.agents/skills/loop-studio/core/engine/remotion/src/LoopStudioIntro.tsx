/**
 * LoopStudioIntro — the masterclass intro, edited BY the skill it demos.
 * Forked from VideoEditIntro (proven, shipped 2026-07-02) and re-authored to the
 * NEW 38s cut (loopstudio-intro_CUT.mp4). Designer's-canvas world: a silver
 * worksheet, a hand-drawn ink path threading four FIG. stations, the speaker
 * floating as a card that breaks to fullscreen. Camera never rests.
 *
 * Beats (word-timed to the render):
 *   HOOK   0.0–4.94  speaker fullscreen, film-title lockup
 *   TURN   5.14–9.52 "build this entire video in front of you" → canvas reveals
 *   SCOPE  9.58–13.2 "raw take → fully edited video"           → RAW → FINAL
 *   MECH   13.2–20.1 "no editor, no timeline, just notes"      → NO TIMELINE (+fullscreen break)
 *   COST   20.5–25.9 "$2k/mo → nothing, only cloud"            → THE ECONOMICS
 *   BETTER 26.3–27.7 "honestly, it's better"                   → lime stamp
 *   TEASE  27.7–33.7 "$2k = least interesting part"            → grey the $2k
 *   CRAZY  33.7–36.3 "the economics are crazy"                 → curve shoots up
 *   BUTTON 36.6–37.8 "so let's dive in"                        → GO, white flash
 */
import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
} from "remotion";
import { SANS, MONO, SERIF } from "./bb2/engine";

const FPS = 30;
const f = (sec: number) => Math.round(sec * FPS);

const RAISIN = "#0F121A";
const SILVER_BG = "#E9ECED";
const SILVER_SOFT = "#D2D8DA";
const BODY = "#5A6068";
const LIME = "#CFFF05";

// ---------------- world camera (never static — every hold drifts) ----------------
const CAM: [number, number, number, number][] = [
  [f(0.00), 560, 545, 1.12],    // hook: tight behind the fullscreen speaker, slow push
  [f(4.60), 610, 552, 1.06],
  [f(5.30), 560, 560, 0.98],    // TURN: pull back — canvas reveals around the shrinking speaker
  [f(9.10), 720, 560, 0.95],    // creep right along the ink
  [f(9.70), 1560, 560, 0.92],   // SCOPE: glide to RAW → FINAL
  [f(13.10), 1660, 565, 0.90],
  [f(13.60), 2650, 590, 0.90],  // MECH: glide to NO-TIMELINE / NOTES
  [f(15.60), 2700, 600, 0.86],  // creep (behind the fullscreen break)
  [f(20.30), 2760, 640, 0.84],
  [f(20.90), 2980, 1430, 0.80], // COST: dive down into THE ECONOMICS
  [f(26.10), 3040, 1455, 0.84],
  [f(27.60), 3020, 1480, 0.80], // BETTER / TEASE: ease back to show the whole ledger
  [f(33.60), 3130, 1560, 0.74],
  [f(34.10), 3180, 1650, 0.72], // CRAZY: the curve
  [f(36.50), 3120, 2020, 0.82], // BUTTON: push down into GO
  [f(38.30), 3150, 2050, 0.86],
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

// ink path: BUILD → RAW→FINAL → NOTES → dive → ECONOMICS → GO
const PATH_D =
  "M 640 690 C 900 800, 1120 600, 1360 600 " +          // BUILD → toward RAW→FINAL
  "C 1760 600, 2050 600, 2380 610 " +                    // across RAW→FINAL → NOTES
  "C 2700 615, 2860 640, 2900 820 " +                    // curl down out of NOTES
  "C 2940 1040, 2900 1220, 2960 1360 " +                 // dive into ECONOMICS
  "C 3010 1520, 3060 1720, 3080 1920";                   // down toward GO
const PATH_LEN = 6600;

const GRID_URI = (() => {
  const s = 76;
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'><path d='M ${s} 0 L 0 0 0 ${s}' fill='none' stroke='rgba(15,18,26,0.10)' stroke-width='1'/></svg>`
    )
  );
})();

export const LoopStudioIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const wu = W / 1920;
  const c0 = cam(frame);
  const c = { x: c0.x + Math.sin(frame / 38) * 5, y: c0.y + Math.cos(frame / 47) * 4, z: c0.z };

  const worldStyle: React.CSSProperties = {
    position: "absolute", left: 0, top: 0, width: 0, height: 0,
    transform: `translate(${W / 2 - c.x * wu * c.z}px, ${H / 2 - c.y * wu * c.z}px) scale(${c.z * wu})`,
    transformOrigin: "0 0",
  };

  const inkProgress = interpolate(frame, [f(5.20), f(36.20)], [0.02, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.4, 1) });

  // speaker card: HOOK fullscreen → dock small → MECH fullscreen break → dock → hide near GO
  const spk = (() => {
    const kf: [number, number, number, number][] = [
      [f(0.00), 0.500, 0.500, 0.95],   // OPEN near-fullscreen — canvas peeks at the edges
      [f(4.70), 0.500, 0.500, 0.95],
      [f(5.60), 0.180, 0.760, 0.250],  // TURN: shrink → dock bottom-left, canvas reveals
      [f(17.30), 0.180, 0.760, 0.250], // hold docked through scope + first half of mech
      [f(17.95), 0.500, 0.500, 0.95],  // MECH BREAK: fullscreen again on "just talk and give it notes"
      [f(20.20), 0.500, 0.500, 0.95],
      [f(20.95), 0.165, 0.780, 0.210], // shrink as we dive to the economics
      [f(35.60), 0.165, 0.780, 0.210],
      [f(36.30), 0.140, 0.800, 0.150], // tuck away for the GO close
      [f(38.30), 0.140, 0.805, 0.150],
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
  const spkRadius = W * 0.010;

  return (
    <AbsoluteFill style={{ background: SILVER_BG, fontFamily: SANS }}>
      {/* parallaxed faded grid */}
      <AbsoluteFill style={{
        backgroundImage: `url("${GRID_URI}")`,
        backgroundSize: `${76 * wu * c.z}px`,
        backgroundPosition: `${W / 2 - c.x * wu * c.z}px ${H / 2 - c.y * wu * c.z}px`,
        maskImage: "radial-gradient(ellipse 80% 75% at 50% 40%, #000 0%, rgba(0,0,0,.35) 60%, transparent 92%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 75% at 50% 40%, #000 0%, rgba(0,0,0,.35) 60%, transparent 92%)",
      }} />

      {/* ================= THE WORLD ================= */}
      <div style={worldStyle}>
        <svg width={5600} height={2600} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <path d={PATH_D} fill="none" stroke={RAISIN} strokeWidth={5}
            strokeLinecap="round" strokeDasharray="14 10"
            strokeDashoffset={PATH_LEN * (1 - inkProgress)}
            opacity={0.5} pathLength={PATH_LEN} />
        </svg>

        <StationBuild at={f(5.55)} lineAt={f(6.30)} liveAt={f(7.55)} />
        <StationRawFinal at={f(9.70)} arrowAt={f(11.20)} finalAt={f(12.10)} />
        <StationNotes at={f(13.55)} killAt={f(14.60)} chatAt={f(16.40)} />
        <StationEconomics
          at={f(20.85)} zeroAt={f(23.20)} betterAt={f(26.30)}
          teaseAt={f(29.60)} crazyAt={f(33.75)} goAt={f(36.55)} />
      </div>

      {/* ================= SPEAKER (screen space, breaks to fullscreen) ================= */}
      {(() => {
        const hookBlur = interpolate(frame, [0, f(0.7)], [10, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
        const hookBright = interpolate(frame, [0, f(0.7)], [1.16, 1], { extrapolateRight: "clamp" });
        const hookScale = interpolate(frame, [0, f(2.4)], [1.09, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.3, 0, 0.4, 1) });
        const frameDraw = interpolate(frame, [f(0.30), f(1.45)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.5, 0, 0.2, 1) });
        const titleIn = interpolate(frame, [f(0.40), f(0.95)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
        const titleOut = interpolate(frame, [f(3.60), f(4.15)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const titleP = titleIn * titleOut;
        return (
          <div style={{
            position: "absolute",
            left: spk.x * W - spkW / 2, top: spk.y * H - spkH / 2, width: spkW, height: spkH,
            borderRadius: spkRadius, overflow: "hidden",
            boxShadow: `0 ${W * 0.006}px ${W * 0.02}px rgba(15,18,26,0.28), 0 0 0 1px rgba(15,18,26,0.10)`,
          }}>
            <OffthreadVideo src={staticFile("vedit/loopstudio_source.mp4")}
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                transform: `scale(${hookScale})`,
                filter: `contrast(1.05) saturate(1.06) brightness(${hookBright})${hookBlur > 0.1 ? ` blur(${hookBlur}px)` : ""}`,
              }} />
            {frame < f(4.3) && (
              <>
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "44%", background: "linear-gradient(to top, rgba(15,18,26,0.66), transparent)", opacity: titleP }} />
                <div style={{ position: "absolute", left: "5.2%", bottom: "8.5%", opacity: titleP, transform: `translateY(${(1 - titleIn) * W * 0.008}px)` }}>
                  <div style={{ fontFamily: MONO, fontSize: W * 0.0105, fontWeight: 700, letterSpacing: "0.26em", color: "rgba(255,255,255,0.74)", display: "flex", alignItems: "center", gap: W * 0.006 }}>
                    <span style={{ width: W * 0.006, height: W * 0.006, background: LIME, display: "inline-block" }} />
                    THE MASTERCLASS
                  </div>
                  <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: W * 0.033, color: "#fff", marginTop: W * 0.006, lineHeight: 1.1 }}>
                    how I edit <span style={{ color: LIME }}>every video</span>
                  </div>
                </div>
              </>
            )}
            {/* lime frame — draws on in the hook, stays for the whole video */}
            <svg width="100%" height="100%" viewBox={`0 0 ${spkW} ${spkH}`} preserveAspectRatio="none"
              style={{ position: "absolute", inset: 0 }}>
              <rect x={W * 0.0035} y={W * 0.0035} width={spkW - W * 0.007} height={spkH - W * 0.007}
                rx={spkRadius * 0.85} fill="none" stroke={LIME} strokeWidth={W * 0.0022}
                pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - frameDraw)} />
            </svg>
          </div>
        );
      })()}

      {/* fullscreen break chips — the note the skill acts on, on "just talk and give it notes" */}
      <FullscreenNotes />

      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 78% 70% at 50% 44%, transparent 60%, rgba(15,18,26,0.10) 100%)" }} />

      {/* white flash out on the button */}
      {frame >= f(37.55) && (
        <AbsoluteFill style={{ background: "#fff", opacity: interpolate(frame, [f(37.55), f(37.85), f(38.10)], [0, 0.9, 0.98], { extrapolateRight: "clamp" }) }} />
      )}

      {/* the VO carries throughout — the speaker OffthreadVideo is always mounted, so its
          audio plays even when the card is tiny. (No separate <Audio> needed.) */}

      {/* soft UI-grade cue set — timed to visual LANDINGS */}
      <SfxCue t={5.20} n="slide.wav" v={0.30} />
      <SfxCue t={7.55} n="tick.wav" v={0.40} />
      <SfxCue t={9.70} n="slide.wav" v={0.30} />
      <SfxCue t={11.20} n="tick_soft.wav" v={0.36} />
      <SfxCue t={12.10} n="tick.wav" v={0.42} />
      <SfxCue t={13.55} n="slide.wav" v={0.32} />
      <SfxCue t={14.60} n="tap.wav" v={0.42} />
      <SfxCue t={16.40} n="tick_soft.wav" v={0.38} />
      <SfxCue t={17.95} n="slide.wav" v={0.34} />
      <SfxCue t={20.85} n="slide.wav" v={0.34} />
      <SfxCue t={23.20} n="tick.wav" v={0.5} />
      <SfxCue t={26.30} n="tap.wav" v={0.5} />
      <SfxCue t={29.60} n="tick_soft.wav" v={0.34} />
      <SfxCue t={33.75} n="slide.wav" v={0.34} />
      <SfxCue t={34.30} n="tick.wav" v={0.4} />
      <SfxCue t={34.60} n="tick.wav" v={0.42} />
      <SfxCue t={34.90} n="tick.wav" v={0.45} />
      <SfxCue t={36.55} n="tap.wav" v={0.6} />
    </AbsoluteFill>
  );
};

const SfxCue: React.FC<{ t: number; n: string; v: number }> = ({ t, n, v }) => (
  <Sequence from={f(t)} durationInFrames={18}><Audio src={staticFile(`vedit/sfx/${n}`)} volume={v} /></Sequence>
);

/* ---------- shared ---------- */
const useIn = (at: number, dur = 16) => {
  const frame = useCurrentFrame();
  if (frame < at) return 0;
  return interpolate(frame, [at, at + dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
};

const NoteCard: React.FC<{ x: number; y: number; w: number; rot?: number; p: number; children: React.ReactNode; pad?: number; bg?: string }> =
  ({ x, y, w, rot = 0, p, children, pad = 26, bg = "#FFFFFF" }) => (
    <div style={{
      position: "absolute", left: x, top: y + (1 - p) * 26, width: w,
      background: bg, border: `1px solid ${SILVER_SOFT}`, borderRadius: 14,
      boxShadow: "0 2px 6px rgba(15,18,26,.07), 0 18px 38px -14px rgba(15,18,26,.22)",
      padding: pad, opacity: p, transform: `rotate(${rot}deg)`,
    }}>{children}</div>
  );

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: "0.2em", color: BODY, display: "flex", alignItems: "center", gap: 9, whiteSpace: "nowrap" }}>
    <span style={{ width: 8, height: 8, background: LIME, display: "inline-block" }} />
    {children}
  </div>
);

/* ---------- Station 1: THE REVEAL (turn) ---------- */
const StationBuild: React.FC<{ at: number; lineAt: number; liveAt: number }> = ({ at, lineAt, liveAt }) => {
  const p = useIn(at);
  const l1 = useIn(lineAt, 14);
  const l2 = useIn(lineAt + 12, 14);
  const live = useIn(liveAt, 10);
  return (
    <>
      <div style={{ position: "absolute", left: 120, top: 150, opacity: p }}><Tag>FIG. 01 · THE REVEAL</Tag></div>
      <div style={{ position: "absolute", left: 104, top: 200, width: 720, transform: "rotate(-1.4deg)" }}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 56, color: RAISIN, lineHeight: 1.22 }}>
          <span style={{ opacity: l1, display: "inline-block", transform: `translateY(${(1 - l1) * 16}px)` }}>this entire video —</span><br />
          <span style={{ opacity: l2, display: "inline-block", transform: `translateY(${(1 - l2) * 16}px)` }}>
            built <span style={{ background: LIME, padding: "0 12px", borderRadius: 6, fontStyle: "normal", fontFamily: SANS, fontWeight: 700, fontSize: 46 }}>live</span>, in front of you.
          </span>
        </div>
      </div>
      {/* live REC node on the ink */}
      <div style={{ position: "absolute", left: 600, top: 640, opacity: live, transform: `scale(${0.7 + 0.3 * live})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: RAISIN, color: "#fff", padding: "9px 16px", borderRadius: 999, fontFamily: MONO, fontSize: 20, fontWeight: 700, letterSpacing: "0.12em", boxShadow: "0 10px 26px -8px rgba(15,18,26,.5)" }}>
          <span style={{ width: 12, height: 12, borderRadius: 999, background: LIME }} /> REC · LIVE
        </div>
      </div>
    </>
  );
};

/* ---------- Station 2: RAW → FINAL (scope) ---------- */
const StationRawFinal: React.FC<{ at: number; arrowAt: number; finalAt: number }> = ({ at, arrowAt, finalAt }) => {
  const frame = useCurrentFrame();
  const p = useIn(at);
  const arrow = useIn(arrowAt, 12);
  const fin = useIn(finalAt, 14);
  // messy multi-take waveform for the raw card
  const bars = Array.from({ length: 46 });
  return (
    <>
      <div style={{ position: "absolute", left: 1300, top: 150, opacity: p }}><Tag>FIG. 02 · ONE RAW TAKE → DONE</Tag></div>
      {/* RAW file card */}
      <NoteCard x={1300} y={210} w={360} rot={-1.4} p={p} pad={22}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 42, borderRadius: 5, background: "#fff", border: `2px solid ${BODY}`, position: "relative" }}>
            <div style={{ position: "absolute", right: -1, top: -1, width: 12, height: 12, background: SILVER_BG, borderLeft: `2px solid ${BODY}`, borderBottom: `2px solid ${BODY}` }} />
          </div>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: RAISIN }}>raw-take.mp4</div>
            <div style={{ fontFamily: MONO, fontSize: 13, color: BODY, marginTop: 2 }}>4:18 · 12 takes · filler</div>
          </div>
        </div>
        <svg width={316} height={54} style={{ marginTop: 14 }}>
          {bars.map((_, i) => {
            const h = 6 + ((Math.sin(i * 1.7) + Math.sin(i * 0.6) + 2) / 4) * 40;
            return <rect key={i} x={i * 7} y={27 - h / 2} width={3.4} height={h} rx={1.6} fill={BODY} opacity={0.55} />;
          })}
        </svg>
      </NoteCard>
      {/* arrow */}
      <svg width={180} height={80} style={{ position: "absolute", left: 1690, top: 300, opacity: Math.min(arrow, 1), overflow: "visible" }}>
        <path d={`M 8 40 L ${8 + 150 * arrow} 40`} stroke={RAISIN} strokeWidth={6} strokeLinecap="round" />
        {arrow > 0.6 && <path d="M 150 26 L 172 40 L 150 54" fill="none" stroke={RAISIN} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />}
        <text x={40} y={26} fontFamily={MONO} fontSize={15} fontWeight={700} fill={BODY} letterSpacing="0.14em">CLAUDE</text>
      </svg>
      {/* FINAL card — a clean framed thumbnail with the lime keyline */}
      <div style={{ position: "absolute", left: 1900, top: 205, width: 400, opacity: fin, transform: `translateY(${(1 - fin) * 22}px) rotate(1deg)` }}>
        <div style={{ position: "relative", width: 400, height: 225, borderRadius: 12, overflow: "hidden", background: RAISIN, boxShadow: "0 18px 40px -12px rgba(15,18,26,.4)", border: `2px solid ${LIME}` }}>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${RAISIN}, #1a2030 60%, #232b40)` }} />
          <div style={{ position: "absolute", left: 18, top: 16, fontFamily: MONO, fontSize: 14, fontWeight: 700, letterSpacing: "0.16em", color: LIME }}>FINAL · 0:38</div>
          <div style={{ position: "absolute", left: 18, bottom: 16, fontFamily: SERIF, fontStyle: "italic", fontSize: 30, color: "#fff" }}>the fully edited video</div>
          {/* play glyph */}
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 60, height: 60, borderRadius: 999, background: "rgba(255,255,255,0.14)", border: "2px solid rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 0, height: 0, borderLeft: "18px solid #fff", borderTop: "11px solid transparent", borderBottom: "11px solid transparent", marginLeft: 5 }} />
          </div>
        </div>
      </div>
    </>
  );
};

/* ---------- Station 3: NO TIMELINE · JUST NOTES (mechanism) ---------- */
const StationNotes: React.FC<{ at: number; killAt: number; chatAt: number }> = ({ at, killAt, chatAt }) => {
  const frame = useCurrentFrame();
  const p = useIn(at);
  const kill = useIn(killAt, 12);
  const strike = interpolate(frame, [killAt + 6, killAt + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const chat = useIn(chatAt, 14);
  const typed = interpolate(frame, [chatAt + 6, chatAt + 44], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const noteText = "› tighten the intro, add b-roll on 'raw take'";
  const shown = noteText.slice(0, Math.round(noteText.length * typed));
  const TRACKS = [0, 1, 2];
  return (
    <>
      <div style={{ position: "absolute", left: 2360, top: 150, opacity: p }}><Tag>FIG. 03 · NO EDITOR. NO TIMELINE.</Tag></div>
      {/* the timeline I never touch — struck out */}
      <div style={{ position: "absolute", left: 2360, top: 205, width: 470, opacity: kill }}>
        <div style={{ background: "#fff", border: `1px solid ${SILVER_SOFT}`, borderRadius: 12, padding: 16, boxShadow: "0 14px 32px -14px rgba(15,18,26,.22)", position: "relative" }}>
          <div style={{ fontFamily: MONO, fontSize: 13, color: BODY, letterSpacing: "0.14em", marginBottom: 10 }}>TIMELINE</div>
          {TRACKS.map((t) => (
            <div key={t} style={{ display: "flex", gap: 6, marginBottom: 7 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: 16, flex: (i % 3) + 1, borderRadius: 3, background: t === 0 ? "#C7CDD0" : "#D8DDDF" }} />
              ))}
            </div>
          ))}
          {/* big diagonal strike */}
          <svg style={{ position: "absolute", inset: 0 }} width="100%" height="100%" viewBox="0 0 470 118" preserveAspectRatio="none">
            <line x1={18} y1={104} x2={18 + (452) * strike} y2={104 - 90 * strike} stroke={RAISIN} strokeWidth={7} strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 26, color: BODY, marginTop: 12, opacity: strike }}>
          I never touch this.
        </div>
      </div>
      {/* what I do instead — a Claude chat note */}
      <div style={{ position: "absolute", left: 2360, top: 470, width: 560, opacity: chat, transform: `translateY(${(1 - chat) * 22}px)` }}>
        <div style={{ background: RAISIN, borderRadius: 14, padding: "16px 18px", boxShadow: "0 18px 42px -14px rgba(15,18,26,.5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <img src={staticFile("vedit/claude.png")} style={{ width: 26, height: 26, objectFit: "contain" }} />
            <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: "0.12em", color: "rgba(255,255,255,0.66)" }}>~/.claude · loop-studio</span>
            <span style={{ marginLeft: "auto", width: 9, height: 9, borderRadius: 999, background: LIME }} />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 24, color: "#fff", lineHeight: 1.35, minHeight: 34 }}>
            {shown}<span style={{ opacity: frame % 16 < 8 ? 1 : 0, color: LIME }}>▋</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 17, color: LIME, marginTop: 12, opacity: typed > 0.98 ? 1 : 0 }}>
            ✓ done — re-rendered.
          </div>
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 26, color: RAISIN, marginTop: 14 }}>
          I just <span style={{ background: LIME, padding: "0 10px", borderRadius: 6, fontStyle: "normal", fontFamily: SANS, fontWeight: 700, fontSize: 24 }}>talk</span> and give it notes.
        </div>
      </div>
    </>
  );
};

/* ---------- fullscreen break — the note chip on "just talk and give it notes" ---------- */
const FullscreenNotes: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const on = frame >= f(18.05) && frame <= f(20.25);
  const pLogo = useIn(f(18.35), 14);
  const pNote = useIn(f(18.95), 12);
  const segOut = interpolate(frame, [f(20.00), f(20.25)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (!on) return null;
  const typed = interpolate(frame, [f(19.05), f(19.95)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const note = "just talk. give it notes.";
  const shown = note.slice(0, Math.round(note.length * typed));
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 0.34 * H, background: "linear-gradient(to top, rgba(15,18,26,0.62), transparent)", opacity: pLogo * segOut }} />
      {/* skill lockup, bottom-left */}
      <div style={{ position: "absolute", left: 0.055 * W, top: 0.815 * H, display: "flex", alignItems: "center", gap: W * 0.014, opacity: pLogo * segOut, transform: `translateY(${(1 - pLogo) * W * 0.02}px)` }}>
        <div style={{ width: W * 0.05, height: W * 0.05, background: "#fff", borderRadius: W * 0.012, border: `1px solid ${SILVER_SOFT}`, boxShadow: "0 10px 30px rgba(15,18,26,.45)", display: "flex", alignItems: "center", justifyContent: "center", transform: `rotate(${-3 - (1 - pLogo) * 100}deg)` }}>
          <img src={staticFile("vedit/claude.png")} style={{ width: "66%", height: "66%", objectFit: "contain" }} />
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: W * 0.0095, fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.68)" }}>~/.claude/skills/</div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: W * 0.019, color: "#fff", letterSpacing: "-0.01em", marginTop: W * 0.002 }}>loop-studio<span style={{ color: LIME }}>_</span></div>
        </div>
      </div>
      {/* the note chip, bottom-right — types as he speaks */}
      <div style={{ position: "absolute", right: 0.055 * W, top: 0.828 * H, display: "flex", alignItems: "center", gap: W * 0.009, opacity: pNote * segOut, transform: `translateY(${(1 - pNote) * W * 0.010}px)` }}>
        <span style={{ fontFamily: MONO, fontSize: W * 0.014, fontWeight: 700, color: LIME }}>›</span>
        <span style={{ fontFamily: MONO, fontSize: W * 0.014, fontWeight: 700, color: "#fff" }}>{shown}<span style={{ opacity: frame % 16 < 8 ? 1 : 0, color: LIME }}>▋</span></span>
      </div>
    </>
  );
};

/* ---------- Station 4: THE ECONOMICS (cost → better → tease → crazy → GO) ---------- */
const StationEconomics: React.FC<{ at: number; zeroAt: number; betterAt: number; teaseAt: number; crazyAt: number; goAt: number }> =
  ({ at, zeroAt, betterAt, teaseAt, crazyAt, goAt }) => {
    const frame = useCurrentFrame();
    const p = useIn(at);
    const zero = useIn(zeroAt, 12);
    const strike = interpolate(frame, [zeroAt - 6, zeroAt + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
    const better = useIn(betterAt, 10);
    const tease = useIn(teaseAt, 14);
    const grey = interpolate(frame, [teaseAt, teaseAt + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    const crazy = useIn(crazyAt, 12);
    const go = useIn(goAt, 10);
    const X0 = 2760, Y0 = 1300;
    // hockey-stick curve for "crazy"
    const curveP = interpolate(frame, [crazyAt + 4, crazyAt + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
    return (
      <>
        <div style={{ position: "absolute", left: X0, top: Y0, opacity: p }}><Tag>FIG. 04 · THE ECONOMICS</Tag></div>

        {/* the ledger card */}
        <NoteCard x={X0} y={Y0 + 48} w={560} rot={-0.8} p={p} pad={30}>
          {/* $2,000 / mo — struck, then greyed on the tease */}
          <div style={{ position: "relative", display: "inline-block", opacity: 1 - grey * 0.55 }}>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 88, letterSpacing: "-0.03em", color: `rgb(${90 + grey * 40}, ${96 + grey * 40}, ${104 + grey * 40})` }}>
              $2,000<span style={{ fontSize: 40, color: BODY }}> /mo</span>
            </span>
            <span style={{ position: "absolute", left: "-2%", top: "54%", height: 7, width: `${strike * 104}%`, background: LIME, borderRadius: 4 }} />
          </div>
          {/* → $0 */}
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 14, opacity: zero }}>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: BODY }}>now</span>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 88, letterSpacing: "-0.03em", color: RAISIN, background: LIME, padding: "0 18px", borderRadius: 10 }}>$0</span>
            <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 26, color: BODY }}>only cloud credits.</span>
          </div>
          {/* honestly, better — stamp */}
          <div style={{ marginTop: 20, opacity: better, transform: `rotate(-3deg) scale(${0.8 + 0.2 * better})`, transformOrigin: "left center", display: "inline-block" }}>
            <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, color: RAISIN, border: `3px solid ${RAISIN}`, borderRadius: 8, padding: "4px 14px", letterSpacing: "0.02em" }}>
              AND honestly? <span style={{ color: RAISIN, background: LIME, padding: "0 8px", borderRadius: 4 }}>BETTER.</span>
            </span>
          </div>
        </NoteCard>

        {/* TEASE label — points off to something bigger */}
        <div style={{ position: "absolute", left: X0 + 590, top: Y0 + 70, width: 420, opacity: tease, transform: `translateX(${(1 - tease) * 20}px)` }}>
          <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: "0.18em", color: BODY }}>↑ THE LEAST INTERESTING PART</div>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 40, color: RAISIN, marginTop: 8, lineHeight: 1.15 }}>
            the real story is the <span style={{ background: LIME, padding: "0 10px", borderRadius: 6, fontStyle: "normal", fontFamily: SANS, fontWeight: 700 }}>economics.</span>
          </div>
        </div>

        {/* CRAZY curve — hockey stick */}
        <svg width={520} height={300} style={{ position: "absolute", left: X0 + 40, top: Y0 + 360, overflow: "visible", opacity: crazy }}>
          <line x1={10} y1={260} x2={10} y2={20} stroke={BODY} strokeWidth={3} opacity={0.5} />
          <line x1={10} y1={260} x2={480} y2={260} stroke={BODY} strokeWidth={3} opacity={0.5} />
          <path d="M 10 250 C 120 245, 230 235, 320 195 C 400 160, 450 70, 480 20"
            fill="none" stroke={RAISIN} strokeWidth={7} strokeLinecap="round"
            pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - curveP)} />
          <circle cx={480} cy={20} r={11} fill={LIME} opacity={curveP > 0.9 ? 1 : 0} />
        </svg>
        <div style={{ position: "absolute", left: X0 + 70, top: Y0 + 300, opacity: crazy, fontFamily: SANS, fontWeight: 700, fontSize: 40, color: RAISIN }}>
          the economics are <span style={{ color: RAISIN, background: LIME, padding: "0 10px", borderRadius: 6 }}>crazy.</span>
        </div>

        {/* GO — big serif, camera pushes into it */}
        <div style={{ position: "absolute", left: X0 - 40, top: Y0 + 720, width: 1100, whiteSpace: "nowrap", textAlign: "center", opacity: go, transform: `scale(${0.7 + 0.3 * go}) rotate(-1.5deg)`, transformOrigin: "center" }}>
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 104, color: RAISIN }}>
            so — <span style={{ background: LIME, padding: "0 22px", borderRadius: 12, fontStyle: "normal", fontFamily: SANS, fontWeight: 700 }}>let&apos;s dive in</span> →
          </span>
        </div>
      </>
    );
  };

export default LoopStudioIntro;

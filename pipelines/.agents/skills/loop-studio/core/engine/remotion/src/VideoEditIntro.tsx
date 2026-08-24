/**
 * VideoEditIntro v2 — revised per Luuk (2026-07-02):
 *  · Camera NEVER rests: slow push through the claim, micro-drift on every hold
 *  · Cluster redesigned as a clean diagonal cascade; main ink path routed BELOW it
 *  · "saving me hours and money" BREAKS OUT to full-screen speaker + overlay chips
 *    (canvas → fullscreen → canvas rhythm)
 *  · Zoom-out recap REPLACED: camera dives DOWN into a dedicated workflow canvas —
 *    RECORD → CUT → B-ROLL → FINISH stamp in on "step by step"
 */
import React from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
} from "remotion";

const FPS = 30;
const f = (sec: number) => Math.round(sec * FPS);

const RAISIN = "#0F121A";
const SILVER_BG = "#E9ECED";
const SILVER_SOFT = "#D2D8DA";
const BODY = "#5A6068";
const LIME = "#CFFF05";
const SANS = "'Space Grotesk', 'Helvetica Neue', sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";
const SERIF = "'Playfair Display', Georgia, serif";

// ---------------- world camera (never static — every hold drifts) ----------------
const CAM: [number, number, number, number][] = [
  [f(0.00), 460, 570, 1.00],    // claim: slow push-in the whole time
  [f(3.15), 525, 545, 1.14],
  [f(4.10), 1400, 520, 1.04],   // glide → 200 hours, then keep creeping
  [f(6.00), 1445, 508, 1.09],
  [f(6.99), 2620, 470, 0.92],   // glide → cluster top, then drift DOWN the zigzag
  [f(12.50), 2665, 700, 0.98],
  [f(13.08), 2900, 700, 0.90],  // (behind the fullscreen break) begin descending
  [f(17.50), 3150, 1250, 0.74],
  [f(19.00), 3280, 1690, 0.60], // the workflow canvas, framed
  [f(23.58), 3325, 1730, 0.665], // one continuous creep to the end — the big GO text carries the close
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

// ink path: claim → hours → UNDER the cluster → dive down → across the workflow row
const PATH_D =
  "M 630 700 C 900 800, 1050 560, 1290 560 " +
  "C 1700 560, 1950 380, 2330 380 " +          // → into the cluster, top card
  "C 2650 385, 2800 500, 2830 620 " +          // S down behind SYSTEMS
  "C 2850 760, 2700 850, 2520 860 " +          // → behind TRICK
  "C 2900 950, 3300 1080, 3380 1330 " +        // dive
  "C 3450 1540, 2750 1590, 2280 1710";         // arrive just left of the row, clear of the title
const PATH_LEN = 6200;

const GRID_URI = (() => {
  const s = 76;
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'><path d='M ${s} 0 L 0 0 0 ${s}' fill='none' stroke='rgba(15,18,26,0.10)' stroke-width='1'/></svg>`
    )
  );
})();

export const VideoEditIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const wu = W / 1920;
  const c0 = cam(frame);
  // constant micro-drift so no frame is ever still
  const c = { x: c0.x + Math.sin(frame / 38) * 5, y: c0.y + Math.cos(frame / 47) * 4, z: c0.z };

  const worldStyle: React.CSSProperties = {
    position: "absolute", left: 0, top: 0, width: 0, height: 0,
    transform: `translate(${W / 2 - c.x * wu * c.z}px, ${H / 2 - c.y * wu * c.z}px) scale(${c.z * wu})`,
    transformOrigin: "0 0",
  };

  const inkProgress = interpolate(frame, [f(0.45), f(19.49)], [0.03, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.4, 0, 0.4, 1) });

  // speaker card: claim (large) → corner → FULLSCREEN break (13.2–17.8) → small corner
  const spk = (() => {
    const kf: [number, number, number, number][] = [
      [f(0.00), 0.500, 0.500, 0.94],    // OPEN near-fullscreen — canvas peeking at the edges
      [f(1.99), 0.500, 0.500, 0.94],
      [f(3.15), 0.660, 0.585, 0.400],   // shrink → the claim reveals
      [f(4.10), 0.175, 0.740, 0.240],
      [f(12.68), 0.175, 0.740, 0.240],
      [f(13.38), 0.500, 0.500, 0.94],   // BREAK: near-fullscreen again, rounded
      [f(17.30), 0.500, 0.500, 0.94],
      [f(18.18), 0.150, 0.780, 0.200],  // shrink as we dive
      [f(23.58), 0.150, 0.785, 0.200],
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
  const spkRadius = W * 0.010; // always rounded — canvas peeks at the edges even when near-fullscreen

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
        <svg width={5600} height={2400} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
          <path d={PATH_D} fill="none" stroke={RAISIN} strokeWidth={5}
            strokeLinecap="round" strokeDasharray="14 10"
            strokeDashoffset={PATH_LEN * (1 - inkProgress)}
            opacity={0.55} pathLength={PATH_LEN} />
        </svg>

        <StationClaim at={f(2.35)} />
        <StationHours at={f(3.60)} />
        <StationTested at={f(6.30)} sAt={f(7.29)} yAt={f(8.99)} tAt={f(11.40)} />
        <StationWorkflow at={f(18.28)} stepAt={f(20.39)} realAt={f(21.60)} goAt={f(22.68)} />
      </div>

      {/* ================= SPEAKER (screen space, breaks to fullscreen) ================= */}
      {(() => {
        // hook treatment (first 2s): defocus-to-focus + slow Ken Burns settle
        const hookBlur = interpolate(frame, [0, f(0.7)], [9, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
        const hookBright = interpolate(frame, [0, f(0.7)], [1.14, 1], { extrapolateRight: "clamp" });
        const hookScale = interpolate(frame, [0, f(2.1)], [1.085, 1], { extrapolateRight: "clamp", easing: Easing.bezier(0.3, 0, 0.4, 1) });
        // lime frame draws on in the hook, then stays for the whole video
        const frameDraw = interpolate(frame, [f(0.25), f(1.35)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.5, 0, 0.2, 1) });
        // on-video film-title lockup
        const titleIn = interpolate(frame, [f(0.35), f(0.85)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
        const titleOut = interpolate(frame, [f(1.65), f(2.05)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const titleP = titleIn * titleOut;
        return (
          <div style={{
            position: "absolute",
            left: spk.x * W - spkW / 2, top: spk.y * H - spkH / 2, width: spkW, height: spkH,
            borderRadius: spkRadius, overflow: "hidden",
            boxShadow: `0 ${W * 0.006}px ${W * 0.02}px rgba(15,18,26,0.28), 0 0 0 1px rgba(15,18,26,0.10)`,
          }}>
            <OffthreadVideo src={staticFile("vedit/source.mp4")}
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                transform: `scale(${hookScale})`,
                filter: `contrast(1.05) saturate(1.06) brightness(${hookBright})${hookBlur > 0.1 ? ` blur(${hookBlur}px)` : ""}`,
              }} />
            {frame < f(2.4) && (
              <>
                {/* bottom scrim for the title */}
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "42%", background: "linear-gradient(to top, rgba(15,18,26,0.62), transparent)", opacity: titleP }} />
                {/* film-title lockup */}
                <div style={{ position: "absolute", left: "5.2%", bottom: "8.5%", opacity: titleP, transform: `translateY(${(1 - titleIn) * W * 0.008}px)` }}>
                  <div style={{ fontFamily: MONO, fontSize: W * 0.0105, fontWeight: 700, letterSpacing: "0.26em", color: "rgba(255,255,255,0.72)", display: "flex", alignItems: "center", gap: W * 0.006 }}>
                    <span style={{ width: W * 0.006, height: W * 0.006, background: LIME, display: "inline-block" }} />
                    THE MASTERCLASS
                  </div>
                  <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: W * 0.032, color: "#fff", marginTop: W * 0.006, lineHeight: 1.1 }}>
                    how I edit <span style={{ color: LIME }}>every video</span>
                  </div>
                </div>
              </>
            )}
            {/* lime frame — draws on in the hook, stays for the whole video (incl. fullscreen break) */}
            <svg width="100%" height="100%" viewBox={`0 0 ${spkW} ${spkH}`} preserveAspectRatio="none"
              style={{ position: "absolute", inset: 0 }}>
              <rect x={W * 0.0035} y={W * 0.0035} width={spkW - W * 0.007} height={spkH - W * 0.007}
                rx={spkRadius * 0.85} fill="none" stroke={LIME} strokeWidth={W * 0.0022}
                pathLength={100} strokeDasharray={100} strokeDashoffset={100 * (1 - frameDraw)} />
            </svg>
          </div>
        );
      })()}

      {/* fullscreen overlay chips — land on "hours" and "money" */}
      <FullscreenChips />

      <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse 78% 70% at 50% 44%, transparent 60%, rgba(15,18,26,0.10) 100%)" }} />

      {frame >= f(23.28) && (
        <AbsoluteFill style={{ background: "#fff", opacity: interpolate(frame, [f(23.28), f(23.46), f(23.58)], [0, 0.85, 0.95], { extrapolateRight: "clamp" }) }} />
      )}

      {/* soft audio cues */}
      {/* UI-grade cue set — timed to visual LANDINGS, not pop-starts */}
      <Sequence from={f(2.13)} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.28} /></Sequence>
      <Sequence from={f(2.73)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.42} /></Sequence>
      <Sequence from={f(3.22)} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.3} /></Sequence>
      <Sequence from={f(3.40)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.35} /></Sequence>
      <Sequence from={f(4.00)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.45} /></Sequence>
      {/* tally counting — one soft tick per tally group */}
      <Sequence from={f(4.20)} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.24} /></Sequence>
      <Sequence from={f(4.42)} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.24} /></Sequence>
      <Sequence from={f(4.64)} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.24} /></Sequence>
      <Sequence from={f(4.86)} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.24} /></Sequence>
      <Sequence from={f(5.08)} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.26} /></Sequence>
      <Sequence from={f(6.10)} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.3} /></Sequence>
      <Sequence from={f(7.64)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.42} /></Sequence>
      <Sequence from={f(9.34)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.4} /></Sequence>
      <Sequence from={f(11.75)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.4} /></Sequence>
      <Sequence from={f(12.78)} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.32} /></Sequence>
      <Sequence from={f(14.20)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick_soft.wav")} volume={0.34} /></Sequence>
      <Sequence from={f(16.21)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.4} /></Sequence>
      <Sequence from={f(17.10)} durationInFrames={10}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.4} /></Sequence>
      <Sequence from={f(18.18)} durationInFrames={20}><Audio src={staticFile("vedit/sfx/slide.wav")} volume={0.34} /></Sequence>
      <Sequence from={f(20.60)} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.45} /></Sequence>
      <Sequence from={f(20.83)} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.45} /></Sequence>
      <Sequence from={f(21.05)} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.45} /></Sequence>
      <Sequence from={f(21.28)} durationInFrames={8}><Audio src={staticFile("vedit/sfx/tick.wav")} volume={0.48} /></Sequence>
      <Sequence from={f(22.93)} durationInFrames={15}><Audio src={staticFile("vedit/sfx/tap.wav")} volume={0.6} /></Sequence>
    </AbsoluteFill>
  );
};

/* ---------- shared ---------- */
const useIn = (at: number, dur = 16) => {
  const frame = useCurrentFrame();
  if (frame < at) return 0;
  return interpolate(frame, [at, at + dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
};

const NoteCard: React.FC<{ x: number; y: number; w: number; rot?: number; p: number; children: React.ReactNode; pad?: number }> =
  ({ x, y, w, rot = 0, p, children, pad = 26 }) => (
    <div style={{
      position: "absolute", left: x, top: y + (1 - p) * 26, width: w,
      background: "#FFFFFF", border: `1px solid ${SILVER_SOFT}`, borderRadius: 12,
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

/* ---------- Station: THE CLAIM (staggered write-on) ---------- */
const StationClaim: React.FC<{ at: number }> = ({ at }) => {
  const l1 = useIn(at, 14);
  const l2 = useIn(at + 10, 14);
  const st = useIn(at + 26, 12);
  return (
    <>
      <div style={{ position: "absolute", left: 76, top: 100, opacity: l1 }}><Tag>FIG. 01 · THE CLAIM</Tag></div>
      <div style={{ position: "absolute", left: 60, top: 150, width: 780, transform: "rotate(-1.5deg)" }}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 54, color: RAISIN, lineHeight: 1.25 }}>
          <span style={{ opacity: l1, display: "inline-block", transform: `translateY(${(1 - l1) * 16}px)` }}>this intro was edited</span><br />
          <span style={{ opacity: l2, display: "inline-block", transform: `translateY(${(1 - l2) * 16}px)` }}>
            by <span style={{ background: LIME, padding: "0 12px", borderRadius: 6 }}>one Claude skill</span>
          </span>
        </div>
      </div>
      <div style={{ position: "absolute", left: 700, top: 150, width: 84, height: 84, opacity: st, transform: `rotate(${6 - (1 - st) * 20}deg) scale(${0.6 + 0.4 * st})` }}>
        <div style={{ width: "100%", height: "100%", background: "#fff", borderRadius: 20, border: `1px solid ${SILVER_SOFT}`, boxShadow: "0 6px 18px rgba(15,18,26,.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={staticFile("vedit/claude.png")} style={{ width: "68%", height: "68%", objectFit: "contain" }} />
        </div>
      </div>
    </>
  );
};

/* ---------- Station: 200 HOURS ---------- */
const StationHours: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  const p = useIn(at);
  const count = Math.round(interpolate(frame, [at + 4, at + 40], [0, 200], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }));
  const tallies = Math.round(interpolate(frame, [at + 6, at + 46], [0, 24], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <>
      <div style={{ position: "absolute", left: 1180, top: 300, opacity: p }}><Tag>FIG. 02 · THE GRIND</Tag></div>
      <NoteCard x={1170} y={350} w={460} rot={0.8} p={p}>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 120, letterSpacing: "-0.04em", color: RAISIN, lineHeight: 1 }}>
          {count}<span style={{ color: BODY, fontSize: 46, fontWeight: 700, marginLeft: 10 }}>hours</span>
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 26, color: BODY, marginTop: 10 }}>building one skill.</div>
        <svg width={400} height={64} style={{ marginTop: 18 }}>
          {Array.from({ length: tallies }).map((_, i) => {
            const g = Math.floor(i / 5), k = i % 5;
            const x0 = 8 + g * 78 + (k < 4 ? k * 14 : 0);
            return k < 4
              ? <line key={i} x1={x0} y1={10} x2={x0 + 3} y2={52} stroke={RAISIN} strokeWidth={4.5} strokeLinecap="round" opacity={0.8} />
              : <line key={i} x1={8 + g * 78 - 6} y1={44} x2={8 + g * 78 + 3 * 14 + 9} y2={16} stroke={LIME} strokeWidth={6} strokeLinecap="round" />;
          })}
        </svg>
      </NoteCard>
    </>
  );
};

/* ---------- Station: TESTED EVERYTHING (clean diagonal cascade) ---------- */
const StationTested: React.FC<{ at: number; sAt: number; yAt: number; tAt: number }> = ({ at, sAt, yAt, tAt }) => {
  const p0 = useIn(at);
  const p1 = useIn(sAt); const p2 = useIn(yAt); const p3 = useIn(tAt);
  return (
    <>
      <div style={{ position: "absolute", left: 2370, top: 225, opacity: p0 }}><Tag>FIG. 03 · TESTED EVERYTHING</Tag></div>
      {/* flowing S-connectors down the zigzag */}
      <svg width={1200} height={800} style={{ position: "absolute", left: 2300, top: 260, overflow: "visible" }}>
        <path d="M 240 210 C 300 280, 420 250, 480 300" fill="none" stroke={BODY} strokeWidth={3.5} strokeDasharray="9 8" strokeLinecap="round" opacity={0.6 * Math.min(p2, 1)} />
        <path d="M 470 450 C 420 520, 300 500, 250 545" fill="none" stroke={BODY} strokeWidth={3.5} strokeDasharray="9 8" strokeLinecap="round" opacity={0.6 * Math.min(p3, 1)} />
      </svg>

      <NoteCard x={2350} y={290} w={330} rot={-1.2} p={p1} pad={22}>
        <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.18em", color: BODY }}>A/B</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: RAISIN, marginTop: 4 }}>STRATEGIES</div>
        <svg width={270} height={54} style={{ marginTop: 10 }}>
          <path d="M 8 40 C 60 40, 60 14, 120 14 M 8 14 C 70 14, 80 42, 130 42" fill="none" stroke={BODY} strokeWidth={3.5} strokeLinecap="round" opacity={0.7} />
          <path d="M 160 28 L 250 28" stroke={LIME} strokeWidth={5} strokeLinecap="round" />
          <path d="M 238 18 L 252 28 L 238 38" fill="none" stroke={LIME} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </NoteCard>
      <NoteCard x={2660} y={520} w={330} rot={1.0} p={p2} pad={22}>
        <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.18em", color: BODY }}>PIPELINES</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: RAISIN, marginTop: 4 }}>SYSTEMS</div>
        <svg width={270} height={54} style={{ marginTop: 10 }}>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={10 + i * 92} y={14} width={62} height={30} rx={6} fill="none" stroke={i === 2 ? LIME : BODY} strokeWidth={3.5} opacity={i === 2 ? 1 : 0.7} />
          ))}
          <path d="M 74 29 L 100 29 M 166 29 L 192 29" stroke={BODY} strokeWidth={3.5} opacity={0.7} />
        </svg>
      </NoteCard>
      <NoteCard x={2400} y={755} w={340} rot={-0.8} p={p3} pad={22}>
        <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: "0.18em", color: BODY }}>EVERY SINGLE</div>
        <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 34, color: RAISIN, marginTop: 4 }}>
          TRICK <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, color: BODY, fontSize: 26 }}>I could find.</span>
        </div>
      </NoteCard>
    </>
  );
};

/* ---------- fullscreen break — Claude-skill lockup rolls in, stats land on "hours"/"money" ---------- */
const FullscreenChips: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const on = frame >= f(13.58) && frame <= f(17.45);
  const pLogo = useIn(f(13.90), 16);
  const pA = useIn(f(15.93), 12);
  const pB = useIn(f(16.83), 12);
  if (!on) return null;
  const CS = W * 0.026; // clock size
  // clock hand sweeps BACKWARD (time coming back)
  const hand = interpolate(frame, [f(15.98), f(17.40)], [0, -300], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const strike = interpolate(frame, [f(16.88), f(17.30)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const segOut = interpolate(frame, [f(17.20), f(17.45)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      {/* bottom scrim so the type reads over the footage */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 0.34 * H, background: "linear-gradient(to top, rgba(15,18,26,0.60), transparent)", opacity: pLogo * segOut }} />

      {/* Claude-skill lockup — sticker rolls in on "CloudSkill" */}
      <div style={{
        position: "absolute", left: 0.055 * W, top: 0.815 * H,
        display: "flex", alignItems: "center", gap: W * 0.014,
        opacity: pLogo * segOut, transform: `translateY(${(1 - pLogo) * W * 0.02}px)`,
      }}>
        <div style={{
          width: W * 0.052, height: W * 0.052, background: "#fff", borderRadius: W * 0.012,
          border: `1px solid ${SILVER_SOFT}`, boxShadow: "0 10px 30px rgba(15,18,26,.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: `rotate(${-3 - (1 - pLogo) * 100}deg)`,
        }}>
          <img src={staticFile("vedit/claude.png")} style={{ width: "66%", height: "66%", objectFit: "contain" }} />
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: W * 0.0095, fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.68)" }}>~/.claude/skills/</div>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: W * 0.019, color: "#fff", letterSpacing: "-0.01em", marginTop: W * 0.002 }}>
            video-edit<span style={{ color: LIME }}>_</span>
          </div>
        </div>
      </div>

      {/* stat lines — right side, unboxed, land on the words */}
      <div style={{
        position: "absolute", right: 0.055 * W, top: 0.805 * H,
        display: "flex", alignItems: "center", gap: W * 0.010, whiteSpace: "nowrap",
        opacity: pA * segOut, transform: `translateY(${(1 - pA) * W * 0.010}px)`,
      }}>
        <svg width={CS} height={CS} viewBox="0 0 100 100">
          <circle cx={50} cy={50} r={44} fill="none" stroke="#fff" strokeWidth={7} opacity={0.9} />
          <line x1={50} y1={50} x2={50 + 30 * Math.sin((hand * Math.PI) / 180)} y2={50 - 30 * Math.cos((hand * Math.PI) / 180)}
            stroke="#fff" strokeWidth={7} strokeLinecap="round" opacity={0.9} />
          <line x1={50} y1={50} x2={50 + 20 * Math.sin(((hand / 12) * Math.PI) / 180)} y2={50 - 20 * Math.cos(((hand / 12) * Math.PI) / 180)}
            stroke={LIME} strokeWidth={8} strokeLinecap="round" />
          <circle cx={50} cy={50} r={5} fill="#fff" />
        </svg>
        <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: W * 0.021, color: "#fff" }}>
          hours <span style={{ color: LIME }}>back.</span>
        </span>
      </div>
      <div style={{
        position: "absolute", right: 0.055 * W, top: 0.868 * H,
        display: "flex", alignItems: "center", gap: W * 0.008, whiteSpace: "nowrap",
        opacity: pB * segOut, transform: `translateY(${(1 - pB) * W * 0.010}px)`,
      }}>
        <span style={{ position: "relative", fontFamily: SANS, fontWeight: 700, fontSize: W * 0.018, color: "rgba(255,255,255,0.85)" }}>
          $35/min
          <span style={{ position: "absolute", left: "-3%", top: "52%", height: W * 0.0032, width: `${strike * 106}%`, background: LIME, borderRadius: 4 }} />
        </span>
        <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: W * 0.018, color: "rgba(255,255,255,0.7)", opacity: strike }}>→</span>
        <span style={{
          fontFamily: SANS, fontWeight: 700, fontSize: W * 0.020, color: RAISIN,
          background: LIME, padding: `0 ${W * 0.006}px`, borderRadius: W * 0.003,
          opacity: strike, transform: `scale(${0.85 + 0.15 * strike})`, display: "inline-block",
        }}>$0</span>
      </div>
    </>
  );
};

/* ---------- Station: THE WORKFLOW (dedicated canvas below) ---------- */
const StationWorkflow: React.FC<{ at: number; stepAt: number; realAt: number; goAt: number }> = ({ at, stepAt, realAt, goAt }) => {
  const p = useIn(at);
  const STEPS = ["RECORD", "CUT", "B-ROLL", "FINISH"];
  const s0 = useIn(stepAt, 9);
  const s1 = useIn(stepAt + 7, 9);
  const s2 = useIn(stepAt + 14, 9);
  const s3 = useIn(stepAt + 21, 9);
  const sp = [s0, s1, s2, s3];
  const real = useIn(realAt, 12);
  const goP = useIn(goAt, 10);
  const TILE_W = 400, TILE_H = 150, GAP = 96, X0 = 2350, Y0 = 1600;
  return (
    <>
      <div style={{ position: "absolute", left: X0 + 6, top: Y0 - 120, opacity: p }}><Tag>FIG. 04 · THE EXACT WORKFLOW</Tag></div>
      <div style={{ position: "absolute", left: X0, top: Y0 - 78, opacity: p, fontFamily: SANS, fontWeight: 700, fontSize: 44, color: RAISIN, whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
        the exact workflow<span style={{ color: BODY }}>,</span> <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, color: BODY }}>step by step.</span>
      </div>
      {STEPS.map((st, i) => {
        const x = X0 + i * (TILE_W + GAP);
        const pI = sp[i];
        return (
          <React.Fragment key={st}>
            <div style={{
              position: "absolute", left: x, top: Y0 + (1 - pI) * 22, width: TILE_W, height: TILE_H,
              background: i === 3 ? LIME : RAISIN, borderRadius: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 14px 34px -10px rgba(15,18,26,.35)",
              opacity: pI,
            }}>
              <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 44, letterSpacing: "0.02em", color: i === 3 ? RAISIN : "#fff" }}>{st}</span>
              <span style={{ position: "absolute", left: 14, top: 10, fontFamily: MONO, fontSize: 17, color: i === 3 ? "rgba(15,18,26,.6)" : "rgba(255,255,255,.5)" }}>0{i + 1}</span>
            </div>
            {i < 3 && (
              <svg width={GAP} height={40} style={{ position: "absolute", left: x + TILE_W, top: Y0 + TILE_H / 2 - 20, opacity: Math.min(sp[i + 1], 1) }}>
                <path d={`M 12 20 L ${GAP - 22} 20`} stroke={RAISIN} strokeWidth={5} strokeLinecap="round" opacity={0.7} />
                <path d={`M ${GAP - 32} 10 L ${GAP - 18} 20 L ${GAP - 32} 30`} fill="none" stroke={RAISIN} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
              </svg>
            )}
          </React.Fragment>
        );
      })}
      {/* "super realistic" annotation — small, tucked under the first tiles, clear of the path */}
      <div style={{ position: "absolute", left: X0 + 10, top: Y0 + TILE_H + 54, width: 900, whiteSpace: "nowrap", opacity: real, transform: `rotate(-1.0deg) translateY(${(1 - real) * 14}px)` }}>
        <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 38, color: BODY }}>
          filmed for real — super realistic, <span style={{ color: RAISIN }}>no cherry-picking.</span>
        </span>
      </div>
      {/* GO — BIG, centered under the row, scales in on the words */}
      <div style={{ position: "absolute", left: X0 + 380, top: Y0 + TILE_H + 150, width: 1400, whiteSpace: "nowrap", textAlign: "center", opacity: goP, transform: `scale(${0.7 + 0.3 * goP}) rotate(-1.5deg)`, transformOrigin: "center" }}>
        <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 104, color: RAISIN }}>
          so, <span style={{ background: LIME, padding: "0 22px", borderRadius: 12 }}>let&apos;s go</span> →
        </span>
      </div>
    </>
  );
};

export default VideoEditIntro;

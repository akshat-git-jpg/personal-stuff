/**
 * AiEmployeeIntro v3 — WORLD-CANVAS register, US-shaped field (per Luuk:
 * "put all the dots in an outline of the actual United States").
 *
 * One environment: a light draftsman canvas holding THE LAYER world —
 * the contiguous US drawn as a faint hairline outline filled with 1,100
 * business marks (real point-in-polygon geometry from us_field.json), and,
 * to its right, a big architectural cross-section of a business. The camera
 * is the narrator; the speaker rides in a rounded screen-space card that
 * opens near-fullscreen (locked preference) and hands the stage to the world.
 *
 * Beat map (word-anchored to intros/aiemployee_scene1/words.json, 445f@30):
 *  1. HOOK    f0–f108   near-fullscreen card, counter races to 30,000 on the
 *                        footage (tick f40 on ",000"); the US outline fades on,
 *                        marks flood it west→east while the camera pulls BACK —
 *                        the recognizable country IS the greatness beat.
 *  2. SECTION f108–f206 one glide right to a big cross-section: `your team` /
 *                        conspicuous GAP / `the work`. Lime stratum glides into
 *                        the gap on "layer" (f180), seats f190 (tick).
 *  3. STRIKE  f206–f257 big chips `tools` (strike f212) & `automations` (f237).
 *  4. FLOW    f284–f374 task chips loop large along the lime stratum (slide f286).
 *  5. CLOSER  f370–f445 the camera pulls WAY back; the canvas goes dark; the same
 *                        US field returns in silver, ONE mark (heartland,
 *                        norm [0.55,0.45]) fills lime (f418) and blinks on "one."
 *                        (f431, tap). "almost zero." in Playfair. Black f433–445.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate,
  useCurrentFrame, useVideoConfig, staticFile, Easing,
  delayRender, continueRender, cancelRender,
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

const EASE = Easing.bezier(0.45, 0, 0.18, 1);

// deterministic pseudo-random
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* ---------------- the US field (world coords) ---------------- */
type UsField = { aspect: number; points: [number, number][]; outline: [number, number][][] };
// map plane in world units — honors aspect 1.894 so the country isn't stretched
const MAP = { x: 950, y: 460, w: 2400, h: 2400 / 1.894 };
const ONE = { x: MAP.x + 0.55 * MAP.w, y: MAP.y + 0.45 * MAP.h, s: 122 }; // the single lit business (heartland)

/* ---------------- cross-section geometry (world coords) ---------------- */
const CS = { x: 3700, w: 1700, h: 210, teamY: 340, gapY: 620, workY: 900, chipY: 1185 };

/* ---------------- world camera — one continuous move per intention ---------------- */
const CAM: [number, number, number, number][] = [
  [0, 900, 780, 1.05],       // behind the near-fullscreen card: slow creep
  [40, 950, 800, 1.0],
  [108, 1800, 950, 0.60],    // THE PULL-BACK — the country's size lands
  [190, 4230, 700, 0.78],    // one glide right: arrive as the lime layer seats
  [284, 4270, 730, 0.815],   // slow push through the strikes
  [370, 4340, 760, 0.73],    // ease back along the flowing stratum
  [425, 1800, 950, 0.40],    // the great retreat: the whole country, one lit mark
  [445, 1812, 958, 0.396],   // micro-drift on the hold
];
function cam(frame: number) {
  const ks = CAM;
  if (frame <= ks[0][0]) { const [, x, y, z] = ks[0]; return { x, y, z }; }
  for (let i = 0; i < ks.length - 1; i++) {
    const [fa, xa, ya, za] = ks[i]; const [fb, xb, yb, zb] = ks[i + 1];
    if (frame >= fa && frame <= fb) {
      const t = EASE((frame - fa) / Math.max(1, fb - fa));
      return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, z: za + (zb - za) * t };
    }
  }
  const [, x, y, z] = ks[ks.length - 1]; return { x, y, z };
}

const useIn = (at: number, dur = 14) => {
  const frame = useCurrentFrame();
  if (frame < at) return 0;
  return interpolate(frame, [at, at + dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
};

/* non-hook variant for use inside render closures */
function inP(frame: number, at: number, dur = 14) {
  if (frame < at) return 0;
  return interpolate(frame, [at, at + dur], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
}

const GRID_URI = (() => {
  const s = 76;
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'><path d='M ${s} 0 L 0 0 0 ${s}' fill='none' stroke='rgba(15,18,26,0.10)' stroke-width='1'/></svg>`
    )
  );
})();

const Sfx: React.FC<{ src: string; at: number; volume?: number }> = ({ src, at, volume = 0.3 }) => (
  <Sequence from={at} durationInFrames={f(1.6)}>
    <Audio src={staticFile(src)} volume={volume} />
  </Sequence>
);

export const AiEmployeeIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const wu = W / 1920;

  /* -------- load the real US geometry (public/…/us_field.json) -------- */
  const [handle] = useState(() => delayRender("load us_field.json"));
  const [us, setUs] = useState<UsField | null>(null);
  useEffect(() => {
    fetch(staticFile("intros/aiemployee_scene1/us_field.json"))
      .then((r) => r.json())
      .then((d: UsField) => { setUs(d); continueRender(handle); })
      .catch((e) => cancelRender(e));
  }, [handle]);

  // marks sorted west→east (with jitter) so the country fills like a wave
  const marks = useMemo(() => {
    if (!us) return [];
    const arr = us.points.map(([nx, ny], i) => ({
      x: MAP.x + nx * MAP.w, y: MAP.y + ny * MAP.h,
      s: 14 + rnd(i * 3 + 3) * 12, o: 0.3 + rnd(i * 5 + 14) * 0.2,
      key: nx + (rnd(i * 7 + 5) - 0.5) * 0.18,
    }));
    arr.sort((a, b) => a.key - b.key);
    const N = arr.length;
    return arr.map((m, k) => ({
      ...m,
      bornHook: 8 + Math.round(92 * Math.sqrt(k / N)),   // count(t) ∝ t² — floods faster and faster
      bornClose: 383 + Math.round(22 * Math.sqrt(k / N)),
    }));
  }, [us]);

  const outlineD = useMemo(() => {
    if (!us) return "";
    return us.outline
      .map((ring) => "M " + ring.map(([nx, ny]) => `${(MAP.x + nx * MAP.w).toFixed(1)} ${(MAP.y + ny * MAP.h).toFixed(1)}`).join(" L ") + " Z")
      .join(" ");
  }, [us]);

  const c0 = cam(frame);
  // constant micro-drift — no frame is ever still
  const c = { x: c0.x + Math.sin(frame / 38) * 5, y: c0.y + Math.cos(frame / 47) * 4, z: c0.z };

  const worldStyle: React.CSSProperties = {
    position: "absolute", left: 0, top: 0, width: 0, height: 0,
    transform: `translate(${W / 2 - c.x * wu * c.z}px, ${H / 2 - c.y * wu * c.z}px) scale(${c.z * wu})`,
    transformOrigin: "0 0",
  };

  /* -------- speaker card (screen space) — near-fullscreen open, locked preference -------- */
  const spk = (() => {
    const kf: [number, number, number, number][] = [
      [0, 0.500, 0.500, 0.94],     // OPEN near-fullscreen — canvas peeking at the edges
      [40, 0.500, 0.500, 0.94],
      [80, 0.160, 0.780, 0.200],   // glide to the corner as the world takes the stage
      [368, 0.160, 0.780, 0.200],
      [402, 0.870, 0.220, 0.240],  // closer: return a touch larger, top-right — clear of the country
      [445, 0.872, 0.222, 0.242],
    ];
    for (let i = 0; i < kf.length - 1; i++) {
      const [fa, xa, ya, wa] = kf[i]; const [fb, xb, yb, wb] = kf[i + 1];
      if (frame >= fa && frame <= fb) {
        const t = EASE((frame - fa) / Math.max(1, fb - fa));
        return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t, w: wa + (wb - wa) * t };
      }
    }
    const [, x, y, w] = kf[kf.length - 1]; return { x, y, w };
  })();
  const spkW = spk.w * W, spkH = spkW * 9 / 16;
  const spkRadius = 12 * wu; // 12px rounded corners — locked

  /* -------- hook counter (on the fullscreen footage) -------- */
  const count = Math.round(30000 * interpolate(frame, [8, 40], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.2, 0.55, 0.25, 1),
  }));
  const counterSettle = interpolate(frame, [40, 47], [1.03, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const overP = useIn(14, 8);
  const counterOut = interpolate(frame, [44, 60], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hookBlur = interpolate(frame, [0, 20], [8, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });

  /* -------- the US outline (hook register) -------- */
  const outlineIn = interpolate(frame, [6, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  /* -------- closer plate (the canvas goes dark for the last register) -------- */
  const plateP = interpolate(frame, [374, 394], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const closeOutlineP = inP(frame, 383, 15);
  const toBlack = interpolate(frame, [433, 445], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: SILVER_BG, fontFamily: SANS }}>
      {/* parallaxed faded draftsman grid */}
      <AbsoluteFill style={{
        backgroundImage: `url("${GRID_URI}")`,
        backgroundSize: `${76 * wu * c.z}px`,
        backgroundPosition: `${W / 2 - c.x * wu * c.z}px ${H / 2 - c.y * wu * c.z}px`,
        maskImage: "radial-gradient(ellipse 80% 75% at 50% 42%, #000 0%, rgba(0,0,0,.35) 62%, transparent 94%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 75% at 50% 42%, #000 0%, rgba(0,0,0,.35) 62%, transparent 94%)",
      }} />

      {/* ================= THE WORLD ================= */}
      {us && (
        <div style={worldStyle}>
          {/* the US field — hook register: outline first, then the marks flood it */}
          <svg width={6000} height={2600} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
            <path d={outlineD} fill="none" stroke={RAISIN} strokeWidth={2.4}
              strokeLinejoin="round" opacity={outlineIn * 0.38} />
            {marks.map((m, i) => {
              if (frame < m.bornHook) return null;
              const p = Math.min(1, (frame - m.bornHook) / 6);
              return (
                <rect key={i} x={m.x - m.s / 2} y={m.y - m.s / 2} width={m.s} height={m.s}
                  fill="none" stroke="rgba(15,18,26,0.52)" strokeWidth={2.4} opacity={p * 0.9} />
              );
            })}
          </svg>

          <FieldLockup />
          <CrossSection />

          {/* ---- closer: dark plate over the whole world, the country returns in silver ---- */}
          {plateP > 0 && (
            <div style={{ position: "absolute", left: -1600, top: -1300, width: 8600, height: 4600, background: RAISIN, opacity: plateP }} />
          )}
          {frame >= 383 && (
            <>
              <svg width={6000} height={2600} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
                <path d={outlineD} fill="none" stroke="rgba(233,236,237,0.30)" strokeWidth={2.4}
                  strokeLinejoin="round" opacity={closeOutlineP} />
                {marks.map((m, i) => {
                  if (frame < m.bornClose) return null;
                  // keep a clearing around the one mark and the serif line
                  if (Math.abs(m.x - ONE.x) < 330 && Math.abs(m.y - ONE.y) < 170) return null;
                  if (m.x > ONE.x - 1150 && m.x < ONE.x - 260 && Math.abs(m.y - ONE.y) < 150) return null;
                  const p = Math.min(1, (frame - m.bornClose) / 6);
                  return (
                    <rect key={i} x={m.x - m.s / 2} y={m.y - m.s / 2} width={m.s} height={m.s}
                      fill="none" stroke={`rgba(233,236,237,${m.o})`} strokeWidth={2.4} opacity={p} />
                  );
                })}
                {/* the ONE */}
                <rect x={ONE.x - ONE.s / 2} y={ONE.y - ONE.s / 2} width={ONE.s} height={ONE.s}
                  fill="none" stroke={`rgba(233,236,237,${0.65 * (1 - inP(frame, 418, 5))})`} strokeWidth={3.2}
                  opacity={Math.min(1, Math.max(0, (frame - 386) / 6))} />
                {frame >= 418 && (() => {
                  const fillP = interpolate(frame, [418, 423], [0, 1], { extrapolateRight: "clamp" });
                  const blink = frame >= 431 ? interpolate(frame, [431, 433, 437], [1, 0.1, 1], { extrapolateRight: "clamp" }) : 1;
                  return (
                    <rect x={ONE.x - ONE.s / 2} y={ONE.y - ONE.s / 2} width={ONE.s} height={ONE.s}
                      fill={LIME} opacity={fillP * blink}
                      style={{ filter: "drop-shadow(0 0 26px rgba(207,255,5,0.8))" }} />
                  );
                })()}
              </svg>
              {/* almost zero. — the one counterpoint */}
              {(() => {
                const p = inP(frame, 399, 12);
                return (
                  <div style={{
                    position: "absolute", left: ONE.x - 1180, top: ONE.y - 92, width: 1080, textAlign: "right",
                    fontFamily: SERIF, fontStyle: "italic", fontWeight: 500, fontSize: 132,
                    color: "rgba(255,255,255,0.95)", opacity: p, transform: `translateY(${(1 - p) * 18}px)`,
                    whiteSpace: "nowrap",
                  }}>almost zero.</div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ================= SPEAKER CARD (screen space) ================= */}
      <div style={{
        position: "absolute",
        left: spk.x * W - spkW / 2, top: spk.y * H - spkH / 2, width: spkW, height: spkH,
        borderRadius: spkRadius, overflow: "hidden",
        boxShadow: `0 ${W * 0.006}px ${W * 0.02}px rgba(15,18,26,0.30), 0 0 0 1px rgba(15,18,26,0.10)`,
      }}>
        <OffthreadVideo src={staticFile("intros/aiemployee_scene1/source.mp4")}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            filter: `contrast(1.06) saturate(1.08)${hookBlur > 0.1 ? ` blur(${hookBlur}px)` : ""}`,
          }} />
        {/* hook counter lockup — lives on the footage, leaves with the card */}
        {frame < 64 && counterOut > 0 && (
          <>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "40%", background: "linear-gradient(to top, rgba(15,18,26,0.66), transparent)", opacity: counterOut }} />
            <div style={{ position: "absolute", left: "5.2%", bottom: "9%", opacity: counterOut }}>
              <div style={{ fontFamily: MONO, fontSize: spkW * 0.012, fontWeight: 700, letterSpacing: "0.3em", color: "rgba(255,255,255,0.72)", opacity: overP }}>OVER</div>
              <div style={{
                fontFamily: SANS, fontWeight: 700, fontSize: spkW * 0.068, letterSpacing: "-0.03em", color: "#fff",
                lineHeight: 1.04, transform: `scale(${counterSettle})`, transformOrigin: "left bottom",
              }}>
                {count.toLocaleString("en-US")}
              </div>
            </div>
          </>
        )}
      </div>

      {/* SFX — landings only */}
      <Sfx src="vedit/sfx/tick_soft.wav" at={40} volume={0.30} />
      <Sfx src="vedit/sfx/slide.wav" at={44} volume={0.26} />
      <Sfx src="vedit/sfx/tick.wav" at={190} volume={0.38} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={213} volume={0.26} />
      <Sfx src="vedit/sfx/tick_soft.wav" at={238} volume={0.26} />
      <Sfx src="vedit/sfx/slide.wav" at={286} volume={0.28} />
      <Sfx src="vedit/sfx/slide.wav" at={374} volume={0.30} />
      <Sfx src="vedit/sfx/tap.wav" at={431} volume={0.34} />

      {toBlack > 0 && <AbsoluteFill style={{ background: "#000", opacity: toBlack, pointerEvents: "none" }} />}
    </AbsoluteFill>
  );
};

/* ---------------- world station: the field lockup ---------------- */
const FieldLockup: React.FC = () => {
  const frame = useCurrentFrame();
  const numP = useIn(62, 14);
  const eyeP = useIn(78, 10);
  const tagP = useIn(88, 10);
  const hide = interpolate(frame, [368, 382], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (hide <= 0) return null;
  return (
    <div style={{ opacity: hide }}>
      <div style={{
        position: "absolute", left: 340, top: 204, fontFamily: MONO, fontSize: 30, fontWeight: 700,
        letterSpacing: "0.28em", color: BODY, opacity: eyeP, whiteSpace: "nowrap",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <span style={{ width: 14, height: 14, background: LIME, display: "inline-block" }} />
        US BUSINESSES · RIGHT NOW
      </div>
      <div style={{
        position: "absolute", left: 328, top: 250, fontFamily: SANS, fontWeight: 700, fontSize: 210,
        letterSpacing: "-0.04em", color: RAISIN, lineHeight: 1, opacity: numP,
        transform: `translateY(${(1 - numP) * 30}px)`, whiteSpace: "nowrap",
      }}>30,000</div>
      <div style={{
        position: "absolute", left: 348, top: 508, fontFamily: MONO, fontSize: 27, letterSpacing: "0.2em",
        color: BODY, opacity: tagP * 0.9, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 12,
      }}>
        <span style={{ width: 16, height: 16, border: "2.4px solid rgba(15,18,26,0.52)", display: "inline-block", boxSizing: "border-box" }} />
        1 MARK = 1 BUSINESS
      </div>
    </div>
  );
};

/* ---------------- world station: the cross-section ---------------- */
const FLOW_CHIPS = ["inbox", "invoices", "reports", "follow-ups"];

const CrossSection: React.FC = () => {
  const frame = useCurrentFrame();
  const tagP = useIn(138, 12);
  const teamP = useIn(146, 14);
  const workP = useIn(158, 14);
  const dashP = useIn(168, 12) * interpolate(frame, [184, 191], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // lime stratum glides in on "layer" (f180), seats f190
  const glide = interpolate(frame, [178, 190], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.3, 0, 0.15, 1) });
  const limeIn = interpolate(frame, [178, 184], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const seatGlow = interpolate(frame, [190, 194, 208], [0, 1, 0.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const toolsIn = useIn(206, 10);
  const toolsStrike = interpolate(frame, [212, 221], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const autoIn = useIn(231, 10);
  const autoStrike = interpolate(frame, [237, 246], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  const flowAt = 284;
  const flowRamp = interpolate(frame, [flowAt, flowAt + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  if (frame < 138) return null;

  const strat = (y: number, label: string, p: number) => (
    <div style={{
      position: "absolute", left: CS.x, top: y + (1 - p) * 26, width: CS.w, height: CS.h,
      background: "#fff", border: `1px solid ${SILVER_SOFT}`, borderRadius: 12,
      boxShadow: "0 2px 6px rgba(15,18,26,.07), 0 18px 38px -14px rgba(15,18,26,.22)",
      display: "flex", alignItems: "center", paddingLeft: 64, boxSizing: "border-box", opacity: p,
    }}>
      <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 64, letterSpacing: "-0.01em", color: RAISIN, whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );

  const chip = (x: number, txt: string, chipIn: number, strikeP: number) => (
    <div style={{
      position: "absolute", left: x, top: CS.chipY + (1 - chipIn) * 18,
      padding: "20px 46px", background: "#fff", border: `1px solid ${SILVER_SOFT}`, borderRadius: 60,
      boxShadow: "0 2px 6px rgba(15,18,26,.07), 0 12px 26px -12px rgba(15,18,26,.2)",
      opacity: chipIn * (strikeP >= 1 ? 0.55 : 1), whiteSpace: "nowrap",
    }}>
      <span style={{ position: "relative", display: "inline-block", fontFamily: MONO, fontSize: 40, letterSpacing: "0.08em", color: BODY }}>
        {txt}
        <span style={{ position: "absolute", left: "-3%", top: "52%", height: 5, width: `${strikeP * 106}%`, background: RAISIN, borderRadius: 3, opacity: 0.85 }} />
      </span>
    </div>
  );

  return (
    <>
      <div style={{
        position: "absolute", left: CS.x + 6, top: 246, opacity: tagP, fontFamily: MONO,
        fontSize: 28, fontWeight: 700, letterSpacing: "0.22em", color: BODY, whiteSpace: "nowrap",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <span style={{ width: 14, height: 14, background: LIME, display: "inline-block" }} />
        FIG. 01 · A BUSINESS, IN CROSS-SECTION
      </div>

      {strat(CS.teamY, "your team", teamP)}
      {strat(CS.workY, "the work", workP)}

      {/* the conspicuous gap */}
      {dashP > 0 && (
        <div style={{
          position: "absolute", left: CS.x, top: CS.gapY, width: CS.w, height: CS.h,
          border: "3px dashed rgba(15,18,26,0.42)", borderRadius: 12, boxSizing: "border-box", opacity: dashP,
        }} />
      )}

      {/* the ai employee layer — lime-edged raisin stratum glides into the gap */}
      {limeIn > 0 && (
        <div style={{
          position: "absolute", left: CS.x, top: CS.gapY, width: CS.w, height: CS.h,
          transform: `translateX(${(1 - glide) * 2300}px)`, opacity: limeIn,
          background: RAISIN, border: `6px solid ${LIME}`, borderRadius: 12, boxSizing: "border-box",
          display: "flex", alignItems: "center", paddingLeft: 64,
          boxShadow: `0 18px 38px -12px rgba(15,18,26,.4), 0 0 ${26 + seatGlow * 44}px rgba(207,255,5,${0.16 + seatGlow * 0.3})`,
          overflow: "hidden",
        }}>
          <span style={{
            position: "relative", zIndex: 2, fontFamily: MONO, fontWeight: 700, fontSize: 52,
            letterSpacing: "0.1em", color: LIME, whiteSpace: "nowrap",
            background: RAISIN, padding: "12px 34px 12px 64px", marginLeft: -64,
          }}>ai employee layer</span>

          {/* the recurring work — chips loop left→right, visibly cycling */}
          {frame >= flowAt && FLOW_CHIPS.map((cName, i) => {
            const T = 84;
            const tt = (((frame - flowAt) / T + i / FLOW_CHIPS.length) % 1 + 1) % 1;
            const x = -430 + tt * (CS.w + 430);
            return (
              <div key={cName} style={{
                position: "absolute", left: x, top: "50%", transform: "translateY(-50%)",
                padding: "16px 40px", opacity: flowRamp,
                fontFamily: MONO, fontSize: 36, letterSpacing: "0.06em",
                color: LIME, background: "rgba(207,255,5,0.09)",
                border: "3px solid rgba(207,255,5,0.65)", borderRadius: 60,
                whiteSpace: "nowrap", zIndex: 1,
              }}>{cName}</div>
            );
          })}
        </div>
      )}

      {/* not tools, not automations */}
      {chip(CS.x + 40, "tools", toolsIn, toolsStrike)}
      {chip(CS.x + 520, "automations", autoIn, autoStrike)}
    </>
  );
};

export default AiEmployeeIntro;
